/* 批注气泡拖动 验证
   覆盖：拖动改变位置、拖到边界被钳制、输入框不触发拖动、位置记忆、复位、
        拖动后隐藏指向三角
   用法：node tests/verify-annot-drag.mjs [port]
*/
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { findBrowser } from "./_browser.mjs";

const [, , port = "8130"] = process.argv;
const CHROME = findBrowser();
const PORT = 9620 + Math.floor(Math.random() * 40);
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

/* 用 CDP 派发真实的鼠标事件序列（比 JS dispatchEvent 更接近用户操作） */
const mouse = async (type, x, y) => {
  await send("Input.dispatchMouseEvent", {
    type, x, y, button: type === "mouseMoved" ? "none" : "left",
    buttons: type === "mouseReleased" ? 0 : 1, clickCount: 1,
  });
};
const drag = async (fromX, fromY, toX, toY, steps = 8) => {
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: fromX, y: fromY, button: "left", buttons: 1, clickCount: 1 });
  for (let i = 1; i <= steps; i++) {
    const x = fromX + ((toX - fromX) * i) / steps;
    const y = fromY + ((toY - fromY) * i) / steps;
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "left", buttons: 1 });
    await sleep(20);
  }
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: toX, y: toY, button: "left", buttons: 0, clickCount: 1 });
};

await send("Runtime.enable");
await send("Page.enable");
await send("Network.setCacheDisabled", { cacheDisabled: true });
await send("Emulation.setDeviceMetricsOverride", { width: 1500, height: 1000, deviceScaleFactor: 2, mobile: false });
await send("Page.navigate", { url: `http://127.0.0.1:${port}/#/reader/9091beec169d` });
await sleep(4500);

const boot = await evaluate(`(async () => {
  for (let i = 0; i < 60; i++) {
    const ok = typeof window.PdfAnnot === 'object' && typeof openAnnotationEditor === 'function'
      && document.querySelector('.pdf-page .textLayer span');
    if (ok) return 'ready';
    await new Promise(function(r){ setTimeout(r, 300); });
  }
  return 'timeout';
})()`);
console.log("前端就绪:", boot);
if (boot !== "ready") { ws.close(); chrome.kill(); process.exit(1); }
await sleep(1000);

let fails = 0;
const check = (n, c, d = "") => { if (c) console.log(`  PASS ${n}`); else { fails++; console.log(`  FAIL ${n} ${d}`); } };
const paperId = "9091beec169d";

await evaluate(`(async () => {
  const l = await (await fetch('/api/papers/${paperId}/annotations')).json();
  for (const a of l) await fetch('/api/papers/${paperId}/annotations/' + a.id, { method: 'DELETE' });
  return 1;
})()`);

/* 用 API 造一条批注并打开气泡 */
const annId = await evaluate(`(async () => {
  const r = await fetch('/api/papers/${paperId}/annotations', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'note', page: 1, color: 'yellow',
      rects: [{ x: 0.15, y: 0.35, w: 0.35, h: 0.018 }], text: '拖动测试原文', comment: '' }),
  });
  const ann = await r.json();
  await loadAnnotations(paperById('${paperId}'));
  return ann.id;
})()`);
await sleep(1200);

const opened = await evaluate(`(() => {
  const pane = document.querySelector('#pane-dual2');
  const ann = PdfAnnot.all(pane).find(function(a){ return a.id === '${annId}'; });
  if (!ann) return { err: 'annot not found' };
  openAnnotationEditor(pane, ann);
  return { ok: true };
})()`);
await sleep(800);
check("气泡已打开", opened.ok === true, JSON.stringify(opened));

/* ===== 1. 头部可拖动 ===== */
const before = await evaluate(`(() => {
  const pop = document.getElementById('annot-pop');
  const head = pop.querySelector('.annot-pop-head');
  const r = pop.getBoundingClientRect();
  const hr = head.getBoundingClientRect();
  return {
    left: Math.round(r.left), top: Math.round(r.top),
    headDraggable: head.classList.contains('draggable'),
    headCursor: getComputedStyle(head).cursor,
    headCenter: { x: Math.round(hr.left + hr.width / 2), y: Math.round(hr.top + hr.height / 2) },
    anchorDir: ['left','right','below','above'].find(function(d){ return pop.classList.contains('anchor-' + d); }) || null,
  };
})()`);
console.log("拖动前:", JSON.stringify(before));
check("头部标记为可拖动", before.headDraggable === true);
check("头部光标为 grab", before.headCursor === "grab", before.headCursor);

/* 从头部拖动 +200, +150 */
await drag(before.headCenter.x, before.headCenter.y,
           before.headCenter.x + 200, before.headCenter.y + 150);
await sleep(500);

const after = await evaluate(`(() => {
  const pop = document.getElementById('annot-pop');
  const r = pop.getBoundingClientRect();
  const r2 = pop.getBoundingClientRect();
  return {
    left: Math.round(r.left), top: Math.round(r.top),
    dx: Math.round(r.left) - ${before.left},
    dy: Math.round(r.top) - ${before.top},
    manuallyPlaced: pop.classList.contains('manually-placed'),
    anchorDir: ['left','right','below','above'].find(function(d){ return pop.classList.contains('anchor-' + d); }) || null,
    arrowHidden: getComputedStyle(pop, '::before').display === 'none',
  };
})()`);
console.log("拖动后:", JSON.stringify(after));
check("拖动改变了位置（横移约 200px）", Math.abs(after.dx - 200) <= 6, `dx=${after.dx}`);
check("拖动改变了位置（纵移约 150px）", Math.abs(after.dy - 150) <= 6, `dy=${after.dy}`);
check("拖动后进入手动定位态", after.manuallyPlaced === true);
check("拖动后指向三角隐藏", after.arrowHidden === true, `anchorDir=${after.anchorDir}`);

await shot("tests/.shots/annot-drag-after.png");

/* ===== 2. 拖到边界应被钳制在视口内 ===== */
const headNow = await evaluate(`(() => {
  const hr = document.getElementById('annot-pop').querySelector('.annot-pop-head').getBoundingClientRect();
  return { x: Math.round(hr.left + hr.width / 2), y: Math.round(hr.top + hr.height / 2) };
})()`);
await drag(headNow.x, headNow.y, 5000, 5000);   // 疯狂往右下拖
await sleep(500);
const clamped = await evaluate(`(() => {
  const pop = document.getElementById('annot-pop');
  const r = pop.getBoundingClientRect();
  return {
    left: Math.round(r.left), top: Math.round(r.top),
    right: Math.round(r.right), bottom: Math.round(r.bottom),
    vw: window.innerWidth, vh: window.innerHeight,
    inside: r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight,
  };
})()`);
console.log("拖到边界:", JSON.stringify(clamped));
check("拖到右下边界被钳制在视口内", clamped.inside === true, JSON.stringify(clamped));

/* 再往左上拖到负坐标 */
const headNow2 = await evaluate(`(() => {
  const hr = document.getElementById('annot-pop').querySelector('.annot-pop-head').getBoundingClientRect();
  return { x: Math.round(hr.left + hr.width / 2), y: Math.round(hr.top + hr.height / 2) };
})()`);
await drag(headNow2.x, headNow2.y, -3000, -3000);
await sleep(500);
const clamped2 = await evaluate(`(() => {
  const r = document.getElementById('annot-pop').getBoundingClientRect();
  return { left: Math.round(r.left), top: Math.round(r.top), inside: r.left >= 0 && r.top >= 0 };
})()`);
console.log("拖到左上边界:", JSON.stringify(clamped2));
check("拖到左上边界被钳制在视口内", clamped2.inside === true, JSON.stringify(clamped2));

/* ===== 3. 在输入框内拖动不应移动气泡 ===== */
const taBox = await evaluate(`(() => {
  const ta = document.getElementById('annot-comment');
  const r = ta.getBoundingClientRect();
  const pop = document.getElementById('annot-pop').getBoundingClientRect();
  return { x: Math.round(r.left + 20), y: Math.round(r.top + 10),
           popLeft: Math.round(pop.left), popTop: Math.round(pop.top) };
})()`);
await drag(taBox.x, taBox.y, taBox.x + 150, taBox.y + 100);
await sleep(400);
const taAfter = await evaluate(`(() => {
  const r = document.getElementById('annot-pop').getBoundingClientRect();
  return { left: Math.round(r.left), top: Math.round(r.top) };
})()`);
console.log("在输入框拖动:", JSON.stringify({ before: taBox, after: taAfter }));
check("在输入框内拖动不会移动气泡",
  Math.abs(taAfter.left - taBox.popLeft) <= 2 && Math.abs(taAfter.top - taBox.popTop) <= 2,
  JSON.stringify({ before: taBox, after: taAfter }));

/* ===== 4. 位置记忆：关闭再打开同一条批注 ===== */
const remembered = await evaluate(`(() => {
  const pop = document.getElementById('annot-pop');
  const saved = { left: Math.round(pop.getBoundingClientRect().left), top: Math.round(pop.getBoundingClientRect().top) };
  document.querySelector('[data-annot-close]').click();
  const pane = document.querySelector('#pane-dual2');
  const ann = PdfAnnot.all(pane).find(function(a){ return a.id === '${annId}'; });
  const mark = document.querySelector('.annot-mark[data-annot-id="${annId}"]');
  if (mark) mark.click();
  else openAnnotationEditor(pane, ann);
  return saved;
})()`);
await sleep(900);
const reopened = await evaluate(`(() => {
  const r = document.getElementById('annot-pop').getBoundingClientRect();
  return { left: Math.round(r.left), top: Math.round(r.top),
           manuallyPlaced: document.getElementById('annot-pop').classList.contains('manually-placed') };
})()`);
console.log("重开位置:", JSON.stringify({ saved: remembered, reopened }));
check("重新打开保持上次拖动的位置",
  Math.abs(reopened.left - remembered.left) <= 3 && Math.abs(reopened.top - remembered.top) <= 3,
  JSON.stringify({ saved: remembered, reopened }));
check("重新打开仍为手动定位态", reopened.manuallyPlaced === true);

/* ===== 5. 复位按钮 ===== */
await evaluate(`document.querySelector('[data-annot-reset-pos]').click()`);
await sleep(800);
const reset = await evaluate(`(() => {
  const pop = document.getElementById('annot-pop');
  const r = pop.getBoundingClientRect();
  return {
    left: Math.round(r.left), top: Math.round(r.top),
    anchored: pop.classList.contains('anchored'),
    manuallyPlaced: pop.classList.contains('manually-placed'),
    anchorDir: ['left','right','below','above'].find(function(d){ return pop.classList.contains('anchor-' + d); }) || null,
    arrowVisible: getComputedStyle(pop, '::before').display !== 'none',
  };
})()`);
console.log("复位后:", JSON.stringify(reset));
check("复位后重新锚定到批注文字", reset.anchored === true && !!reset.anchorDir, JSON.stringify(reset));
check("复位后退出手动定位态", reset.manuallyPlaced === false);
check("复位后指向三角恢复", reset.arrowVisible === true);

await shot("tests/.shots/annot-drag-reset.png");

console.log("\nconsole 错误:", logs.length ? logs.join(" | ") : "无");

await evaluate(`(async () => {
  const l = await (await fetch('/api/papers/${paperId}/annotations')).json();
  for (const a of l) await fetch('/api/papers/${paperId}/annotations/' + a.id, { method: 'DELETE' });
  const pane = document.querySelector('#pane-dual2');
  PdfAnnot.setAll(pane, []);
  return 1;
})()`);

console.log(fails === 0 ? "全部通过" : `${fails} 项失败`);
ws.close(); chrome.kill();
process.exit(fails ? 1 : 0);
