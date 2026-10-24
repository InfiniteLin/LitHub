/* ============================================================
 * electron-builder 打包配置：生成 Windows 安装程序（NSIS）
 *
 * 产物结构（安装后）：
 *   安装目录/
 *     文枢 LitHub.exe            ← 双击这个
 *     resources/
 *       app.asar                 ← Electron 主进程 + 前端
 *       backend/                 ← FastAPI 代码（sidecar）
 *       frontend/                ← 静态页面（sidecar 静态托管）
 *       python/                  ← 内置 Python 运行时 + 全部依赖
 *   元数据：%APPDATA%\文枢 LitHub\data；新库 PDF 默认放在安装目录的 pdfs/（不可写时回退）
 *
 * 为什么把 Python 运行时整个塞进 resources：
 *   sidecar 是 Python + 一堆 C 扩展（PyMuPDF/onnxruntime/torch…），
 *   冻结成单 exe 试过（PyInstaller），在本机静默失败且 pdf2zh 的 torch
 *   依赖极难打，维护成本远高于直接带一份便携运行时。
 *   代价是安装包变大，换来的是「装上就能用，不需要用户装 Python」。
 * ============================================================ */
const path = require("node:path");

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: "com.lithub.app",
  productName: "文枢 LitHub",
  copyright: "Copyright © 2026 LitHub",

  // 只打我们自己的代码。
  // ⚠️ 这里必须把 electron/ 显式列进来：electron-builder 默认只从 package.json
  // 的依赖图里找文件，electron/ 不是依赖也不会被自动收录，漏了的话打出来的
  // asar 里没有 main.js，双击 exe 会**立刻静默退出**（连窗口都没有）。
  // 检查方法：npx asar list release/win-unpacked/resources/app.asar | findstr electron
  files: [
    "electron/**/*",
    "package.json",
    "!electron/icon.png",     // 打包用 ico，png 是界面用的，另在 frontend/assets
    "!**/*.map",
    "!**/*.md",
    "!**/test{,s}/**",
    "!**/*.log",
  ],

  // 额外资源：sidecar 代码、前端、内置 Python
  extraResources: [
    { from: "backend", to: "backend", filter: ["**/*", "!data/**", "!__pycache__/**", "!*.log"] },
    { from: "frontend", to: "frontend" },
    { from: "build/python", to: "python" },
  ],

  // 安装包图标 / 卸载图标
  win: {
    target: [{ target: "nsis", arch: ["x64"] }],
    icon: "electron/icon.ico",
    // 安装器不要求管理员权限：默认装到 %LOCALAPPDATA%\Programs，
    // 用户数据在 %APPDATA%，都不需要提权，避免每次启动弹 UAC。
    requestedExecutionLevel: "asInvoker",
  },

  nsis: {
    include: "build/preserve-pdfs.nsh",
    oneClick: false,              // 给用户选安装目录的机会
    perMachine: false,            // 只给当前用户装（不需要管理员）
    allowToChangeInstallationDirectory: true,
    allowElevation: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: "文枢 LitHub",
    // 卸载时不要删用户数据（文献库/笔记在 %APPDATA%，删了就是数据丢失）
    deleteAppDataOnUninstall: false,
    // 安装完直接启动
    runAfterFinish: true,
    // 中文安装界面
    installerLanguages: ["zh_CN"],
    language: "2052",
  },

  // 打包时不要碰源码目录
  directories: {
    output: "release",
    buildResources: "electron",
  },

  // 关掉自动更新（本地工具，没有发布服务器）
  publish: null,

  // asar 只包 JS 代码；Python/前端走 extraResources（在 asar 外面，
  // 因为 sidecar 是独立进程，没法从 asar 里读文件）
  asar: true,
  asarUnpack: [],

  // 压缩算法：maximum 会让 800MB 的 python 目录打好几分钟，normal 足够
  compression: "normal",
  removePackageScripts: true,
};
