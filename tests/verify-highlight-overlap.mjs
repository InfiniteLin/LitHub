/* 重叠高亮不加深 验证
   构造场景：同一段文字被高亮 2 次 / 3 次，测量实际像素颜色，
   与「只高亮 1 次」对比，色值应当一致（不加深）。
   用法：node tests/verify-highlight-overlap.mjs [port]
*/
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { findBrowser } from "./_browser.mjs";

const [, , port = "8130"] = process.argv;
const CHROME = findBrowser();
const PORT = 9885 + Math.floor(Math.random() * 20);
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
const shot = async (name, clip) => {
  mkdirSync("tests/.shots", { recursive: true });
  const params = { format: "png" };
  if (clip) params.clip = clip;
  const r = await send("Page.captureScreenshot", params);
  writeFileSync(name, Buffer.from(r.result.data, "base64"));
};

await send("Runtime.enable");
await send("Page.enable");
await send("Network.setCacheDisabled", { cacheDisabled: true });
await send("Emulation.setDeviceMetricsOverride", { width: 1500, height: 1000, deviceScaleFactor: 2, mobile: false });
await send("Page.navigate", { url: `http://127.0.0.1:${port}/#/reader/9091beec169d` });
await sleep(7000);
await evaluate(`(async () => {
  for (let i = 0; i < 40; i++) {
    const p = document.querySelector('.pdf-page');
    if (p && p.querySelector('.textLayer span')) return 1;
    await new Promise(function(r){ setTimeout(r, 300); });
  }
  return 0;
})()`);

let fails = 0;
const check = (n, c, d = "") => { if (c) console.log(`  PASS ${n}`); else { fails++; console.log(`  FAIL ${n} ${d}`); } };
const paperId = "9091beec169d";

/* 清空 */
await evaluate(`(async () => {
  const l = await (await fetch('/api/papers/${paperId}/annotations')).json();
  for (const a of l) await fetch('/api/papers/${paperId}/annotations/' + a.id, { method: 'DELETE' });
  const pane = document.querySelector('#pane-dual2');
  PdfAnnot.setAll(pane, []);
  return 1;
})()`);
await sleep(600);

/* 取一段文字的真实位置（用 range 拿到精确矩形） */
const target = JSON.parse(await evaluate(`JSON.stringify((() => {
  const page = document.querySelector('.pdf-page');
  const pageRect = page.getBoundingClientRect();
  const spans = [...page.querySelectorAll('.textLayer span')].filter(function(s){
    return (s.textContent || '').trim().length >= 12;
  });
  const span = spans[3];
  const node = span.firstChild;
  const range = document.createRange();
  range.setStart(node, 0);
  range.setEnd(node, Math.min(node.textContent.length, 30));
  const r = range.getBoundingClientRect();
  return {
    text: node.textContent.slice(0, 30),
    rect: {
      x: (r.left - pageRect.left) / pageRect.width,
      y: (r.top - pageRect.top) / pageRect.height,
      w: r.width / pageRect.width,
      h: r.height / pageRect.height,
    },
    // 屏幕坐标（用于截图裁剪）
    screen: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
  };
})())`));
console.log("目标文字:", JSON.stringify(target.text));
console.log("目标矩形:", JSON.stringify(target.rect));

/* 采样页面某点的实际渲染颜色（通过截图后读取像素） */
const sampleColor = async (sx, sy) => {
  const clip = { x: sx, y: sy, width: 2, height: 2, scale: 1 };
  const r = await send("Page.captureScreenshot", { format: "png", clip });
  const b64 = r.result.data;
  // 用画布解码 PNG 后取中心像素
  const color = await evaluate(`(async () => {
    const dataUrl = "data:image/png;base64,${b64}";
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(Math.floor(img.width/2), Math.floor(img.height/2), 1, 1).data;
    return [d[0], d[1], d[2], d[3]];
  })()`);
  return color;
};

/* ===== 场景 1：单条高亮 → 采样颜色 ===== */
await evaluate(`(async () => {
  const pane = document.querySelector('#pane-dual2');
  await fetch('/api/papers/${paperId}/annotations', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'highlight', page: 1, color: 'yellow',
      rects: [${JSON.stringify(target.rect)}], text: '单条', comment: '' }),
  });
  await loadAnnotations(paperById('${paperId}'));
  return 1;
})()`);
await sleep(1200);

const rectOnScreen = JSON.parse(await evaluate(`JSON.stringify((() => {
  const page = document.querySelector('.pdf-page');
  const el = page.querySelector('.annot-rect.annot-highlight');
  if (!el) return {};
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
           centerX: Math.round(r.left + r.width/2), centerY: Math.round(r.top + r.height/2) };
})())`));
console.log("高亮屏幕矩形:", JSON.stringify(rectOnScreen));

const color1 = await sampleColor(rectOnScreen.centerX, rectOnScreen.centerY);
console.log("单条高亮颜色:", JSON.stringify(color1));
await shot("tests/.shots/overlap-1.png", { x: target.screen.x - 20, y: target.screen.y - 20, width: target.screen.w + 60, height: target.screen.h + 40, scale: 2 });

/* ===== 场景 2：同一位置再高亮 2 次（共 3 条）→ 颜色应几乎相同 ===== */
await evaluate(`(async () => {
  for (let i = 0; i < 2; i++) {
    await fetch('/api/papers/${paperId}/annotations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'highlight', page: 1, color: 'yellow',
        rects: [${JSON.stringify(target.rect)}], text: '重复' + i, comment: '' }),
    });
  }
  await loadAnnotations(paperById('${paperId}'));
  return 1;
})()`);
await sleep(1500);

const color3 = await sampleColor(rectOnScreen.centerX, rectOnScreen.centerY);
console.log("3 条重叠高亮颜色:", JSON.stringify(color3));
await shot("tests/.shots/overlap-3.png", { x: target.screen.x - 20, y: target.screen.y - 20, width: target.screen.w + 60, height: target.screen.h + 40, scale: 2 });

const diff = Math.max(
  Math.abs(color1[0] - color3[0]),
  Math.abs(color1[1] - color3[1]),
  Math.abs(color1[2] - color3[2]),
);
console.log(`颜色差异: ${diff} (RGB 0-255)`);
check("3 条重叠后颜色不加深（RGB 差异 ≤ 6）", diff <= 6, `diff=${diff}, 1条=${color1}, 3条=${color3}`);

/* ===== 场景 3：DOM 层数检查——同色重叠应只画 1 块 ===== */
const layerInfo = JSON.parse(await evaluate(`JSON.stringify((() => {
  const page = document.querySelector('.pdf-page');
  const rects = [...page.querySelectorAll('.annot-rect.annot-highlight')];
  return {
    painted: rects.length,
    backend: null,
    annotIds: [...new Set(rects.map(function(e){ return e.dataset.annotId; }))].length,
    allIds: rects[0] ? rects[0].dataset.annotIds : null,
  };
})())`));
const backendCount = await evaluate(`(async () => (await (await fetch('/api/papers/${paperId}/annotations')).json()).length)()`);
layerInfo.backend = backendCount;
console.log("图层信息:", JSON.stringify(layerInfo));
check("后端有 3 条批注", layerInfo.backend === 3, `backend=${layerInfo.backend}`);
check("页面只绘制 1 块高亮（已合并）", layerInfo.painted === 1, `painted=${layerInfo.painted}`);

/* ===== 场景 4：部分重叠（向右延伸到原区间之外）—— 应合并成一块更宽的 ===== */
await evaluate(`(async () => {
  const l = await (await fetch('/api/papers/${paperId}/annotations')).json();
  for (const a of l) await fetch('/api/papers/${paperId}/annotations/' + a.id, { method: 'DELETE' });
  const r = ${JSON.stringify(target.rect)};
  // 从原区间中点开始，向右延伸出原区间（真正的「部分重叠 + 扩展」）
  const extended = Object.assign({}, r, {
    x: r.x + r.w * 0.5,
    w: r.w * 0.5 + 0.08,     // 超出原右界 8% 页宽
  });
  await fetch('/api/papers/${paperId}/annotations', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'highlight', page: 1, color: 'green', rects: [r], text: 'A', comment: '' }),
  });
  await fetch('/api/papers/${paperId}/annotations', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'highlight', page: 1, color: 'green', rects: [extended], text: 'B', comment: '' }),
  });
  await loadAnnotations(paperById('${paperId}'));
  return 1;
})()`);
await sleep(1500);

const partial = JSON.parse(await evaluate(`JSON.stringify((() => {
  const page = document.querySelector('.pdf-page');
  const rects = [...page.querySelectorAll('.annot-rect.annot-highlight')];
  return {
    count: rects.length,
    spans: rects.map(function(e){
      const r = e.getBoundingClientRect();
      return { left: Math.round(r.left), width: Math.round(r.width), right: Math.round(r.right) };
    }),
    colors: rects.map(function(e){ return getComputedStyle(e).backgroundColor; }),
  };
})())`));
console.log("部分重叠合并:", JSON.stringify(partial));
check("部分重叠合并为 1 块", partial.count === 1, `count=${partial.count}`);
if (partial.count === 1 && partial.spans.length) {
  const origRight = target.screen.x + target.screen.w;
  const merged = partial.spans[0];
  check("合并后覆盖到扩展区的右界", merged.right >= origRight + target.screen.w * 0.4,
    `mergedRight=${merged.right}, origRight=${origRight}`);
  check("合并后起点仍是原区间起点", Math.abs(merged.left - target.screen.x) <= 2,
    `mergedLeft=${merged.left}, origLeft=${target.screen.x}`);
}

/* ===== 场景 5：不同颜色不应被合并，且各自颜色正确 ===== */
await evaluate(`(async () => {
  const l = await (await fetch('/api/papers/${paperId}/annotations')).json();
  for (const a of l) await fetch('/api/papers/${paperId}/annotations/' + a.id, { method: 'DELETE' });
  const r = ${JSON.stringify(target.rect)};
  for (const c of ['yellow', 'blue']) {
    await fetch('/api/papers/${paperId}/annotations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'highlight', page: 1, color: c, rects: [r], text: c, comment: '' }),
    });
  }
  await loadAnnotations(paperById('${paperId}'));
  return 1;
})()`);
await sleep(1500);
const multi = JSON.parse(await evaluate(`JSON.stringify((() => {
  const page = document.querySelector('.pdf-page');
  const rects = [...page.querySelectorAll('.annot-rect.annot-highlight')];
  return {
    count: rects.length,
    colors: rects.map(function(e){ return e.style.background; }),
  };
})())`));
console.log("双色重叠:", JSON.stringify(multi));
check("不同颜色各自绘制（不合并）", multi.count === 2, `count=${multi.count}`);
check("颜色分别为黄/蓝", multi.colors.some((c) => c.includes("255, 214, 64")) && multi.colors.some((c) => c.includes("110, 168, 254")),
  JSON.stringify(multi.colors));

await shot("tests/.shots/overlap-final.png");

/* 清理 */
await evaluate(`(async () => {
  const l = await (await fetch('/api/papers/${paperId}/annotations')).json();
  for (const a of l) await fetch('/api/papers/${paperId}/annotations/' + a.id, { method: 'DELETE' });
  const pane = document.querySelector('#pane-dual2');
  PdfAnnot.setAll(pane, []);
  return 1;
})()`);

console.log("\n异常:", logs.length ? logs.join(" | ") : "无");
console.log(fails === 0 ? "全部通过" : `${fails} 项失败`);
ws.close(); chrome.kill();
process.exit(fails ? 1 : 0);
