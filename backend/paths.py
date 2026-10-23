"""数据目录解析：把「哪里放用户数据」这件事集中到一处。

为什么需要单独一个模块：
  开发时数据就在 `backend/data/`，很省事。但打包成安装包后，程序本体装在
  `Program Files`（或 AppData 下的 resources），那个目录**对普通用户不可写**，
  文献库、批注、笔记全都会写失败 —— 用户会看到「导入没反应」「笔记存不上」。

规则（按优先级）：
  1. 环境变量 `LITHUB_DATA_DIR`：显式指定（安装版由 Electron 主进程设成
     `%APPDATA%\\文枢 LitHub\\data`，也方便用户/我们临时换位置排查）
  2. 已有 `backend/data/` 且里面有 library.json：沿用（开发机、以及从旧版升级上来的
     用户，数据原地不动）
  3. 其余情况：`%APPDATA%\\文枢 LitHub\\data`

第 2 条是关键：老数据必须能被认出来并继续用，不能因为改了路径就"丢库"。
"""

from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path

APP_DIR_NAME = "文枢 LitHub"


def _is_frozen() -> bool:
    """是否运行在 PyInstaller 打包出来的可执行文件里。"""
    return bool(getattr(sys, "frozen", False))


def _appdata_root() -> Path:
    """可写的用户数据根目录（Windows: %APPDATA%）。"""
    base = os.environ.get("APPDATA") or os.environ.get("XDG_DATA_HOME")
    if base:
        return Path(base) / APP_DIR_NAME
    return Path.home() / f".{APP_DIR_NAME}"


def _source_backend_dir() -> Path:
    """源码目录（打包后是解包出的临时目录，不能用来存数据）。"""
    return Path(__file__).resolve().parent


def _legacy_data_dir() -> Path:
    """旧版/开发版的数据目录：backend/data。"""
    return _source_backend_dir() / "data"


def resolve_data_dir() -> Path:
    """按上面的优先级算出该用哪个数据目录（不创建、不迁移）。"""
    env = (os.environ.get("LITHUB_DATA_DIR") or "").strip()
    if env:
        return Path(env).expanduser()

    # 没显式指定：开发模式就地用 backend/data（放在仓库里方便查看/备份），
    # 只有当那个位置**写不进去**时才退到 %APPDATA%。
    # 为什么用「能不能写」判断而不是 sys.frozen：安装版跑的是普通 python.exe
    # （嵌入式运行时，不是 PyInstaller 冻结的），frozen 恒为 False，判断不出来。
    # 安装版由主进程设置 LITHUB_DATA_DIR，所以正常不会走到这里；
    # 这个兜底是防「主进程没传环境变量时，数据写进 Program Files 直接失败」。
    legacy = _legacy_data_dir()
    try:
        legacy.mkdir(parents=True, exist_ok=True)
        probe = legacy / ".write-test"
        probe.write_text("", encoding="utf-8")
        probe.unlink()
        return legacy
    except Exception:
        return _appdata_root() / "data"


def _same_path(a: Path, b: Path) -> bool:
    try:
        return os.path.normcase(str(a.resolve())) == os.path.normcase(str(b.resolve()))
    except Exception:
        return False


def migrate_if_needed(target: Path) -> None:
    """把旧数据搬到新位置；目标已有数据就什么都不做。

    只在「旧目录有库、目标目录还没有库」时搬，避免任何情况下覆盖用户数据。
    搬的是整棵树（library.json / files / out / text / notes / search.db），
    所以升级后文献、译文、批注、笔记、搜索索引都还在。
    """
    legacy = _legacy_data_dir()
    if _same_path(legacy, target):
        return
    if not (legacy / "library.json").exists():
        return
    if (target / "library.json").exists():
        return
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            # 目标目录存在但没库（比如只建过空目录）：内容并过去
            for item in legacy.iterdir():
                dest = target / item.name
                if dest.exists():
                    continue
                try:
                    shutil.move(str(item), str(dest))
                except Exception:
                    pass
        else:
            shutil.copytree(legacy, target)
    except Exception:
        # 迁移失败不致命：调用方会继续用 target，只是数据还是空的。
        # 这里不抛异常，避免整个 sidecar 起不来 —— 用户的界面还能用。
        pass


def ensure_data_dir() -> Path:
    """算出、迁移并创建数据目录，返回它。各模块 import 时调一次。"""
    target = resolve_data_dir()
    migrate_if_needed(target)
    for sub in ("", "files", "out", "text", "notes"):
        try:
            (target / sub if sub else target).mkdir(parents=True, exist_ok=True)
        except Exception:
            pass
    return target


DATA_DIR = ensure_data_dir()


def resolve_frontend_dir() -> Path:
    """前端静态文件目录。

    开发时就是仓库里的 `frontend/`；PyInstaller 打包后，前端被打进
    `sys._MEIPASS/frontend`（--add-data）。sidecar 仍然静态托管它，
    Electron 才能继续从 localhost 加载（file:// 下 PDF.js 的 worker 会被拦）。
    """
    if _is_frozen():
        base = Path(getattr(sys, "_MEIPASS", _source_backend_dir()))
        cand = base / "frontend"
        if cand.exists():
            return cand
    return _source_backend_dir().parent / "frontend"


FRONTEND_DIR = resolve_frontend_dir()
