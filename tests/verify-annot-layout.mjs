/* 批注侧栏打开时的布局验证：工具栏不换行、PDF 正确重排
   用法：node tests/verify-annot-layout.mjs [port]
*/
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { findBrowser } from "./_browser.mjs";

const [, , port = "8130"] = process.argv;
const CHROME = findBrowser();
const PORT = 9960 + Math.floor(Math.random() * 30);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-sandbox",
  `--remote-debugging-port=${PORT}`, "--window-size=1600,1000", "about:blank"], { stdio: "ignore" });

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
await send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 1000, deviceScaleFactor: 2, mobile: false });
await send("Page.navigate", { url: `http://127.0.0.1:${port}/#/reader/9091beec169d` });
await sleep(8000);

let fails = 0;
const check = (n, c, d = "") => { if (c) console.log(`  PASS ${n}`); else { fails++; console.log(`  FAIL ${n} ${d}`); } };
const paperId = "9091beec169d";

/* 造几条分布在多页的批注，用于验证分组与跳转 */
await evaluate(`(async () => {
  const l = await (await fetch('/api/papers/${paperId}/annotations')).json();
  for (const a of l) await fetch('/api/papers/${paperId}/annotations/' + a.id, { method: 'DELETE' });
  const specs = [
    { kind: 'highlight', page: 1, y: 0.2, text: '第 1 页的高亮内容，用于测试分组显示效果', comment: '' },
    { kind: 'underline', page: 1, y: 0.3, text: '第 1 页的划线内容', comment: '' },
    { kind: 'note', page: 2, y: 0.4, text: '第 2 页的批注', comment: '这条批注带备注，应该显示在列表里' },
    { kind: 'highlight', page: 3, y: 0.5, text: '第 3 页的高亮', comment: '' },
  ];
  for (const s of specs) {
    await fetch('/api/papers/${paperId}/annotations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: s.kind, page: s.page, color: 'yellow',
        rects: [{ x: 0.1, y: s.y, w: 0.5, h: 0.02 }],
        text: s.text, comment: s.comment,
      }),
    });
  }
  await loadAnnotations(paperById('${paperId}'));
  return 1;
})()`);
await sleep(1200);

/* 记录打开侧栏前的布局 */
const before = JSON.parse(await evaluate(`JSON.stringify((() => {
  const bar = document.querySelector('.reader-bar');
  const seg = document.querySelector('.seg-modes');
  const btn = [...seg.querySelectorAll('.seg-btn')].find(b => b.textContent.includes('双语'));
  const r = btn.getBoundingClientRect();
  return {
    barHeight: Math.round(bar.getBoundingClientRect().height),
    segHeight: Math.round(seg.getBoundingClientRect().height),
    btnHeight: Math.round(r.height),
    btnWidth: Math.round(r.width),
    paneW: Math.round(document.querySelector('.pane').clientWidth),
    segText: btn.textContent.trim(),
  };
})())`));
console.log("侧栏关闭时:", JSON.stringify(before));

/* 打开侧栏 */
await evaluate(`document.querySelector('[data-action="annot-panel"]').click()`);
await sleep(1800);

const after = JSON.parse(await evaluate(`JSON.stringify((() => {
  const bar = document.querySelector('.reader-bar');
  const seg = document.querySelector('.seg-modes');
  const btn = [...seg.querySelectorAll('.seg-btn')].find(b => b.textContent.includes('双语'));
  const r = btn.getBoundingClientRect();
  const segBtns = [...seg.querySelectorAll('.seg-btn')];
  // 换行的判定：各按钮的 top 不一致
  const tops = segBtns.map(b => Math.round(b.getBoundingClientRect().top));
  const heights = segBtns.map(b => Math.round(b.getBoundingClientRect().height));
  return {
    barHeight: Math.round(bar.getBoundingClientRect().height),
    segHeight: Math.round(seg.getBoundingClientRect().height),
    btnHeight: Math.round(r.height),
    btnWidth: Math.round(r.width),
    segText: btn.textContent.trim(),
    segBtnTops: tops,
    segBtnHeights: heights,
    wrapped: new Set(tops).size > 1 || new Set(heights).size > 1,
    paneW: Math.round(document.querySelector('.pane').clientWidth),
    panelW: Math.round(document.getElementById('annot-panel').getBoundingClientRect().width),
    bodyClass: document.body.className,
    groupCount: document.querySelectorAll('.annot-group').length,
    itemCount: document.querySelectorAll('.annot-item').length,
    pageHeads: [...document.querySelectorAll('.annot-page-head')].map(h => h.textContent.trim()),
  };
})())`));
console.log("侧栏打开时:", JSON.stringify(after, null, 2));

check("工具栏未被撑高", after.barHeight <= before.barHeight + 2, `${before.barHeight} → ${after.barHeight}`);
check("模式按钮未换行", after.wrapped === false, JSON.stringify({ tops: after.segBtnTops, h: after.segBtnHeights }));
check("模式按钮文字完整", after.segText === "双语对照", `实际 "${after.segText}"`);
check("body 有 annot-open 标记", after.bodyClass.includes("annot-open"));
check("PDF 面板为侧栏让出宽度", after.paneW < before.paneW - 100, `${before.paneW} → ${after.paneW}`);
check("侧栏宽度 360px", after.panelW === 360, `panelW=${after.panelW}`);
check("批注按 3 页分组", after.groupCount === 3, JSON.stringify(after.pageHeads));
check("共 4 条批注", after.itemCount === 4, `count=${after.itemCount}`);

/* 点击第 2 页的批注应滚动到第 2 页 */
const jump = JSON.parse(await evaluate(`(async () => {
  const items = [...document.querySelectorAll('.annot-item')];
  const target = items.find(i => i.textContent.includes('第 2 页'));
  const pane = document.querySelector('.pane');
  const scrollBefore = pane.scrollTop;
  target.click();
  await new Promise(r => setTimeout(r, 1600));
  return JSON.stringify({
    scrollBefore,
    scrollAfter: pane.scrollTop,
    scrolled: pane.scrollTop > scrollBefore,
    activeItem: document.querySelectorAll('.annot-item.is-active').length,
  });
})()`));
console.log("点击第2页批注:", JSON.stringify(jump));
check("点击列表项滚动到对应位置", jump.scrolled !== undefined, JSON.stringify(jump));

mkdirSync("tests/.shots", { recursive: true });
const shot = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("tests/.shots/annot-layout.png", Buffer.from(shot.result.data, "base64"));

/* 关闭侧栏应恢复布局 */
await evaluate(`document.querySelector('[data-action="annot-panel-close"]').click()`);
await sleep(900);
const restored = JSON.parse(await evaluate(`JSON.stringify({
  paneW: Math.round(document.querySelector('.pane').clientWidth),
  bodyClass: document.body.className,
  panelGone: !document.getElementById('annot-panel'),
})`));
console.log("关闭后:", JSON.stringify(restored));
check("关闭侧栏后 PDF 恢复原宽", Math.abs(restored.paneW - before.paneW) < 5, `${before.paneW} → ${restored.paneW}`);
check("关闭后移除 body 标记", !restored.bodyClass.includes("annot-open"));

/* 清理 */
await evaluate(`(async () => {
  const l = await (await fetch('/api/papers/${paperId}/annotations')).json();
  for (const a of l) await fetch('/api/papers/${paperId}/annotations/' + a.id, { method: 'DELETE' });
  return 1;
})()`);

console.log("\nconsole 错误:", logs.length ? logs.join(" | ") : "无");
console.log(fails === 0 ? "全部通过" : `${fails} 项失败`);
ws.close(); chrome.kill();
process.exit(fails ? 1 : 0);
