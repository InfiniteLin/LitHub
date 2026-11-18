# 重建 Windows x64 内置 Python 和翻译引擎。
param(
    [switch]$Force,
    [string]$PythonVersion = "3.12.9"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$PyDir = Join-Path $PSScriptRoot "python"
$ZipPath = Join-Path $env:TEMP "python-$PythonVersion-embed-amd64.zip"
$WorkDir = Join-Path $Root ("tmp-runtime-" + [guid]::NewGuid().ToString("N"))
$Candidate = Join-Path $WorkDir "python"
$Backup = Join-Path $WorkDir "previous-python"

python -c "import sys,struct; sys.exit(sys.version_info[:2] != (3, 12) or struct.calcsize('P') != 8)"
if ($LASTEXITCODE -ne 0) { throw "请使用 64 位 Python 3.12 重建运行时" }

New-Item -ItemType Directory -Path $WorkDir | Out-Null
if ($Force -or -not (Test-Path $ZipPath)) {
    $url = "https://www.python.org/ftp/python/$PythonVersion/python-$PythonVersion-embed-amd64.zip"
    $download = Join-Path $WorkDir "python-embed.zip"
    Invoke-WebRequest -Uri $url -OutFile $download -UseBasicParsing
    Move-Item -LiteralPath $download -Destination $ZipPath -Force
}
Write-Host "准备嵌入式 Python $PythonVersion"
Expand-Archive -LiteralPath $ZipPath -DestinationPath $Candidate
$pthFile = Get-ChildItem $Candidate -Filter "python3*._pth" | Select-Object -First 1
@(
    ($pthFile.BaseName + ".zip"),
    ".",
    "Lib\site-packages",
    "import site"
) | Set-Content -LiteralPath $pthFile.FullName -Encoding ASCII

Write-Host "安装后端和 pdf2zh-next"
$SitePackages = Join-Path $Candidate "Lib\site-packages"
python -m pip install --target $SitePackages --only-binary=:all: --no-warn-script-location --no-compile -r (Join-Path $Root "backend\requirements.txt")
if ($LASTEXITCODE -ne 0) { throw "运行时依赖安装失败" }

$py = Join-Path $Candidate "python.exe"
& $py -B (Join-Path $PSScriptRoot "prepare-runtime.py") --source $Candidate
if ($LASTEXITCODE -ne 0) { throw "运行时验证失败" }

# 验证成功后替换依赖源。旧目录留在构建临时目录中，供回退。
$hadRuntime = Test-Path -LiteralPath $PyDir
if ($hadRuntime) {
    Move-Item -LiteralPath $PyDir -Destination $Backup
}
try {
    Move-Item -LiteralPath $Candidate -Destination $PyDir
} catch {
    if ($hadRuntime) {
        Move-Item -LiteralPath $Backup -Destination $PyDir
    }
    throw
}
Write-Host "已重建 build/python 和 build/runtime"
