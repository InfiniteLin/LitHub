/* ============================================================
 * 文枢 · PDF 渲染器（PDF.js）
 * 模式：
 *   - 单栏（原文 / 译文）：单文档逐页渲染
 *   - 双语对照：原文与译文两份文档并排（每行 左原文 · 右译文）
 *
 * 清晰度策略（分辨率与显示尺寸严格像素对齐）：
 *   1. 页宽按「整数设备像素」计算：round(cssW * dpr) / dpr，
 *      保证 canvas 位图尺寸 = CSS 宽度 × dpr，没有非整数重采样
 *   2. 采样倍数按设备 DPR 自适应：max(2, dpr) 兜底，非 1x 屏不再降采样
 *   3. 面积预算（默认 8MP/页）：超出则等比降低采样，避免 OOM 与卡顿
 *   4. 监听 device-pixel-content-box：窗口在 1x/2x 屏之间拖动时自动重绘
 *   5. 缩放支持 适合宽度 / 适合页面 / 50%–400%，快捷键与 Ctrl+滚轮
 *
 * 每页三层：位图 canvas + 透明文本层（可选中/可复制）+ 预留批注层
 * 懒渲染：仅视口附近页面绘制；页对象也在进入视口时才向 PDF.js 请求
 * ============================================================ */

"use strict";

window.PdfView = (() => {
  let pdfjsLib = null;
  const BASE_W = 612;          // PDF 基准宽（pt，Letter 宽）
  const TARGET_RENDER_SCALE = 2.0; // 目标位图分辨率（相对页面物理尺寸的倍数）
  const MAX_RENDER_SCALE = 3.0;    // 采样倍数上限（再高对肉眼无收益，只烧内存）
  const MAX_AREA_PX = 8e6;     // 单页位图面积预算（约 8 百万像素 ≈ 32MB RGBA）
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 4;
  // 经典脚本中的动态 import 相对脚本自身解析，这里显式基于页面地址定位 vendor 目录
  const VENDOR = new URL("vendor/pdfjs/", document.baseURI).href;

  const dprNow = () => {
    const d = Number(window.devicePixelRatio) || 1;
    return Math.min(4, Math.max(1, d));
  };

  async function ensurePdfjs() {
    if (pdfjsLib) return pdfjsLib;
    pdfjsLib = await import(VENDOR + "pdf.min.js");
    pdfjsLib.GlobalWorkerOptions.workerSrc = VENDOR + "pdf.worker.min.js";
    return pdfjsLib;
  }

  function docParams(url) {
    return {
      url,
      cMapUrl: VENDOR + "cmaps/",
      cMapPacked: true,
      standardFontDataUrl: VENDOR + "standard_fonts/",
    };
  }

  /* ---------------- 尺寸计算 ---------------- */

  /* 容器可用宽度（减去 pane 左右 padding 与滚动条） */
  function availWidth(pane) {
    return Math.max(220, pane.clientWidth - 88);
  }

  /* 单页目标 CSS 宽。fit:
       width → 铺满容器（单栏清晰度最高的默认值）
       page  → 整页可见（按容器高度约束）
       manual→ 按页面物理宽 × zoom 缩放                              */
  function targetWidth(pane, pdf) {
    const avail = availWidth(pane);
    const perRow = pdf.perRow;
    const slot = avail / perRow - (perRow > 1 ? pdf.gap || 16 : 0);
    if (pdf.fit === "width") return slot;
    if (pdf.fit === "page") {
      const ratio = pdf.pageRatio || 1.294;
      const vh = (pane.clientHeight || 600) - 96;
      return Math.min(slot, vh / ratio);
    }
    // manual：按该文档实际页宽（pt）缩放。注意 compare 版页宽是单页的两倍，
    // 用固定 612 会把 100% 算错，因此以 pdf.pageW 为准
    const base = (pdf.pageW || BASE_W) * (pdf.zoom || 1);
    return Math.min(base, slot);
  }

  /* 像素对齐：返回 {cssW, k}。
     - cssW 对齐到整数设备像素（消除非整数缩放导致的文字发虚）
     - k = canvas 位图宽 / CSS 宽，即「每个 CSS 像素用多少位图像素」。
       要高分屏上像素级锐利，k 必须 ≥ devicePixelRatio；同时不低于
       TARGET_RENDER_SCALE（相对页面物理宽 2x）。
     - 面积预算：canvas 面积 = (cssW·k) × (cssW·ratio·k)，超限时先降 k，
       降到 1 仍超再收窄 CSS 宽，避免超大 canvas 卡顿/崩溃。 */
  function pixelAligned(cssW, ratio, pageW = BASE_W) {
    const dpr = dprNow();
    let cssAligned = Math.round(cssW * dpr) / dpr;

    // 目标采样倍率（相对 CSS 像素）
    const cssScale = cssAligned / pageW;
    const wantRender = TARGET_RENDER_SCALE / Math.max(cssScale, 1e-6);
    let k = Math.min(MAX_RENDER_SCALE, Math.max(dpr, wantRender));

    // 面积预算：注意单位是 CSS 像素²·k²，不要再乘 dpr
    const areaPerK2 = cssAligned * cssAligned * ratio;
    const maxK = Math.sqrt(MAX_AREA_PX / Math.max(1, areaPerK2));
    if (k > maxK) {
      if (maxK >= 1) {
        k = maxK;                        // 先降采样
      } else {
        k = 1;                           // 采样已到 1x，不能再降
        const shrink = Math.sqrt(MAX_AREA_PX / areaPerK2);
        cssAligned = Math.max(120, Math.round(cssAligned * shrink * dpr) / dpr);
      }
    }
    return { cssW: cssAligned, k, dpr };
  }

  function clearPages(pane) {
    const pdf = pane._pdf;
    pdf?.io?.disconnect(); // 重复挂载前断开旧观察器，避免泄漏
    pdf?.resizeObs?.disconnect?.();
    // 释放文档句柄与其缓存页（PDF.js worker 侧也一并释放）
    pdf?.doc?.destroy?.();
    // 防止此前排队中的 paint() 继续访问已销毁的文档
    if (pdf) {
      pdf.dead = true;
      for (const meta of pdf.metas) {
        for (const side of meta.sides) {
          side.dead = true;
          side.renderTask?.cancel?.();
          side.textLayer?.cancel?.();
        }
      }
    }
    pane._pdf = null;
    pane.querySelectorAll(".pdf-row").forEach((el) => el.remove());
  }

  /* 懒取页：仅在页面进入视口时才向 PDF.js 请求 PageProxy。 */
  async function ensurePage(side) {
    if (side.page || !side.doc || side.pageIndex == null) return side.page;
    const page = await side.doc.getPage(side.pageIndex + 1);
    const vp = page.getViewport({ scale: 1 });
    side.page = page;
    side.w = vp.width;
    side.h = vp.height;
    return page;
  }

  /* ---------------- 布局 ---------------- */

  function buildRows(pane) {
    const pdf = pane._pdf;
    const flow = pane.querySelector(".pdf-flow") || (() => {
      const el = document.createElement("div");
      el.className = "pdf-flow";
      pane.appendChild(el);
      return el;
    })();

    for (const meta of pdf.metas) {
      const row = document.createElement("div");
      row.className = "pdf-row";
      meta.sides.forEach((side) => {
        const div = document.createElement("div");
        div.className = "pdf-page";
        const ratio = side.w && side.h && side.page ? side.h / side.w : pdf.pageRatio || 1.294;
        side.ratio = ratio;
        if (pdf.perRow > 1) {
          const tag = document.createElement("span");
          tag.className = "pdf-tag";
          tag.textContent = side.lang === "zh" ? "译文" : "原文";
          div.appendChild(tag);
        }
        const canvas = document.createElement("canvas");
        div.appendChild(canvas);
        const textDiv = document.createElement("div");
        textDiv.className = "textLayer";
        div.appendChild(textDiv);
        div.insertAdjacentHTML("beforeend", '<div class="pdf-annot"></div>');
        row.appendChild(div);
        side.div = div;
        side.canvas = canvas;
        side.textDiv = textDiv;
      });
      flow.appendChild(row);
      meta.div = row;
    }
    applySizes(pane);
  }

  /* 统一刷新所有页的 CSS 尺寸（resize / 缩放 / 切换 fit 时调用）。
     宽高都写成整数 CSS px，与 canvas 位图保持严格比例。 */
  function applySizes(pane) {
    const pdf = pane._pdf;
    if (!pdf) return;
    const avail = availWidth(pane);
    const perRow = pdf.perRow;
    const slot = avail / perRow - (perRow > 1 ? (pdf.gap || 16) : 0);
    let cssW;
    if (pdf.fit === "width") cssW = slot;
    else if (pdf.fit === "page") {
      const vh = (pane.clientHeight || 600) - (perRow > 1 ? 70 : 110);
      cssW = Math.min(slot, vh / (pdf.pageRatio || 1.294));
    } else {
      cssW = Math.min((pdf.pageW || BASE_W) * (pdf.zoom || 1), slot);
    }
    const ratio = pdf.pageRatio || 1.294;
    const { cssW: aligned } = pixelAligned(cssW, ratio, pdf.pageW || BASE_W);
    const cssH = Math.round(aligned * ratio);
    for (const meta of pdf.metas) {
      for (const side of meta.sides) {
        if (!side.div) continue;
        side.cssW = aligned;
        side.cssH = Math.round(aligned * (side.ratio || ratio));
        side.div.style.width = aligned + "px";
        side.div.style.height = side.cssH + "px";
      }
    }
    pdf.appliedW = aligned;
  }

  function observe(pane) {
    const pdf = pane._pdf;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          for (const meta of pdf.metas) {
            const hit = meta.sides.filter((s) => s.div === en.target);
            for (const side of hit) {
              if (!side.rendered) {
                side.rendered = true;
                paint(side, pane).catch((err) => {
                  side.rendered = false;
                  if (err?.name !== "RenderingCancelledException") console.error("paint 失败:", err);
                });
              }
            }
          }
        });
      },
      { root: pane, rootMargin: "800px 0px" }
    );
    pdf.metas.forEach((meta) => meta.sides.forEach((side) => io.observe(side.div)));
    pdf.io = io;
  }

  /* ---------------- 渲染 ---------------- */

  /* 渲染单页：像素对齐位图 + 文本层。
     - canvas 位图 = CSS 宽 × dpr × k，CSS 显示宽 = 对齐后的整数像素宽
     - 文本层用同一个 CSS scale 渲染，保证选区与位图重合            */
  async function paint(side, pane) {
    const pdfjs = await ensurePdfjs();
    if (side.dead) return;
    await ensurePage(side);
    if (!side.page || side.dead) return;

    const ratio = side.h / side.w || 1.294;
    const target = side.cssW || (pane?._pdf ? targetWidth(pane, pane._pdf) : BASE_W);
    const { cssW, k } = pixelAligned(target, ratio, side.w || BASE_W);

    // 视图不可见时跳过（尺寸为 0）
    if (cssW < 1) return;

    side.renderTask?.cancel?.();
    const scale = (cssW * k) / side.w;          // 位图缩放（PDF pt → 设备像素）
    const vp = side.page.getViewport({ scale });

    const ctx = side.canvas.getContext("2d", { alpha: false });
    side.canvas.width = Math.round(vp.width);
    side.canvas.height = Math.round(vp.height);
    // CSS 侧精确指定：避免浏览器按 100% 二次缩放
    side.canvas.style.width = cssW + "px";
    side.canvas.style.height = Math.round(cssW * ratio) + "px";
    side.div.style.width = cssW + "px";
    side.div.style.height = Math.round(cssW * ratio) + "px";

    side.renderTask = side.page.render({ canvasContext: ctx, viewport: vp });
    await side.renderTask.promise.catch((err) => {
      if (err?.name === "RenderingCancelledException") return;
      console.error("page.render 失败:", err);
      throw err;
    });

    // 文本层：用 CSS scale（不含 dpr）渲染，由 CSS 变量驱动字号。
    // 注意：PDF.js 3.x 的文本层宽度/高度由它自己写成
    //   width: round(down, var(--total-scale-factor) * 612px, var(--scale-round-x))
    // 这里只设置 --total-scale-factor，**不要**覆盖 width/height，
    // 否则会打断它的响应式换算（表现为文字溢出/选区错位/AbortException）。
    const cssScale = cssW / side.w;
    side.textLayer?.cancel?.();
    side.textDiv.innerHTML = "";
    side.textDiv.style.setProperty("--total-scale-factor", String(cssScale));
    side.textLayer = new pdfjs.TextLayer({
      textContentSource: side.page.streamTextContent(),
      container: side.textDiv,
      viewport: side.page.getViewport({ scale: cssScale }),
    });
    await side.textLayer.render().catch((err) => {
      // 渲染中被下一次 paint 取消属正常流程
      if (err?.name !== "AbortException" && err?.name !== "RenderingCancelledException") {
        console.error("textLayer 渲染失败:", err);
      }
    });
    side.paintedW = cssW;
    side.paintedK = k;
    // 位图就绪后重绘该页批注（矩形是归一化坐标，与缩放无关）
    if (pane?._pdf && window.PdfAnnot) {
      const idx = pane._pdf.metas.findIndex((m) => m.sides.includes(side));
      if (idx >= 0) window.PdfAnnot.paintPage(pane, idx);
    }
  }

  /* 重新渲染当前可见页（缩放 / DPR 变化后调用） */
  function repaintVisible(pane) {
    const pdf = pane?._pdf;
    if (!pdf) return;
    const rect = pane.getBoundingClientRect();
    for (const meta of pdf.metas) {
      for (const side of meta.sides) {
        if (!side.div) continue;
        const r = side.div.getBoundingClientRect();
        const visible = r.bottom > rect.top - 800 && r.top < rect.bottom + 800;
        if (visible) {
          side.rendered = true;
          side.renderTask?.cancel?.();
          paint(side, pane).catch(() => { side.rendered = false; });
        } else {
          // 不可见的页：清掉位图，按新尺寸重画占位，滚动回来时再渲染
          side.rendered = false;
          side.renderTask?.cancel?.();
          side.textLayer?.cancel?.();
          if (side.canvas) { side.canvas.width = 0; side.canvas.height = 0; }
          if (side.textDiv) side.textDiv.innerHTML = "";
          if (side.div) {
            side.div.style.width = "100%";
            side.div.style.height = "auto";
          }
        }
      }
    }
    applySizes(pane);
  }

  /* 容器尺寸变化：重排 + 重绘可见页（防抖） */
  function watchResize(pane) {
    const pdf = pane._pdf;
    if (!pdf) return;
    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (pane._pdf !== pdf) return; // 已被重新挂载
        const before = pdf.appliedW;
        applySizes(pane);
        if (Math.abs((pdf.appliedW || 0) - (before || 0)) >= 1) repaintVisible(pane);
      });
    };
    try {
      pdf.resizeObs = new ResizeObserver(schedule);
      pdf.resizeObs.observe(pane);
    } catch {}
    // DPR 变化（窗口拖到另一块屏）：device-pixel-content-box 仅 Chromium 支持
    if ("ResizeObserver" in window) {
      try {
        pdf.dprObs = new ResizeObserver(() => repaintVisible(pane));
        pdf.dprObs.observe(pane, { box: "device-pixel-content-box" });
      } catch {}
    }
  }

  /* ---------------- 挂载 ---------------- */

  /* 读取首页的版式信息：宽高比 + 物理页宽（pt）。
     页宽用于把「100% 缩放」定义成页面本身大小 —— compare 版的页宽是单页的两倍，
     不能假定 612pt。 */
  async function readFirstMeta(doc) {
    try {
      const first = await doc.getPage(1);
      const vp = first.getViewport({ scale: 1 });
      const meta = { ratio: vp.height / vp.width, pageW: vp.width };
      first.cleanup?.();
      return meta;
    } catch {
      return { ratio: 1.294, pageW: BASE_W };
    }
  }

  /* 单文档挂载（原文 / 译文 / 并排对照）：只记录页索引，页对象进入视口后才请求 */
  async function mount(pane, url, opts = {}) {
    clearPages(pane);
    const lib = await ensurePdfjs();
    const doc = await lib.getDocument(docParams(url)).promise;
    const { ratio: pageRatio, pageW } = await readFirstMeta(doc);

    const metas = [];
    for (let i = 0; i < doc.numPages; i++) {
      metas.push({
        sides: [{
          doc, pageIndex: i, page: null, w: 1, h: pageRatio, ratio: pageRatio, lang: "en",
          div: null, canvas: null, textDiv: null, textLayer: null,
          rendered: false, renderTask: null,
        }],
        div: null,
      });
    }

    pane._pdf = {
      doc, metas, perRow: 1, io: null,
      fit: opts.fit || "width",       // width | page | manual
      zoom: opts.zoom || 1,
      pageRatio, pageW,
    };
    buildRows(pane);
    observe(pane);
    watchResize(pane);
    return doc.numPages;
  }

  /* 双语对照挂载：原文 + 译文两份文档并排 */
  async function mountBilingual(pane, enUrl, zhUrl, opts = {}) {
    clearPages(pane);
    const lib = await ensurePdfjs();
    const [enDoc, zhDoc] = await Promise.all([
      lib.getDocument(docParams(enUrl)).promise,
      lib.getDocument(docParams(zhUrl)).promise.catch(() => null),
    ]);
    const { ratio: pageRatio, pageW } = await readFirstMeta(enDoc);

    const n = Math.max(enDoc.numPages, zhDoc?.numPages || 0);
    const metas = [];
    for (let i = 0; i < n; i++) {
      const sides = [];
      for (const [doc, lang] of [[enDoc, "en"], [zhDoc, "zh"]]) {
        if (!doc || i >= doc.numPages) {
          sides.push({
            doc: null, pageIndex: null, page: null, w: 612, h: 792, ratio: pageRatio, lang,
            div: null, canvas: null, textDiv: null, textLayer: null,
            rendered: true, renderTask: null,
          });
          continue;
        }
        sides.push({
          doc, pageIndex: i, page: null, w: 1, h: pageRatio, ratio: pageRatio, lang,
          div: null, canvas: null, textDiv: null, textLayer: null,
          rendered: false, renderTask: null,
        });
      }
      metas.push({ sides, div: null });
    }

    pane._pdf = {
      doc: null, metas, perRow: 2, gap: 16, io: null,
      fit: opts.fit || "page",
      zoom: opts.zoom || 1,
      pageRatio, pageW, bilingual: true,
      docs: [enDoc, zhDoc].filter(Boolean),
    };
    buildRows(pane);
    observe(pane);
    watchResize(pane);
    return metas.length;
  }

  /* ---------------- 对外控制 ---------------- */

  function setFit(pane, fit) {
    const pdf = pane?._pdf;
    if (!pdf) return;
    pdf.fit = fit;
    repaintVisible(pane);
  }

  function setZoom(pane, zoom) {
    const pdf = pane?._pdf;
    if (!pdf) return;
    pdf.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
    // 手动缩放即退出自动适配
    if (pdf.fit !== "manual") pdf.fit = "manual";
    applySizes(pane);
    repaintVisible(pane);
  }

  function layout(pane) {
    const pdf = pane?._pdf;
    if (!pdf) return;
    applySizes(pane);
  }

  return { mount, mountBilingual, setZoom, setFit, layout, MIN_ZOOM, MAX_ZOOM };
})();
