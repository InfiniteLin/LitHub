/* 批注气泡定位 + 自动划线 + 移除色彩选择 验证
   用法：node tests/verify-note-popup.mjs [port]
*/
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { findBrowser } from "./_browser.mjs";

const [, , port = "8130"] = process.argv;
const CHROME = findBrowser();
const PORT = 9600 + Math.floor(Math.random() * 40);
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
await sleep(4000);
/* 显式等待前端脚本与 PDF 都就绪（否则后续 evaluate 会拿到 undefined） */
const boot = await evaluate(`(async () => {
  for (let i = 0; i < 60; i++) {
    const ok = typeof window.LithubAPI === 'object'
      && typeof window.PdfAnnot === 'object'
      && typeof createAnnotation === 'function'
      && document.querySelectorAll('.pdf-page').length > 0
      && document.querySelector('.pdf-page .textLayer span');
    if (ok) return 'ready';
    if (i === 20 && location.hash !== '#/reader/9091beec169d') {
      location.hash = '#/reader/9091beec169d';
    }
    await new Promise(function(r){ setTimeout(r, 300); });
  }
  return 'timeout: ' + JSON.stringify({
    api: typeof window.LithubAPI,
    annot: typeof window.PdfAnnot,
    create: typeof createAnnotation,
    pages: document.querySelectorAll('.pdf-page').length,
  });
})()`);
console.log("前端就绪:", boot);
if (boot !== "ready") {
  console.log("页面未就绪，终止");
  ws.close(); chrome.kill(); process.exit(1);
}
await sleep(1200);

let fails = 0;
const check = (n, c, d = "") => { if (c) console.log(`  PASS ${n}`); else { fails++; console.log(`  FAIL ${n} ${d}`); } };
const paperId = "9091beec169d";

await evaluate(`(async () => {
  const l = await (await fetch('/api/papers/${paperId}/annotations')).json();
  for (const a of l) await fetch('/api/papers/${paperId}/annotations/' + a.id, { method: 'DELETE' });
  await loadAnnotations(paperById('${paperId}'));
  return 1;
})()`);

/* 用真实 UI 创建一条「批注」（note）。
   注意：evaluate 已开 awaitPromise，表达式直接返回**对象**即可，
   不要再套 JSON.stringify（对 Promise 序列化会得到 {}）。 */
const createSrc = [
  "(async () => {",
  "  try {",
  "    const page = document.querySelector('.pdf-page');",
  "    const spans = [...page.querySelectorAll('.textLayer span')].filter(function(s){",
  "      return (s.textContent || '').trim().length >= 20;",
  "    });",
  "    if (spans.length < 3) return { err: 'spans too few', n: spans.length };",
  "    const picked = spans[Math.floor(spans.length / 2)];",
  "    const node = picked.firstChild;",
  "    const range = document.createRange();",
  "    range.setStart(node, 0);",
  "    range.setEnd(node, Math.min(node.textContent.length, 28));",
  "    const sel = window.getSelection();",
  "    sel.removeAllRanges(); sel.addRange(range);",
  "    const tr = picked.getBoundingClientRect();",
  "    picked.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: tr.left + 5, clientY: tr.top + 5 }));",
  "    await new Promise(function(r){ setTimeout(r, 450); });",
  "    const pop = document.querySelector('.sel-pop');",
  "    if (!pop) return { err: 'no sel-pop', selText: window.getSelection().toString().slice(0, 20) };",
  "    const btn = pop.querySelector('[data-selact=\"note\"]');",
  "    if (!btn) return { err: 'no note button', html: pop.innerHTML.slice(0, 160) };",
  "    const br = btn.getBoundingClientRect();",
  "    const o = { bubbles: true, cancelable: true, clientX: br.left + 3, clientY: br.top + 3, button: 0 };",
  "    btn.dispatchEvent(new MouseEvent('mousedown', o));",
  "    btn.dispatchEvent(new MouseEvent('mouseup', o));",
  "    btn.dispatchEvent(new MouseEvent('click', o));",
  "    await new Promise(function(r){ setTimeout(r, 1800); });",
  "    return { ok: true, annotPop: !!document.getElementById('annot-pop') };",
  "  } catch (e) {",
  "    return { err: e.message, stack: (e.stack || '').split('\\n').slice(0, 3).join(' | ') };",
  "  }",
  "})()",
].join("\n");
const created = await evaluate(createSrc);
console.log("创建批注结果:", JSON.stringify(created, null, 2));
check("创建批注成功", created.ok === true, JSON.stringify(created));

/* ===== 1. 气泡出现在批注文字附近 ===== */
const near = JSON.parse(await evaluate(`JSON.stringify((() => {
  const pop = document.getElementById('annot-pop');
  if (!pop) return { err: 'no popup' };
  const popR = pop.getBoundingClientRect();
  const page = document.querySelector('.pdf-page');
  const line = page.querySelector('.annot-rect.annot-note-line');
  const mark = page.querySelector('.annot-mark');
  const anchor = line || mark;
  if (!anchor) return { err: 'no anchor element' };
  const aR = anchor.getBoundingClientRect();
  return {
    pop: { left: Math.round(popR.left), top: Math.round(popR.top), w: Math.round(popR.width), h: Math.round(popR.height) },
    anchor: { left: Math.round(aR.left), top: Math.round(aR.top), right: Math.round(aR.right), bottom: Math.round(aR.bottom) },
    // 水平方向应与锚点有重叠或接近
    horizNear: Math.abs((popR.left + popR.width / 2) - (aR.left + aR.width / 2)) < 260,
    // 垂直方向应紧邻锚点（间距 < 120px）
    vertGap: popR.top >= aR.bottom ? Math.round(popR.top - aR.bottom) : Math.round(aR.top - popR.bottom),
    anchored: pop.classList.contains('anchored'),
    arrowPos: pop.style.getPropertyValue('--arrow-pos'),
    arrowDir: ['left','right','below','above'].find(function(d){ return pop.classList.contains('anchor-' + d); }) || null,
    cls: pop.className,
  };
})())`));
console.log("气泡位置:", JSON.stringify(near, null, 2));
check("气泡已锚定（anchored）", near.anchored === true, JSON.stringify(near));
check("气泡水平靠近批注文字", near.horizNear === true, JSON.stringify(near));
check("气泡垂直紧邻批注（间距 < 120px）", typeof near.vertGap === "number" && near.vertGap < 120, `gap=${near.vertGap}`);
check("气泡有指向三角（四方向之一）", !!near.arrowDir, JSON.stringify({ cls: near.cls }));
check("三角位置已计算", !!near.arrowPos, `arrowPos=${near.arrowPos}`);

/* ===== 2. 气泡内没有色彩选择 ===== */
const noColors = JSON.parse(await evaluate(`JSON.stringify((() => {
  const pop = document.getElementById('annot-pop');
  return {
    colorDots: pop.querySelectorAll('.sel-dot, [data-annot-color]').length,
    selColors: pop.querySelectorAll('.sel-colors').length,
    hasTextarea: !!document.getElementById('annot-comment'),
    hasDelete: !!pop.querySelector('[data-annot-del]'),
    hasSave: !!pop.querySelector('[data-annot-save]'),
    headText: pop.querySelector('.annot-pop-head')?.textContent.trim(),
  };
})())`));
console.log("气泡内容:", JSON.stringify(noColors));
check("气泡内已无色彩选择", noColors.colorDots === 0 && noColors.selColors === 0, JSON.stringify(noColors));
check("保留备注输入框/删除/保存", noColors.hasTextarea && noColors.hasDelete && noColors.hasSave);

/* ===== 3. 批注文字下方自动划线 ===== */
const underline = JSON.parse(await evaluate(`JSON.stringify((() => {
  const page = document.querySelector('.pdf-page');
  const lines = [...page.querySelectorAll('.annot-rect.annot-note-line')];
  const marks = [...page.querySelectorAll('.annot-mark')];
  return {
    noteLines: lines.length,
    marks: marks.length,
    lineStyle: lines[0] ? {
      borderBottom: getComputedStyle(lines[0]).borderBottom,
      background: getComputedStyle(lines[0]).backgroundColor,
    } : null,
    // 划线应该和文字矩形同宽
    lineRect: lines[0] ? (function(){
      const r = lines[0].getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    })() : null,
  };
})())`));
console.log("自动划线:", JSON.stringify(underline, null, 2));
check("批注文字下方有划线", underline.noteLines >= 1, JSON.stringify(underline));
check("划线有下边框", underline.lineStyle && underline.lineStyle.borderBottom.includes("solid"), JSON.stringify(underline.lineStyle));
check("划线自身透明（不遮挡文字）", underline.lineStyle && underline.lineStyle.background.includes("rgba(0, 0, 0, 0)"), JSON.stringify(underline.lineStyle));
check("批注标记仍然存在", underline.marks >= 1);

await shot("tests/.shots/note-popup-near.png");

/* ===== 4. 靠近底部的批注：气泡应翻到上方 ===== */
await evaluate(`document.querySelector('[data-annot-close]')?.click()`);
await sleep(400);
const bottomSrc = [
  "(async () => {",
  "  try {",
  "    const pane = document.querySelector('#pane-dual2');",
  "    pane.scrollTop = 600;",
  "    await new Promise(function(r){ setTimeout(r, 1300); });",
  "    const page = document.querySelector('.pdf-page');",
  "    const spans = [...page.querySelectorAll('.textLayer span')].filter(function(s){",
  "      return (s.textContent || '').trim().length >= 15;",
  "    });",
  "    const candidates = spans.filter(function(s){",
  "      const r = s.getBoundingClientRect();",
  "      return r.top > window.innerHeight - 260 && r.top < window.innerHeight - 60;",
  "    });",
  "    const picked = candidates[0] || spans[spans.length - 1];",
  "    if (!picked) return { err: 'no span' };",
  "    const node = picked.firstChild;",
  "    const range = document.createRange();",
  "    range.setStart(node, 0); range.setEnd(node, Math.min(node.textContent.length, 20));",
  "    const sel = window.getSelection();",
  "    sel.removeAllRanges(); sel.addRange(range);",
  "    const tr = picked.getBoundingClientRect();",
  "    picked.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: tr.left + 5, clientY: tr.top + 5 }));",
  "    await new Promise(function(r){ setTimeout(r, 400); });",
  "    const btn = document.querySelector('.sel-pop [data-selact=\"note\"]');",
  "    if (!btn) return { err: 'no sel-pop' };",
  "    const br = btn.getBoundingClientRect();",
  "    const o = { bubbles: true, cancelable: true, clientX: br.left + 3, clientY: br.top + 3, button: 0 };",
  "    btn.dispatchEvent(new MouseEvent('mousedown', o));",
  "    btn.dispatchEvent(new MouseEvent('mouseup', o));",
  "    btn.dispatchEvent(new MouseEvent('click', o));",
  "    await new Promise(function(r){ setTimeout(r, 1600); });",
  "    const pop = document.getElementById('annot-pop');",
  "    if (!pop) return { err: 'no annot popup' };",
  "    const popR = pop.getBoundingClientRect();",
  "    const mark = document.querySelector('.annot-mark');",
  "    const aR = mark ? mark.getBoundingClientRect() : null;",
  "    return {",
  "      popTop: Math.round(popR.top),",
  "      popBottom: Math.round(popR.bottom),",
  "      viewportH: window.innerHeight,",
  "      anchorTop: aR ? Math.round(aR.top) : null,",
  "      flippedAbove: pop.classList.contains('anchor-above'),",
  "      insideViewport: popR.top >= 0 && popR.bottom <= window.innerHeight,",
  "    };",
  "  } catch (e) { return { err: e.message }; }",
  "})()",
].join("\n");
const bottomCase = await evaluate(bottomSrc);
console.log("底部区域批注:", JSON.stringify(bottomCase, null, 2));
check("气泡始终在视口内", bottomCase.insideViewport === true, JSON.stringify(bottomCase));
await shot("tests/.shots/note-popup-flip.png");

/* ===== 5. 保存备注后仍能重新打开 ===== */
/* 确保气泡是打开的（第 4 步可能已关闭或未创建） */
const ensurePop = await evaluate(`(() => {
  if (document.getElementById('annot-pop')) return { already: true };
  const mark = document.querySelector('.annot-mark');
  if (!mark) return { err: 'no annot-mark' };
  mark.click();
  return { clicked: true };
})()`);
await sleep(1200);
const popReady = await evaluate(`!!document.getElementById('annot-pop') && !!document.getElementById('annot-comment')`);
check("第5步前气泡已就绪", popReady === true, JSON.stringify(ensurePop));

const fillResult = await evaluate(`(() => {
  const ta = document.getElementById('annot-comment');
  if (!ta) return { err: 'no textarea' };
  ta.value = '这是一条测试备注';
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  const btn = document.querySelector('[data-annot-save]');
  if (!btn) return { err: 'no save btn' };
  btn.click();
  return { ok: true, value: ta.value };
})()`);
console.log("填写并点保存:", JSON.stringify(fillResult));
await sleep(2500);   // 等保存请求真正完成（含后端往返）

/* 先直接核对后端是否真的存了 */
const backendCheck = await evaluate(`(async () => {
  const list = await (await fetch('/api/papers/${paperId}/annotations')).json();
  return list.map(function(a){ return { id: a.id, kind: a.kind, comment: a.comment }; });
})()`);
console.log("后端批注:", JSON.stringify(backendCheck));
check("备注已写入后端", backendCheck.some((a) => (a.comment || "").includes("测试备注")),
  JSON.stringify(backendCheck));
const reopenSrc = [
  "(async () => {",
  "  // 用「带备注的那条批注」的 id 精确定位，避免取到页面上的第一条（可能备注为空）",
  "  const list = await (await fetch('/api/papers/" + paperId + "/annotations')).json();",
  "  const withComment = list.find(function(a){ return (a.comment || '').indexOf('测试备注') >= 0; });",
  "  if (!withComment) return { err: 'no annotated comment in backend' };",
  "  const mark = document.querySelector('.annot-mark[data-annot-id=\"' + withComment.id + '\"]');",
  "  if (!mark) return { err: 'mark not found for ' + withComment.id };",
  "  mark.click();",
  "  await new Promise(function(r){ setTimeout(r, 900); });",
  "  const pop = document.getElementById('annot-pop');",
  "  return {",
  "    reopened: !!pop,",
  "    comment: document.getElementById('annot-comment')?.value || '',",
  "    anchored: pop ? pop.classList.contains('anchored') : false,",
  "  };",
  "})()",
].join("\n");
const reopen = await evaluate(reopenSrc);
console.log("重新打开:", JSON.stringify(reopen));
check("保存后可重新打开气泡", reopen.reopened === true);
check("备注内容已保留", (reopen.comment || "").includes("测试备注"), reopen.comment);
check("重新打开也保持锚定", reopen.anchored === true);

console.log("\nconsole 错误:", logs.length ? logs.join(" | ") : "无");

await evaluate(`(async () => {
  const l = await (await fetch('/api/papers/${paperId}/annotations')).json();
  for (const a of l) await fetch('/api/papers/${paperId}/annotations/' + a.id, { method: 'DELETE' });
  const pane = document.querySelector('#pane-dual2');
  PdfAnnot.setAll(pane, []);
  return 1;
})()`);

console.log(fails === 0 ? "全部通过" : `${fails} 项失败`);
ws.close(); chrome.kill();
process.exit(fails ? 1 : 0);
