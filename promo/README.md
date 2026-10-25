# 文枢 LitHub · Remotion 介绍动画

50 秒、1920 × 1080、30 fps 的中文软件介绍片。使用项目内现有真实截图，以米白、墨色和朱红组成学术编辑风格；配原创程序化器乐，无配音。

## 预览与导出

在本目录运行，使用 Node.js 22 或更高版本：

```powershell
npm ci
npm run audio
npm run studio
```

Windows 可指定本机 Chrome 或 Edge，省去下载渲染浏览器；此环境已经验证 Chrome 可用：

```powershell
$env:REMOTION_BROWSER_EXECUTABLE = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
npm run typecheck
npm run render
npm run poster
```

也可以在标准 Remotion 命令上使用 `--browser-executable` 指定浏览器。不设置路径时由 Remotion 管理渲染浏览器。工程没有 CDP、编译器替换或浏览器启动补丁。

预览和导出脚本通过 `scripts/remotion.mjs` 调用原版 Remotion CLI，只为该子进程指定可写的 `.cache/render-temp/` 临时目录，避免本机系统临时目录的写入错误，不修改系统环境或权限。配置采用 Remotion 官方的[先渲染后编码选项](https://www.remotion.dev/docs/options/disallow-parallel-encoding)，保留四个浏览器标签并发渲染。

输出文件：

- `out/lithub-intro.mp4`：H.264 / yuv420p / BT.709 视频，附 AAC 音轨。
- `out/lithub-poster.png`：第 600 帧的双语阅读封面。
- `out/qa-*.png`：制作时导出的六个关键帧。

`out/`、依赖和缓存均忽略入库。动画工程独立于根目录的软件依赖。

## 分镜与编辑

| 时间 | 内容 | 文案与布局 |
| --- | --- | --- |
| 0–6 秒 | 品牌开场、层叠界面书页 | `src/scenes/Opening.tsx` |
| 6–15 秒 | 导入、分类、标签、全文搜索 | `src/scenes/Library.tsx` |
| 15–25 秒 | 原文与译文并排阅读 | `src/scenes/Reader.tsx` |
| 25–34 秒 | 高亮、批注、Markdown 笔记、自动保存 | `src/scenes/Notes.tsx` |
| 34–43 秒 | AI 总结、网页 AI、围绕论文提问 | `src/scenes/Discussion.tsx` |
| 43–50 秒 | 品牌、阅读流程、项目地址 | `src/scenes/Closing.tsx` |

全局颜色、字体和画布规格在 `src/theme.ts`；段落起点和长度在 `src/timeline.ts`；合成与音量在 `src/LitHubIntro.tsx`。修改时长时需要同步时间轴、`theme.ts` 的 `DURATION`、各场景的 `SceneShell` 时长及动画延时、音量曲线，以及配乐脚本的 `DURATION` 和分段和声时间。

所有视觉动画由帧数驱动，预览、任意帧截图和导出使用相同的时间轴。中文标题使用本机宋体，正文使用微软雅黑，英文使用 Georgia；其他系统会使用回退字体，精确复现本次排版建议在 Windows 渲染。没有随工程分发系统字体。

例如重新生成双语阅读画面：

```powershell
npm run poster
```

## 素材与配乐

`public/library.png`、`reader-dual.png`、`notes.png`、`webai.png` 和 `library-dark.png` 均复制自 `../docs/screenshots/`；`icon.png` 复制自 `../frontend/assets/icon.png`。原图保持不变，副本经过哈希比对。影片使用实际界面截图；缩放、裁切、框线和标签是介绍动效，不是实时操作录屏，不代表额外的软件功能。没有使用 AI 概念封面冒充界面。

`scripts/make-audio.mjs` 通过固定种子生成柔和的分解和弦、低音与背景音色，输出 50 秒、44.1 kHz、16 bit、双声道 `public/soundtrack.wav`。音轨没有引用第三方录音，运行 `npm run audio` 可重新生成。视频中另做音量包络和首尾淡入淡出。

介绍中的本地保存指文献与笔记；翻译和 AI 功能需要连接所选服务。网页 AI 场景保留现有的空白对话状态，没有编造 AI 回复。

## 制作与验证

DeepSeek 编写主体动画和配乐代码；其执行环境曾遇到 `spawn EPERM`，后续任务到达 30 分钟上限中断。Codex 在当前会话独立完成类型检查、实际关键帧渲染、视觉检查，并收尾文案、年份、结束停留与本说明。中断状态不视作委派成功，验收以本地实际产物和验证结果为准。

已执行 `npm run typecheck` 并通过；已渲染并检查第 105、330、600、900、1180、1430 帧。音源经 ffprobe 确认为 50 秒双声道 PCM。最终 MP4 的规格、完整解码和音轨检查结果记录在 `out/validation.json`，以实际导出文件为准。
