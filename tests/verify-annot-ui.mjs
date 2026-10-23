/* 批注真实 UI 路径 + 列表侧栏验证
   重点：完全模拟用户操作（选中文字 → 点浮条按钮 → 列表出现 → 点击跳转 → 删除）
   用法：node tests/verify-annot-ui.mjs [port]
*/
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { findBrowser } from "./_browser.mjs";

const [, , port = "8130"] = process.argv;
const CHROME = findBrowser();
const PORT = 9920 + Math.floor(Math.random() * 40);
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
await send("Network.enable");
await send("Network.setCacheDisabled", { cacheDisabled: true });
await send("Emulation.setDeviceMetricsOverride", { width: 1500, height: 1000, deviceScaleFactor: 2, mobile: false });
await send("Page.navigate", { url: `http://127.0.0.1:${port}/#/reader/9091beec169d` });
await sleep(8000);

let fails = 0;
const check = (n, c, d = "") => { if (c) console.log(`  PASS ${n}`); else { fails++; console.log(`  FAIL ${n} ${d}`); } };
const paperId = "9091beec169d";

/* 清理历史 */
await evaluate(`(async () => {
  const l = await (await fetch('/api/papers/${paperId}/annotations')).json();
  for (const a of l) await fetch('/api/papers/${paperId}/annotations/' + a.id, { method: 'DELETE' });
  return 1;
})()`);
await evaluate(`(async () => { await loadAnnotations(paperById('${paperId}')); return 1; })()`);
await sleep(800);

/* ========== 工具：用真实鼠标事件序列选中文字并点击浮条按钮 ========== */
const realAnnotate = (kind) => [
  "(async () => {",
  "  const page = document.querySelector('.pdf-page');",
  "  const spans = [...page.querySelectorAll('.textLayer span')].filter(function(s){",
  "    return (s.textContent || '').trim().length >= 8;",
  "  });",
  "  const picked = spans[Math.floor(spans.length / 2)];",
  "  const node = picked.firstChild;",
  "  const range = document.createRange();",
  "  range.setStart(node, 0);",
  "  range.setEnd(node, node.textContent.length);",
  "  const sel = window.getSelection();",
  "  sel.removeAllRanges();",
  "  sel.addRange(range);",
  "  // 真实鼠标：在文字上松开",
  "  const tr = picked.getBoundingClientRect();",
  "  picked.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: tr.left + 5, clientY: tr.top + 5 }));",
  "  await new Promise(function(r){ setTimeout(r, 250); });",
  "  const btn = document.querySelector('.sel-pop [data-selact=\"" + kind + "\"]');",
  "  if (!btn) return JSON.stringify({ err: 'no button', popup: !!document.querySelector('.sel-pop') });",
  "  const br = btn.getBoundingClientRect();",
  "  const o = { bubbles: true, cancelable: true, clientX: br.left + 3, clientY: br.top + 3, button: 0 };",
  "  btn.dispatchEvent(new MouseEvent('mousedown', o));",
  "  btn.dispatchEvent(new MouseEvent('mouseup', o));",
  "  btn.dispatchEvent(new MouseEvent('click', o));",
  "  await new Promise(function(r){ setTimeout(r, 1500); });",
  "  return JSON.stringify({ clicked: true, popupGone: !document.querySelector('.sel-pop') });",
  "})()",
].join("\n");

/* ========== 1. 三种批注都能通过真实点击创建 ========== */
for (const [kind, label] of [["highlight", "高亮"], ["underline", "划线"], ["note", "批注"]]) {
  const r = JSON.parse(await evaluate(realAnnotate(kind)));
  await sleep(300);
  // 批注类型会弹出编辑气泡，先关掉再继续
  if (kind === "note") {
    await evaluate(`document.querySelector('[data-annot-close]')?.click()`);
    await sleep(300);
  }
  const after = JSON.parse(await evaluate(`(async () => {
    const list = await (await fetch('/api/papers/${paperId}/annotations')).json();
    const page = document.querySelector('.pdf-page');
    return JSON.stringify({
      backend: list.length,
      myKind: list.filter(function(a){ return a.kind === '${kind}'; }).length,
      painted: page.querySelectorAll('.annot-rect, .annot-mark').length,
    });
  })()`));
  check(`真实点击创建${label}`, r.clicked && after.myKind >= 1, JSON.stringify({ r, after }));
}

/* 页面绘制总数应为 3 条（2 个 rect + 1 个 mark） */
const painted = JSON.parse(await evaluate(`JSON.stringify({
  highlights: document.querySelectorAll('.annot-rect.annot-highlight').length,
  underlines: document.querySelectorAll('.annot-rect.annot-underline').length,
  marks: document.querySelectorAll('.annot-mark').length,
})`));
console.log("  页面绘制:", JSON.stringify(painted));
check("页面绘制 3 类批注",
  painted.highlights >= 1 && painted.underlines >= 1 && painted.marks >= 1, JSON.stringify(painted));

/* pendingSelection 应在创建后清空 */
const pend = await evaluate(`String(typeof pendingSelection === 'undefined' ? 'undefined' : (pendingSelection ? 'set' : 'cleared'))`);
check("创建后清空待处理选区（防重复创建）", pend === "cleared", pend);

/* ========== 2. 批注列表侧栏 ========== */
/* 先 loadAnnotations 同步列表数据（真实场景由 mountPdfHosts 调用） */
await evaluate(`(async () => { await loadAnnotations(paperById('${paperId}')); return 1; })()`);
await sleep(600);

await evaluate(`document.querySelector('[data-action="annot-panel"]').click()`);
await sleep(1200);

const panel = JSON.parse(await evaluate(`JSON.stringify((() => {
  const el = document.getElementById('annot-panel');
  const items = [...document.querySelectorAll('.annot-item')];
  const groups = [...document.querySelectorAll('.annot-group')];
  return {
    open: !!el,
    total: document.getElementById('annot-total')?.textContent,
    itemCount: items.length,
    groupCount: groups.length,
    pageHeads: groups.map(function(g){ return g.querySelector('.annot-page-head')?.textContent.trim(); }),
    hasKindLabels: items.length ? items.every(function(i){ return !!i.querySelector('.annot-kind'); }) : false,
    hasTexts: items.filter(function(i){ return !!i.querySelector('.annot-text'); }).length,
    filters: document.querySelectorAll('.annot-fbtn').length,
    btnActive: document.querySelector('[data-action="annot-panel"]').classList.contains('is-on'),
  };
})())`));
console.log("批注侧栏:", JSON.stringify(panel, null, 2));
check("侧栏已打开", panel.open === true);
check("侧栏统计数量正确", panel.total === "3", `total=${panel.total}`);
check("列表渲染 3 条批注", panel.itemCount === 3, `count=${panel.itemCount}`);
check("按页分组显示", panel.groupCount >= 1 && panel.pageHeads.some((h) => h && h.includes("页")));
check("每条显示类型标签", panel.hasKindLabels === true);
check("有原文引用", panel.hasTexts >= 2, `withText=${panel.hasTexts}`);
check("筛选按钮 4 个", panel.filters === 4);
check("工具栏按钮为激活态", panel.btnActive === true);

await shot("tests/.shots/annot-list.png");

/* ========== 3. 筛选 ========== */
await evaluate(`document.querySelector('[data-action="annot-filter"][data-id="note"]').click()`);
await sleep(500);
const filtered = JSON.parse(await evaluate(`JSON.stringify({
  count: document.querySelectorAll('.annot-item').length,
  activeFilter: document.querySelector('.annot-fbtn.active')?.dataset.id,
  meta: document.getElementById('annot-meta')?.textContent,
})`));
console.log("筛选 批注:", JSON.stringify(filtered));
check("筛选只显示批注类", filtered.count === 1 && filtered.activeFilter === "note", JSON.stringify(filtered));

await evaluate(`document.querySelector('[data-action="annot-filter"][data-id="all"]').click()`);
await sleep(400);

/* ========== 4. 点击列表项跳转 ========== */
const jumpBefore = await evaluate(`document.querySelector('.pane').scrollTop`);
await evaluate(`document.querySelector('.annot-item[data-action="annot-jump"]').click()`);
await sleep(1500);
const jumpAfter = JSON.parse(await evaluate(`JSON.stringify({
  scrollTop: document.querySelector('.pane').scrollTop,
  selectedCount: document.querySelectorAll('.annot-rect.is-selected, .annot-mark.is-selected').length,
  activeItem: document.querySelectorAll('.annot-item.is-active').length,
})`));
console.log("点击跳转:", JSON.stringify({ jumpBefore, ...jumpAfter }));
check("点击列表项高亮对应批注", jumpAfter.selectedCount >= 1 || jumpAfter.activeItem >= 1, JSON.stringify(jumpAfter));

/* ========== 5. 删除批注（列表按钮） ========== */
await evaluate(`document.querySelector('.annot-item .annot-del').click()`);
await sleep(1500);
const afterDel = JSON.parse(await evaluate(`(async () => {
  const list = await (await fetch('/api/papers/${paperId}/annotations')).json();
  return JSON.stringify({
    backend: list.length,
    listItems: document.querySelectorAll('.annot-item').length,
    total: document.getElementById('annot-total')?.textContent,
  });
})()`));
console.log("删除批注:", JSON.stringify(afterDel));
check("删除后后端与列表同步", afterDel.backend === 2 && afterDel.listItems === 2, JSON.stringify(afterDel));

/* ========== 6. 导出为笔记 ========== */
await evaluate(`document.querySelector('[data-action="annot-export-notes"]').click()`);
await sleep(2000);
const exported = JSON.parse(await evaluate(`(async () => {
  const notes = await (await fetch('/api/papers/${paperId}/notes')).json();
  const hit = notes.find(function(n){ return n.title.indexOf('阅读批注') >= 0; });
  return JSON.stringify({
    noteCount: notes.length,
    found: !!hit,
    title: hit ? hit.title : null,
    hasHeading: hit ? hit.content.indexOf('# 阅读批注') === 0 : false,
    hasPageSection: hit ? /## 第 \\d+ 页/.test(hit.content) : false,
    contentPreview: hit ? hit.content.slice(0, 160) : null,
  });
})()`));
console.log("导出笔记:", JSON.stringify(exported, null, 2));
check("导出为笔记成功", exported.found === true, JSON.stringify(exported));
check("笔记含标题与页分组", exported.hasHeading && exported.hasPageSection, JSON.stringify(exported));

await shot("tests/.shots/annot-list-export.png");

/* ========== 7. 关闭侧栏 ========== */
await evaluate(`document.querySelector('[data-action="annot-panel-close"]').click()`);
await sleep(600);
const closed = await evaluate(`!document.getElementById('annot-panel')`);
check("可关闭侧栏", closed === true);

/* 清理 */
await evaluate(`(async () => {
  const l = await (await fetch('/api/papers/${paperId}/annotations')).json();
  for (const a of l) await fetch('/api/papers/${paperId}/annotations/' + a.id, { method: 'DELETE' });
  const n = await (await fetch('/api/papers/${paperId}/notes')).json();
  for (const x of n) await fetch('/api/papers/${paperId}/notes/' + x.id, { method: 'DELETE' });
  return 1;
})()`);

console.log("\nconsole 错误:", logs.length ? logs.join(" | ") : "无");
console.log(fails === 0 ? "全部通过" : `${fails} 项失败`);
ws.close(); chrome.kill();
process.exit(fails ? 1 : 0);
