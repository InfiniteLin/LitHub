"""把「文件」放进 Windows 剪贴板（CF_HDROP 格式）。

用途：一键复制 PDF，让用户直接粘贴进 ChatGPT / Kimi / DeepSeek 的对话框或
网盘/邮箱，而不是复制一大段正文文本。

为什么需要这个模块：
  Electron 的 clipboard API 只能写文本与图像，写不了「文件」；
  而浏览器/资源管理器识别的是剪贴板里的 CF_HDROP（文件拖放）格式。
  这里用 ctypes 直接调用 Win32 剪贴板 API 写入该格式，
  与在资源管理器里 Ctrl+C 一个文件的效果完全一致。

非 Windows 平台返回 (False, "仅 Windows 支持复制文件到剪贴板")。
"""

from __future__ import annotations

import ctypes
import sys
from pathlib import Path

CF_HDROP = 15
GMEM_MOVEABLE = 0x0002
GMEM_ZEROINIT = 0x0040

# 原型只需要声明一次；windll 的 DLL 对象是进程级缓存的，声明过就一直有效
_DECLARED = False


def _declare_prototypes(user32, kernel32):
    """给用到的 Win32 函数声明参数/返回类型。

    **这不是可选的**：64 位 Python 里 ctypes 默认把参数当 C int 处理，
    而 HGLOBAL / HWND 这类句柄是指针宽度，一旦句柄值 > 2^31
    （完全正常，堆地址常在 0x7FF... 一带），传参就会抛
    OverflowError: int too long to convert。
    早期版本没声明，导致「复制 PDF」在 64 位机器上 100% 失败、
    前端一路掉进「另存到下载文件夹」的兜底分支 —— 用户看到的就是"下载"。
    """
    global _DECLARED
    if _DECLARED:
        return

    hglobal = ctypes.c_void_p
    kernel32.GlobalAlloc.argtypes = [ctypes.c_uint, ctypes.c_size_t]
    kernel32.GlobalAlloc.restype = hglobal
    kernel32.GlobalLock.argtypes = [hglobal]
    kernel32.GlobalLock.restype = ctypes.c_void_p
    kernel32.GlobalUnlock.argtypes = [hglobal]
    kernel32.GlobalUnlock.restype = ctypes.c_int
    kernel32.GlobalFree.argtypes = [hglobal]
    kernel32.GlobalFree.restype = hglobal
    kernel32.Sleep.argtypes = [ctypes.c_uint]
    kernel32.Sleep.restype = None

    user32.OpenClipboard.argtypes = [ctypes.c_void_p]
    user32.OpenClipboard.restype = ctypes.c_int
    user32.EmptyClipboard.argtypes = []
    user32.EmptyClipboard.restype = ctypes.c_int
    user32.SetClipboardData.argtypes = [ctypes.c_uint, hglobal]
    user32.SetClipboardData.restype = hglobal
    user32.CloseClipboard.argtypes = []
    user32.CloseClipboard.restype = ctypes.c_int
    _DECLARED = True


class _POINT(ctypes.Structure):
    _fields_ = [("x", ctypes.c_long), ("y", ctypes.c_long)]


class _DROPFILES(ctypes.Structure):
    """Windows SHELLAPI.h 里的 DROPFILES 结构（20 字节）。

    pFiles 是「文件列表相对本结构起始地址的偏移」；fWide=1 表示
    文件列表是 UTF-16LE 编码、以双 NUL 结尾的多字符串。
    """

    _fields_ = [
        ("pFiles", ctypes.c_uint32),
        ("pt", _POINT),
        ("fNC", ctypes.c_int),
        ("fWide", ctypes.c_int),
    ]


def copy_files_to_clipboard(paths: list[str | Path]) -> tuple[bool, str]:
    """把一串文件放进剪贴板。返回 (ok, 错误信息)。

    这个动作**只写剪贴板，绝不落盘**（不要在失败时偷偷另存到下载文件夹 ——
    用户点的是「复制」，不是「下载」）。

    失败最常见的两种原因：
      · 剪贴板被别的程序短暂占用（多数情况重试即可）
      · 进程没有交互式桌面（例如在无窗口的服务会话里运行）——
        这时 OpenClipboard 会一直失败。
    """
    if sys.platform != "win32":
        return False, "复制文件到剪贴板目前仅支持 Windows"

    files = []
    for p in paths:
        f = Path(p)
        if not f.exists():
            return False, f"文件不存在：{f}"
        files.append(str(f.resolve()))
    if not files:
        return False, "没有可复制的文件"

    user32 = ctypes.windll.user32
    kernel32 = ctypes.windll.kernel32
    _declare_prototypes(user32, kernel32)

    # 打开剪贴板（重试：别的程序可能正占用，给足 1 秒）
    opened = False
    for _ in range(25):
        if user32.OpenClipboard(None):
            opened = True
            break
        kernel32.Sleep(40)
    if not opened:
        return False, (
            "无法打开剪贴板：可能被截图/剪贴板工具短暂占用，请稍后重试。"
        )

    h_mem = None
    try:
        user32.EmptyClipboard()

        # 拼多字符串：每个路径后跟 \0，最后再补一个 \0
        path_list = ("\0".join(files) + "\0\0").encode("utf-16-le")
        header = _DROPFILES()
        header.pFiles = ctypes.sizeof(_DROPFILES)
        header.pt.x = 0
        header.pt.y = 0
        header.fNC = 0
        header.fWide = 1  # UTF-16

        total = ctypes.sizeof(_DROPFILES) + len(path_list)
        h_mem = kernel32.GlobalAlloc(GMEM_MOVEABLE | GMEM_ZEROINIT, total)
        if not h_mem:
            return False, "分配剪贴板内存失败"

        ptr = kernel32.GlobalLock(h_mem)
        if not ptr:
            return False, "锁定剪贴板内存失败"
        try:
            ctypes.memmove(ptr, ctypes.byref(header), ctypes.sizeof(_DROPFILES))
            ctypes.memmove(ptr + ctypes.sizeof(_DROPFILES), path_list, len(path_list))
        finally:
            kernel32.GlobalUnlock(h_mem)

        if not user32.SetClipboardData(CF_HDROP, h_mem):
            return False, "写入剪贴板失败"
        # 成功后所有权移交系统，不要再释放
        h_mem = None
        return True, ""
    finally:
        user32.CloseClipboard()
        if h_mem:
            kernel32.GlobalFree(h_mem)
