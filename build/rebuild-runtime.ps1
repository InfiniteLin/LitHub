# 一键重建内置 Python 运行时（打包前跑这个）
#
# 作用：把「嵌入式 Python 3.12 + sidecar 依赖 + pdf2zh」装进 build/python/，
# 打安装包时会整个塞进 resources/python。
#
# 为什么要有这个脚本：
#   依赖版本之间有硬约束（pdf2zh 要 pymupdf<1.25.3、babeldoc 要 bitstring 4.x、
#   腾讯云 SDK 版本又反过来影响 pdf2zh 能否 import）。手工一条条 pip install
#   很容易装出「sidecar 能跑但 pdf2zh 一 import 就崩」的组合，所以固化成脚本，
#   而且**最后一定会做 import 冒烟测试**，装坏了立刻能发现。
#
# 用法（仓库根目录）：
#   pwsh -File build/rebuild-runtime.ps1
#   pwsh -File build/rebuild-runtime.ps1 -Force     # 忽略缓存，全量重装
#
# 产物：build/python/（约 640 MB）
# 发布副本：build/runtime/（自动精简并验证；安装包只使用这个副本）
# 注意：不需要管理员权限；全程只写 build/ 目录。

param(
    [switch]$Force,
    [string]$PythonVersion = "3.12.9"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot     # 仓库根
$PyDir = Join-Path $Root "build\python"
$SitePackages = Join-Path $PyDir "Lib\site-packages"
$ZipPath = Join-Path $env:TEMP "python-$PythonVersion-embed-amd64.zip"

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }

# ---------- 1. 嵌入式 Python ----------
if ($Force -or -not (Test-Path (Join-Path $PyDir "python.exe"))) {
    Write-Step "下载 Python $PythonVersion 嵌入式发行版"
    if (-not (Test-Path $ZipPath)) {
        $url = "https://www.python.org/ftp/python/$PythonVersion/python-$PythonVersion-embed-amd64.zip"
        Invoke-WebRequest -Uri $url -OutFile $ZipPath -UseBasicParsing
    }
    Write-Step "解压到 build/python"
    Remove-Item $PyDir -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Path $PyDir -Force | Out-Null
    Expand-Archive -Path $ZipPath -DestinationPath $PyDir -Force
} else {
    Write-Step "复用已有的 build/python"
}

# ---------- 2. 打开 site-packages ----------
# 嵌入式发行版默认不加载 site（._pth 里注释掉了），不打开的话 pip 装的包全都找不到。
Write-Step "启用 site-packages"
$pthFile = Get-ChildItem $PyDir -Filter "python3*._pth" | Select-Object -First 1
@(
    "python312.zip",
    ".",
    "Lib\site-packages",
    "",
    "import site"
) | Set-Content $pthFile.FullName -Encoding ASCII

# ---------- 3. pip ----------
Write-Step "安装 pip"
New-Item -ItemType Directory -Path $SitePackages -Force | Out-Null
# 用宿主 python 的 pip 装到 --target：嵌入式 python 自己跑 get-pip.py 会卡住
python -m pip install --target $SitePackages --no-warn-script-location --no-compile --upgrade pip
if ($LASTEXITCODE -ne 0) { throw "pip 安装失败" }

# ---------- 4. 依赖 ----------
# 一次性装完，让 pip 统一解析版本。分多次装会各装各的最新版，装出互相冲突的组合。
Write-Step "安装 sidecar + pdf2zh 依赖（约 10 分钟）"
$pkgs = @(
    "fastapi==0.142.2",              # 与开发环境一致，已验证
    "uvicorn==0.38.0",
    "python-multipart==0.0.32",
    "pypdf==6.18.1",
    "pymupdf==1.25.2",               # pdf2zh 要求 <1.25.3
    "openai==2.7.2",
    "pdf2zh==1.9.11",
    # 下面几个必须显式钉住：pip 自己解析时会挑过新的版本，导致运行期 ImportError
    "bitstring==4.4.0",              # babeldoc 要 BitStream（5.x 改名了）
    "numpy==2.3.5",
    "scipy==1.15.2",
    "tencentcloud-sdk-python-tmt==3.0.1478",   # pdf2zh.translator 用它的 TextTranslateRequest
    "tencentcloud-sdk-python-common==3.1.185"
)
python -m pip install --target $SitePackages --no-warn-script-location --no-compile --upgrade @pkgs
if ($LASTEXITCODE -ne 0) { throw "依赖安装失败" }

# ---------- 5. 清理依赖源中的缓存 / 未使用的图形界面 ----------
Write-Step "清理 __pycache__ / 图形界面依赖"
Get-ChildItem $SitePackages -Recurse -Directory -Filter "__pycache__" -ErrorAction SilentlyContinue |
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
# gradio 只有 pdf2zh 的图形界面用，命令行流程不需要；删掉能省 150MB
foreach ($junk in @("gradio", "gradio_client")) {
    Remove-Item (Join-Path $SitePackages $junk) -Recurse -Force -ErrorAction SilentlyContinue
}

# ---------- 6. 冒烟测试（关键）----------
# 装完必须立刻验证两件事能 import：sidecar 的依赖、以及 pdf2zh 的完整调用链。
# 少了这步，装出「都能装上但一用就 ImportError」的组合也不会被发现。
Write-Step "冒烟测试"
$py = Join-Path $PyDir "python.exe"
& $py -B -c "import fastapi, uvicorn, pydantic, pymupdf, pypdf, openai, multipart; print('sidecar deps OK')"
if ($LASTEXITCODE -ne 0) { throw "sidecar 依赖导入失败" }

& $py -B (Join-Path $Root "backend\pdf2zh_cli.py") --help | Out-Null
if ($LASTEXITCODE -ne 0) { throw "pdf2zh 导入失败（版本组合有问题，见脚本顶部的说明）" }
Write-Host "pdf2zh OK" -ForegroundColor Green

# ---------- 7. 生成发布用精简运行时 ----------
# 保留 pip 管理的依赖源；测试目录、pip、缓存只从发布副本中移除。
Write-Step "生成并验证精简运行时 build/runtime"
& $py -B (Join-Path $PSScriptRoot "prepare-runtime.py")
if ($LASTEXITCODE -ne 0) { throw "精简运行时验证失败" }

$size = (Get-ChildItem $PyDir -Recurse -File | Measure-Object Length -Sum).Sum / 1MB
Write-Host ("==> 完成：{0} ({1:N0} MB)" -f $PyDir, $size) -ForegroundColor Green
