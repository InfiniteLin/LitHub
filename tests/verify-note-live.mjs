/* 笔记编辑器（Vditor）端到端验证
   覆盖：即时渲染 IR、KaTeX、表格、模式切换、自动保存、内容往返、图片上传入口
   用法：node tests/verify-note-live.mjs [port]
*/
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { findBrowser } from "./_browser.mjs";

const [, , port = "8130"] = process.argv;
const CHROME = findBrowser();
const PORT = 9820 + Math.floor(Math.random() * 40);
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
let id = 0; const pending = new Map(); const logs = []; const external = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error")
    logs.push(m.params.args.map((a) => a.value ?? a.description ?? "").join(" "));
  if (m.method === "Runtime.exceptionThrown")
    logs.push("EXC: " + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  if (m.method === "Network.requestWillBeSent") {
    const u = m.params.request.url;
    // 只关心编辑器资源是否外链（index.html 的 Google Fonts 是既有行为，不算）
    if (u.startsWith("http") && !u.includes("127.0.0.1:" + port) && /vditor|katex|lute|highlight/i.test(u)) external.push(u);
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

/* 选一篇文献 */
const paper = JSON.parse(await evaluate(`(async () => {
  const list = await (await fetch('/api/papers')).json();
  const p = list.find(x => x.pages);
  return JSON.stringify(p ? { id: p.id, title: p.title } : null);
})()`));
if (!paper) { console.log("没有可用文献"); process.exit(1); }
console.log("文献:", paper.id);

const baseIds = JSON.parse(await evaluate(`(async () => {
  const l = await (await fetch('/api/papers/${paper.id}/notes')).json();
  return JSON.stringify(l.map(n => n.id));
})()`));

/* ========== 1. 打开整页笔记，编辑器挂载 ========== */
await evaluate(`location.hash='#/note/${paper.id}'`);
await sleep(4500);

const boots = JSON.parse(await evaluate(`JSON.stringify((() => ({
  hasPage: !!document.getElementById('note-page'),
  hasMount: !!document.querySelector('.note-vditor-mount'),
  hasIr: !!document.querySelector('.vditor-ir'),
  vditorLoaded: !!window.Vditor,
  editorReady: typeof NoteEditor !== 'undefined' && NoteEditor._ready(),
  mode: typeof NoteEditor !== 'undefined' ? NoteEditor.getMode() : null,
}))())`));
console.log("挂载:", JSON.stringify(boots));
check("整页笔记已打开", boots.hasPage);
check("Vditor 已加载", boots.vditorLoaded === true);
check("编辑器实例就绪", boots.editorReady === true);
check("默认即时渲染（ir）", boots.hasIr === true && boots.mode === "live", JSON.stringify(boots));

/* ========== 2. 写入带公式/表格的 Markdown，验证即时渲染 ========== */
const md = [
  "# 即时渲染测试",
  "",
  "行内公式 $a^2 + b^2 = c^2$ 与 **粗体**",
  "",
  "$$\\int_0^1 x^2\\,dx = \\frac{1}{3}$$",
  "",
  "- 条目一",
  "- 条目二",
  "",
  "| 列 | 值 |",
  "| --- | --- |",
  "| A | 1 |",
  "",
  "```python",
  "print('hi')",
  "```",
].join("\n");

await evaluate(`(() => { NoteEditor.setValue(${JSON.stringify(md)}); return 1; })()`);
await sleep(2500);

const live = JSON.parse(await evaluate(`JSON.stringify((() => {
  const ir = document.querySelector('.vditor-ir .vditor-reset');
  return {
    katex: document.querySelectorAll('.vditor-ir .katex').length,
    katexDisplay: document.querySelectorAll('.vditor-ir .katex-display').length,
    hasH1: !!ir?.querySelector('h1'),
    hasStrong: !!ir?.querySelector('strong'),
    hasTable: !!ir?.querySelector('table'),
    hasCode: !!ir?.querySelector('pre code'),
    hasList: !!ir?.querySelector('li'),
  };
})())`));
console.log("即时渲染:", JSON.stringify(live));
check("标题即时渲染", live.hasH1 === true);
check("粗体即时渲染", live.hasStrong === true);
check("KaTeX 行内公式即时渲染", live.katex >= 2, "katex=" + live.katex);
check("KaTeX 块级公式即时渲染", live.katexDisplay >= 1, "display=" + live.katexDisplay);
check("表格即时渲染", live.hasTable === true);
check("代码块即时渲染", live.hasCode === true);
check("列表即时渲染", live.hasList === true);

/* ========== 2b. 整页「纸张」布局（回归：正文曾被挤成中间窄带） ========== */
const layout = JSON.parse(await evaluate(`JSON.stringify((() => {
  const reset = document.querySelector('.vditor-ir .vditor-reset');
  const body = document.getElementById('note-body');
  const page = document.getElementById('note-page');
  const cs = reset ? getComputedStyle(reset) : null;
  const bs = body ? getComputedStyle(body) : null;
  return {
    resetW: reset ? Math.round(reset.getBoundingClientRect().width) : 0,
    bodyW: body ? Math.round(body.getBoundingClientRect().width) : 0,
    padLeft: cs ? parseFloat(cs.paddingLeft) : -1,
    padRight: cs ? parseFloat(cs.paddingRight) : -1,
    bodyBg: bs ? bs.backgroundColor : '',
    bodyBorder: bs ? parseFloat(bs.borderTopWidth) : 0,
    bodyRadius: bs ? parseFloat(bs.borderTopLeftRadius) : 0,
    pageBg: page ? getComputedStyle(page).backgroundColor : '',
  };
})())`));
console.log("纸张布局:", JSON.stringify(layout));
// Vditor 默认用 max(35,(容器宽-800)/2) 给正文加左右内边距，1500px 窗口下会到 350px。
// 我们的适配层把 preview.maxWidth 设成足够大，让它恒为最小值。
check("正文没有被挤成中间窄带（左右内边距 <= 60px）",
  layout.padLeft <= 60 && layout.padRight <= 60, `pad=${layout.padLeft}/${layout.padRight}`);
check("正文宽度接近容器宽度（>= 90%）",
  layout.bodyW > 0 && layout.resetW / layout.bodyW >= 0.9,
  `reset=${layout.resetW} body=${layout.bodyW}`);
check("正文区有独立底色（与页面背景不同）",
  layout.bodyBg !== layout.pageBg && layout.bodyBg !== "rgba(0, 0, 0, 0)",
  `body=${layout.bodyBg} page=${layout.pageBg}`);
check("正文区有边框", layout.bodyBorder >= 1, `border=${layout.bodyBorder}`);
check("正文区有圆角（像一张纸）", layout.bodyRadius >= 4, `radius=${layout.bodyRadius}`);

/* 深色模式下纸的底色必须跟着主题走（否则白纸配浅字看不见） */
const darkPaper = JSON.parse(await evaluate(`JSON.stringify((() => {
  const root = document.documentElement;
  const prev = root.dataset.theme;
  root.dataset.theme = 'dark';
  const paper = getComputedStyle(root).getPropertyValue('--paper-page').trim();
  root.dataset.theme = prev;
  return { darkPaper: paper, lightPaper: getComputedStyle(root).getPropertyValue('--paper-page').trim() };
})())`));
console.log("主题纸张色:", JSON.stringify(darkPaper));
check("深色模式覆盖了纸张底色", darkPaper.darkPaper && darkPaper.darkPaper !== darkPaper.lightPaper,
  JSON.stringify(darkPaper));

await shot("tests/.shots/note-live.png");

/* ========== 3. getValue 往返（源码不丢） ========== */
const roundtrip = JSON.parse(await evaluate(`JSON.stringify({
  value: NoteEditor.getValue(),
})`));
check("getValue 保留原始 Markdown",
  roundtrip.value.includes("$a^2 + b^2 = c^2$") && roundtrip.value.includes("| 列 | 值 |"),
  JSON.stringify(roundtrip.value?.slice(0, 80)));

/* ========== 4a. 真实键盘输入触发变更（验证 input 回调确实接上了） ========== */
await evaluate(`(() => { NoteEditor.setValue(${JSON.stringify("# 键盘输入测试\n\n")}); NoteEditor.focus(); return 1; })()`);
await sleep(1200);
// 把光标放到文末，用真实键入追加文字
await evaluate(`(() => {
  const inst = NoteEditor._instance();
  const el = inst.vditor.ir.element;
  el.focus();
  const sel = window.getSelection();
  sel.removeAllRanges();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  sel.addRange(range);
  return 1;
})()`);
await send("Input.insertText", { text: "真实键入的那句话" });
await sleep(2600);

const typed = JSON.parse(await evaluate(`(async () => {
  const v = NoteEditor.getValue();
  const l = await (await fetch('/api/papers/${paper.id}/notes')).json();
  const hit = l.find(n => (n.content || '').includes('真实键入的那句话'));
  return JSON.stringify({ valueHas: v.includes('真实键入的那句话'), persisted: !!hit });
})()`));
console.log("真实键盘输入:", JSON.stringify(typed));
check("真实键盘输入进入编辑器内容", typed.valueHas === true);
check("真实键盘输入触发自动保存", typed.persisted === true);

/* ========== 4b. 自动保存（程序化 setValue + markNoteDirty） ========== */
await evaluate(`(() => {
  const inst = NoteEditor._instance();
  inst.setValue(${JSON.stringify(md + "\n\n自动保存探针")}, false);
  NoteEditor._instance().vditor.ir.element.dispatchEvent(new Event('input', { bubbles: true }));
  return 1;
})()`);
// 直接走应用层的变更通道更可靠
await evaluate(`(() => { markNoteDirty(); return 1; })()`);
await sleep(3000);

const saved = JSON.parse(await evaluate(`(async () => {
  const l = await (await fetch('/api/papers/${paper.id}/notes')).json();
  const hit = l.find(n => (n.content || '').includes('自动保存探针'));
  return JSON.stringify({
    persisted: !!hit,
    dirty: noteState.dirty,
    saveState: document.getElementById('note-save-state')?.textContent,
  });
})()`));
console.log("自动保存:", JSON.stringify(saved));
check("输入后自动保存到后端", saved.persisted === true);
check("保存状态回到已保存", saved.dirty === false && saved.saveState === "已保存", JSON.stringify(saved));

/* ========== 5. 三种视图切换 ========== */
for (const m of ["source", "read", "live"]) {
  await evaluate(`document.querySelector('[data-action="note-mode"][data-id="${m}"]').click()`);
  await sleep(2200);
  const st = JSON.parse(await evaluate(`JSON.stringify((() => {
    const cnt = document.querySelectorAll('.vditor-ir .katex').length;
    const ro = document.querySelector('.note-read-host');
    return {
      mode: NoteEditor.getMode(),
      segActive: document.querySelector('.seg-note-mode .seg-btn.active')?.dataset.id,
      hasSv: !!document.querySelector('.vditor-sv'),
      hasIr: !!document.querySelector('.vditor-ir'),
      readVisible: ro ? !ro.hidden : false,
      readKatex: ro ? ro.querySelectorAll('.katex').length : 0,
      irKatex: cnt,
      valueKept: NoteEditor.getValue().includes('即时渲染测试'),
    };
  })())`));
  console.log(`模式 ${m}:`, JSON.stringify(st));
  check(`切到 ${m} 模式`, st.mode === m && st.segActive === m, JSON.stringify(st));
  check(`${m} 模式保留内容`, st.valueKept === true);
  if (m === "source") check("source 模式渲染源码分屏", st.hasSv === true, JSON.stringify(st));
  if (m === "read") check("read 模式只读渲染公式", st.readVisible === true && st.readKatex >= 2, JSON.stringify(st));
  if (m === "live") check("切回 live 恢复即时渲染", st.hasIr === true && st.irKatex >= 2, JSON.stringify(st));
}

await shot("tests/.shots/note-live-modes.png");

/* ========== 6. 图片上传通道可用 ========== */
const imgOk = JSON.parse(await evaluate(`(async () => {
  const canvas = document.createElement('canvas');
  canvas.width = 80; canvas.height = 40;
  canvas.getContext('2d').fillRect(0, 0, 80, 40);
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
  const md = await uploadNoteImage(blob, 'probe.png');
  return JSON.stringify({ md, ok: /^!\\[[^\\]]*\\]\\(https?:\\/\\/.+\\.png\\)$/.test(md.trim()) });
})()`));
console.log("图片上传:", JSON.stringify(imgOk).slice(0, 200));
check("图片上传返回 Markdown", imgOk.ok === true, JSON.stringify(imgOk).slice(0, 200));

/* ========== 7. 零外部网络请求（离线可用） ========== */
check("Vditor 资源全部本地（编辑器可完全离线）", external.length === 0, JSON.stringify(external.slice(0, 5)));

/* ========== 清理 ========== */
const cleaned = await evaluate(`(async () => {
  const base = new Set(${JSON.stringify(baseIds)});
  const l = await (await fetch('/api/papers/${paper.id}/notes')).json();
  let n = 0;
  for (const note of l) {
    if (base.has(note.id)) continue;
    await fetch('/api/papers/${paper.id}/notes/' + note.id, { method: 'DELETE' });
    n++;
  }
  return n;
})()`);
console.log(`\n清理新增笔记 ${cleaned} 条`);

console.log("\nconsole 错误:", logs.length ? logs.join(" | ") : "无");
console.log(fails === 0 ? "全部通过" : `${fails} 项失败`);
ws.close(); chrome.kill();
process.exit(fails ? 1 : 0);
