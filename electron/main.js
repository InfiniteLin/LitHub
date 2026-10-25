/* ============================================================
 * 文枢 LitHub · Electron 主进程
 * 职责：创建窗口（自定义标题栏）+ 拉起本地 FastAPI sidecar
 * 前端为 frontend/ 静态页面，后续经 IPC / localhost API 与 sidecar 通信
 * ============================================================ */

const { app, BrowserWindow, dialog, ipcMain, net, shell, screen, WebContentsView } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const { createUpdateService, registerUpdateIPC } = require("./update-service");
const { randomUUID } = require("node:crypto");
const { selectSidecarPort, waitForOwnedSidecar } = require("./sidecar-connection");

let SIDECAR_PORT;
const SIDECAR_INSTANCE = randomUUID();
let sidecarReady = false;

// file:// 下允许加载 PDF.js 的 worker 脚本
app.commandLine.appendSwitch("allow-file-access-from-files");

let win = null;
let sidecar = null;
let quitting = false;
let updateService = null;
registerUpdateIPC(ipcMain, () => updateService, event =>
  !!win && event.sender === win.webContents && event.senderFrame === win.webContents.mainFrame);

const log = (...a) => console.log("[main]", ...a);

/* ============================================================
 * 安装版 vs 开发版的路径差异
 *
 * 开发：仓库目录，sidecar 用系统 `python`，数据在 backend/data/。
 * 安装版：程序装在 Program Files（只读），所以
 *   · 运行时用随包分发的嵌入式 python（resources/python/python.exe）
 *   · 代码在 resources/backend、前端在 resources/frontend
 *   · 用户数据必须写到 %APPDATA%\文枢 LitHub\data（否则装完不能导入文献）
 * 这里统一算出来，后面的代码只认这几个常量。
 * ============================================================ */
const APP_DIR_NAME = "文枢 LitHub";
const isPackaged = app.isPackaged;

/* 随包资源的根目录：打包后是 resources/，开发时是仓库根 */
const RES_ROOT = isPackaged ? process.resourcesPath : path.join(__dirname, "..");

/* sidecar 代码目录 */
const BACKEND_DIR = path.join(RES_ROOT, "backend");

/* Python 解释器：打包版用内置运行时；开发版用系统的 */
function resolvePython() {
  if (isPackaged) {
    const exe = path.join(RES_ROOT, "python", "python.exe");
    if (fs.existsSync(exe)) return exe;
    log("内置 Python 运行时缺失（resources/python/python.exe），尝试系统 python");
  }
  return process.platform === "win32" ? "python" : "python3";
}

/* 用户数据目录：必须在可写位置，且和 sidecar（paths.py）算出的保持一致。
   用 Electron 的 userData（%APPDATA%\文枢 LitHub）作为根，拼出 data。 */
function resolveDataDir() {
  // 显式覆盖（排查时很方便，也方便做成便携版）
  if (process.env.LITHUB_DATA_DIR) return process.env.LITHUB_DATA_DIR;
  if (isPackaged) return path.join(app.getPath("userData"), "data");
  return path.join(BACKEND_DIR, "data");
}

/* ---------------- FastAPI sidecar ---------------- */
function startSidecar() {
  const py = resolvePython();
  const cwd = BACKEND_DIR;
  const startedAt = Date.now();
  const dataDir = resolveDataDir();

  const env = {
    ...process.env,
    // sidecar 的 paths.py 读这个变量决定数据放哪
    LITHUB_DATA_DIR: dataDir,
    LITHUB_PROGRAM_DIR: isPackaged ? path.dirname(app.getPath("exe")) : RES_ROOT,
    LITHUB_PDF_DEFAULT_DIR: process.env.LITHUB_DATA_DIR
      ? path.join(dataDir, "pdfs")
      : path.join(isPackaged ? path.dirname(app.getPath("exe")) : RES_ROOT, "pdfs"),
    LITHUB_API_PORT: String(SIDECAR_PORT),
    LITHUB_INSTANCE_ID: SIDECAR_INSTANCE,
    // 打包版没有控制台，日志级别压到 warning，避免无谓开销
    LITHUB_LOG_LEVEL: isPackaged ? "warning" : "info",
    // 不生成 .pyc：程序目录本身可能只读，写缓存会报一堆权限警告
    PYTHONDONTWRITEBYTECODE: "1",
  };

  log(`sidecar: ${py} | 代码 ${cwd} | 数据 ${dataDir} | 端口 ${SIDECAR_PORT}`);

  sidecar = spawn(
    py,
    ["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", String(SIDECAR_PORT)],
    { cwd, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }
  );

  sidecar.stdout.on("data", (d) => process.stdout.write(`[sidecar] ${d}`));
  sidecar.stderr.on("data", (d) => process.stderr.write(`[sidecar] ${d}`));
  sidecar.on("error", (err) => {
    log(`sidecar 启动失败（${err.message}），以纯界面模式运行`);
    sidecar = null;
  });
  sidecar.on("exit", (code) => {
    if (!quitting && Date.now() - startedAt < 5000) {
      log(`sidecar 提前退出（code=${code}）：${SIDECAR_PORT} 端口可能被占用，或依赖未安装`);
    }
    sidecar = null;
  });

}

function stopSidecar() {
  if (!sidecar) return;
  try {
    sidecar.kill();
  } catch {}
  sidecar = null;
}

function waitForSidecar() {
  return waitForOwnedSidecar({
    baseURL: `http://127.0.0.1:${SIDECAR_PORT}`, instanceId: SIDECAR_INSTANCE,
    fetch: (url, options) => net.fetch(url, options),
    isAlive: () => !!sidecar && sidecar.exitCode === null && !sidecar.killed && !quitting,
  });
}

/* ---------------- 窗口 ---------------- */
function createWindow() {
  const iconPath = path.join(__dirname, "icon.ico");
  win = new BrowserWindow({
    width: 1380,
    height: 880,
    minWidth: 980,
    minHeight: 640,
    titleBarStyle: "hidden", // 自定义标题栏；Windows 10+ 保留系统阴影/贴靠/缩放
    backgroundColor: "#f6f3ec",
    show: false,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  win.once("ready-to-show", () => win.show());
  win.webContents.on("render-process-gone", (_event, details) => {
    log("渲染进程退出:", details.reason);
    closeBrowserSession();
    try { webAiView?.setVisible?.(false); } catch {}
  });
  // 优先从 sidecar 加载前端（localhost 静态服务，规避 file:// 的 worker 限制）
  waitForSidecar()
    .then(() => {
      sidecarReady = true;
      return win?.loadURL(`http://127.0.0.1:${SIDECAR_PORT}/`);
    })
    .catch(error => {
      if (quitting) return;
      log("后端启动失败:", error.message);
      dialog.showErrorBox("文枢启动失败", `${error.message}\n\n后端目录：${BACKEND_DIR}\n端口：${SIDECAR_PORT}`);
      app.quit();
    });

  win.on("maximize", () => win?.webContents.send("lithub:maximized", true));
  win.on("unmaximize", () => win?.webContents.send("lithub:maximized", false));
  // 窗口尺寸变化时原生视图不会自动跟随，让渲染进程重新上报矩形
  const pingBounds = () => win?.webContents.send("lithub:relayout");
  win.on("resize", pingBounds);
  win.on("maximize", pingBounds);
  win.on("unmaximize", pingBounds);
  win.on("enter-full-screen", pingBounds);
  win.on("leave-full-screen", pingBounds);
  win.webContents.on("did-fail-load", (_e, code, desc, url) =>
    log(`页面加载失败 code=${code} ${desc} ${url}`)
  );
  win.on("closed", () => {
    win = null;
    // 主窗口关闭时销毁内嵌视图，避免原生层残留
    try { webAiView?.webContents.close(); } catch {}
    webAiView = null;
    webAiAttached = false;
    // 嵌入的用户浏览器窗口是**别的进程**的子窗口，宿主没了它不会自己关。
    // sidecar 里还有一层看门线程兜底，这里先主动关一次（尽力而为）。
    try {
      if (!sidecarReady) return;
      net.fetch(`http://127.0.0.1:${SIDECAR_PORT}/api/browser/close`, { method: "POST" }).catch(() => {});
    } catch {}
  });
}

ipcMain.on("win:minimize", (e) => BrowserWindow.fromWebContents(e.sender)?.minimize());
ipcMain.on("win:maximize", (e) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (!w) return;
  w.isMaximized() ? w.unmaximize() : w.maximize();
});
ipcMain.on("win:close", (e) => BrowserWindow.fromWebContents(e.sender)?.close());

/* 用系统默认浏览器打开外链（网页 AI 等）。
   只放行 http/https，其它协议（file:、javascript: 等）一律拒绝，
   避免渲染进程被注入后借这个通道做本地文件操作。 */
ipcMain.handle("shell:open-external", async (_e, url) => {
  try {
    const u = new URL(String(url));
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return { ok: false, error: "只允许打开 http/https 链接" };
    }
    await shell.openExternal(u.toString());
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || "打开失败" };
  }
});

/* PDF storage: folder selection is native; migration itself is handled by the sidecar. */
ipcMain.handle("storage:pick-directory", async (_event, current) => {
  const result = await dialog.showOpenDialog(win, {
    title: "选择 PDF 存储目录", properties: ["openDirectory", "createDirectory"],
    defaultPath: typeof current === "string" && path.isAbsolute(current) ? current : undefined,
  });
  return result.canceled ? { ok: false, canceled: true } : { ok: true, directory: result.filePaths[0] };
});
ipcMain.handle("storage:open-directory", async () => {
  try {
    const response = await net.fetch(`http://127.0.0.1:${SIDECAR_PORT}/api/settings/pdf-storage`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) throw new Error("读取存储目录失败");
    const info = await response.json();
    const error = await shell.openPath(info.directory);
    return { ok: !error, error };
  } catch (error) { return { ok: false, error: error.message }; }
});

/* ============================================================
 * 内嵌网页 AI（WebContentsView 原生层）
 *
 * 为什么用原生视图而不是 <webview>/iframe：
 *   · 绝大多数 AI 站点设置了 X-Frame-Options / CSP，iframe 直接拒绝加载；
 *   · <webview> 是 Electron 官方不推荐的历史特性；
 *   · WebContentsView 是独立 Chromium 视图，能正常渲染任意站点。
 *
 * 代价：它是叠加在页面之上的原生层，不受 DOM 的 z-index/圆角/裁剪影响，
 * 所以必须由渲染进程把「占位 div 的屏幕矩形」报上来，主进程据此同步 bounds。
 *
 * 登录态：用固定 partition（persist:webai），第一次登录后长期保留。
 * 注意这与用户本机 Chrome 的 profile 不互通 —— 浏览器会锁住自己的用户目录，
 * 外部进程无法安全共用。想复用本机登录态走下面「嵌入用户自己的浏览器」那条路
 * （browser:* IPC，SetParent 到应用窗口，登录态完整）。
 * ============================================================ */
const WEB_AI_PARTITION = "persist:webai";
let webAiView = null;
let webAiAttached = false;      // 是否已 addChildView（Electron 44 没有 contentView.children）
let webAiBounds = { x: 0, y: 0, width: 0, height: 0 };
let webAiVisible = false;

/* 允许内嵌的域名白名单前缀（防止被重定向到奇怪的站点） */
const WEB_AI_ALLOWED_PREFIXES = [
  "https://chat.deepseek.com",
  "https://chatgpt.com",
  "https://chat.openai.com",
  "https://kimi.moonshot.cn",
  "https://www.kimi.com",
  "https://yuanbao.tencent.com",
  "https://tongyi.aliyun.com",
  "https://chatglm.cn",
  "https://gemini.google.com",
  "https://claude.ai",
  "https://www.doubao.com",
  "https://poe.com",
  "https://chat.mistral.ai",
  "https://openrouter.ai",
];
const isAllowedWebAiUrl = (u) => {
  try {
    const url = new URL(String(u));
    if (url.protocol !== "https:") return false;
    return WEB_AI_ALLOWED_PREFIXES.some((p) => {
      const pu = new URL(p);
      return url.hostname === pu.hostname || url.hostname.endsWith("." + pu.hostname);
    });
  } catch { return false; }
};

function ensureWebAiView(url) {
  if (webAiView) return webAiView;
  webAiView = new WebContentsView({
    webPreferences: {
      partition: WEB_AI_PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // 不注入 preload：让这个视图完全等价于一个普通浏览器标签
      spellcheck: false,
    },
  });
  // 新窗口请求 → 交给系统浏览器，避免在内嵌视图里开出一堆窗口
  webAiView.webContents.setWindowOpenHandler(({ url: u }) => {
    if (/^https?:/i.test(u)) shell.openExternal(u).catch(() => {});
    return { action: "deny" };
  });
  // 站内跳转若跑到白名单外，也转外部浏览器
  webAiView.webContents.on("will-navigate", (e, u) => {
    if (!isAllowedWebAiUrl(u)) {
      e.preventDefault();
      if (/^https?:/i.test(u)) shell.openExternal(u).catch(() => {});
    }
  });
  webAiView.webContents.on("did-fail-load", (_e, code, desc, u) => {
    log(`[webai] 加载失败 code=${code} ${desc} ${u}`);
  });
  return webAiView;
}

function attachWebAi() {
  if (!win || !webAiView) return;
  if (!webAiAttached) {
    try { win.contentView.addChildView(webAiView); webAiAttached = true; } catch {}
  }
  webAiView.setBounds(webAiBounds);
  webAiView.setVisible?.(webAiVisible);
}

ipcMain.handle("webai:open", async (_e, url) => {
  if (!win) return { ok: false, error: "窗口未就绪" };
  if (!isAllowedWebAiUrl(url)) {
    return { ok: false, error: "该网址不在允许内嵌的站点列表里，请用「打开 AI 网页」在系统浏览器打开" };
  }
  const view = ensureWebAiView(url);
  attachWebAi();
  try {
    await view.webContents.loadURL(String(url));
  } catch (err) {
    return { ok: false, error: err?.message || "加载失败" };
  }
  return { ok: true };
});

/* 渲染进程报告占位 div 的屏幕矩形（CSS 像素）。视图隐藏时传 visible:false。 */
ipcMain.handle("webai:set-bounds", (_e, rect) => {
  if (!webAiView || !rect) return { ok: false, error: "网页视图尚未打开" };
  webAiBounds = {
    x: Math.round(rect.x || 0),
    y: Math.round(rect.y || 0),
    width: Math.max(0, Math.round(rect.width || 0)),
    height: Math.max(0, Math.round(rect.height || 0)),
  };
  const visible = Boolean(rect.visible) && webAiBounds.width > 20 && webAiBounds.height > 20;
  webAiVisible = visible;
  try {
    webAiView.setBounds(webAiBounds);
    if (visible) {
      // 首次显示时才挂到窗口上（避免空视图常驻遮挡）
      if (!webAiAttached && win) {
        win.contentView.addChildView(webAiView);
        webAiAttached = true;
      }
      webAiView.setVisible?.(true);
    } else {
      webAiView.setVisible?.(false);
    }
  } catch (error) { return { ok: false, error: error.message }; }
  return { ok: true };
});

ipcMain.handle("webai:close", async () => {
  webAiVisible = false;
  try {
    webAiView?.webContents.stop();
    webAiView?.setVisible?.(false);
    return { ok: true };
  } catch (error) { return { ok: false, error: error.message }; }
});

ipcMain.handle("webai:hide", async () => {
  webAiVisible = false;
  try { webAiView?.setVisible?.(false); } catch {}
  return { ok: true };
});

ipcMain.handle("webai:reload", async () => {
  try { webAiView?.webContents.reload(); return { ok: true }; } catch (e) { return { ok: false, error: String(e) }; }
});

ipcMain.handle("webai:back", async () => {
  try {
    if (webAiView?.webContents.canGoBack?.()) webAiView.webContents.goBack();
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
});

ipcMain.handle("webai:current-url", async () => {
  try { return { ok: true, url: webAiView?.webContents.getURL() || "" }; }
  catch { return { ok: false, url: "" }; }
});

/* ============================================================
 * 嵌入「用户自己的浏览器」（Chrome / Edge，复用真实登录态）
 *
 * 与上面的 WebContentsView 是两种互斥模式：
 *   · view 模式：应用内独立 profile，稳定，但登录态是新的
 *   · embed 模式：调起用户的真实浏览器窗口并 SetParent 到自己窗口下，登录态完整
 *
 * 原生子窗口的层级在渲染层之上，但低于同进程的 WebContentsView。所以嵌入时要
 * 把 WebContentsView 隐藏掉，避免两者打架。
 * ============================================================ */
ipcMain.handle("browser:detect", async (_e, customPath = "") => {
  // 走 sidecar 而不是自己 spawn python：
  //   · 单一数据源（探测逻辑只在 browser_embed.py 里一份）
  //   · 侧车常驻，探测是即时的；spawn 一个 python 解释器要几百毫秒
  try {
    const q = customPath ? `?custom_path=${encodeURIComponent(customPath)}` : "";
    const r = await net.fetch(`http://127.0.0.1:${SIDECAR_PORT}/api/browser/detect${q}`);
    const body = await r.json().catch(() => ({}));
    return { ok: r.ok, browsers: body?.browsers || [], error: body?.error };
  } catch (err) {
    return { ok: false, browsers: [], error: err?.message || "探测失败（sidecar 未就绪？）" };
  }
});

/* 让用户用系统文件对话框挑浏览器的 exe。
   手打路径太容易错，而且 Chrome/Edge 都藏在 Program Files 深处。 */
ipcMain.handle("browser:pick-exe", async () => {
  if (!win) return { ok: false, error: "窗口未就绪" };
  try {
    const r = await dialog.showOpenDialog(win, {
      title: "选择浏览器主程序",
      properties: ["openFile"],
      filters: [{ name: "可执行程序", extensions: ["exe"] }],
      message: "请选择 chrome.exe 或 msedge.exe",
    });
    if (r.canceled || !r.filePaths?.length) return { ok: false, canceled: true };
    return { ok: true, path: r.filePaths[0] };
  } catch (err) {
    return { ok: false, error: err?.message || "打开文件对话框失败" };
  }
});

/* 校验手动填的 exe 路径（存在性 + 是不是 Chromium 系） */
ipcMain.handle("browser:check-path", async (_e, p) => {
  try {
    const r = await net.fetch(`http://127.0.0.1:${SIDECAR_PORT}/api/browser/check-path`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: p || "" }),
    });
    const body = await r.json().catch(() => ({}));
    return r.ok ? { ok: true, ...body } : { ok: false, error: body?.detail || `HTTP ${r.status}` };
  } catch (err) {
    return { ok: false, error: err?.message || "校验失败" };
  }
});

/* 把当前 Electron 窗口的 HWND 交给 sidecar，由 sidecar 做 SetParent。
   Electron 44 用 getNativeWindowHandle() 拿句柄缓冲区（Windows 上是 32 位 HWND）。
   注意：前端 getBoundingClientRect 是 CSS 像素，Win32 MoveWindow 是物理像素，
   这里乘 window.devicePixelRatio 对齐。 */
function cssToPhysical(n, dpr) {
  return Math.round((n || 0) * (dpr || 1));
}

function rendererScale(rect) {
  const scale = Number(rect?.dpr);
  if (Number.isFinite(scale) && scale >= 0.25 && scale <= 8) return scale;
  return win ? screen.getDisplayMatching(win.getBounds()).scaleFactor : 1;
}

ipcMain.handle("browser:embed", async (_e, { url, browserId, browserPath, rect }) => {
  if (!win) return { ok: false, error: "窗口未就绪" };
  const buf = win.getNativeWindowHandle();
  // Windows：buf 是小端的 4 字节指针值
  const hwnd = buf.length >= 8 ? Number(buf.readBigUInt64LE(0)) : buf.readUInt32LE(0);
  const dpr = rendererScale(rect);
  try {
    // 嵌入前先隐藏 WebContentsView，避免原生层叠在一起
    webAiVisible = false;
    try { webAiView?.setVisible?.(false); } catch {}
    const r = await net.fetch(`http://127.0.0.1:${SIDECAR_PORT}/api/browser/embed`, {
      signal: AbortSignal.timeout(45000),
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        browser_id: browserId || "",
        // 设置页手动指定的 exe（自动检测找不到浏览器时靠它兜底）
        browser_path: browserPath || "",
        parent_hwnd: hwnd,
        x: cssToPhysical(rect?.x, dpr),
        y: cssToPhysical(rect?.y, dpr),
        width: Math.max(1, cssToPhysical(rect?.width, dpr)),
        height: Math.max(1, cssToPhysical(rect?.height, dpr)),
      }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: body?.detail || `HTTP ${r.status}` };
    return { ok: true, ...body };
  } catch (err) {
    return { ok: false, error: err?.message || "嵌入失败" };
  }
});

ipcMain.handle("browser:bounds", async (_e, rect) => {
  const dpr = rendererScale(rect);
  try {
    const r = await net.fetch(`http://127.0.0.1:${SIDECAR_PORT}/api/browser/bounds`, {
      signal: AbortSignal.timeout(3500),
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        x: cssToPhysical(rect?.x, dpr),
        y: cssToPhysical(rect?.y, dpr),
        width: Math.max(1, cssToPhysical(rect?.width, dpr)),
        height: Math.max(1, cssToPhysical(rect?.height, dpr)),
        visible: Boolean(rect?.visible),
        // 序号一路透传到侧车：拖动时前端连着发很多条，靠它丢掉先发后至的过期请求
        seq: Number(rect?.seq) || 0,
        session_id: String(rect?.session_id || ""),
      }),
    });
    // 把侧车的回应透给渲染进程：closed=true 表示用户自己把嵌入的浏览器窗口关掉了，
    // 渲染进程据此收起面板（否则会留一个空白面板）
    const body = await r.json().catch(() => ({}));
    return { ok: r.ok, ...body };
  } catch (err) {
    return { ok: false, error: err?.message || "更新位置失败" };
  }
});

async function closeBrowserSession(shutdown = false) {
  if (!sidecarReady) return { ok: true };
  try {
    const action = shutdown ? "shutdown" : "close";
    const response = await net.fetch(`http://127.0.0.1:${SIDECAR_PORT}/api/browser/${action}`, {
      method: "POST", signal: AbortSignal.timeout(7000),
    });
    const body = await response.json();
    return { ...body, ok: response.ok && body.ok === true };
  } catch (err) { return { ok: false, error: err?.message || "关闭失败" }; }
}
ipcMain.handle("browser:close", () => closeBrowserSession());

/* ---------------- 生命周期 ---------------- */
app.whenReady().then(async () => {
  SIDECAR_PORT = await selectSidecarPort(process.env.LITHUB_API_PORT);
  updateService = createUpdateService({
    version: app.getVersion(), storageFile: path.join(app.getPath("userData"), "update-check.json"),
    fetch: (url, options) => net.fetch(url, options), openExternal: url => shell.openExternal(url),
    onChange: snapshot => {
      if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send("updates:changed", snapshot);
    },
  });
  startSidecar();
  createWindow();
  updateService.start();
}).catch(error => {
  dialog.showErrorBox("文枢启动失败", error.message);
  app.quit();
});

app.on("window-all-closed", () => app.quit());
app.on("will-quit", () => updateService?.stop());

let shutdownComplete = false;
app.on("before-quit", (event) => {
  if (shutdownComplete) return;
  event.preventDefault();
  if (quitting) return;
  quitting = true;
  // Keep the sidecar alive until pending native launches have been cancelled and closed.
  closeBrowserSession(true).then(result => {
    if (!result.ok) log("退出时清理浏览器失败:", result.error);
  }).finally(() => {
    shutdownComplete = true;
    stopSidecar();
    app.quit();
  });
});
