/* 颜色方形 + 删除高亮/划线 验证
   用法：node tests/verify-annot-delete.mjs [port]
*/
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { findBrowser } from "./_browser.mjs";

const [, , port = "8130"] = process.argv;
const CHROME = findBrowser();
const PORT = 9975 + Math.floor(Math.random() * 20);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-sandbox",
  `--remote-debugging-port=${PORT}`, "--window-size=1500,1000", "about:blank"], { stdio: "ignore" });

async function wsUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const p = tabs.find((t) => t.type === "page");
      if (p?.webSocketDebuggerUrl) return p.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error("no target");
}

const ws = new WebSocket(await wsUrl());
let id = 0; const pending = new Map(); const logs = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
    logs.push(m.params.args.map((a) => a.value ?? a.description ?? "").join(" "));
  }
  if (m.method === "Runtime.exceptionThrown") {
    logs.push("EXCEPTION: " + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  }
};
await new Promise((r) => (ws.onopen = r));
const send = (method, params = {}) => new Promise((res) => {
  const mid = ++id; pending.set(mid, res);
  ws.send(JSON.stringify({ id: mid, method, params }));
});
const evaluate = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description);
  return r.result.result.value;
};
const shot = async (name) => {
  mkdirSync("tests/.shots", { recursive: true });
  const r = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(name, Buffer.from(r.result.data, "base64"));
};

await send("Runtime.enable");
await send("Page.enable");
await send("Network.setCacheDisabled", { cacheDisabled: true });
await send("Emulation.setDeviceMetricsOverride", { width: 1500, height: 1000, deviceScaleFactor: 2, mobile: false });
await send("Page.navigate", { url: `http://127.0.0.1:${port}/#/reader/9091beec169d` });
await sleep(8000);

let fails = 0;
const check = (n, c, d = "") => { if (c) console.log(`  PASS ${n}`); else { fails++; console.log(`  FAIL ${n} ${d}`); } };
const paperId = "9091beec169d";

await evaluate(`(async () => {
  const l = await (await fetch('/api/papers/${paperId}/annotations')).json();
  for (const a of l) await fetch('/api/papers/${paperId}/annotations/' + a.id, { method: 'DELETE' });
  return 1;
})()`);

/* ========== 1. 颜色块是正方形（不是圆形） ========== */
const dotInfo = JSON.parse(await evaluate(`(async () => {
  const page = document.querySelector('.pdf-page');
  const spans = [...page.querySelectorAll('.textLayer span')].filter(function(s){
    return (s.textContent || '').trim().length >= 8;
  });
  const picked = spans[Math.floor(spans.length / 2)];
  const node = picked.firstChild;
  const range = document.createRange();
  range.setStart(node, 0); range.setEnd(node, node.textContent.length);
  const sel = window.getSelection();
  sel.removeAllRanges(); sel.addRange(range);
  const tr = picked.getBoundingClientRect();
  picked.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: tr.left + 5, clientY: tr.top + 5 }));
  await new Promise(function(r){ setTimeout(r, 300); });
  const dots = [...document.querySelectorAll('.sel-pop .sel-dot')];
  return JSON.stringify({
    count: dots.length,
    styles: dots.map(function(d){
      const cs = getComputedStyle(d);
      const r = d.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), radius: cs.borderRadius };
    }),
  });
})()`));
console.log("颜色块:", JSON.stringify(dotInfo, null, 2));
check("有 5 个颜色块", dotInfo.count === 5, `count=${dotInfo.count}`);
check("颜色块是正方形（宽=高）", dotInfo.styles.every((s) => Math.abs(s.w - s.h) <= 1),
  JSON.stringify(dotInfo.styles.map((s) => `${s.w}x${s.h}`)));
check("圆角为小圆角（非 50%/圆形）",
  dotInfo.styles.every((s) => {
    const r = parseFloat(s.radius);
    return Number.isFinite(r) && r <= 4;
  }), JSON.stringify(dotInfo.styles.map((s) => s.radius)));

await shot("tests/.shots/selpop-square.png");

/* ========== 2. 创建高亮和划线，检查有悬停删除按钮 ========== */
/* 注意：必须限定在同一页内取 span，否则会跨页创建多条批注 */
const makeAnnotInPage = (kind, offset) => [
  "(async () => {",
  "  const page = document.querySelector('.pdf-page');",
  "  const spans = [...page.querySelectorAll('.textLayer span')].filter(function(s){",
  "    return (s.textContent || '').trim().length >= 8;",
  "  });",
  "  const picked = spans[Math.min(spans.length - 1, " + offset + ")];",
  "  const node = picked.firstChild;",
  "  const range = document.createRange();",
  "  range.setStart(node, 0);",
  "  range.setEnd(node, node.textContent.length);",
  "  const sel = window.getSelection();",
  "  sel.removeAllRanges();",
  "  sel.addRange(range);",
  "  const tr = picked.getBoundingClientRect();",
  "  picked.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: tr.left + 5, clientY: tr.top + 5 }));",
  "  await new Promise(function(r){ setTimeout(r, 300); });",
  "  const btn = document.querySelector('.sel-pop [data-selact=\"" + kind + "\"]');",
  "  if (!btn) return JSON.stringify({ err: 'no ' + '" + kind + "' + ' button' });",
  "  const br = btn.getBoundingClientRect();",
  "  const o = { bubbles: true, cancelable: true, clientX: br.left + 3, clientY: br.top + 3, button: 0 };",
  "  btn.dispatchEvent(new MouseEvent('mousedown', o));",
  "  btn.dispatchEvent(new MouseEvent('mouseup', o));",
  "  btn.dispatchEvent(new MouseEvent('click', o));",
  "  await new Promise(function(r){ setTimeout(r, 1200); });",
  "  return JSON.stringify({ ok: true });",
  "})()",
].join("\n");

await evaluate(makeAnnotInPage("highlight", 2));
await sleep(600);
await evaluate(makeAnnotInPage("underline", 6));
await sleep(800);

const created = JSON.parse(await evaluate(`(async () => {
  const list = await (await fetch('/api/papers/${paperId}/annotations')).json();
  const page = document.querySelector('.pdf-page');
  const dels = [...page.querySelectorAll('.annot-del-float')];
  // 每条批注在当前页的每个 side（原文/译文）各画一份，按 annotId 去重才是逻辑条数
  const uniqIds = [...new Set(dels.map(function(d){ return d.dataset.annotId; }))];
  return JSON.stringify({
    backend: list.length,
    kinds: list.map(function(a){ return a.kind; }),
    delButtons: dels.length,
    uniqueDelIds: uniqIds.length,
    delTitles: [...new Set(dels.map(function(d){ return d.title; }))],
    delVisibleByDefault: dels.length ? getComputedStyle(dels[0]).opacity : null,
    delPointerEvents: dels.length ? getComputedStyle(dels[0]).pointerEvents : null,
  });
})()`));
console.log("创建的批注:", JSON.stringify(created, null, 2));
check("高亮与划线都已创建", created.backend === 2 && created.kinds.includes("highlight") && created.kinds.includes("underline"),
  JSON.stringify(created.kinds));
// 双语对照每页 1 个 side（compare 单文档），所以每个批注 1 个按钮；
// 若切到双文档并排则会是 2 个。这里按「每条批注至少一个按钮」断言。
check("每条批注都有删除按钮", created.uniqueDelIds === 2,
  `uniqueIds=${created.uniqueDelIds}, buttons=${created.delButtons}`);
check("删除按钮默认隐藏", created.delVisibleByDefault === "0", `opacity=${created.delVisibleByDefault}`);
check("删除按钮可点击（pointer-events:auto）", created.delPointerEvents === "auto", created.delPointerEvents);

/* ========== 3. 悬停高亮 rectangle → 删除按钮显现 ========== */
const hoverState = JSON.parse(await evaluate(`(async () => {
  const page = document.querySelector('.pdf-page');
  const rect = page.querySelector('.annot-rect.annot-highlight');
  const id = rect.dataset.annotId;
  const del = page.querySelector('.annot-del-float[data-annot-id="' + id + '"]');
  // 用 mouseover 模拟悬停（:has 选择器依赖真实 hover，这里检查选中态兜底）
  PdfAnnot.select(document.querySelector('#pane-dual2') || document.querySelector('#pane-en'), id);
  await new Promise(function(r){ setTimeout(r, 300); });
  const rect2 = page.querySelector('.annot-rect.is-selected');
  const del2 = page.querySelector('.annot-del-float[data-annot-id="' + id + '"]');
  return JSON.stringify({
    hasRectSelected: !!rect2,
    delOpacityOnSelected: del2 ? getComputedStyle(del2).opacity : null,
  });
})()`));
console.log("选中态删除按钮:", JSON.stringify(hoverState));
check("选中批注时删除按钮显现", hoverState.delOpacityOnSelected === "1", JSON.stringify(hoverState));

/* ========== 4. 点击删除按钮 → 后端与页面同步删除 ========== */
const delResult = JSON.parse(await evaluate(`(async () => {
  const before = await (await fetch('/api/papers/${paperId}/annotations')).json();
  const hl = before.find(function(a){ return a.kind === 'highlight'; });
  const btn = document.querySelector('.annot-del-float[data-annot-id="' + hl.id + '"]');
  if (!btn) return JSON.stringify({ err: 'no delete button' });
  const r = btn.getBoundingClientRect();
  const o = { bubbles: true, cancelable: true, clientX: r.left + 5, clientY: r.top + 5, button: 0 };
  btn.dispatchEvent(new MouseEvent('mousedown', o));
  btn.dispatchEvent(new MouseEvent('mouseup', o));
  btn.dispatchEvent(new MouseEvent('click', o));
  await new Promise(function(r2){ setTimeout(r2, 1500); });
  const after = await (await fetch('/api/papers/${paperId}/annotations')).json();
  const page = document.querySelector('.pdf-page');
  const ids = function(sel){ return [...new Set([...page.querySelectorAll(sel)].map(function(e){ return e.dataset.annotId; }))]; };
  return JSON.stringify({
    beforeCount: before.length,
    afterCount: after.length,
    remainKinds: after.map(function(a){ return a.kind; }),
    paintedHighlightIds: ids('.annot-rect.annot-highlight'),
    paintedUnderlineIds: ids('.annot-rect.annot-underline'),
    delIds: ids('.annot-del-float'),
  });
})()`));
console.log("删除高亮:", JSON.stringify(delResult, null, 2));
check("点击删除按钮后高亮从后端移除", delResult.afterCount === delResult.beforeCount - 1, JSON.stringify(delResult));
check("高亮不再绘制在页面上", delResult.paintedHighlightIds.length === 0, JSON.stringify(delResult));
check("划线仍然保留", delResult.paintedUnderlineIds.length === 1, JSON.stringify(delResult));
check("删除按钮同步移除对应项", delResult.delIds.length === 1, JSON.stringify(delResult.delIds));

/* ========== 5. 删除划线 ========== */
const delUl = JSON.parse(await evaluate(`(async () => {
  const btn = document.querySelector('.annot-del-float');
  if (!btn) return JSON.stringify({ err: 'no button left' });
  const r = btn.getBoundingClientRect();
  const o = { bubbles: true, cancelable: true, clientX: r.left + 5, clientY: r.top + 5, button: 0 };
  btn.dispatchEvent(new MouseEvent('mousedown', o));
  btn.dispatchEvent(new MouseEvent('mouseup', o));
  btn.dispatchEvent(new MouseEvent('click', o));
  await new Promise(function(r2){ setTimeout(r2, 1500); });
  const after = await (await fetch('/api/papers/${paperId}/annotations')).json();
  const page = document.querySelector('.pdf-page');
  return JSON.stringify({
    afterCount: after.length,
    rectsLeft: page.querySelectorAll('.annot-rect').length,
    delsLeft: page.querySelectorAll('.annot-del-float').length,
  });
})()`));
console.log("删除划线:", JSON.stringify(delUl));
check("划线也被删除", delUl.afterCount === 0, JSON.stringify(delUl));
check("页面批注层已清空", delUl.rectsLeft === 0 && delUl.delsLeft === 0, JSON.stringify(delUl));

/* ========== 6. 侧栏删除按钮同步（回归） ========== */
/* 先确保库与页面都是干净的 */
await evaluate(`(async () => {
  const l = await (await fetch('/api/papers/${paperId}/annotations')).json();
  for (const a of l) await fetch('/api/papers/${paperId}/annotations/' + a.id, { method: 'DELETE' });
  await loadAnnotations(paperById('${paperId}'));
  await fetch('/api/papers/${paperId}/annotations', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'highlight', page: 1, color: 'green',
      rects: [{ x: 0.2, y: 0.3, w: 0.3, h: 0.02 }], text: '侧栏删除测试', comment: '' }),
  });
  await loadAnnotations(paperById('${paperId}'));
  return 1;
})()`);
await sleep(1000);
const sideDel = JSON.parse(await evaluate(`(async () => {
  document.querySelector('[data-action="annot-panel"]').click();
  await new Promise(function(r){ setTimeout(r, 900); });
  const before = document.querySelectorAll('.annot-item').length;
  document.querySelector('.annot-item .annot-del').click();
  await new Promise(function(r){ setTimeout(r, 1500); });
  const list = await (await fetch('/api/papers/${paperId}/annotations')).json();
  const page = document.querySelector('.pdf-page');
  return JSON.stringify({
    beforeItems: before,
    afterItems: document.querySelectorAll('.annot-item').length,
    backend: list.length,
    rectsLeft: page.querySelectorAll('.annot-rect').length,
  });
})()`));
console.log("侧栏删除:", JSON.stringify(sideDel));
check("侧栏删除同步后端与页面",
  sideDel.beforeItems === 1 && sideDel.backend === 0 && sideDel.afterItems === 0 && sideDel.rectsLeft === 0,
  JSON.stringify(sideDel));

console.log("\nconsole 错误:", logs.length ? logs.join(" | ") : "无");
console.log(fails === 0 ? "全部通过" : `${fails} 项失败`);

await evaluate(`(async () => {
  const l = await (await fetch('/api/papers/${paperId}/annotations')).json();
  for (const a of l) await fetch('/api/papers/${paperId}/annotations/' + a.id, { method: 'DELETE' });
  return 1;
})()`);

ws.close(); chrome.kill();
process.exit(fails ? 1 : 0);
