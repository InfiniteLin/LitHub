/* 桌面模式模拟验证：注入 window.lithub.isDesktop 后检查品牌/窗口控件与标签栏共行
   用法：node tests/verify-titlebar-desktop.mjs [port]
*/
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { findBrowser } from "./_browser.mjs";

const [, , port = "8130"] = process.argv;
const CHROME = findBrowser();
const PORT = 9750 + Math.floor(Math.random() * 40);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-sandbox",
  `--remote-debugging-port=${PORT}`, "--window-size=1400,900", "about:blank"], { stdio: "ignore" });

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

await send("Runtime.enable");
await send("Page.enable");
await send("Network.enable");

/* 在页面加载前注入 Electron preload 等价物，模拟桌面壳 */
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `
    window.lithub = {
      isDesktop: true,
      minimize(){}, maximizeToggle(){}, close(){},
      onMaximizeChange(cb){ window.__maxCb = cb; },
    };
  `,
});
await send("Emulation.setDeviceMetricsOverride", { width: 1400, height: 900, deviceScaleFactor: 2, mobile: false });
await send("Page.navigate", { url: `http://127.0.0.1:${port}/#/library` });
await sleep(6000);

let fails = 0;
const check = (n, c, d = "") => { if (c) console.log(`  PASS ${n}`); else { fails++; console.log(`  FAIL ${n} ${d}`); } };

const geo = JSON.parse(await evaluate(`JSON.stringify((() => {
  const bar = document.getElementById('titlebar').getBoundingClientRect();
  const brand = document.querySelector('.tb-brand').getBoundingClientRect();
  const strip = document.getElementById('tab-strip').getBoundingClientRect();
  const ctrl = document.querySelector('.tb-controls').getBoundingClientRect();
  const drag = document.querySelector('.tb-drag').getBoundingClientRect();
  return {
    desktop: document.body.classList.contains('desktop'),
    bar: { h: Math.round(bar.height), w: Math.round(bar.width) },
    brand: { left: Math.round(brand.left), w: Math.round(brand.width), visible: brand.width > 0 },
    strip: { left: Math.round(strip.left), w: Math.round(strip.width) },
    drag: { left: Math.round(drag.left), w: Math.round(drag.width) },
    ctrl: { left: Math.round(ctrl.left), w: Math.round(ctrl.width), visible: ctrl.width > 0 },
    // 顺序：品牌 → 标签栏 → 拖拽区 → 控件
    ordered: brand.right <= strip.left + 1 && strip.right <= drag.left + 1 && drag.right <= ctrl.left + 1,
    noOverlap: brand.right <= strip.left + 1 || strip.width === 0,
    maxBtn: !!document.getElementById('tb-max'),
    closeBtn: !!document.getElementById('tb-close'),
  };
})())`));
console.log("桌面模式布局:", JSON.stringify(geo, null, 2));
check("已进入桌面模式", geo.desktop);
check("品牌区可见", geo.brand.visible);
check("窗口控件可见", geo.ctrl.visible);
check("元素顺序 品牌→标签栏→拖拽→控件", geo.ordered);
check("标签栏不遮挡品牌/控件", geo.noOverlap);
check("有最大化与关闭按钮", geo.maxBtn && geo.closeBtn);

/* 最大化状态切换 */
await evaluate(`window.__maxCb?.(true)`);
await sleep(200);
const maxState = JSON.parse(await evaluate(`JSON.stringify({
  maximized: document.getElementById('titlebar').classList.contains('maximized'),
  maxBtnVisible: getComputedStyle(document.getElementById('tb-max')).display !== 'none',
  restoreVisible: getComputedStyle(document.getElementById('tb-restore')).display !== 'none',
})`));
check("最大化时切换为还原按钮", maxState.maximized && maxState.restoreVisible && !maxState.maxBtnVisible, JSON.stringify(maxState));

mkdirSync("tests/.shots", { recursive: true });
let s = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("tests/.shots/tabstrip-desktop.png", Buffer.from(s.result.data, "base64"));

/* 阅读器视图：AI 面板不应被标签栏遮挡 */
await evaluate(`document.querySelector('.row')?.click()`);
await sleep(3500);
await evaluate(`document.querySelector('[data-action="ai-panel"]')?.click()`);
await sleep(2500);
const panel = JSON.parse(await evaluate(`JSON.stringify((() => {
  const p = document.getElementById('ai-panel');
  if (!p) return { none: true };
  const r = p.getBoundingClientRect();
  const bar = document.getElementById('titlebar').getBoundingClientRect();
  return { top: Math.round(r.top), barBottom: Math.round(bar.bottom), ok: r.top >= bar.bottom - 1 };
})())`));
console.log("AI 面板:", JSON.stringify(panel));
check("AI 面板不被标题栏遮挡", panel.ok === true, JSON.stringify(panel));
s = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("tests/.shots/tabstrip-desktop-reader.png", Buffer.from(s.result.data, "base64"));

console.log("\nconsole 错误:", logs.length ? logs.join(" | ") : "无");
console.log(fails === 0 ? "全部通过" : `${fails} 项失败`);
ws.close(); chrome.kill();
process.exit(fails ? 1 : 0);
