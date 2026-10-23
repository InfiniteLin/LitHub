/* 文献库列表 UI 验证：截图 + 量测附件树（展开前后）
   用法：node tests/verify-library.mjs [paperId] [output.png] [port]
*/
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { findBrowser } from "./_browser.mjs";

const [, , paperId = "9091beec169d", out = "tests/.shots/library.png", port = "8130"] = process.argv;
const CHROME = findBrowser();
const PORT = 9400 + Math.floor(Math.random() * 50);
const url = `http://127.0.0.1:${port}/#/library`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-sandbox",
  `--remote-debugging-port=${PORT}`, "--window-size=1500,1000", url], { stdio: "ignore" });

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
await send("Emulation.setDeviceMetricsOverride", { width: 1500, height: 1000, deviceScaleFactor: 2, mobile: false });
await send("Page.reload", { ignoreCache: true });
await sleep(5000);
await evaluate(`(() => { location.hash = '#/library'; return '1'; })()`);
await sleep(2500);

const before = await evaluate(`JSON.stringify((() => {
  const rows = document.querySelectorAll(".row-wrap");
  const first = rows[0];
  return {
    rowCount: rows.length,
    live: window.LithubAPI?.live,
    firstTitle: first?.querySelector(".row-main h3")?.textContent.slice(0, 40),
    hasToggle: !!first?.querySelector(".row-toggle"),
    treeHidden: first?.querySelector(".att-tree")?.hidden,
    treeChildren: first?.querySelector(".att-tree")?.children.length ?? 0,
  };
})())`);
console.log("展开前:", JSON.stringify(before, null, 2));

// 展开第一篇
await evaluate(`(() => {
  const btn = document.querySelector('.row-toggle');
  btn?.click();
  return '1';
})()`);
await sleep(700);

const after = await evaluate(`JSON.stringify((() => {
  const wrap = document.querySelector(".row-wrap");
  const tree = wrap.querySelector(".att-tree");
  const items = [...tree.querySelectorAll(".att")].map(a => ({
    label: a.querySelector(".att-label")?.textContent.trim().slice(0, 30),
    kind: a.querySelector(".att-kind")?.textContent,
    action: a.dataset.action || null,
    ghost: a.classList.contains("att-ghost"),
    pending: a.classList.contains("att-pending"),
  }));
  return {
    expanded: wrap.classList.contains("open"),
    treeHidden: tree.hidden,
    ariaExpanded: wrap.querySelector(".row-toggle")?.getAttribute("aria-expanded"),
    itemCount: items.length,
    items,
    // 布局检查：附件树不应与条目重叠
    rowBottom: Math.round(wrap.querySelector(".row").getBoundingClientRect().bottom),
    treeTop: Math.round(tree.getBoundingClientRect().top),
    treeHeight: Math.round(tree.getBoundingClientRect().height),
  };
})())`);
console.log("展开后:", JSON.stringify(after, null, 2));

mkdirSync("tests/.shots", { recursive: true });
const shot = await send("Page.captureScreenshot", { format: "png" });
writeFileSync(out, Buffer.from(shot.result.data, "base64"));
console.log(`截图: ${out}`);
console.log("console 错误:", logs.length ? logs.join(" | ") : "无");

ws.close();
chrome.kill();
process.exit(0);
