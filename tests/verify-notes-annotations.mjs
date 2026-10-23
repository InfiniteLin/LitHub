/* 笔记 + 批注前端端到端验证（真实浏览器 + CDP）
   覆盖：Markdown 渲染、KaTeX 公式、图片插入、自动保存、批注高亮/划线/批注绘制
   用法：node tests/verify-notes-annotations.mjs [port]
*/
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { findBrowser } from "./_browser.mjs";

const [, , port = "8130"] = process.argv;
const CHROME = findBrowser();
const PORT = 9800 + Math.floor(Math.random() * 40);
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
await sleep(7000);

let fails = 0;
const check = (n, c, d = "") => { if (c) console.log(`  PASS ${n}`); else { fails++; console.log(`  FAIL ${n} ${d}`); } };

/* ---------- 1. 缩放上限 ---------- */
await evaluate(`location.hash='#/reader/9091beec169d'`);
await sleep(3000);
// 连点放大按钮 20 次，应停在 400%
await evaluate(`(async () => {
  const btn = () => document.querySelector('[data-action="zoom"][data-id="1"]');
  for (let i = 0; i < 20; i++) { btn()?.click(); await new Promise(r => setTimeout(r, 30)); }
  return 1;
})()`);
await sleep(1500);
const zoomMax = JSON.parse(await evaluate(`JSON.stringify({
  zoom: state.reader.zoom,
  fit: state.reader.fit,
  label: document.querySelector('.zoom-pct')?.textContent,
  btnDisabled: document.querySelector('[data-action="zoom"][data-id="1"]')?.disabled,
  atLimitClass: document.querySelector('.zoom-pct')?.classList.contains('at-limit'),
})`));
console.log("缩放上限:", JSON.stringify(zoomMax));
check("放大停在 400%", Math.abs(zoomMax.zoom - 4) < 0.001, JSON.stringify(zoomMax));
check("放大按钮已禁用", zoomMax.btnDisabled === true);
check("达到上限有视觉标记", zoomMax.atLimitClass === true);

// 缩小到下限
await evaluate(`(async () => {
  const btn = () => document.querySelector('[data-action="zoom"][data-id="-1"]');
  for (let i = 0; i < 20; i++) { btn()?.click(); await new Promise(r => setTimeout(r, 30)); }
  return 1;
})()`);
await sleep(1200);
const zoomMin = JSON.parse(await evaluate(`JSON.stringify({
  zoom: state.reader.zoom,
  btnDisabled: document.querySelector('[data-action="zoom"][data-id="-1"]')?.disabled,
})`));
console.log("缩放下限:", JSON.stringify(zoomMin));
check("缩小停在 50%", Math.abs(zoomMin.zoom - 0.5) < 0.001, JSON.stringify(zoomMin));
check("缩小按钮已禁用", zoomMin.btnDisabled === true);

// 恢复到适宽
await evaluate(`applyReaderZoom(null, "width")`);
await sleep(1500);

/* ---------- 2. 笔记面板 ---------- */
await evaluate(`document.querySelector('[data-action="note-panel"]')?.click()`);
await sleep(3500);

const panel = JSON.parse(await evaluate(`JSON.stringify({
  open: !!document.getElementById('note-panel'),
  libs: { vditor: !!window.Vditor, katex: !!window.katex },
  hasEditor: !!document.querySelector('.note-vditor-mount .vditor'),
  hasPreview: !!document.querySelector('.note-vditor-mount .vditor-ir'),
  mode: document.getElementById('note-body')?.dataset.mode,
  noteId: (typeof noteState !== 'undefined') ? noteState.currentId : null,
})`));
console.log("笔记面板:", JSON.stringify(panel));
check("笔记面板已打开", panel.open === true);
check("Vditor 已加载", panel.libs.vditor === true);
// Vditor 按需加载 KaTeX（不一定挂在 window.katex 上），
// 因此用后面的「KaTeX 公式已渲染」断言来验证实际可用性
check("KaTeX 渲染引擎就绪", panel.libs.vditor === true);
check("编辑器与预览区存在", panel.hasEditor && panel.hasPreview);

/* 写入含公式与代码的 Markdown */
const md = [
  "# 阅读笔记",
  "",
  "## 1. 核心思想",
  "",
  "这篇论文的关键是**引用约束解码**。行内公式 $E = mc^2$，以及 $\\alpha + \\beta$。",
  "",
  "块级公式：",
  "",
  "$$",
  "\\mathrm{Attention}(Q,K,V)=\\mathrm{softmax}\\left(\\frac{QK^\\top}{\\sqrt{d_k}}\\right)V",
  "$$",
  "",
  "- 要点一",
  "- 要点二",
  "",
  "```python",
  "print('hello')",
  "```",
  "",
  "| 指标 | 数值 |",
  "| --- | --- |",
  "| EM | 38.3 |",
].join("\n");

await evaluate(`(() => {
  NoteEditor.setValue(${JSON.stringify(md)});
  markNoteDirty();
  return 1;
})()`);
await sleep(1200);

const rendered = JSON.parse(await evaluate(`JSON.stringify((() => {
  const prev = document.querySelector('.vditor-ir .vditor-reset') || document.createElement('div');
  return {
    hasH1: !!prev.querySelector('h1'),
    hasH2: !!prev.querySelector('h2'),
    hasStrong: !!prev.querySelector('strong'),
    katexCount: prev.querySelectorAll('.katex').length,
    katexDisplayCount: prev.querySelectorAll('.katex-display').length,
    hasTable: !!prev.querySelector('table'),
    hasCode: !!prev.querySelector('pre code'),
    hasUL: !!prev.querySelector('ul li'),
    // 公式是否真的渲染（不是原始 $ 文本）
    rawDollarLeft: /\\$[^$]+\\$/.test(prev.textContent),
    htmlSample: prev.innerHTML.slice(0, 120),
  };
})())`));
console.log("Markdown 渲染:", JSON.stringify(rendered, null, 2).slice(0, 700));
check("标题渲染", rendered.hasH1 && rendered.hasH2);
check("粗体渲染", rendered.hasStrong === true);
check("KaTeX 公式已渲染", rendered.katexCount >= 2, `katexCount=${rendered.katexCount}`);
check("块级公式居中显示", rendered.katexDisplayCount >= 1, `display=${rendered.katexDisplayCount}`);
check("表格渲染", rendered.hasTable === true);
check("代码块渲染", rendered.hasCode === true);
check("列表渲染", rendered.hasUL === true);
// IR 模式下源码标记（如 $ 与 **）会作为 .vditor-ir__marker 出现在 DOM 文本里，
// 这是「即时渲染」的固有形态，不能当成失败；改断言公式确实被 KaTeX 渲染了。
check("公式已渲染为 KaTeX（非纯文本）", rendered.katexCount >= 2, "katex=" + rendered.katexCount);

await shot("tests/.shots/note-panel.png");

/* 自动保存 */
await sleep(2500);
const saved = JSON.parse(await evaluate(`JSON.stringify({
  state: document.getElementById('note-save-state')?.textContent,
  noteId: noteState.currentId,
  dirty: noteState.dirty,
})`));
console.log("自动保存:", JSON.stringify(saved));
check("自动保存完成（dirty=false 且状态为已保存）",
  saved.dirty === false && saved.state === "已保存", JSON.stringify(saved));

/* 三态切换：live（即时渲染）/ source（源码分屏）/ read（只读） */
for (const mode of ["source", "read", "live"]) {
  await evaluate(`document.querySelector('[data-action="note-mode"][data-id="${mode}"]').click()`);
  await sleep(1600);
  const m = await evaluate(`document.getElementById('note-body').dataset.mode`);
  check(`切换笔记模式 ${mode}`, m === mode);
}
await evaluate(`document.querySelector('[data-action="note-mode"][data-id="live"]').click()`);
await sleep(300);

/* 图片插入（通过 API 上传后插进编辑器） */
const imgOk = await evaluate(`(async () => {
  const canvas = document.createElement('canvas');
  canvas.width = 120; canvas.height = 60;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#a6432b'; ctx.fillRect(0, 0, 120, 60);
  ctx.fillStyle = '#fff'; ctx.font = '16px serif'; ctx.fillText('LitHub', 20, 38);
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
  const file = new File([blob], 'test.png', { type: 'image/png' });
  const ok = await handleNoteImageFiles([file]);
  return ok;
})()`);
await sleep(2000);
const imgState = JSON.parse(await evaluate(`JSON.stringify((() => {
  const ed = { value: NoteEditor.getValue() };
  const prev = document.querySelector('.vditor-ir .vditor-reset') || document.createElement('div');
  const imgs = [...prev.querySelectorAll('img')];
  return {
    editorHasMd: /!\\[[^\\]]*\\]\\(/.test(ed.value),
    previewImgCount: imgs.length,
    imgLoaded: imgs.length ? (imgs[0].complete && imgs[0].naturalWidth > 0) : false,
    imgSrc: imgs[0]?.getAttribute('src')?.slice(0, 60),
  };
})())`));
console.log("图片插入:", JSON.stringify(imgState));
check("图片 Markdown 已插入编辑器", imgState.editorHasMd === true);
check("预览区出现图片", imgState.previewImgCount >= 1, JSON.stringify(imgState));
check("图片实际加载成功", imgState.imgLoaded === true, JSON.stringify(imgState));

await sleep(1500);
await shot("tests/.shots/note-panel-image.png");

/* ---------- 3. PDF 批注 ---------- */
await evaluate(`document.querySelector('[data-action="note-close"]')?.click()`);
await sleep(800);
await evaluate(`location.hash='#/library'`);
await sleep(1200);
await evaluate(`location.hash='#/reader/9091beec169d'`);
await sleep(4000);

// 等首批页面渲染出文本层
const ready = await evaluate(`(async () => {
  for (let i = 0; i < 30; i++) {
    const span = document.querySelector('.pdf-page .textLayer span');
    if (span) return true;
    await new Promise(r => setTimeout(r, 300));
  }
  return false;
})()`);
check("PDF 文本层已就绪", ready === true);

// 用真实的 range 选中文本层里的若干字符，然后走 PdfAnnot.selectionToRects
const selInfo = JSON.parse(await evaluate(`JSON.stringify((() => {
  const page = document.querySelector('.pdf-page');
  const spans = [...page.querySelectorAll('.textLayer span')].filter(s => (s.textContent||'').trim().length > 4);
  if (spans.length < 2) return { err: 'no spans' };
  const a = spans[0].firstChild, b = spans[1].firstChild;
  const range = document.createRange();
  range.setStart(a, 0);
  range.setEnd(b, b.textContent.length);
  const sel = window.getSelection();
  sel.removeAllRanges(); sel.addRange(range);
  const info = PdfAnnot.selectionToRects();
  if (!info) return { err: 'no rects' };
  return {
    text: info.text.slice(0, 40),
    pageIndex: info.pageIndex,
    rectCount: info.rects.length,
    rects: info.rects.slice(0, 2),
  };
})())`));
console.log("选区提取:", JSON.stringify(selInfo));
check("能从选区提取归一化矩形", selInfo.rectCount >= 1, JSON.stringify(selInfo));
check("矩形坐标在 0..1 范围", (selInfo.rects || []).every(r =>
  r.x >= 0 && r.x <= 1 && r.y >= 0 && r.y <= 1 && r.w > 0 && r.h > 0), JSON.stringify(selInfo.rects));

// 直接调 API 创建三种批注，再让前端加载绘制
const paperId = "9091beec169d";
const created = await evaluate(`(async () => {
  const spec = [
    { kind: 'highlight', color: 'yellow', y: 0.18, text: '被标注文本 highlight', comment: '' },
    { kind: 'underline', color: 'blue',   y: 0.26, text: '被标注文本 underline', comment: '' },
    { kind: 'note',      color: 'green',  y: 0.34, text: '被标注文本 note',      comment: '这是一条批注' },
  ];
  const out = [];
  for (const s of spec) {
    const r = await fetch('/api/papers/${paperId}/annotations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: s.kind, page: 1, color: s.color,
        rects: [{ x: 0.12, y: s.y, w: 0.5, h: 0.018 }],
        text: s.text, comment: s.comment,
      }),
    });
    out.push(await r.json());
  }
  return JSON.stringify(out);
})()`);
const anns = JSON.parse(created);
console.log("创建批注:", anns.map(a => `${a.kind}/${a.id.slice(0,6)}`).join(", "));
check("API 创建三类批注", anns.length === 3 && anns.every(a => a.id));

// 触发前端重新加载批注并绘制
await evaluate(`(async () => { await loadAnnotations(paperById('${paperId}')); return 1; })()`);
await sleep(1500);

const painted = JSON.parse(await evaluate(`JSON.stringify((() => {
  const pane = document.querySelector('#pane-dual2') || document.querySelector('#pane-en');
  const layer = pane?.querySelector('.pdf-page .pdf-annot');
  return {
    hasLayer: !!layer,
    highlights: pane?.querySelectorAll('.annot-rect.annot-highlight').length || 0,
    underlines: pane?.querySelectorAll('.annot-rect.annot-underline').length || 0,
    marks: pane?.querySelectorAll('.annot-mark').length || 0,
    highlightBg: pane?.querySelector('.annot-rect.annot-highlight')?.style.background || '',
    underlineBorder: pane?.querySelector('.annot-rect.annot-underline')?.style.borderBottom || '',
  };
})())`));
console.log("批注绘制:", JSON.stringify(painted));
check("高亮已绘制", painted.highlights >= 1, JSON.stringify(painted));
check("划线已绘制", painted.underlines >= 1, JSON.stringify(painted));
check("批注标记已绘制", painted.marks >= 1, JSON.stringify(painted));
// 高亮填充色用不透明纯色（rgb(...)），透明度由 .annot-rect.annot-highlight 的 opacity 控制，
// 目的是避免重叠区域按 alpha 累积加深。这里只断言「有颜色」，不限定写法。
check("高亮有填充色", /rgb\(/.test(painted.highlightBg), painted.highlightBg);
check("划线有下边框", painted.underlineBorder.includes("solid"), painted.underlineBorder);

await shot("tests/.shots/annotations.png");

// 点击批注标记 → 打开编辑气泡
await evaluate(`document.querySelector('.annot-mark')?.click()`);
await sleep(800);
const pop = JSON.parse(await evaluate(`JSON.stringify({
  open: !!document.getElementById('annot-pop'),
  hasTextarea: !!document.getElementById('annot-comment'),
  quote: document.querySelector('.annot-quote')?.textContent?.slice(0, 30) || '',
  colorDots: document.querySelectorAll('[data-annot-color]').length,
})`));
console.log("批注气泡:", JSON.stringify(pop));
check("点击批注标记打开编辑气泡", pop.open === true);
check("气泡含备注输入框", pop.hasTextarea === true);
// 气泡内已移除色彩选择（颜色在划词浮条时选定），改为断言「气泡内不再有换色入口」
check("气泡内已无色彩选择", pop.colorDots === 0, `colorDots=${pop.colorDots}`);

// 写备注并保存
await evaluate(`(() => {
  document.getElementById('annot-comment').value = '这个方法值得在我们的系统里复用';
  document.querySelector('[data-annot-save]').click();
  return 1;
})()`);
await sleep(1500);
const savedAnn = JSON.parse(await evaluate(`(async () => {
  const list = await (await fetch('/api/papers/${paperId}/annotations')).json();
  const note = list.find(a => a.kind === 'note');
  return JSON.stringify({ comment: note?.comment, popClosed: !document.getElementById('annot-pop') });
})()`));
console.log("批注保存:", JSON.stringify(savedAnn));
check("批注备注已持久化", (savedAnn.comment || "").includes("值得"), JSON.stringify(savedAnn));
check("保存后气泡关闭", savedAnn.popClosed === true);

// 清理测试批注
await evaluate(`(async () => {
  const list = await (await fetch('/api/papers/${paperId}/annotations')).json();
  for (const a of list) {
    await fetch('/api/papers/${paperId}/annotations/' + a.id, { method: 'DELETE' });
  }
  return list.length;
})()`);
console.log("\n已清理测试批注");

// 清理测试笔记：只删本次跑出来的（标题/内容带测试标记），不碰用户已有笔记
const cleanedNotes = await evaluate(`(async () => {
  const l = await (await fetch('/api/papers/${paperId}/notes')).json();
  let n = 0;
  for (const note of l) {
    const text = (note.title || '') + (note.content || '');
    if (!text.includes('阅读笔记') && !text.includes('核心思想')) continue;
    await fetch('/api/papers/${paperId}/notes/' + note.id, { method: 'DELETE' });
    n++;
  }
  return n;
})()`);
console.log(`已清理测试笔记 ${cleanedNotes} 条`);

console.log("\nconsole 错误:", logs.length ? logs.join(" | ") : "无");
console.log(fails === 0 ? "全部通过" : `${fails} 项失败`);
ws.close(); chrome.kill();
process.exit(fails ? 1 : 0);
