/* 阅读器模式 + 缩放验证：切换模式与缩放档位，量测渲染指标并截图
   用法：node tests/verify-render.mjs <paperId> <mode> <output.png> [zoom] [port]
     mode : en | zh | dual2
     zoom : width | page | 0.5 | 1 | 2 | 4
     port : sidecar 端口（默认 8130）
*/
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { findBrowser } from "./_browser.mjs";

const [, , paperId = "9091beec169d", mode = "dual2", out = "tests/.shots/verify.png", zoomVal = "width", port = "8130"] = process.argv;
const CHROME = findBrowser();
const PORT = 9334 + Math.floor(Math.random() * 50);
const url = `http://127.0.0.1:${port}/#/reader/${paperId}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-sandbox",
  `--remote-debugging-port=${PORT}`, "--window-size=1400,1000", url], { stdio: "ignore" });

async function wsUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const p = tabs.find((t) => t.type === "page" && t.url.includes(`:${port}/`));
      if (p?.webSocketDebuggerUrl) return p.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error("找不到调试目标");
}

const ws = new WebSocket(await wsUrl());
let id = 0;
const pending = new Map();
const logs = [];
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
  const mid = ++id;
  pending.set(mid, res);
  ws.send(JSON.stringify({ id: mid, method, params }));
});
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description);
  return JSON.parse(r.result.result.value);
};

await send("Runtime.enable");
await send("Page.enable");
await send("Network.enable");
await send("Network.setCacheDisabled", { cacheDisabled: true });
await send("Emulation.setDeviceMetricsOverride", { width: 1400, height: 1000, deviceScaleFactor: 2, mobile: false });
await send("Page.reload", { ignoreCache: true });
await sleep(8000);

// 用 hash 直接导航到阅读器（首屏可能停留在文献库）
await evaluate(`(() => { location.hash = '#/reader/${paperId}'; return '1'; })()`);
await sleep(6000);

if (mode !== "dual2") {
  await evaluate(`(() => {
    const btn = [...document.querySelectorAll('[data-action="mode"]')].find(b => b.dataset.id === '${mode}');
    btn?.click();
    return '1';
  })()`);
  await sleep(3500);
}

await evaluate(`(() => {
  const sel = document.querySelector("#zoom-sel");
  if (!sel) return '0';
  sel.value = ${JSON.stringify(String(zoomVal))};
  sel.dispatchEvent(new Event("change", { bubbles: true }));
  return '1';
})()`);
await sleep(4000);

const info = await evaluate(`JSON.stringify((() => {
  const pane = ["#pane-en","#pane-zh","#pane-dual2"].map(s => document.querySelector(s)).find(p => p && p._pdf);
  if (!pane) return { error: "no pane mounted" };
  const cvs = pane.querySelector("canvas");
  const page = pane.querySelector(".pdf-page");
  const pr = page.getBoundingClientRect();
  const side = pane._pdf.metas[0].sides[0];
  const tl = page.querySelector(".textLayer");
  const spans = [...tl.querySelectorAll("span")];
  const overflow = spans.filter(s => s.getBoundingClientRect().right > pr.right + 4).length;
  return {
    pane: pane.id, mode: document.querySelector(".seg-modes .active")?.dataset.id,
    fit: pane._pdf.fit, zoom: pane._pdf.zoom,
    pageWpt: pane._pdf.pageW, pageRatio: +(pane._pdf.pageRatio || 0).toFixed(3),
    pageCssW: Math.round(pr.width), pageCssH: Math.round(pr.height),
    canvasBitmap: cvs.width + "x" + cvs.height,
    canvasCss: cvs.style.width + " x " + cvs.style.height,
    paintedK: +(side.paintedK || 0).toFixed(3),
    bitmapPerPt: +((cvs.width) / (pane._pdf.pageW || 612)).toFixed(3),
    textLayerSpans: spans.length,
    overflowSpans: overflow,
    zoomLabel: document.querySelector(".zoom-pct")?.textContent,
  };
})())`);

console.log(JSON.stringify(info, null, 2));

mkdirSync("tests/.shots", { recursive: true });
const shot = await send("Page.captureScreenshot", { format: "png" });
writeFileSync(out, Buffer.from(shot.result.data, "base64"));
console.log(`截图: ${out}`);
console.log("console 错误:", logs.length ? logs.join(" | ") : "无");

ws.close();
chrome.kill();
process.exit(0);
