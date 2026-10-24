/* PDF.js 阅读视图：整页预览 + 可见区域高精度重绘，有限并发和位图预算。
 * 文档/加载任务/观察器属于一次挂载；页面、文本层和批注使用同一 viewport。
 * 离开视口释放资源，保留占位尺寸与实际页型。 */
"use strict";

window.PdfView = (() => {
  let pdfjsLib = null;
  const BASE_W = 612;
  const TARGET_RENDER_SCALE = 2;
  const MAX_RENDER_SCALE = 3;
  const MAX_AREA_PX = 8e6;
  const MAX_BASE_PIXELS = 24e6;
  const MAX_DETAIL_PIXELS = 32e6;
  const MAX_TOTAL_PIXELS = 48e6;
  const MAX_CONCURRENT = 2;
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 4;
  const VENDOR = new URL("vendor/pdfjs/", document.baseURI).href;
  const frame = (fn) => window.requestAnimationFrame ? window.requestAnimationFrame(fn) : setTimeout(fn, 0);
  const cancelFrame = (id) => window.cancelAnimationFrame ? window.cancelAnimationFrame(id) : clearTimeout(id);
  const dprNow = () => Math.min(4, Math.max(1, Number(window.devicePixelRatio) || 1));
  const cancelled = () => Object.assign(new Error("PDF 加载已取消"), { name: "AbortException" });
  const ignore = (job) => Promise.resolve(job).catch(() => {});

  async function ensurePdfjs() {
    if (pdfjsLib) return pdfjsLib;
    pdfjsLib = await import(VENDOR + "pdf.min.js");
    pdfjsLib.GlobalWorkerOptions.workerSrc = VENDOR + "pdf.worker.min.js";
    return pdfjsLib;
  }
  function docParams(url) {
    return { url, cMapUrl: VENDOR + "cmaps/", cMapPacked: true,
      standardFontDataUrl: VENDOR + "standard_fonts/" };
  }
  function padding(pane) {
    const style = window.getComputedStyle?.(pane);
    return style ? { x: (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0),
      y: (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0) } : { x: 88, y: 96 };
  }
  function targetWidth(box, pdf, side) {
    const slot = Math.max(1, (box.width - box.pad.x - (pdf.perRow - 1) * pdf.gap) / pdf.perRow);
    if (pdf.fit === "width") return slot;
    if (pdf.fit === "page") return Math.min(slot, Math.max(1, box.height - box.pad.y) / side.ratio);
    return side.w * pdf.zoom;
  }
  // 整页预览受面积预算限制；不足的采样由可见区域重绘补足。
  function pixelAligned(cssW, ratio, pageW = BASE_W) {
    const dpr = dprNow();
    const aligned = Math.max(1 / dpr, Math.round(cssW * dpr) / dpr);
    const want = TARGET_RENDER_SCALE / Math.max(aligned / pageW, 1e-6);
    const k = Math.min(MAX_RENDER_SCALE, Math.max(dpr, want),
      Math.sqrt(MAX_AREA_PX / Math.max(1, aligned * Math.ceil(aligned * ratio))));
    return { cssW: aligned, k, dpr };
  }
  function allSides(pdf) { return pdf.metas.flatMap((meta) => meta.sides); }
  function active(pane, pdf) { return !pdf.dead && pane._pdf === pdf; }
  function destroyEntry(entry) {
    if (entry.destroyed) return;
    if (entry.task.destroy) {
      entry.destroyed = true;
      return ignore(entry.task.destroy());
    }
    if (entry.doc) {
      entry.destroyed = true;
      return ignore(entry.doc.destroy?.());
    }
  }
  function invalidate(side) {
    side.revision++;
    side.rendered = false;
    side.paintedKey = null;
    if (side.textDiv) side.textDiv.style.visibility = "hidden";
    side.renderTask?.cancel?.();
    side.textLayer?.cancel?.();
    side.detailTask?.cancel?.();
    side.detailWanted = null;
    dropDetail(side);
    side.failedKey = null;
  }
  function release(side) {
    // cancel() 异步生效，等绘制退出后再改 canvas 或清理 PageProxy。
    if (side.running) return;
    if (side.canvas) { side.canvas.width = 0; side.canvas.height = 0; }
    if (side.textDiv) side.textDiv.innerHTML = "";
    side.textLayer = null;
    side.paintedKey = null;
    side.rendered = false;
    side.page?.cleanup?.();
    side.page = null;
    dropDetail(side);
  }
  function dropDetail(side) {
    const canvas = side.detailCanvas;
    if (canvas) { canvas.width = canvas.height = 0; canvas.remove(); }
    side.detailCanvas = null;
    side.detailPaintedKey = null;
  }
  function dispose(pane) {
    const pdf = pane?._pdf;
    if (!pdf) return Promise.resolve();
    pdf.dead = true;
    pane._pdf = null;
    pdf.io?.disconnect();
    pdf.resizeObs?.disconnect();
    pdf.dprQuery?.removeEventListener("change", pdf.onDpr);
    window.removeEventListener?.("resize", pdf.onResize);
    pane.removeEventListener?.("scroll", pdf.onScroll);
    cancelFrame(pdf.resizeRaf);
    cancelFrame(pdf.scrollRaf);
    clearInterval(pdf.dprTimer);
    pdf.queue.clear();
    for (const side of allSides(pdf)) {
      side.dead = true;
      invalidate(side);
      side.errorEl?.remove();
      release(side);
    }
    pane.querySelectorAll(".pdf-row").forEach((el) => el.remove());
    return Promise.allSettled(pdf.entries.map(destroyEntry));
  }
  /* 页内坐标代替整篇文档的滚动像素。viewportX 是视口比例，收窄面板
     后仍能以新的视口中心保持阅读内容；viewportY 保留鼠标/顶边位置。 */
  function captureAnchor(pane, point) {
    const pdf = pane?._pdf;
    if (!pdf?.metas.length) return null;
    const rect = pane.getBoundingClientRect();
    const px = point?.x ?? rect.left + pane.clientWidth / 2;
    const py = point?.y ?? rect.top + Math.min(24, (pane.clientHeight || 600) / 2);
    let best = null, distance = Infinity;
    // 行按文档顺序排列；只二分查找目标行及相邻行，长文滚动不遍历所有 DOM。
    let low = 0, high = pdf.metas.length - 1;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (pdf.metas[mid].div.getBoundingClientRect().bottom < py) low = mid + 1;
      else high = mid;
    }
    for (const page of [low - 1, low, low + 1]) {
      const meta = pdf.metas[page];
      if (!meta) continue;
      meta.sides.forEach((side, column) => {
      const r = side.div?.getBoundingClientRect();
      if (!r?.width || !r.height) return;
      const dy = Math.max(r.top - py, 0, py - r.bottom);
      const dx = Math.max(r.left - px, 0, px - r.right);
      const score = dy * 10000 + dx;
      if (score < distance) {
        distance = score;
        const x = Math.max(0, Math.min(1, (px - r.left) / r.width));
        const y = Math.max(0, Math.min(1, (py - r.top) / r.height));
        // 页间空隙是固定像素，不能把它作为负的页内比例随缩放放大。
        best = { page, column, x, y,
          viewportX: (r.left + x * r.width - rect.left) / Math.max(1, pane.clientWidth),
          viewportY: r.top + y * r.height - rect.top };
      }
      });
    }
    return best;
  }
  function restoreAnchor(pane, anchor) {
    const pdf = pane?._pdf;
    const side = pdf?.metas[anchor?.page]?.sides[anchor.column || 0];
    if (!side?.div) return false;
    const rect = pane.getBoundingClientRect(), r = side.div.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    pane.scrollLeft += r.left + anchor.x * r.width - rect.left - anchor.viewportX * pane.clientWidth;
    pane.scrollTop += r.top + anchor.y * r.height - rect.top - anchor.viewportY;
    pdf.anchor = captureAnchor(pane);
    return true;
  }
  function applySizes(pane, pdf) {
    // 一次读取容器几何，再批量写样式，避免逐页读写交错引起反复布局。
    const box = { width: pane.clientWidth, height: pane.clientHeight || 600, pad: padding(pane) };
    for (const side of allSides(pdf)) {
      const { cssW } = pixelAligned(targetWidth(box, pdf, side), side.ratio, side.w);
      const cssH = Math.round(cssW * side.ratio);
      const key = `${cssW}:${cssH}:${dprNow()}`;
      if (key !== side.key) { invalidate(side); side.key = key; }
      side.cssW = cssW;
      side.cssH = cssH;
      side.div.style.width = cssW + "px";
      side.div.style.height = cssH + "px";
    }
  }
  function layout(pane, anchor) {
    const pdf = pane?._pdf;
    if (!pdf || pdf.dead) return;
    anchor ??= captureAnchor(pane);
    applySizes(pane, pdf);
    if (anchor) restoreAnchor(pane, anchor);
    pdf.anchor = captureAnchor(pane);
    requestNearby(pane, pdf);
  }
  function buildRows(pane, pdf) {
    const flow = pane.querySelector(".pdf-flow") || (() => {
      const el = document.createElement("div");
      el.className = "pdf-flow";
      pane.appendChild(el);
      return el;
    })();
    pdf.metas.forEach((meta, pageIndex) => {
      const row = document.createElement("div");
      row.className = "pdf-row";
      meta.sides.forEach((side) => {
        side.rowIndex = pageIndex;
        side.div = document.createElement("div");
        side.div.className = "pdf-page";
        if (pdf.perRow > 1) {
          const tag = document.createElement("span");
          tag.className = "pdf-tag";
          tag.textContent = side.lang === "zh" ? "译文" : "原文";
          side.div.appendChild(tag);
        }
        side.canvas = document.createElement("canvas");
        side.canvas.width = side.canvas.height = 0;
        side.div.appendChild(side.canvas);
        side.textDiv = document.createElement("div");
        side.textDiv.className = "textLayer";
        side.div.appendChild(side.textDiv);
        side.div.insertAdjacentHTML("beforeend", '<div class="pdf-annot"></div>');
        row.appendChild(side.div);
        pdf.byElement.set(side.div, side);
      });
      meta.div = row;
      flow.appendChild(row);
    });
    applySizes(pane, pdf);
    pdf.anchor = captureAnchor(pane);
  }
  async function ensurePage(side) {
    if (side.page || !side.doc) return false;
    side.pagePromise ??= side.doc.getPage(side.pageIndex + 1);
    let page;
    try { page = await side.pagePromise; } finally { side.pagePromise = null; }
    if (side.dead || !side.near) { page.cleanup?.(); return false; }
    const vp = page.getViewport({ scale: 1 });
    const changed = side.w !== vp.width || side.h !== vp.height;
    side.page = page;
    side.w = vp.width;
    side.h = vp.height;
    side.ratio = vp.height / vp.width;
    return changed;
  }
  function distance(pane, side) {
    const p = pane.getBoundingClientRect(), r = side.div.getBoundingClientRect();
    return Math.max(p.top - r.bottom, 0, r.top - p.bottom);
  }
  function bitmapPixels(canvas) { return canvas ? canvas.width * canvas.height : 0; }
  function rasterPixels(side) {
    return bitmapPixels(side.canvas) + bitmapPixels(side.detailCanvas) + bitmapPixels(side.detailPending);
  }
  function reserve(pane, pdf, side, pixels, replaceBase = true) {
    const sides = allSides(pdf);
    let used = sides.reduce((n, s) => n + rasterPixels(s), 0) - (replaceBase ? bitmapPixels(side.canvas) : 0);
    let baseUsed = sides.reduce((n, s) => n + (s === side && replaceBase ? 0 : bitmapPixels(s.canvas)), 0);
    const fits = () => used + pixels <= MAX_TOTAL_PIXELS && (!replaceBase || baseUsed + pixels <= MAX_BASE_PIXELS);
    const candidates = sides.filter(s => s !== side && !s.running && s.canvas.width && distance(pane, s) > 0)
      .sort((a, b) => distance(pane, b) - distance(pane, a));
    for (const cached of candidates) {
      if (fits()) break;
      used -= rasterPixels(cached);
      baseUsed -= bitmapPixels(cached.canvas);
      release(cached);
    }
    // 通常保留旧的清晰区域直到新区域就绪；预算不够时先释放旧区域。
    if (!fits() && !replaceBase && side.detailCanvas) {
      used -= bitmapPixels(side.detailCanvas);
      dropDetail(side);
    }
    return fits();
  }
  function updateDetailArea(pane, side) {
    let area = null;
    const r = side.div.getBoundingClientRect(), p = pane.getBoundingClientRect();
    const left = p.left + (pane.clientLeft || 0), top = p.top + (pane.clientTop || 0);
    const x0 = Math.max(0, left - r.left), y0 = Math.max(0, top - r.top);
    const x1 = Math.min(side.cssW, left + pane.clientWidth - r.left);
    const y1 = Math.min(side.cssH, top + pane.clientHeight - r.top);
    const width = x1 - x0, height = y1 - y0;
    const preferred = Math.max(2, dprNow());
    const base = pixelAligned(side.cssW, side.ratio, side.w).k;
    if (width > 0 && height > 0 && base < preferred * .98) {
      // 对照页再宽也只绘制可见区域。常见屏幕保持至少 DPR 的采样；
      // 超大视口仍受单区域预算保护，避免无限制创建巨型 canvas。
      const limit = MAX_DETAIL_PIXELS - 65536;
      const k = Math.min(preferred, Math.sqrt(limit / (width * height)));
      const previous = side.detailWanted;
      if (previous?.baseKey === side.key && previous.k === k && previous.x <= x0 && previous.y <= y0 &&
          previous.x + previous.width >= x1 && previous.y + previous.height >= y1) return;
      const margin = Math.max(0, Math.min(128,
        (Math.sqrt((width - height) ** 2 + 4 * limit / (k * k)) - width - height) / 4));
      const dx = Math.floor(Math.max(0, x0 - margin) * k);
      const dy = Math.floor(Math.max(0, y0 - margin) * k);
      const dw = Math.ceil(Math.min(side.cssW, x1 + margin) * k) - dx;
      const dh = Math.ceil(Math.min(side.cssH, y1 + margin) * k) - dy;
      area = { baseKey: side.key, k, dx, dy, dw, dh, x: dx / k, y: dy / k,
        width: dw / k, height: dh / k, key: `${side.key}:${k}:${dx}:${dy}:${dw}:${dh}` };
    }
    if (area?.key === side.detailWanted?.key) return;
    side.detailWanted = area;
    side.detailTask?.cancel?.();
    if (side.running) side.detailDirty = true;
    if (!area) dropDetail(side);
  }
  function needsPaint(side) {
    return side.paintedKey !== side.key || (side.detailWanted && side.detailPaintedKey !== side.detailWanted.key);
  }
  function requestPaint(pane, pdf, side, dispatch = true) {
    if (!active(pane, pdf) || !side.doc || !side.near) return;
    updateDetailArea(pane, side);
    if (side.running || !needsPaint(side) || side.failedKey === side.key) return;
    pdf.queue.add(side);
    if (dispatch) pump(pane, pdf);
  }
  function requestNearby(pane, pdf) {
    for (const side of pdf.near) requestPaint(pane, pdf, side, false);
    pump(pane, pdf);
  }
  function pump(pane, pdf) {
    if (!active(pane, pdf)) return;
    while (pdf.running < MAX_CONCURRENT && pdf.queue.size) {
      const side = [...pdf.queue].sort((a, b) => distance(pane, a) - distance(pane, b))[0];
      pdf.queue.delete(side);
      if (!side.near || side.running || !needsPaint(side)) continue;
      side.running = true;
      pdf.running++;
      paint(pane, pdf, side).catch((err) => {
        if (!active(pane, pdf) || !side.near || err?.name === "RenderingCancelledException" || err?.name === "AbortException") return;
        side.failedKey = side.key;
        console.error("PDF 页面渲染失败:", err);
        side.errorEl?.remove();
        const retry = document.createElement("button");
        retry.className = "pdf-page-error";
        retry.textContent = "此页加载失败，点击重试";
        retry.addEventListener("click", () => {
          side.failedKey = null;
          retry.remove();
          requestPaint(pane, pdf, side);
        });
        side.div.appendChild(retry);
        side.errorEl = retry;
      }).finally(() => {
        side.running = false;
        pdf.running--;
        if (side.dead || !side.near) release(side);
        // 过期绘制只重试最新尺寸；预算不足时等滚动/布局，避免空转。
        else if (side.obsolete || side.detailDirty) {
          side.obsolete = side.detailDirty = false;
          requestPaint(pane, pdf, side);
        }
        pump(pane, pdf);
      });
    }
  }
  async function paint(pane, pdf, side) {
    const changed = await ensurePage(side);
    if (!active(pane, pdf) || !side.page || !side.near) return;
    if (changed) layout(pane, captureAnchor(pane));
    const revision = side.revision, key = side.key;
    const current = () => active(pane, pdf) && side.near && side.revision === revision;
    if (side.paintedKey === key) {
      try { await paintDetail(pane, pdf, side, current); }
      finally { side.obsolete = active(pane, pdf) && side.near && side.revision !== revision; }
      return;
    }
    const { k } = pixelAligned(side.cssW, side.ratio, side.w);
    const width = Math.max(1, Math.floor(side.cssW * k));
    const height = Math.max(1, Math.floor(side.cssH * k));
    if (!reserve(pane, pdf, side, width * height)) return;
    side.errorEl?.remove();
    side.canvas.width = width;
    side.canvas.height = height;
    const cssScale = side.cssW / side.w;
    const vp = side.page.getViewport({ scale: cssScale });
    const task = side.page.render({ canvasContext: side.canvas.getContext("2d", { alpha: false }),
      viewport: vp, transform: [width / vp.width, 0, 0, height / vp.height, 0, 0] });
    side.renderTask = task;
    try {
      await task.promise;
      if (!current()) return;
      const lib = await ensurePdfjs();
      if (!current()) return;
      side.textDiv.innerHTML = "";
      side.textDiv.style.setProperty("--total-scale-factor", String(cssScale));
      const text = new lib.TextLayer({ textContentSource: side.page.streamTextContent(),
        container: side.textDiv, viewport: vp });
      side.textLayer = text;
      await text.render();
      if (!current()) return;
      side.paintedKey = key;
      side.paintedW = side.cssW;
      side.paintedK = k;
      side.rendered = true;
      side.textDiv.style.visibility = "";
      window.PdfAnnot?.paintPage(pane, side.rowIndex);
      await paintDetail(pane, pdf, side, current);
    } catch (err) {
      if (current()) throw err;
    } finally {
      side.obsolete = active(pane, pdf) && side.near && side.revision !== revision;
      if (side.renderTask === task) side.renderTask = null;
    }
  }
  async function paintDetail(pane, pdf, side, current) {
    updateDetailArea(pane, side);
    side.detailDirty = false;
    const area = side.detailWanted;
    if (!area || !current() || side.detailPaintedKey === area.key) return;
    if (!reserve(pane, pdf, side, area.dw * area.dh, false)) return;
    const canvas = document.createElement("canvas");
    canvas.className = "pdf-detail-canvas";
    canvas.width = area.dw;
    canvas.height = area.dh;
    Object.assign(canvas.style, { left: area.x + "px", top: area.y + "px",
      width: area.width + "px", height: area.height + "px", visibility: "hidden" });
    canvas.setAttribute?.("aria-hidden", "true");
    side.div.appendChild(canvas);
    side.detailPending = canvas;
    let task;
    try {
      task = side.page.render({ canvasContext: canvas.getContext("2d", { alpha: false }),
        viewport: side.page.getViewport({ scale: side.cssW / side.w }),
        transform: [area.k, 0, 0, area.k, -area.dx, -area.dy] });
      side.detailTask = task;
      await task.promise;
      if (!current() || side.detailWanted?.key !== area.key) return;
      dropDetail(side);
      side.detailCanvas = canvas;
      side.detailPaintedKey = area.key;
      side.detailK = area.k;
      canvas.style.visibility = "";
    } catch (err) {
      if (current() && side.detailWanted?.key === area.key) throw err;
    } finally {
      if (side.detailCanvas !== canvas) { canvas.width = canvas.height = 0; canvas.remove(); }
      if (side.detailTask === task) side.detailTask = null;
      side.detailPending = null;
      side.detailDirty = current() && side.detailWanted?.key !== area.key;
    }
  }
  function observe(pane, pdf) {
    pdf.io = new IntersectionObserver((entries) => {
      if (!active(pane, pdf)) return;
      // 先释放离开的页，再排队，避免先入后出导致预算误判。
      for (const entry of entries) {
        const side = pdf.byElement.get(entry.target);
        if (!side?.doc) continue;
        side.near = entry.isIntersecting;
        if (side.near) pdf.near.add(side);
        else {
          pdf.near.delete(side);
          pdf.queue.delete(side);
          invalidate(side);
          release(side);
        }
      }
      requestNearby(pane, pdf);
    }, { root: pane, rootMargin: "800px 0px" });
    for (const side of allSides(pdf)) pdf.io.observe(side.div);
    pdf.onScroll = () => {
      pdf.anchor = captureAnchor(pane);
      cancelFrame(pdf.scrollRaf);
      pdf.scrollRaf = frame(() => {
        if (!active(pane, pdf)) return;
        pdf.anchor = captureAnchor(pane);
        requestNearby(pane, pdf);
      });
    };
    pane.addEventListener?.("scroll", pdf.onScroll, { passive: true });
  }
  function watchResize(pane, pdf) {
    let last = `${pane.clientWidth}:${pane.clientHeight}:${dprNow()}`;
    pdf.onResize = () => {
      cancelFrame(pdf.resizeRaf);
      pdf.resizeRaf = frame(() => {
        if (!active(pane, pdf)) return;
        const key = `${pane.clientWidth}:${pane.clientHeight}:${dprNow()}`;
        if (key === last) return;
        last = key;
        layout(pane, pdf.anchor);
      });
    };
    if (typeof ResizeObserver !== "undefined") {
      pdf.resizeObs = new ResizeObserver(pdf.onResize);
      try { pdf.resizeObs.observe(pane, { box: "device-pixel-content-box" }); }
      catch { pdf.resizeObs.observe(pane); }
    }
    let lastDpr = dprNow();
    pdf.onDpr = () => { lastDpr = dprNow(); pdf.onResize(); watchDpr(); };
    function watchDpr() {
      pdf.dprQuery?.removeEventListener("change", pdf.onDpr);
      pdf.dprQuery = window.matchMedia?.(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      pdf.dprQuery?.addEventListener("change", pdf.onDpr);
    }
    watchDpr();
    // Chromium 某些显示切换只更新 DPR 而不派发尺寸/媒体查询事件。
    // 兜底只比较一个数字；有变化才排版，销毁视图时停止。
    pdf.dprTimer = setInterval(() => { if (dprNow() !== lastDpr) pdf.onDpr(); }, 500);
    pdf.dprTimer.unref?.();
    window.addEventListener?.("resize", pdf.onResize);
  }
  async function loadDocument(pane, pdf, lib, url) {
    if (!active(pane, pdf)) throw cancelled();
    const entry = { task: lib.getDocument(docParams(url)), doc: null, destroyed: false };
    pdf.entries.push(entry);
    const doc = await entry.task.promise;
    entry.doc = doc;
    if (!active(pane, pdf)) { destroyEntry(entry); throw cancelled(); }
    pdf.docs.push(doc);
    return doc;
  }
  async function mountDocuments(pane, urls, opts, bilingual) {
    dispose(pane);
    const pdf = { dead: false, entries: [], docs: [], doc: null, metas: [], perRow: bilingual ? 2 : 1,
      gap: 20, queue: new Set(), near: new Set(), byElement: new Map(), running: 0,
      fit: opts.fit || (bilingual ? "page" : "width"), zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, opts.zoom || 1)), bilingual };
    pane._pdf = pdf;
    try {
      const lib = await ensurePdfjs();
      const docs = await Promise.all(urls.map(url => loadDocument(pane, pdf, lib, url)));
      const first = await docs[0].getPage(1);
      const vp = first.getViewport({ scale: 1 });
      first.cleanup?.();
      if (!active(pane, pdf)) throw cancelled();
      pdf.doc = bilingual ? null : docs[0];
      pdf.pageRatio = vp.height / vp.width;
      pdf.pageW = vp.width;
      const n = Math.max(...docs.map(doc => doc.numPages));
      pdf.metas = Array.from({ length: n }, (_, i) => ({ sides: docs.map((doc, column) => ({
        doc: i < doc.numPages ? doc : null, pageIndex: i, page: null, w: vp.width, h: vp.height,
        ratio: pdf.pageRatio, lang: column ? "zh" : "en", revision: 0, rendered: false, near: false,
      })) }));
      buildRows(pane, pdf);
      observe(pane, pdf);
      watchResize(pane, pdf);
      return n;
    } catch (err) {
      if (active(pane, pdf)) dispose(pane);
      throw err;
    }
  }
  function mount(pane, url, opts = {}) { return mountDocuments(pane, [url], opts, false); }
  function mountBilingual(pane, enUrl, zhUrl, opts = {}) { return mountDocuments(pane, [enUrl, zhUrl], opts, true); }
  function setFit(pane, fit) {
    if (!pane?._pdf || !["width", "page"].includes(fit)) return;
    const anchor = captureAnchor(pane);
    pane._pdf.fit = fit;
    layout(pane, anchor);
  }
  function setZoom(pane, zoom, point) {
    if (!pane?._pdf || !Number.isFinite(zoom)) return;
    const anchor = captureAnchor(pane, point);
    pane._pdf.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
    pane._pdf.fit = "manual";
    layout(pane, anchor);
  }
  function effectiveZoom(pane) {
    const pdf = pane?._pdf;
    const side = pdf?.metas[pdf.anchor?.page || 0]?.sides[0];
    return side ? side.cssW / side.w : pdf?.zoom || 1;
  }
  return { mount, mountBilingual, dispose, setZoom, setFit, layout, captureAnchor, restoreAnchor,
    effectiveZoom, MIN_ZOOM, MAX_ZOOM };
})();
