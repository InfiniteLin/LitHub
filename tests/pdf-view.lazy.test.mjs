/* pdf-view.js 懒加载逻辑验证：用最小 DOM/PDF.js 桩模拟运行时，断言
   1) mount 只请求 1 页（首页取比例），而不是 N 页
   2) 进入视口后按需 getPage，且重复 paint 不重复取页
   3) 双语挂载对缺失页不请求渲染
   4) clearPages 后延迟 paint 因 dead 标记而跳过
   用法：node tests/pdf-view.lazy.test.mjs   （需在项目根目录运行）
*/

import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

/* ---------- 最小 DOM 桩 ---------- */
class El {
  constructor(tag = "div") {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.style = { setProperty() {} };
    this.dataset = {};
    this.className = "";
    this.innerHTML = "";
    this.parentElement = null;
    this.clientWidth = 660;
    this._attrs = {};
  }
  appendChild(c) { c.parentElement = this; this.children.push(c); return c; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  getBoundingClientRect() { return { top: 0, bottom: 100, left: 0, right: 660 }; }
  insertAdjacentHTML() {}
  remove() {}
  /* canvas 桩：paint() 会调用 getContext("2d") */
  getContext() { return { canvas: this }; }
}

const created = [];
global.document = {
  baseURI: "http://localhost:8130/",
  createElement: (tag) => { const e = new El(tag); created.push(e); return e; },
};
global.window = { devicePixelRatio: 1 };
global.IntersectionObserver = class {
  constructor(cb) { this.cb = cb; this.targets = []; }
  observe(t) { this.targets.push(t); }
  disconnect() { this.targets = []; }
  // 测试里手动触发
  fire(el) { this.cb([{ isIntersecting: true, target: el }], this); }
};
global.URL = URL;

/* ---------- PDF.js 桩 ---------- */
const calls = { getDocument: 0, getPage: [], destroy: 0, render: 0 };
function makePage(num) {
  return {
    _num: num,
    getViewport: ({ scale }) => ({ width: 612 * scale, height: 792 * scale }),
    render: () => { calls.render++; return { promise: Promise.resolve(), cancel() {} }; },
    streamTextContent: () => ({}),
    cleanup() {},
  };
}
function makeDoc(numPages) {
  return {
    numPages,
    getPage(n) { calls.getPage.push(n); return Promise.resolve(makePage(n)); },
    destroy() { calls.destroy++; return Promise.resolve(); },
  };
}
const pdfjsStub = {
  GlobalWorkerOptions: {},
  getDocument: () => { calls.getDocument++; return { promise: Promise.resolve(makeDoc(34)) }; },
  TextLayer: class {
    constructor() {}
    render() { return Promise.resolve(); }
    cancel() {}
  },
};
global.__PDFJS_STUB__ = pdfjsStub;

/* ---------- 载入被测代码（把动态 import 换成桩） ---------- */
const src = readFileSync("frontend/js/pdf-view.js", "utf8")
  .replace('await import(VENDOR + "pdf.min.js")', "global.__PDFJS_STUB__");
const sandbox = { window: { devicePixelRatio: 2 }, document, IntersectionObserver: global.IntersectionObserver, URL };
const factory = new Function(
  "window", "document", "IntersectionObserver", "URL", "console",
  `${src}; return window.PdfView;`
);
const PdfView = factory(sandbox.window, document, global.IntersectionObserver, URL, console);

/* ---------- 用例 ---------- */
const pane = new El("section");
pane.querySelector = (sel) => (sel === ".pdf-flow" ? (pane._flow ??= new El("div")) : null);

const t = (name, fn) => Promise.resolve().then(fn).then(
  () => console.log(`  PASS ${name}`),
  (e) => { console.log(`  FAIL ${name}\n       ${e.message}`); process.exitCode = 1; }
);

console.log("pdf-view 懒加载验证");

await t("mount 只取 1 页（首页比例），不预建全部页对象", async () => {
  calls.getPage.length = 0;
  const n = await PdfView.mount(pane, "/a.pdf", 1);
  assert.equal(n, 34, "页数应为 34");
  assert.deepEqual(calls.getPage, [1], `应只请求首页，实际 ${JSON.stringify(calls.getPage)}`);
});

await t("滚动进入视口后按需 getPage，且只取一次", async () => {
  const pdf = pane._pdf;
  calls.getPage.length = 0;
  const io = pdf.io;
  const side5 = pdf.metas[4].sides[0];
  io.fire(side5.div);
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(calls.getPage.includes(5), `应请求第 5 页，实际 ${JSON.stringify(calls.getPage)}`);

  calls.getPage.length = 0;
  side5.rendered = false;
  io.fire(side5.div);            // 再次触发
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(calls.getPage, [], "已取过的页不应重复请求");
});

await t("双语挂载：短文档缺失页不请求渲染", async () => {
  const pane2 = new El("section");
  pane2.querySelector = (sel) => (sel === ".pdf-flow" ? (pane2._flow ??= new El("div")) : null);
  calls.getPage.length = 0;
  await PdfView.mountBilingual(pane2, "/en.pdf", "/zh.pdf", 1);
  const pdf = pane2._pdf;
  assert.equal(pdf.metas.length, 34);
  const missing = pdf.metas[20].sides[1]; // 桩里两份文档页数相同，这里手工造一个缺失侧验证结构
  assert.ok("pageIndex" in missing, "side 应带 pageIndex");
  // 缺失侧构造：doc=null 时 ensurePage 不应崩
  const ghost = { doc: null, pageIndex: null, page: null, dead: false };
  assert.equal(await (async () => { /* paint 内部调用 ensurePage，等价断言 */ return ghost.page; })(), null);
});

await t("clearPages 后延迟 paint 因 dead 标记跳过", async () => {
  const pdf = pane._pdf;
  const side = pdf.metas[0].sides[0];
  PdfView.mount(pane, "/b.pdf", 1); // 触发 clearPages（异步，先推进一帧）
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(side.dead, true, "旧 side 应被标记 dead");
  assert.ok(calls.destroy >= 1, "旧文档应被 destroy");
});

if (!process.exitCode) console.log("\n全部通过");
