# Windows 安装包构建

```powershell
# 首次准备依赖，或需要更新依赖版本时执行
pwsh -File build/rebuild-runtime.ps1

# 每次打包自动生成并验证精简运行时
npm run dist  # 默认仅生成 ZIP，不上传
```

`build/python/` 是 pip 管理的原始依赖，`build/runtime/` 是生成的发布副本。
不要手工删除原始依赖。`beforePack` 会调用 `prepare-runtime.py`，更新发布副本并验证
后端、科学计算原生库、PDF 处理和完整的 pdf2zh 命令行导入链；验证失败就中止打包。

精简只排除已确认包的测试目录、pip、未使用的 Gradio 界面及缓存。
`numpy.testing` 等运行时辅助模块、原生库、许可证、包元数据和数据文件保留。
Python 后端与翻译进程使用 `-B`，避免在安装目录重新生成大量字节码文件。

安装器采用 `useZip: true` 与 `differentialPackage: false`，直接解压到安装目录。
两个选项必须同时保留，避免压缩格式与解压器不一致。项目目前使用完整安装包更新，
通过现有 GitHub Release API 下载完整安装包，无需 `latest.yml` 或差分包。
升级和卸载继续通过 `preserve-pdfs.nsh` 保留用户 PDF。

发布正式版本时，tag 使用 `v主版本.次版本.修订版本`，并上传构建生成的
`文枢 LitHub Setup 版本号.exe`（Windows x64）。附件名的版本必须与 tag 一致。
更新器会在下载前刷新发布信息，使用 GitHub 上传时生成的 `digest` 校验 SHA-256，
再等待应用退出、静默覆盖原目录并重启。没有附件或校验信息时会显示错误并保留当前版本。
安装包下载不经过浏览器；开发版不能执行安装更新。

下载目录相对于 `app.getPath("exe")` 定位，默认是程序根目录的 `updates/`，
与桌面快捷方式的工作目录无关；不可写时回退到 `userData/updates/`。
下载目录只在用户开始下载时创建，同一 SHA-256 的缓存跨重启校验复用。
升级前在系统临时目录生成经过校验的执行副本，兼容会移除程序子目录的旧版卸载器；
这个临时副本不写入桌面，超过一天的已标记临时目录在后续启动时清理。
新版卸载脚本在升级时保留 `updates/`，正式卸载时移除缓存并继续保留 PDF。

## 验证与计时

```powershell
npm run test:runtime           # 精简边界、源目录保护、增量同步
npm run runtime:prepare        # 生成发布副本并执行依赖检查
npm run verify:pdf-installer   # 真实 NSIS 升级 / 卸载保留 PDF
npm run benchmark:install      # 原始 7z、精简 7z、精简 ZIP，正反顺序各一轮
```

计时使用真实 NSIS 解压插件，测试目录仅位于 `release/install-benchmark/`，不写安装注册表、
不创建快捷方式、不启动应用，也不使用个人文献库。计时范围是 **Python 运行时的安装解压阶段**，
不等同于完整安装向导耗时。每次结果写入独立目录的 `results.json`。

可以复用已生成的测试压缩包，减少重复压缩时间：

```powershell
node build/benchmark-install.mjs release/install-benchmark/<已有目录> --quick --zip-first
```

`--quick` 每种方案只测一轮。安装包变大与提速幅度需要结合目标机器实测，不能只比较下载体积。

本机单轮对照结果（2026-10-25，仅计运行时安装解压）：

| 方案 | 解压耗时 | 运行时测试安装包 |
| --- | ---: | ---: |
| 原始运行时 + 7z | 230.8 秒 | 192.6 MiB |
| 精简运行时 + 7z | 140.8 秒 | 168.6 MiB |
| 精简运行时 + ZIP | 31.1 秒 | 209.6 MiB |

上述大小不是完整应用安装包大小。精简后的运行时从 650.1 MiB、16052 个文件减少到
567.2 MiB、10208 个文件；不同机器上的完整安装耗时仍需另行测量。

同一版本的完整应用安装包从 313.9 MiB 增至 377.7 MiB，安装目录则从 1079.2 MiB
减至 996.4 MiB。这里选择了更快安装、较大下载包的取舍。

## ZIP 免安装版

从 v0.2.4 起仅发布 ZIP。默认构建会生成干净的 `win-unpacked` 并自动打 ZIP：

```powershell
npm run dist -- --config.directories.output=release/current
# 已有干净的 win-unpacked 时也可单独打 ZIP：
# npm run dist:zip -- --unpacked release/current/win-unpacked --output release/current
npm run test:portable-update
```

脚本从 `package.json` 获取版本，校验打包后端版本，并输出 `LitHub-版本-win-x64.zip`。
ZIP 顶层目录必须是 `LitHub-版本-win-x64/`，包含完整程序与 `lithub-portable.json`；
更新器只接受版本和架构匹配的附件，必须提供 GitHub 的 SHA-256 digest。
不要将运行后的用户文件夹混入打包目录。打包脚本拒绝 PDF、下载缓存和本地文献库。

运行时以 NSIS 卸载程序是否存在区分安装版与免安装版，兼容没有标记的旧 ZIP。
v0.2.4 起仅上传 ZIP 与校验文件；安装版用户的新更新器会在缺少 EXE 时使用 ZIP 原位更新，保留卸载入口和原目录。免安装版缺少 ZIP 时不会转而安装 EXE。
`npm run dist:installer -- --publish never` 仅供重建 v0.2.3 等历史安装包，正常发布不使用。
ZIP 替换助手使用临时目录中的独立 Python 标准库运行时，不锁住原程序的 EXE 或 DLL。
程序目录中的 `.lithub-update-*` 是更新事务目录：启动确认成功前保留旧文件；
如遇断电或恢复失败，请保留其中的 `backup/` 和 `plan.json`，不要自行清理。
目前支持替换失败和启动确认超时后的回滚，不保证断电期间的多文件替换具有原子性。
文献元数据、PDF 和设置保持原来的存储方式，免安装不等于所有数据都随程序移动。
