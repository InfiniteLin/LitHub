<p align="center">
  <img src="docs/images/lithub-cover.png" alt="文枢 LitHub：从文献整理、双语阅读到知识笔记的概念插画" width="100%">
</p>

<h1 align="center">文枢 LitHub</h1>
<p align="center"><strong>让阅读，沉淀为知识。</strong></p>
<p align="center">本地文献库 · 双语对照阅读 · PDF 批注 · Markdown 笔记 · AI 辅助精读</p>
<p align="center">
  <a href="https://github.com/InfiniteLin/LitHub/releases">下载安装包</a> ·
  <a href="#快速开始">快速开始</a> ·
  <a href="#功能">功能介绍</a> ·
  <a href="#从源码跑">源码运行</a> ·
  <a href="https://github.com/InfiniteLin/LitHub/issues">反馈问题</a>
</p>

LitHub 是面向英文论文阅读的 Windows 桌面应用：把 PDF 收进本地文献库，按需调用翻译服务生成中文译文与双语对照版，在同一个窗口里完成阅读、批注和笔记整理。

**本地优先**指文献和阅读数据保存在本机；翻译与 AI 功能会按配置访问外部服务，并不等同于离线翻译。

> 当前版本：`0.1.1` · 支持 Windows x64 · MIT 许可。顶部封面为 AI 生成的概念插画，下面的功能图片为应用界面截图。

## 阅读界面

<p align="center">
  <img src="docs/screenshots/reader-dual.png" alt="双语对照阅读" width="100%">
</p>

---

## 它解决什么问题

读英文论文时，文献整理、翻译、对照阅读和笔记往往分散在多个工具里。来回切换窗口，也容易让重点和疑问散落各处。

LitHub 把这一串收进一个窗口：

- **翻译**用 [pdf2zh](https://github.com/Byaidu/PDFMathTranslate)，做的是**版面级**替换 —— 尽量保留公式、图表与双栏结构；实际效果取决于 PDF 本身和翻译服务
- **对照**读的是翻译器合成的双栏 PDF：左边原文、右边译文，同一页、同一个位置
- **批注**直接在 PDF 上划词高亮 / 划线 / 写批注，气泡跟着文字走
- **笔记**是 Obsidian 风格的 Markdown，边写边渲染，自动保存
- **AI** 有两条路：自己的 API Key（流式总结），或者把网页版 AI（ChatGPT / DeepSeek / Kimi…）嵌进应用里跟论文并排

---

## 快速开始

1. **导入论文**：把 PDF 拖进文献库，通过分类、标签和收藏整理阅读清单。
2. **配置服务**：在设置的翻译选项中选择引擎与目标语言，默认 Bing 无需 API Key。使用 API 翻译或 AI 总结时，在「设置 → AI 服务」填写服务商、Base URL、模型与 API Key，测试连接并保存；API 翻译还需切换到 OpenAI 兼容引擎。
3. **生成译文**：打开论文，点击「翻译全文」，等待任务完成后切换「双语对照 / 原文 / 译文」。未翻译的论文也可以直接阅读原文。
4. **边读边记录**：选中文字添加高亮、划线或批注，在右侧打开 Markdown 笔记；也可以将整篇批注导出为笔记。
5. **按需使用 AI**：选择总结模板后发送，或打开网页 AI 面板，用「复制 PDF」「复制提示词」将材料粘贴到自己的对话中。

| 你的阅读任务    | 对应功能                  | 留下的成果        |
| --------- | --------------------- | ------------ |
| 收集和归类论文   | 分类树、标签、收藏、正文检索        | 可搜索的本地文献库    |
| 阅读英文原文    | 版面翻译、双语对照、缩放          | 原文、译文与对照 PDF |
| 记录重点与疑问   | 高亮、划线、批注、Markdown 编辑器 | 可继续编辑的阅读笔记   |
| 梳理方法与准备汇报 | AI 模板、视觉精读、网页 AI      | 辅助理解的总结与讨论材料 |

---

## 功能

### 文献库

<p align="center">
  <img src="docs/screenshots/library.png" alt="文献库" width="100%">
</p>

- 拖拽 PDF 进窗口即导入，从 PDF 元数据或首页排版自动识别论文标题和作者，提取页数并识别重复文件；标题识别失败时保留文件名，导入弹窗可关闭自动命名，作者无法识别时显示「未知作者」
- 列表、卡片和阅读器支持原位重命名：点击铅笔直接编辑标题，回车或失焦保存、Esc 取消；改名同步到标签页和导出文件名，保留原始导入文件名及关联笔记、批注和译文
- **无限层级的分类树**（右键新建子分类、重命名、删除）
- 标签、收藏、「最近添加」等智能视图
- 列表 / 网格两种视图，`/` 直接聚焦搜索框
- **Zotero 式可展开附件树**：一篇文献下面挂着原文 PDF、译文、双语对照版、笔记，点哪个开哪个

### 全文检索

不只是搜标题 —— **正文内容也进索引**。用 SQLite FTS5 的 trigram 分词，中文子串也能命中；搜到之后直接把命中的上下文片段显示在列表里，点一下就跳到那篇。

导入时同步建索引，删除时同步移除；索引坏了随时可以从原文全量重建。

### 双语对照阅读

- 三种阅读模式：**双语对照**（合成版左右并排）/ **原文** / **译文**（见顶部那张图）
- PDF.js 渲染，按屏幕 DPI 超采样，缩放后不发虚
- 懒渲染：只画视口附近的页，减少长文档阅读时的渲染开销
- `Ctrl` `+` / `-` / `0` 缩放，页宽 / 页高自适应
- 深色模式下页面会做反色处理，夜里读不刺眼

### 批注

- 选中文字 → 浮动工具条 → **高亮 / 划线 / 批注**
- 批注气泡可以拖动，位置记住；有「回到批注文字旁」一键复位
- 高亮重叠时按颜色分层绘制，不会互相盖住
- 批注列表按页序排列，可筛选类型、点击跳转
- 一键把整篇的批注按文序导出成一条 Markdown 笔记

### 笔记

<p align="center">
  <img src="docs/screenshots/notes.png" alt="笔记" width="100%">
</p>

- Vditor 即时渲染（Obsidian 风格），三种模式：即时渲染 / 源码分屏 / 只读
- KaTeX 公式、表格、代码块高亮、图片拖入上传
- 停手 800ms 自动保存，`Ctrl+S` 立即保存
- 可以贴在阅读器右侧（挤压阅读区，不遮挡），也可以单独开一个标签页放大写

### AI 总结

配好 API Key 之后，右侧抽屉里流式输出结构化总结。内置四套提示词模板（文献速读 / 方法剖析 / 审稿人视角 / 组会汇报），可以自己加，模板里支持 `{{title}}` `{{venue}}` `{{abstract}}` 占位符。

支持视觉模式：把 PDF 页面渲染成图片一起发给多模态模型，比纯文本抽取准。

### 网页 AI 内嵌

<p align="center">
  <img src="docs/screenshots/webai.png" alt="网页 AI" width="100%">
</p>

想用 ChatGPT / DeepSeek 的网页版，但又不想来回切窗口？可以把它**嵌进应用右侧**，和论文并排：

- 嵌的是**你自己的 Chrome / Edge**，登录态跟平时完全一样，不用再登录一次
- 面板头两个按钮喂料：**复制 PDF**（文件进剪贴板，到对话框里 `Ctrl+V` 就是上传）、**复制提示词**
- 中间分隔条可以拖，宽度自己定
- 内置站点切换，也能自己加常用站点

> ⚠️ 已知限制：嵌入浏览器模式下，中文输入法的候选框会跑到屏幕左上角（子窗口拿不到光标位置）。要打中文建议先在别处打好再粘贴，或改用 API Key 那条路。

### 外观

<p align="center">
  <img src="docs/screenshots/library-dark.png" alt="深色模式" width="100%">
</p>

浅色纸感 / 深色夜读两套主题，四种强调色（朱砂、黛蓝、竹绿、玄墨）。编辑风格排版 —— 衬线标题、留白、细分割线。

---

## 安装

### 下载安装包（推荐）

到 [Releases](https://github.com/InfiniteLin/LitHub/releases) 查看已发布的安装包；如有对应版本，下载 `文枢 LitHub Setup x.y.z.exe`，双击安装。

- 装到当前用户目录，**不需要管理员权限**
- 首次运行 Windows 可能提示「未知发布者」（安装包没有代码签名），选「更多信息 → 仍要运行」
- 内置 Python 运行时和全部依赖，包括翻译引擎，**装完就能用**

### 从源码跑

需要 Node.js 20+ 和 Python 3.12（3.11 也行），目前只支持 Windows。

```powershell
git clone https://github.com/InfiniteLin/LitHub.git
cd LitHub

# 建议用独立虚拟环境；激活后 Electron 才会使用其中的 python
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
npm install
npm run dev
```

仅使用文献管理、阅读、批注与笔记时，无需安装翻译引擎。需要「翻译全文」时，在同一虚拟环境中安装：

```powershell
python -m pip install pdf2zh==1.9.11
```

Electron 启动时会自动拉起 Python 后端，无需另开一个后端进程。若 PowerShell 的执行策略阻止激活，可在当前终端临时设置 `$env:Path = "$PWD\.venv\Scripts;$env:Path"` 后继续。

> 国内网络如果 Electron 下载失败，先设镜像：
> 
> ```powershell
> $env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
> ```

想自己打包安装程序，见下面的「参与开发」。

---

## 数据存在哪

| 内容                       | 位置                                                     |
| ------------------------ | ------------------------------------------------------ |
| PDF 原文、译文、双语对照版 | 新文献库默认：程序文件夹下的 `pdfs/`；可在「设置 → 文件存储」更改 |
| 文献库、笔记、批注、搜索索引 | 安装版：`%APPDATA%\文枢 LitHub\data`<br>源码版：`backend/data/` |
| API Key                  | 同一份 `library.json`，用 Windows DPAPI 加密（绑定当前 Windows 账户） |

已有文献库会继续使用原目录，避免启动时迁移大批文件。在「设置 → 文件存储」选择目录，点击「迁移并应用」，会复制并校验现有 PDF，更新译文路径，成功后立即生效；原目录保留副本。程序目录不可写时会回退并在设置中显示实际位置。

备份前先关闭应用，同时备份整个 `data` 文件夹和设置页显示的 PDF 存储目录（若二者相同，只需备份一次）。恢复时同样先关闭应用；恢复到不同路径后，请在设置页重新选择对应的 PDF 目录。覆盖已有目录前请先保留一份旧数据。**换机器或 Windows 账户后，API Key 可能无法解密，需要重新填写。**

可以在启动前通过环境变量指定数据位置：

```powershell
$env:LITHUB_DATA_DIR = "D:\LitHubData"
npm run dev
```

这个变量指定元数据目录；新文献库的 PDF 默认放在其 `pdfs/` 子目录。已有 PDF 自定义路径仍以存储设置为准。切换前请自行备份并将原数据复制到新目录。

### 联网与数据边界

- 文献库、PDF、笔记、批注和搜索索引保存在本地，不需要账号即可使用基础阅读功能。
- 翻译会将待翻译内容交给所选翻译服务；API 总结会发送论文文本，视觉精读还会发送页面图片。
- 网页 AI 使用对应网站的账号与服务；复制材料后，需要自行粘贴到对话中。
- 页面会请求 Google Fonts 在线字体资源；首次使用翻译引擎也可能需要下载模型等资源。离线环境下，在线服务不可用。
- 外部服务的费用、可用性与数据处理规则由对应服务商决定。

---

## 常见问题

<details>
<summary>应用能打开，但无法导入 PDF 或保存数据？</summary>

源码运行时，先确认当前终端的 `python` 已安装 `backend/requirements.txt` 中的依赖。查看终端中的 `[sidecar]` 日志，并访问 `http://127.0.0.1:8130/api/health` 检查后端是否就绪。默认端口为 `8130`，已有进程占用时会影响启动。

</details>

<details>
<summary>翻译失败，或没有生成双语对照版？</summary>

源码运行需要额外安装 `pdf2zh==1.9.11`。检查翻译任务的错误信息、网络连接、所选服务与密钥配置。首次运行可能下载模型资源。翻译引擎包含多项依赖，遇到版本冲突时，可参考 `build/rebuild-runtime.ps1` 中固定的依赖组合。

</details>

<details>
<summary>扫描版 PDF 无法检索或总结？</summary>

全文检索和文本总结依赖 PDF 的可提取文字。扫描版可尝试 AI「视觉精读」，并选用支持图片输入的模型；它会发送页面图片，通常消耗更多 token。视觉精读不会为本地全文索引补充 OCR 文本。

</details>

<details>
<summary>网页 AI 面板打不开，或中文输入法位置异常？</summary>

请确认本机安装了 Chrome / Edge，并检查设置中的浏览器路径。网页 AI 嵌入依赖 Windows 原生窗口机制；中文输入法候选框定位存在已知限制，可先在其他位置输入后粘贴，或使用 API 总结功能。

</details>

---

## 快捷键

| 键                      | 作用                     |
| ---------------------- | ---------------------- |
| `/`                    | 在文献库里聚焦搜索框             |
| `Ctrl` `+` / `-` / `0` | 阅读器缩放（`0` = 适合宽度）      |
| `Ctrl+S`               | 立即保存笔记                 |
| `Ctrl+Enter`           | 保存批注备注                 |
| `Esc`                  | 关闭弹窗 / 中止正在流式输出的 AI 回复 |

---

## 技术栈

Electron 壳 + FastAPI sidecar + 纯手写前端（没有打包器、没有框架）。

```
┌──────────────────────────────────────────┐
│ Electron（主进程：窗口 / 原生层嵌入）       │
│  └─ 渲染进程：vanilla JS + CSS            │
│       ↕ HTTP (127.0.0.1:8130)            │
│ FastAPI sidecar（Python）                 │
│  ├─ 文献库 / 笔记 / 批注 / 设置（JSON）     │
│  ├─ 全文索引（SQLite FTS5）                │
│  ├─ 翻译（子进程调 pdf2zh）                │
│  └─ 嵌入 Chrome 窗口（Win32 SetParent）    │
└──────────────────────────────────────────┘
```

### 项目结构

```text
LitHub/
├─ electron/                 # 桌面主进程、预加载脚本与原生集成
├─ frontend/                 # 页面、样式、原生 JS 模块与前端依赖
├─ backend/                  # FastAPI、数据存储、全文索引与翻译任务
├─ build/rebuild-runtime.ps1 # 构建随安装包分发的 Python 运行时
├─ tests/                    # PDF 渲染测试与界面验证脚本
└─ docs/                     # README 封面与界面截图
```

几个实现选择：

- **没有打包器**。前端是原生的 ES 模块 + CSS，直接由 sidecar 静态托管。改一行代码刷新就生效，不用等编译。
- **渲染用 PDF.js，不走 `<iframe>`**。这样才能拿到文字层坐标，做划词批注和缩放。
- **嵌入的是真实浏览器进程**，不是 Electron 自己的内核。Chrome 127+ 的 Cookie 是 App-Bound 加密、绑定 Chrome 自身，从外部读不到 —— 所以「复制 profile」这条路是死的，只能让浏览器自己去渲染，再把它的窗口挂进应用里。

---

## 参与开发

欢迎提 Issue 和 PR。

常用命令：

```bash
npm run dev                # 开发模式启动
npm test                   # 单元测试（不需要 sidecar / 浏览器）
npm run verify:render      # 端到端 UI 验证（自动找本机 Chrome/Edge）

# 打包 Windows 安装程序
pwsh -File build/rebuild-runtime.ps1   # 仅首次或改依赖后：重建内置 Python 运行时
npm run dist                           # 出 release/文枢 LitHub Setup x.y.z.exe
```

## 致谢

- [pdf2zh / PDFMathTranslate](https://github.com/Byaidu/PDFMathTranslate) —— 版面级 PDF 翻译
- [PDF.js](https://mozilla.github.io/pdf.js/) —— PDF 渲染
- [Vditor](https://github.com/Vanessa219/vditor) —— Markdown 编辑器
- [KaTeX](https://katex.org/) —— 公式渲染

## 许可

[MIT](LICENSE)
