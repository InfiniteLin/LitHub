/* 笔记标签页验证（真实浏览器 + CDP）
   覆盖：
   · 文献库附件树点「笔记」→ 新建标签页（不是右侧栏）
   · 标签页标题、图标、激活态正确
   · 整页编辑器可用（Markdown + 公式渲染、自动保存）
   · 同名标签不重复堆叠；关闭标签页回到相邻页
   · PDF 阅读器内的「笔记」按钮仍然是右侧栏（不回归）
   · 右侧栏「在新标签页打开」可把笔记搬到整页
   · 笔记内容在整页与右侧栏之间共享（同一个后端实体）
   用法：node tests/verify-note-tab.mjs [port]
*/
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { findBrowser } from "./_browser.mjs";

const [, , port = "8130"] = process.argv;
const CHROME = findBrowser();
const PORT = 9900 + Math.floor(Math.random() * 40);
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
await send("Page.navigate", { url: `http://127.0.0.1:${port}/#/library` });
await sleep(7000);

let fails = 0;
const check = (n, c, d = "") => { if (c) console.log(`  PASS ${n}`); else { fails++; console.log(`  FAIL ${n} ${d}`); } };

/* 等 Vditor 实例真正就绪再断言（异步初始化完成前 setValue 会丢） */
async function waitEditorReady(timeout = 12000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const ok = await evaluate(`typeof NoteEditor !== 'undefined' && NoteEditor._ready()`);
    if (ok) return true;
    await sleep(250);
  }
  return false;
}

/* 后端拉一篇有原文的文献，用它来测 */
const paper = JSON.parse(await evaluate(`(async () => {
  const list = await (await fetch('/api/papers')).json();
  const p = list.find(x => x.file_url || x.pages);
  return JSON.stringify(p ? { id: p.id, title: p.title, note_count: p.note_count } : null);
})()`));
if (!paper) { console.log("没有可用文献，无法测试"); process.exit(1); }
console.log("测试文献:", paper.id, "|", paper.title.slice(0, 50));

/* 记录初始笔记 id 快照（结束时只删本次新增的，不动用户已有笔记） */
const baseNoteIds = JSON.parse(await evaluate(`(async () => {
  const l = await (await fetch('/api/papers/${paper.id}/notes')).json();
  return JSON.stringify(l.map(n => n.id));
})()`));
const baseNotes = baseNoteIds.length;

/* ========== 1. 文献库附件树 → 点「笔记」开新标签页 ========== */
await evaluate(`(() => {
  const wrap = [...document.querySelectorAll('.row-wrap')].find(w => w.dataset.rowId === '${paper.id}');
  if (!wrap) return 'no-wrap';
  if (!wrap.classList.contains('open')) wrap.querySelector('[data-action="toggle-row"]').click();
  return wrap.classList.contains('open');
})()`);
await sleep(600);

const before = JSON.parse(await evaluate(`JSON.stringify({
  tabs: document.querySelectorAll('#tab-strip .tab').length,
  hash: location.hash,
  noteRows: document.querySelectorAll('[data-action="open-note"]').length,
})`));
console.log("点击前:", JSON.stringify(before));
check("附件树里有「笔记」行且绑定 open-note", before.noteRows >= 1, JSON.stringify(before));

await evaluate(`document.querySelector('.row-wrap[data-row-id="${paper.id}"] [data-action="open-note"]')?.click()`);
await sleep(2500);

const afterClick = JSON.parse(await evaluate(`JSON.stringify((() => {
  const tabs = [...document.querySelectorAll('#tab-strip .tab')];
  const active = tabs.find(t => t.classList.contains('active'));
  const page = document.getElementById('note-page');
  const view = document.getElementById('view');
  return {
    hash: location.hash,
    tabCount: tabs.length,
    activeKind: active?.dataset.action,
    activeTabKey: active?.dataset.tabKey,
    activeTitle: active?.querySelector('.tab-title')?.textContent || '',
    hasPage: !!page,
    hasPanel: !!document.getElementById('note-panel'),
    // 专注视图：侧栏 DOM 根本不应存在（不是靠 display:none 藏起来）
    hasSidebarDom: !!document.getElementById('sidebar'),
    sidebarVisible: !!document.getElementById('sidebar') && getComputedStyle(document.getElementById('sidebar')).display !== 'none',
    // 铺满：笔记页宽度应等于窗口宽度
    pageW: page ? Math.round(page.getBoundingClientRect().width) : 0,
    viewW: view ? Math.round(view.getBoundingClientRect().width) : 0,
    innerW: window.innerWidth,
    backBtn: !!document.querySelector('[data-action="route"][data-id="library"]'),
  };
})())`));
console.log("点击后:", JSON.stringify(afterClick, null, 2));
check("点击笔记 → 路由到整页笔记", afterClick.hash === `#/note/${paper.id}`, afterClick.hash);
check("新增了一个标签页", afterClick.tabCount === before.tabs + 1, `tabCount=${afterClick.tabCount}`);
check("新标签页处于激活态", afterClick.activeKind === "open-note" && afterClick.activeTabKey === `note:${paper.id}`,
  JSON.stringify(afterClick));
check("标签页标题带「笔记 ·」前缀", afterClick.activeTitle.startsWith("笔记 ·"), afterClick.activeTitle);
check("渲染的是整页笔记，不是右侧栏", afterClick.hasPage === true && afterClick.hasPanel === false);
check("笔记页不渲染侧栏（专注视图）", afterClick.hasSidebarDom === false && afterClick.sidebarVisible === false,
  JSON.stringify(afterClick));
check("笔记页铺满窗口宽度", Math.abs(afterClick.pageW - afterClick.innerW) <= 1,
  `page=${afterClick.pageW} inner=${afterClick.innerW}`);
check("笔记页提供了返回文献库入口", afterClick.backBtn === true);

/* ========== 2. 整页编辑器可用 ========== */
const editor = JSON.parse(await evaluate(`JSON.stringify({
  hasEditor: !!document.querySelector('.note-vditor-mount .vditor'),
  hasPreview: !!document.querySelector('.note-vditor-mount .vditor-ir'),
  mode: document.getElementById('note-body')?.dataset.mode,
  host: typeof noteState !== 'undefined' ? noteState.host : null,
  edMode: typeof NoteEditor !== 'undefined' ? NoteEditor.getMode() : null,
})`));
console.log("编辑器:", JSON.stringify(editor));
check("整页笔记有编辑器", editor.hasEditor && editor.hasPreview);
check("整页笔记默认即时渲染", editor.edMode === "live", editor.edMode);
check("noteState.host 标记为 page", editor.host === "page", editor.host);

/* 写入带公式的 Markdown，验证渲染 + 自动保存 */
const md = [
  "# 标签页里的笔记",
  "",
  "行内公式 $a^2 + b^2 = c^2$，块级：",
  "",
  "$$\\int_0^1 x^2\\,dx = \\frac{1}{3}$$",
  "",
  "- 条目一",
  "- 条目二",
  "",
  "| 列 | 值 |",
  "| --- | --- |",
  "| A | 1 |",
].join("\n");
await waitEditorReady();
await evaluate(`(() => {
  NoteEditor.setValue(${JSON.stringify(md)});
  markNoteDirty();
  return 1;
})()`);
await sleep(2600);

const rendered = JSON.parse(await evaluate(`JSON.stringify((() => {
  const pv = document.querySelector('.vditor-ir .vditor-reset');
  return {
    katex: pv ? pv.querySelectorAll('.katex').length : 0,
    katexDisplay: pv ? pv.querySelectorAll('.katex-display').length : 0,
    table: !!pv?.querySelector('table'),
    h1: !!pv?.querySelector('h1'),
    saveState: document.getElementById('note-save-state')?.textContent,
    dirty: noteState.dirty,
  };
})())`));
console.log("渲染与保存:", JSON.stringify(rendered));
check("整页也能渲染 KaTeX 公式", rendered.katex >= 2, `katex=${rendered.katex}`);
check("块级公式居中", rendered.katexDisplay >= 1);
check("表格与标题渲染", rendered.table && rendered.h1);
check("自动保存完成", rendered.dirty === false && rendered.saveState === "已保存", JSON.stringify(rendered));

await shot("tests/.shots/note-tab.png");

/* ========== 3. 同一标签不重复堆叠 ========== */
const t1 = await evaluate(`document.querySelectorAll('#tab-strip .tab').length`);
await evaluate(`location.hash='#/library'`);
await sleep(1200);
// 回文献库后侧栏必须重新出现，否则用户没了导航
const back = JSON.parse(await evaluate(`JSON.stringify((() => {
  const sb = document.getElementById('sidebar');
  const view = document.getElementById('view');
  return {
    hasSidebar: !!sb,
    sidebarVisible: !!sb && getComputedStyle(sb).display !== 'none',
    viewW: view ? Math.round(view.getBoundingClientRect().width) : 0,
    innerW: window.innerWidth,
  };
})())`));
console.log("返回文献库:", JSON.stringify(back));
check("返回文献库后侧栏重新显示", back.hasSidebar && back.sidebarVisible === true, JSON.stringify(back));
check("文献库内容区重新让出侧栏宽度", back.viewW < back.innerW, JSON.stringify(back));

await evaluate(`(() => {
  const wrap = [...document.querySelectorAll('.row-wrap')].find(w => w.dataset.rowId === '${paper.id}');
  if (wrap && !wrap.classList.contains('open')) wrap.querySelector('[data-action="toggle-row"]').click();
  return 1;
})()`);
await sleep(500);
await evaluate(`document.querySelector('.row-wrap[data-row-id="${paper.id}"] [data-action="open-note"]')?.click()`);
await sleep(1800);
const t2 = JSON.parse(await evaluate(`JSON.stringify({
  count: document.querySelectorAll('#tab-strip .tab').length,
  hash: location.hash,
})`));
console.log("再次打开:", JSON.stringify(t2));
check("重复打开同一笔记不新增标签", t2.count === t1, `before=${t1} after=${t2.count}`);

/* ========== 4. 关闭标签页 ========== */
await evaluate(`document.querySelector('#tab-strip .tab.active .tab-close')?.click()`);
await sleep(1200);
const closed = JSON.parse(await evaluate(`JSON.stringify({
  count: document.querySelectorAll('#tab-strip .tab').length,
  hash: location.hash,
  hasPage: !!document.getElementById('note-page'),
})`));
console.log("关闭后:", JSON.stringify(closed));
check("关闭笔记标签页", closed.hasPage === false && !closed.hash.startsWith("#/note/"), JSON.stringify(closed));
check("关闭后不会残留笔记标签", closed.count === 1, `count=${closed.count}`);

/* ========== 5. 阅读器内的「笔记」按钮仍是右侧栏（不回归） ========== */
await evaluate(`location.hash='#/reader/${paper.id}'`);
await sleep(4500);
await evaluate(`document.querySelector('[data-action="note-panel"]')?.click()`);
await sleep(2800);
const panelStill = JSON.parse(await evaluate(`JSON.stringify({
  hasPanel: !!document.getElementById('note-panel'),
  hasPage: !!document.getElementById('note-page'),
  host: noteState.host,
  tabCount: document.querySelectorAll('#tab-strip .tab').length,
  popoutBtn: !!document.querySelector('[data-action="note-popout"]'),
})`));
console.log("阅读器侧栏:", JSON.stringify(panelStill));
check("阅读器内点笔记仍是右侧栏", panelStill.hasPanel === true && panelStill.hasPage === false);
check("侧栏 host 标记为 panel", panelStill.host === "panel", panelStill.host);
check("侧栏有「在新标签页打开」按钮", panelStill.popoutBtn === true);

/* ========== 6. 侧栏 → 整页（内容共享同一实体） ========== */
const panelContent = await evaluate(`typeof NoteEditor !== 'undefined' ? NoteEditor.getValue() : ''`);
await evaluate(`document.querySelector('[data-action="note-popout"]')?.click()`);
await sleep(3000);
const popout = JSON.parse(await evaluate(`JSON.stringify({
  hash: location.hash,
  hasPage: !!document.getElementById('note-page'),
  hasPanel: !!document.getElementById('note-panel'),
  contentSame: typeof NoteEditor !== 'undefined' && NoteEditor.getValue() === ${JSON.stringify(panelContent)},
  tabIsNote: document.querySelector('#tab-strip .tab.active')?.dataset.action === 'open-note',
})`));
console.log("侧栏 → 整页:", JSON.stringify(popout));
check("面板可弹出为整页标签页", popout.hasPage === true && popout.hash === `#/note/${paper.id}`);
check("弹出后面板已收起", popout.hasPanel === false);
check("整页与侧栏是同一份笔记（内容一致）", popout.contentSame === true);

/* ========== 7. 两篇文献可各开笔记标签页并切换 ========== */
const papers = JSON.parse(await evaluate(`(async () => {
  const l = await (await fetch('/api/papers')).json();
  return JSON.stringify(l.slice(0, 2).map(p => ({ id: p.id, title: p.title })));
})()`));
if (papers.length >= 2) {
  await evaluate(`location.hash='#/note/${papers[1].id}'`);
  await sleep(2200);
  const two = JSON.parse(await evaluate(`JSON.stringify((() => {
    const tabs = [...document.querySelectorAll('#tab-strip .tab')];
    return {
      noteTabs: tabs.filter(t => t.dataset.action === 'open-note').length,
      titles: tabs.filter(t => t.dataset.action === 'open-note').map(t => t.querySelector('.tab-title').textContent.slice(0, 14)),
      activeKey: tabs.find(t => t.classList.contains('active'))?.dataset.tabKey,
    };
  })())`));
  console.log("两篇文献:", JSON.stringify(two));
  check("两篇文献的笔记标签页共存", two.noteTabs === 2, JSON.stringify(two));
  check("切换后激活的是第二篇的笔记标签", two.activeKey === `note:${papers[1].id}`, two.activeKey);
}

await shot("tests/.shots/note-tab-multi.png");

/* ========== 8. 离开笔记页时未保存内容不丢 ========== */
await evaluate(`location.hash='#/note/${paper.id}'`);
await sleep(2200);
const beforeLeave = await evaluate(`(async () => {
  NoteEditor.setValue(NoteEditor.getValue() + ${JSON.stringify("\n\n**离开前的最后一句话**")});
  markNoteDirty();
  // 立刻离开，赶在 800ms 自动保存之前
  location.hash = '#/library';
  await new Promise(r => setTimeout(r, 100));
  return 1;
})()`);
await sleep(2000);
const persisted = await evaluate(`(async () => {
  const l = await (await fetch('/api/papers/${paper.id}/notes')).json();
  return l.some(n => (n.content || '').includes('离开前的最后一句话'));
})()`);
check("离开笔记页前自动落盘（不丢改动）", persisted === true);

/* ========== 收尾：清理本次测试产生的笔记 ==========
   按 id 白名单删（不是按数量截取）——否则第二篇文献的笔记会残留。 */
const allPaperIds = [...new Set([paper.id, ...papers.map((p) => p.id)])];
const cleaned = await evaluate(`(async () => {
  const base = new Set(${JSON.stringify(baseNoteIds)});
  let n = 0;
  for (const pid of ${JSON.stringify(allPaperIds)}) {
    const l = await (await fetch('/api/papers/' + pid + '/notes')).json();
    for (const note of l) {
      if (base.has(note.id)) continue;   // 保留原有笔记
      await fetch('/api/papers/' + pid + '/notes/' + note.id, { method: 'DELETE' });
      n++;
    }
  }
  return n;
})()`);
const left = await evaluate(`(async () => {
  let n = 0;
  for (const pid of ${JSON.stringify(allPaperIds)}) {
    const l = await (await fetch('/api/papers/' + pid + '/notes')).json();
    n += l.length;
  }
  return n;
})()`);
console.log(`\n笔记清理：删除 ${cleaned} 条新增，剩余 ${left} 条（原有 ${baseNotes} 条）`);
check("测试笔记已清理干净", left === baseNotes, `left=${left} base=${baseNotes}`);

console.log("\nconsole 错误:", logs.length ? logs.join(" | ") : "无");
console.log(fails === 0 ? "全部通过" : `${fails} 项失败`);
ws.close(); chrome.kill();
process.exit(fails ? 1 : 0);
