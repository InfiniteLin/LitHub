r"""翻译引擎入口：在 pdf2zh-next 之上补上「可被管道读取的进度」。

为什么不能直接 `python -m pdf2zh_next.main`：
  它的 `do_translate_file_async()` 把 `use_rich_pbar` 写死为 True，于是进度由
  rich.Progress 渲染。rich 检测到 stdout 不是终端（我们正是用管道读子进程输出）
  时不会逐帧刷新，整套流程只在结束时吐一行 `translate  0/100 0:00:00`；
  而 backend/translate.py 只认 tqdm 的 `(\d{1,3})%\|` 格式，一条也匹配不到，
  界面就永远停在「正在解析版面… 0%」。

  这层入口改为直接消费 `do_translate_async_stream()` 的结构化事件，按
  engine_progress 的固定协议打印进度行，进度因此在整段流程里都能推进。

为什么还要保留 CLI 参数解析：
  引擎的设置模型把命令行、环境变量、配置文件合在一起，参数语义（--bing /
  --lang-out / --output / --ignore-cache …）都定义在它的 ConfigManager 里。
  这里只做一次官方解析，再把结果交给 `do_translate_async_stream()`，避免
  自己重新实现一套易漂移的参数映射。
"""

import asyncio
from importlib.metadata import version
import inspect
import math
import os
from pathlib import Path
import sys
import tempfile

# 打包版用的是嵌入式 Python：它的 `pythonXY._pth` 只登记了自带的 zip 和
# site-packages，**不会**像普通解释器那样把脚本所在目录放进 sys.path，
# 于是 `from engine_progress import ...` 会直接 ModuleNotFoundError。
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pdf2zh_next.config import ConfigManager  # noqa: E402
from pdf2zh_next import high_level  # noqa: E402
from babeldoc.assets import assets  # noqa: E402
from openai import APIConnectionError, APIStatusError, APITimeoutError  # noqa: E402

from engine_progress import CONNECT_API, PREPARE_ASSETS, STARTUP_ERROR_PREFIX, progress_line, stage_line  # noqa: E402

SELF_CHECK = "--lithub-self-check"

_download_asset = assets.download_file
_get_translator = high_level.get_translator


def _connect_translator(settings):
    # pdf2zh-next sends a test translation before emitting any PDF progress.
    if settings.translate_engine_settings.translate_engine_type == "OpenAI":
        print(stage_line(CONNECT_API), flush=True)
    try:
        translator = _get_translator(settings)
    except (APIStatusError, APIConnectionError) as exc:
        if isinstance(exc, APIStatusError):
            code = exc.status_code
        elif isinstance(exc, APITimeoutError):
            code = "timeout"
        else:
            code = "connection"
        print(f"{STARTUP_ERROR_PREFIX} {code}", flush=True)
        raise
    print(stage_line(PREPARE_ASSETS), flush=True)
    return translator


async def _download_shared_asset(client=None, url=None, path=None, sha3_256=None):
    # Upstream writes directly to its output path. Stage each download privately
    # so other engines can only open complete, verified shared cache files.
    if assets.verify_file(path, sha3_256):
        return
    with tempfile.NamedTemporaryFile(dir=path.parent, prefix=".lithub-", suffix=".tmp",
                                     delete=False) as output:
        temporary = Path(output.name)
    try:
        await _download_asset(client, url, temporary, sha3_256)
        try:
            temporary.replace(path)
        except PermissionError:
            # Another engine may already be reading an identical file on Windows.
            if not assets.verify_file(path, sha3_256):
                raise
    finally:
        temporary.unlink(missing_ok=True)


# On Windows BabelDOC starts with multiprocessing spawn, which imports this entry.
assets.download_file = _download_shared_asset
high_level.get_translator = _connect_translator


async def _translate(settings) -> int:
    """逐个文件翻译，事件流式转成进度行；返回出错的文件数。"""
    files = list(settings.basic.input_files or ())
    settings.basic.input_files = set()
    if not files:
        print("没有待翻译的文件", flush=True)
        return 1

    errors = 0
    total = len(files)
    # input_files 是 set，顺序不定；固定成字典序，便于重跑时对照日志。
    files.sort()
    for index, file in enumerate(files, start=1):
        base = (index - 1) * 100 / total
        span = 100 / total
        current = None
        try:
            async for event in high_level.do_translate_async_stream(settings, file):
                kind = event.get("type")
                if kind in ("progress_start", "progress_update", "progress_end"):
                    stage = event.get("stage") or ""
                    overall = event.get("overall_progress")
                    if isinstance(overall, (int, float)) and math.isfinite(overall):
                        percent = min(99, int(base + span * min(100, max(0, overall)) / 100))
                        print(progress_line(percent, stage), flush=True)
                    elif stage and stage != current:
                        print(stage_line(stage), flush=True)
                    current = stage
                elif kind == "finish":
                    print(progress_line(min(99, int(base + span))), flush=True)
                elif kind == "error":
                    detail = event.get("error") or "未知错误"
                    # 前缀写成英文 error：translate.py 靠它把细节收进失败提示
                    print(f"error: {detail}", flush=True)
                    errors += 1
                    break
        except Exception as exc:  # 单个文件失败不影响其余文件
            print(f"error: {type(exc).__name__}: {exc}", flush=True)
            errors += 1
    return errors


def main() -> int:
    expected = None
    if sys.argv[1:2] == [SELF_CHECK]:
        if len(sys.argv) < 3:
            raise ValueError("插件自检缺少预期版本")
        expected = sys.argv.pop(2)
        sys.argv.pop(1)
        if version("pdf2zh-next") != expected:
            raise ValueError(f"插件版本与预期 {expected} 不符")
    settings = ConfigManager().initialize_config()
    if expected is not None:
        inspect.signature(high_level.do_translate_async_stream).bind(settings, "probe.pdf")
        return 0
    try:
        return asyncio.run(_translate(settings))
    except KeyboardInterrupt:
        return 1


if __name__ == "__main__":
    sys.exit(main())
