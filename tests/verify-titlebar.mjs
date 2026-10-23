/* 顶部 chrome 验证：标签栏是否与标题栏同排、内容区是否未被遮挡
   用法：node tests/verify-titlebar.mjs [port]
*/
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { findBrowser } from "./_browser.mjs";

const [, , port = "8130"] = process.argv;
const CHROME = findBrowser();
const PORT = 9700 + Math.floor(Math.random() * 40);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-sandbox",
  `--remote-debugging-port=${PORT}`, "--window-size=1400,900",
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
await send("Network.setCacheDisabled", { cacheDisabled: true });
await send("Emulation.setDeviceMetricsOverride", { width: 1400, height: 900, deviceScaleFactor: 2, mobile: false });
await send("Page.reload", { ignoreCache: true });
// 等应用真正渲染出标签栏，而不是盲等固定时长（机器繁忙时会误报 tabCount=0）
for (let i = 0; i < 80; i++) {
  await sleep(250);
  try {
    const n = await evaluate(`document.querySelectorAll('#tab-strip .tab').length`);
    if (n > 0) break;
  } catch {}
}
await sleep(400);

let fails = 0;
const check = (n, c, d = "") => { if (c) console.log(`  PASS ${n}`); else { fails++; console.log(`  FAIL ${n} ${d}`); } };

/* 1. 标签栏在标题栏内 */
const geo = JSON.parse(await evaluate(`JSON.stringify((() => {
  const bar = document.getElementById('titlebar');
  const strip = document.getElementById('tab-strip');
  const br = bar.getBoundingClientRect(), sr = strip.getBoundingClientRect();
  return {
    barVisible: getComputedStyle(bar).display !== 'none',
    barRect: { top: Math.round(br.top), h: Math.round(br.height), w: Math.round(br.width) },
    stripRect: { top: Math.round(sr.top), h: Math.round(sr.height) },
    stripInsideBar: bar.contains(strip),
    sameRow: Math.abs(sr.top - br.top) < 6,
    tabCount: strip.querySelectorAll('.tab').length,
    activeTab: strip.querySelector('.tab.active')?.textContent.trim(),
    desktop: document.body.classList.contains('desktop'),
  };
})())`));
console.log("布局:", JSON.stringify(geo, null, 2));
check("标题栏可见", geo.barVisible);
check("标签栏位于标题栏内部", geo.stripInsideBar);
check("标签栏与品牌/控件同一行", geo.sameRow);
check("浏览器模式仍有页签", geo.tabCount >= 1, `tabCount=${geo.tabCount}`);
check("文献库为激活页签", geo.activeTab === "文献库", `实际 ${geo.activeTab}`);

/* 2. 内容区从标题栏下方开始，不被遮挡 */
const layout = JSON.parse(await evaluate(`JSON.stringify((() => {
  const bar = document.getElementById('titlebar').getBoundingClientRect();
  const app = document.getElementById('app').getBoundingClientRect();
  return {
    titlebarBottom: Math.round(bar.bottom),
    appTop: Math.round(app.top),
    appHeight: Math.round(app.height),
    viewport: window.innerHeight,
    overflow: document.documentElement.scrollHeight > window.innerHeight + 1,
  };
})())`));
console.log("内容区:", JSON.stringify(layout));
check("内容区紧接标题栏下方", Math.abs(layout.appTop - layout.titlebarBottom) <= 1);
check("整页不产生额外滚动", !layout.overflow);

/* 3. 打开文献 → 出现新页签 */
await evaluate(`document.querySelector('.row')?.click()`);
await sleep(3500);
const tabs2 = JSON.parse(await evaluate(`JSON.stringify((() => {
  const strip = document.getElementById('tab-strip');
  const tabs = [...strip.querySelectorAll('.tab')];
  const active = tabs.find(t => t.classList.contains('active'));
  const sr = strip.getBoundingClientRect();
  return {
    count: tabs.length,
    titles: tabs.map(t => t.querySelector('.tab-title')?.textContent.slice(0, 22)),
    activeIsDoc: active?.dataset.action === 'open',
    stripRight: Math.round(sr.right),
    viewportW: window.innerWidth,
  };
})())`));
console.log("打开文献后:", JSON.stringify(tabs2));
check("阅读文献后新增页签", tabs2.count === 2, `count=${tabs2.count}`);
check("新页签为激活态", tabs2.activeIsDoc === true);

/* 4. 关闭页签 */
await evaluate(`document.querySelector('.tab.active .tab-close')?.click()`);
await sleep(1500);
const afterClose = JSON.parse(await evaluate(`JSON.stringify({
  count: document.getElementById('tab-strip').querySelectorAll('.tab').length,
  hash: location.hash,
})`));
check("关闭文献页签后回到文献库页签", afterClose.count === 1, JSON.stringify(afterClose));

/* 5. 截图 */
mkdirSync("tests/.shots", { recursive: true });
await evaluate(`location.hash='#/library'`);
await sleep(1200);
await evaluate(`document.querySelector('.row')?.click()`);
await sleep(3500);
let s = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("tests/.shots/tabstrip-reader.png", Buffer.from(s.result.data, "base64"));
await evaluate(`location.hash='#/library'`);
await sleep(1200);
s = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("tests/.shots/tabstrip-library.png", Buffer.from(s.result.data, "base64"));
console.log("截图已保存");

console.log("\nconsole 错误:", logs.length ? logs.join(" | ") : "无");
console.log(fails === 0 ? "全部通过" : `${fails} 项失败`);
ws.close(); chrome.kill();
process.exit(fails ? 1 : 0);
