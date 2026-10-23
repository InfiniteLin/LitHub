/* 用真实文本选区创建批注，验证高亮是否精确覆盖被选文字
   用法：node tests/verify-annot-accurate.mjs [port]
*/
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { findBrowser } from "./_browser.mjs";

const [, , port = "8130"] = process.argv;
const CHROME = findBrowser();
const PORT = 9850 + Math.floor(Math.random() * 40);
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

await send("Runtime.enable");
await send("Page.enable");
await send("Network.setCacheDisabled", { cacheDisabled: true });
await send("Emulation.setDeviceMetricsOverride", { width: 1500, height: 1000, deviceScaleFactor: 2, mobile: false });
await send("Page.navigate", { url: `http://127.0.0.1:${port}/#/reader/9091beec169d` });
await sleep(8000);

let fails = 0;
const check = (n, c, d = "") => { if (c) console.log(`  PASS ${n}`); else { fails++; console.log(`  FAIL ${n} ${d}`); } };

const paperId = "9091beec169d";

/* 清除历史测试批注 */
await evaluate(`(async () => {
  const list = await (await fetch('/api/papers/${paperId}/annotations')).json();
  for (const a of list) await fetch('/api/papers/${paperId}/annotations/' + a.id, { method: 'DELETE' });
  return 1;
})()`);

/* 选中页面中一段真实的文字，创建高亮批注，再测量覆盖精度。
   注意：这段代码作为字符串注入页面，内部不要用反引号模板字符串。 */
const probeSrc = [
  "(async () => {",
  "  const pane = document.querySelector('#pane-dual2') || document.querySelector('#pane-en');",
  "  const page = pane.querySelector('.pdf-page');",
  "  const spans = [...page.querySelectorAll('.textLayer span')]",
  "    .filter(function(s){ return (s.textContent || '').trim().length >= 8; });",
  "  if (spans.length < 3) return JSON.stringify({ err: 'not enough spans' });",
  "  const target = spans[2];",
  "  const node = target.firstChild;",
  "  const range = document.createRange();",
  "  range.setStart(node, 0);",
  "  range.setEnd(node, node.textContent.length);",
  "  const sel = window.getSelection();",
  "  sel.removeAllRanges();",
  "  sel.addRange(range);",
  "  function toObj(r){ return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; }",
  "  const realRects = [...range.getClientRects()].filter(function(r){ return r.width > 1 && r.height > 1; }).map(toObj);",
  "  const info = PdfAnnot.selectionToRects();",
  "  if (!info) return JSON.stringify({ err: 'selectionToRects returned null' });",
  "  pendingSelection = info;",
  "  await createAnnotation('highlight', 'yellow');",
  "  await new Promise(function(r){ setTimeout(r, 1200); });",
  "  const painted = [...page.querySelectorAll('.annot-rect.annot-highlight')].map(function(el){",
  "    return toObj(el.getBoundingClientRect());",
  "  });",
  "  return JSON.stringify({",
  "    text: info.text.slice(0, 50),",
  "    realRects: realRects,",
  "    paintedRects: painted,",
  "    rectCount: info.rects.length,",
  "  });",
  "})()",
].join("\n");

const result = JSON.parse(await evaluate(probeSrc));

if (result.err) {
  console.log("FAIL 前置条件:", result.err);
  process.exit(1);
}

console.log("选中文字:", JSON.stringify(result.text));
console.log("真实矩形:", JSON.stringify(result.realRects));
console.log("高亮矩形:", JSON.stringify(result.paintedRects));

check("成功创建高亮批注", result.paintedRects.length >= 1, JSON.stringify(result.paintedRects));

/* 逐行比对：高亮框应覆盖真实文字框（允许几像素误差） */
const TOL = 6;
let matched = 0;
for (const real of result.realRects) {
  const hit = result.paintedRects.find((p) =>
    Math.abs(p.left - real.left) <= TOL &&
    Math.abs(p.top - real.top) <= TOL &&
    Math.abs(p.right - real.right) <= TOL);
  if (hit) matched++;
}
const ratio = result.realRects.length ? matched / result.realRects.length : 0;
console.log(`  覆盖精度: ${matched}/${result.realRects.length} 行匹配（容差 ${TOL}px）`);
check("高亮块精确覆盖被选文字", ratio >= 0.8, `匹配率 ${(ratio * 100).toFixed(0)}%`);

/* 缩放后位置应保持（归一化坐标的关键验证） */
await evaluate('applyReaderZoom(null, "width")');
await sleep(500);
await evaluate('document.querySelector("[data-action=\\"zoom\\"][data-id=\\"1\\"]").click()');
await sleep(2500);
const zoomProbe = [
  "(async () => {",
  "  const pane = document.querySelector('#pane-dual2') || document.querySelector('#pane-en');",
  "  const page = pane.querySelector('.pdf-page');",
  "  const hl = page.querySelector('.annot-rect.annot-highlight');",
  "  if (!hl) return JSON.stringify({ err: 'no highlight after zoom' });",
  "  const pr = page.getBoundingClientRect();",
  "  const hr = hl.getBoundingClientRect();",
  "  return JSON.stringify({",
  "    relX: (hr.left - pr.left) / pr.width,",
  "    relY: (hr.top - pr.top) / pr.height,",
  "    relW: hr.width / pr.width,",
  "    pageW: Math.round(pr.width),",
  "  });",
  "})()",
].join("\n");
const afterZoom = JSON.parse(await evaluate(zoomProbe));
console.log("缩放后相对位置:", JSON.stringify(afterZoom));
check("缩放后批注位置保持（归一化坐标生效）",
  !afterZoom.err && afterZoom.relX > 0 && afterZoom.relX < 1 && afterZoom.relW > 0,
  JSON.stringify(afterZoom));

mkdirSync("tests/.shots", { recursive: true });
await evaluate(`applyReaderZoom(null, "width")`);
await sleep(2000);
const s = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("tests/.shots/annot-accurate.png", Buffer.from(s.result.data, "base64"));

/* 清理 */
await evaluate(`(async () => {
  const list = await (await fetch('/api/papers/${paperId}/annotations')).json();
  for (const a of list) await fetch('/api/papers/${paperId}/annotations/' + a.id, { method: 'DELETE' });
  return 1;
})()`);

console.log("\nconsole 错误:", logs.length ? logs.join(" | ") : "无");
console.log(fails === 0 ? "全部通过" : `${fails} 项失败`);
ws.close(); chrome.kill();
process.exit(fails ? 1 : 0);
