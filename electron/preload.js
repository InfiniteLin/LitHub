/* 预加载脚本：向页面暴露最小窗口控制能力（contextIsolation 安全模式） */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("lithub", {
  isDesktop: true,
  platform: process.platform,
  minimize: () => ipcRenderer.send("win:minimize"),
  maximizeToggle: () => ipcRenderer.send("win:maximize"),
  close: () => ipcRenderer.send("win:close"),
  onMaximizeChange: (cb) => ipcRenderer.on("lithub:maximized", (_e, v) => cb(v)),
  /* 用系统默认浏览器打开外部网址。
     为什么不用内嵌 webview：那样是 Electron 自己的 Chromium profile，
     与用户本机 Chrome/Edge 的登录态完全隔离，每次都要重新登录。
     走系统浏览器则直接复用已登录的账号（用户明确要求）。 */
  openExternal: (url) => ipcRenderer.invoke("shell:open-external", url),

  /* ---- 内嵌网页 AI（WebContentsView 原生层，与论文并排） ---- */
  webAi: {
    /* 打开/切换内嵌站点。url 必须在主进程白名单内。 */
    open: (url) => ipcRenderer.invoke("webai:open", url),
    /* 上报占位 div 的屏幕矩形；visible=false 时隐藏原生层 */
    setBounds: (rect) => ipcRenderer.send("webai:set-bounds", rect),
    hide: () => ipcRenderer.invoke("webai:hide"),
    reload: () => ipcRenderer.invoke("webai:reload"),
    back: () => ipcRenderer.invoke("webai:back"),
    currentUrl: () => ipcRenderer.invoke("webai:current-url"),
    /* 主进程在窗口 resize/最大化时通知重新上报矩形 */
    onRelayout: (cb) => ipcRenderer.on("lithub:relayout", () => cb()),
  },

  /* ---- 嵌入「用户自己的浏览器」（Chrome / Edge）----
     这条路复用真实 profile，因此登录态完整。
     原理：用 --app 打开一个无地址栏窗口（命令会转发给已运行的浏览器，
     从而沿用原 profile），再由 sidecar 用 Win32 SetParent 挂到本窗口下。 */
  browser: {
    /* 列出可用的 Chromium 系浏览器（自定义路径 → 注册表 → 默认路径） */
    detect: (customPath = "") => ipcRenderer.invoke("browser:detect", customPath),
    /* 系统文件对话框挑浏览器的 exe */
    pickExe: () => ipcRenderer.invoke("browser:pick-exe"),
    /* 校验手动填的路径（存在性 + 是否 Chromium 系） */
    checkPath: (p) => ipcRenderer.invoke("browser:check-path", p),
    /* url: 要打开的地址；rect: 容器在窗口内的像素矩形；browserPath: 手动指定的 exe */
    embed: (opts) => ipcRenderer.invoke("browser:embed", opts),
    /* 面板尺寸/位置变化时同步；visible=false 隐藏 */
    setBounds: (rect) => ipcRenderer.invoke("browser:bounds", rect),
    close: () => ipcRenderer.invoke("browser:close"),
  },
});
