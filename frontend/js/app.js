/* ============================================================
 * 文枢 · 前端原型逻辑（无构建，vanilla JS）
 * 视图：文献库 / 阅读器（双栏对照） / 翻译任务 / 设置
 * ============================================================ */

"use strict";

/* ---------------- 图标（内联 SVG，lucide 风格描边） ---------------- */
const I = (() => {
  const wrap = (d, extra = "") =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" ${extra} aria-hidden="true">${d}</svg>`;
  const icons = {
    book: wrap('<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>'),
    clock: wrap('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    star: wrap('<path d="M12 3l2.8 5.9 6.2.8-4.6 4.4 1.2 6.2L12 17.4 6.4 20.3l1.2-6.2L3 9.7l6.2-.8z"/>'),
    folder: wrap('<path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
    tag: wrap('<path d="M3 11V5a2 2 0 0 1 2-2h6l10 10-8 8L3 11z"/><circle cx="8" cy="8" r="1.4"/>'),
    search: wrap('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'),
    sliders: wrap('<path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M1 14h6"/><path d="M9 8h6"/><path d="M17 16h6"/>'),
    sun: wrap('<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M4.9 4.9l1.4 1.4"/><path d="M17.7 17.7l1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M6.3 17.7l-1.4 1.4"/><path d="M19.1 4.9l-1.4 1.4"/>'),
    moon: wrap('<path d="M12 3a6.4 6.4 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'),
    plus: wrap('<path d="M12 5v14"/><path d="M5 12h14"/>'),
    upload: wrap('<path d="M21 15v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v13"/>'),
    grid: wrap('<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>'),
    list: wrap('<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3.5 6h.01"/><path d="M3.5 12h.01"/><path d="M3.5 18h.01"/>'),
    left: wrap('<path d="M15 18l-6-6 6-6"/>'),
    right: wrap('<path d="M9 6l6 6-6 6"/>'),
    arrowLeft: wrap('<path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>'),
    zoomIn: wrap('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/><path d="M8 11h6"/><path d="M11 8v6"/>'),
    zoomOut: wrap('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/><path d="M8 11h6"/>'),
    columns: wrap('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/>'),
    refresh: wrap('<path d="M21 12a9 9 0 1 1-2.6-6.3"/><path d="M21 3v6h-6"/>'),
    sparkle: wrap('<path d="M12 3l1.9 5.2L19 10l-5.1 1.8L12 17l-1.9-5.2L5 10l5.1-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>'),
    languages: wrap('<path d="M5 8l6 6"/><path d="M4 14l6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/>'),
    x: wrap('<path d="M18 6L6 18"/><path d="M6 6l12 12"/>'),
    check: wrap('<path d="M20 6L9 17l-5-5"/>'),
    alert: wrap('<circle cx="12" cy="12" r="9"/><path d="M12 8v4"/><path d="M12 16h.01"/>'),
    more: wrap('<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'),
    copy: wrap('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
    pencil: wrap('<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>'),
    trash: wrap('<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>'),
    file: wrap('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6"/><path d="M9 17h6"/>'),
    chevD: wrap('<path d="M6 9l6 6 6-6"/>'),
    chevR: wrap('<path d="M9 6l6 6-6 6"/>'),
    sync: wrap('<path d="M21 12a9 9 0 1 1-2.6-6.3"/><path d="M21 3v6h-6"/><path d="M3 12v3"/>'),
    external: wrap('<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14L21 3"/>'),
    play: wrap('<path d="M6 4l14 8-14 8z"/>'),
  };
  return (name, size = 18) =>
    icons[name].replace("<svg ", `<svg width="${size}" height="${size}" `);
})();

/* ---------------- 全局状态 ---------------- */

/* 一篇文献第一次打开阅读器时的默认状态。
   阅读中的可变项会按文献各存一份（readerSessions），这里只是初始模板。 */
const DEFAULT_READER_STATE = Object.freeze({
  mode: "dual2", zoom: 1, fit: "width",
  panel: false, notePanel: false, notePanelWidth: 760,
  webAi: false, webAiWidth: 46,
});

const state = {
  route: { view: "library", id: null },
  filter: { smart: "all", cat: null, search: "", tag: null },
  sort: "added",
  libView: "list",
  settingsTab: "ai",
  reader: { ...DEFAULT_READER_STATE, prompt: "d1", vision: false },
  translating: {},          // paperId -> percent（演示模式）
  liveTasks: [],            // 真实模式：sidecar 任务列表
  pendingFiles: [],         // 导入弹窗中选中的文件
  fulltext: { q: "", map: {} }, // 全文命中：paper_id -> [[..]] 标记的片段
  // 顶部标签页（会话级，按打开顺序）：{ kind: "paper" | "note", paperId }
  // paper = PDF 阅读页；note = 独立笔记标签页（文献库中点击「笔记」打开）
  tabs: [],
  noteTitles: {},           // paperId -> 当前笔记标题（仅用于标签页标题与列表回显）
  notePageWidth: null,      // 整页笔记的纸宽度（null = 用默认适中的宽度）
  expanded: new Set(),      // 列表视图中已展开附件树的文献 id（Zotero 式）
  collapsedCats: new Set(), // 侧栏中已折叠的分类 id（点箭头收起子分类）
  db: JSON.parse(JSON.stringify(window.DB)),
};

/* ---------------- 阅读会话（按文献隔离） ----------------
 * 网页 AI 是「全局单实例」的原生窗口：同一时间只能有一个浏览器窗口被嵌入。
 * 所以会话状态分成两层：
 *   · readerSessions[paperId]：每篇文献自己的阅读状态（模式/缩放/滚动位置/网页 AI
 *     面板开没开、宽度是多少）。它是纯数据，切走再回来据此恢复。
 *   · webAiController.owner：当前那个唯一的原生窗口属于哪篇文献。只有 owner 的
 *     session.webAi 才为 true；切到别的文献时窗口保留但不展示（hidden），
 *     切回来立刻恢复，不会重新 embed/导航。
 * 这样多论文之间不会把某篇的网页 AI 面板「串」到另一篇上。
 */
const readerSessions = new Map();
const DEFAULT_READER_SCROLL = Object.freeze({ en: 0, zh: 0, dual2: 0 });
const readerSession = (paperId) => {
  if (!paperId) return null;
  let s = readerSessions.get(paperId);
  if (!s) {
    s = { ...DEFAULT_READER_STATE, scroll: { ...DEFAULT_READER_SCROLL }, anchors: {} };
    readerSessions.set(paperId, s);
  }
  return s;
};
/* 当前唯一嵌入浏览器窗口的归属文献；null = 没有打开过 */


/* AI 总结流式状态 */
const aiStream = { text: "", meta: null, err: null, streaming: false, ctrl: null };

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const paperById = (id) => state.db.papers.find((p) => p.id === id);
/* 分类名动态查表：live 模式会整体替换 categories，不能用启动时的快照 */
const catName = (id) => state.db.categories.find((c) => c.id === id)?.name ?? "";

const catCount = (id) => {
  // 严格归属：只统计直接属于该分类的文献（子分类单独计数）
  return state.db.papers.filter((p) => (p.cat || "local") === id).length;
};
const allTags = () => {
  const m = {};
  state.db.papers.forEach((p) => p.tags.forEach((t) => (m[t] = (m[t] || 0) + 1)));
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
};

/* ---------------- 通用 UI 片段 ---------------- */
const badge = (p) => {
  const bits = [];
  if (p.translated) bits.push('<span class="pill pill-ok"><i class="dot"></i>已翻译</span>');
  if (p.summarized) bits.push('<span class="pill pill-ai">AI 总结</span>');
  if (p.unread) bits.push('<span class="pill pill-new">未读</span>');
  return bits.join("");
};

const rowActs = (p) => `
  <div class="row-acts ${p.fav ? "has-fav" : ""}">
    <button class="icon-btn sm" data-action="rename-paper" data-id="${p.id}" title="重命名文献">${I("pencil", 15)}</button>
    ${p.cat && p.cat !== "local" ? `<button class="icon-btn sm" data-action="cat-remove" data-id="${p.id}" title="移出当前分类（回到本地文献）">${I("external", 14)}</button>` : ""}
    <button class="icon-btn sm ${p.fav ? "faved" : ""}" data-action="toggle-fav" data-id="${p.id}" title="${p.fav ? "取消收藏" : "收藏"}">${I("star", 15)}</button>
    <button class="icon-btn sm danger" data-action="del-paper" data-id="${p.id}" title="删除">${I("trash", 15)}</button>
  </div>`;

/* ---------- 附件树（Zotero 式：条目可展开，内含原文/译文/笔记） ---------- */

/* 单条附件行：图标 + 名称 + 右侧元信息 + 操作 */
const attachRow = ({ icon, label, meta = "", action = "", id = "", extra = "", cls = "", title = "" }) => `
  <div class="att ${cls}" ${action ? `data-action="${action}" data-id="${id}"` : ""}
       ${title ? `title="${esc(title)}"` : ""} role="treeitem">
    <span class="att-ico">${I(icon, 14)}</span>
    <span class="att-label">${esc(label)}</span>
    <span class="att-meta">${esc(meta)}</span>
    ${extra}
  </div>`;

/* 笔记行：点击新建一个笔记标签页（阅读器内的「笔记」按钮则是右侧栏）；显示已有笔记数量 */
function noteRowHTML(p) {
  const n = p.noteCount || 0;
  return `
  <div class="att att-file att-note-add" data-action="open-note" data-id="${p.id}" role="treeitem"
       title="${n ? `${n} 条笔记，在新标签页中打开` : "新建笔记（在新标签页中打开）"}">
    <span class="att-ico">${I("pencil", 14)}</span>
    <span class="att-label">笔记${n ? "" : '<span class="pill pill-new">空</span>'}</span>
    <span class="att-meta">${n ? `${n} 条` : "点击开始记录"}</span>
    ${n ? '<span class="att-badge">MD</span>' : ""}
  </div>`;
}

/* 生成某篇文献的附件树内容。
   live 模式：原文 PDF / 译文 / 对照版（都走 sidecar 文件端点）
   演示模式：只有模拟的 PDF 条目 */
function attachmentsHTML(p) {
  const rows = [];
  if (p.live) {
    // Zotero 风格：原文附件显示文件名（CSS 负责溢出省略），title 给出全名
    const origLabel = `${p.title}.pdf`;
    rows.push(attachRow({
      icon: "file", label: origLabel, meta: p.pages ? `${p.pages} 页` : "",
      action: "open-file", id: p.id, extra: `<span class="att-kind">PDF</span>`, cls: "att-file",
      title: `${origLabel}${p.origName ? `（导入文件：${p.origName}）` : ""}`,
    }));
    if (p.translated) {
      rows.push(attachRow({
        icon: "languages", label: "译文", meta: p.pages ? `${p.pages} 页` : "",
        action: "open-file-zh", id: p.id, extra: `<span class="att-kind att-kind-zh">PDF</span>`, cls: "att-file",
        title: "中文译文（pdf2zh 版面级替换）",
      }));
      rows.push(attachRow({
        icon: "columns", label: "双语对照版", meta: "左右并排",
        action: "open-file-compare", id: p.id, extra: `<span class="att-kind att-kind-zh">PDF</span>`, cls: "att-file",
        title: "左原文 · 右译文并排对照",
      }));
    } else {
      rows.push(`<div class="att att-pending"><span class="att-ico">${I("languages", 14)}</span>
        <span class="att-label">译文尚未生成</span>
        <button class="btn sm" data-action="translate" data-id="${p.id}">${I("sparkle", 13)}翻译全文</button></div>`);
    }
  } else {
    rows.push(attachRow({
      icon: "file", label: "PDF 原文", meta: "演示文件",
      extra: `<span class="att-kind">PDF</span>`, cls: "att-file",
    }));
  }
  rows.push(noteRowHTML(p));
  return rows.join("");
}

/* 一行 = 文献条目 + 可展开的附件树 */
const rowHTML = (p, ftOnly = new Set()) => {
  const snip = state.fulltext.map[p.id];
  const open = state.expanded.has(p.id);
  return `
  <div class="row-wrap ${open ? "open" : ""}" data-row-id="${p.id}">
    <article class="row" data-action="open" data-id="${p.id}" draggable="true" title="拖动到左侧分类可移动">
      <button class="row-toggle" data-action="toggle-row" data-id="${p.id}"
              title="${open ? "收起附件" : "展开附件"}" aria-expanded="${open}">
        ${I(open ? "chevD" : "chevR", 14)}
      </button>
      ${cover(p, true)}
      <div class="row-main">
        <h3 data-paper-title="${p.id}">${esc(p.title)}</h3>
        <p>${esc(p.authors)} · <i>${esc(p.venue)}</i> ${p.year} · ${esc(p.type)}</p>
        ${snip ? `<p class="row-snippet">${esc(snip).replace(/\[\[/g, "<mark>").replace(/\]\]/g, "</mark>")}</p>` : ""}
      </div>
      <div class="row-tags">${p.tags.map((t) => `<span class="tag-chip" data-action="tag" data-id="${esc(t)}">${esc(t)}</span>`).join("")}</div>
      <div class="row-status">${badge(p)}${ftOnly.has(p.id) ? '<span class="pill pill-ai">全文命中</span>' : ""}</div>
      ${rowActs(p)}
      <span class="row-go">${I("right", 16)}</span>
    </article>
    <div class="att-tree" role="tree" ${open ? "" : "hidden"}>${open ? attachmentsHTML(p) : ""}</div>
  </div>`;
};

const gcardHTML = (p, ftOnly = new Set()) => {
  const snip = state.fulltext.map[p.id];
  return `
  <article class="gcard" data-action="open" data-id="${p.id}" draggable="true" title="拖动到左侧分类可移动">
    ${cover(p)}
    <span class="gcard-acts">
      <button class="icon-btn sm" data-action="rename-paper" data-id="${p.id}" title="重命名文献">${I("pencil", 15)}</button>
      <button class="icon-btn sm ${p.fav ? "faved" : ""}" data-action="toggle-fav" data-id="${p.id}" title="${p.fav ? "取消收藏" : "收藏"}">${I("star", 15)}</button>
      <button class="icon-btn sm danger" data-action="del-paper" data-id="${p.id}" title="删除">${I("trash", 15)}</button>
    </span>
    <div class="gcard-body">
      <h3 data-paper-title="${p.id}">${esc(p.title)}</h3>
      <p class="gcard-meta">${esc(p.authors)}</p>
      ${snip ? `<p class="row-snippet">${esc(snip).replace(/\[\[/g, "<mark>").replace(/\]\]/g, "</mark>")}</p>` : ""}
    </div>
    <div class="gcard-foot"><span class="gcard-venue">${esc(p.venue)} ${p.year}</span>${badge(p)}${ftOnly.has(p.id) ? '<span class="pill pill-ai">全文命中</span>' : ""}</div>
  </article>`;
};

/* 元数据命中（前端过滤）∪ 全文命中（sidecar FTS），全文独有者带 pill 标注 */
function mergedList() {
  const base = visiblePapers();
  if (!LithubAPI.live || !state.filter.search.trim() || !Object.keys(state.fulltext.map).length) {
    return { list: base, ftOnly: new Set() };
  }
  const have = new Set(base.map((p) => p.id));
  const ftOnly = new Set();
  const extra = [];
  for (const pid of Object.keys(state.fulltext.map)) {
    if (!have.has(pid)) {
      const p = paperById(pid);
      if (p) { extra.push(p); ftOnly.add(pid); }
    }
  }
  return { list: [...base, ...extra], ftOnly };
}

const paperListHTML = (list, ftOnly = new Set()) => list.length
  ? list.map((p) => (state.libView === "grid" ? gcardHTML(p, ftOnly) : rowHTML(p, ftOnly))).join("")
  : `<div class="empty"><div class="empty-ico">${I("search", 28)}</div><h3>没有找到匹配的文献</h3><p>换个关键词，或清除筛选条件试试</p><button class="btn" data-action="reset-filter">清除筛选</button></div>`;

const cover = (p, mini = false) =>
  `<span class="cover cov-${p.cover % 6}${mini ? " mini" : ""}"><b>${esc(p.title[0])}</b>${mini ? "" : `<em>${esc(p.venue)} · ${p.year}</em>`}</span>`;

function toast(msg, type = "ok") {
  const root = $("#toast-root");
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.innerHTML = `${I(type === "ok" ? "check" : type === "err" ? "alert" : "sparkle", 16)}<span>${msg}</span>`;
  root.appendChild(el);
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 350); }, 2600);
}

/* ---------------- 侧边栏 ---------------- */
function renderSidebar() {
  if (!document.getElementById("sidebar")) return; // 阅读器模式无侧栏
  const f = state.filter;
  const tags = allTags().slice(0, 7);
  /* 分类图标：顶层用文件夹图标；子级只在「确实有子分类」时显示可点击的展开箭头，
     否则留一个等宽空白占位 —— 没有子级却画个 ⌄ 会让人以为能展开（用户反馈）。
     箭头是可折叠开关（data-action="cat-toggle"），点它不会选中分类。 */
  const hasKidsOf = (id) => state.db.categories.some((k) => k.parent === id);
  const catItem = (c, depth) => {
    const hasKids = hasKidsOf(c.id);
    const collapsed = state.collapsedCats.has(c.id);
    let icon;
    if (depth === 0) {
      icon = I("folder", 16);
    } else if (hasKids) {
      icon = I(collapsed ? "chevR" : "chevD", 12);
    } else {
      icon = '<span class="nav-ico-blank"></span>';
    }
    // 有子级的行：图标槽本身是个按钮（cat-toggle）；顶层也允许折叠（一致性）
    const caret = hasKids
      ? `<span class="nav-caret${collapsed ? " collapsed" : ""}" data-action="cat-toggle" data-id="${c.id}" title="${collapsed ? "展开" : "收起"}">${icon}</span>`
      : `<span class="nav-ico${depth === 0 ? "" : " nav-ico-sm"}">${icon}</span>`;
    return `
    <button class="nav-item ${f.cat === c.id ? "active" : ""}" data-action="cat" data-id="${c.id}" data-depth="${depth}" style="--depth:${depth}">
      ${caret}
      <span class="nav-label">${esc(c.name)}</span>
      <span class="nav-del" data-action="del-cat" data-id="${c.id}" title="删除分类">${I("trash", 13)}</span>
      <span class="nav-count">${catCount(c.id)}</span>
    </button>`;
  };
  /* 递归渲染分类树：不再限制两层（用户反馈「想给二级分类加子分类」做不到）。
     用 visited 防御脏数据造成的环，避免无限递归；折叠的分类不渲染其子树。 */
  const renderCatTree = (parent, depth, visited = new Set()) => {
    if (depth > 12) return "";                 // 防御性硬上限
    return state.db.categories
      .filter((c) => (c.parent || null) === parent && !visited.has(c.id))
      .map((c) => {
        visited.add(c.id);
        const kids = state.collapsedCats.has(c.id) ? "" : renderCatTree(c.id, depth + 1, visited);
        return catItem(c, depth) + kids;
      })
      .join("");
  };
  const tree = renderCatTree(null, 0);

  $("#sidebar").innerHTML = `
    <div class="brand" data-action="smart" data-id="all" title="返回文献库">
      <span class="brand-mark">文</span>
      <span class="brand-name">文枢<span class="brand-en">LitHub</span></span>
    </div>
    <nav class="nav-sec">
      <div class="nav-title">智能视图</div>
      <button class="nav-item ${f.smart === "all" && !f.cat ? "active" : ""}" data-action="smart" data-id="all">
        <span class="nav-ico">${I("book", 16)}</span><span class="nav-label">全部文献</span><span class="nav-count">${state.db.papers.length}</span>
      </button>
      <button class="nav-item ${f.smart === "recent" ? "active" : ""}" data-action="smart" data-id="recent">
        <span class="nav-ico">${I("clock", 16)}</span><span class="nav-label">最近添加</span>
      </button>
      <button class="nav-item ${f.smart === "fav" ? "active" : ""}" data-action="smart" data-id="fav">
        <span class="nav-ico">${I("star", 16)}</span><span class="nav-label">收藏</span><span class="nav-count">${state.db.papers.filter((p) => p.fav).length}</span>
      </button>
    </nav>
    <nav class="nav-sec nav-scroll">
      <div class="nav-title">分类</div>
      ${tree}
      <button class="nav-item nav-ghost" data-action="new-cat"><span class="nav-ico">${I("plus", 15)}</span><span class="nav-label">新建分类</span></button>
    </nav>
    <nav class="nav-sec">
      <div class="nav-title">标签</div>
      <div class="tag-cloud">${tags.map(([t, n]) => `<button class="tag-chip ${f.tag === t ? "active" : ""}" data-action="tag" data-id="${esc(t)}">${esc(t)}<i>${n}</i></button>`).join("")}</div>
    </nav>
    <footer class="side-foot">
      <button class="icon-btn" data-action="toggle-theme" title="切换主题">${I(state.db.settings.theme === "dark" ? "sun" : "moon", 17)}</button>
      <button class="nav-item ${state.route.view === "tasks" ? "active" : ""}" data-action="route" data-id="tasks">
        <span class="nav-ico">${I("languages", 16)}</span><span class="nav-label">翻译任务</span>
        <span class="nav-count running-dot" ${state.db.tasks.some((t) => t.status === "running") ? "" : "hidden"}></span>
      </button>
      <button class="nav-item ${state.route.view === "settings" ? "active" : ""}" data-action="route" data-id="settings">
        <span class="nav-ico">${I("sliders", 16)}</span><span class="nav-label">设置</span>
      </button>
    </footer>`;

  document.documentElement.dataset.theme = state.db.settings.theme;
  document.documentElement.dataset.accent = state.db.settings.accent;
}

/* ---------------- 文献库 ---------------- */
function visiblePapers() {
  const f = state.filter;
  let list = [...state.db.papers];
  if (f.smart === "recent") list.sort((a, b) => b.added.localeCompare(a.added));
  if (f.smart === "fav") list = list.filter((p) => p.fav);
  if (f.cat) list = list.filter((p) => (p.cat || "local") === f.cat); // 严格归属：父分类不聚合子分类的文献
  if (f.tag) list = list.filter((p) => p.tags.includes(f.tag));
  if (f.search.trim()) {
    const q = f.search.trim().toLowerCase();
    list = list.filter((p) => (p.title + p.authors + p.venue + p.tags.join("")).toLowerCase().includes(q));
  }
  if (state.sort === "year") list.sort((a, b) => b.year - a.year);
  if (state.sort === "title") list.sort((a, b) => a.title.localeCompare(b.title));
  if (state.sort === "added") list.sort((a, b) => b.added.localeCompare(a.added));
  return list;
}

const currentTitle = () =>
  state.filter.smart === "fav" ? "收藏" :
  state.filter.smart === "recent" ? "最近添加" :
  state.filter.cat ? (catName(state.filter.cat) || "分类") : "全部文献";

function renderLibrary() {
  const { list, ftOnly } = mergedList();

  $("#view").innerHTML = `
  <header class="page-head">
    <div>
      <div class="overline">LIBRARY · 文献库</div>
      <h1>${esc(currentTitle())} <span class="num">${list.length}</span><span class="num-sub">篇</span></h1>
    </div>
    <div class="head-actions">
      <button class="btn btn-primary" data-action="import">${I("upload", 16)}导入文献</button>
    </div>
  </header>
  <div class="toolbar">
    <label class="search">
      ${I("search", 16)}
      <input id="search-input" type="text" placeholder="搜索标题、作者、标签…（按 / 聚焦）" value="${esc(state.filter.search)}">
    </label>
    ${state.filter.tag ? `<span class="filter-pill">${I("tag", 13)} ${esc(state.filter.tag)}<button data-action="clear-tag">${I("x", 12)}</button></span>` : ""}
    <div class="toolbar-right">
      <label class="select-wrap">
        <select id="sort-sel" data-action-change="sort">
          <option value="added" ${state.sort === "added" ? "selected" : ""}>按添加时间</option>
          <option value="year" ${state.sort === "year" ? "selected" : ""}>按出版年份</option>
          <option value="title" ${state.sort === "title" ? "selected" : ""}>按标题</option>
        </select>
      </label>
      <div class="seg">
        <button class="seg-btn ${state.libView === "list" ? "active" : ""}" data-action="libview" data-id="list" title="列表视图">${I("list", 15)}</button>
        <button class="seg-btn ${state.libView === "grid" ? "active" : ""}" data-action="libview" data-id="grid" title="网格视图">${I("grid", 15)}</button>
      </div>
    </div>
  </div>
  <div id="list-area" class="${state.libView === "grid" ? "grid-area" : "table-area"}">
    ${paperListHTML(list, ftOnly)}
  </div>`;
  $("#search-input").addEventListener("input", (e) => {
    state.filter.search = e.target.value;
    clearTimeout(renderLibrary._debounce);
    renderLibrary._debounce = setTimeout(async () => {
      const el = $("#list-area");
      if (el) el.innerHTML = renderListArea();
      // 全文命中（sidecar FTS）：仅在 live 模式、查询 ≥2 字符时
      if (LithubAPI.live) {
        const q = state.filter.search.trim();
        try {
          const hits = q.length >= 2 ? await LithubAPI.fulltextSearch(q) : [];
          if (state.filter.search.trim() === q) { // 搜索词未变才应用
            state.fulltext = { q, map: Object.fromEntries(hits.map((h) => [h.paper_id, h.snippet])) };
            const el2 = $("#list-area");
            if (el2) el2.innerHTML = renderListArea();
          }
        } catch {}
      }
    }, 150);
  });
}

function renderListArea() {
  const { list, ftOnly } = mergedList();
  return paperListHTML(list, ftOnly);
}

/* ---------------- 阅读器 ---------------- */
const FILL_EN = [
  "The Transformer follows this overall architecture using stacked self-attention and point-wise, fully connected layers for both the encoder and decoder.",
  "Multi-head attention allows the model to jointly attend to information from different representation subspaces at different positions, and the attention for each head is computed in parallel.",
  "Training was carried out on a single machine with standard hyperparameters; regularization relies on residual dropout applied to the output of each sub-layer and to the sum of the embeddings.",
  "Ablation studies show that the number of attention heads and the model dimension both matter: performance degrades below a certain capacity while plateauing beyond it.",
  "Evaluation uses beam search with a beam size of four and length penalty alpha of 0.6, following common practice for sequence generation models.",
];
const FILL_ZH = [
  "Transformer 采用上述总体架构：编码器与解码器均由堆叠的自注意力层与逐位置全连接层组成。",
  "多头注意力让模型能够在不同位置的多个表示子空间中共同关注信息，各头的注意力计算可以完全并行。",
  "训练在单机上进行并使用标准超参数；正则化依赖于作用于每个子层输出以及嵌入之和的残差 dropout。",
  "消融实验表明注意力头数与模型维度都很关键：容量低于一定水平时性能下降，超过之后则趋于饱和。",
  "评估使用束宽为 4、长度惩罚 α 为 0.6 的束搜索，遵循序列生成模型的常见做法。",
];

function genericPages(p, lang) {
  const zh = lang === "zh";
  const F = zh ? FILL_ZH : FILL_EN;
  const seed = parseInt(p.id.slice(1), 10) || 1;
  const f1 = F[seed % F.length], f2 = F[(seed + 1) % F.length], f3 = F[(seed + 3) % F.length];
  const r = zh
    ? [["基线方法", 62], ["+ 数据增强", 68], ["+ 正则化", 71], ["本文方法", 79]]
    : [["Baseline", 62], ["+ Augment", 68], ["+ Regularize", 71], ["Ours", 79]];
  if (zh) {
    return [
      [
        { t: "title", x: p.zh || p.title },
        { t: "authors", x: p.authors },
        { t: "label", x: "摘要" },
        { t: "p", x: p.abstractZh || `本文围绕「${p.tags[0] ?? "该方向"}」中的核心问题展开研究，提出了相应的模型与方法，并在标准基准任务上验证了其有效性。完整的方法推导、实验设置与附录内容，请对照左侧原文阅读。` },
        { t: "h1", x: "1  引言" },
        { t: "p", x: f1 },
        { t: "p", x: f2 },
      ],
      [
        { t: "h1", x: "2  方法" },
        { t: "p", x: f3 },
        { t: "h2", x: "2.1  总体框架" },
        { t: "p", x: f1 },
        { t: "figure", kind: "bars", caption: `图 1：与基线方法的性能对比（${p.venue} ${p.year}）。`,
          items: r.map(([x, v]) => ({ x, v, max: 100 })) },
        { t: "p", x: f2 },
      ],
      [
        { t: "h1", x: "3  实验" },
        { t: "table", caption: "表 1：主要结果对比。",
          head: ["方法", "设置", "指标"], rows: [["基线", "标准", "62.0"], ["本文方法", "标准", "79.0"], ["本文方法", "扩展", "81.4"]] },
        { t: "p", x: f3 },
        { t: "note", x: `${p.venue} ${p.year} · 由 ${state.db.settings.model} 翻译，仅供参考，请以原文为准` },
      ],
    ];
  }
  return [
    [
      { t: "title", x: p.title },
      { t: "authors", x: p.authors },
      { t: "affil", x: `${p.venue} ${p.year}` },
      { t: "label", x: "Abstract" },
      { t: "p", x: p.abstract },
      { t: "h1", x: "1  Introduction" },
      { t: "p", x: f1 },
      { t: "p", x: f2 },
    ],
    [
      { t: "h1", x: "2  Method" },
      { t: "p", x: f3 },
      { t: "h2", x: "2.1  Overview" },
      { t: "p", x: f1 },
      { t: "figure", kind: "bars", caption: `Figure 1: Comparison against baseline methods (${p.venue} ${p.year}).`,
        items: r.map(([x, v]) => ({ x, v, max: 100 })) },
      { t: "p", x: f2 },
    ],
    [
      { t: "h1", x: "3  Experiments" },
      { t: "table", caption: "Table 1: Main results.",
        head: ["Method", "Setting", "Metric"], rows: [["Baseline", "standard", "62.0"], ["Ours", "standard", "79.0"], ["Ours", "extended", "81.4"]] },
      { t: "p", x: f3 },
      { t: "note", x: `${p.venue} ${p.year} · Demo page for UI prototype` },
    ],
  ];
}

const pagesOf = (p, lang) => {
  if (p.id === "p1" && window.CONTENT.p1) return window.CONTENT.p1[lang];
  if (!p._pages) p._pages = { en: genericPages(p, "en"), zh: genericPages(p, "zh") };
  return p._pages[lang];
};

const blocksHTML = (blocks) => blocks.map((b) => {
  switch (b.t) {
    case "title": return `<h2 class="pb-title">${esc(b.x)}</h2>`;
    case "authors": return `<p class="pb-authors">${esc(b.x)}</p>`;
    case "affil": return `<p class="pb-affil">${esc(b.x)}</p>`;
    case "label": return `<p class="pb-label">${esc(b.x)}</p>`;
    case "h1": return `<h3 class="pb-h1">${esc(b.x)}</h3>`;
    case "h2": return `<h4 class="pb-h2">${esc(b.x)}</h4>`;
    case "p": return `<p class="pb-p">${esc(b.x)}</p>`;
    case "note": return `<p class="pb-note">${esc(b.x)}</p>`;
    case "figure": return `
      <figure class="pb-fig">
        <div class="fig-canvas">${b.items.map((it) => `
          <div class="fig-bar"><span class="fig-bar-label">${esc(it.x)}</span>
            <span class="fig-bar-track"><span style="width:${Math.round((it.v / it.max) * 100)}%"></span></span>
            <span class="fig-bar-val">${it.v}</span>
          </div>`).join("")}</div>
        <figcaption>${esc(b.caption)}</figcaption>
      </figure>`;
    case "table": return `
      <div class="pb-table-wrap">
        <table class="pb-table"><thead><tr>${b.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
        <tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>
        <p class="pb-caption">${esc(b.caption)}</p>
      </div>`;
    default: return "";
  }
}).join("");

const pageHTML = (blocks, num, lang, running = "") => `
  <div class="page ${lang}" data-lang="${lang}">
    <header class="page-running">${lang === "zh" ? "译文 · 由 AI 翻译生成" : esc(running)}</header>
    ${blocksHTML(blocks)}
    <footer class="page-num">${num}</footer>
  </div>`;

function panesHTML(p) {
  const r = readerSession(p.id) || state.reader;
  const pct = state.translating[p.id];
  const runningTask = LithubAPI.live
    ? state.liveTasks.find((t) => t.paper_id === p.id && (t.status === "running" || t.status === "queued"))
    : null;

  const zhPane = `
    <section class="pane pane-zh" id="pane-zh">
      ${p.live
        ? p.translated
          ? `<div class="pdf-host" data-src="${p.zhUrl}"></div>`
          : runningTask
            ? `<div class="pane-placeholder">
                 <div class="spin-ring"></div>
                 <h3>正在翻译… <b id="zh-pct">${runningTask.progress || 0}%</b></h3>
                 <p id="zh-note">${esc(runningTask.note || "")}</p>
                 <div class="progress" id="zh-progress"><span style="width:${runningTask.progress || 0}%"></span></div>
               </div>`
            : `<div class="pane-placeholder">
                 <div class="ph-ico">${I("languages", 26)}</div>
                 <h3>尚未翻译</h3>
                 <p>点击右上角「翻译全文」，生成中文对照版</p>
                 <button class="btn btn-primary" data-action="translate" data-id="${p.id}">${I("sparkle", 15)}翻译全文</button>
               </div>`
        : p.translated
          ? pagesOf(p, "zh").map((blocks, i) => pageHTML(blocks, i + 1, "zh")).join("")
          : pct != null
            ? `<div class="pane-placeholder">
                 <div class="spin-ring"></div>
                 <h3>正在翻译… ${pct}%</h3>
                 <p>调用 ${esc(state.db.settings.model)} · 引擎 PDF2zh（本地）</p>
                 <div class="progress"><span style="width:${pct}%"></span></div>
               </div>`
            : `<div class="pane-placeholder">
                 <div class="ph-ico">${I("languages", 26)}</div>
                 <h3>尚未翻译</h3>
                 <p>点击右上角「翻译全文」，生成中文对照版</p>
                 <button class="btn btn-primary" data-action="translate" data-id="${p.id}">${I("sparkle", 15)}翻译全文</button>
               </div>`}
    </section>`;

  const enPane = `
    <section class="pane pane-en" id="pane-en">
      ${p.live
        ? `<div class="pdf-host" data-src="${p.fileUrl}"></div>`
        : pagesOf(p, "en").map((blocks, i) => pageHTML(blocks, i + 1, "en", p.title)).join("")}
    </section>`;

  // 双语对照：直接渲染 pdf2zh 风格的 compare 对照版（每页 = 左原文 · 右译文）。
  // 单文档渲染比双文档并排更省事：页面对齐天然一致、滚动同步无需额外处理、
  // 且宽页只占一个 PDF.js 文档实例。
  const dual2Pane = `
    <section class="pane pane-dual2" id="pane-dual2">
      ${p.translated
        ? `<div class="pdf-host" data-src-compare="${p.compareUrl}"></div>`
        : `<div class="pane-placeholder">
             <div class="ph-ico">${I("languages", 26)}</div>
             <h3>双语对照版尚未生成</h3>
             <p>先执行「翻译全文」，生成中文译文后即可并排对照</p>
           </div>`}
    </section>`;

  // 按当前模式渲染所需面板（此前 zhPane 仅在 dual 时渲染，导致「译文」模式空白）
  let mainPane;
  if (r.mode === "dual2") mainPane = dual2Pane;
  else mainPane = r.mode === "zh" ? zhPane : enPane;

  return mainPane + (r.webAi ? webAiPaneHTML(p) : "");
}

function webAiPaneHTML(p) {
  const navBtns = webAiMode() === "view"
    ? `<button class="icon-btn sm" data-action="webai-back" title="后退">${I("left", 14)}</button>
       <button class="icon-btn sm" data-action="webai-reload" title="刷新">${I("refresh", 14)}</button>`
    : `<button class="icon-btn sm" data-action="webai-reload" title="重新加载（会重开一次内嵌窗口）">${I("refresh", 14)}</button>`;
  // 给面板喂料的两个动作：复制 PDF 文件 / 复制提示词。
  // 面板宽的时候显示文字，窄的时候只留图标（见 .webai-copy-btn 的 CSS）。
  const feedBtns = `
    <button class="btn sm webai-copy-btn" data-action="webai-copy-pdf" data-id="${p.id}"
            title="把 PDF 文件放进剪贴板 → 到网页 AI 对话框里 Ctrl+V 上传">${I("copy", 13)}<span class="lbl">复制 PDF</span></button>
    <button class="btn sm webai-copy-btn" data-action="webai-copy-prompt" data-id="${p.id}"
            title="复制当前提示词模板（配合 PDF 一起发给网页 AI）">${I("sparkle", 13)}<span class="lbl">复制提示词</span></button>`;
  return `
    <div class="pane-divider" id="webai-divider"></div>
    <section class="pane pane-webai" id="pane-webai">
      <div class="webai-pane-head">
        <span class="webai-pane-title">${I("external", 13)}<b>网页 AI</b></span>
        <span class="webai-pane-url" id="webai-pane-url" title="当前论文：${esc(p.title)}">${esc(p.title)}</span>
        <div class="webai-pane-copy">${feedBtns}</div>
        <div class="webai-pane-acts">
          ${navBtns}
          <button class="icon-btn sm" data-action="webai-site" title="切换站点">${I("sliders", 14)}</button>
          <button class="icon-btn sm" data-action="webai-close" title="关闭网页 AI">${I("x", 14)}</button>
        </div>
      </div>
      <div class="webai-host" id="webai-host">
        <div class="webai-fallback" id="webai-fallback" hidden></div>
      </div>
    </section>`;
}

function renderReader(id) {
  const p = paperById(id);
  if (!p) { location.hash = "#/library"; return; }
  cancelWebAiResize?.();
  // 载入目标文献自己的阅读会话（模式/缩放/面板开关/网页 AI 状态）。
  // 同一篇重复渲染（切模式/缩放）是 no-op，不会清掉刚做的改动。
  captureReaderScroll(activeReaderPaper);
  disposePdfHosts();
  activateReaderSession(id);
  const r = state.reader;
  document.body.classList.add("reading");
  const runningTask = LithubAPI.live
    ? state.liveTasks.find((t) => t.paper_id === p.id && (t.status === "running" || t.status === "queued"))
    : null;
  const btnHTML = p.live
    ? (p.translated ? `${I("check", 15)}已翻译`
        : runningTask ? `${I("refresh", 15)}<span class="spin">翻译中 ${runningTask.progress || 0}%</span>`
        : `${I("languages", 15)}翻译全文`)
    : (state.translating[p.id] != null ? `${I("refresh", 15)}<span class="spin">翻译中 ${state.translating[p.id]}%</span>`
        : p.translated ? `${I("check", 15)}已翻译` : `${I("languages", 15)}翻译全文`);
  $("#view").innerHTML = `
  <div class="reader">
    <header class="reader-bar">
      <button class="icon-btn" data-action="route" data-id="library" title="返回文献库">${I("arrowLeft", 18)}</button>
      <div class="reader-title">
        <h1 data-paper-title="${p.id}">${esc(p.title)}</h1>
        <span>${esc(p.authors)} · ${esc(p.venue)} ${p.year}</span>
      </div>
      <button class="icon-btn sm" data-action="rename-paper" data-id="${p.id}" title="重命名文献">${I("pencil", 15)}</button>
      <div class="seg seg-modes">
        ${p.live ? `<button class="seg-btn ${r.mode === "dual2" ? "active" : ""}" data-action="mode" data-id="dual2" title="pdf2zh 双语对照版：左原文 · 右译文并排">${I("book", 14)}双语对照</button>` : ""}
        <button class="seg-btn ${r.mode === "en" ? "active" : ""}" data-action="mode" data-id="en">原文</button>
        <button class="seg-btn ${r.mode === "zh" ? "active" : ""}" data-action="mode" data-id="zh">译文</button>
      </div>
      <div class="reader-right">
        <div class="zoom">
          <button class="icon-btn sm" data-action="zoom" data-id="-1" title="缩小（Ctrl+-）">${I("zoomOut", 15)}</button>
          <label class="select-wrap zoom-sel" title="缩放">
            <select id="zoom-sel">
              <option value="width" ${r.fit === "width" ? "selected" : ""}>适合宽度</option>
              <option value="page" ${r.fit === "page" ? "selected" : ""}>适合页面</option>
              ${[0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4].map((v) => `<option value="${v}" ${r.fit === "manual" && Math.abs(r.zoom - v) < 0.01 ? "selected" : ""}>${Math.round(v * 100)}%</option>`).join("")}
            </select>
          </label>
          <button class="icon-btn sm" data-action="zoom" data-id="1" title="放大（Ctrl+=）">${I("zoomIn", 15)}</button>
          <span class="zoom-pct" title="实际渲染分辨率">${r.fit === "manual" ? Math.round(r.zoom * 100) + "%" : r.fit === "page" ? "适页" : "适宽"}</span>
        </div>
        <button class="icon-btn ${p.fav ? "faved" : ""}" data-action="toggle-fav" data-id="${p.id}" title="${p.fav ? "取消收藏" : "收藏"}">${I("star", 17)}</button>
        <div class="tag-wrap">
          <button class="icon-btn" data-action="tag-pop" data-id="${p.id}" title="标签">${I("tag", 17)}</button>
          <div class="tag-pop hidden" id="tag-pop"></div>
        </div>
        <button class="icon-btn danger" data-action="del-paper" data-id="${p.id}" title="删除文献">${I("trash", 17)}</button>
        <button class="btn ${p.translated || runningTask ? "" : "btn-primary"}" data-action="translate" data-id="${p.id}">${btnHTML}</button>
        <button class="btn ${annotListState.open ? "is-on" : ""}" data-action="annot-panel" data-id="${p.id}" title="批注列表">${I("list", 15)}批注<span class="annot-count" ${annotCountOf(p.id) ? "" : "hidden"}>${annotCountOf(p.id) || ""}</span></button>
        <button class="btn" data-action="note-panel" data-id="${p.id}" title="在右侧栏打开 Markdown 笔记">${I("pencil", 15)}笔记</button>
        <button class="icon-btn" data-action="open-note" data-id="${p.id}" title="在新标签页中打开笔记（更大编辑区）">${I("external", 16)}</button>
        <button class="btn btn-ai" data-action="ai-panel" data-id="${p.id}">${I("sparkle", 15)}AI 总结</button>
        <button class="btn ${r.webAi ? "is-on" : ""}" data-action="webai-toggle" data-id="${p.id}"
                title="在右侧内嵌网页 AI，与论文并排（免 Token）">${I("external", 15)}网页 AI</button>
      </div>
    </header>
    <div class="panes ${r.mode}${r.webAi ? " has-webai" : ""}" id="panes" style="--pw:${Math.round(660 * r.zoom)}">
      ${panesHTML(p)}
  </div>`;
  // 确保 state.reader 就是这篇文献的会话对象（渲染期间新建）
  if (!readerSessions.has(id)) readerSessions.set(id, r);
  // 之前开过网页 AI、窗口也还在（离开阅读器只是隐藏）：afterReaderRender 会按
  // 布局重新上报矩形让原生窗口重新显示，不 embed、不导航，已有会话原地恢复。
  mountPdfHosts(p);
  afterReaderRender();
  restoreReaderScroll(id);
}

/* ---------------- 阅读会话：快照 / 恢复 ---------------- */

/* 当前 state.reader 指向哪篇文献的会话（null = 还没进过阅读器） */
let activeReaderPaper = null;

/* PDF 阅读区不在 window 上滚动，而是各自的 .pane（overflow-y:auto）。
   记录每个模式的滚动位置；不读 DOM 时返回 null。 */
/* 把当前阅读器的滚动位置写回指定文献的会话。
   只有该文献确实是当前正在显示的阅读器时才读 DOM，否则会把别的文献的滚动
   位置写到它头上（例如在 A 的阅读页里关掉 B 的标签页）。 */
function captureReaderScroll(paperId) {
  if (!paperId || paperId !== activeReaderPaper) return;
  if (state.route.view !== "reader" || state.route.id !== paperId) return;
  const s = readerSessions.get(paperId);
  if (!s) return;
  for (const mode of Object.keys(s.scroll)) {
    const el = document.querySelector(`#pane-${mode}`);
    if (el) {
      s.scroll[mode] = el.scrollTop;
      const anchor = PdfView.captureAnchor(el);
      if (anchor) (s.anchors ??= {})[mode] = anchor;
    }
  }
}

/* 把某篇文献的会话对象接到 state.reader 上（引用共享：写 state.reader
   等于写该文献的会话，不会串到别的文献）。同一篇重复渲染是 no-op。 */
function activateReaderSession(paperId) {
  if (!paperId) return state.reader;
  if (activeReaderPaper === paperId) return state.reader;
  captureReaderScroll(activeReaderPaper);
  const prev = state.reader;
  const next = readerSession(paperId);
  if (prev && prev !== next) {
    // 提示词/视觉模式是全局阅读偏好，不随文献隔离
    next.prompt = prev.prompt || next.prompt;
    next.vision = prev.vision;
  }
  state.reader = next;
  activeReaderPaper = paperId;
  return next;
}

/* 关闭阅读标签 / 删除文献时清理该文献的阅读会话与它独占的原生窗口。 */
function disposeReaderSession(paperId) {
  if (!paperId) return;
  webAiController.dispose(paperId);
  readerSessions.delete(paperId);
  if (activeReaderPaper === paperId) activeReaderPaper = null;
}

/* 重新渲染后把 PDF 面板滚回该文献上次停的位置。
   PDF 是异步挂载的，所以立刻设一次 + 挂载完成后再设一次 + 下一帧兜底。 */
function restoreReaderScroll(paperId) {
  const s = readerSessions.get(paperId);
  if (!s) return;
  const pane = document.querySelector(`#pane-${s.mode}`);
  const top = s.scroll[s.mode] || 0;
  const apply = () => {
    // 路由已经切走就不要动别人的 DOM
    if (state.route.view !== "reader" || state.route.id !== paperId) return;
    const el = document.querySelector(`#pane-${s.mode}`);
    if (el && el === pane) {
      const anchor = s.anchors?.[s.mode];
      if (!anchor || !PdfView.restoreAnchor(el, anchor)) el.scrollTop = top;
    }
  };
  apply();
  requestAnimationFrame(apply);
}

/* 真实模式：把 .pdf-host 挂载为 PDF.js 渲染面板
   双语对照（data-src-en + data-src-zh）：两份文档并排；单栏（data-src）：单文档 */
/* ============================================================
 * 内嵌网页 AI
 *
 * 主路径：用你自己的 Chrome/Edge 打开 --app 窗口，因此**完整复用本机登录态**；
 * 再由 sidecar 用 Win32 SetParent 把它挂到应用窗口下，视觉上当面板用。
 * 依赖：window.lithub.browser（桌面版）。
 * 设置页已不再提供「内嵌方式」选项，日常只会走这一条。
 *
 * 兜底：拿不到 browser 通道时（理论上只有非 Windows）才用应用内的
 * WebContentsView（window.lithub.webAi）。它用独立 profile，需要重新登录一次。
 *
 * 两者都需要「把容器屏幕矩形同步给原生层」，所以统一走 syncWebAiBounds()。
 * ============================================================ */
let webAiSyncRaf = 0;
function webAiMode() {
  if (window.lithub?.browser && (!window.lithub.platform || window.lithub.platform === "win32")) return "browser";
  if (window.lithub?.webAi) return "view";
  return null;
}

const webAiController = new WebAiController({
  adapters: {
    browser: {
      open: (url, options) => window.lithub.browser.embed({ url, ...options }),
      close: () => window.lithub.browser.close(),
      bounds: rect => window.lithub.browser.setBounds(rect),
    },
    view: {
      open: url => window.lithub.webAi.open(url),
      close: () => (window.lithub.webAi.close || window.lithub.webAi.hide)(),
      bounds: rect => window.lithub.webAi.setBounds(rect),
    },
  },
  onClosed: owner => {
    const session = readerSessions.get(owner);
    if (session) session.webAi = false;
    if (state.route.view === "reader" && state.route.id === owner) updateWebAiPanel();
    toast("嵌入的浏览器窗口已关闭", "err");
  },
  onError: message => toast(message, "err"),
});

function isWebAiEmbedded() {
  return webAiMode() !== null;
}

/* 控制器合并并串行发送最新布局；后端按会话 ID 和序号丢弃过期请求。 */
let webAiOccluded = false;      // 面板被 DOM 浮层（modal / 抽屉）盖住了 → 先藏起原生窗口

function syncWebAiBounds() {
  const mode = webAiMode();
  if (!mode) return;
  // 只有「当前确实在阅读这篇文献、且面板开着」时才允许原生窗口可见。
  // 切到文献库/设置/任务/笔记页时 host 不存在，这里统一走隐藏（窗口保留，会话不丢）。
  const host = document.getElementById("webai-host");
  const canShow = state.route.view === "reader"
    && !!state.reader?.webAi
    && webAiController.owner === state.route.id
    && !!document.getElementById("pane-webai");
  if (!host || !canShow) {
    hideWebAiNative();
    return;
  }
  const rect = host.getBoundingClientRect();
  // 顺便把「面板左边界」告诉 CSS：toast 要挪到面板左边那块区域的中间，否则会被
  // 原生窗口盖住。用 left 而不是 width——笔记抽屉打开时面板并不贴右边缘。
  document.body.style.setProperty("--webai-left", Math.round(rect.left) + "px");
  // 面板够宽时才在头部按钮上显示文字（窄的时候只留图标）
  document.body.classList.toggle("webai-wide", rect.width >= 560);
  webAiController.sync({
    ...(webAiOccluded
      ? { x: 0, y: 0, width: 0, height: 0, visible: false }
      : { x: Math.round(rect.left), y: Math.round(rect.top),
          width: Math.round(rect.width), height: Math.round(rect.height),
          visible: rect.width > 20 && rect.height > 20 }),
    dpr: window.devicePixelRatio || 1,
  });
}

/* 只隐藏原生窗口，不销毁会话/浏览器进程。
   browser 模式走 bounds(visible:false)（窗口保留，内容不导航）；
   view 模式同样通过串行 bounds 隐藏，保留 WebContentsView 实例。 */
function hideWebAiNative() {
  const mode = webAiMode();
  if (!mode) return;
  document.body.style.removeProperty("--webai-left");
  document.body.classList.remove("webai-wide");
  webAiOccluded = false;
  webAiController.sync({ x: 0, y: 0, width: 0, height: 0, visible: false, dpr: window.devicePixelRatio || 1 });
}

/* ============================================================
 * 原生窗口和 DOM 的层级冲突
 *
 * 嵌入的浏览器窗口是**独立的原生窗口**，永远浮在 Electron 的页面之上。所以 DOM 里的
 * 弹层压不住它：
 *   · 全屏遮罩的 modal（切换站点、导入、确认删除…）只有左半边能看见，右半边被浏览器
 *     窗口盖住，遮罩也没能把浏览器区域压暗 —— 用户看到的就是「弹窗被切掉一半」。
 *   · 贴在面板上的浮层同理。
 * 对策：检测「面板是否被浮层压住」，压住就先把原生窗口藏起来（visible:false），
 * 浮层消失再按最新矩形露出来。
 * ============================================================ */
let webAiOcclusionRaf = 0;
let webAiOcclusionTimer = 0;

function scheduleWebAiOcclusionCheck() {
  // 先在一帧后判一次（浮层刚插入，布局基本就位），再加一次延迟复查：
  // 抽屉/弹窗有进场动画，动画结束后尺寸才稳定，不复查可能留下错误的遮挡判断。
  if (!webAiOcclusionRaf) {
    webAiOcclusionRaf = requestAnimationFrame(() => {
      webAiOcclusionRaf = 0;
      updateWebAiOcclusion();
    });
  }
  clearTimeout(webAiOcclusionTimer);
  webAiOcclusionTimer = setTimeout(updateWebAiOcclusion, 340);
}

function updateWebAiOcclusion() {
  if (!state.reader?.webAi || state.route.view !== "reader" || webAiController.owner !== state.route.id) {
    if (webAiOccluded) { webAiOccluded = false; }
    return;
  }
  const host = document.getElementById("webai-host");
  if (!host) { webAiOccluded = false; return; }
  const h = host.getBoundingClientRect();
  if (h.width < 2 || h.height < 2) return;

  let occluded = false;
  // 全屏遮罩：一定盖住面板（.modal-mask 是 position:fixed inset:0）
  if (document.querySelector("#overlay-root > .modal-mask")) occluded = true;
  if (!occluded) {
    for (const el of document.querySelectorAll("#overlay-root > *:not(.modal-mask)")) {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      const ix = Math.max(0, Math.min(r.right, h.right) - Math.max(r.left, h.left));
      const iy = Math.max(0, Math.min(r.bottom, h.bottom) - Math.max(r.top, h.top));
      // 浮层被面板挡住一大半才算「真的被盖住」，避免小浮层擦到边缘就把整页藏起来
      if (ix * iy >= 0.25 * r.width * r.height) { occluded = true; break; }
    }
  }
  if (occluded !== webAiOccluded) {
    webAiOccluded = occluded;
    syncWebAiBounds();
  }
}

/* 合并多次调用到一帧，避免拖动时每个 pointermove 都发 IPC */
function scheduleWebAiSync() {
  if (webAiSyncRaf) return;
  webAiSyncRaf = requestAnimationFrame(() => {
    webAiSyncRaf = 0;
    syncWebAiBounds();
  });
}

/* Only the AI panel is changed; the mounted PDF and its selection remain intact. */
function updateWebAiPanel() {
  if (state.route.view !== "reader") return;
  const p = paperById(state.route.id), panes = document.getElementById("panes");
  if (!p || !panes) return;
  cancelWebAiResize?.();
  const shown = !!state.reader.webAi;
  panes.classList.toggle("has-webai", shown);
  const button = document.querySelector('[data-action="webai-toggle"]');
  button?.classList.toggle("is-on", shown);
  if (shown && !document.getElementById("pane-webai")) {
    panes.insertAdjacentHTML("beforeend", webAiPaneHTML(p));
  } else if (!shown) {
    document.getElementById("pane-webai")?.remove();
    document.getElementById("webai-divider")?.remove();
  }
  const fallback = document.getElementById("webai-fallback");
  if (fallback) {
    fallback.hidden = webAiController.owner === p.id && webAiController.state !== "opening";
    fallback.textContent = "正在打开网页 AI…";
  }
  afterReaderRender();
}

async function openWebAiInline(url, force = false) {
  if (state.route.view !== "reader") return;
  const paperId = state.route.id, r = readerSession(paperId);
  const target = url || state.db.settings.webAiURL, mode = webAiMode();
  if (!mode) return openExternalUrl(target);
  for (const [id, session] of readerSessions) if (id !== paperId) session.webAi = false;
  r.webAi = true;
  r.webAiURL = target;
  updateWebAiPanel();
  const host = document.getElementById("webai-host");
  const rect = host.getBoundingClientRect();
  const result = await webAiController.open({ owner: paperId, url: target, mode, force,
    options: { browserId: state.db.settings.webAiBrowser || "",
      browserPath: (state.db.settings.webAiBrowserPath || "").trim(),
      rect: { x: Math.round(rect.left), y: Math.round(rect.top),
        width: Math.round(rect.width), height: Math.round(rect.height), dpr: window.devicePixelRatio || 1 } },
  });
  if (result.cancelled) return;
  if (!result.ok) {
    r.webAi = false;
    toast(result.error, "err");
  }
  if (state.route.view === "reader" && state.route.id === paperId) updateWebAiPanel();
  syncWebAiBounds();
  scheduleWebAiOcclusionCheck();
}

function closeWebAiInline() {
  state.reader.webAi = false;
  hideWebAiNative();
  const task = webAiController.close();
  updateWebAiPanel();
  return task;
}

/* 中间分隔条拖动：调整网页 AI 面板宽度（占 .panes 的百分比） */
let cancelWebAiResize = null;
function bindWebAiResize() {
  const divider = document.getElementById("webai-divider");
  const panes = document.getElementById("panes");
  const pane = document.getElementById("pane-webai");
  if (!divider || !panes || !pane || divider.dataset.bound) return;
  divider.dataset.bound = "1";

  // 分隔条不在论文的滚动容器内：把这里的滚轮交给相邻论文。
  // Ctrl/Cmd + 滚轮继续由全局缩放处理，不能同时滚动。
  divider.addEventListener("wheel", (e) => {
    if (e.ctrlKey || e.metaKey) return;
    const paperPane = divider.previousElementSibling;
    if (!paperPane?.classList.contains("pane")) return;
    e.preventDefault();
    const line = parseFloat(getComputedStyle(paperPane).lineHeight) || 16;
    const unitY = e.deltaMode === 1 ? line : e.deltaMode === 2 ? paperPane.clientHeight : 1;
    const unitX = e.deltaMode === 1 ? line : e.deltaMode === 2 ? paperPane.clientWidth : 1;
    paperPane.scrollTop += e.deltaY * unitY;
    paperPane.scrollLeft += e.deltaX * unitX;
  }, { passive: false });

  let dragging = false;
  let pointerId = null;
  const onMove = (e) => {
    if (!dragging || e.pointerId !== pointerId) return;
    if (!divider.isConnected) { onUp(); return; }
    const rect = panes.getBoundingClientRect();
    if (!rect.width) return;
    // 右侧面板宽度占比（限制 25% ~ 70%）
    const pct = ((rect.right - e.clientX) / rect.width) * 100;
    // 写进当前文献的会话（宽度跨离开/返回保留，且不污染其它文献）
    state.reader.webAiWidth = Math.min(70, Math.max(25, pct));
    pane.style.flex = `0 0 ${state.reader.webAiWidth}%`;
    scheduleWebAiSync();
  };
  const onUp = (e) => {
    if (!dragging) return;
    if (e?.pointerId != null && e.pointerId !== pointerId) return;
    dragging = false;
    if (cancelWebAiResize === onUp) cancelWebAiResize = null;
    divider.classList.remove("dragging");
    document.body.classList.remove("webai-resizing");
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    document.removeEventListener("pointercancel", onUp);
    document.removeEventListener("lostpointercapture", onUp);
    window.removeEventListener("blur", onUp);
    if (divider.hasPointerCapture(pointerId)) divider.releasePointerCapture(pointerId);
    pointerId = null;
    syncWebAiBounds();
  };
  divider.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || dragging) return;
    e.preventDefault();
    dragging = true;
    cancelWebAiResize = onUp;
    pointerId = e.pointerId;
    divider.setPointerCapture(pointerId);
    divider.classList.add("dragging");
    document.body.classList.add("webai-resizing");
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    // 元素在切换页面时移除，lostpointercapture 会发给 document。
    document.addEventListener("lostpointercapture", onUp);
    window.addEventListener("blur", onUp);
  });
}

/* 每次渲染阅读器后调用：恢复内嵌 AI 的宽度，并在需要时重新对齐原生层 */
function afterReaderRender() {
  const r = state.reader;
  // body.webai-open 让 CSS 把 toast 挪到「论文那一半」的中间（见 #toast-root 规则）
  document.body.classList.toggle("webai-open", !!r.webAi);
  if (!r.webAi) {
    // 面板没了 → 隐藏原生层（窗口与登录会话都保留）。
    // 走统一队列，别直接发（会和拖动中的那条在途请求抢顺序，把窗口又挪回旧位置）
    hideWebAiNative();
    return;
  }
  const pane = document.getElementById("pane-webai");
  if (pane) pane.style.flex = `0 0 ${r.webAiWidth || 46}%`;
  // webAiController.owner 不是当前文献（例如快速切到另一篇还没打开过网页 AI 的文献），
  // 不能把别人的窗口挪到这个矩形上；先隐藏，等用户在本篇点开时再重新 embed。
  if (webAiController.owner !== state.route.id) {
    hideWebAiNative();
    return;
  }
  bindWebAiResize();
  scheduleWebAiSync();
  scheduleWebAiOcclusionCheck();
}

/* 全局：窗口尺寸变化 / 页面滚动时保持原生层贴合 */
window.addEventListener("resize", scheduleWebAiSync);
window.addEventListener("scroll", scheduleWebAiSync, true);
window.addEventListener("resize", scheduleWebAiOcclusionCheck);
if (window.lithub?.webAi?.onRelayout) window.lithub.webAi.onRelayout(scheduleWebAiSync);
if (window.lithub?.browser && !window.lithub?.webAi) {
  // 纯 browser 模式没有 onRelayout 通道，用 window resize 兜底（已绑定）
}
/* 兜底：任何往 overlay-root 里加/删浮层的操作都重新评估一次遮挡关系
   （站点选择、右键菜单、标签浮层、笔记/AI 抽屉都是直接 append 的） */
(function watchOverlays() {
  const root = document.getElementById("overlay-root");
  if (!root || typeof MutationObserver === "undefined") return;
  new MutationObserver(() => scheduleWebAiOcclusionCheck()).observe(root, { childList: true });
})();

function disposePdfHosts() {
  $$(".pane").forEach((pane) => { if (pane._pdf) PdfView.dispose(pane); });
}

function mountPdfHosts(p) {
  mountPdfHosts._paper = p;
  $$(".pdf-host").forEach(async (host) => {
    const pane = host.parentElement;
    host.remove();
    const opts = { fit: state.reader.fit, zoom: state.reader.zoom };
    try {
      if (host.dataset.srcCompare) {
        // 左右并排对照版：单文档（页宽 = 原文 + 译文），按页面宽度自适应
        await PdfView.mount(pane, host.dataset.srcCompare, opts);
      } else if (host.dataset.srcEn && host.dataset.srcZh) {
        await PdfView.mountBilingual(pane, host.dataset.srcEn, host.dataset.srcZh, opts);
      } else {
        await PdfView.mount(pane, host.dataset.src, opts);
      }
      if (state.route.view !== "reader" || state.route.id !== p.id || !pane.isConnected) return;
      restoreReaderScroll(p.id);
      updateZoomLabel();
      // PDF 就绪后加载该文献的批注并绘制
      await loadAnnotations(p);
      applyNoteReference(p, pane);
    } catch (err) {
      if (!pane.isConnected || err?.name === "AbortException") return;
      pane.insertAdjacentHTML("beforeend",
        `<div class="pane-placeholder"><div class="ph-ico">${I("alert", 24)}</div><h3>PDF 渲染失败</h3><p>${esc(String(err.message || err))}</p></div>`);
    }
  });
}

/* ---------------- 阅读器缩放 ---------------- */

const readerPanes = () => ["#pane-en", "#pane-zh", "#pane-dual2"].map((s) => $(s)).filter((p) => p?._pdf);

/* 缩放标签：显示「适宽 / 适页」或实际倍率；到达上下限时按钮置灰 */
function updateZoomLabel() {
  const el = $(".zoom-pct");
  const r = state.reader;
  if (el) {
    if (r.fit === "width") el.textContent = "适宽";
    else if (r.fit === "page") el.textContent = "适页";
    else el.textContent = Math.round(r.zoom * 100) + "%";
  }
  const sel = $("#zoom-sel");
  if (sel) {
    if (r.fit === "manual") {
      const hit = [...sel.options].find((o) => Math.abs(Number(o.value) - r.zoom) < 0.01);
      sel.value = hit ? hit.value : "";
    } else {
      sel.value = r.fit;
    }
  }
  // 到达上下限时禁用对应按钮，给出「已到顶」的明确反馈
  const atMax = r.fit === "manual" && r.zoom >= PdfView.MAX_ZOOM - 1e-6;
  const atMin = r.fit === "manual" && r.zoom <= PdfView.MIN_ZOOM + 1e-6;
  const zin = $('[data-action="zoom"][data-id="1"]');
  const zout = $('[data-action="zoom"][data-id="-1"]');
  if (zin) { zin.disabled = atMax; zin.title = atMax ? `已达最大放大 ${Math.round(PdfView.MAX_ZOOM * 100)}%` : "放大（Ctrl+=）"; }
  if (zout) { zout.disabled = atMin; zout.title = atMin ? `已达最小缩放 ${Math.round(PdfView.MIN_ZOOM * 100)}%` : "缩小（Ctrl+-）"; }
  if (el) el.classList.toggle("at-limit", atMax || atMin);
}

/* 应用缩放：mode = "manual"(按 zoom) | "width" | "page"
   返回是否真正发生了变化（用于判断是否已到上限/下限） */
function applyReaderZoom(zoom, fit, point) {
  const r = state.reader;
  let changed = true;
  if (fit) {
    changed = r.fit !== fit;
    r.fit = fit;
  } else {
    const next = Math.min(PdfView.MAX_ZOOM, Math.max(PdfView.MIN_ZOOM, zoom));
    changed = Math.abs(next - r.zoom) > 1e-6 || r.fit !== "manual";
    r.zoom = next;
    r.fit = "manual";
  }
  const panes = readerPanes();
  if (panes.length) {
    for (const pane of panes) {
      if (fit) PdfView.setFit(pane, fit);
      else PdfView.setZoom(pane, r.zoom, point);
    }
  } else if (mountPdfHosts._paper) {
    // 尚未挂载完成：重新挂载会用新参数
    mountPdfHosts(mountPdfHosts._paper);
  }
  updateZoomLabel();
  return changed;
}

/* ---------------- 标签编辑（阅读器工具栏弹层） ---------------- */

function tagPopInner(p) {
  const pool = allTags().map(([t]) => t).filter((t) => !p.tags.includes(t)).slice(0, 10);
  return `
    <div class="tag-pop-head">标签</div>
    <div class="tag-pop-cur">
      ${p.tags.length ? p.tags.map((t) => `
        <span class="tag-chip tag-on">${esc(t)}<button class="tag-x" data-action="tag-remove" data-id="${p.id}" data-tag="${esc(t)}" title="移除">${I("x", 11)}</button></span>`).join("")
        : '<span class="tag-empty">暂无标签，在下方输入添加</span>'}
    </div>
    ${pool.length ? `<div class="tag-pop-pool">${pool.map((t) => `<button class="tag-chip" data-action="tag-add" data-id="${p.id}" data-tag="${esc(t)}">${esc(t)}</button>`).join("")}</div>` : ""}
    <div class="tag-pop-add">
      <input id="tag-input" type="text" placeholder="输入标签，回车添加（逗号分隔可批量）" maxlength="40">
      <button class="btn sm" data-action="tag-add-input" data-id="${p.id}">${I("plus", 13)}添加</button>
    </div>`;
}

function refreshTagPop(p) {
  const pop = document.getElementById("tag-pop");
  if (pop && p) pop.innerHTML = tagPopInner(p);
}

function setPaperTags(paperId, tags) {
  const p = paperById(paperId);
  if (!p) return;
  const clean = [];
  for (let t of tags) {
    t = String(t).trim().slice(0, 16);
    if (t && !clean.includes(t)) clean.push(t);
    if (clean.length >= 12) break;
  }
  p.tags = clean;
  markSidebarDirty();
  if (LithubAPI.live && p.live) LithubAPI.updatePaper(paperId, { tags: clean }).catch(() => toast("标签同步失败", "err"));
  refreshTagPop(p);
}

function addTagsFromInput(p) {
  const input = document.getElementById("tag-input");
  if (!input || !input.value.trim()) return;
  const parts = input.value.split(/[,,、\s]+/).map((s) => s.trim()).filter(Boolean);
  setPaperTags(p.id, [...(p.tags || []), ...parts]);
  input.value = "";
  input.focus();
}

/* ---------------- 拖拽：文献拖入分类 / PDF 拖入导入 ---------------- */

let dragDepth = 0;

function setPaperCat(paperId, catId) {
  const p = paperById(paperId);
  if (!p || p.cat === catId) return false;
  p.cat = catId;
  p.venue = catName(catId) || p.venue; // 行内分类名随移动更新
  markSidebarDirty();
  if (LithubAPI.live && p.live) {
    LithubAPI.updatePaper(paperId, { cat: catId }).catch(() => toast("分类同步失败", "err"));
  }
  return true;
}

function movePaperToCat(paperId, catId) {
  if (!setPaperCat(paperId, catId)) return;
  toast(`已移动到「${catName(catId) || "分类"}」`);
  render();
}

async function importDroppedFiles(files) {
  const pdfs = files.filter((f) => f.name.toLowerCase().endsWith(".pdf"));
  if (!pdfs.length) { toast("请拖入 PDF 文件", "err"); return; }
  if (!LithubAPI.live) { toast("本地服务未启动，无法导入（演示模式）", "err"); return; }
  const cat = state.filter.cat || "local";
  let ok = 0, dup = 0, fail = 0;
  for (const f of pdfs) {
    try { await LithubAPI.importFile(f, cat); ok++; }
    catch (e) {
      if (String(e.message || "").includes("已导入过")) dup++; else fail++;
    }
  }
  await loadLiveLibrary();
  markSidebarDirty();
  render();
  const parts = [];
  if (ok) parts.push(`导入 ${ok} 篇`);
  if (dup) parts.push(`跳过重复 ${dup} 篇`);
  if (fail) parts.push(`失败 ${fail} 篇`);
  toast(parts.join("，") || "没有可导入的文件", ok ? "ok" : "err");
}

document.addEventListener("dragstart", (e) => {
  const row = e.target.closest?.(".row, .gcard");
  if (row && state.route.view === "library") {
    e.dataTransfer.setData("text/paper", row.dataset.id);
    e.dataTransfer.effectAllowed = "move";
    row.classList.add("dragging");
  }
});
document.addEventListener("dragend", () => {
  document.querySelectorAll(".dragging").forEach((el) => el.classList.remove("dragging"));
  dragDepth = 0;
  document.getElementById("drop-overlay")?.setAttribute("hidden", "");
  document.querySelectorAll("#sidebar .nav-item.drop-hint").forEach((el) => el.classList.remove("drop-hint"));
});

document.addEventListener("dragenter", (e) => {
  if (e.dataTransfer?.types.includes("Files") && state.route.view === "library") {
    dragDepth++;
    document.getElementById("drop-overlay")?.removeAttribute("hidden");
  }
});
document.addEventListener("dragover", (e) => {
  const types = e.dataTransfer?.types || [];
  const catItem = e.target.closest?.('#sidebar [data-action="cat"]');
  if (catItem && types.includes("text/paper")) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    document.querySelectorAll("#sidebar .nav-item.drop-hint").forEach((el) => { if (el !== catItem) el.classList.remove("drop-hint"); });
    catItem.classList.add("drop-hint");
    return;
  }
  document.querySelectorAll("#sidebar .nav-item.drop-hint").forEach((el) => el.classList.remove("drop-hint"));
  if (types.includes("Files")) {
    e.preventDefault(); // 阻止浏览器直接打开 PDF
    if (state.route.view === "library") {
      e.dataTransfer.dropEffect = "copy";
      document.getElementById("drop-overlay")?.removeAttribute("hidden");
    }
  }
});
document.addEventListener("dragleave", (e) => {
  if (e.dataTransfer?.types.includes("Files")) {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) document.getElementById("drop-overlay")?.setAttribute("hidden", "");
  }
  if (!e.relatedTarget) {
    document.querySelectorAll("#sidebar .nav-item.drop-hint").forEach((el) => el.classList.remove("drop-hint"));
  }
});
document.addEventListener("drop", (e) => {
  const catItem = e.target.closest?.('#sidebar [data-action="cat"]');
  const types = e.dataTransfer?.types || [];
  if (catItem && types.includes("text/paper")) {
    e.preventDefault();
    const paperId = e.dataTransfer.getData("text/paper");
    document.querySelectorAll("#sidebar .nav-item.drop-hint").forEach((el) => el.classList.remove("drop-hint"));
    movePaperToCat(paperId, catItem.dataset.id);
    return;
  }
  if (e.dataTransfer?.files?.length) {
    e.preventDefault(); // 阻止浏览器直接打开 PDF
    dragDepth = 0;
    document.getElementById("drop-overlay")?.setAttribute("hidden", "");
    if (state.route.view === "library") importDroppedFiles([...e.dataTransfer.files]);
    else toast("请回到文献库页面拖入 PDF 完成导入");
  }
});

// 拖入导入的全屏提示层
document.body.insertAdjacentHTML("beforeend", `
  <div id="drop-overlay" hidden>
    <div class="drop-box">${I("upload", 30)}<span>松开导入 PDF 文献</span><span class="drop-sub">支持一次拖入多个文件 · 将导入到当前分类</span></div>
  </div>`);

/* ---------------- Markdown 笔记面板 ----------------
   渲染：marked（GFM）+ KaTeX（$…$ / $$…$$ / \( \) / \[ \] 行内与块级公式）
   编辑：左侧源码 / 右侧实时预览，或纯编辑、纯阅读三态
   图片：支持粘贴、拖入、点按钮选择，上传到 sidecar 后插入 ![](url)
   保存：输入停 800ms 自动保存，Ctrl+S 立即保存
------------------------------------------------- */

/* 笔记编辑器运行时状态（与 aiStream 并列，避免污染 state 快照）
   host: "panel"（阅读器右侧栏）| "page"（文献库打开的独立标签页） */
const noteState = {
  paperId: null,
  host: null,
  notes: [],
  currentId: null,
  dirty: false,
  saveTimer: 0,
  mode: "live",        // live | source | read
  ready: false,        // 编辑器实例是否已就绪
  loading: false,
  query: '',
  generation: 0,
};
const noteDrafts = NoteDraftStore.create({ storage:localStorage,
  save:(paperId, noteId, data)=>LithubAPI.updateNote(paperId, noteId, data) });
const activeNoteDraft = () => noteDrafts.get(noteState.paperId, noteState.currentId);
const noteMatches = e => e && noteState.paperId === e.paperId && noteState.currentId === e.id && NoteEditor.isMounted();
const noteBookmarks = new Map();
function noteBookmark(paperId, noteId, value) {
  const key=`lithub-note-caret:${paperId}:${noteId}`;
  if (value) {
    noteBookmarks.set(key,value);
    try { localStorage.setItem(key,JSON.stringify(value)); } catch {}
    return value;
  }
  if (noteBookmarks.has(key)) return noteBookmarks.get(key);
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function notePreference(paperId, value) {
  const key = `lithub-note-position:${paperId}`;
  try {
    if (value) localStorage.setItem(key, JSON.stringify(value));
    else return JSON.parse(localStorage.getItem(key)) || {};
  } catch {}
  return {};
}
function rememberNotePosition() {
  if (NoteEditor.isMounted() && noteState.currentId && !noteState.loading) {
    const bookmark=NoteEditor.bookmark();
    noteBookmark(noteState.paperId,noteState.currentId,bookmark);
    notePreference(noteState.paperId, { id:noteState.currentId, bookmark });
  }
}

/* 笔记功能是否可用：需要 sidecar 在线（图片与持久化都依赖它） */
const notesEnabled = () => LithubAPI.live;

document.addEventListener('pointerdown', e=>{
  $$('.note-browser[open],.note-outline[open]').forEach(menu=>{ if (!menu.contains(e.target)) menu.open=false; });
});
document.addEventListener('keydown', e=>{
  if (e.key==='Escape') $$('.note-browser[open],.note-outline[open]').forEach(menu=>{menu.open=false});
});

/* 编辑器与 Markdown 渲染全部交给 Vditor（见 frontend/js/note-editor.js）。
   Vditor 自带 Lute 解析器 + KaTeX + highlight.js，所以这里不再需要
   marked / katex 的加载与公式占位符预处理。 */

/* ---------- 面板 / 整页两种容器 ---------- */

/* 笔记切换与编辑模式控件（两种容器共用；id / data-action 必须一致，
   这样 noteState、保存逻辑、图片粘贴等只写一份） */
function noteToolsHTML({ compact = false } = {}) {
  return `
        <label class="select-wrap note-select-compat ${compact ? "note-sel-compact" : "grow"}">
          <select id="note-sel"></select>
        </label>
        <details class="note-browser">
          <summary title="查找与切换笔记">${I('list', 15)}<span id="note-current-label">笔记列表</span></summary>
          <div class="note-browser-pop"><input id="note-search" type="search" placeholder="搜索标题或正文" aria-label="搜索笔记"><div id="note-list"></div></div>
        </details>
        <button class="icon-btn" data-action="note-new" title="新建笔记">${I("plus", 15)}</button>
        <button class="icon-btn danger" data-action="note-del" title="删除当前笔记">${I("trash", 15)}</button>
        <details class="note-outline"><summary title="笔记目录">目录</summary><div id="note-outline-list"></div></details>
        <button class="icon-btn" data-action="note-export" title="导出 Markdown 和图片">${I('external', 15)}</button>
        <div class="seg seg-note-mode" title="视图模式">
          <button class="seg-btn" data-action="note-mode" data-id="live" title="即时渲染（Obsidian 风格：边写边渲染）">${I("sparkle", 13)}</button>
          <button class="seg-btn" data-action="note-mode" data-id="source" title="源码模式（左源码右预览）">${I("columns", 13)}</button>
          <button class="seg-btn" data-action="note-mode" data-id="read" title="只读阅读">${I("book", 13)}</button>
        </div>`;
}

/* 笔记标题：用 label 包一层，点标题行任意位置都能聚焦输入框。
   左侧常驻一枚淡铅笔图标 —— 否则无边框的 input 静态看起来就是一行普通文字，
   用户根本不知道能改（用户反馈过）。图标放前面，紧贴文字，不会被长输入框推到远端。 */
function noteTitleHTML() {
  return `
    <label class="note-title-wrap" title="点击可修改笔记名称">
      <span class="note-title-edit" aria-hidden="true">${I("pencil", 13)}</span>
      <input id="note-title" type="text" placeholder="未命名笔记" maxlength="120"
             aria-label="笔记名称">
    </label>`;
}

function noteBodyHTML() {
  return `
    <div class="note-uploads" id="note-uploads" aria-live="polite"></div>
    <div class="note-body" id="note-body">
      <div class="note-editor-wrap" id="note-editor-wrap">
        <div class="note-drop-hint" id="note-drop-hint">松开以插入图片</div>
      </div>
    </div>
    <footer class="ai-foot">
      <span class="ai-meta" id="note-meta"></span>
      <div class="ai-foot-btns">
        <button class="btn sm" data-action="note-insert-image">${I("upload", 14)}插入图片</button>
        <button class="btn sm" data-action="note-save">${I("check", 14)}保存</button>
    </div>
    </footer>`;
}

/* 右侧栏容器（阅读器内）：标题栏 + 工具行 + 标题输入 + 编辑器
   左边缘带一条可拖拽的把手（拖动改变宽度，宽度记在 state.reader.notePanelWidth） */
function notePanelHTML(p) {
  return `
  <aside class="ai-panel note-panel open" id="note-panel">
    <div class="note-panel-grip" data-note-grip title="拖动调整笔记宽度（双击恢复默认）"></div>
    <header class="ai-head">
      <div class="ai-head-title">${I("pencil", 16)}<h2>笔记</h2>
        <button class="note-save-state" id="note-save-state" data-action="note-save" title="点击保存或重试" aria-live="polite"></button>
        <button class="icon-btn sm" data-action="note-popout" title="在新标签页中打开（更大编辑区）">${I("external", 15)}</button>
        <button class="icon-btn sm" data-action="note-close" title="关闭笔记面板">${I("x", 15)}</button>
      </div>
      <div class="note-toolbar">${noteToolsHTML()}</div>
    </header>
    <div class="note-title-row">${noteTitleHTML()}</div>
    ${noteBodyHTML()}
  </aside>`;
}

/* 整页容器（文献库中点击「笔记」→ 新标签页）。
   与面板完全共用编辑器逻辑，只是占满 #view 而不是从右侧滑出。
   布局压成两行 chrome：文献信息条 + 「标题输入 + 工具箱」合一行，
   避免三行灰框把编辑区高度吃掉。 */
function notePageHTML(p) {
  return `
  <div class="note-page" id="note-page">
    <div class="note-sheet" id="note-sheet">
      <div class="note-grip" data-note-page-grip
           title="拖动调整笔记宽度（双击恢复默认）"></div>
      <div class="note-page-head">
        <div class="note-page-lead">
          <button class="icon-btn" data-action="route" data-id="library" title="返回文献库">${I("arrowLeft", 18)}</button>
          <div class="note-page-doc">
            <div class="overline">NOTE · 笔记</div>
            <h1 title="${esc(p?.title || "")}">${esc(p?.title || "笔记")}</h1>
            <p>${esc(p?.authors || "")}${p?.venue ? ` · <i>${esc(p.venue)}</i>` : ""} ${p?.year || ""}<span id="note-page-count"></span></p>
          </div>
        </div>
        <div class="note-page-acts">
          <button class="note-save-state" id="note-save-state" data-action="note-save" title="点击保存或重试" aria-live="polite"></button>
          <button class="btn sm" data-action="open-note-pdf" data-id="${p?.id || ""}" title="在阅读器中打开原文">${I("file", 14)}原文 PDF</button>
          <button class="icon-btn sm" data-action="note-tab-close" title="关闭笔记标签页">${I("x", 15)}</button>
        </div>
      </div>
      <div class="note-page-bar">
        <div class="note-title-row">${noteTitleHTML()}</div>
        <div class="note-toolbar">${noteToolsHTML({ compact: true })}</div>
      </div>
      ${noteBodyHTML()}
    </div>
  </div>`;
}

/* ---------- 整页笔记的宽度拖拽 ----------
   纸是居中布局的，所以拖右边缘时右边缘要刚好跟着鼠标：
   纸中心 x 固定（= 页面内容区中心），newWidth = 2 × (指针x − 中心x)。
   这样拖右边只会改变宽度，纸自己重新居中，边缘始终贴住光标。 */
const NOTE_PAGE_MIN_W = 520;    // 再窄正文就没法读了
/* 默认宽度：铺满 1500px 窗口时正文一行过长（约 130 字），读起来很累。
   默认给一个「适中」的版心，窗口更窄时自动收回可用宽度。 */
const NOTE_PAGE_DEFAULT_W = 1040;

function notePageMaxWidth() {
  const page = $("#note-page");
  const w = page ? page.getBoundingClientRect().width : window.innerWidth;
  // 减去 .note-page 的左右 40px 内边距
  return Math.max(NOTE_PAGE_MIN_W, Math.round(w - 80));
}

/* 默认宽度：取 NOTE_PAGE_DEFAULT_W 与可用宽度的较小值 */
function notePageDefaultWidth() {
  return Math.min(NOTE_PAGE_DEFAULT_W, notePageMaxWidth());
}

/* px = null 表示「恢复默认宽度」（默认值是适中的版心，不是铺满） */
function setNotePageWidth(px) {
  const page = $("#note-page");
  if (!page) return;
  if (px == null) {
    state.notePageWidth = notePageDefaultWidth();
  } else {
    state.notePageWidth = Math.round(Math.min(notePageMaxWidth(), Math.max(NOTE_PAGE_MIN_W, px)));
  }
  page.style.setProperty("--note-page-w", state.notePageWidth + "px");
  // 宽度不超过可用宽度时保持居中；窗口变窄后 clamp 到 max，仍然居中
  page.setAttribute("data-has-width", "");
}

function makeNotePageResizable() {
  const page = $("#note-page");
  const grip = page?.querySelector("[data-note-page-grip]");
  if (!page || !grip) return;
  // 首次打开用默认宽度；切标签页回来时延续上次调好的宽度
  setNotePageWidth(state.notePageWidth);

  let dragging = false;

  const onMove = (e) => {
    if (!dragging) return;
    const r = page.getBoundingClientRect();
    setNotePageWidth(2 * (e.clientX - (r.left + r.width / 2)));
  };
  const onUp = (e) => {
    if (!dragging) return;
    dragging = false;
    grip.classList.remove("dragging");
    document.body.classList.remove("note-resizing");
    try { grip.releasePointerCapture(e.pointerId); } catch {}
    grip.removeEventListener("pointermove", onMove);
    grip.removeEventListener("pointerup", onUp);
    grip.removeEventListener("pointercancel", onUp);
  };

  grip.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    dragging = true;
    grip.classList.add("dragging");
    document.body.classList.add("note-resizing");
    grip.setPointerCapture(e.pointerId);
    grip.addEventListener("pointermove", onMove);
    grip.addEventListener("pointerup", onUp);
    grip.addEventListener("pointercancel", onUp);
  });

  // 双击把手：恢复默认宽度（适中的版心）
  grip.addEventListener("dblclick", () => setNotePageWidth(null));

  // 窗口变窄时把宽度收回可用范围
  if (!makeNotePageResizable._onResize) {
    makeNotePageResizable._onResize = () => {
      if (state.notePageWidth) setNotePageWidth(state.notePageWidth);
    };
    window.addEventListener("resize", makeNotePageResizable._onResize);
  }
}

/* ---------- 侧栏宽度拖拽 ----------
   面板贴着窗口右边缘（right: 0），所以「往左拖」= 变宽：宽度由指针到窗口右缘的距离决定。
   做法与批注气泡拖动一致：Pointer Events + setPointerCapture，保证指针移出手柄
   （甚至移出窗口）时仍能收到 move/up，不会出现「拖着拖着就断了」。 */
const NOTE_PANEL_MIN_W = 360;   // 再窄编辑器就没法用了
const NOTE_PANEL_MAX_W = 1200;
const NOTE_PANEL_DEFAULT_W = 760;

function notePanelMaxWidth() {
  // 至少给 PDF 留 320px，否则缩放后的页面会被挤到看不清
  return Math.min(NOTE_PANEL_MAX_W, Math.max(NOTE_PANEL_MIN_W, window.innerWidth - 320));
}

function setNotePanelWidth(px) {
  const w = Math.round(Math.min(notePanelMaxWidth(), Math.max(NOTE_PANEL_MIN_W, px)));
  state.reader.notePanelWidth = w;
  const panel = $("#note-panel");
  if (panel) panel.style.width = w + "px";
  syncNotePanelLayout(w);
  return w;
}

/* The fixed note panel starts below the shared toolbar. Only PDF content gives up width.
   宽度通过 CSS 变量传递，避免每次拖动都写一条内联样式。
   这个函数以「DOM 里是否真有 #note-panel」为唯一判据，所以面板被别的路径
   移除（清空 overlay-root、切到 AI 面板）之后调用一次就能自动收干净。 */
let notePanelLayoutObserver = null;
function syncNotePanelLayout(w) {
  const panel = $("#note-panel");
  if (!panel) {
    document.body.classList.remove("note-open");
    document.body.style.removeProperty("--note-w");
    document.body.style.removeProperty("--note-top");
    notePanelLayoutObserver?.disconnect();
    notePanelLayoutObserver = null;
    return;
  }
  const width = Math.round(w ?? panel.getBoundingClientRect().width);
  document.body.style.setProperty("--note-w", width + "px");
  document.body.classList.add("note-open");
  const bar = $(".reader-bar");
  const alignTop = () => {
    if (bar?.isConnected && $("#note-panel")) {
      document.body.style.setProperty("--note-top", `${bar.getBoundingClientRect().bottom}px`);
    }
  };
  alignTop();
  if (bar && !notePanelLayoutObserver) {
    notePanelLayoutObserver = new ResizeObserver(alignTop);
    notePanelLayoutObserver.observe(bar, { box: "border-box" });
    const titlebar = $("#titlebar");
    if (titlebar) notePanelLayoutObserver.observe(titlebar, { box: "border-box" });
  }
}

function makeNotePanelResizable(panel) {
  const grip = panel?.querySelector("[data-note-grip]");
  if (!grip) return;
  // 挂载时应用上次的宽度（新建面板默认 760，但用户拖过的宽度要延续）
  setNotePanelWidth(state.reader.notePanelWidth || NOTE_PANEL_DEFAULT_W);

  let startX = 0, startW = 0, dragging = false;

  const onMove = (e) => {
    if (!dragging) return;
    // 往左拖 → 指针 x 变小 → 面板变宽
    setNotePanelWidth(startW + (startX - e.clientX));
  };
  const onUp = (e) => {
    if (!dragging) return;
    dragging = false;
    grip.classList.remove("dragging");
    document.body.classList.remove("note-resizing");
    // 指针可能已被系统释放，release 在未捕获时会抛错，忽略即可
    try { grip.releasePointerCapture(e.pointerId); } catch {}
    grip.removeEventListener("pointermove", onMove);
    grip.removeEventListener("pointerup", onUp);
    grip.removeEventListener("pointercancel", onUp);
  };

  grip.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;              // 只响应左键 / 触摸
    e.preventDefault();
    dragging = true;
    startX = e.clientX;
    startW = panel.getBoundingClientRect().width;
    grip.classList.add("dragging");
    document.body.classList.add("note-resizing");  // 拖动时禁用文本选择
    grip.setPointerCapture(e.pointerId);
    grip.addEventListener("pointermove", onMove);
    grip.addEventListener("pointerup", onUp);
    grip.addEventListener("pointercancel", onUp);
  });

  // 双击把手：恢复默认宽度
  grip.addEventListener("dblclick", () => setNotePanelWidth(NOTE_PANEL_DEFAULT_W));

  // 窗口变窄时把面板收回可用范围，避免它把 PDF 挤没
  if (!makeNotePanelResizable._onResize) {
    makeNotePanelResizable._onResize = () => {
      const p = $("#note-panel");
      if (p) setNotePanelWidth(p.getBoundingClientRect().width);
    };
    window.addEventListener("resize", makeNotePanelResizable._onResize);
  }
}

/* 关闭笔记面板：连同「让出宽度」的布局标记一起清掉，
   否则阅读器会一直留着右侧空白（PDF 却已经回到全宽）。 */
function closeNotePanel() {
  if (noteState.host==='panel') {
    flushNoteEditor(); NoteEditor.destroy(); noteState.ready=false; noteState.generation++;
  }
  $("#note-panel")?.remove();
  syncNotePanelLayout(null);
}

/* 打开笔记面板（阅读器右侧栏） */
async function mountNotePanel(p) {
  // 覆盖 DOM 前先落盘：saveCurrentNote 是同步读编辑器的，之后再等就来不及了
  flushNoteEditor();
  $("#overlay-root").innerHTML = notePanelHTML(p);
  noteState.host = "panel";
  makeNotePanelResizable($("#note-panel"));
  await initNoteEditor(p);
}

/* 打开整页笔记标签页 */
async function mountNotePage(p) {
  const view = $("#view");
  if (!view) return;
  flushNoteEditor();
  view.innerHTML = notePageHTML(p);
  noteState.host = "page";
  makeNotePageResizable();
  await initNoteEditor(p);
}

/* 在 DOM 移除前同步留草稿，再按笔记排队保存；重复快照共用同一个请求。 */
function flushNoteEditor() {
  clearTimeout(noteState.saveTimer);
  rememberNotePosition();
  if (!NoteEditor.isMounted() || noteState.loading) return Promise.resolve(true);
  captureNoteDraft();
  return saveCurrentNote(true);
}
/* Each async mount owns a generation and a concrete host. Late results cannot replace another note. */
async function initNoteEditor(p) {
  const generation = ++noteState.generation;
  const host = $('#note-editor-wrap');
  noteState.paperId = p.id;
  noteState.currentId = null;
  noteState.dirty = false;
  noteState.ready = false;
  noteState.loading = true;
  if ($('#note-title')) $('#note-title').readOnly=true;
  const current = () => generation === noteState.generation && host?.isConnected && $('#note-editor-wrap') === host;
  const ok = await mountNoteEditor();
  if (!current()) return;
  if (!ok) { noteState.loading = false; return; }
  if (!LithubAPI.live) {
    noteState.notes = [{ id:'demo', title:'示例笔记', content:defaultDemoNote(), created:'', updated:'' }];
    noteState.loading = false;
    selectNote('demo');
    setNoteSaveState('演示模式（不保存）');
    return;
  }
  try {
    const readVersion = noteDrafts.version();
    const notes = await LithubAPI.notes(p.id);
    if (!current()) return;
    notes.forEach(note=>noteDrafts.open(p.id,note,readVersion));
    noteState.notes = notes;
    if (!notes.length) {
      const note = await LithubAPI.createNote(p.id, { title:'', content:'' });
      if (!current()) return;
      noteState.notes = [note];
    }
    noteState.loading = false;
    const last = notePreference(p.id);
    const first = noteState.notes.find(n=>n.id===last.id) || noteState.notes[0];
    selectNote(first.id, last.id===first.id ? last.bookmark : null);
    syncNoteCount(p.id);
  } catch (error) {
    if (!current()) return;
    noteState.loading = false;
    noteState.notes = [];
    setNoteSaveState('加载失败', 'err');
    const wrap = $('#note-editor-wrap');
    NoteEditor.destroy();
    wrap.innerHTML = '<div class="note-editor-fail">笔记加载失败，已有内容未改动。<button class="btn sm" data-action="note-reload">重试</button></div>';
  }
}

function syncNoteCount(paperId) {
  const p = paperById(paperId);
  if (!p) return;
  const n = noteState.paperId === paperId ? noteState.notes.length : 0;
  if (p.noteCount === n) return;
  p.noteCount = n;
  const row = $(`.att-note-add[data-id="${paperId}"]`);
  if (!row) return;
  row.querySelector(".att-meta").textContent = n ? `${n} 条` : "点击开始记录";
  const label = row.querySelector(".att-label");
  // 保留「空」小胶囊的增删，但不破坏标签文本
  label.innerHTML = `笔记${n ? "" : '<span class="pill pill-new">空</span>'}`;
  row.title = n ? `${n} 条笔记，在新标签页中打开` : "新建笔记（在新标签页中打开）";
}

function defaultDemoNote() {
  return [
    "# 示例笔记",
    "",
    "这是一条演示笔记，sidecar 未连接时只能预览、不会保存。",
    "",
    "## 公式",
    "",
    "行内：$E = mc^2$，块级：",
    "",
    "$$",
    "\\mathrm{Attention}(Q,K,V) = \\mathrm{softmax}\\left(\\frac{QK^\\top}{\\sqrt{d_k}}\\right)V",
    "$$",
    "",
    "## 列表与代码",
    "",
    "- 支持任务列表",
    "- [x] 已完成项",
    "- [ ] 待办项",
    "",
    "```python",
    "def hello(name: str) -> str:",
    "    return f'Hello, {name}'",
    "```",
  ].join("\n");
}

function renderNoteSelect() {
  const sel = $("#note-sel");
  if (!sel) return;
  sel.innerHTML = noteState.notes.length
    ? noteState.notes.map((n) => `<option value="${n.id}" ${n.id === noteState.currentId ? "selected" : ""}>${esc(n.title || "未命名笔记")}</option>`).join("")
    : `<option value="">（暂无笔记）</option>`;
  // 只有一条笔记时隐藏下拉框：此时它和下方标题输入框显示同一个名字，纯属重复。
  // 点「+」建第二条后会自动出现。
  const wrap = sel.closest(".select-wrap");
  if (wrap) wrap.hidden = noteState.notes.length <= 1;
  refreshNoteMeta();
  renderNoteList();
  updateNoteOutline();
}

function renderNoteList() {
  const list = $('#note-list');
  if (!list) return;
  const query = ($('#note-search')?.value || '').trim().toLocaleLowerCase();
  const notes = noteState.notes.map(n=>({ ...n, ...(noteDrafts.get(noteState.paperId,n.id)?.data || {}) }))
    .filter(n=>!query || `${n.title}\n${n.content}`.toLocaleLowerCase().includes(query))
    .sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned) || (b.updated || '').localeCompare(a.updated || ''));
  list.innerHTML = notes.length ? notes.map(n=>`<div class="note-list-row ${n.id===noteState.currentId?'active':''}">
    <button data-action="note-select" data-id="${esc(n.id)}"><strong>${esc(n.title || '未命名笔记')}</strong>
      <span>${esc(notePreview(n.content) || '空白笔记')}</span>
      <small>${esc((n.updated || '').replace('T',' '))}</small></button>
    <button class="icon-btn" data-action="note-pin" data-id="${esc(n.id)}" aria-label="${n.pinned?'取消置顶':'置顶笔记'}" title="${n.pinned?'取消置顶':'置顶笔记'}">${I('star',14)}</button></div>`).join('')
    : '<p class="note-list-empty">没有匹配的笔记</p>';
  const label = $('#note-current-label');
  if (label) label.textContent = `笔记 ${noteState.notes.length}`;
}
function notePreview(content) {
  return (content || '').replace(/!\[[^\]]*\]\([^)]*\)|<img\b[^>]*>/gi,' [图片] ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g,'$1').replace(/[#*\x60>\[\]]/g,'').replace(/\s+/g,' ').trim().slice(0,70);
}
async function toggleNotePin(id) {
  const note = noteState.notes.find(n=>n.id===id);
  if (!note) return;
  if (id===noteState.currentId) captureNoteDraft();
  const entry = noteDrafts.open(noteState.paperId, note);
  noteDrafts.change(entry, { ...entry.data, pinned:!entry.data.pinned });
  renderNoteList();
  const result = await noteDrafts.save(entry);
  if (noteState.paperId===entry.paperId) {
    if (result.ok) {
      const index = noteState.notes.findIndex(n=>n.id===entry.id);
      if (index>=0) noteState.notes[index]=entry.server;
    }
    renderNoteList(); showNoteSaveResult(entry);
  }
}
function updateNoteOutline() {
  const list = $('#note-outline-list');
  if (!list || !NoteEditor.isMounted()) return;
  const headings = NoteEditor.headings();
  list.innerHTML = headings.length ? headings.map((h,i)=>`<button data-action="note-heading" data-id="${i}" style="padding-left:${12+(h.level-1)*12}px">${esc(h.text)}</button>`).join('')
    : '<p class="note-list-empty">使用标题组织长笔记</p>';
}

/* 整页/面板的辅助元信息：笔记条数、字数与更新时间 */
function refreshNoteMeta() {
  const n = noteState.notes.length;
  const counts = $("#note-page-count");
  if (counts) counts.textContent = n ? ` · ${n} 条笔记` : "";
}

/* 选中某条笔记并填入编辑器 */
function selectNote(id, bookmark = null) {
  const note = noteState.notes.find(n=>n.id===id);
  if (!note) return;
  noteState.currentId = id;
  bookmark ||= noteBookmark(noteState.paperId,id);
  const entry = noteDrafts.open(noteState.paperId, note);
  state.noteTitles[noteState.paperId] = entry.data.title;
  fillNoteForm({ ...note, ...entry.data });
  noteState.dirty = entry.dirty;
  renderNoteSelect();
  updateNoteTabTitle();
  if (bookmark) NoteEditor.restoreBookmark(bookmark);
  notePreference(noteState.paperId, { id, bookmark:bookmark || null });
  setNoteSaveState(entry.dirty ? '已恢复本地草稿，待保存' : '', entry.dirty ? 'pending' : '');
  if (entry.dirty && LithubAPI.live) {
    clearTimeout(noteState.saveTimer);
    noteState.saveTimer = setTimeout(()=>saveCurrentNote(true), 800);
  }
}
async function switchNote(id) {
  if (id===noteState.currentId || noteState.loading) return;
  // Draft is synchronously captured before replacing the editor. Network saves may finish later.
  flushNoteEditor();
  selectNote(id);
  $('.note-browser')?.removeAttribute('open');
}

/* 笔记标签页的可读标题：用户起过名就用笔记标题，否则退回文献标题
   （后端把空标题存成「未命名笔记」，这里把这种占位名视为未命名） */
function noteTabLabel(paperId) {
  const t = (state.noteTitles[paperId] || "").trim();
  const paper = paperById(paperId);
  const named = t && t !== "未命名笔记";
  return named ? `笔记 · ${t}` : `笔记 · ${paper ? paper.title : ""}`;
}

/* 笔记标签页标题跟随笔记标题 */
function updateNoteTabTitle() {
  const pid = noteState.paperId;
  if (!pid) return;
  const label = noteTabLabel(pid);
  const el = document.querySelector(`.tab[data-tab-key="note:${pid}"] .tab-title`);
  if (el) { el.textContent = label; el.closest(".tab").title = label; }
}

function fillNoteForm(note) {
  const title = $("#note-title");
  if (title) {
    title.readOnly = false;
    // 后端把空标题存成占位名「未命名笔记」；回填成空串让 placeholder 显示，
    // 用户点进去直接打字即可，不用先删掉这四个字。
    const t = (note.title || "").trim();
    title.value = t === "未命名笔记" ? "" : t;
  }
  NoteEditor.setValue(note.content || "");
  NoteEditor.setEditable(true);
  layoutNoteMode();
  const meta = $("#note-meta");
  if (meta) {
    meta.textContent = note.updated
      ? `${note.content ? note.content.length : 0} 字 · 更新于 ${note.updated.replace("T", " ")}`
      : "尚未保存";
  }
  noteState.ready = true;
  noteState.dirty = false;
  renderNoteUploads();
}

/* 视图三态：即时渲染 / 源码分屏 / 只读。
   真正的切换交给 NoteEditor（Vditor 4.x 没有 setMode，内部会销毁重建并保留内容） */
function layoutNoteMode() {
  const body = $("#note-body");
  const mode = noteState.mode;
  if (!body) return;
  body.dataset.mode = mode;
  $$(".seg-note-mode .seg-btn").forEach((b) => b.classList.toggle("active", b.dataset.id === mode));
  NoteEditor.setMode(mode);
}

/* 挂载编辑器。内容与回调都走 noteState，两种容器共用 */
async function mountNoteEditor() {
  const host = $("#note-editor-wrap");
  if (!host) return false;
  host.querySelector('.note-editor-fail')?.remove();
  const target = document.createElement("div");
  target.className = "note-vditor-mount";
  host.appendChild(target);
  const ok = await NoteEditor.mount(target, {
    value: "",
    mode: noteState.mode,
    editable: false,
    onChange: () => markNoteDirty(true),
    onSave: () => saveCurrentNote(false),
    onReady: () => updateNoteOutline(),
  });
  if (!host.isConnected || !target.isConnected) return false;
  if (!ok) {
    host.innerHTML = `<div class="note-editor-fail">编辑器资源加载失败：请确认 frontend/vendor/vditor 存在</div>`;
    toast("笔记编辑器加载失败", "err");
  }
  return ok;
}
function setNoteSaveState(text, kind = "") {
  const el = $("#note-save-state");
  if (!el) return;
  el.textContent = text;
  el.className = "note-save-state" + (kind ? " " + kind : "");
}

/* 标记有未保存改动并安排自动保存 */
function captureNoteDraft() {
  if (!noteState.ready || noteState.loading || !NoteEditor.isMounted()) return null;
  const entry = activeNoteDraft();
  if (!entry) return null;
  if (entry.deleting) return entry;
  noteDrafts.change(entry, { ...entry.data, title:$('#note-title')?.value || '', content:NoteEditor.getValue() });
  noteState.dirty = entry.dirty;
  return entry;
}
function markNoteDirty() {
  const entry = captureNoteDraft();
  if (!entry) return;
  setNoteSaveState(entry.storageError ? '草稿备份失败，请保存' : '未保存…', entry.storageError ? 'err' : '');
  updateNoteOutline();
  const meta = $('#note-meta');
  if (meta) meta.textContent = `${entry.data.content.length} 字`;
  clearTimeout(noteState.saveTimer);
  noteState.saveTimer = setTimeout(()=>saveCurrentNote(true), 800);
}
function showNoteSaveResult(entry) {
  if (noteState.paperId === entry.paperId && !entry.error) {
    const index=noteState.notes.findIndex(n=>n.id===entry.id);
    if (index>=0) noteState.notes[index]=entry.server;
    renderNoteList();
  }
  if (!noteMatches(entry)) return;
  noteState.dirty = entry.dirty;
  if (entry.error) setNoteSaveState(entry.storageError ? '保存失败，草稿备份也失败' : '保存失败 · 草稿已保留 · 点击重试', 'err');
  else if (entry.dirty) setNoteSaveState('未保存…');
  else {
    const index = noteState.notes.findIndex(n=>n.id===entry.id);
    if (index>=0) noteState.notes[index] = entry.server;
    renderNoteSelect();
    setNoteSaveState('已保存', 'ok');
    const meta = $('#note-meta');
    if (meta) meta.textContent = `${entry.data.content.length} 字 · 更新于 ${(entry.server.updated || '').replace('T',' ')}`;
  }
}
async function saveCurrentNote(silent = false) {
  if (!LithubAPI.live || noteState.currentId==='demo' || noteState.loading) return false;
  const entry = captureNoteDraft();
  if (!entry) return false;
  clearTimeout(noteState.saveTimer);
  if (entry.dirty) setNoteSaveState('保存中…');
  const result = await noteDrafts.save(entry);
  showNoteSaveResult(entry);
  if (!silent) toast(result.ok ? '笔记已保存' : '保存失败：' + (result.error?.message || '请重试'), result.ok ? 'ok' : 'err');
  return result.ok;
}
window.addEventListener('pagehide',()=>{ captureNoteDraft(); rememberNotePosition(); });
async function createNote() {
  if (!LithubAPI.live || noteState.loading) return;
  flushNoteEditor();
  const paperId = noteState.paperId, generation = noteState.generation;
  try {
    const note = await LithubAPI.createNote(paperId, { title:'', content:'' });
    if (generation!==noteState.generation || paperId!==noteState.paperId || !NoteEditor.isMounted()) return;
    flushNoteEditor();
    noteState.notes.unshift(note);
    selectNote(note.id);
    syncNoteCount(paperId);
    $('#note-title')?.focus();
  } catch (error) { toast('新建失败：' + error.message, 'err'); }
}
async function deleteCurrentNote() {
  if (!LithubAPI.live || noteState.loading) return;
  const entry = captureNoteDraft();
  if (!entry || entry.deleting) return;
  if ([...noteUploads.values()].some(job=>job.entry===entry)) { toast('请先完成或取消图片上传，再删除这条笔记','warn'); return; }
  const paperId = entry.paperId, generation = noteState.generation;
  entry.deleting = true;
  NoteEditor.setEditable(false);
  if ($('#note-title')) $('#note-title').readOnly=true;
  clearTimeout(noteState.saveTimer);
  try {
    // Save what is being deleted so undo restores the latest content, not an older server snapshot.
    const result = await noteDrafts.save(entry);
    if (!result.ok) { toast('保存失败，笔记保留，请重试后再删除', 'err'); return; }
    await LithubAPI.deleteNote(paperId, entry.id);
    noteDrafts.discard(entry);
    if (generation===noteState.generation && noteState.paperId===paperId) {
      noteState.notes = noteState.notes.filter(n=>n.id!==entry.id);
      if (noteState.currentId===entry.id) {
        if (noteState.notes.length) selectNote(noteState.notes[0].id);
        else {
          noteState.currentId = null; noteState.ready = false; noteState.dirty = false;
          $('#note-title').value = ''; NoteEditor.setValue(''); setNoteSaveState('点击 + 新建笔记');
        }
      }
      renderNoteSelect(); syncNoteCount(paperId);
    }
    showNoteUndo(paperId, entry.id);
  } catch (error) { toast('删除失败：' + error.message, 'err'); }
  finally {
    entry.deleting = false;
    if (noteMatches(entry)) { NoteEditor.setEditable(true); $('#note-title').readOnly=false; }
  }
}
function showNoteUndo(paperId, noteId) {
  const el = document.createElement('div');
  el.className = 'toast toast-ok annot-undo-toast';
  el.innerHTML = '<span>笔记已删除</span><button type="button">撤销</button>';
  $('#toast-root').appendChild(el);
  const timer = setTimeout(()=>el.remove(), 10000);
  el.querySelector('button').onclick = async e => {
    e.target.disabled = true;
    try {
      const note = await LithubAPI.restoreNote(paperId, noteId);
      clearTimeout(timer); el.remove();
      if (noteState.paperId===paperId && NoteEditor.isMounted()) {
        if (!noteState.notes.some(n=>n.id===note.id)) noteState.notes.push(note);
        if (!noteState.currentId) selectNote(note.id);
        renderNoteSelect(); syncNoteCount(paperId);
      }
      toast('笔记已恢复');
    } catch (error) { e.target.disabled=false; toast(error.message, 'err'); }
  };
}
async function exportCurrentNote() {
  const entry = captureNoteDraft();
  if (!entry) return;
  if ([...noteUploads.values()].some(job=>job.entry===entry)) { toast('图片上传完成或取消后即可导出','warn'); return; }
  const saved = await noteDrafts.save(entry);
  showNoteSaveResult(entry);
  if (!saved.ok) { toast('请先保存笔记，再导出包含图片的压缩包', 'err'); return; }
  try {
    const blob = await LithubAPI.exportNote(entry.paperId, entry.id);
    const link = document.createElement('a'), url = URL.createObjectURL(blob);
    link.href = url; link.download = (entry.data.title || '未命名笔记').replace(/[<>:"/\\|?*]/g,'_') + '.zip';
    link.click(); setTimeout(()=>URL.revokeObjectURL(url), 1000);
  } catch (error) { toast(error.message, 'err'); }
}

/* ---------- 图片插入 ---------- */

/* 上传单张图片并返回 Markdown 片段 */
async function uploadNoteImage(blob, filename = "image.png") {
  if (!LithubAPI.live) throw new Error("演示模式无法上传图片");
  const r = await LithubAPI.uploadNoteImage(blob, filename);
  return `![${filename.replace(/\.[^.]+$/, "").replace(/[\[\]\\\r\n]/g,' ')}](${API_BASE}${r.url})`;
}

/* 在光标处插入文本（保持滚动位置与选区） */
function insertAtCursor(text) {
  if (!noteState.ready) return;
  NoteEditor.insertValue(text);
  markNoteDirty();
}

/* 处理粘贴 / 拖入的图片文件 */
async function handleNoteImageFiles(files) {
  const entry = captureNoteDraft();
  if (!entry || entry.deleting || !LithubAPI.live) return false;
  const images = [...files].filter((f) => f.type.startsWith("image/"));
  if (!images.length) return false;
  for (const file of images) {
    if (file.size>8*1024*1024) { toast('图片超过 8 MB，请压缩后重试','err'); continue; }
    const id=crypto.randomUUID(), token=`【图片上传中·${id}】`;
    const job={id,entry,file,token,status:'上传中'};
    noteUploads.set(id,job);
    insertAtCursor(`\n${token}\n`);
    renderNoteUploads();
    runNoteUpload(job);
  }
  return true;
}
const noteUploads = new Map();
function renderNoteUploads() {
  const host=$('#note-uploads');
  if (!host) return;
  const jobs=[...noteUploads.values()].filter(j=>noteMatches(j.entry));
  host.innerHTML=jobs.map(j=>`<div><span>${esc(j.file.name)} · ${esc(j.status)}</span>${j.failed?`<button data-action="note-upload-retry" data-id="${j.id}">重试</button>`:''}<button data-action="note-upload-cancel" data-id="${j.id}">取消</button></div>`).join('');
  host.hidden=!jobs.length;
}
function replaceNoteUpload(job, replacement) {
  const entry=job.entry;
  if (entry.deleted) return;
  if (noteMatches(entry)) captureNoteDraft();
  if (!entry.data.content.includes(job.token)) return;
  noteDrafts.change(entry,{...entry.data,content:entry.data.content.replace(job.token,replacement)});
  if (noteMatches(entry)) {
    const bookmark=NoteEditor.bookmark();
    NoteEditor.setValue(entry.data.content); NoteEditor.restoreBookmark(bookmark);
    noteState.dirty=entry.dirty;
  }
  noteDrafts.save(entry).then(()=>showNoteSaveResult(entry));
}
async function runNoteUpload(job) {
  if (job.running) return;
  job.running=true; job.failed=false; job.status='上传中'; renderNoteUploads();
  try {
    const markdown=await uploadNoteImage(job.file,job.file.name || 'image.png');
    if (noteUploads.get(job.id)!==job) return;
    replaceNoteUpload(job,markdown);
    noteUploads.delete(job.id);
  } catch (error) {
    job.failed=true; job.status='上传失败：'+error.message;
  } finally { job.running=false; renderNoteUploads(); }
}
function cancelNoteUpload(id) {
  const job=noteUploads.get(id); if (!job) return;
  replaceNoteUpload(job,''); noteUploads.delete(id); renderNoteUploads();
}

/* ---------------- AI 总结面板 ---------------- */

const promptName = () => state.db.prompts.find((x) => x.id === state.reader.prompt)?.name || "";

/* 打开 AI 面板时**不自动发送**：
   先展示可配置的发送区（提示词 / 视觉精读 / 已缓存结果），由用户点「发送」才真正请求。
   用户偏好：AI 总结是有成本的调用，不该点开就跑。
   如果该提示词已有缓存，直接展示缓存内容（省一次请求），但仍可用「重新生成」覆盖。 */
function mountAiPanel(p, opts = {}) {
  if ($('#note-panel')) closeNotePanel();
  closeAnnotationPanel();
  $('[data-action="annot-panel"]')?.classList.remove("is-on");
  $("#overlay-root").innerHTML = aiPanelHTML(p);
  syncNotePanelLayout(null);   // AI 面板顶掉了笔记面板，收回让出的宽度
  if (!p?.live) return;
  // 已经有缓存就直接显示，避免每次打开都空白一片
  showCachedSummary(p);
  if (opts.autoFocus) $("#ai-send")?.focus?.();
}

/* 读缓存并渲染（不发请求）。没有缓存就展示「待发送」空态。 */
async function showCachedSummary(p) {
  const body = $("#ai-body");
  if (!body) return;
  const mode = state.reader.vision ? "vision" : "text";
  let cached = null;
  try { cached = await LithubAPI.summaryCache(p.id, state.reader.prompt, mode); } catch {}
  if (!document.getElementById("ai-body")) return;   // 期间面板被关了
  if (cached?.content) {
    aiStream.text = cached.content;
    aiStream.streaming = false;
    aiStream.err = null;
    renderStreamSections(body, cached.content, false);
    setAiMeta(`${cached.model || ""} · ${promptName()}${mode === "vision" ? " · 视觉" : ""} · ${cached.created || "缓存"}`);
    setAiSendState("sent");
  } else {
    body.innerHTML = aiIdleHTML();
    setAiMeta(`${p.title.slice(0, 22)}…`);
    setAiSendState("ready");
  }
}

/* 网页 AI 的两个复制动作已经搬进阅读器右侧的「网页 AI」面板头
   （见 panesHTML），AI 总结面板不再重复摆一排按钮。 */

/* 打开外链：桌面壳走 Electron 的 shell.openExternal（系统浏览器，登录态互通）；
   浏览器里直接 window.open（同样用当前浏览器，登录态也互通）。 */
async function openExternalUrl(url) {
  const u = String(url || "").trim();
  if (!/^https?:\/\//i.test(u)) { toast("请先配置一个 http/https 网址", "err"); return false; }
  if (window.lithub?.openExternal) {
    const r = await window.lithub.openExternal(u);
    if (!r?.ok) { toast(r?.error || "打开失败", "err"); return false; }
    return true;
  }
  window.open(u, "_blank", "noopener");
  return true;
}

/* 把文本写进剪贴板，带降级（execCommand）兜底 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;left:-9999px;top:0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch { return false; }
  }
}

/* 拼出「要粘给网页 AI 的提示词」：取当前选中的模板，渲染占位符。
   正文/PDF 由「复制 PDF」单独提供（模型看 PDF 比看纯文本更准）。 */
function buildWebAiPrompt(p) {
  const tpl = state.db.prompts.find((x) => x.id === state.reader.prompt)?.content || "";
  return _renderPromptClient(tpl, p, "");
}

/* 前端版模板渲染（与后端 _render_prompt 保持一致的占位符） */
function _renderPromptClient(tpl, paper, content) {
  const venue = `${paper.venue || ""} ${paper.year || ""}`.trim() || "未知来源";
  return (tpl || "")
    .replace(/\{\{title\}\}/g, paper.title || "未知标题")
    .replace(/\{\{venue\}\}/g, venue)
    .replace(/\{\{lang\}\}/g, "简体中文")
    .replace(/\{\{abstract\}\}/g, content || "（正文请见随后粘贴的全文）");
}
function aiIdleHTML() {
  const vision = state.reader.vision;
  return `<div class="ai-idle">
    <div class="ai-idle-ico">${I("sparkle", 22)}</div>
    <p class="ai-idle-title">准备好后点击下方「发送」</p>
    <p class="ai-idle-desc">当前使用 <b>${esc(promptName() || "默认模板")}</b>${vision ? " · <b>视觉精读</b>（逐页截图，token 更高）" : " · 文本模式"}。<br>可先在顶部切换模板或开启视觉精读，再发送。</p>
  </div>`;
}

function setAiMeta(text) {
  const el = $("#ai-meta");
  if (el) el.textContent = text;
}

/* 发送按钮的三种状态：ready 可发送 / busy 生成中 / sent 已生成 */
function setAiSendState(state, label) {
  const btn = $("#ai-send");
  if (!btn) return;
  btn.dataset.state = state;
  if (state === "busy") {
    btn.disabled = true;
    btn.innerHTML = `${I("refresh", 14)}生成中…`;
  } else if (state === "sent") {
    btn.disabled = false;
    btn.innerHTML = `${I("refresh", 14)}重新生成`;
  } else {
    btn.disabled = false;
    btn.innerHTML = `${I("play", 14)}${label || "发送"}`;
  }
}

/* Markdown「## 小节」解析 → 侧栏分节渲染；streaming 时末尾加光标并智能跟随滚动 */
function parseMarkdownSections(text) {
  const secs = [];
  let cur = null;
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    if (/^#{1,4}\s*$/.test(line)) continue; // 流式传输中尚未传完的标题行，先吞掉
    const m = line.match(/^#{1,4}\s*(.+)$/);
    if (m) {
      cur = { h: m[1].replace(/[#*`]/g, "").trim(), lines: [] };
      secs.push(cur);
    } else if (cur) {
      cur.lines.push(line);
    } else if (line.trim()) {
      cur = { h: "", lines: [line] };
      secs.push(cur);
    }
  }
  return secs;
}

function sectionBodyHTML(lines) {
  const list = lines.filter((l) => /^\s*(-|•|\d+[.、)])\s*/.test(l));
  if (list.length) {
    return "<ul>" + list.map((l) => `<li>${esc(l.replace(/^\s*(-|•|\d+[.、)])\s*/, ""))}</li>`).join("") + "</ul>";
  }
  const para = lines.filter((l) => l.trim()).map((l) => esc(l)).join("<br>");
  return para ? `<p>${para}</p>` : "";
}

function renderStreamSections(target, text, streaming) {
  if (!target) return;
  const nearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 90;
  const secs = parseMarkdownSections(text);
  if (!secs.length) {
    target.innerHTML = `<div class="ai-sec"><p class="muted-note">${streaming ? "正在思考…" : "（无内容）"}</p></div>`;
    return;
  }
  target.innerHTML = secs.map((s) => `
    <section class="ai-sec">
      ${s.h ? `<h3>${esc(s.h)}</h3>` : ""}
      ${sectionBodyHTML(s.lines)}
    </section>`).join("")
    + (streaming ? '<span class="ai-cursor" aria-hidden="true"></span>' : "");
  if (streaming && nearBottom) target.scrollTop = target.scrollHeight;
}

/* 真实模式：缓存优先读取，无缓存则流式生成。
   只在用户点「发送 / 重新生成」或切换模板时调用（打开面板时不自动跑）。 */
async function startSummaryStream(p, force = false, isFallback = false) {
  const body = $("#ai-body");
  if (!body) return;
  const mode = state.reader.vision ? "vision" : "text";
  aiStream.ctrl?.abort();
  const ctrl = new AbortController();
  aiStream.ctrl = ctrl;
  aiStream.text = "";
  aiStream.meta = null;
  aiStream.err = null;
  aiStream.streaming = true;
  setAiSendState("busy");
  body.innerHTML = `<div class="ai-skeleton">${Array.from({ length: 3 }, () => `<div class="sk-sec"><div class="sk sk-h"></div><div class="sk"></div><div class="sk short"></div></div>`).join("")}</div>`;

  const metaEl = () => $("#ai-meta");

  if (!force) {
    const cached = await LithubAPI.summaryCache(p.id, state.reader.prompt, mode);
    if (aiStream.ctrl !== ctrl) return;
    if (cached?.content) {
      aiStream.text = cached.content;
      aiStream.streaming = false;
      renderStreamSections(body, cached.content, false);
      if (metaEl()) metaEl().textContent = `${cached.model || ""} · ${promptName()}${mode === "vision" ? " · 视觉" : ""} · ${cached.created || ""}`;
      setAiSendState("sent");
      return;
    }
  }

  await LithubAPI.streamSummary({
    paper_id: p.id,
    prompt_id: state.reader.prompt,
    force,
    mode,
    onMeta: (m) => {
      aiStream.meta = m;
      if (metaEl()) metaEl().textContent = `${m.model} · ${m.prompt}${m.pages ? ` · 视觉 ${m.pages} 页` : ""} · 生成中`;
      if ($("#ai-body")) renderStreamSections($("#ai-body"), aiStream.text, true);
    },
    onDelta: (d) => {
      if (aiStream.ctrl !== ctrl) return;
      aiStream.text += d;
      renderStreamSections($("#ai-body"), aiStream.text, true);
    },
    onError: (msg) => {
      if (aiStream.ctrl !== ctrl) return;
      aiStream.err = msg;
      aiStream.streaming = false;
      // 文本模式提取失败（如扫描版）→ 自动切视觉精读重试一次
      if (mode === "text" && !isFallback && msg.includes("提取文本")) {
        state.reader.vision = true;
        const chk = $("#vision-chk");
        if (chk) chk.checked = true;
        toast("该 PDF 提取不到文本，已自动切换视觉精读");
        startSummaryStream(p, false, true);
        return;
      }
      const b = $("#ai-body");
      if (b) {
        b.innerHTML = `<div class="ai-sec"><p class="err-note">${esc(msg)}</p>
          <button class="btn sm" data-action="ai-retry" data-id="${p.id}" style="margin-top:12px">${I("refresh", 14)}重试</button></div>`;
      }
    },
  }, ctrl.signal);

  if (aiStream.ctrl !== ctrl) return;
  aiStream.streaming = false;
  const b = $("#ai-body");
  if (!aiStream.err && b) {
    renderStreamSections(b, aiStream.text, false);
    if (metaEl()) metaEl().textContent = `${aiStream.meta?.model || state.db.settings.model} · ${promptName()}${mode === "vision" ? " · 视觉" : ""} · 刚刚生成`;
    setAiSendState("sent");
  } else if (aiStream.err) {
    setAiSendState("ready");
  }
}

function aiPanelHTML(p) {
  if (p.live) {
    return `
  <aside class="ai-panel open" id="ai-panel">
    <header class="ai-head">
      <div class="ai-head-title">${I("sparkle", 16)}<h2>AI 文献总结</h2>
        <button class="icon-btn sm" data-action="ai-close">${I("x", 15)}</button>
      </div>
      <div class="ai-prompt-row">
        <label class="select-wrap grow">
          <select id="prompt-sel">
            ${state.db.prompts.map((t) => `<option value="${t.id}" ${t.id === state.reader.prompt ? "selected" : ""}>${esc(t.name)}</option>`).join("")}
          </select>
        </label>
        <label class="switch" title="把论文逐页渲染成图片发给模型：图表、公式、扫描件友好，token 消耗更高（最多 12 页）">
          <input type="checkbox" id="vision-chk" ${state.reader.vision ? "checked" : ""}>
          <span class="switch-track"></span>
          <span class="switch-label">视觉精读</span>
        </label>
        <button class="icon-btn" data-action="edit-prompts" title="管理提示词模板">${I("sliders", 15)}</button>
      </div>
    </header>
    <div class="ai-body" id="ai-body">
      <div class="ai-idle">
        <div class="ai-idle-ico">${I("sparkle", 22)}</div>
        <p class="ai-idle-title">正在读取缓存…</p>
      </div>
    </div>
    <footer class="ai-foot">
      <span class="ai-meta" id="ai-meta">${esc(p.title.slice(0, 22))}…</span>
      <div class="ai-foot-btns">
        <button class="btn sm" data-action="ai-copy">${I("copy", 14)}复制</button>
        <button class="btn sm btn-primary" id="ai-send" data-state="ready"
                data-action="ai-regen" data-id="${p.id}">${I("play", 14)}发送</button>
      </div>
    </footer>
  </aside>`;
  }
  const r = state.reader;
  const sum = summaryFor(p, r.prompt);
  return `
  <aside class="ai-panel open" id="ai-panel">
    <header class="ai-head">
      <div class="ai-head-title">${I("sparkle", 16)}<h2>AI 文献总结</h2>
        <button class="icon-btn sm" data-action="ai-close">${I("x", 15)}</button>
      </div>
      <div class="ai-prompt-row">
        <label class="select-wrap grow">
          <select id="prompt-sel">
            ${state.db.prompts.map((t) => `<option value="${t.id}" ${t.id === r.prompt ? "selected" : ""}>${esc(t.name)}</option>`).join("")}
          </select>
        </label>
        <button class="icon-btn" data-action="edit-prompts" title="管理提示词模板">${I("sliders", 15)}</button>
      </div>
    </header>
    ${summaryBodyHTML(p)}
    <footer class="ai-foot">
      <span class="ai-meta">${esc(sum.meta)} · 刚刚生成</span>
      <div class="ai-foot-btns">
        <button class="btn sm" data-action="ai-copy">${I("copy", 14)}复制</button>
        <button class="btn sm btn-primary" data-action="ai-regen" data-id="${p.id}">${I("refresh", 14)}重新生成</button>
      </div>
    </footer>
  </aside>`;
}

function summaryFor(p, promptId) {
  if (p.id === "p1" && window.SUMMARY_P1[promptId]) return window.SUMMARY_P1[promptId];
  if (p.id === "p1") return window.SUMMARY_P1.d1;
  const first = p.abstract.split(". ")[0];
  return {
    meta: `${state.db.settings.model} · ${state.db.prompts.find((x) => x.id === promptId)?.name || "默认"}`,
    sections: [
      { h: "一句话总结", type: "p", x: `${first}.（${p.venue} ${p.year}，${p.authors} 等人的工作）` },
      { h: "核心贡献", type: "ul", x: p.tags.map((t) => `与「${t}」相关的关键设计或结论，详见原文对应章节。`) },
      { h: "方法要点", type: "p", x: "该文围绕上述问题提出了一套完整方案，主体思路与实验设置在原文中均有系统阐述；此处为演示数据，接入后端后由模型实时生成。" },
      { h: "局限与思考", type: "p", x: "建议结合领域内后续工作对照阅读，评估其方法在当前基准下的有效性。" },
    ],
  };
}

const summaryBodyHTML = (p, stagger = false) => {
  const sum = summaryFor(p, state.reader.prompt);
  return `
  <div class="ai-body${stagger ? " stagger" : ""}" id="ai-body">
    ${sum.sections.map((s, i) => `
      <section class="ai-sec" style="--i:${i}">
        <h3>${esc(s.h)}</h3>
        ${s.type === "ul" ? `<ul>${s.x.map((li) => `<li>${esc(li)}</li>`).join("")}</ul>` : `<p>${esc(s.x)}</p>`}
      </section>`).join("")}
  </div>`;
};

function regenSummary(p, force = true) {
  if (p?.live) { startSummaryStream(p, force); return; }
  const body = $("#ai-body");
  if (!body) return;
  body.innerHTML = `<div class="ai-skeleton">${Array.from({ length: 4 }, () => `<div class="sk-sec"><div class="sk sk-h"></div><div class="sk"></div><div class="sk short"></div></div>`).join("")}</div>`;
  setTimeout(() => {
    if (!document.getElementById("ai-body")) return;
    document.getElementById("ai-body").outerHTML = summaryBodyHTML(p, true);
    const meta = $(".ai-meta");
    if (meta) meta.textContent = `${summaryFor(p, state.reader.prompt).meta} · 刚刚生成`;
    toast("已按当前提示词重新生成总结");
  }, 900);
}

/* ---------------- 翻译流程（模拟） ---------------- */
function startTranslate(paperId) {
  const p = paperById(paperId);
  if (!p || p.translated || state.translating[paperId] != null) return;
  state.translating[paperId] = 0;
  state.db.tasks.unshift({
    id: "t" + Date.now(), paperId, name: p.title, status: "running", progress: 0,
    pages: 10 + (p.id.charCodeAt(1) % 15), model: state.db.settings.model, time: "刚刚", note: "正在解析版面…",
  });
  if (state.route.view === "reader") renderReader(paperId);
  if (state.route.view === "tasks") renderTasks();
  const timer = setInterval(() => {
    state.translating[paperId] = Math.min(100, state.translating[paperId] + 4 + Math.floor(Math.random() * 9));
    const task = state.db.tasks.find((t) => t.paperId === paperId && t.status === "running");
    const pct = state.translating[paperId];
    if (pct >= 100) {
      clearInterval(timer);
      delete state.translating[paperId];
      p.translated = true;
      if (task) { task.status = "done"; task.progress = 100; task.time = "刚刚"; task.note = `用时 ${2 + (paperId.charCodeAt(1) % 4)} 分 ${10 + (paperId.charCodeAt(1) % 49)} 秒 · 已生成对照版`; }
      toast("翻译完成，已生成中文对照版");
    } else if (task) {
      task.progress = pct;
      task.note = `正在翻译第 ${Math.max(1, Math.round((pct / 100) * task.pages))} / ${task.pages} 页`;
    }
    const btnPct = $('[data-action="translate"] .spin');
    if (btnPct && state.route.view === "reader") renderReader(paperId);
    if (state.route.view === "tasks") renderTasks();
  }, 380);
}

/* ---------------- 翻译任务页 ---------------- */
const TASK_STATUS = {
  done: { text: "已完成", cls: "ok" },
  running: { text: "翻译中", cls: "run" },
  queued: { text: "排队中", cls: "queue" },
  failed: { text: "失败", cls: "fail" },
};

function tasksForView() {
  if (!LithubAPI.live) return state.db.tasks;
  const nameOf = (pid) => paperById(pid)?.title || "未知文献";
  return state.liveTasks.map((t) => ({
    id: t.id,
    paperId: t.paper_id,
    name: nameOf(t.paper_id),
    status: t.status,
    progress: t.progress,
    pages: paperById(t.paper_id)?.pages || "—",
    model: store_service_label(),
    time: t.status === "done" ? "已完成" : t.status === "queued" ? "排队中" : t.status === "running" ? "进行中" : "失败",
    note: t.note || "",
  }));
}

const store_service_label = () => (state.db.settings.engine === "openai" ? "OpenAI 兼容 API" : "Bing 引擎");

function renderTasks() {
  const rows = tasksForView().map((t) => {
    const st = TASK_STATUS[t.status];
    return `
    <article class="trow">
      <div class="t-status ${st.cls}">${st.text}</div>
      <div class="t-main">
        <h3>${esc(t.name)}</h3>
        <p>${esc(t.time)} · ${t.pages} 页 · 模型 ${esc(t.model)} · ${esc(t.note)}</p>
      </div>
      <div class="t-progress">${t.status === "running"
        ? `<div class="progress"><span style="width:${t.progress}%"></span></div><span class="t-pct">${t.progress}%</span>`
        : t.status === "done" ? `<div class="progress done"><span style="width:100%"></span></div>`
        : t.status === "failed" ? `<button class="btn sm" data-action="retry" data-id="${t.id}">${I("refresh", 13)}重试</button>`
        : `<span class="t-queued">${I("clock", 13)}等待分配</span>`}
      </div>
      <div class="t-actions">
        ${t.status === "done" ? `<button class="btn sm" data-action="open" data-id="${t.paperId}">${I("book", 13)}打开对照</button>` : ""}
      </div>
    </article>`;
  }).join("");

  const view = tasksForView();
  const running = view.filter((t) => t.status === "running").length;
  $("#view").innerHTML = `
  <header class="page-head">
    <div>
      <div class="overline">TRANSLATION · 翻译任务</div>
      <h1>任务队列 <span class="num">${view.length}</span><span class="num-sub">项</span></h1>
    </div>
    <div class="head-actions"><span class="run-hint">${running ? `${running} 个任务进行中` : "队列为空闲状态"}</span></div>
  </header>
  <div class="tasks-area">${rows}</div>`;
}

/* ---------------- 设置页 ---------------- */
const TABS = [
  { id: "ai", name: "AI 服务" },
  { id: "translate", name: "翻译" },
  { id: "prompts", name: "提示词模板" },
  { id: "appearance", name: "外观" },
  { id: "storage", name: "文件存储" },
  { id: "about", name: "关于与更新" },
];

function renderSettings() {
  const s = state.db.settings;
  const tab = state.settingsTab;
  const body = {
    about: () => AppUpdates.html(),
    storage: storageSettingsHTML,
    ai: () => `
      <section class="set-card">
        <h3>模型服务</h3>
        <p class="set-desc">选择 OpenAI 兼容的 API 提供商，用于 AI 总结与对话式问答。</p>
        <div class="prov-grid">
          ${state.db.providers.map((pv) => `
            <button class="prov-card ${s.provider === pv.id ? "active" : ""}" data-action="provider" data-id="${pv.id}">
              <b>${esc(pv.name)}</b><span>${esc(pv.base || "自定义 Base URL")}</span>
            </button>`).join("")}
        </div>
        <div class="form-grid">
          <label class="field"><span>Base URL</span><input type="text" id="set-base" value="${esc(s.baseURL)}" placeholder="https://api.example.com/v1"></label>
          <label class="field"><span>API Key</span>
            <div class="key-row"><input type="text" id="set-key" value="${esc(keyMaskFor(s.provider))}" placeholder="sk-…" autocomplete="off" spellcheck="false"></div>
          </label>
          <label class="field"><span>模型</span>
            <input type="text" id="set-model" list="model-list" value="${esc(s.model)}" placeholder="deepseek-chat">
            <datalist id="model-list">${(state.db.providers.find((x) => x.id === s.provider)?.models || []).map((m) => `<option value="${esc(m)}">`).join("")}</datalist>
          </label>
          <label class="field"><span>温度 <b id="temp-val">${s.temperature}</b></span>
            <input type="range" id="set-temp" min="0" max="1" step="0.1" value="${s.temperature}">
          </label>
        </div>
        <div class="set-foot">
          <span class="conn-state" id="conn-state"></span>
          <button class="btn" data-action="test-conn">${I("play", 14)}测试连接</button>
          <button class="btn btn-primary" data-action="save-settings">保存设置</button>
        </div>
      </section>

      <section class="set-card" style="margin-top:18px">
        <h3>网页 AI</h3>
        <p class="set-desc">
          在网页版 AI 里提问，不消耗 API Token。会把你的 Chrome/Edge 窗口
          <strong>嵌进应用、与论文并排</strong>，登录态与你平时用的一样。
        </p>
        <div class="form-grid">
          <label class="field"><span>默认站点 URL</span>
            <input type="text" id="set-webai-url" value="${esc(s.webAiURL)}" placeholder="https://chat.deepseek.com/">
          </label>
          <label class="field"><span>使用哪个浏览器</span>
            <select id="set-webai-browser">
              <option value="">自动（第一个可用的）</option>
            </select>
          </label>
        </div>
        <label class="field" style="margin-top:14px">
          <span>浏览器程序路径（可选）
            <button class="btn sm" data-action="webai-browse-exe" style="margin-left:8px">${I("folder", 13)}浏览…</button>
            <button class="btn sm" data-action="webai-redetect" style="margin-left:4px">${I("refresh", 13)}重新检测</button>
          </span>
          <input type="text" id="set-webai-browser-path" value="${esc(s.webAiBrowserPath || "")}"
                 placeholder="留空 = 自动检测（注册表 + 常见安装位置）">
        </label>
        <p class="muted-note" id="webai-detect-hint">${detectHintHTML(s)}</p>
        <div class="webai-sites" id="webai-sites">
          ${(s.webAiSites || []).map((site, i) => `
            <div class="webai-site-row">
              <input type="text" class="webai-site-name" data-idx="${i}" value="${esc(site.name || "")}" placeholder="名称">
              <input type="text" class="webai-site-url" data-idx="${i}" value="${esc(site.url || "")}" placeholder="https://…">
              <button class="icon-btn sm danger" data-action="webai-site-del" data-idx="${i}" title="删除">${I("trash", 13)}</button>
            </div>`).join("") || '<p class="muted-note">还没有自定义站点。可添加常用站点，面板头的「切换站点」里即可选。</p>'}
        </div>
        <p class="muted-note">
          面板里嵌的是你本机的 Chrome/Edge（会另开一个独立小窗口，不动你已有的标签页），
          所以登录态和你平时完全一致；浏览器自己那条标题栏会被裁掉，只留页面本身。
        </p>
        <div class="set-foot">
          <button class="btn" data-action="webai-site-add">${I("plus", 14)}添加站点</button>
          <button class="btn btn-primary" data-action="save-settings">保存设置</button>
        </div>
      </section>`,
    translate: () => `
      <section class="set-card">
        <h3>翻译引擎</h3>
        <p class="set-desc">全文翻译基于本地 pdf2zh 管线（版面级替换，保留公式与图表）。默认使用免费 Bing 引擎；在「AI 服务」中配置 Key 后可切换为 OpenAI 兼容 API。</p>
        <div class="prov-grid">
          <button class="prov-card ${s.engine === "bing" ? "active" : ""}" data-action="engine" data-id="bing">
            <b>Bing（免费）</b><span>无需配置，适合快速浏览</span>
          </button>
          <button class="prov-card ${s.engine === "openai" ? "active" : ""}" data-action="engine" data-id="openai">
            <b>OpenAI 兼容 API</b><span>使用「AI 服务」中的 Key 与模型，质量更高</span>
          </button>
        </div>
        <div class="form-grid">
          <label class="field"><span>目标语言</span>
            <select id="set-target">
              ${["简体中文", "繁體中文", "English", "日本語"].map((l) => `<option ${s.target === l ? "selected" : ""}>${l}</option>`).join("")}
            </select>
          </label>
        </div>
        <div class="switch-row">
          <label class="switch"><input type="checkbox" id="set-dual" ${s.dualDefault ? "checked" : ""}><span class="switch-track"></span><span class="switch-label">翻译完成后默认进入左右对照模式</span></label>
        </div>
        <div class="switch-row">
          <label class="switch"><input type="checkbox" id="set-formula" ${s.formulaProtect ? "checked" : ""}><span class="switch-track"></span><span class="switch-label">保护公式与图表（pdf2zh 已内置）</span></label>
        </div>
        <div class="dropzone" data-action="glossary">
          ${I("upload", 18)}<b>${esc(s.glossary || "上传术语表")}</b>
          <span>支持 CSV / TXT，译名将优先于模型直译</span>
        </div>
        <div class="set-foot"><button class="btn btn-primary" data-action="save-settings">保存设置</button></div>
      </section>`,
    prompts: () => `
      <section class="set-card">
        <div class="set-card-head">
          <div><h3>提示词模板</h3><p class="set-desc">在阅读器侧栏一键切换不同风格的 AI 总结。</p></div>
          <button class="btn btn-primary sm" data-action="new-prompt">${I("plus", 14)}新建模板</button>
        </div>
        <div class="prompt-list">
          ${state.db.prompts.map((t) => `
            <article class="prompt-item ${t.default ? "is-default" : ""}">
              <div class="prompt-info">
                <h4>${esc(t.name)}${t.default ? '<span class="pill pill-ai">默认</span>' : ""}</h4>
                <p>${esc(t.desc)}</p>
                <code>${esc(t.content.split("\n")[0])}…</code>
              </div>
              <div class="prompt-acts">
                <button class="icon-btn sm" data-action="edit-prompt" data-id="${t.id}" title="编辑">${I("pencil", 14)}</button>
                <button class="icon-btn sm danger" data-action="del-prompt" data-id="${t.id}" title="删除">${I("trash", 14)}</button>
              </div>
            </article>`).join("")}
        </div>
      </section>`,
    appearance: () => `
      <section class="set-card">
        <h3>主题</h3>
        <p class="set-desc">编辑风格保持纸感，深色模式适合夜间长时间阅读。</p>
        <div class="theme-row">
          ${[["light", "浅色 · 纸感"], ["dark", "深色 · 夜读"]].map(([v, n]) => `
            <button class="theme-card ${s.theme === v ? "active" : ""}" data-action="theme" data-id="${v}">
              <span class="theme-peek ${v}"></span><b>${n}</b>
            </button>`).join("")}
        </div>
        <h3 style="margin-top:28px">强调色</h3>
        <div class="accent-row">
          ${[["zhu", "朱砂"], ["dai", "黛蓝"], ["zhu2", "竹绿"], ["xuan", "玄墨"]].map(([v, n]) => `
            <button class="accent-dot ${v} ${s.accent === v ? "active" : ""}" data-action="accent" data-id="${v}" title="${n}"></button>`).join("")}
        </div>
      </section>`,
  }[tab]();

  $("#view").innerHTML = `
  <header class="page-head">
    <div>
      <div class="overline">SETTINGS · 设置</div>
      <h1>偏好设置</h1>
    </div>
  </header>
  <div class="set-tabs">${TABS.map((t) => `<button class="set-tab ${t.id === tab ? "active" : ""} ${t.id === 'about' && AppUpdates.hasUpdate() ? 'has-update' : ''}" data-action="set-tab" data-id="${t.id}">${t.name}</button>`).join("")}</div>
  <div class="set-body">${body}</div>`;
  // AI 服务页：探测已安装的浏览器，填入「使用哪个浏览器」下拉
  if (tab === "ai") refreshBrowserSelect();
  if (tab === "storage" && !pdfStorageState.info && !pdfStorageState.loading) loadPdfStorage();
}

const pdfStorageState = { info: null, loading: false, error: "", busy: false };

function refreshUpdateSettings() {
  document.querySelector('.set-tab[data-id="about"]')?.classList.toggle('has-update', AppUpdates.hasUpdate());
  if (state.route.view === "settings" && state.settingsTab === "about") {
    const body = document.querySelector('.set-body');
    if (body) body.innerHTML = AppUpdates.html();
  }
}

function notifyAppUpdate(version) {
  if (state.route.view === "settings" && state.settingsTab === "about") return;
  const notice = document.createElement('div');
  notice.className = 'toast toast-update';
  notice.innerHTML = `${I('sparkle',16)}<span>发现新版本 v${esc(version)}</span><button class="btn sm" data-action="updates-details">查看更新</button>`;
  document.getElementById('toast-root').appendChild(notice);
  setTimeout(() => notice.remove(), 12000);
}

function storageSettingsHTML() {
  const info = pdfStorageState.info;
  if (!LithubAPI.live) return '<section class="set-card"><h3>PDF 文件存储</h3><p class="set-desc">连接本地服务后可设置存储目录。</p></section>';
  if (!info) return `<section class="set-card"><h3>PDF 文件存储</h3><p class="set-desc">${esc(pdfStorageState.error || "正在读取存储位置…")}</p></section>`;
  return `<section class="set-card">
    <h3>PDF 文件存储</h3>
    <p class="set-desc">原文、译文和双语对照版统一保存在此目录。默认使用程序文件夹下的 pdfs 目录。</p>
    ${info.warning ? `<p class="muted-note" role="status">${esc(info.warning)}</p>` : ""}
    <label class="field"><span>存储目录</span><input id="set-pdf-directory" type="text" value="${esc(info.directory)}" spellcheck="false"></label>
    <div class="set-foot">
      ${window.lithub?.pdfStorage ? '<button class="btn" data-action="pdf-storage-browse">浏览…</button>' : ""}
      <button class="btn" data-action="pdf-storage-default">使用默认目录</button>
      ${window.lithub?.pdfStorage ? '<button class="btn" data-action="pdf-storage-open">打开当前目录</button>' : ""}
    </div>
    <p class="set-desc">原文位置：<code>${esc(info.originals_directory)}</code><br>译文与对照版：<code>${esc(info.translated_directory)}</code></p>
    <p class="set-desc">切换时会复制并校验已有 PDF，成功后立即生效；原目录保留副本。请先等待翻译任务完成。笔记、批注与设置仍保存在 <code>${esc(info.metadata_directory)}</code>。</p>
    <div class="set-foot"><button class="btn btn-primary" data-action="pdf-storage-apply">迁移并应用</button></div>
  </section>`;
}
async function loadPdfStorage() {
  if (!LithubAPI.live) return;
  pdfStorageState.loading = true;
  try {
    pdfStorageState.info = await LithubAPI.pdfStorage();
    pdfStorageState.error = "";
  } catch (error) { pdfStorageState.error = error.message; }
  finally {
    pdfStorageState.loading = false;
    if (state.route.view === "settings" && state.settingsTab === "storage") {
      // Render the loaded body directly; a failed request must not trigger a retry loop.
      const body = document.querySelector(".set-body");
      if (body) body.innerHTML = storageSettingsHTML();
    }
  }
}
async function applyPdfStorage() {
  if (pdfStorageState.busy) return;
  const directory = document.getElementById("set-pdf-directory")?.value.trim();
  if (!directory) { toast("请选择存储目录", "err"); return; }
  pdfStorageState.busy = true;
  openModal('<header class="modal-head"><h2>正在迁移 PDF</h2></header><div class="modal-body"><p>正在复制并校验文件。完成前请保持应用开启，原文件会保留。</p></div>');
  try {
    await flushNoteEditor();
    pdfStorageState.info = await LithubAPI.setPdfStorage(directory);
    toast("PDF 存储位置已更新，原目录副本已保留");
  } catch (error) { toast(error.message || "迁移失败，仍使用原目录", "err"); }
  finally {
    pdfStorageState.busy = false;
    closeModal();
    if (state.route.view === "settings" && state.settingsTab === "storage") renderSettings();
  }
}

/* 探测到的浏览器清单缓存（下拉与提示文案共用一次探测结果） */
let browserDetectCache = null;

const BROWSER_SOURCE_LABEL = {
  custom: "手动指定",
  registry: "注册表",
  path: "默认安装位置",
};

/* 设置页那行提示：说清「从哪找到的」或者「为什么没找到」。
   用户装了浏览器却在非默认目录、自动检测又没命中时，这里是他唯一能看懂
   为什么失败的线索，所以要把来源和完整路径都摆出来。 */
function detectHintHTML(s) {
  const list = browserDetectCache;
  if (!list) return "正在自动检测本机已安装的 Chrome / Edge…";
  if (!list.length) {
    return `没检测到 Chrome 或 Edge。装了却找不到的话，点「浏览…」手动指定
            <code>chrome.exe</code> / <code>msedge.exe</code> 的位置。`;
  }
  const item = (b) => {
    const src = BROWSER_SOURCE_LABEL[b.source] || b.source || "";
    return `<b>${esc(b.name)}</b>（${esc(src)}）<code>${esc(b.path)}</code>`;
  };
  const custom = (s.webAiBrowserPath || "").trim();
  if (custom) {
    // 手动指定时只报「这一条真正会被用的」，不再罗列自动检测到的其它浏览器
    const pick = list.find((b) => b.source === "custom") || list[0];
    return "已按你手动指定的路径使用：<br>" + item(pick);
  }
  // 自动模式：按浏览器类型计数（注册表和默认路径可能指向同一个程序）
  const kinds = [];
  for (const b of list) if (!kinds.some((k) => k.id === b.id)) kinds.push(b);
  const head = `自动检测到 ${kinds.length} 个浏览器，默认用第一个：`;
  return head + "<br>" + kinds.map(item).join("<br>");
}

/* 把探测结果填进「使用哪个浏览器」下拉。
   单独抽出来是因为缓存在命中时也要填 —— 早期版本在缓存命中时直接 return，
   只刷新了提示文字，下拉永远停在上一次渲染的占位选项（bug）。 */
function fillBrowserSelect(list) {
  const sel = document.getElementById("set-webai-browser");
  if (!sel) return;
  // 选项按浏览器**类型**给（同一类型可能被注册表和默认路径各找到一次，只列一条）
  const kinds = [];
  for (const b of list || []) if (!kinds.some((k) => k.id === b.id)) kinds.push(b);
  const cur = state.db.settings.webAiBrowser || "";
  sel.innerHTML = `<option value="">自动（第一个可用的）</option>`
    + kinds.map((b) => `<option value="${esc(b.id)}" ${cur === b.id ? "selected" : ""}>${esc(b.name)}</option>`).join("");
  if (!kinds.length) sel.innerHTML = `<option value="">未检测到 Chrome / Edge</option>`;
}

/* 探测已安装的 Chrome/Edge，填入设置页下拉 + 更新提示。
   探测走三路：手动路径 → 注册表 → 默认安装位置（见 browser_embed.detect_browsers） */
async function refreshBrowserSelect(force = false) {
  const hint = document.getElementById("webai-detect-hint");
  const pathInput = document.getElementById("set-webai-browser-path");
  if (!window.lithub?.browser) {
    if (hint) hint.textContent = "内嵌浏览器仅桌面版可用。";
    return;
  }
  if (browserDetectCache && !force) {
    // 缓存命中也要把下拉填上（见 fillBrowserSelect 的注释）
    fillBrowserSelect(browserDetectCache);
    if (hint) hint.innerHTML = detectHintHTML(state.db.settings);
    return;
  }
  const custom = (pathInput?.value ?? state.db.settings.webAiBrowserPath ?? "").trim();
  try {
    const r = await window.lithub.browser.detect(custom);
    const list = r?.ok ? (r.browsers || []) : [];
    browserDetectCache = list;
    fillBrowserSelect(list);
    if (hint) hint.innerHTML = detectHintHTML(state.db.settings);
    if (!list.length && r?.error && hint) {
      hint.innerHTML = `自动检测失败：${esc(r.error)}`;
    }
  } catch (e) {
    if (hint) hint.textContent = "浏览器检测失败：" + (e.message || e);
  }
}

/* ---------------- 弹层 ---------------- */
function openModal(html) {
  $("#overlay-root").insertAdjacentHTML("beforeend",
    `<div class="modal-mask" data-action="mask-close"><div class="modal" data-stop>${html}</div></div>`);
  // 弹窗是全屏遮罩：原生浏览器窗口压在上面会把它切掉一半，先让原生层让位
  scheduleWebAiOcclusionCheck();
}

const closeModal = () => {
  $$(".modal-mask").forEach((m) => m.remove());
  scheduleWebAiOcclusionCheck();
};

function confirmModal(title, text, confirmAction, dataId) {
  openModal(`
    <header class="modal-head"><h2>${title}</h2><button class="icon-btn" data-action="modal-close">${I("x", 17)}</button></header>
    <div class="modal-body"><p class="confirm-text">${text}</p></div>
    <footer class="modal-foot">
      <button class="btn" data-action="modal-close">取消</button>
      <button class="btn btn-danger" data-action="${confirmAction}" data-id="${dataId}">确认删除</button>
    </footer>`);
}

let activePaperRename = null;
const paperRenameSaving = new Set();

function renamePaperInline(id) {
  const p = paperById(id);
  const heading = document.querySelector(`[data-paper-title="${CSS.escape(id)}"]`);
  if (!p || !heading) return;
  if (activePaperRename?.input.isConnected && activePaperRename.id === id) {
    activePaperRename.input.focus();
    return;
  }
  if (paperRenameSaving.has(id)) return;
  activePaperRename?.save();
  const input = document.createElement("input");
  input.className = "paper-title-input";
  input.type = "text";
  input.maxLength = 500;
  input.value = p.title;
  input.setAttribute("aria-label", "文献名称");
  input.title = "回车保存 · Esc 取消 · 点击其他位置保存";
  heading.classList.add("paper-title-editing");
  heading.replaceChildren(input);
  let done = false;
  const finish = () => {
    done = true;
    heading.classList.remove("paper-title-editing");
    heading.textContent = p.title;
    if (activePaperRename?.input === input) activePaperRename = null;
  };
  const save = async () => {
    if (done || paperRenameSaving.has(id)) return;
    const title = input.value.replace(/\s+/g, " ").trim();
    if (!title) { finish(); toast("文献名称不能为空，已保留原名称", "err"); return; }
    if (title === p.title) { finish(); return; }
    paperRenameSaving.add(id);
    input.readOnly = true;
    input.setAttribute("aria-busy", "true");
    try {
      const updated = LithubAPI.live && p.live ? await LithubAPI.updatePaper(id, { title }) : { title };
      p.title = updated.title;
      delete p._pages;
      finish();
      // Patch titles without rebuilding the view: blur must not swallow a navigation
      // click or tear down the current PDF/browser session.
      document.querySelectorAll(`[data-paper-title="${CSS.escape(id)}"]`).forEach(el => {
        if (!el.querySelector("input")) el.textContent = p.title;
      });
      document.querySelectorAll(`.row[data-id="${CSS.escape(id)}"], .gcard[data-id="${CSS.escape(id)}"]`).forEach(el => {
        const initial = el.querySelector(".cover b");
        if (initial) initial.textContent = p.title[0];
      });
      document.querySelectorAll(`#tab-strip .tab[data-id="${CSS.escape(id)}"]`).forEach(tab => {
        const label = tab.dataset.action === "open-note" ? noteTabLabel(id) : p.title;
        tab.querySelector(".tab-title").textContent = label;
        tab.title = label;
      });
      const row = document.querySelector(`[data-row-id="${CSS.escape(id)}"]`);
      const attachment = row?.querySelector('[data-action="open-file"]');
      if (attachment) {
        attachment.querySelector(".att-label").textContent = `${p.title}.pdf`;
        attachment.title = `${p.title}.pdf${p.origName ? `（导入文件：${p.origName}）` : ""}`;
      }
      const webTitle = state.route.id === id && $("#webai-pane-url");
      if (webTitle) { webTitle.textContent = p.title; webTitle.title = `当前论文：${p.title}`; }
      toast("文献名称已更新");
    } catch (error) {
      input.readOnly = false;
      input.removeAttribute("aria-busy");
      if (input.isConnected && document.activeElement === input) input.select();
      else finish();
      toast(esc(error.message || "重命名失败"), "err");
    } finally {
      paperRenameSaving.delete(id);
    }
  };
  activePaperRename = { id, input, save };
  // Keep text selection and editing separate from the surrounding open/drag actions.
  ["click", "dblclick", "pointerdown"].forEach(type => input.addEventListener(type, e => e.stopPropagation()));
  input.addEventListener("dragstart", e => { e.preventDefault(); e.stopPropagation(); });
  input.addEventListener("keydown", e => {
    e.stopPropagation();
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === "Enter") { e.preventDefault(); save(); }
    if (e.key === "Escape") { e.preventDefault(); if (!paperRenameSaving.has(id)) finish(); }
  });
  input.addEventListener("blur", () => save());
  input.focus();
  input.select();
}

function importModal() {
  state.pendingFiles = []; // 清空上次会话残留的选择
  openModal(`
    <header class="modal-head"><h2>导入文献</h2><button class="icon-btn" data-action="modal-close">${I("x", 17)}</button></header>
    <div class="modal-body">
      <div class="dropzone big" data-action="pick-files" id="import-drop">
        ${I("upload", 24)}<b>拖拽 PDF 到此处，或点击选择文件</b>
        <span>支持批量导入 · 从 PDF 元数据与首页识别标题和作者</span>
        <input type="file" id="import-file" multiple accept=".pdf" hidden>
      </div>
      <ul class="picked-list" id="picked-list"></ul>
      <label class="field"><span>导入到分类</span>
        <select id="import-cat">
          ${state.db.categories.filter((c) => !c.parent).map((c) => `<option value="${c.id}" ${(state.filter.cat || "local") === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}
        </select>
      </label>
      <div class="switch-row">
        <label class="switch"><input id="import-auto-title" type="checkbox" checked><span class="switch-track"></span><span class="switch-label">自动识别论文标题并用作文献名称</span></label>
      </div>
      <p class="muted">识别失败时保留文件名；导入后可随时重命名。直接拖入文献库时默认自动识别。</p>
    </div>
    <footer class="modal-foot">
      <button class="btn" data-action="modal-close">取消</button>
      <button class="btn btn-primary" data-action="do-import">开始导入</button>
    </footer>`);
  $("#import-file").addEventListener("change", (e) => {
    state.pendingFiles = [...e.target.files];
    const names = state.pendingFiles.map((f) => `<li>${I("file", 14)}${esc(f.name)}<span>${(f.size / 1024 / 1024).toFixed(1)} MB</span></li>`).join("");
    $("#picked-list").innerHTML = names || '<li class="muted">未选择文件</li>';
  });
  // 拖拽支持
  const drop = $("#import-drop");
  ["dragover", "dragenter"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("dragging"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("dragging"); }));
  drop.addEventListener("drop", (e) => {
    const files = [...(e.dataTransfer?.files || [])].filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    if (files.length) {
      state.pendingFiles = files;
      $("#picked-list").innerHTML = files.map((f) => `<li>${I("file", 14)}${esc(f.name)}<span>${(f.size / 1024 / 1024).toFixed(1)} MB</span></li>`).join("");
    }
  });
}

function promptModal(id) {
  const t = id ? state.db.prompts.find((x) => x.id === id) : null;
  openModal(`
    <header class="modal-head"><h2>${t ? "编辑" : "新建"}提示词模板</h2><button class="icon-btn" data-action="modal-close">${I("x", 17)}</button></header>
    <div class="modal-body">
      <label class="field"><span>名称</span><input id="pm-name" type="text" value="${esc(t?.name || "")}" placeholder="例如：快速批判性阅读"></label>
      <label class="field"><span>描述</span><input id="pm-desc" type="text" value="${esc(t?.desc || "")}" placeholder="一句话说明这个模板的用途"></label>
      <label class="field"><span>提示词内容</span>
        <textarea id="pm-content" rows="9" placeholder="你是学术文献助手…">${esc(t?.content || "")}</textarea>
        <p class="var-hint">可用变量：<code data-var="{{title}}">{{title}}</code><code data-var="{{abstract}}">{{abstract}}</code><code data-var="{{venue}}">{{venue}}</code><code data-var="{{lang}}">{{lang}}</code>（点击插入）</p>
      </label>
      <div class="switch-row">
        <label class="switch"><input type="checkbox" id="pm-default" ${t?.default || !t && state.db.prompts.length === 0 ? "checked" : ""}><span class="switch-track"></span><span class="switch-label">设为默认模板</span></label>
      </div>
    </div>
    <footer class="modal-foot">
      <button class="btn" data-action="modal-close">取消</button>
      <button class="btn btn-primary" data-action="save-prompt" data-id="${id || ""}">保存模板</button>
    </footer>`);
}

const catModal = (parentId = null) => {
  /* 父级下拉列出所有分类（含二级及更深），用缩进表达层级；
     排除自己与自己的后代，避免造出环。 */
  const target = parentId || "";
  const descendants = new Set();
  const collect = (id) => {
    state.db.categories.filter((c) => c.parent === id).forEach((c) => {
      if (!descendants.has(c.id)) { descendants.add(c.id); collect(c.id); }
    });
  };
  // 只排除 target 的后代（会造成环）；target 自己要保留为可选项，否则无法选中它
  if (target) collect(target);
  const depthOf = (c) => {
    let d = 0, cur = c;
    const seen = new Set();
    while (cur?.parent && !seen.has(cur.id)) { seen.add(cur.id); d++; cur = state.db.categories.find((x) => x.id === cur.parent); }
    return d;
  };
  const options = state.db.categories
    .filter((c) => !descendants.has(c.id))
    .map((c) => {
      const d = depthOf(c);
      return `<option value="${c.id}" ${c.id === target ? "selected" : ""}>${"\u00a0\u00a0\u00a0".repeat(d)}${esc(c.name)}</option>`;
    })
    .join("");
  const parentName = target ? (catName(target) || "") : "";
  return openModal(`
  <header class="modal-head"><h2>新建分类</h2><button class="icon-btn" data-action="modal-close">${I("x", 17)}</button></header>
  <div class="modal-body">
    <label class="field"><span>分类名称</span><input id="cat-name" type="text" placeholder="例如：强化学习"></label>
    <label class="field"><span>父级分类</span>
      <select id="cat-parent"><option value="">无（顶层分类）</option>${options}</select>
    </label>
    ${parentName ? `<p class="set-desc" style="margin:0">将创建在「${esc(parentName)}」下。</p>` : ""}
  </div>
  <footer class="modal-foot">
    <button class="btn" data-action="modal-close">取消</button>
    <button class="btn btn-primary" data-action="do-new-cat">创建</button>
  </footer>`);
};

/* ---------------- 路由 ---------------- */
let sidebarDirty = false;

function render(opts = {}) {
  closeAnnotationEditor();
  cancelWebAiResize?.();
  const hash = location.hash || "#/library";
  const [, view, id] = hash.split("/");
  const nextRoute = { view: view || "library", id };
  // 路由切换会清掉 overlay-root / 重建视图，而 saveCurrentNote() 是从编辑器 DOM
  // 读值的 —— 必须在 DOM 还在时先把未保存的笔记刷出去。
  flushNoteEditor();
  if (NoteEditor.isMounted() && !(nextRoute.view==='note' && noteState.host==='page' && noteState.paperId===nextRoute.id)) {
    NoteEditor.destroy(); noteState.ready=false; noteState.generation++;
  }
  // 离开阅读器之前（旧 DOM 还在）记录滚动位置；之后 state.route 会切到新路由，
  // 就再也读不到旧 DOM 了。阅读模式/缩放/网页 AI 开关本来就写在会话对象里。
  if (state.route.view === "reader") captureReaderScroll(state.route.id);
  disposePdfHosts();
  state.route = nextRoute;
  const noteView = state.route.view === "note";
  // 阅读器与笔记页都是「专注视图」：隐藏文献库侧栏，把宽度全部让给内容
  document.body.classList.toggle("reading", state.route.view === "reader" || noteView);
  $("#overlay-root").innerHTML = "";
  syncNotePanelLayout(null);   // 上面清空了 overlay-root，笔记面板（若开着）已不在，收回让宽
  if (state.route.view !== "reader") {
    // 只清理 DOM 与布局标记；阅读会话里的 webAi 开关/宽度、阅读模式、缩放和
    // 滚动位置全部保留，返回该文献时原样恢复。
    state.reader.panel = false;
    state.reader.notePanel = false;
    closeAnnotationPanel();
    // 离开阅读器：只隐藏原生窗口，不关闭、不销毁。
    // 浏览器窗口与会话（登录态/对话）原样保留；切回来时按会话恢复面板并重新对齐矩形，
    // 不会走 embed/导航。显式关闭网页 AI 才真正关闭（closeWebAiInline）。
    if (state.reader.webAi || webAiController.owner) hideWebAiNative();
    document.body.classList.remove("webai-open");
  }

  const app = $("#app");
  if (state.route.view === "reader") {
    const key = tabKey({ kind: "paper", paperId: state.route.id });
    if (!state.tabs.some((x) => tabKey(x) === key)) state.tabs.push({ kind: "paper", paperId: state.route.id });
    if (!$("#app .reader")) app.innerHTML = `<main id="view"></main>`;
    renderReader(state.route.id);
    if (state.reader.panel) {
      mountAiPanel(paperById(state.route.id));
    }
    // 笔记面板：切换阅读模式/缩放后恢复（面板内部的编辑内容由 noteState 维护）
    if (state.reader.notePanel) {
      mountNotePanel(paperById(state.route.id));
    }
    // 批注列表：跟随阅读器保留
    if (annotListState.open) {
      openAnnotationPanel(paperById(state.route.id));
    }
    renderTabStrip();
    return;
  }
  if (noteView) {
    // 笔记整页：与阅读器一样是专注视图 —— 不渲染侧栏，整页宽度都给编辑器。
    // 返回文献库走顶部「文献库」标签页。
    const p = paperById(state.route.id);
    if (!p) { location.hash = "#/library"; return; }
    const key = tabKey({ kind: "note", paperId: p.id });
    if (!state.tabs.some((x) => tabKey(x) === key)) state.tabs.push({ kind: "note", paperId: p.id });
    // 视图外壳只需一个 main#view（侧栏在这条路径上不参与布局）
    if (!$("#app #view") || $("#app #sidebar")) app.innerHTML = `<main id="view"></main>`;
    // 同一条笔记已经挂载时不要重建，否则会丢光标位置与滚动位置
    const mounted = $("#note-page") && noteState.host === "page" && noteState.paperId === p.id;
    if (!mounted) mountNotePage(p);
    renderTabStrip();
    return;
  }
  // 侧栏增量更新：纯导航只切换激活态（避免整体重建导致闪烁），数据变化时才全量重建
  if (!document.getElementById("sidebar")) {
    app.innerHTML = `
      <aside id="sidebar"></aside>
      <main id="view"></main>`;
    renderSidebar();
  } else if (sidebarDirty || opts.sidebar) {
    renderSidebar();
    sidebarDirty = false;
  } else {
    syncSidebarActive();
  }
  if (state.route.view === "tasks") renderTasks();
  else if (state.route.view === "settings") renderSettings();
  else renderLibrary();
  renderTabStrip();
}

/* ---------------- 顶部标签页（Zotero 式，内嵌于标题栏） ----------------
   标签项：{ kind: "paper" | "note", paperId }
   · paper → #/reader/<paperId>   （PDF 阅读）
   · note  → #/note/<paperId>     （独立笔记页，从文献库附件树的「笔记」进入）
   同一篇文献的同一类标签只保留一个：再次打开只切换过去，不重复堆叠。 */

const tabKey = (t) => `${t.kind}:${t.paperId}`;
const tabRoute = (t) => (t.kind === "note" ? "#/note/" : "#/reader/") + t.paperId;

/* 打开（或聚焦）某个标签页 */
function openTab(kind, paperId) {
  if (!paperById(paperId)) return;
  const t = { kind, paperId };
  if (!state.tabs.some((x) => tabKey(x) === tabKey(t))) state.tabs.push(t);
  const hash = tabRoute(t);
  if (location.hash === hash) render(); else location.hash = hash;
}

/* 关闭标签页：若关的是当前页，回到相邻标签，没有则回文献库 */
function closeTab(key) {
  const idx = state.tabs.findIndex((x) => tabKey(x) === key);
  if (idx < 0) return;
  const [closed] = state.tabs.splice(idx, 1);
  // 离开笔记标签页前先把未保存的改动刷出去
  if (closed.kind === "note" && state.route.view === "note" && state.route.id === closed.paperId) {
    flushNoteEditor();
  }
  // 关掉的是某篇文献的 PDF 阅读标签：该文献的阅读会话与它独占的原生窗口一并清理，
  // 避免关掉后浏览器窗口还挂在那里、下次重开又莫名恢复旧会话。
  // （还要看同一篇的笔记标签是否仍开着；笔记页不属于阅读会话。）
  if (closed.kind === "paper") {
    captureReaderScroll(closed.paperId);
    disposeReaderSession(closed.paperId);
  }
  renderTabStrip();
  const stillActive = closed.kind === "note"
    ? state.route.view === "note" && state.route.id === closed.paperId
    : state.route.view === "reader" && state.route.id === closed.paperId;
  if (stillActive) {
    const next = state.tabs[idx] || state.tabs[idx - 1];
    location.hash = next ? tabRoute(next) : "#/library";
  }
}

function renderTabStrip() {
  const strip = document.getElementById("tab-strip");
  if (!strip) return;
  // 自愈：清理指向已删除文献的标签
  state.tabs = state.tabs.filter((t) => paperById(t.paperId));
  // 页签是主导航：即使没有打开的文献，也保留「文献库」这一项
  strip.hidden = false;
  const v = state.route.view;
  const libActive = v === "library" || v === "tasks" || v === "settings";
  strip.innerHTML = `
    <button class="tab ${libActive ? "active" : ""}" data-action="route" data-id="library" title="文献库">
      ${I("book", 13)}<span class="tab-title">文献库</span>
    </button>
    ${state.tabs.map((t) => {
      const p = paperById(t.paperId);
      const note = t.kind === "note";
      const active = v === (note ? "note" : "reader") && state.route.id === t.paperId;
      const label = note ? noteTabLabel(t.paperId) : p.title;
      const ico = note ? "pencil" : "file";
      return `
      <div class="tab ${note ? "tab-note" : ""} ${active ? "active" : ""}"
           data-action="${note ? "open-note" : "open"}" data-id="${t.paperId}"
           data-tab-key="${tabKey(t)}" title="${esc(label)}">
        ${I(ico, 13)}<span class="tab-title">${esc(label)}</span>
        <button class="tab-close" data-action="close-tab" data-id="${tabKey(t)}" title="关闭标签页">${I("x", 12)}</button>
      </div>`;
    }).join("")}`;
}


/* 导航后的侧栏增量更新：仅激活态与标签云选中态（计数由全量重建维护） */
function syncSidebarActive() {
  const f = state.filter, view = state.route.view;
  document.querySelectorAll("#sidebar .nav-item").forEach((el) => {
    const act = el.dataset.action, id = el.dataset.id;
    const on = act === "smart" ? (f.smart === id && !f.cat)
      : act === "cat" ? f.cat === id
      : act === "route" ? view === id : false;
    el.classList.toggle("active", on);
  });
  document.querySelectorAll("#sidebar .tag-cloud .tag-chip").forEach((el) => {
    el.classList.toggle("active", f.tag === el.dataset.id);
  });
}

function markSidebarDirty() { sidebarDirty = true; }

window.addEventListener("hashchange", render);

/* ---------------- 分类右键菜单 ---------------- */
/* 在某个分类上右键 → 就在该分类下新建子分类 / 重命名 / 删除。
   之前只有「新建分类」按钮且父级只能选顶层，二级分类永远加不了子级。 */
let catMenuEl = null;

function closeCatMenu() {
  catMenuEl?.remove();
  catMenuEl = null;
}

function openCatMenu(catId, x, y) {
  closeCatMenu();
  const cat = state.db.categories.find((c) => c.id === catId);
  if (!cat) return;
  const el = document.createElement("div");
  el.className = "cat-menu";
  el.setAttribute("data-stop", "");
  el.innerHTML = `
    <div class="cat-menu-head">${esc(cat.name)}</div>
    <button class="cat-menu-item" data-action="cat-add-sub" data-id="${cat.id}">${I("plus", 14)}新建子分类</button>
    <button class="cat-menu-item" data-action="cat-rename" data-id="${cat.id}">${I("pencil", 14)}重命名</button>
    <button class="cat-menu-item danger" data-action="del-cat" data-id="${cat.id}">${I("trash", 14)}删除分类</button>`;
  document.body.appendChild(el);
  // 贴住鼠标，但不能溢出窗口
  const r = el.getBoundingClientRect();
  const left = Math.min(x, window.innerWidth - r.width - 8);
  const top = Math.min(y, window.innerHeight - r.height - 8);
  el.style.left = Math.max(8, left) + "px";
  el.style.top = Math.max(8, top) + "px";
  catMenuEl = el;
}

document.addEventListener("contextmenu", (e) => {
  const navCat = e.target.closest?.('.nav-item[data-action="cat"]');
  if (!navCat) { closeCatMenu(); return; }
  e.preventDefault();
  openCatMenu(navCat.dataset.id, e.clientX, e.clientY);
});
/* 点击别处关闭菜单。用 click（而不是 pointerdown）：pointerdown 会在 capture 阶段
   先于菜单项自己的 click 触发，导致菜单被移除、点击落空。 */
document.addEventListener("click", (e) => {
  if (catMenuEl && !catMenuEl.contains(e.target)) closeCatMenu();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeCatMenu();
});

/* ---------------- 事件委托 ---------------- */

/* 回到文献库：hash 路由与视图状态保持一致（否则在任务/设置页点击侧边栏会被
   render() 依据旧 hash 重新渲染回当前页，导致无法返回） */
function navLibrary(patch) {
  state.filter = { ...state.filter, ...patch };
  if (/^#\/(reader|tasks|settings)/.test(location.hash)) {
    location.hash = "#/library"; // 触发 hashchange → render
  } else {
    render();
  }
}

document.addEventListener("click", (e) => {
  const tagPopEl = document.getElementById("tag-pop");
  if (tagPopEl && !tagPopEl.classList.contains("hidden") && !e.target.closest(".tag-wrap")) {
    tagPopEl.classList.add("hidden");
  }
  const t = e.target.closest("[data-action]");
  const varChip = e.target.closest("[data-var]");
  if (varChip) {
    const ta = $("#pm-content");
    if (ta) { ta.value += varChip.dataset.var; ta.focus(); }
    return;
  }
  if (!t) return;
  const act = t.dataset.action;
  const id = t.dataset.id;

  switch (act) {
    /* 导航 */
    case "route": location.hash = "#/" + id; break;
    case "smart": navLibrary({ smart: id, cat: null }); break;
    case "cat": navLibrary({ smart: "all", cat: id }); break;
    case "cat-toggle": {
      // 只切换折叠状态，不改变当前选中的分类。
      // 图标是 <button> 里的 <span>，click 冒泡到外层 [data-action="cat"] 会顺带选中，
      // 所以这里用 stopPropagation —— 但点击事件已由外层委托拿到，需提前在捕获阶段拦。
      if (state.collapsedCats.has(id)) state.collapsedCats.delete(id);
      else state.collapsedCats.add(id);
      renderSidebar();
      break;
    }
    case "tag":
      navLibrary({ smart: "all", cat: null, tag: state.filter.tag === id ? null : id });
      break;
    case "clear-tag": navLibrary({ tag: null }); break;
    case "reset-filter": navLibrary({ smart: "all", cat: null, search: "", tag: null }); break;
    case "libview": state.libView = id; render(); break;
    case "open": openTab("paper", id); break;

    /* 列表条目展开/收起（Zotero 式附件树） */
    case "toggle-row": {
      if (state.expanded.has(id)) state.expanded.delete(id);
      else state.expanded.add(id);
      // 局部更新，避免整表重绘导致滚动位置跳动
      const wrap = t.closest(".row-wrap");
      if (wrap) {
        const open = state.expanded.has(id);
        const paper = paperById(id);
        wrap.classList.toggle("open", open);
        t.setAttribute("aria-expanded", String(open));
        t.innerHTML = I(open ? "chevD" : "chevR", 14);
        const tree = wrap.querySelector(".att-tree");
        if (tree) {
          tree.hidden = !open;
          tree.innerHTML = open && paper ? attachmentsHTML(paper) : "";
        }
      }
      break;
    }

    /* 从附件树直接打开指定产物（原文 / 译文 / 对照版） */
    case "open-file":
    case "open-file-zh":
    case "open-file-compare": {
      const target = paperById(id);
      if (!target) break;
      const mode = t.dataset.action === "open-file" ? "en"
        : t.dataset.action === "open-file-zh" ? "zh" : "dual2";
      // 按「目标文献」写会话，而不是写当前 state.reader（可能是另一篇的）
      readerSession(id).mode = mode;
      if (state.route.view === "reader" && state.route.id === id) renderReader(id);
      else openTab("paper", id);
      break;
    }

    /* 阅读器 */
    case "mode": state.reader.mode = id; renderReader(state.route.id); break;
    case "zoom": {
      zoomStep(Number(id) > 0 ? 1 : -1);
      break;
    }
    case "translate": {
      const target = paperById(t.dataset.id);
      if (LithubAPI.live && target?.live) {
        LithubAPI.translate(target.id)
          .then(() => toast("已加入翻译队列"))
          .catch((e) => toast(e.message || "发起翻译失败", "err"));
      } else {
        startTranslate(t.dataset.id);
      }
      break;
    }
    case "retry": {
      const task = state.db.tasks.find((x) => x.id === id);
      if (LithubAPI.live) {
        const live = state.liveTasks.find((x) => x.id === id);
        if (live) LithubAPI.translate(live.paper_id).then(() => toast("已重新加入队列")).catch((e) => toast(e.message, "err"));
      } else if (task) {
        task.status = "running"; task.time = "刚刚"; task.note = "重新解析版面…";
        renderTasks(); startTranslate(task.paperId);
      }
      break;
    }
    case "ai-panel":
      state.reader.notePanel = false;
      state.reader.panel = true;
      mountAiPanel(paperById(t.dataset.id));
      break;
    case "ai-close":
      state.reader.panel = false;
      aiStream.ctrl?.abort();
      $("#ai-panel")?.remove();   // 只关 AI 面板，别连带清掉批注侧栏
      break;

    /* 笔记面板 */
    case "note-panel":
      state.reader.panel = false;
      aiStream.ctrl?.abort();
      state.reader.notePanel = true;
      // 两侧栏都占右边，开笔记就收起批注，避免叠在一起
      if (annotListState.open) {
        closeAnnotationPanel();
        $('[data-action="annot-panel"]')?.classList.remove("is-on");
      }
      mountNotePanel(paperById(t.dataset.id));
      break;

    /* 文献库中点击附件树的「笔记」→ 独立标签页（不是在右侧栏打开） */
    case "open-note":
      openTab("note", id);
      break;
    /* 笔记页 / 笔记标签页 → 在阅读器中打开原文 */
    case "open-note-pdf":
      openTab("paper", id);
      break;
    case "note-tab-close":
      closeTab(tabKey({ kind: "note", paperId: state.route.id }));
      break;

    /* 批注列表侧栏 */
    case "annot-panel": {
      const p = paperById(id);
      if (!p) break;
      state.reader.panel = false;
      // openAnnotationPanel 内部会收起笔记面板并重置 notePanel
      if (annotListState.open) closeAnnotationPanel();
      else openAnnotationPanel(p);
      t.classList.toggle("is-on", annotListState.open);
      break;
    }
    case "annot-panel-close":
      closeAnnotationPanel();
      $('[data-action="annot-panel"]')?.classList.remove("is-on");
      break;
    case "annot-filter":
      annotListState.filter = id;
      $$(".annot-fbtn").forEach((b) => b.classList.toggle("active", b.dataset.id === id));
      renderAnnotationList();
      break;
    case "annot-jump": {
      // 点击列表项：滚动到对应页并高亮该批注
      const pane = activePdfPane();
      const ann = annotListState.items.find((a) => a.id === id);
      if (!pane || !ann) break;
      scrollToAnnotation(pane, ann);
      break;
    }
    case "annot-assign-current": {
      const paperId = state.route.id;
      const view = currentAnnotationView();
      const old = annotListState.items.find(a=>a.id===id);
      if (!old || (old.view && old.view!=='legacy') || t.disabled) break;
      t.disabled = true;
      (async()=>{
        try {
          const ann = await LithubAPI.updateAnnotation(paperId,id,{view});
          annotListRevision++;
          if (annotListState.paperId===paperId) {
            annotListState.items=annotListState.items.filter(a=>a.id!==id);
            if (annotListState.view===view) annotListState.items.push(ann);
            renderAnnotationList();
          }
          if (state.route.id===paperId && currentAnnotationView()===view) PdfAnnot.add(activePdfPane(),ann);
          toast('已归属当前版本');
        } catch(error) { t.disabled=false; toast(esc(error.message || '归属失败'),'err'); }
      })();
      break;
    }
    case "annot-del": {
      e.stopPropagation();
      const pane = activePdfPane();
      const p = paperById(state.route.id);
      if (!pane || !p || !LithubAPI.live) break;
      deleteAnnotationById(pane, p, id);
      break;
    }
    case "annot-export-notes":
      exportAnnotationsToNote();
      break;
    case "note-close":
      state.reader.notePanel = false;
      saveCurrentNote(true);
      closeNotePanel();   // 只关笔记面板，保留批注侧栏
      break;
    /* 面板 → 整页：把同一条笔记搬到新标签页，面板收起 */
    case "note-popout": {
      const pid = noteState.paperId || state.route.id;
      if (!pid) break;
      saveCurrentNote(true);
      state.reader.notePanel = false;
      closeNotePanel();
      openTab("note", pid);
      break;
    }
    case "note-new": createNote(); break;
    case "note-del": deleteCurrentNote(); break;
    case "note-save": saveCurrentNote(false); break;
    case "note-select": switchNote(id); break;
    case "note-pin": toggleNotePin(id); break;
    case "note-export": exportCurrentNote(); break;
    case "note-upload-retry": { const job=noteUploads.get(id); if(job)runNoteUpload(job); break; }
    case "note-upload-cancel": cancelNoteUpload(id); break;
    case "note-heading": NoteEditor.scrollToHeading(Number(id)); $('.note-outline')?.removeAttribute('open'); break;
    case "note-reload": {
      const p=paperById(noteState.paperId);
      if (p) initNoteEditor(p);
      break;
    }
    case "note-mode":
      if (!noteState.ready) break;
      noteState.mode = id;
      layoutNoteMode();
      break;
    case "note-insert-image": {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.multiple = true;
      input.onchange = () => handleNoteImageFiles(input.files);
      input.click();
      break;
    }
    case "ai-regen": regenSummary(paperById(t.dataset.id), true); break;
    case "ai-retry": {
      // 重试就是针对当前配置再发一次（视同用户点了发送）
      const p = paperById(t.dataset.id);
      if (p?.live) { state.reader.panel = true; mountAiPanel(p); startSummaryStream(p, true); }
      else { state.reader.panel = true; mountAiPanel(p); }
      break;
    }
    case "ai-copy": {
      if (LithubAPI.live && aiStream.text) {
        copyToClipboard(aiStream.text)
          .then((ok) => toast(ok ? "总结已复制到剪贴板" : "复制失败", ok ? "ok" : "err"));
      } else {
        toast("总结已复制到剪贴板");
      }
      break;
    }
    case "edit-prompts": location.hash = "#/settings"; setTimeout(() => { state.settingsTab = "prompts"; render(); }, 0); break;

    /* ---- 内嵌网页 AI（与论文并排） ---- */
    case "webai-toggle": {
      if (state.reader.webAi) closeWebAiInline();
      else openWebAiInline(state.db.settings.webAiURL);
      break;
    }
    case "webai-close": closeWebAiInline(); break;
    case "webai-reload": {
      // view 模式有 WebContentsView，可以直接 reload；
      // browser 模式是一个真实的浏览器窗口，没法命令它刷新，只能关掉重开一次。
      if (webAiMode() === "view") window.lithub?.webAi?.reload();
      else openWebAiInline(state.reader.webAiURL || state.db.settings.webAiURL, true);
      break;
    }
    case "webai-back": window.lithub?.webAi?.back(); break;
    case "webai-site": {
      // 弹一个小菜单让用户切换站点（默认站点 + 自定义站点）
      const s = state.db.settings;
      const list = [{ name: "默认站点", url: s.webAiURL }, ...(s.webAiSites || [])].filter((x) => x.url);
      const hint = webAiMode() === "browser"
        ? "面板里是你本机 Chrome/Edge 的独立窗口，登录态和你平时完全一样。"
        : "当前用的是应用自己的浏览器内核，需要在这里登录一次（之后会记住）。";
      openModal(`
        <header class="modal-head"><h2>切换网页 AI 站点</h2><button class="icon-btn" data-action="modal-close">${I("x", 17)}</button></header>
        <div class="modal-body">
          <div class="webai-pick-list">
            ${list.map((x, i) => `<button class="webai-pick" data-action="webai-pick-site" data-idx="${i}"
              data-url="${esc(x.url)}"><b>${esc(x.name || x.url)}</b><span>${esc(x.url)}</span></button>`).join("")}
          </div>
          <p class="set-desc" style="margin-top:14px">${hint}</p>
        </div>`);
      break;
    }
    case "webai-pick-site": {
      const url = t.dataset.url;
      closeModal();
      openWebAiInline(url);
      break;
    }
    /* ---- 设置页：浏览器路径（自动检测 / 手动指定） ---- */
    case "webai-browse-exe": {
      (async () => {
        try {
          const r = await window.lithub.browser.pickExe();
          if (!r?.ok) {
            if (!r?.canceled) toast(r?.error || "选择失败", "err");
            return;
          }
          const chk = await window.lithub.browser.checkPath(r.path);
          const input = document.getElementById("set-webai-browser-path");
          if (!chk?.ok) {
            // 选到了非 Chromium 程序：明确拦下来，别等到开面板才炸
            toast(`这个程序不能用：${chk?.error || "不是 Chromium 系浏览器"}`, "err");
            return;
          }
          if (input) input.value = chk.path || r.path;
          state.db.settings.webAiBrowserPath = chk.path || r.path;
          browserDetectCache = null;         // 自定义路径变了，重新探测
          await refreshBrowserSelect(true);
          toast(`已指定 ${chk.name}`);
        } catch (e) {
          toast(e.message || "选择浏览器失败", "err");
        }
      })();
      break;
    }
    case "webai-redetect": {
      (async () => {
        browserDetectCache = null;
        await refreshBrowserSelect(true);
        const n = (browserDetectCache || []).length;
        toast(n ? `检测到 ${n} 个浏览器` : "没有检测到 Chrome / Edge");
      })();
      break;
    }
    /* ---- 网页 AI 面板：喂料动作（复制 PDF / 提示词） ---- */
    case "webai-copy-pdf": {
      const p = paperById(id);
      if (!p) break;
      (async () => {
        try {
          const r = await LithubAPI.copyPaperFile(p.id, "original");
          toast(`PDF 已复制（${Math.round((r.size || 0) / 1024)} KB），到网页 AI 对话框里 Ctrl+V 上传`);
        } catch (e) {
          // 只报错，不去「另存到下载文件夹」——用户要的是复制，不是下载（见 HANDOFF 易踩坑）
          toast(`复制 PDF 失败：${e.message || "未知错误"}`, "err");
        }
      })();
      break;
    }
    case "webai-copy-prompt": {
      const p = paperById(id);
      if (!p) break;
      (async () => {
        try {
          const text = buildWebAiPrompt(p);
          if (await copyToClipboard(text)) toast("提示词已复制，粘到网页 AI 后把 PDF 一起发过去");
          else toast("复制失败", "err");
        } catch (e) {
          toast(e.message || "复制提示词失败", "err");
        }
      })();
      break;
    }

    case "tag-pop": {
      const pop = document.getElementById("tag-pop");
      if (!pop) break;
      const opening = pop.classList.contains("hidden");
      if (opening) {
        const p = paperById(id);
        if (!p) break;
        pop.innerHTML = tagPopInner(p);
      }
      pop.classList.toggle("hidden", !opening);
      break;
    }
    case "tag-add": {
      const p = paperById(id);
      if (!p || !t.dataset.tag) break;
      if (!p.tags.includes(t.dataset.tag)) setPaperTags(p.id, [...p.tags, t.dataset.tag]);
      break;
    }
    case "tag-remove": {
      const p = paperById(id);
      if (!p) break;
      setPaperTags(p.id, p.tags.filter((x) => x !== t.dataset.tag));
      break;
    }
    case "tag-add-input": addTagsFromInput(paperById(id)); break;
    case "close-tab": closeTab(id); break;
    case "toggle-fav": {
      const p = paperById(id);
      if (!p) break;
      p.fav = !p.fav;
      t.classList.toggle("faved", p.fav);
      t.title = p.fav ? "取消收藏" : "收藏";
      markSidebarDirty();
      if (LithubAPI.live && p.live) LithubAPI.updatePaper(id, { fav: p.fav }).catch(() => toast("同步失败", "err"));
      break;
    }
    case "cat-remove": {
      const p = paperById(id);
      if (!p) break;
      const from = catName(p.cat) || "分类";
      if (setPaperCat(id, "local")) {
        toast(`已移出「${from}」，回到本地文献`);
        render();
      }
      break;
    }
    case "del-paper": {
      const p = paperById(id);
      if (!p) break;
      confirmModal("删除文献", `确认删除《${esc(p.title)}》？原文、译文与相关任务将一并移除，此操作不可恢复。`, "do-del-paper", id);
      break;
    }
    case "do-del-paper": {
      closeModal();
      const done = () => {
        markSidebarDirty();
        // 该文献的所有标签页（PDF + 笔记）一并关闭
        state.tabs = state.tabs.filter((x) => x.paperId !== id);
        if (noteState.paperId === id) noteState.paperId = null;
        // 清理该文献的阅读会话；若唯一的内嵌窗口正属于它，也一并关闭
        captureReaderScroll(id);
        disposeReaderSession(id);
        renderTabStrip();
        toast("已删除");
        if (state.route.view === "reader" || state.route.view === "note") location.hash = "#/library";
        else render();
      };
      if (LithubAPI.live && paperById(id)?.live) {
        LithubAPI.deletePaper(id)
          .then(async () => { await loadLiveLibrary(); done(); })
          .catch((e) => toast(e.message || "删除失败", "err"));
      } else {
        state.db.papers = state.db.papers.filter((x) => x.id !== id);
        state.db.tasks = state.db.tasks.filter((x) => x.paperId !== id);
        done();
      }
      break;
    }
    case "del-cat": {
      // 客户端预检查（后端同样兜底）：子分类与文献数
      const kids = state.db.categories.filter((c) => c.parent === id).length;
      const n = state.db.papers.filter((p) => (p.cat || "local") === id).length;
      if (kids) { toast("请先删除其子分类", "err"); break; }
      if (n) { toast(`分类下仍有 ${n} 篇文献，请先删除或移动`, "err"); break; }
      confirmModal("删除分类", `确认删除分类「${esc(catName(id) || id)}」？`, "do-del-cat", id);
      break;
    }
    case "do-del-cat": {
      closeModal();
      const removeLocal = () => {
        state.db.categories = state.db.categories.filter((c) => c.id !== id);
        if (state.filter.cat === id) state.filter = { ...state.filter, cat: null, smart: "all" };
      };
      if (LithubAPI.live) {
        LithubAPI.deleteCategory(id)
          .then(async () => {
            removeLocal();
            toast("分类已删除");
            try { state.db.categories = await LithubAPI.categories(); } catch {}
            markSidebarDirty();
            render();
          })
          .catch((e) => toast(e.message || "删除失败", "err"));
      } else {
        removeLocal();
        toast("分类已删除");
        render();
      }
      break;
    }

    /* 弹层 */
    case "import": importModal(); break;
    case "rename-paper": renamePaperInline(id); break;
    case "pick-files": $("#import-file").click(); break;
    case "mask-close": if (e.target === t) closeModal(); break;
    case "modal-close": closeModal(); break;
    case "do-import": {
      if (LithubAPI.live) {
        if (!state.pendingFiles.length) { toast("请先选择要导入的 PDF 文件", "err"); break; }
        const targetCat = $("#import-cat")?.value || "local";
        const autoTitle = $("#import-auto-title")?.checked !== false;
        const files = [...state.pendingFiles];
        if (t.disabled) break;
        t.disabled = true;
        (async () => {
          let ok = 0, fail = 0;
          for (const f of files) {
            try { await LithubAPI.importFile(f, targetCat, autoTitle); ok++; }
            catch (e) { fail++; toast(`${f.name}：${e.message}`, "err"); }
          }
          closeModal();
          if (ok) {
            toast(`已导入 ${ok} 个文件到「${catName(targetCat) || "分类"}」`);
            await loadLiveLibrary();
            markSidebarDirty();
            state.filter = { smart: "all", cat: targetCat, search: "", tag: null };
            render();
          } else if (fail) toast("导入失败", "err");
        })();
      } else {
        closeModal(); toast("已加入导入队列（演示）");
      }
      break;
    }
    case "new-cat": catModal(null); break;
    case "cat-add-sub": {
      // 右键某个分类 → 在它下面新建子分类（支持任意层级）
      closeCatMenu();
      catModal(id);
      break;
    }
    case "cat-rename": {
      closeCatMenu();
      const cat = state.db.categories.find((c) => c.id === id);
      if (!cat) break;
      openModal(`
        <header class="modal-head"><h2>重命名分类</h2><button class="icon-btn" data-action="modal-close">${I("x", 17)}</button></header>
        <div class="modal-body">
          <label class="field"><span>分类名称</span>
            <input id="cat-rename-name" type="text" value="${esc(cat.name)}" maxlength="40">
          </label>
        </div>
        <footer class="modal-foot">
          <button class="btn" data-action="modal-close">取消</button>
          <button class="btn btn-primary" data-action="do-rename-cat" data-id="${cat.id}">保存</button>
        </footer>`);
      setTimeout(() => { const i = $("#cat-rename-name"); i?.focus(); i?.select(); }, 30);
      break;
    }
    case "do-rename-cat": {
      const name = ($("#cat-rename-name")?.value || "").trim();
      if (!name) { toast("请填写分类名称", "err"); break; }
      closeModal();
      const cat = state.db.categories.find((c) => c.id === id);
      if (!cat) break;
      const apply = () => { cat.name = name; };
      if (LithubAPI.live) {
        LithubAPI.updateCategory(id, { name })
          .then(async () => {
            toast("分类已重命名");
            try { state.db.categories = await LithubAPI.categories(); } catch {}
            markSidebarDirty();
            render();
          })
          .catch((e) => toast(e.message || "重命名失败", "err"));
      } else {
        apply();
        toast("分类已重命名");
        render();
      }
      break;
    }
    case "do-new-cat": {
      const name = $("#cat-name").value.trim();
      if (!name) { toast("请填写分类名称", "err"); return; }
      const parent = $("#cat-parent").value || null;
      closeModal();
      if (LithubAPI.live) {
        LithubAPI.createCategory(name, parent)
          .then(async () => {
            toast(`已创建分类「${name}」`);
            try { state.db.categories = await LithubAPI.categories(); } catch {}
            markSidebarDirty();
            render();
          })
          .catch((e) => toast(e.message || "创建失败", "err"));
      } else {
        state.db.categories.push({ id: "c" + Date.now(), name, parent });
        toast(`已创建分类「${name}」`);
        render();
      }
      break;
    }
    case "new-prompt": promptModal(null); break;
    case "edit-prompt": promptModal(id); break;
    case "save-prompt": {
      const name = $("#pm-name").value.trim();
      if (!name) { toast("请填写模板名称", "err"); return; }
      const data = {
        name, desc: $("#pm-desc").value.trim() || "自定义模板",
        content: $("#pm-content").value || "（空）",
        default: $("#pm-default").checked,
      };
      const finish = async () => {
        if (LithubAPI.live) {
          try { state.db.prompts = await LithubAPI.prompts(); } catch {}
        }
        closeModal(); toast("模板已保存"); render();
      };
      if (LithubAPI.live) {
        const req = t.dataset.id ? LithubAPI.updatePrompt(t.dataset.id, data) : LithubAPI.createPrompt(data);
        req.then(finish).catch((e) => toast(e.message || "保存失败", "err"));
        break;
      }
      if (data.default) state.db.prompts.forEach((x) => (x.default = false));
      if (t.dataset.id) {
        Object.assign(state.db.prompts.find((x) => x.id === t.dataset.id), data);
      } else {
        state.db.prompts.push({ id: "d" + Date.now(), ...data });
      }
      finish();
      break;
    }
    case "del-prompt": {
      const removeLocal = () => {
        state.db.prompts = state.db.prompts.filter((x) => x.id !== id);
        if (state.reader.prompt === id) state.reader.prompt = (state.db.prompts.find((x) => x.default) || state.db.prompts[0]).id;
      };
      if (LithubAPI.live) {
        LithubAPI.deletePrompt(id)
          .then(async () => { removeLocal(); toast("模板已删除"); state.db.prompts = await LithubAPI.prompts(); render(); })
          .catch((e) => toast(e.message || "删除失败", "err"));
        break;
      }
      if (state.db.prompts.length <= 1) { toast("至少保留一个模板", "err"); return; }
      removeLocal();
      toast("模板已删除"); render(); break;
    }

    /* 设置 */
    case "updates-check": void AppUpdates.check(); break;
    case "updates-open":
      AppUpdates.openRelease().then(result => { if (!result.ok) toast(esc(result.error), 'err'); });
      break;
    case "updates-details":
      t.closest('.toast')?.remove();
      state.settingsTab = "about";
      if (location.hash === '#/settings') render(); else location.hash = '#/settings';
      break;
    case "pdf-storage-browse": {
      if (pdfStorageState.busy) break;
      window.lithub?.pdfStorage?.pickDirectory($("#set-pdf-directory")?.value).then(result => {
        const input = document.getElementById("set-pdf-directory");
        if (result.ok && input) input.value = result.directory;
      }).catch(error => toast(error.message, "err"));
      break;
    }
    case "pdf-storage-default":
      if (!pdfStorageState.busy && pdfStorageState.info) $("#set-pdf-directory").value = pdfStorageState.info.default_directory;
      break;
    case "pdf-storage-open":
      window.lithub?.pdfStorage?.openDirectory().then(result => { if (!result.ok) toast(result.error, "err"); })
        .catch(error => toast(error.message, "err"));
      break;
    case "pdf-storage-apply": applyPdfStorage(); break;
    case "set-tab": state.settingsTab = id; render(); break;
    case "provider": {
      // 切服务商：先把当前输入框里的 Key 暂存到「原服务商」名下，
      // 再切到新服务商并回显它自己的 Key（各服务商互不干扰）。
      const s = state.db.settings;
      const prev = s.provider;
      const typedKey = ($("#set-key")?.value || "").trim();
      s.keyMasks = s.keyMasks || {};
      if (prev && typedKey && !isKeyMask(typedKey)) {
        // 用户改过（不是掩码）才记录为待保存的新 Key
        s.pendingKeys[prev] = typedKey;
      }
      s.provider = id;
      const pv = state.db.providers.find((x) => x.id === id);
      if (pv) {
        s.baseURL = pv.base;
        if (pv.models[0]) s.model = pv.models[0];
      }
      render(); break;
    }
    case "engine": state.db.settings.engine = id; render(); break;
    case "peek-key": {
      const k = $("#set-key");
      k.type = k.type === "password" ? "text" : "password";
      break;
    }
    case "test-conn": {
      if (!LithubAPI.live) {
        toast("演示模式：请在桌面应用中测试真实连接", "err");
        break;
      }
      // 测试的是「当前界面上填的值」，而不是已保存的旧配置：
      // 用户可能刚切了服务商/改了 Base URL 或模型还没保存。
      const draft = {
        provider: state.db.settings.provider || "",
        base_url: $("#set-base")?.value.trim() || "",
        model: $("#set-model")?.value.trim() || "",
        api_key: $("#set-key")?.value.trim() || "",
      };
      if (!draft.base_url) { toast("请先填写 Base URL", "err"); break; }
      const b = t;
      const st = $("#conn-state");
      b.disabled = true; b.innerHTML = `${I("refresh", 14)}连接中…`;
      if (st) { st.textContent = ""; st.className = "conn-state"; }
      LithubAPI.testSettings(draft)
        .then((r) => {
          toast(`连接成功 · ${r.model} 可用`);
          if (st) { st.textContent = `✓ ${r.model} 可用`; st.className = "conn-state ok"; }
        })
        .catch((err) => {
          toast(err.message || "连接失败", "err");
          if (st) { st.textContent = `✕ ${err.message || "连接失败"}`; st.className = "conn-state err"; }
        })
        .finally(() => { b.disabled = false; b.innerHTML = `${I("play", 14)}测试连接`; });
      break;
    }
    case "save-settings": {
      const s = state.db.settings;
      if ($("#set-base")) s.baseURL = $("#set-base").value;
      const keyInput = ($("#set-key")?.value.trim()) || "";
      if ($("#set-model")) s.model = $("#set-model").value;
      if ($("#set-temp")) s.temperature = Number($("#set-temp").value);
      if ($("#set-engine-url")) s.engineURL = $("#set-engine-url").value;
      if ($("#set-target")) s.target = $("#set-target").value;
      if ($("#set-dual")) s.dualDefault = $("#set-dual").checked;
      if ($("#set-formula")) s.formulaProtect = $("#set-formula").checked;
      // 网页 AI 配置
      if ($("#set-webai-url")) s.webAiURL = $("#set-webai-url").value.trim();
      if ($("#set-webai-browser")) s.webAiBrowser = $("#set-webai-browser").value;
      if ($("#set-webai-browser-path")) s.webAiBrowserPath = $("#set-webai-browser-path").value.trim();
      // 站点列表从 DOM 读（支持动态增删）
      const siteRows = $$("#webai-sites .webai-site-row");
      if (siteRows.length) {
        s.webAiSites = siteRows.map((row) => ({
          name: row.querySelector(".webai-site-name")?.value.trim() || "",
          url: row.querySelector(".webai-site-url")?.value.trim() || "",
        })).filter((x) => x.url);
      }
      if (LithubAPI.live) {
        const service = s.engine === "openai" ? "openai" : "bing";
        // 掩码（含 *）或空 = 该服务商没改 Key，不提交，保留服务端真值。
        const keyIsMask = !keyInput || isKeyMask(keyInput);
        // 合并所有待保存的服务商 Key（切服务商时暂存过的 + 当前这个）
        const keys = { ...(s.pendingKeys || {}) };
        if (!keyIsMask) keys[s.provider] = keyInput;
        LithubAPI.saveSettings({
          service,
          provider: s.provider || "",
          base_url: s.baseURL || "",
          ...(keyIsMask ? {} : { api_key: keyInput }),
          ...(Object.keys(keys).length ? { api_keys: keys } : {}),
          model: s.model || "",
          target_lang: "zh",
          web_ai_url: s.webAiURL || "",
          web_ai_sites: s.webAiSites || [],
          // 内嵌方式固定为「嵌入我的浏览器」：设置页已去掉这个选项（只剩这一种实现）
          web_ai_embed_mode: "browser",
          web_ai_browser: s.webAiBrowser || "",
          web_ai_browser_path: s.webAiBrowserPath || "",
        }).then((saved) => {
          s.pendingKeys = {};       // 已落盘，清空暂存
          applyLiveSettings(saved);
          render();
          toast("设置已保存，已同步到本地服务");
        }).catch(() => toast("设置已保存（同步本地服务失败）", "err"));
      } else {
        s.apiKey = keyInput;
        s.hasKey = Boolean(keyInput) && !isKeyMask(keyInput);
        toast("设置已保存");
      }
      break;
    }
    case "webai-site-add": {
      const s = state.db.settings;
      s.webAiSites = [...(s.webAiSites || []), { name: "", url: "" }];
      render();
      break;
    }
    case "webai-site-del": {
      const s = state.db.settings;
      const i = Number(t.dataset.idx);
      s.webAiSites = (s.webAiSites || []).filter((_, j) => j !== i);
      render();
      break;
    }
    case "theme": state.db.settings.theme = id; renderSidebar(); render(); break;
    case "accent": state.db.settings.accent = id; renderSidebar(); render(); break;
    case "toggle-theme":
      state.db.settings.theme = state.db.settings.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = state.db.settings.theme;
      if (state.route.view === "settings") render(); else { const b = $('[data-action="toggle-theme"]'); if (b) b.innerHTML = I(state.db.settings.theme === "dark" ? "sun" : "moon", 17); }
      break;

    case "glossary": toast("术语表上传为演示交互"); break;
  }
});

/* 搜索输入 / 排序 / 温度滑杆 / 提示词切换 */
document.addEventListener("input", (e) => {
  if (e.target.id==='note-search') renderNoteList();
  if (e.target.id === "set-temp") $("#temp-val").textContent = e.target.value;
  if (e.target.id === "prompt-sel") {
    state.reader.prompt = e.target.value;
    // 切换模板不再自动请求：只刷新「待发送」提示，由用户决定何时发送。
    // 该模板已有缓存时顺带展示缓存。
    const p = paperById(state.route.id);
    if (p?.live) showCachedSummary(p);
  }
  /* 笔记：编辑内容或标题 → 实时预览 + 安排自动保存 */
  if (e.target.id === "note-editor") markNoteDirty();
  if (e.target.id === "note-title") {
    markNoteDirty();
    // 标题变化同步到下拉框，但不打断用户输入
    const opt = $(`#note-sel option[value="${noteState.currentId}"]`);
    if (opt) opt.textContent = e.target.value || "未命名笔记";
    // 同步到标签页标题
    state.noteTitles[noteState.paperId] = e.target.value;
    updateNoteTabTitle();
  }
});
document.addEventListener("change", (e) => {
  if (e.target.id === "set-update-auto") {
    void AppUpdates.setAutoCheck(e.target.checked).catch(error => toast(esc(error.message), 'err'));
  }
  if (e.target.id === "sort-sel") { state.sort = e.target.value; render(); }
  if (e.target.id === "zoom-sel") {
    const v = e.target.value;
    if (v === "width" || v === "page") applyReaderZoom(null, v);
    else applyReaderZoom(Number(v));
  }
  if (e.target.id === "vision-chk") {
    state.reader.vision = e.target.checked;
    // 同理：切换视觉模式只更新待发送状态 / 展示对应缓存，不自动发起请求
    const p = paperById(state.route.id);
    if (p?.live) showCachedSummary(p);
  }
  /* 笔记：切换笔记前先保存当前这条 */
  if (e.target.id === "note-sel") {
    const next = e.target.value;
    if (next && next !== noteState.currentId) {
      switchNote(next);
    }
  }
});

/* 笔记图片粘贴 / 拖入由 Vditor 内部的 upload.handler 接管
   （见 note-editor.js 的 uploadImages → uploadNoteImage）。
   这里只需在编辑器容器上显示拖放提示。 */
document.addEventListener("dragover", (e) => {
  if (!e.target.closest?.("#note-editor-wrap")) return;
  e.preventDefault();
  $("#note-drop-hint")?.classList.add("show");
});
document.addEventListener("dragleave", (e) => {
  if (!e.target.closest?.("#note-editor-wrap")) return;
  $("#note-drop-hint")?.classList.remove("show");
});
document.addEventListener("drop", (e) => {
  if (!e.target.closest?.("#note-editor-wrap")) return;
  // Vditor 自己会读取 dataTransfer.files 并调用 upload.handler；
  // 这里只做两件事：收起提示、阻止冒泡触发「拖入 PDF 导入」
  $("#note-drop-hint")?.classList.remove("show");
  e.stopPropagation();
}, true);

/* ---------------- PDF 批注：划词 → 高亮 / 划线 / 批注 ---------------- */

const ANNOT_COLOR_LIST = ["yellow", "green", "blue", "pink", "purple"];
let lastAnnotationColor = "yellow";
try { const saved = localStorage.getItem("lithub-annotation-color"); if (ANNOT_COLOR_LIST.includes(saved)) lastAnnotationColor = saved; } catch {}
const annotationDrafts = new Map();
const annotationSaves = new Map();
const annotationDeleting = new Set();
const annotationKey = (paperId, annId) => `lithub-annotation-draft:${paperId}:${annId}`;

function readAnnotationDraft(paperId, annId) {
  const key = annotationKey(paperId, annId);
  if (annotationDrafts.has(key)) return annotationDrafts.get(key);
  try {
    const draft = JSON.parse(localStorage.getItem(key) || "null");
    if (draft && typeof draft.comment === "string" && ANNOT_COLOR_LIST.includes(draft.color) && draft.kind === "note") return draft;
  } catch {}
  return annotationDrafts.get(key) || null;
}

function rememberAnnotationDraft(pop) {
  const input = pop?.querySelector("#annot-comment");
  if (!input) return null;
  const fields = { comment: input.value, kind: "note", color: pop.querySelector('[data-annot-color]').value };
  const key = annotationKey(pop.dataset.paperId, pop.dataset.annotId);
  annotationDrafts.set(key, fields);
  try { localStorage.setItem(key, JSON.stringify(fields)); } catch {}
  return fields;
}

function closeAnnotationEditor({ save = true } = {}) {
  const pop = $("#annot-pop");
  if (!pop) return;
  clearTimeout(pop._saveTimer);
  if (save && pop._dirty) {
    rememberAnnotationDraft(pop);
    saveAnnotationComment(pop._pane, pop.dataset.annotId, { silent:true, close:false, pop });
  }
  pop.remove();
  if (pop._pane?._pdf && !pop._pane._pdf.dead) PdfAnnot.select(pop._pane, null);
}
const ANNOT_KIND_META = {
  highlight: { label: "高亮", icon: "sparkle" },
  underline: { label: "划线", icon: "list" },
  note: { label: "批注", icon: "pencil" },
};
let pendingSelection = null;   // 划词浮条打开时冻结的选区信息
/* 批注列表的运行时状态（与 pdf-annot 面板内的绘制数据分开维护） */
const annotListState = { paperId: null, view: null, items: [], filter: "all", open: false, width: 360 };
const currentAnnotationView = () => PdfAnnot.viewFor(activePdfPane());
const annotationFitsCache = (ann, paperId) => annotListState.paperId === paperId &&
  (ann.view === annotListState.view || ann.view === 'legacy');
let annotListRevision = 0;
let annotListRequest = 0;
let disposeAnnotationPanelLayout = null;

function setAnnotationPanelWidth(width) {
  const max = Math.max(1, Math.min(900, window.innerWidth > 1100 ? window.innerWidth - 320 : window.innerWidth - 24));
  const min = Math.min(280, max);
  const value = Math.round(Math.max(min, Math.min(max, width)));
  annotListState.width = value;
  const panel = $("#annot-panel");
  if (panel) {
    panel.style.width = `${value}px`;
    document.body.style.setProperty("--annot-w", `${value}px`);
    const grip = panel.querySelector("[data-annot-grip]");
    grip?.setAttribute("aria-valuenow", value);
    grip?.setAttribute("aria-valuemin", min);
    grip?.setAttribute("aria-valuemax", max);
  }
  return value;
}

function makeAnnotationPanelResizable(panel) {
  const grip = panel.querySelector("[data-annot-grip]");
  const bar = $(".reader-bar");
  let drag = null;
  const align = () => {
    if (bar?.isConnected) document.body.style.setProperty("--annot-top", `${bar.getBoundingClientRect().bottom}px`);
  };
  const stop = () => {
    const current = drag;
    drag = null;
    document.body.classList.remove("annot-resizing");
    grip.classList.remove("dragging");
    if (current && grip.hasPointerCapture(current.id)) grip.releasePointerCapture(current.id);
  };
  grip.addEventListener("pointerdown", e => {
    if (e.button !== 0 || drag) return;
    e.preventDefault();
    drag = { id: e.pointerId, x: e.clientX, width: panel.getBoundingClientRect().width };
    grip.setPointerCapture(e.pointerId);
    grip.classList.add("dragging");
    document.body.classList.add("annot-resizing");
  });
  grip.addEventListener("pointermove", e => {
    if (drag && e.pointerId === drag.id) setAnnotationPanelWidth(drag.width + drag.x - e.clientX);
  });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach(type => grip.addEventListener(type, stop));
  grip.addEventListener("dblclick", () => setAnnotationPanelWidth(360));
  grip.addEventListener("keydown", e => {
    if (!["ArrowLeft", "ArrowRight", "Home"].includes(e.key)) return;
    e.preventDefault();
    setAnnotationPanelWidth(e.key === "Home" ? 360 : annotListState.width + (e.key === "ArrowLeft" ? 24 : -24));
  });
  const resize = () => { stop(); setAnnotationPanelWidth(annotListState.width); align(); };
  window.addEventListener("resize", resize);
  window.addEventListener("blur", stop);
  const observer = new ResizeObserver(align);
  if (bar) observer.observe(bar, { box: "border-box" });
  const titlebar = $("#titlebar");
  if (titlebar) observer.observe(titlebar, { box: "border-box" });
  setAnnotationPanelWidth(annotListState.width);
  align();
  disposeAnnotationPanelLayout = () => {
    stop();
    observer.disconnect();
    window.removeEventListener("resize", resize);
    window.removeEventListener("blur", stop);
    document.body.style.removeProperty("--annot-w");
    document.body.style.removeProperty("--annot-top");
  };
}

/* 当前可见的 PDF 面板（阅读器同一时刻只有一个） */
function activePdfPane() {
  return ["#pane-en", "#pane-zh", "#pane-dual2"].map((s) => $(s)).find((p) => p?._pdf) || null;
}

/* 同一篇文献可能在多个面板间切换，批注数据以 paper 为单位缓存 */
async function loadAnnotations(p) {
  if (!LithubAPI.live || !p?.live) return;
  const pane = activePdfPane();
  if (!pane) return;
  const revision = annotListRevision;
  const view = PdfAnnot.viewFor(pane);
  try {
    const list = await LithubAPI.annotations(p.id, view);
    if (state.route.id !== p.id || activePdfPane() !== pane) return;
    if (revision !== annotListRevision) return loadAnnotations(p);
    PdfAnnot.setAll(pane, list);
    // 同步到侧栏列表
    annotListState.paperId = p.id;
    annotListState.view = view;
    annotListState.items = list;
    renderAnnotationList();
  } catch (err) {
    console.error("加载批注失败:", err);
  }
}

/* 该文献的批注数量：优先用已加载的列表，未加载时返回 0（打开面板后才精确） */
function annotCountOf(paperId) {
  return annotListState.paperId === paperId && annotListState.view === currentAnnotationView()
    ? annotListState.items.filter(a=>a.view===annotListState.view).length : 0;
}

/* 侧栏列表局部刷新（新建/修改/删除后调用，避免重新请求） */
async function refreshAnnotationList(p) {
  if (!annotListState.open || !LithubAPI.live || !p?.live) return;
  const request = ++annotListRequest;
  const revision = annotListRevision;
  const view = currentAnnotationView();
  try {
    const items = await LithubAPI.annotations(p.id, view);
    if (!annotListState.open || annotListState.paperId !== p.id || view !== currentAnnotationView() || request !== annotListRequest || revision !== annotListRevision) return;
    annotListState.view = view;
    annotListState.items = items;
    renderAnnotationList();
  } catch {}
}

/* 打开/关闭批注列表侧栏 */
function openAnnotationPanel(p) {
  disposeAnnotationPanelLayout?.();
  if (annotListState.paperId !== p.id || annotListState.view !== currentAnnotationView()) annotListState.items = [];
  annotListState.open = true;
  annotListState.paperId = p.id;
  annotListState.view = currentAnnotationView();
  // 批注侧栏与笔记面板都占右侧：同时开两个会叠在一起，所以批注优先，
  // 顺手收起笔记面板（内容已自动保存，再点「笔记」就能回来）。
  if ($("#note-panel")) {
    state.reader.notePanel = false;
    flushNoteEditor();
    closeNotePanel();
  }
  document.body.classList.add("annot-open");   // 让阅读器为侧栏让出宽度
  $("#annot-panel")?.remove();
  const aside = document.createElement("aside");
  aside.className = "annot-panel";
  aside.id = "annot-panel";
  aside.innerHTML = annotationPanelHTML(p);
  $("#overlay-root").appendChild(aside);
  makeAnnotationPanelResizable(aside);
  renderAnnotationList();
  refreshAnnotationList(p);
}

function closeAnnotationPanel() {
  disposeAnnotationPanelLayout?.();
  disposeAnnotationPanelLayout = null;
  annotListState.open = false;
  document.body.classList.remove("annot-open");
  $("#annot-panel")?.remove();
}

function annotationPanelHTML(p) {
  return `
    <div class="annot-panel-grip" data-annot-grip role="separator" tabindex="0"
      aria-orientation="vertical" aria-label="调整批注侧栏宽度" aria-controls="annot-panel"
      title="拖动调整批注宽度（双击恢复默认；方向键微调）"></div>
    <header class="annot-head">
      <div class="ai-head-title">${I("list", 16)}<h2>批注</h2>
        <span class="annot-total" id="annot-total">0</span>
        <button class="icon-btn sm" data-action="annot-panel-close" title="关闭">${I("x", 15)}</button>
      </div>
      <div class="annot-filter" id="annot-filter">
        ${[["all", "全部"], ["highlight", "高亮"], ["underline", "划线"], ["note", "批注"]]
          .map(([id, label]) => `<button class="annot-fbtn ${annotListState.filter === id ? "active" : ""}"
            data-action="annot-filter" data-id="${id}">${label}</button>`).join("")}
      </div>
    </header>
    <div class="annot-body" id="annot-body"></div>
    <footer class="annot-foot">
      <span class="ai-meta" id="annot-meta"></span>
      <button class="btn sm" data-action="annot-export-notes" title="把全部批注按文序汇总为一条 Markdown 笔记">
        ${I("pencil", 14)}导出为笔记
      </button>
    </footer>`;
}

/* 渲染批注列表（按页分组） */
function renderAnnotationList() {
  const badge = $('[data-action="annot-panel"] .annot-count');
  if (badge) { const count=annotCountOf(state.route.id); badge.textContent=count || ''; badge.hidden=!count; }
  const body = $("#annot-body");
  if (!body) return;
  const scrollTop = body.scrollTop;
  const view = currentAnnotationView();
  const all = annotListState.items.filter(a=>a.view===view);
  const legacy = annotListState.items.filter(a=>!a.view || a.view==='legacy');
  const legacyHTML = legacy.length ? `<section class="annot-legacy"><p>未分版本的旧标记（${legacy.length}）</p>
    <small>旧标记没有记录阅读版本，暂不定位到 PDF。确认后可归属当前${{en:'原文',zh:'译文',dual2:'双语对照'}[view]}。</small>
    ${legacy.map(a=>`<div class="annot-legacy-item"><span>${esc(a.comment || a.text || '未命名标记')}</span>
      <button class="btn sm" data-action="annot-assign-current" data-id="${a.id}">归属当前版本</button></div>`).join('')}</section>` : '';
  const filter = annotListState.filter;
  const items = filter === "all" ? all : all.filter((a) => a.kind === filter);

  const total = $("#annot-total");
  if (total) total.textContent = String(all.length);
  const meta = $("#annot-meta");
  if (meta) meta.textContent = items.length ? `${items.length} 条${filter === "all" ? "" : "（筛选后）"}` : "";

  if (!items.length) {
    body.innerHTML = `<div class="annot-empty">
      ${I("list", 26)}
      <p>${all.length ? "当前筛选下没有批注" : "还没有批注"}</p>
      <span>${all.length ? "切换到「全部」查看" : "在 PDF 中选中文字即可添加高亮、划线或批注"}</span>
    </div>${legacyHTML}`;
    return;
  }

  // 按页码分组
  const byPage = new Map();
  for (const a of items) {
    const pg = a.page || 1;
    if (!byPage.has(pg)) byPage.set(pg, []);
    byPage.get(pg).push(a);
  }
  const pages = [...byPage.keys()].sort((x, y) => x - y);

  body.innerHTML = pages.map((pg) => `
    <section class="annot-group">
      <div class="annot-page-head">第 ${pg} 页<span>${byPage.get(pg).length} 条</span></div>
      ${byPage.get(pg).map((a) => annotationItemHTML(a)).join("")}
    </section>`).join("") + legacyHTML;
  body.scrollTop = scrollTop;
}

function annotationItemHTML(a) {
  const kind = ANNOT_KIND_META[a.kind] || ANNOT_KIND_META.highlight;
  const color = PdfAnnot.COLORS[a.color] || PdfAnnot.COLORS.yellow;
  const swatch = color.fill;   // 纯色（fill 已改为不透明）
  return `
  <article class="annot-item ${activePdfPane()?._annot?.selected === a.id ? "is-active" : ""}" data-action="annot-jump" data-id="${a.id}">
    <span class="annot-kind-dot" style="background:${swatch}" title="${kind.label}"></span>
    <div class="annot-item-main">
      <div class="annot-item-top">
        <span class="annot-kind">${kind.label}</span>
        <span class="annot-date">${esc((a.created || "").replace("T", " "))}</span>
      </div>
      ${a.text ? `<div class="annot-content-label">原文摘录</div><blockquote class="annot-text" title="${esc(a.text)}">${esc(a.text)}</blockquote>` : ""}
      ${a.kind === "note" && a.comment ? `<div class="annot-content-label">批注内容</div><p class="annot-comment">${esc(a.comment)}</p>` : ""}
    </div>
    <button class="icon-btn sm danger annot-del" data-action="annot-del" data-id="${a.id}" title="删除">${I("trash", 13)}</button>
  </article>`;
}

/* 滚动到某条批注所在页，并高亮它 */
function scrollToAnnotation(pane, ann) {
  closeAnnotationEditor();
  const pdf = pane._pdf;
  const idx = (ann.page || 1) - 1;
  const meta = pdf?.metas?.[idx];
  if (!meta) return;
  // 页码索引 → 对应的 .pdf-page 元素（取该行第一个已存在的 side）
  const pageEl = meta.sides.map((s) => s.div).find(Boolean);
  if (!pageEl) return;
  pageEl.scrollIntoView({ block: "center", behavior: "smooth" });
  // 选中态：给该批注所有矩形加 outline，2.4s 后自动取消
  PdfAnnot.select(pane, ann.id);
  clearTimeout(scrollToAnnotation._t);
  scrollToAnnotation._t = setTimeout(() => {
    if (pane._pdf) PdfAnnot.select(pane, null);
  }, 2400);
  // 列表项高亮
  $$(".annot-item").forEach((el) => el.classList.toggle("is-active", el.dataset.id === ann.id));
}

let pendingNoteReference = null;
function noteReferenceLink(paperId, annotation) {
  const data={paper:paperId,view:annotation.view,page:annotation.page || 1,rects:annotation.rects || []};
  const label=({en:'原文',zh:'译文',dual2:'双语对照'})[data.view] || '原文';
  return `[${label} · 第 ${data.page} 页](?lithub-ref=${encodeURIComponent(JSON.stringify(data))})`;
}
function openNoteReference(reference) {
  const paper=paperById(reference.paper);
  if (!paper || !['en','zh','dual2'].includes(reference.view) || !Number.isInteger(reference.page) || reference.page<1) {
    toast('引用的文献或阅读版本无效','err'); return;
  }
  if ((reference.view==='zh' && !paper.zhUrl) || (reference.view==='dual2' && !paper.compareUrl && !paper.zhUrl)) {
    toast('引用对应的译文或双语文件暂不可用','err'); return;
  }
  flushNoteEditor();
  pendingNoteReference=reference;
  readerSession(paper.id).mode=reference.view;
  if (state.route.view==='reader' && state.route.id===paper.id) renderReader(paper.id);
  else openTab('paper',paper.id);
}
function applyNoteReference(paper,pane) {
  const reference=pendingNoteReference;
  if (!reference || reference.paper!==paper.id || reference.view!==PdfAnnot.viewFor(pane)) return;
  pendingNoteReference=null;
  const page=pane._pdf?.metas?.[reference.page-1]?.sides?.find(s=>s.div)?.div;
  if (!page) { toast('引用页码已超出当前文件范围','err'); return; }
  page.scrollIntoView({block:'center'});
  const rects=Array.isArray(reference.rects)?reference.rects.slice(0,200):[];
  for (const r of rects) {
    if (![r.x,r.y,r.w,r.h].every(n=>Number.isFinite(n)&&n>=0&&n<=1)) continue;
    const flash=document.createElement('span'); flash.className='note-reference-flash';
    Object.assign(flash.style,{left:`${r.x*100}%`,top:`${r.y*100}%`,width:`${r.w*100}%`,height:`${r.h*100}%`});
    page.appendChild(flash); setTimeout(()=>flash.remove(),3000);
    if (r===rects[0]) flash.scrollIntoView({block:'center'});
  }
}
document.addEventListener('click', e=>{
  const link=e.target.closest('#note-body a[href]');
  if (!link) return;
  let url;
  try { url=new URL(link.getAttribute('href'),document.baseURI); } catch { return; }
  if (!url.searchParams.has('lithub-ref')) return;
  e.preventDefault(); e.stopImmediatePropagation();
  try { openNoteReference(JSON.parse(url.searchParams.get('lithub-ref'))); }
  catch { toast('引用内容无法读取','err'); }
},true);
async function insertSelectionInNote() {
  const selection=pendingSelection, paper=paperById(state.route.id);
  pendingSelection=null; $('.sel-pop')?.remove();
  if (!selection || !paper || !LithubAPI.live) return;
  const markdown=`\n> ${selection.text.replace(/\n/g,'\n> ')}\n\n${noteReferenceLink(paper.id,{view:selection.view,page:selection.pageIndex+1,rects:selection.rects})}\n\n`;
  if (!$('#note-panel') || noteState.paperId!==paper.id) {
    state.reader.notePanel=true;
    closeAnnotationPanel(); state.reader.panel=false;
    await mountNotePanel(paper);
  }
  if (noteState.paperId!==paper.id || !noteState.ready) return;
  // An excerpt is appended so opening the panel never inserts into an arbitrary restored selection.
  const content=NoteEditor.getValue()+markdown;
  if (noteState.mode==='read') { noteState.mode='live'; layoutNoteMode(); }
  NoteEditor.setValue(content); markNoteDirty();
  NoteEditor.focusEnd();
}

/* 汇总当前阅读版本，保留每条摘录的版本、页码与选区定位。 */
async function exportAnnotationsToNote() {
  const p = paperById(state.route.id);
  const items = annotListState.items.filter(a=>a.view===currentAnnotationView());
  if (!p) return;
  if (!items.length) { toast("还没有批注可导出", "warn"); return; }
  if (!LithubAPI.live) { toast("演示模式无法导出", "err"); return; }

  const byPage = new Map();
  for (const a of items) {
    const pg = a.page || 1;
    if (!byPage.has(pg)) byPage.set(pg, []);
    byPage.get(pg).push(a);
  }
  const pages = [...byPage.keys()].sort((x, y) => x - y);
  const lines = [
    `# 阅读批注 · ${p.title}`,
    "",
    `> 由 LitHub 于 ${new Date().toLocaleString("zh-CN")} 自动汇总，共 ${items.length} 条批注。`,
    "",
  ];
  for (const pg of pages) {
    lines.push(`## 第 ${pg} 页`, "");
    for (const a of byPage.get(pg)) {
      const kind = (ANNOT_KIND_META[a.kind] || ANNOT_KIND_META.highlight).label;
      if (a.text) {
        lines.push(`> ${a.text.replace(/\n+/g, " ")}`);
        lines.push("");
      }
      lines.push(`- **[${kind}]**${a.comment ? ` ${a.comment}` : ""}`);
      lines.push('',noteReferenceLink(p.id,a),'');
    }
    lines.push("");
  }
  const content = lines.join("\n");
  try {
    const note = await LithubAPI.createNote(p.id, { title: `阅读批注（${items.length} 条）`, content });
    if (noteState.paperId===p.id && NoteEditor.isMounted()) { noteState.notes.unshift(note); renderNoteSelect(); syncNoteCount(p.id); }
    toast(`已导出为笔记「${note.title}」`);
  } catch (err) {
    toast("导出失败：" + err.message, "err");
  }
}

/* 创建一条批注 */
async function createAnnotation(kind, color) {
  const sel = pendingSelection;
  // 立即清掉待处理选区，避免重复点击鼠标/重复创建同一处批注
  pendingSelection = null;
  $(".sel-pop")?.remove();
  if (!sel) return;
  const p = paperById(state.route.id);
  const pane = activePdfPane();
  if (!p || !pane) return;
  if (sel.view && sel.view !== PdfAnnot.viewFor(pane)) return;

  if (!LithubAPI.live) {
    toast("演示模式：批注需连接本地服务", "warn");
    return;
  }

  const payload = {
    view: PdfAnnot.viewFor(pane),
    kind,
    page: sel.pageIndex + 1,
    rects: sel.rects,
    text: sel.text.slice(0, 2000),
    color: color || "yellow",
    comment: "",
  };
  try {
    const ann = await LithubAPI.createAnnotation(p.id, payload);
    annotListRevision++;
    PdfAnnot.add(pane, ann);
    const stillCurrent = state.route.id === p.id && activePdfPane() === pane;
    if (stillCurrent) window.getSelection()?.removeAllRanges();
    if (kind === "note" && stillCurrent) {
      // 批注：立刻弹出输入框写备注
      openAnnotationEditor(pane, ann);
    } else {
      toast(kind === "underline" ? "已添加划线" : "已高亮选中内容");
    }
    // 侧栏列表若开着，实时刷新
    refreshAnnotationList(p);
  } catch (err) {
    toast("添加批注失败：" + err.message, "err");
  }
}

/* 批注气泡编辑：修改备注 / 换色 / 删除 */
function openMarkControls(pane, ann, paperId) {
  const pop = document.createElement('div');
  pop.id = 'annot-pop';
  pop.className = 'annot-pop annot-mark-controls';
  pop.dataset.annotId = ann.id;
  pop.dataset.paperId = paperId;
  pop._pane = pane;
  pop.setAttribute('role','toolbar');
  pop.setAttribute('aria-label',`${ANNOT_KIND_META[ann.kind].label}操作`);
  pop.innerHTML = `<span class="annot-save-state" role="status"></span>
    <div class="annot-mark-actions"><div class="annot-mark-colors" aria-label="颜色">
    ${ANNOT_COLOR_LIST.map((color,i)=>`<button class="sel-dot ${color===ann.color ? 'active' : ''}" type="button" data-mark-color="${color}"
      title="${['黄色','绿色','蓝色','粉色','紫色'][i]}" aria-label="${['黄色','绿色','蓝色','粉色','紫色'][i]}" aria-pressed="${color===ann.color}" style="--mark-color:${PdfAnnot.COLORS[color].fill}"><span aria-hidden="true"></span></button>`).join('')}
    </div><span class="annot-mark-separator" aria-hidden="true"></span><button class="icon-btn sm danger" data-annot-del title="删除" aria-label="删除${ANNOT_KIND_META[ann.kind].label}">${I('trash',14)}</button></div>`;
  $('#overlay-root').appendChild(pop);
  PdfAnnot.select(pane,ann.id);
  $$('.annot-item').forEach(el=>el.classList.toggle('is-active',el.dataset.id===ann.id));
  document.querySelector(`.annot-item[data-id="${CSS.escape(ann.id)}"]`)?.scrollIntoView({block:'nearest'});
  positionAnnotPopNearSelection(pop,pane,ann);
  pop.querySelectorAll('[data-mark-color]').forEach(button=>button.addEventListener('click',async()=>{
    if (!LithubAPI.live) { toast('请连接本地服务后修改颜色','err'); return; }
    const color = button.dataset.markColor;
    const status = pop.querySelector('.annot-save-state');
    status.textContent = '保存中…';
    pop.querySelectorAll('[data-mark-color]').forEach(el=>el.disabled=true);
    const key = annotationKey(paperId,ann.id);
    const previous = annotationSaves.get(key);
    const operation = (previous || Promise.resolve()).catch(()=>{}).then(()=>LithubAPI.updateAnnotation(paperId,ann.id,{color}));
    annotationSaves.set(key,operation);
    try {
      const updated = await operation;
      annotListRevision++;
      if (state.route.id===paperId && activePdfPane()) PdfAnnot.update(activePdfPane(),updated);
      if (annotListState.paperId===paperId) {
        annotListState.items=annotListState.items.map(item=>item.id===ann.id ? updated : item);
        renderAnnotationList();
      }
      pop.querySelectorAll('[data-mark-color]').forEach(el=>{
        el.classList.toggle('active',el.dataset.markColor===updated.color);
        el.setAttribute('aria-pressed',el.dataset.markColor===updated.color);
      });
      status.textContent='已保存';
    } catch (error) {
      status.textContent='保存失败';
      toast(esc(error.message || '修改颜色失败'),'err');
    } finally {
      if (annotationSaves.get(key)===operation) annotationSaves.delete(key);
      pop.querySelectorAll('[data-mark-color]').forEach(el=>el.disabled=false);
    }
  }));
}

function openAnnotationEditor(pane, ann) {
  const cur = PdfAnnot.get(pane, ann.id) || ann;
  closeAnnotationEditor();
  const paperId = state.route.id;
  if (cur.kind !== "note") {
    openMarkControls(pane,cur,paperId);
    return;
  }
  const draft = readAnnotationDraft(paperId, cur.id);
  const fields = draft || cur;
  const pop = document.createElement("div");
  pop.className = "annot-pop";
  pop.id = "annot-pop";
  pop.innerHTML = `
    <div class="annot-pop-head">
      <span class="annot-pop-grip" title="拖动可移动此框">⋮⋮</span>
      <span>批注</span>
      <span class="annot-save-state" role="status">${draft ? "已恢复草稿" : "已保存"}</span>
      <button class="icon-btn sm" data-annot-reset-pos title="回到批注文字旁">${I("refresh", 13)}</button>
      <button class="icon-btn sm" data-annot-close title="关闭">${I("x", 13)}</button>
    </div>
    ${cur.text ? `<blockquote class="annot-quote">${esc(cur.text.slice(0, 240))}${cur.text.length > 240 ? "…" : ""}</blockquote>` : ""}
    <div class="annot-edit-tools">
      <label>颜色<select data-annot-color>${ANNOT_COLOR_LIST.map((key,i)=>`<option value="${key}" ${fields.color===key ? "selected" : ""}>${["黄色","绿色","蓝色","粉色","紫色"][i]}</option>`).join("")}</select></label>
    </div>
    <textarea id="annot-comment" maxlength="4000" placeholder="写下你的想法…（自动保存，Ctrl+Enter 立即保存）">${esc(fields.comment || "")}</textarea>
    <div class="annot-pop-foot">
      <button class="btn sm danger" data-annot-del>${I("trash", 13)}删除</button>
      <button class="btn sm btn-primary" data-annot-save>${I("check", 13)}保存</button>
    </div>`;
  pop.dataset.annotId = cur.id;
  pop.dataset.paperId = paperId;
  pop._pane = pane;
  pop._dirty = !!draft && JSON.stringify(draft) !== JSON.stringify({comment:cur.comment || "",kind:cur.kind,color:cur.color});
  $("#overlay-root").appendChild(pop);
  PdfAnnot.select(pane, cur.id);
  $$(".annot-item").forEach(el=>el.classList.toggle("is-active",el.dataset.id===cur.id));
  document.querySelector(`.annot-item[data-id="${CSS.escape(cur.id)}"]`)?.scrollIntoView({block:"nearest"});
  const changed = () => {
    rememberAnnotationDraft(pop);
    pop._dirty = true;
    pop.querySelector('.annot-save-state').textContent = "草稿已暂存";
    clearTimeout(pop._saveTimer);
    pop._saveTimer = setTimeout(()=>saveAnnotationComment(pane,cur.id,{silent:true,close:false,pop}),800);
  };
  pop.querySelector('textarea').addEventListener('input',changed);
  pop.querySelectorAll('select').forEach(el=>el.addEventListener('change',changed));
  if (pop._dirty) pop._saveTimer = setTimeout(()=>saveAnnotationComment(pane,cur.id,{silent:true,close:false,pop}),800);
  // 定位到批注文字附近（下方优先，空间不足翻到上方）
  positionAnnotPopNearSelection(pop, pane, cur);
  // 支持按住气泡头部拖动；位置按批注 id 记住，重新打开时沿用
  makeAnnotPopDraggable(pop, pane, cur);
  $("#annot-comment")?.focus();
}

/* ---------------- 批注气泡拖动 ----------------
   用 Pointer Events（同时覆盖鼠标/触控），拖动时：
     - 只允许在头部（.annot-pop-head）按下，避免干扰输入框选词
     - 位置按批注 id 记在 annotPopPos 里，同一条批注再次打开保持原位
     - 拖动后转为「手动定位」：去掉指向三角（位置已不代表锚点关系）
     - 双击头部或用「回到批注文字旁」按钮可复位 */
const annotPopPos = new Map();   // annotId -> { left, top }

function makeAnnotPopDraggable(pop, pane, ann) {
  const head = pop.querySelector(".annot-pop-head");
  if (!head) return;
  head.classList.add("draggable");

  // 若该批注有记住的位置，直接应用
  const saved = annotPopPos.get(ann.id);
  if (saved) applyPopPos(pop, saved.left, saved.top, true);

  let dragging = false;
  let startX = 0, startY = 0, originLeft = 0, originTop = 0;

  const onDown = (e) => {
    // 点按钮/图标时不触发拖动
    if (e.target.closest("button, a, input, textarea, .icon-btn")) return;
    if (e.button !== undefined && e.button !== 0) return;
    dragging = true;
    const r = pop.getBoundingClientRect();
    originLeft = r.left;
    originTop = r.top;
    startX = e.clientX;
    startY = e.clientY;
    pop.classList.add("dragging");
    head.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };

  const onMove = (e) => {
    if (!dragging) return;
    const left = originLeft + (e.clientX - startX);
    const top = originTop + (e.clientY - startY);
    applyPopPos(pop, left, top, true);
  };

  const onUp = (e) => {
    if (!dragging) return;
    dragging = false;
    pop.classList.remove("dragging");
    head.releasePointerCapture?.(e.pointerId);
    // 记住位置（按视口坐标，窗口尺寸变化时会做钳制）
    annotPopPos.set(ann.id, { left: parseFloat(pop.style.left), top: parseFloat(pop.style.top) });
  };

  head.addEventListener("pointerdown", onDown);
  head.addEventListener("pointermove", onMove);
  head.addEventListener("pointerup", onUp);
  head.addEventListener("pointercancel", onUp);

  // 双击头部：复位到批注文字旁
  head.addEventListener("dblclick", (e) => {
    if (e.target.closest("button")) return;
    annotPopPos.delete(ann.id);
    pop.classList.remove("manually-placed", "anchored");
    pop.removeAttribute("style");
    positionAnnotPopNearSelection(pop, pane, ann);
  });

  pop._resetPosition = () => {
    annotPopPos.delete(ann.id);
    pop.classList.remove("manually-placed", "anchored");
    pop.removeAttribute("style");
    positionAnnotPopNearSelection(pop, pane, ann);
  };
}

/* 应用气泡位置：钳制在视口内，并切换为「手动定位」态（隐藏指向三角） */
function applyPopPos(pop, left, top, manual) {
  const pw = pop.offsetWidth || 320;
  const ph = pop.offsetHeight || 240;
  const M = 6;
  const x = Math.max(M, Math.min(window.innerWidth - pw - M, left));
  const y = Math.max(M, Math.min(window.innerHeight - ph - M, top));
  pop.style.left = `${Math.round(x)}px`;
  pop.style.top = `${Math.round(y)}px`;
  if (manual) {
    // 手动拖过就不再画指向三角（此时位置与锚点无关，三角会误导）
    pop.classList.add("manually-placed");
    pop.classList.remove("anchor-left", "anchor-right", "anchor-below", "anchor-above");
  }
}

/* 把批注气泡放到对应文字附近。
   优先级：右侧空白 → 左侧空白 → 文字下方 → 文字上方 → 贴视口底。
   为什么优先左右：PDF 正文行距紧凑，气泡放在文字正下方会挡住后面 5~8 行，
   而阅读器两侧通常有页边空白（双语对照时中间也有间隙），遮挡更少。 */
function positionAnnotPopNearSelection(pop, pane, ann) {
  const FALLBACK = () => {
    pop.style.left = `${Math.max(12, window.innerWidth - 340)}px`;
    pop.style.top = "120px";
  };
  const rects = ann.rects || [];
  if (!rects.length) return FALLBACK();

  const pdf = pane?._pdf;
  const pageIdx = (ann.page || 1) - 1;
  const meta = pdf?.metas?.[pageIdx];
  const pageEl = meta?.sides.map((s) => s.div).find(Boolean);
  if (!pageEl) return FALLBACK();

  const pr = pageEl.getBoundingClientRect();
  const first = rects.reduce((a, b) => (b.y < a.y ? b : a), rects[0]);
  const last = rects.reduce((a, b) => (b.y > a.y || (b.y === a.y && b.x > a.x) ? b : a), rects[0]);

  const anchorX = pr.left + (first.x + first.w / 2) * pr.width;
  const anchorTop = pr.top + first.y * pr.height;
  const anchorBottom = pr.top + (last.y + last.h) * pr.height;
  const lineRight = pr.left + (last.x + last.w) * pr.width;
  const lineLeft = pr.left + first.x * pr.width;

  const pw = pop.offsetWidth || 320;
  const ph = pop.offsetHeight || 240;
  if (pop.classList.contains('annot-mark-controls')) {
    const minTop = ($('.reader-bar')?.getBoundingClientRect().bottom || 0) + 8;
    const above = anchorTop - ph - 8;
    const top = above >= minTop ? above : anchorBottom + 8;
    pop.style.left = `${Math.round(Math.max(8,Math.min(innerWidth-pw-8,anchorX-pw/2)))}px`;
    pop.style.top = `${Math.round(Math.max(minTop,Math.min(innerHeight-ph-8,top)))}px`;
    return;
  }
  const GAP = 12;
  const M = 10;

  const clampY = (y) => Math.max(M, Math.min(window.innerHeight - ph - M, y));
  // 气泡垂直中心对齐批注文字，这样视线不用上下跳
  const centerY = (anchorTop + anchorBottom) / 2 - ph / 2;

  // 候选位置：右侧 / 左侧 / 下方 / 上方
  const rightSpace = window.innerWidth - lineRight;
  const leftSpace = lineLeft;

  let left, top, arrow = null;   // arrow: "left" | "right" | "below" | "above"

  if (rightSpace >= pw + GAP + M) {
    left = lineRight + GAP;
    top = clampY(centerY);
    arrow = "left";              // 三角在气泡左侧，指向批注
  } else if (leftSpace >= pw + GAP + M) {
    left = lineLeft - GAP - pw;
    top = clampY(centerY);
    arrow = "right";
  } else {
    // 左右都放不下：退回上下
    left = Math.max(M, Math.min(window.innerWidth - pw - M, anchorX - pw / 2));
    if (anchorBottom + GAP + ph <= window.innerHeight - M) {
      top = anchorBottom + GAP;
      arrow = "below";
    } else if (anchorTop - GAP - ph >= M) {
      top = anchorTop - GAP - ph;
      arrow = "above";
    } else {
      top = Math.max(M, window.innerHeight - ph - M);
      arrow = "below";
    }
  }

  pop.style.left = `${Math.round(left)}px`;
  pop.style.top = `${Math.round(top)}px`;
  pop.dataset.anchorX = String(Math.round(anchorX));
  pop.dataset.anchorY = String(Math.round(arrow === "above" ? anchorTop : arrow === "below" ? anchorBottom : (anchorTop + anchorBottom) / 2));

  // 三角定位：左右模式时跟随垂直中心，上下模式时跟随水平中心
  pop.classList.add("anchored", `anchor-${arrow}`);
  if (arrow === "left" || arrow === "right") {
    // 三角要在气泡的左边/右边，垂直位置对准锚点
    const v = Math.max(16, Math.min(ph - 16, ((anchorTop + anchorBottom) / 2) - top));
    pop.style.setProperty("--arrow-pos", `${Math.round(v)}px`);
  } else {
    const h = Math.max(18, Math.min(pw - 18, anchorX - left));
    pop.style.setProperty("--arrow-pos", `${Math.round(h)}px`);
  }
}

async function saveAnnotationComment(pane, annId, options = {}) {
  const pop = options.pop || $("#annot-pop");
  const paperId = pop?.dataset.paperId || state.route.id;
  const p = paperById(paperId);
  const fields = pop ? rememberAnnotationDraft(pop) : {comment:$("#annot-comment")?.value ?? ""};
  if (!p || !LithubAPI.live) return;
  const key = annotationKey(p.id, annId);
  if (!fields || annotationDeleting.has(key)) return;
  clearTimeout(pop?._saveTimer);
  const snapshot = JSON.stringify(fields);
  const status = pop?.querySelector('.annot-save-state');
  if (status) status.textContent = "保存中…";
  const previous = annotationSaves.get(key);
  const operation = (previous || Promise.resolve()).catch(()=>{}).then(()=>LithubAPI.updateAnnotation(p.id,annId,fields));
  annotationSaves.set(key, operation);
  try {
    const ann = await operation;
    annotListRevision++;
    if (annotationFitsCache(ann,p.id)) {
      const index = annotListState.items.findIndex(item => item.id === ann.id);
      if (index >= 0) annotListState.items[index] = ann;
      else annotListState.items.push(ann);
      renderAnnotationList();
    }
    const currentPane = state.route.id === p.id ? activePdfPane() : null;
    if (currentPane) PdfAnnot.update(currentPane, ann);
    const currentDraft = readAnnotationDraft(p.id, annId);
    if (!currentDraft || JSON.stringify(currentDraft) === snapshot) {
      annotationDrafts.delete(key);
      try { localStorage.removeItem(key); } catch {}
      if (pop) pop._dirty = false;
      if (status) status.textContent = "已保存";
      if (options.close !== false && pop?.isConnected) {
        pop.remove();
        if (currentPane) PdfAnnot.select(currentPane, null);
      }
    }
    if (!options.silent) toast("批注已保存");
  } catch (err) {
    if (status) status.textContent = "保存失败，草稿已保留";
    if (!options.silent) toast("保存失败：" + esc(err.message), "err");
  } finally {
    if (annotationSaves.get(key) === operation) annotationSaves.delete(key);
  }
}

/* 统一的批注删除入口：页面浮层按钮、气泡按钮、侧栏列表都走这里，
   保证「后端 → 页面绘制 → 侧栏列表 → 工具栏角标」四处同步。 */
async function deleteAnnotationById(pane, paper, annId) {
  if (!LithubAPI.live) return;
  const key = annotationKey(paper.id, annId);
  if (annotationDeleting.has(key)) return;
  annotationDeleting.add(key);
  try {
    if ($("#annot-pop")?.dataset.annotId === annId) closeAnnotationEditor({save:false});
    await annotationSaves.get(key)?.catch(()=>{});
    await LithubAPI.deleteAnnotation(paper.id, annId);
    annotListRevision++;
    PdfAnnot.remove(pane, annId);
    // 同步侧栏列表
    if (annotListState.paperId === paper.id) {
      annotListState.items = annotListState.items.filter((a) => a.id !== annId);
      renderAnnotationList();
    }
    // 同步工具栏角标
    const badge = $('[data-action="annot-panel"] .annot-count');
    if (badge && state.route.id === paper.id) {
      const n = annotCountOf(paper.id);
      badge.textContent = n || "";
      badge.hidden = !n;
    }
    showAnnotationUndo(paper.id, annId);
  } catch (err) {
    toast("删除失败：" + esc(err.message), "err");
  } finally {
    annotationDeleting.delete(key);
  }
}

function showAnnotationUndo(paperId, annId) {
  const el = document.createElement('div');
  el.className = 'toast toast-ok annot-undo-toast';
  el.innerHTML = '<span>已删除批注</span><button type="button">撤销</button>';
  $('#toast-root').appendChild(el);
  const timer = setTimeout(()=>el.remove(), 8000);
  const button = el.querySelector('button');
  button.addEventListener('click', async()=>{
    clearTimeout(timer);
    button.disabled = true;
    try {
      const ann = await LithubAPI.restoreAnnotation(paperId,annId);
      annotListRevision++;
      if (state.route.id === paperId) {
        const current = activePdfPane();
        if (current) PdfAnnot.add(current,ann);
      }
      if (annotationFitsCache(ann,paperId)) {
        if (!annotListState.items.some(item=>item.id===ann.id)) annotListState.items.push(ann);
        renderAnnotationList();
        const badge = $('[data-action="annot-panel"] .annot-count');
        if (badge && state.route.id === paperId) { badge.textContent=annotCountOf(paperId); badge.hidden=false; }
      }
      el.remove();
      toast('已恢复批注');
    } catch (error) {
      button.disabled=false;
      setTimeout(()=>el.remove(),8000);
      toast(esc(error.message || '撤销失败'),'err');
    }
  });
}

async function deleteAnnotation(pane, annId) {
  const p = paperById(state.route.id);
  if (!p) return;
  await deleteAnnotationById(pane, p, annId);
}

/* 选中文本 → 划词浮条（真实 PDF + 演示模式模拟页面都支持）。
   注意：判断「点击是否落在浮条内」必须放在最前面 —— 点浮条按钮时 mouseup
   会冒泡到这里，若无条件移除浮条，按钮会在 click 派发前就被删掉，
   导致高亮/划线/批注完全无法触发。 */
document.addEventListener("mouseup", (e) => {
  // 点击浮条自身：保留它，交给后续 click 处理
  if (e.target.closest(".sel-pop")) return;

  const old = $(".sel-pop"); if (old) old.remove();
  if (state.route.view !== "reader") return;
  if (e.target.closest(".ai-panel, .note-panel, .annot-pop")) return;

  const isRealPdf = Boolean(e.target.closest(".pdf-page"));
  const isMockPage = Boolean(e.target.closest(".page"));

  const sel = window.getSelection();
  const text = sel?.toString().trim();
  if (!text || !sel.rangeCount) return;

  // 真实 PDF：抽出归一化矩形，供持久化批注使用
  let rectsInfo = null;
  if (isRealPdf) {
    rectsInfo = PdfAnnot.selectionToRects();
    if (!rectsInfo) return;
    pendingSelection = rectsInfo;
  } else if (isMockPage) {
    pendingSelection = null;   // 演示数据无法持久化
  } else {
    return;
  }

  const rect = sel.getRangeAt(0).getBoundingClientRect();
  const pop = document.createElement("div");
  pop.className = "sel-pop";
  // 浮条比原来宽，按宽度居中并夹在视口内
  const PW = isRealPdf ? 330 : 190;
  pop.style.left = Math.max(8, Math.min(window.innerWidth - PW - 8, rect.left + rect.width / 2 - PW / 2)) + "px";
  pop.style.top = Math.max(8, rect.top - 48) + "px";
  pop.innerHTML = isRealPdf
    ? `
      <button data-selact="highlight">${I("sparkle", 13)}高亮</button>
      <button data-selact="underline">${I("list", 13)}划线</button>
      <button data-selact="note">${I("pencil", 13)}批注</button>
      <button data-selact="excerpt">${I("book", 13)}摘录</button>
      <span class="sel-sep"></span>
      <span class="sel-colors">
        ${ANNOT_COLOR_LIST.map((c, i) => `<button class="sel-dot ${c === lastAnnotationColor ? "active" : ""}"
          data-selcolor="${c}" title="${["黄色","绿色","蓝色","粉色","紫色"][i]}"
          style="background:${PdfAnnot.COLORS[c].fill}"></button>`).join("")}
      </span>`
    : `
      <button data-selact="translate">${I("languages", 13)}翻译</button>
      <button data-selact="explain">${I("sparkle", 13)}解释</button>
      <button data-selact="note">${I("pencil", 13)}摘录</button>`;
  $("#overlay-root").appendChild(pop);
  const size = pop.getBoundingClientRect();
  const minTop = ($('.reader-bar')?.getBoundingClientRect().bottom || 0) + 8;
  pop.style.left = `${Math.max(8,Math.min(innerWidth-size.width-8,rect.left+rect.width/2-size.width/2))}px`;
  const above = rect.top-size.height-8;
  pop.style.top = `${Math.max(minTop,Math.min(innerHeight-size.height-8,above>=minTop ? above : rect.bottom+8))}px`;
});

document.addEventListener("mousedown", (e) => {
  const pop = $(".sel-pop");
  if (pop && !pop.contains(e.target)) pop.remove();
  const annotPop = $("#annot-pop");
  if (annotPop && !annotPop.contains(e.target) && !e.target.closest(".annot-mark, .annot-rect")) {
    closeAnnotationEditor();
  }
});

document.addEventListener("click", (e) => {
  // 颜色选择（只切换当前高亮操作的颜色）
  const dot = e.target.closest("[data-selcolor]");
  if (dot) {
    $$(".sel-pop .sel-dot").forEach((d) => d.classList.toggle("active", d === dot));
    lastAnnotationColor = dot.dataset.selcolor;
    try { localStorage.setItem('lithub-annotation-color',lastAnnotationColor); } catch {}
    return;
  }

  const b = e.target.closest("[data-selact]");
  if (b) {
    const act = b.dataset.selact;
    if (act==='excerpt') { insertSelectionInNote(); return; }
    if (act === "highlight" || act === "underline" || act === "note") {
      const color = $(".sel-pop .sel-dot.active")?.dataset.selcolor || "yellow";
      createAnnotation(act, color);
      return;
    }
    // 演示模式：原有模拟动作
    $(".sel-pop")?.remove();
    const selText = window.getSelection().toString();
    if (act === "translate") toast(`已翻译选中文本（演示）：${selText.slice(0, 12)}…`);
    if (act === "explain") toast("AI 已对选中内容生成解释（演示）");
    return;
  }

  // 悬停删除按钮：直接删除该高亮/划线（不需要先打开气泡）
  const floatDel = e.target.closest(".annot-del-float");
  if (floatDel) {
    e.stopPropagation();
    const pane = activePdfPane();
    const p = paperById(state.route.id);
    const annId = floatDel.dataset.annotId;
    if (!pane || !p || !LithubAPI.live) return;
    deleteAnnotationById(pane, p, annId);
    return;
  }

  // 点击已有批注的标记/矩形 → 打开编辑气泡
  const mark = e.target.closest(".annot-mark, .annot-rect");
  if (mark) {
    const pane = activePdfPane();
    const ann = pane && PdfAnnot.get(pane, mark.dataset.annotId);
    if (ann && pane) openAnnotationEditor(pane, ann);
    return;
  }
  if (e.target.closest("[data-annot-close]")) { closeAnnotationEditor(); return; }
  if (e.target.closest("[data-annot-reset-pos]")) {
    // 复位到批注文字旁（清掉手动拖动的位置）
    $("#annot-pop")?._resetPosition?.();
    return;
  }
  if (e.target.closest("[data-annot-save]")) {
    const pop = $("#annot-pop");
    const pane = activePdfPane();
    if (pop && pane) saveAnnotationComment(pane, pop.dataset.annotId);
    return;
  }
  if (e.target.closest("[data-annot-del]")) {
    const pop = $("#annot-pop");
    const pane = activePdfPane();
    if (pop && pane) deleteAnnotation(pane, pop.dataset.annotId);
    return;
  }
  // Hit testing keeps the text layer selectable: annotation rectangles never eat drag selection.
  const page = e.target.closest('.pdf-page');
  if (page && !getSelection()?.toString().trim()) {
    const pane = activePdfPane();
    const ann = pane && PdfAnnot.hitTest(pane,page,e.clientX,e.clientY);
    if (ann) openAnnotationEditor(pane,ann);
  }
});

/* 批注备注：Ctrl/Cmd + Enter 保存 */
document.addEventListener("keydown", (e) => {
  if (e.target.id === "annot-comment" && (e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    const pop = $("#annot-pop");
    const pane = activePdfPane();
    if (pop && pane) saveAnnotationComment(pane, pop.dataset.annotId);
  }
});

/* 键盘快捷键 */
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeAnnotationEditor();
    closeModal();
    aiStream.ctrl?.abort(); // 中止流式请求，避免空跑消耗 token
    document.getElementById("tag-pop")?.classList.add("hidden");
    $("#sel-pop, #annot-pop") && $$(".sel-pop, .annot-pop").forEach((el) => el.remove());
    state.reader.panel = false;
  }
  if (e.key === "Enter" && e.target.id === "tag-input") {
    e.preventDefault();
    addTagsFromInput(paperById(state.route.id));
  }
  // 笔记标题：回车确认（失焦），避免在单行输入框里敲回车没反应
  if (e.key === "Enter" && e.target.id === "note-title") {
    e.preventDefault();
    e.target.blur();
  }
  if (e.key === "/" && state.route.view === "library" && !/input|textarea|select/i.test(document.activeElement.tagName)) {
    e.preventDefault(); $("#search-input")?.focus();
  }
  // 阅读器缩放快捷键：Ctrl/Cmd + = / - / 0（0 = 适合宽度）
  if (state.route.view === "reader" && (e.ctrlKey || e.metaKey)) {
    if (e.key === "=" || e.key === "+") { e.preventDefault(); zoomStep(1); }
    else if (e.key === "-" || e.key === "_") { e.preventDefault(); zoomStep(-1); }
    else if (e.key === "0") { e.preventDefault(); applyReaderZoom(null, "width"); }
  }
  // 笔记：Ctrl/Cmd + S 立即保存
  if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S") && noteState.currentId) {
    e.preventDefault();
    saveCurrentNote(false);
  }
});

/* 档位缩放（按钮 / 快捷键共用）：到达上限后不再变化，并给出一次提示 */
let zoomLimitHintAt = 0;
function zoomStep(dir) {
  const r = state.reader;
  // 从「适宽/适页」切到手动时，先落到当前等效倍率再增减，避免突兀跳变
  const before = r.fit === "manual" ? r.zoom : PdfView.effectiveZoom(readerPanes()[0]);
  const next = dir > 0 ? before * 1.25 : before / 1.25;
  const changed = applyReaderZoom(next);
  if (!changed) {
    const now = Date.now();
    if (now - zoomLimitHintAt > 1200) {
      zoomLimitHintAt = now;
      const r2 = state.reader;
      const atMax = r2.zoom >= PdfView.MAX_ZOOM - 1e-6;
      toast(atMax ? `已达最大放大 ${Math.round(PdfView.MAX_ZOOM * 100)}%` : `已达最小缩放 ${Math.round(PdfView.MIN_ZOOM * 100)}%`, "warn");
    }
  }
  return changed;
}

/* Ctrl/Cmd + 滚轮缩放（线性缩放而非固定档位，清晰度更可控）
   到达上下限后停止响应，避免「滚轮没反应但也不知道为什么」 */
document.addEventListener("wheel", (e) => {
  if (!(e.ctrlKey || e.metaKey) || state.route.view !== "reader") return;
  if (!e.target.closest(".pane, #webai-divider")) return;
  e.preventDefault();
  const r = state.reader;
  const currentZoom = r.fit === "manual" ? r.zoom : PdfView.effectiveZoom(readerPanes()[0]);
  const next = currentZoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1);
  // 越界时直接钳制在边界，不再产生无意义的重复绘制
  const atMax = r.fit === "manual" && next >= PdfView.MAX_ZOOM - 1e-6 && r.zoom >= PdfView.MAX_ZOOM - 1e-6;
  const atMin = r.fit === "manual" && next <= PdfView.MIN_ZOOM + 1e-6 && r.zoom <= PdfView.MIN_ZOOM + 1e-6;
  if (atMax || atMin) return;
  const inPaper = e.target.closest(".pane");
  applyReaderZoom(next, null, inPaper ? { x: e.clientX, y: e.clientY } : undefined);
}, { passive: false });

document.addEventListener("auxclick", (e) => {
  // 中键点击标签页 = 关闭（文献与笔记标签页都适用）
  if (e.button !== 1) return;
  const tabEl = e.target.closest(".tab[data-tab-key]");
  if (tabEl) {
    e.preventDefault();
    closeTab(tabEl.dataset.tabKey);
  }
});

/* ---------------- 真实模式（sidecar 已启动时） ---------------- */

const coverIndex = (id) => [...id].reduce((a, c) => a + c.charCodeAt(0), 0) % 6;

/* 服务端配置 → 前端状态。api_key 只有掩码，明文不进入渲染进程。
   注意 sidecar 的 provider 决定翻译引擎（bing/openai/deepseek），与前端
   「模型服务」卡片是两套字段：模型服务卡片只更新 baseURL/model，不覆盖 provider。
   keys 是 provider -> 掩码 的映射：每个服务商各存各的 Key，切换时回显自己的。 */
function applyLiveSettings(cfg) {
  if (!cfg || typeof cfg !== "object") return;
  const s = state.db.settings;
  if (cfg.base_url) s.baseURL = cfg.base_url;
  if (cfg.model) s.model = cfg.model;
  if (cfg.provider) s.provider = cfg.provider;
  // 翻译引擎：bing | openai（与设置页「翻译 → 引擎」对应）
  if (cfg.service) s.engine = cfg.service === "openai" ? "openai" : "bing";
  // 每个服务商的 Key 掩码表
  if (cfg.keys && typeof cfg.keys === "object") {
    s.keyMasks = {};
    for (const [prov, info] of Object.entries(cfg.keys)) {
      s.keyMasks[prov] = info?.masked || "";
    }
  }
  s.hasKey = Boolean(cfg.has_key);
  s.apiKey = cfg.api_key || ""; // 当前 provider 的掩码，仅用于回显
  // 网页 AI 配置
  if (cfg.web_ai_url) s.webAiURL = cfg.web_ai_url;
  if (Array.isArray(cfg.web_ai_sites)) s.webAiSites = cfg.web_ai_sites;
  if (typeof cfg.web_ai_browser === "string") s.webAiBrowser = cfg.web_ai_browser;
  if (typeof cfg.web_ai_browser_path === "string") s.webAiBrowserPath = cfg.web_ai_browser_path;
}

/* 是否为后端回显的掩码。真实 API Key 不会含 `*`，所以「含 *」即可判定未修改。
   后端掩码与真实 Key 等长（前 6 位 + 后续 * 补足）。 */
function isKeyMask(value) {
  return (value || "").includes("*");
}

/* 某个 provider 名下已保存 Key 的掩码（没有则空串）。
   优先级：刚输入未保存的 > 服务端已存掩码 > 演示模式下当前值。
   注意不能无条件回落到 s.apiKey —— 那个值是「上次读到时的当前 provider」的，
   切服务商后会变成别人的 Key 串到新卡片上（用户反馈的 bug）。 */
function keyMaskFor(provider) {
  const s = state.db.settings;
  const pending = s.pendingKeys || {};
  if (provider in pending) return pending[provider];
  const masks = s.keyMasks || {};
  if (provider in masks) return masks[provider] || "";
  // 演示模式（从未与服务端同步过）才用本地值兜底
  if (!Object.keys(masks).length && s.provider === provider) return s.apiKey || "";
  return "";
}

async function loadLiveSettings() {
  try {
    applyLiveSettings(await LithubAPI.settings());
  } catch {
    /* 保持演示数据 */
  }
}

function mapLivePaper(p) {
  return {
    id: p.id,
    title: p.title,
    authors: p.authors || "未知作者",
    venue: catName(p.cat || "local") || "本地文献",
    year: p.year || new Date(p.added).getFullYear(),
    type: "PDF",
    cat: p.cat || "local",
    tags: p.tags || [],
    translated: !!p.translated,
    summarized: false,
    unread: false,
    fav: !!p.fav,
    cover: coverIndex(p.id),
    added: (p.added || "").slice(0, 10) || "2026-10-04",
    abstract: p.abstract || "",
    pages: p.pages,
    origName: p.orig_name || "",
    noteCount: p.note_count || 0,
    live: true,
    fileUrl: `${API_BASE}/api/papers/${p.id}/file`,
    zhUrl: p.translated ? `${API_BASE}/api/papers/${p.id}/file?kind=translated` : null,
    // 左右并排对照版（后端按需合成，缓存于 out/<id>/<id>-compare.pdf）
    compareUrl: p.translated ? `${API_BASE}/api/papers/${p.id}/file?kind=compare` : null,
  };
}

async function loadLiveLibrary() {
  state.live = true;
  try {
    const papers = await LithubAPI.papers();
    state.db.papers = papers.map(mapLivePaper);
    try {
      const cats = await LithubAPI.categories();
      if (cats.length) state.db.categories = cats;
    } catch {}
  } catch {
    /* 保持演示数据 */
  }
  try {
    const prompts = await LithubAPI.prompts();
    if (prompts.length) {
      state.db.prompts = prompts;
      if (!state.db.prompts.find((x) => x.id === state.reader.prompt)) {
        state.reader.prompt = (state.db.prompts.find((x) => x.default) || state.db.prompts[0]).id;
      }
    }
  } catch {}
  await loadLiveSettings();
}

async function pollTasks() {
  if (!LithubAPI.live) return;
  let tasks;
  try { tasks = await LithubAPI.tasks(); } catch { return; }
  const changed = JSON.stringify(tasks) !== JSON.stringify(state.liveTasks);
  state.liveTasks = tasks;

  // 侧栏「翻译任务」运行中圆点
  const dot = $(".running-dot");
  if (dot) dot.hidden = !tasks.some((t) => t.status === "running");

  // 阅读器：更新进度 / 完成后装载译文
  if (state.route.view === "reader") {
    const p = paperById(state.route.id);
    if (p?.live && !p.translated) {
      const t = tasks.find((x) => x.paper_id === p.id);
      if (t?.status === "done") {
        p.translated = true;
        p.zhUrl = `${API_BASE}/api/papers/${p.id}/file?kind=translated`;
        p.compareUrl = `${API_BASE}/api/papers/${p.id}/file?kind=compare`;
        toast("翻译完成，已生成中文对照版");
        renderReader(p.id);
      } else if (t && (t.status === "running" || t.status === "queued")) {
        if (!$("#zh-pct")) { renderReader(p.id); } // 从空态切入翻译中状态
        const pct = $("#zh-pct"), note = $("#zh-note"), bar = $("#zh-progress span"), btn = $('.reader-bar [data-action="translate"] .spin');
        if (pct) pct.textContent = (t.progress || 0) + "%";
        if (note) note.textContent = t.note || "";
        if (bar) bar.style.width = (t.progress || 0) + "%";
        if (btn) btn.textContent = `翻译中 ${t.progress || 0}%`;
      } else if (t?.status === "failed" && $("#zh-note")) {
        $("#zh-note").textContent = t.note || "翻译失败";
        const ph = $("#pane-zh .pane-placeholder");
        if (ph && !$("#zh-retry")) {
          ph.insertAdjacentHTML("beforeend",
            `<button class="btn" id="zh-retry" data-action="translate" data-id="${p.id}">${I("refresh", 14)}重试</button>`);
        }
      }
    }
  }

  if (state.route.view === "tasks" && changed) renderTasks();
}

/* 桌面壳：启用窗口拖拽区与窗口按钮。
   #titlebar 本身在桌面/浏览器下都显示（浏览器下只剩标签栏，见 CSS），
   这里只补桌面特有的行为与 body.desktop 标记。 */
function initTitlebar() {
  if (!window.lithub?.isDesktop) return;
  document.body.classList.add("desktop");
  const bar = document.getElementById("titlebar");
  if (!bar) return;
  document.getElementById("tb-min").onclick = () => window.lithub.minimize();
  document.getElementById("tb-max").onclick = () => window.lithub.maximizeToggle();
  document.getElementById("tb-restore").onclick = () => window.lithub.maximizeToggle();
  document.getElementById("tb-close").onclick = () => window.lithub.close();
  window.lithub.onMaximizeChange?.((max) => bar.classList.toggle("maximized", max));
}

(async () => {
  initTitlebar();
  void AppUpdates.init({ onChange: refreshUpdateSettings, onAvailable: notifyAppUpdate });
  await LithubAPI.ping();
  // A renderer reload loses its controller; retire the previous native session first.
  if (LithubAPI.live && window.lithub?.browser?.reset) {
    const result = await window.lithub.browser.reset();
    if (!result.ok) toast(result.error || "清理旧网页会话失败", "err");
  }
  if (LithubAPI.live) await loadLiveLibrary();
  render();
  setInterval(pollTasks, 1200);
})();
