/* ============================================================
 * 文枢 LitHub · Markdown 笔记编辑器适配层（Vditor）
 *
 * 为什么是 Vditor：
 *   · MIT 协议，纯 UMD，无构建、无框架依赖，契合本项目「无构建 vanilla JS」
 *   · 自带三种编辑模式，其中 ir（Instant Rendering）就是 Typora/Obsidian 的
 *     即时渲染：光标所在行显示 Markdown 源码，其余部分即时渲染成富文本
 *   · 原生支持 KaTeX 行内/块级公式、GFM 表格、任务列表、代码高亮
 *   · 所有运行时资源都按 `${cdn}/dist/...` 取，因此可以把 dist 整个 vendor 下来
 *     完全离线运行（实测零外部网络请求）
 *
 * 本层只做三件事：
 *   1. 懒加载 vendor 资源（不拖慢应用启动）
 *   2. 统一「live / source / read」三种模式的生命周期（Vditor 4.x 没有
 *      setMode，换模式只能销毁重建，这里把它包起来并保留内容和滚动位置）
 *   3. 把图片粘贴/拖入接上 sidecar 的上传接口
 * ============================================================ */

"use strict";

const NoteEditor = (() => {
  /* Vditor 把所有资源拼成 `${cdn}/dist/xxx`，所以 cdn 指向 vendor/vditor 目录，
     它下面就是 dist/ —— 这样完全离线可用 */
  const cdnBase = () => new URL("vendor/vditor", document.baseURI).href.replace(/\/$/, "");

  let vd = null;              // Vditor 实例
  let container = null;       // 当前挂载的容器元素
  let mode = "live";          // live | source | read
  let callbacks = {};         // { onChange, onReady, onSave }
  let readEl = null;          // read 模式下承载静态渲染的元素
  let loading = null;         // 资源加载的共享 Promise
  let lastValue = "";         // read 模式切换回来时用来回填内容
  let pendingValue = null;    // 实例就绪前 setValue 进来的内容，after 里补挂
  let lifecycle = 0, binding = null, pendingBookmark = null;
  let commandMenu = null, formatBar = null;
  let editable = true;

  const MODES = ["live", "source", "read"];
  const isMounted = () => Boolean(container && container.isConnected);

  /* ---------- 资源加载 ---------- */

  function loadOnce(tag, attrs, marker) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`[data-note-dep="${marker}"]`)) return resolve();
      const el = document.createElement(tag);
      Object.assign(el, attrs);
      el.dataset.noteDep = marker;
      el.onload = () => resolve();
      el.onerror = () => { el.remove(); reject(new Error(`${marker} 加载失败`)); };
      (tag === "link" ? document.head : document.head).appendChild(el);
    });
  }

  async function ensureLoaded() {
    if (window.Vditor) return true;
    if (loading) return loading;
    loading = (async () => {
      const base = cdnBase();
      await loadOnce("link", { rel: "stylesheet", href: base + "/dist/index.css" }, "vditor-css");
      // UMD 构建：只能用 <script> 标签（import() 里顶层 this 为 undefined，
      // UMD 拿不到 globalThis，window.Vditor 不会出现）
      await loadOnce("script", { src: base + "/dist/index.min.js" }, "vditor-js");
      return Boolean(window.Vditor);
    })().catch((err) => {
      console.error("笔记编辑器加载失败:", err);
      loading = null;
      return false;
    });
    return loading;
  }

  /* ---------- 图片上传 ----------
     Vditor 的粘贴/拖入都会走 upload.handler。返回 null 表示成功
     （Vditor 会用 format 的返回值或我们自己插入的 Markdown），
     返回字符串表示失败并把它作为错误提示。 */
  async function uploadImages(files) {
    const list = [...files].filter((f) => (f.type || "").startsWith("image/"));
    if (!list.length) return null;
    await handleNoteImageFiles(list);
    return null;   // 已自行插入，不再让 Vditor 处理
  }

  /* ---------- 图片右下角拖拽缩放 ----------
     IR 模式下 Vditor 把图片包在 <span class="vditor-ir__node" data-type="img"> 里。
     在编辑器根元素上做事件委托（Vditor 会重绘 DOM，逐图绑定会被冲掉）：
       · pointerover 到图片 → 给 wrapper 注入右下角把手
       · 把手上 pointerdown → 进入拖拽，等比改 img 宽高
       · 松手 → 把最终尺寸写回 Markdown 源码（HTML <img> 标签 + style），
         Vditor/Lute 实测会保留 <img> 的 width/style 属性，read 模式同样生效
     拖拽期间必须把 contenteditable 短暂禁掉，否则浏览器把拖动当文字选择。 */
  const IMG_MIN_W = 48;
  const GRIP_SIZE = 22;        // 把手可点击范围（视觉里再画小图标，扩大命中区）
  let imgGrip = null;          // 当前注入的把手
  let gripImg = null;          // 把手当前对应的 <img>（Vditor 重绘后可能失效）
  let resizing = null;         // { img, startX, startY, startW, startH, ratio, wrapper, src, alt }

  function imgWrapper(img) {
    return img.closest('[data-type="img"], p') || img.parentElement;
  }

  /* 把手定位：使用 fixed 定位直接贴在图片右下角。
     这样无论 Vditor wrapper 被源码文本撑得多宽、怎样重排，把手始终跟随图片。 */
  function ensureGrip(img) {
    if (imgGrip && imgGrip.dataset.forImg === img.src && imgGrip.isConnected) {
      gripImg = img;
      updateGripPosition(img);
      return;
    }
    removeGrip();
    const g = document.createElement("span");
    g.className = "note-img-grip";
    g.contentEditable = "false";
    g.title = "拖动调整图片大小（等比例）";
    g.dataset.forImg = img.src;
    document.body.appendChild(g);
    imgGrip = g;
    gripImg = img;
    updateGripPosition(img);
  }

  function updateGripPosition(img) {
    if (!imgGrip || !imgGrip.isConnected || !img?.isConnected) return;
    const r = img.getBoundingClientRect();
    // 把手中心贴在图片右下角，四周各留一半命中区
    imgGrip.style.left = (r.right - GRIP_SIZE / 2) + "px";
    imgGrip.style.top = (r.bottom - GRIP_SIZE / 2) + "px";
    imgGrip.style.width = GRIP_SIZE + "px";
    imgGrip.style.height = GRIP_SIZE + "px";
  }

  function removeGrip() {
    if (imgGrip && imgGrip.isConnected) imgGrip.remove();
    imgGrip = null;
    gripImg = null;
  }

  /* 页面任意可滚动容器滚动、窗口缩放时，fixed 把手继续贴在图片右下角。
     scroll 不冒泡但能被 capture 捕获，因此挂 window capture 一次即可覆盖编辑器内部滚动。 */
  let gripScrollBound = false;
  function bindGripScrollSync() {
    if (gripScrollBound) return;
    gripScrollBound = true;
    const sync = () => {
      if (resizing) return;
      if (!imgGrip || !imgGrip.isConnected) return;
      if (gripImg?.isConnected) updateGripPosition(gripImg);
      else removeGrip();
    };
    window.addEventListener("scroll", sync, { capture: true, passive: true });
    window.addEventListener("resize", sync);
  }

  /* 尺寸 → Markdown 源码：把 ![](url) 替换成 <img src=... style="width..;height..">。
     只处理当前正在缩放的这一张；同一 URL 的其它引用不动。 */
  function persistImageSize({ src, alt, w, h, occurrence = 0, reset = false }) {
    const cur = getValue();
    // 转义 URL 里可能干扰正则的字符
    const esc = src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // 匹配这个 URL 的 markdown 图（无论当前 alt/已有尺寸），也匹配同 URL 的旧 <img>
    const mdImg = new RegExp(`!\\[[^\\]]*\\]\\(${esc}[^)]*\\)`, "g");
    const htmlImg = new RegExp(`<img[^>]*src="${esc}"[^>]*>`, "g");
    const tag = `<img src="${src}" alt="${(alt || "").replace(/"/g, "&quot;")}"${reset ? '' : ` style="width:${Math.round(w)}px;height:${Math.round(h)}px"`}>`;
    // ⚠️ 必须让 HTML <img> 成为独立块（前后空行）：
    // 和文字/链接挤在同一行时，Lute 会按 html-inline 处理并渲染成源码 code，
    // 图片会消失。只有块级 HTML 才会被渲染成真正的 <img>。
    const block = `\n\n${tag}\n\n`;
    // Count Markdown and HTML references together, then replace exactly the selected occurrence.
    const matches = [...cur.matchAll(mdImg), ...cur.matchAll(htmlImg)].sort((a,b)=>a.index-b.index);
    const match = matches[occurrence];
    if (!match) return;
    const next = cur.slice(0,match.index) + block + cur.slice(match.index+match[0].length);
    if (next !== cur) setValueSilently(next);
  }

  /* setValue 的「不回显」变体：拖拽结束时频繁调用，直接写实例，
     不触发 onChange 的自动保存链（由调用方统一 markDirty） */
  function setValueSilently(md) {
    lastValue = md || "";
    if (mode === "read") { if (readEl) renderRead(readEl, lastValue); return; }
    if (ready && vd) {
      try { vd.setValue(lastValue, true); } catch { pendingValue = lastValue; }
    } else {
      pendingValue = lastValue;
    }
  }

  function onImgPointerDown(e) {
    if (mode === 'read') return;
    // 把手是 body 下的 fixed 元素，不能靠 parentElement 找图；
    // 优先用创建把手时记录的 img，元素被 Vditor 重绘替换时再按 URL 兜底查找。
    let img = gripImg && gripImg.isConnected ? gripImg : null;
    if (!img && e.target.dataset?.forImg) {
      const esc = e.target.dataset.forImg.replace(/"/g, '\\"');
      img = document.querySelector(`.vditor-ir img[src="${esc}"], .note-read-host img[src="${esc}"]`);
    }
    if (!img) return;
    e.preventDefault();
    e.stopPropagation();
    const r = img.getBoundingClientRect();
    // 缩放基准优先用已经持久化的 style 尺寸；否则用图片原始像素，
    // 避免 CSS max-width:100% 把图片撑到容器宽后，一起手就变成容器宽。
    const styleW = img.style.width ? parseFloat(img.style.width) : NaN;
    const styleH = img.style.height ? parseFloat(img.style.height) : NaN;
    const naturalW = img.naturalWidth || r.width;
    const naturalH = img.naturalHeight || r.height;
    const startW = Number.isFinite(styleW) ? styleW : naturalW;
    const startH = Number.isFinite(styleH) ? styleH : naturalH;
    // 缩放上限 = 当前所在的「纸」/面板内容区宽度（拖得再大也不溢出容器）
    const host = img.closest(".note-body") || img.closest(".note-panel") || img.closest(".note-read-host");
    resizing = {
      img, wrapper: imgWrapper(img),
      startX: e.clientX, startY: e.clientY,
      startW, startH,
      startDisplayW: r.width,
      ratio: startW / startH,
      src: img.getAttribute('src'), alt: img.alt || "",
      occurrence: [...container.querySelectorAll('.vditor-ir img')]
        .filter(other=>other.src===img.src).indexOf(img),
      maxW: host ? host.getBoundingClientRect().width - 24 : 1200,
    };
    document.body.classList.add("note-img-resizing");
    e.target.classList.add("dragging");
    // capture 到把手节点上：即使指针移出窗口，已捕获的指针事件仍会派发到它，
    // 拖拽不会断。move/up 挂在 document 上（见 bindImageResize），不依赖节点存活。
    try { e.target.setPointerCapture(e.pointerId); } catch {}
  }

  function onImgPointerMove(e) {
    if (!resizing) return;
    const dx = e.clientX - resizing.startX;
    // 只看横向位移，等比例换算高度（右下角语义：往右下拖放大，也可往左缩小）。
    // 若图片已被 CSS 限制成容器宽，基准宽度要取逻辑宽与上限的较小值，
    // 否则 pointerdown 时 startW 已经大于 maxW，一动就顶到上限。
    const maxW = resizing.maxW || 1200;
    const baseW = Math.min(resizing.startW, maxW);
    const w = Math.max(IMG_MIN_W, Math.min(maxW, baseW + dx));
    const h = Math.round(w / resizing.ratio);
    resizing.img.style.width = Math.round(w) + "px";
    resizing.img.style.height = h + "px";
    updateGripPosition(resizing.img);   // 把手跟着变化后的图片右下角走
    e.preventDefault();
  }

  function onImgPointerUp(e) {
    if (!resizing) return;
    const img = resizing.img;
    document.body.classList.remove("note-img-resizing");
    imgGrip?.classList.remove("dragging");
    try { e.target.releasePointerCapture?.(e.pointerId); } catch {}
    // 尺寸有变化才写源码（与起始显示宽度比，避免 naturalWidth/逻辑宽差异误触发）
    const finalRect = img.getBoundingClientRect();
    if (Math.abs(finalRect.width - resizing.startDisplayW) > 2) {
      persistImageSize({ src: resizing.src, alt: resizing.alt, w: finalRect.width, h: finalRect.height, occurrence:resizing.occurrence });
      callbacks.onChange?.();       // 走自动保存
    }
    // IR 重绘后 img/wrapper 都是新的，把手会在下次 hover 时重建
    removeGrip();
    resizing = null;
  }

  /* 光标落在图片节点内部（点进了 Markdown 源码/链接）时按回车：
     Vditor 默认只会在图片源码里插 <br>，Markdown 不变，表现为「回车没反应」。
     这里拦截回车，在图片所在段落之后手工建一个新段落并通知 Vditor 同步。 */
  function onEnterInsideImage(e) {
    if (e.key !== "Enter" || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.isComposing) return;               // 中文输入法组合中不抢回车
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const node = sel.anchorNode;
    const el = node?.nodeType === 1 ? node : node?.parentElement;
    const imgNode = el?.closest?.('[data-type="img"], [data-type="html-block"]');
    if (!imgNode) return;
    e.preventDefault();
    e.stopPropagation();                     // 抢在 Vditor 的 keydown 之前
    const block = imgNode.closest("p") || imgNode;
    const p = document.createElement("p");
    p.setAttribute("data-block", "0");
    p.innerHTML = "<br>";
    block.after(p);
    const range = document.createRange();
    range.selectNodeContents(p);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    // 让 Vditor 把 DOM 变化同步回 Markdown
    vd?.vditor?.ir?.element?.dispatchEvent(new InputEvent("input", { bubbles: true }));
  }

  /* move/up 挂 document（capture）：setPointerCapture 只保证「事件以把手为 target」，
     监听器如果挂在把手节点上，pointerout 把把手移除后监听器就随节点一起没了 ——
     这正是第一版「按下有效、拖动无效」的原因。挂 document 不依赖节点存活。 */
  function bindImageResize(root) {
    const signal = binding.signal;
    root.addEventListener("pointerover", (e) => {
      const img = e.target.closest?.(".vditor-ir img, .note-read-host img");
      if (img) ensureGrip(img);
    }, { signal });
    // 鼠标移出图片且不是进入把手时移除把手（拖拽中不移除）
    document.addEventListener("pointerout", (e) => {
      if (resizing) return;
      const img = e.target.closest?.(".vditor-ir img, .note-read-host img");
      if (!img) return;
      const toGrip = e.relatedTarget?.classList?.contains("note-img-grip");
      const toImg = e.relatedTarget?.closest?.(".vditor-ir img, .note-read-host img");
      if (!toGrip && !toImg) removeGrip();
    }, { capture:true, signal });
    // 把手挂在 body 上，pointerdown 必须挂 document 才能收到
    document.addEventListener("pointerdown", (e) => {
      if (e.target.classList?.contains("note-img-grip")) onImgPointerDown(e);
    }, { capture:true, signal });
    root.addEventListener("keydown", onEnterInsideImage, { capture:true, signal });
    document.addEventListener("pointermove", onImgPointerMove, { capture:true, signal });
    document.addEventListener("pointerup", onImgPointerUp, { capture:true, signal });
    document.addEventListener("pointercancel", onImgPointerUp, { capture:true, signal });
  }

  /* read 模式：用 Vditor.preview 做只读渲染（不创建编辑器实例，省一个实例的开销） */
  function renderRead(el, md) {
    el.innerHTML = "";
    el.classList.add("vditor-reset");
    try {
      window.Vditor.preview(el, md || "", {
        cdn: cdnBase(),
        mode: document.documentElement.dataset.theme === "dark" ? "dark" : "light",
        math: { engine: "KaTeX" },
        markdown: { inlineMath: true, toc: false },
        hljs: { style: "github" },
      });
    } catch (err) {
      console.error("Markdown 只读渲染失败:", err);
      el.textContent = md || "";
    }
  }

  function buildEditor(md, editMode) {
    const serial = ++editorSerial;
    const el = container.querySelector(".note-vditor-host");
    el.innerHTML = "";
    return window.Vditor ? new window.Vditor(el, {
      cdn: cdnBase(),
      // ir = 即时渲染（Obsidian 风格）；sv = 源码 + 分屏预览
      mode: editMode,
      value: md,
      height: "100%",
      minHeight: 200,
      // 自绘工具栏会和本项目自己的笔记工具栏重复，这里关掉，
      // 图片插入仍由底部「插入图片」按钮 + 粘贴/拖入提供
      toolbar: [],
      cache: { enable: false },          // 内容由 sidecar 持久化，不用 localStorage
      counter: { enable: false },
      resize: { enable: false },
      outline: { enable: false },
      image: { isPreview:false },
      preview: {
        // 关键：Vditor 用 `padding = max(35, (容器宽 - maxWidth)/2)` 给正文加左右内边距。
        // 默认 maxWidth=800，在 1500px 的整页里会算出 (1500-800)/2=350px，
        // 把正文挤成中间一条窄带。这里设一个足够大的值让该 padding 恒为最小值，
        // 正文的真正版心宽度由我们自己的 CSS 控制。
        maxWidth: 100000,
        math: { engine: "KaTeX" },
        markdown: { inlineMath: true, gfmAutoLink: true, footnotes: true },
        hljs: { style: "github", lineNumber: false },
        theme: {
          current: document.documentElement.dataset.theme === "dark" ? "dark" : "light",
          path: cdnBase() + "/dist/css/content-theme",
        },
      },
      upload: {
        // 交给 sidecar 上传，成功后自行插入 Markdown
        handler: (files) => uploadImages(files),
        accept: "image/*",
      },
      input: () => {
        if (serial !== editorSerial) return;
        lastValue = vd?.getValue?.() ?? lastValue;
        callbacks.onChange?.();
      },
      keydown: (event) => {
        // Vditor 会拦截按键，Ctrl+S 需要在这里转出去
        if ((event.ctrlKey || event.metaKey) && (event.key === "s" || event.key === "S")) {
          event.preventDefault();
          callbacks.onSave?.();
        }
      },
      after: () => {
        if (serial !== editorSerial || !container?.isConnected) return;
        ready = true;
        // 初始化完成前收到的 setValue 在这里补挂（否则内容会静默丢失）
        if (pendingValue != null) {
          const v = pendingValue;
          pendingValue = null;
          try { vd?.setValue(v, true); } catch {}
          lastValue = v;
        }
        callbacks.onReady?.();
        setEditable(editable);
        applyBookmark();
      },
    }) : null;
  }

  /* ---------- 对外 API ---------- */

  /* 编辑器是否真的可以接受 setValue/insertValue ——
     构造函数返回后 Vditor 还在异步初始化，此时调用这些方法会抛错。
     ready 在 after 回调后才为 true（read 模式渲染是同步的，挂上即真）。 */
  let ready = false;
  let editorSerial = 0;

  /* 挂载。options: { value, mode, onChange, onSave, onReady } */
  async function mount(target, options = {}) {
    const ticket = ++lifecycle;
    const ok = await ensureLoaded();
    if (ticket !== lifecycle || !target.isConnected) return false;
    if (!ok) {
      target.innerHTML = `<div class="note-editor-fail">编辑器资源加载失败，请检查 frontend/vendor/vditor 是否存在</div>`;
      return false;
    }
    destroy(false);                 // 同一时刻只允许一个实例
    container = target;
    editable = options.editable !== false;
    mode = MODES.includes(options.mode) ? options.mode : "live";
    callbacks = {
      onChange: options.onChange,
      onSave: options.onSave,
      onReady: options.onReady,
    };
    binding = new AbortController();
    // 事件委托挂在容器上：Vditor 会重绘内部 DOM，逐图绑定会被冲掉
    bindImageResize(container);
    bindGripScrollSync();
    bindWritingTools(container);
    lastValue = options.value || "";
    rebuild();
    setEditable(editable);
    return true;
  }

  /* 按当前 mode 重建内部 DOM（Vditor 4.x 没有 setMode，只能重建） */
  function rebuild() {
    if (!container) return;
    const md = lastValue;
    editorSerial++;
    closeWritingTools();
    pendingValue = null;      // 重建以 lastValue 为准，清掉旧队列
    ready = false;
    const editMode = mode === "source" ? "sv" : "ir";
    container.classList.toggle("is-read", mode === "read");

    let host = container.querySelector(".note-vditor-host");
    if (!host) {
      container.innerHTML = `<div class="note-vditor-host"></div><div class="note-read-host vditor-reset"></div>`;
      host = container.querySelector(".note-vditor-host");
      readEl = container.querySelector(".note-read-host");
    }
    host.hidden = mode === "read";
    readEl.hidden = mode !== "read";

    if (vd) {
      try { vd.destroy(); } catch {}
      vd = null;
    }
    if (mode === "read") {
      renderRead(readEl, md);
      requestAnimationFrame(applyBookmark);
    } else {
      vd = buildEditor(md, editMode);
    }
  }

  /* 切换模式：保留内容，尽量恢复滚动位置 */
  function setMode(next) {
    if (!MODES.includes(next) || next === mode) return;
    getValue();
    const scroll = recordScroll();
    mode = next;
    pendingBookmark = { scroll, mode:next };
    rebuild();
  }

  /* 模式切换后的滚动恢复统一在实例 ready 后执行。 */
  function recordScroll() {
    const sc = editElement()?.scrollTop ?? 0;
    return sc;
  }
  function getValue() {
    if (mode === "read") return lastValue;
    if (!ready) return pendingValue ?? lastValue;
    try {
      const v = vd?.getValue?.();
      if (typeof v === "string") lastValue = v;
    } catch {}
    return lastValue;
  }

  function setValue(md) {
    lastValue = md || "";
    if (mode === "read") {
      if (readEl) renderRead(readEl, lastValue);
      return;
    }
    if (vd) {
      try { vd.setValue(lastValue, true); return; }
      catch (err) {
        // 实例还在异步初始化（after 回调未触发）时 setValue 会抛错。
        // 直接吞掉的话内容就丢了 —— 表现为「重开笔记编辑区全空」。
        // 挂到 after 里补一次。
        pendingValue = lastValue;
        console.warn("NoteEditor.setValue 在实例就绪前调用，已排队", err);
      }
    } else {
      pendingValue = lastValue;
    }
  }

  function insertValue(text) {
    if (mode === "read") { setValue(getValue() + text); return; }
    if (!vd) { setValue(getValue() + text); return; }
    try { vd.insertMD(text); } catch { setValue(getValue() + text); }
    lastValue = vd.getValue?.() ?? lastValue;
  }

  function focus() {
    if (mode === "read") return;
    try { vd?.focus?.(); } catch {}
  }
  function setEditable(value) {
    editable = value;
    const el=editElement();
    if (el && mode!=='read') el.setAttribute('contenteditable',value?'true':'false');
  }

  /* 主题切换后重绘（read 模式的 KaTeX 颜色依赖内容主题） */
  function refreshTheme() {
    if (mode === "read") {
      if (readEl) renderRead(readEl, lastValue);
    } else if (vd) {
      try {
        vd.setTheme?.(
          document.documentElement.dataset.theme === "dark" ? "dark" : "classic",
          document.documentElement.dataset.theme === "dark" ? "dark" : "light",
        );
      } catch {}
    }
  }

  function editElement() {
    return mode === 'read' ? readEl : mode === 'source' ? vd?.vditor?.sv?.element : vd?.vditor?.ir?.element;
  }
  function bookmark() {
    const el=editElement(), selection=window.getSelection();
    if (!el) return null;
    const result={ scroll:el.scrollTop, mode };
    if (selection?.rangeCount && el.contains(selection.anchorNode)) {
      const range=selection.getRangeAt(0), before=document.createRange();
      before.selectNodeContents(el); before.setEnd(range.startContainer,range.startOffset);
      result.start=before.toString().length; result.length=range.toString().length;
    }
    return result;
  }
  function textPoint(el, offset) {
    const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
    let node;
    while ((node=walker.nextNode())) {
      if (offset<=node.length) return [node,offset];
      offset-=node.length;
    }
    return [el,el.childNodes.length];
  }
  function applyBookmark() {
    if (!pendingBookmark || (!ready && mode!=='read')) return;
    const b=pendingBookmark, el=editElement();
    if (!el) return;
    pendingBookmark=null;
    if (b.focus && mode!=='read') el.focus();
    if (b.mode===mode && Number.isFinite(b.start) && mode!=='read') {
      const range=document.createRange();
      range.setStart(...textPoint(el,b.start)); range.setEnd(...textPoint(el,b.start+(b.length || 0)));
      const sel=window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
    }
    el.scrollTop=b.scroll || 0;
  }
  function restoreBookmark(value) {
    pendingBookmark=value;
    requestAnimationFrame(applyBookmark);
  }
  function focusEnd() {
    restoreBookmark({mode,scroll:1e9,start:1e9,length:0,focus:true});
  }
  function headings() {
    const el=editElement();
    if (mode!=='source' && el?.querySelector('h1,h2,h3,h4,h5,h6')) {
      return [...el.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h=>({level:Number(h.tagName[1]),text:h.textContent.replace(/^#+\s*/, '')}));
    }
    let fenced=false;
    return getValue().split('\n').flatMap(line=>{
      if (/^\s*(```|~~~)/.test(line)) { fenced=!fenced; return []; }
      const match=!fenced && /^(#{1,6})\s+(.+)/.exec(line);
      return match ? [{level:match[1].length,text:match[2]}] : [];
    });
  }
  function scrollToHeading(index) {
    const el=editElement();
    const target=mode==='source' ? null : el?.querySelectorAll('h1,h2,h3,h4,h5,h6')[index];
    if (target) { target.scrollIntoView({block:'start',behavior:'smooth'}); return; }
    const text=headings()[index]?.text;
    if (!el || !text) return;
    const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
    let node;
    while ((node=walker.nextNode())) if (node.textContent.includes(text)) {
      node.parentElement.scrollIntoView({block:'center'}); return;
    }
  }
  function closeWritingTools() {
    formatBar?.remove(); formatBar=null;
    commandMenu?.remove(); commandMenu=null;
  }
  const commands = [
    ['标题', '## 标题\n'], ['项目列表', '- 条目\n'], ['任务列表', '- [ ] 待办事项\n'],
    ['表格', '| 列一 | 列二 |\n| --- | --- |\n| 内容 | 内容 |\n'],
    ['代码块', '```python\n\n```\n'], ['公式', '$$\nE = mc^2\n$$\n'],
  ];
  function placeTool(tool, range, below=false) {
    document.body.appendChild(tool);
    const r=range.getBoundingClientRect(), h=tool.offsetHeight;
    tool.style.left=Math.max(8,Math.min(innerWidth-tool.offsetWidth-8,r.left))+'px';
    tool.style.top=Math.max(8,Math.min(innerHeight-h-8,below?r.bottom+6:r.top-h-6))+'px';
  }
  function replaceSelection(range, value) {
    if (!container?.contains(range.startContainer)) return;
    const sel=window.getSelection();
    range.deleteContents(); range.collapse(true);
    sel.removeAllRanges(); sel.addRange(range);
    insertValue(value); callbacks.onChange?.(); closeWritingTools();
  }
  function bindWritingTools(root) {
    const signal=binding.signal;
    root.addEventListener('mouseup',()=>{
      closeWritingTools();
      const sel=window.getSelection();
      if (mode==='read' || !sel?.rangeCount || sel.isCollapsed || !root.contains(sel.anchorNode)) return;
      const range=sel.getRangeAt(0).cloneRange(), text=sel.toString();
      const bar=document.createElement('div'); bar.className='note-formatbar'; bar.setAttribute('role','toolbar'); bar.setAttribute('aria-label','文字格式');
      [['粗体','B',`**${text}**`],['斜体','I',`*${text}*`],['链接','↗',`[${text}](https://)`]].forEach(([label,short,value])=>{
        const button=document.createElement('button'); button.textContent=short; button.title=label; button.setAttribute('aria-label',label);
        button.onpointerdown=e=>e.preventDefault(); button.onclick=()=>replaceSelection(range,value); bar.appendChild(button);
      });
      formatBar=bar; placeTool(bar,range);
    },{signal});
    root.addEventListener('keyup',e=>{
      if (e.key!=='/' || e.isComposing || mode==='read') return;
      const sel=window.getSelection();
      if (!sel?.rangeCount || !sel.isCollapsed || sel.anchorNode?.nodeType!==3) return;
      const block=sel.anchorNode.parentElement.closest('p, [data-block]') || editElement();
      if (!block || block.textContent.trim()!=='/') return;
      const range=sel.getRangeAt(0).cloneRange();
      if (!range.startOffset) return;
      range.setStart(range.startContainer,range.startOffset-1);
      if (range.toString()!=='/') return;
      closeWritingTools();
      const menu=document.createElement('div'); menu.className='note-command-menu'; menu.setAttribute('role','menu');
      commands.forEach(([label,value],index)=>{
        const button=document.createElement('button'); button.textContent=label; button.setAttribute('role','menuitem');
        button.classList.toggle('active',index===0); button.onpointerdown=e=>e.preventDefault();
        button.onclick=()=>replaceSelection(range,value); menu.appendChild(button);
      });
      commandMenu=menu; placeTool(menu,range,true);
    },{capture:true,signal});
    root.addEventListener('keydown',e=>{
      if (e.isComposing) return;
      if (e.key==='Escape') { closeWritingTools(); return; }
      if (!commandMenu) return;
      const buttons=[...commandMenu.querySelectorAll('button')], index=buttons.findIndex(b=>b.classList.contains('active'));
      if (e.key==='ArrowDown' || e.key==='ArrowUp') {
        e.preventDefault(); e.stopPropagation(); buttons[index]?.classList.remove('active');
        buttons[(index+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length].classList.add('active');
      } else if (e.key==='Enter') { e.preventDefault(); e.stopPropagation(); buttons[index]?.click(); }
      else closeWritingTools();
    },{capture:true,signal});
    document.addEventListener('pointerdown',e=>{
      if (!e.target.closest('.note-formatbar,.note-command-menu')) closeWritingTools();
    },{signal});
    window.addEventListener('scroll',closeWritingTools,{capture:true,passive:true,signal});
    window.addEventListener('resize',closeWritingTools,{signal});
    root.addEventListener('dblclick',e=>{
      if (e.target.tagName!=='IMG') return;
      e.preventDefault(); e.stopPropagation();
      const source=e.target;
      const modal=document.createElement('div'); modal.className='note-image-preview'; modal.setAttribute('role','dialog'); modal.setAttribute('aria-label','图片预览'); modal.tabIndex=-1;
      const img=document.createElement('img'); img.src=e.target.src; img.alt=e.target.alt;
      const close=document.createElement('button'); close.textContent='关闭'; close.onclick=()=>modal.remove();
      modal.append(img,close); modal.onclick=()=>modal.remove(); modal.onkeydown=event=>{if(event.key==='Escape')modal.remove()};
      if (mode==='live' && source.style.width) {
        const reset=document.createElement('button'); reset.className='note-image-reset'; reset.textContent='恢复原始尺寸';
        reset.onclick=()=>{
          const occurrence=[...container.querySelectorAll('.vditor-ir img')].filter(other=>other.src===source.src).indexOf(source);
          persistImageSize({src:source.getAttribute('src'),alt:source.alt,occurrence,reset:true}); callbacks.onChange?.(); modal.remove();
        };
        modal.appendChild(reset);
      }
      document.body.appendChild(modal); modal.focus();
    },{capture:true,signal});
  }

  function destroy(invalidate = true) {
    if (invalidate) lifecycle++;
    editorSerial++;
    binding?.abort(); binding = null;
    closeWritingTools(); removeGrip(); resizing = null;
    document.querySelectorAll('.note-image-preview').forEach(el=>el.remove());
    const nativePreview=document.querySelector('.vditor-img');
    if (nativePreview) { nativePreview.remove(); document.body.style.overflow=''; }
    document.body.classList.remove('note-img-resizing');
    pendingBookmark = null;
    if (vd) {
      try { vd.destroy(); } catch {}
      vd = null;
    }
    container = null;
    readEl = null;
    callbacks = {};
    ready = false;
  }

  return {
    mount, destroy, getValue, setValue, setMode, insertValue, focus,
    bookmark, restoreBookmark, headings, scrollToHeading, setEditable, focusEnd,
    refreshTheme, isMounted,
    getMode: () => mode,
    MODES,
    /* 测试/调试用 */
    _instance: () => vd,
    _ready: () => ready || (mode === "read" && isMounted()),
    _resizing: () => resizing,
    _grip: () => imgGrip,
  };
})();
