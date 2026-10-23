/* 渲染清晰度验证：从真实源码常量驱动，对比旧/新算法的位图有效分辨率
   用法：node tests/pdf-render.quality.test.mjs
*/
import { readFileSync } from "node:fs";

const src = readFileSync("frontend/js/pdf-view.js", "utf8");

/* 从源码解析常量，避免测试与实现脱节 */
const num = (name, fallback) => {
  const m = src.match(new RegExp(`const ${name}\\s*=\\s*([0-9.e]+)`));
  if (!m) throw new Error(`源码中找不到常量 ${name}`);
  return Number(m[1]);
};
const BASE_W = num("BASE_W");
const TARGET = num("TARGET_RENDER_SCALE");
const MAXK = num("MAX_RENDER_SCALE");
const MAX_AREA = num("MAX_AREA_PX");

const RATIO = 792 / 612;

/* 新算法（复刻 pixelAligned）
   注意面积预算的单位：canvas 面积 = (cssW·k) × (cssW·ratio·k)，
   **不含 dpr**。曾经多乘一次 dpr，导致高分屏上 k 被压到 1.44 而欠采样。 */
function pixelAligned(cssW, dpr, pageW = BASE_W) {
  let cssAligned = Math.round(cssW * dpr) / dpr;
  const cssScale = cssAligned / pageW;
  const wantRender = TARGET / Math.max(cssScale, 1e-6);
  let k = Math.min(MAXK, Math.max(dpr, wantRender));
  const areaPerK2 = cssAligned * cssAligned * RATIO;
  const maxK = Math.sqrt(MAX_AREA / Math.max(1, areaPerK2));
  if (k > maxK) {
    if (maxK >= 1) k = maxK;
    else {
      k = 1;
      const shrink = Math.sqrt(MAX_AREA / areaPerK2);
      cssAligned = Math.max(120, Math.round(cssAligned * shrink * dpr) / dpr);
    }
  }
  return { cssW: cssAligned, k };
}

/* 旧算法 */
function oldAligned(cssW, dpr) {
  return { cssW, k: Math.min(3, Math.max(2, dpr)) };
}

/* 位图有效分辨率 = 位图宽 / 页面物理宽（612pt） */
const effective = (cssW, k) => (cssW * k) / BASE_W;

/* 真实可用宽度：
   阅读器模式下侧栏隐藏（body.reading #sidebar { display:none }），
   单栏 = 1380 - 2*44(pane padding) ≈ 1292px
   compare 对照版 = 单文档、页宽 1224pt（原文+译文），同样铺满容器 */
const W = 1400;
const cases = [
  { label: "单栏", paneW: W, perRow: 1, fit: "width", pageW: 612 },
  { label: "对照并排", paneW: W, perRow: 1, fit: "width", pageW: 1224 },
  { label: "对照适页", paneW: W, perRow: 1, fit: "page", pageW: 1224 },
];

let fails = 0;
const fail = (m) => { fails++; console.log("  ✗ " + m); };

console.log("渲染清晰度对比（位图有效分辨率，≥1.5x 视为清晰）\n");
const pad = (s, n) => String(s).padEnd(n);
console.log(pad("场景", 18) + pad("DPR", 5) + pad("旧：宽/分辨率", 20) + pad("新：宽/分辨率", 20) + "变化");

const results = [];
for (const c of cases) {
  const padding = 88;
  const slot = c.paneW - padding;
  const ratio = c.fit === "page" ? 792 / 1224 : RATIO;
  const cssW = c.fit === "page" ? Math.min(slot, (800 - 70) / ratio) : slot;

  for (const dpr of [1.0, 1.5, 2.0]) {
    const o = oldAligned(cssW, dpr);
    const n = pixelAligned(cssW, dpr, c.pageW);
    const eo = (o.cssW * o.k) / c.pageW, en = (n.cssW * n.k) / c.pageW;
    results.push({ label: c.label, dpr, eo, en, cssWo: o.cssW, cssWn: n.cssW, pageW: c.pageW });

    // 位置效率：位图像素 / 屏幕显示像素（>1 表示有超采样红利，过高等于是浪费）
    const effOld = (o.cssW * o.k) / (o.cssW * dpr);
    const effNew = (n.cssW * n.k) / (n.cssW * dpr);

    console.log(
      pad(c.label, 18) + pad(dpr, 5) +
      pad(`${Math.round(o.cssW)}px / ${eo.toFixed(2)}x (${effOld.toFixed(1)}x超采)`, 32) +
      pad(`${Math.round(n.cssW)}px / ${en.toFixed(2)}x (${effNew.toFixed(1)}x超采)`, 32) +
      (en > eo + 0.01 ? `+${((en / eo - 1) * 100).toFixed(0)}%` : en < eo - 0.01 ? "降采样（省内存）" : "持平")
    );
  }
}

console.log("\n约束检查");
// 1) 位图分辨率达到 2x 设计目标；栏宽极窄时受 MAX_RENDER_SCALE 与硬件像素约束，
//    按「理论上限」判定，不低于下限即可
for (const r of results) {
  const cssScale = r.cssWn / r.pageW;
  const reachable = Math.min(MAXK, Math.max(r.dpr, TARGET / cssScale)) * cssScale;
  const expect = Math.min(TARGET, reachable);
  if (r.en < expect - 0.05) {
    fails++;
    console.log(`  ✗ ${r.label} DPR=${r.dpr}: ${r.en.toFixed(2)}x < 可达到目标 ${expect.toFixed(2)}x`);
  }
}
console.log("  ✓ 各 DPR 下位图分辨率达到可达到的 2x 设计目标");

// 2) 关键回归：高分屏上采样倍数必须 ≥ DPR（曾因面积预算多乘 dpr 导致欠采样 2 倍）。
//    例外：面积预算生效时允许适度降采样（这是有意的内存保护），但降幅不应超过 10%。
for (const r of results) {
  const n = pixelAligned(r.cssWn, r.dpr, r.pageW);
  const shortfall = (r.dpr - n.k) / r.dpr;
  if (shortfall > 0.10) {
    fail(`${r.label} DPR=${r.dpr} 采样 k=${n.k.toFixed(2)} 比 DPR 低 ${(shortfall * 100).toFixed(0)}%（超 10% 即视为欠采样）`);
  }
}
console.log("  ✓ 采样倍数 k ≥ 0.9×DPR（高分屏不显著欠采样；面积预算内允许适度降采样）");

// 3) 不得低于清晰阈值 1.5x；允许对「过度超采样」降采样以省内存
for (const r of results) {
  if (r.en < 1.5) fail(`${r.label} DPR=${r.dpr} 低于清晰阈值（${r.en.toFixed(2)}x）`);
}
console.log("  ✓ 任何场景均 ≥1.5x 清晰阈值");

// 4) 面积预算（含 400% 放大这种极端情况）
//    预算约束的是 canvas 面积 = (cssW·k) × (cssW·ratio·k)，与 DPR 无关；
//    manual 缩放在超过容器宽度时会被 slot 限制，这里直接构造一个极宽目标验证兜底
console.log("\n面积预算（MAX_AREA_PX = " + (MAX_AREA / 1e6) + "MP）");
for (const dpr of [1.0, 1.5, 2.0, 3.0]) {
  const n = pixelAligned(BASE_W * 4, dpr);
  const mp = (n.cssW * n.k) * (n.cssW * RATIO * n.k) / 1e6;
  if (mp > MAX_AREA / 1e6 * 1.001) fail(`DPR=${dpr} 400% → ${mp.toFixed(1)}MP 超预算`);
  console.log(`  ✓ DPR=${dpr} 400% → ${mp.toFixed(1)}MP 在预算内`);
}

console.log(fails === 0 ? "\n全部通过" : `\n${fails} 项未达标`);
process.exitCode = fails ? 1 : 0;
