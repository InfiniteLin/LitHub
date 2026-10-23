/* 附件树主题与边界状态截图：浅色 / 深色 / 未翻译文献 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { findBrowser } from "./_browser.mjs";

const CHROME = findBrowser();
const PORT = 9600 + Math.floor(Math.random() * 40);
const port = process.argv[2] || "8130";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-sandbox",
  `--remote-debugging-port=${PORT}`, "--window-size=1500,1000",
  `http://127.0.0.1:${port}/#/library`], { stdio: "ignore" });

async function wsUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const p = tabs.find((t) => t.type === "page" && t.url.includes(`:${port}/`));
      if (p?.webSocketDebuggerUrl) return p.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error("no target");
}

const ws = new WebSocket(await wsUrl());
let id = 0; const pending = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
};
await new Promise((r) => (ws.onopen = r));
const send = (method, params = {}) => new Promise((res) => {
  const mid = ++id; pending.set(mid, res);
  ws.send(JSON.stringify({ id: mid, method, params }));
});
const evaluate = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  return r.result?.result?.value;
};
const shot = async (name) => {
  const r = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(name, Buffer.from(r.result.data, "base64"));
  console.log("截图:", name);
};

await send("Runtime.enable");
await send("Page.enable");
await send("Network.setCacheDisabled", { cacheDisabled: true });
await send("Emulation.setDeviceMetricsOverride", { width: 1500, height: 1000, deviceScaleFactor: 2, mobile: false });
await send("Page.reload", { ignoreCache: true });
await sleep(5500);
await evaluate(`location.hash='#/library'`);
await sleep(2000);
mkdirSync("tests/.shots", { recursive: true });

/* 1. 浅色：展开一篇已翻译 + 一篇未翻译 */
await evaluate(`(() => {
  const wraps = [...document.querySelectorAll('.row-wrap')];
  const tr = wraps.find(w => w.querySelector('.row-status .pill-ok'));
  const un = wraps.find(w => !w.querySelector('.row-status .pill-ok'));
  tr?.querySelector('.row-toggle').click();
  return '1';
})()`);
await sleep(600);
await shot("tests/.shots/att-light.png");

/* 2. 未翻译文献（应显示「译文尚未生成」+ 翻译按钮） */
const untranslated = JSON.parse(await evaluate(`JSON.stringify((() => {
  document.querySelectorAll('.row-wrap.open').forEach(w => w.querySelector('.row-toggle').click());
  const wraps = [...document.querySelectorAll('.row-wrap')];
  const un = wraps.find(w => !w.querySelector('.row-status .pill-ok'));
  if (!un) return { err: '没有未翻译文献' };
  un.querySelector('.row-toggle').click();
  return { title: un.querySelector('.row-main h3').textContent.slice(0, 30) };
})())`));
await sleep(600);
console.log("未翻译文献:", JSON.stringify(untranslated));
const pendingInfo = JSON.parse(await evaluate(`JSON.stringify((() => {
  const p = document.querySelector('.att-pending');
  return p ? {
    label: p.querySelector('.att-label')?.textContent.trim(),
    hasTranslateBtn: !!p.querySelector('[data-action="translate"]'),
  } : null;
})())`));
console.log("待翻译附件行:", JSON.stringify(pendingInfo));
await shot("tests/.shots/att-untranslated.png");

/* 3. 深色模式 */
await evaluate(`(() => {
  const btn = document.querySelector('[data-action="toggle-theme"]');
  btn?.click();
  return document.documentElement.dataset.theme;
})()`);
await sleep(800);
const theme = await evaluate(`document.documentElement.dataset.theme`);
console.log("主题:", theme);
await shot("tests/.shots/att-dark.png");

ws.close(); chrome.kill(); process.exit(0);
