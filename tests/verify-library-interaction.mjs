/* 附件树交互验证：展开/收起、点击附件跳转模式、点击条目本体不展开
   用法：node tests/verify-library-interaction.mjs [port]
*/
import { spawn } from "node:child_process";
import { findBrowser } from "./_browser.mjs";

const [, , port = "8130"] = process.argv;
const CHROME = findBrowser();
const PORT = 9450 + Math.floor(Math.random() * 40);
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
await send("Page.reload", { ignoreCache: true });
await sleep(5500);
await evaluate(`location.hash='#/library'`);
await sleep(2000);

let fails = 0;
const check = (name, cond, detail = "") => {
  if (cond) console.log(`  PASS ${name}`);
  else { fails++; console.log(`  FAIL ${name} ${detail}`); }
};

/* 1. 点击三角展开 */
await evaluate(`document.querySelector('.row-toggle').click()`);
await sleep(400);
check("点击三角可展开", await evaluate(`document.querySelector('.row-wrap').classList.contains('open')`));
check("展开后有附件条目", (await evaluate(`document.querySelectorAll('.row-wrap .att').length`)) === 4);
check("展开后 hash 仍停留在文献库", await evaluate(`location.hash`) === "#/library",
  `实际 ${await evaluate(`location.hash`)}`);

/* 2. 再次点击收起 */
await evaluate(`document.querySelector('.row-toggle').click()`);
await sleep(400);
check("再次点击可收起", !(await evaluate(`document.querySelector('.row-wrap').classList.contains('open')`)));
check("收起后附件树隐藏", await evaluate(`document.querySelector('.att-tree').hidden`));

/* 3. 点击条目本体 → 进入阅读器，且不应展开 */
await evaluate(`document.querySelector('.row').click()`);
await sleep(2500);
const hashAfterRow = await evaluate(`location.hash`);
check("点击条目本体进入阅读器", hashAfterRow.startsWith("#/reader/"), `实际 ${hashAfterRow}`);

/* 4. 回到库，展开「已翻译」的文献，点「译文」附件 → 阅读器 + zh 模式 */
await evaluate(`location.hash='#/library'`);
await sleep(1800);
await evaluate(`(() => {
  const wraps = [...document.querySelectorAll('.row-wrap')];
  const target = wraps.find(w => w.querySelector('.row-status .pill-ok'));
  const btn = target?.querySelector('.row-toggle');
  if (btn && !target.classList.contains('open')) btn.click();
  return '1';
})()`);
await sleep(700);
const hasZh = await evaluate(`!!document.querySelector('[data-action="open-file-zh"]')`);
check("存在译文附件", hasZh);
if (hasZh) {
  await evaluate(`document.querySelector('[data-action="open-file-zh"]').click()`);
  await sleep(3000);
  const state = JSON.parse(await evaluate(`JSON.stringify({
    hash: location.hash,
    mode: state.reader.mode,
    activeSeg: document.querySelector('.seg-modes .active')?.dataset.id,
    paneId: document.querySelector('.pane')?.id,
    hasPdf: !!document.querySelector('#pane-zh')?._pdf,
  })`));
  check("点译文附件 → 阅读器 zh 模式", state.hash.startsWith("#/reader/") && state.mode === "zh", JSON.stringify(state));
  check("译文面板已挂载 PDF", state.paneId === "pane-zh" && state.hasPdf, JSON.stringify(state));
}

/* 5. 对照版附件 → dual2（需选一篇已翻译的文献） */
await evaluate(`location.hash='#/library'`);
await sleep(1800);
// 找到带「已翻译」标记的条目并展开，避免依赖列表顺序
const picked = await evaluate(`(() => {
  const wraps = [...document.querySelectorAll('.row-wrap')];
  const target = wraps.find(w => w.querySelector('.row-status .pill-ok'));
  if (!target) return null;
  const btn = target.querySelector('.row-toggle');
  if (!target.classList.contains('open')) btn.click();
  return target.querySelector('.row-main h3')?.textContent.slice(0, 30);
})()`);
await sleep(700);
const hasCmp = await evaluate(`!!document.querySelector('[data-action="open-file-compare"]')`);
check("已翻译文献存在对照版附件", hasCmp, `目标文献: ${picked}`);
if (hasCmp) {
  await evaluate(`document.querySelector('[data-action="open-file-compare"]').click()`);
  await sleep(6000);
  const st = JSON.parse(await evaluate(`JSON.stringify({
    mode: state.reader.mode,
    paneId: document.querySelector('.pane')?.id,
    hasPdf: !!document.querySelector('#pane-dual2')?._pdf,
    compareUrl: document.querySelector('#pane-dual2')?._pdf?.doc ? 'loaded' : 'none',
  })`));
  check("点对照版附件 → dual2 模式", st.mode === "dual2" && st.paneId === "pane-dual2", JSON.stringify(st));
  check("对照版 PDF 已加载", st.hasPdf, JSON.stringify(st));
}

console.log("\nconsole 错误:", logs.length ? logs.join(" | ") : "无");
console.log(fails === 0 ? "全部通过" : `${fails} 项失败`);
ws.close(); chrome.kill();
process.exit(fails ? 1 : 0);
