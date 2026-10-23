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
  /* 高亮配色。
     关键：fill 用**不透明**纯色，透明度统一由 .pdf-annot 层的 opacity 控制。
     若每个色块自己带 alpha，重叠区域会按 1-(1-α)ⁿ 累积加深（两层 0.38 → 0.62），
     用户看到的就是「重复高亮颜色变深」。改成整层统一 opacity 后，
     重叠区仍是同一透明度，视觉上没有叠加加深。
     stroke 用于下划线，保持不透明即可。 */
  const HIGHLIGHT_OPACITY = 0.38;
  const COLORS = {
    yellow: { fill: "#ffd640", stroke: "#c69400" },
    green: { fill: "#78c878", stroke: "#3a8c3a" },
    blue: { fill: "#6ea8fe", stroke: "#2e6ac8" },
    pink: { fill: "#ff8abe", stroke: "#c44682" },
    purple: { fill: "#b294ff", stroke: "#704ec8" },
  };

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
    return { pageEl, pageIndex, rects, text };
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
        return dy < Math.max(2, hMin * 0.45) && hMax <= hMin * 1.9;
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

  /* 把「同色高亮」的矩形集合做并集，消除重叠区域。
     为什么需要：即使色块用 opacity 而非 rgba，两个半透明块重叠时仍会合成变深
     （0.38 叠 0.38 ≈ 0.62），用户看到的就是「重复高亮颜色加深」。
     做法：对候选矩形逐条求并集（相交则合并为一个外接矩形），
     并在合并后按「整行切分」避免把中间没选中的空隙也算进高亮。

     这里采用简化但有效的策略：
       1. 先按行（y 接近）分组
       2. 同组内按 x 排序，区间重叠/相邻的合并成一段
       这样同一行被多次高亮时只会画一段，不会叠加。
     跨行的复杂重叠（不同批注选了交叠的多行）在行分组内同样被消解。 */
  function unionByRow(rects) {
    if (rects.length <= 1) return rects;

    // 按纵向中心分行（容差取行高的 45%，与 mergeRects 保持一致）
    const items = rects.map((r) => ({
      x: r.x, y: r.y, w: r.w, h: r.h,
      cy: r.y + r.h / 2,
    })).sort((a, b) => a.cy - b.cy || a.x - b.x);

    const rows = [];
    for (const it of items) {
      const row = rows.find((rw) => {
        const hMin = Math.min(rw.h, it.h);
        const hMax = Math.max(rw.h, it.h);
        return Math.abs(rw.cy - it.cy) < Math.max(0.004, hMin * 0.5) && hMax <= hMin * 1.9;
      });
      if (row) {
        row.items.push(it);
        row.y = Math.min(row.y, it.y);
        row.bottom = Math.max(row.bottom, it.y + it.h);
        row.cy = (row.y + row.bottom) / 2;
        row.h = row.bottom - row.y;
      } else {
        rows.push({ cy: it.cy, y: it.y, bottom: it.y + it.h, h: it.h, items: [it] });
      }
    }

    const out = [];
    for (const row of rows) {
      const segs = row.items
        .map((it) => ({ start: it.x, end: it.x + it.w }))
        .sort((a, b) => a.start - b.start);
      const merged = [];
      for (const s of segs) {
        const cur = merged[merged.length - 1];
        // 重叠或间距极小（< 0.4% 页宽）就合并
        if (cur && s.start <= cur.end + 0.004) {
          cur.end = Math.max(cur.end, s.end);
        } else {
          merged.push({ start: s.start, end: s.end });
        }
      }
      for (const m of merged) {
        out.push({ x: m.start, y: row.y, w: m.end - m.start, h: row.h });
      }
    }
    return out;
  }

  /* 把某一页的批注画到页面的 .pdf-annot 层上。
     核心：高亮分两阶段绘制 —— 先把**同色**的所有高亮矩形合起来做并集，
     再统一画一层；这样无论几条批注重叠，同一位置都只叠一次色，
     不会出现「重复高亮颜色越来越深」。 */
  function paintPage(pane, pageIndex) {
    const pdf = pane?._pdf;
    if (!pdf) return;
    const meta = pdf.metas[pageIndex];
    if (!meta) return;
    const list = storeFor(pane).byPage.get(pageIndex) || [];

    /* 阶段一：把本页的高亮按颜色聚合并做并集。
       colorKey -> { color, rects: [...], owners: Set<annId> } */
    const highlightGroups = new Map();
    for (const ann of list) {
      if (ann.kind !== "highlight") continue;
      const key = ann.color || "yellow";
      if (!highlightGroups.has(key)) highlightGroups.set(key, []);
      highlightGroups.get(key).push(ann);
    }
    // colorKey -> 合并后的矩形列表
    const mergedHighlights = new Map();
    for (const [key, anns] of highlightGroups) {
      const allRects = anns.flatMap((a) => a.rects || []);
      mergedHighlights.set(key, unionByRow(allRects));
    }

    for (const side of meta.sides) {
      const layer = side.div?.querySelector(".pdf-annot");
      if (!layer) continue;
      layer.innerHTML = "";

      /* 阶段二：先画高亮（已经按颜色合并过，重叠不会再叠加） */
      for (const [key, rects] of mergedHighlights) {
        const color = COLORS[key] || COLORS.yellow;
        const anns = highlightGroups.get(key) || [];
        const selected = anns.some((a) => storeFor(pane).selected === a.id);
        for (const r of rects) {
          const d = document.createElement("div");
          d.className = "annot-rect annot-highlight";
          // 合并后的矩形可能来自多条批注，用第一条作为代表（删除/选中按组处理）
          d.dataset.annotId = anns[0]?.id || "";
          d.dataset.annotIds = anns.map((a) => a.id).join(",");
          d.style.left = `${r.x * 100}%`;
          d.style.top = `${r.y * 100}%`;
          d.style.width = `${r.w * 100}%`;
          d.style.height = `${r.h * 100}%`;
          d.style.background = color.fill;
          if (selected) d.classList.add("is-selected");
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
          mark.style.left = `${(spot.x + spot.w) * 100}%`;
          mark.style.top = `${spot.y * 100}%`;
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
        const rects = ann.rects || [];
        if (!rects.length) continue;
        const last = rects.reduce((a, b) => (b.y > a.y || (b.y === a.y && b.x > a.x) ? b : a), rects[0]);
        const del = document.createElement("button");
        del.className = "annot-del-float";
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
      const idx = (a.page || 1) - 1;
      if (!st.byPage.has(idx)) st.byPage.set(idx, []);
      st.byPage.get(idx).push(a);
    }
    repaint(pane);
  }

  function add(pane, ann) {
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

  return {
    COLORS, selectionToRects, paintPage, repaint,
    setAll, add, remove, update, get, all, select,
  };
})();
