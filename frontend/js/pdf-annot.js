/* ============================================================
 * 文枢 · PDF 批注层
 *
 * 职责：
 *   1. 收集 PDF 文本层中用户选中的文本 → 归一化矩形（相对页面宽高）
 *   2. 把批注绘制回页面的 .pdf-annot 层（高亮 / 划线 / 批注标记）
 *   3. 批注的增删改查（数据来自 sidecar）
 *
 * 坐标系：所有矩形都以「页面 CSS 宽/高」为基准归一化到 0..1，
 *        这样缩放、换屏、重渲染后位置都不会漂移。
 * ============================================================ */

"use strict";

window.PdfAnnot = (() => {
  /* Opaque palette values; CSS controls fill opacity after overlaps are removed.
     Selection is drawn separately, so it never darkens an entire color group. */
  const COLORS = {
    yellow: { fill: "#ffd640", stroke: "#c69400" },
    green: { fill: "#78c878", stroke: "#3a8c3a" },
    blue: { fill: "#6ea8fe", stroke: "#2e6ac8" },
    pink: { fill: "#ff8abe", stroke: "#c44682" },
    purple: { fill: "#b294ff", stroke: "#704ec8" },
  };

  function viewFor(pane) {
    return pane?.dataset?.annotationView || ({'pane-en':'en','pane-zh':'zh','pane-dual2':'dual2'}[pane?.id]) || 'en';
  }
  const belongs = (pane, ann) => ann?.view === viewFor(pane);

  /* 在页面容器上记录：pageIndex(0-based) -> [{annotation}] */
  function storeFor(pane) {
    if (!pane._annot) pane._annot = { byPage: new Map(), selected: null };
    return pane._annot;
  }

  /* ---------- 选区 → 归一化矩形 ---------- */

  /* 从当前 window.getSelection() 里提取落在某个 .pdf-page 内的矩形
     返回 { pageEl, pageIndex, rects:[{x,y,w,h}], text } 或 null */
  function selectionToRects() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    const text = sel.toString().trim();
    if (!text) return null;

    const range = sel.getRangeAt(0);
    const pageEl = (range.commonAncestorContainer.nodeType === 1
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement)?.closest?.(".pdf-page");
    if (!pageEl) return null;

    const pageRect = pageEl.getBoundingClientRect();
    if (!pageRect.width || !pageRect.height) return null;

    // 逐行取矩形：直接拿 range 的 client rects 会得到每行的框
    const rawRects = [];
    const rectList = range.getClientRects();
    for (const r of rectList) {
      if (r.width < 1 || r.height < 1) continue;
      rawRects.push(r);
    }
    // 合并同一行（y 接近）的碎片，避免一个字一个矩形
    const merged = mergeRects(rawRects);

    const rects = merged.map((r) => ({
      x: clamp01((r.left - pageRect.left) / pageRect.width),
      y: clamp01((r.top - pageRect.top) / pageRect.height),
      w: clamp01(r.width / pageRect.width),
      h: clamp01(r.height / pageRect.height),
    })).filter((r) => r.w > 0 && r.h > 0);

    if (!rects.length) return null;

    // 页码：页面在 metas 中的下标 + 1
    const pdf = pageEl.parentElement?._pdf || pageEl.closest(".pane")?._pdf;
    let pageIndex = 0;
    if (pdf?.metas) {
      pageIndex = pdf.metas.findIndex((m) => m.sides.some((s) => s.div === pageEl));
      if (pageIndex < 0) pageIndex = 0;
    }
    return { pageEl, pageIndex, rects, text, view: viewFor(pageEl.closest('.pane')) };
  }

  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  /* 把 range.getClientRects() 的输出合并成「每行一个矩形」。
     PDF.js 文本层的同一行常被切成多个 span（按字体/字号/间距分段），
     getClientRects 会给出碎片矩形，需要合成整行；但**不能把不同行误合**。

     判定同一行的依据（按可靠性排序）：
       1. 纵向中心接近（行内碎片垂直中心几乎一致，跨行会明显分开）
       2. 高度相近（同一行字号通常一致，上标/下标除外）
     用「中心线距离 < 行高的 40%」作为主判据，比直接比 top 稳得多：
     行距小时 top 差可能只有几 px，但中心线差仍会接近一个行高。 */
  function mergeRects(rects) {
    if (rects.length <= 1) return rects;

    const items = rects
      .filter((r) => r.width > 0.5 && r.height > 0.5)
      .map((r) => ({
        left: r.left, top: r.top, right: r.left + r.width,
        height: r.height, centerY: r.top + r.height / 2,
      }))
      .sort((a, b) => a.centerY - b.centerY || a.left - b.left);

    const lines = [];
    for (const it of items) {
      // 找已存在的行：中心线足够近，且高度可兼容（允许上下标 1.6 倍差异）
      const hit = lines.find((l) => {
        const dy = Math.abs(l.centerY - it.centerY);
        const hMin = Math.min(l.height, it.height);
        const hMax = Math.max(l.height, it.height);
        const gap = Math.max(0, it.left - l.right, l.left - it.right);
        return dy < Math.max(2, hMin * 0.45) && hMax <= hMin * 1.9 && gap <= Math.max(8, hMin * .75);
      });
      if (hit) {
        hit.left = Math.min(hit.left, it.left);
        hit.right = Math.max(hit.right, it.right);
        hit.top = Math.min(hit.top, it.top);
        hit.bottom = Math.max(hit.bottom, it.top + it.height);
        hit.centerY = (hit.top + hit.bottom) / 2;
        hit.height = hit.bottom - hit.top;
        hit.count += 1;
      } else {
        lines.push({
          left: it.left, right: it.right, top: it.top,
          bottom: it.top + it.height, centerY: it.centerY,
          height: it.height, count: 1,
        });
      }
    }

    return lines
      .sort((a, b) => a.top - b.top)
      .map((l) => ({
        left: l.left, top: l.top,
        width: l.right - l.left, height: Math.max(1, l.bottom - l.top),
      }));
  }

  /* ---------- 绘制 ---------- */

  // Subtract exact rectangles instead of stacking translucent fills. Each visible
  // point has one owner; partial overlaps preserve the older uncovered geometry.
  function subtractRect(r, cover) {
    const x = Math.max(r.x, cover.x), y = Math.max(r.y, cover.y);
    const right = Math.min(r.x + r.w, cover.x + cover.w);
    const bottom = Math.min(r.y + r.h, cover.y + cover.h);
    if (right <= x || bottom <= y) return [r];
    return [
      {x:r.x, y:r.y, w:r.w, h:y-r.y},
      {x:r.x, y:bottom, w:r.w, h:r.y+r.h-bottom},
      {x:r.x, y, w:x-r.x, h:bottom-y},
      {x:right, y, w:r.x+r.w-right, h:bottom-y},
    ].filter(part => part.w > 1e-10 && part.h > 1e-10);
  }

  function paintOrder(list) {
    // API lists are sorted by reading position, not by creation time. Storage
    // order breaks ties in older records whose timestamps only have seconds.
    return list.map((ann, index) => ({ann, index})).sort((a, b) =>
      (a.ann.modified || a.ann.created || '').localeCompare(b.ann.modified || b.ann.created || '') ||
      (a.ann.paint_order ?? a.index) - (b.ann.paint_order ?? b.index)
    ).map(item => item.ann);
  }

  function visibleHighlights(list) {
    let visible = [];
    for (const ann of paintOrder(list)) {
      if (ann.kind !== 'highlight') continue;
      for (const r of ann.rects || []) {
        if (![r.x,r.y,r.w,r.h].every(Number.isFinite) || r.w <= 0 || r.h <= 0) continue;
        visible = visible.flatMap(piece => subtractRect(piece.rect, r).map(rect => ({ann:piece.ann, rect})));
        visible.push({ann, rect:r});
      }
    }
    return visible;
  }

  /* Paint mutually exclusive highlight pieces; later operations own overlaps. */
  function paintPage(pane, pageIndex) {
    const pdf = pane?._pdf;
    if (!pdf) return;
    const meta = pdf.metas[pageIndex];
    if (!meta) return;
    const list = storeFor(pane).byPage.get(pageIndex) || [];

    const highlights = visibleHighlights(list);
    const visibleById = new Map();
    for (const {ann, rect} of highlights) {
      if (!visibleById.has(ann.id)) visibleById.set(ann.id, []);
      visibleById.get(ann.id).push(rect);
    }

    for (const side of meta.sides) {
      const layer = side.div?.querySelector(".pdf-annot");
      if (!layer) continue;
      layer.innerHTML = "";

      for (const {ann, rect:r} of highlights) {
        const d = document.createElement("div");
        d.className = "annot-rect annot-highlight";
        d.dataset.annotId = ann.id;
        d.style.left = `${r.x * 100}%`;
        d.style.top = `${r.y * 100}%`;
        d.style.width = `${r.w * 100}%`;
        d.style.height = `${r.h * 100}%`;
        d.style.background = (COLORS[ann.color] || COLORS.yellow).fill;
        layer.appendChild(d);
      }

      // Selection outlines only the visible portion belonging to this annotation.
      const selectedAnnotation = list.find(a => a.id === storeFor(pane).selected);
      if (selectedAnnotation?.kind === "highlight") {
        for (const r of visibleById.get(selectedAnnotation.id) || []) {
          const d = document.createElement("div");
          d.className = "annot-rect annot-selection is-selected";
          d.dataset.annotId = selectedAnnotation.id;
          Object.assign(d.style, { left: `${r.x*100}%`, top: `${r.y*100}%`, width: `${r.w*100}%`, height: `${r.h*100}%` });
          layer.appendChild(d);
        }
      }

      /* 阶段三：划线与批注标记按条绘制（它们不填充面积，重叠不影响观感） */
      for (const ann of list) {
        if (ann.kind === "highlight") continue;
        if (ann.kind === "note") {
          /* 批注（note）：除了页边小标记，还在原文下方自动画一条下划线，
             让用户一眼看出「这段文字被我批注过」。
             颜色统一用批注自身的颜色，与气泡头部色块保持一致。 */
          const noteColor = COLORS[ann.color] || COLORS.yellow;
          for (const r of ann.rects || []) {
            const line = document.createElement("div");
            line.className = "annot-rect annot-note-line";
            line.dataset.annotId = ann.id;
            line.style.left = `${r.x * 100}%`;
            line.style.top = `${r.y * 100}%`;
            line.style.width = `${r.w * 100}%`;
            line.style.height = `${r.h * 100}%`;
            line.style.borderBottom = `2px solid ${noteColor.stroke}`;
            if (storeFor(pane).selected === ann.id) line.classList.add("is-selected");
            layer.appendChild(line);
          }
          const mark = document.createElement("button");
          mark.className = "annot-mark";
          mark.dataset.annotId = ann.id;
          mark.title = ann.comment || "批注";
          const spot = ann.rects?.[0] || { x: 0.96, y: 0.08, w: 0, h: 0 };
          const gap = 16 / Math.max(1, side.div.clientWidth || 600);
          mark.style.left = `${Math.min(.985, spot.x + spot.w + gap) * 100}%`;
          mark.style.top = `${(spot.y + spot.h / 2) * 100}%`;
          mark.textContent = "✎";
          layer.appendChild(mark);
          continue;
        }
        const color = COLORS[ann.color] || COLORS.yellow;
        for (const r of ann.rects || []) {
          const d = document.createElement("div");
          d.className = `annot-rect annot-${ann.kind}`;
          d.dataset.annotId = ann.id;
          d.style.left = `${r.x * 100}%`;
          d.style.top = `${r.y * 100}%`;
          d.style.width = `${r.w * 100}%`;
          d.style.height = `${r.h * 100}%`;
          d.style.borderBottom = `2px solid ${color.stroke}`;
          if (storeFor(pane).selected === ann.id) d.classList.add("is-selected");
          layer.appendChild(d);
        }
      }

      /* 阶段四：每条高亮的悬停删除按钮（挂在最后一行右端） */
      for (const ann of list) {
        if (ann.kind !== "highlight") continue;
        const rects = visibleById.get(ann.id) || [];
        if (!rects.length) continue;
        const last = rects.reduce((a, b) => (b.y > a.y || (b.y === a.y && b.x > a.x) ? b : a), rects[0]);
        const del = document.createElement("button");
        del.className = "annot-del-float";
        if (storeFor(pane).selected === ann.id) del.classList.add("is-selected");
        del.dataset.annotId = ann.id;
        del.title = "删除高亮";
        del.textContent = "×";
        let left = last.x + last.w + 0.008;
        if (left > 0.975) left = Math.max(0.02, last.x + last.w - 0.012);
        del.style.left = `${left * 100}%`;
        del.style.top = `${Math.max(0.012, last.y + last.h / 2) * 100}%`;
        layer.appendChild(del);
      }
      /* 划线的删除按钮 */
      for (const ann of list) {
        if (ann.kind !== "underline") continue;
        const rects = ann.rects || [];
        if (!rects.length) continue;
        const last = rects.reduce((a, b) => (b.y > a.y || (b.y === a.y && b.x > a.x) ? b : a), rects[0]);
        const del = document.createElement("button");
        del.className = "annot-del-float";
        if (storeFor(pane).selected === ann.id) del.classList.add("is-selected");
        del.dataset.annotId = ann.id;
        del.title = "删除划线";
        del.textContent = "×";
        let left = last.x + last.w + 0.008;
        if (left > 0.975) left = Math.max(0.02, last.x + last.w - 0.012);
        del.style.left = `${left * 100}%`;
        del.style.top = `${Math.max(0.012, last.y + last.h / 2) * 100}%`;
        layer.appendChild(del);
      }
    }
  }

  /* 重绘所有已渲染页（滚动/缩放后调用） */
  function repaint(pane) {
    const pdf = pane?._pdf;
    if (!pdf) return;
    for (let i = 0; i < pdf.metas.length; i++) paintPage(pane, i);
  }

  /* ---------- 数据 ---------- */

  function setAll(pane, annotations) {
    const st = storeFor(pane);
    st.byPage.clear();
    for (const a of annotations || []) {
      if (!belongs(pane,a)) continue;
      const idx = (a.page || 1) - 1;
      if (!st.byPage.has(idx)) st.byPage.set(idx, []);
      st.byPage.get(idx).push(a);
    }
    repaint(pane);
  }

  function add(pane, ann) {
    if (!belongs(pane,ann)) return;
    const st = storeFor(pane);
    const idx = (ann.page || 1) - 1;
    if (!st.byPage.has(idx)) st.byPage.set(idx, []);
    st.byPage.get(idx).push(ann);
    paintPage(pane, idx);
  }

  function remove(pane, annId) {
    const st = storeFor(pane);
    for (const [idx, list] of st.byPage) {
      const i = list.findIndex((a) => a.id === annId);
      if (i >= 0) {
        list.splice(i, 1);
        paintPage(pane, idx);
        return true;
      }
    }
    return false;
  }

  function update(pane, ann) {
    if (!belongs(pane,ann)) return false;
    const st = storeFor(pane);
    for (const [idx, list] of st.byPage) {
      const i = list.findIndex((a) => a.id === ann.id);
      if (i >= 0) {
        list[i] = { ...list[i], ...ann };
        paintPage(pane, idx);
        return true;
      }
    }
    return false;
  }

  function get(pane, annId) {
    const st = storeFor(pane);
    for (const list of st.byPage.values()) {
      const hit = list.find((a) => a.id === annId);
      if (hit) return hit;
    }
    return null;
  }

  function all(pane) {
    const st = storeFor(pane);
    return [...st.byPage.values()].flat();
  }

  function select(pane, annId) {
    storeFor(pane).selected = annId;
    repaint(pane);
  }

  function hitTest(pane, pageEl, clientX, clientY) {
    const idx = pane?._pdf?.metas.findIndex(m => m.sides.some(s => s.div === pageEl));
    if (idx == null || idx < 0) return null;
    const box = pageEl.getBoundingClientRect();
    const x = (clientX - box.left) / box.width, y = (clientY - box.top) / box.height;
    return paintOrder(storeFor(pane).byPage.get(idx) || []).reverse().find(a =>
      (a.rects || []).some(r => x >= r.x && x <= r.x+r.w && y >= r.y && y <= r.y+r.h)) || null;
  }

  return {
    COLORS, selectionToRects, paintPage, repaint, hitTest, viewFor,
    setAll, add, remove, update, get, all, select,
  };
})();
