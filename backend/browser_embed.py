"""把外部浏览器（Chrome / Edge）窗口嵌入应用窗口。

## 为什么需要这个

用户希望「用我本机浏览器已登录的账号，但显示在应用里」。

Electron 的 WebContentsView 用的是独立 Chromium profile，拿不到用户 Chrome 的
Cookie：Chrome v127+ 的 Cookie 使用 App-Bound Encryption，密钥绑定 Chrome 自身
进程，连复制 profile 目录都无法解密。所以只能换思路：

  用用户的真实 profile 起一个 `--app=<url>` 窗口（Chrome 会把命令行转发给已运行的
  实例，因此窗口归属现有进程，登录态完整保留），再用 Win32 SetParent 把它挂到
  应用窗口下面，视觉上就像应用内的一个面板。

## 关键实现细节

1. **必须用 --app=**：普通标签页会出现在用户浏览器里，`--app` 才是一个无地址栏的
   独立顶层窗口，便于嵌入。
2. **不要传 --user-data-dir**：传了就变成全新 profile，登录态丢失，目的就没了。
3. **找窗口**：不能用启动器的 pid（Chrome 会把命令转发给现有进程，实际窗口属于
   那个进程）。按新窗口、窗口类、真实进程路径共同筛选；多个候选时拒绝猜测。
4. **WS_CHILD**：SetParent 后还要把窗口样式从 WS_POPUP 改成 WS_CHILD，否则
   嵌入后仍会浮在父窗口之上。
5. **还原**：面板关闭时要先把窗口从父窗口摘下（SetParent(hwnd, None)），再关闭，
   否则 Chrome 那边可能残留一个不可见的子窗口。
"""

from __future__ import annotations

import ctypes
import os
import subprocess
import sys
import threading
import time
from ctypes import wintypes
from pathlib import Path

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32
gdi32 = ctypes.windll.gdi32
try:
    shcore = ctypes.windll.shcore
except Exception:          # pragma: no cover - Windows 7 之前没有 shcore
    shcore = None
ENUM_WND_PROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)


# ============================================================
# DPI 感知（必须最先做，且必须在本进程创建任何窗口之前）
#
# 为什么是硬性要求：
#   前端上报的是 CSS 像素 × devicePixelRatio = **物理像素**。而 MoveWindow /
#   SetWindowPos 的坐标单位取决于**调用方进程**的 DPI 感知级别：
#     · 进程 DPI 感知（Electron 就是 Per-Monitor-V2）→ 坐标 = 物理像素 ✅
#     · 进程 DPI 不感知（python.exe 的默认值！）→ Windows 会把传进去的坐标再乘一次
#       系统缩放比（175% 显示器就再 ×1.75），子窗口因此被放大 + 偏移，
#       现象就是「网页糊在面板里、内容溢出、右边和下边被裁掉一大块」。
#   sidecar 是独立进程，跟 Electron 的感知级别无关，所以必须自己设。
# ============================================================
DPI_AWARENESS = "unaware"


def ensure_dpi_aware() -> str:
    """把当前进程设置为 DPI 感知；返回实际生效的级别（便于日志/诊断）。"""
    global DPI_AWARENESS
    if sys.platform != "win32":
        DPI_AWARENESS = "non-windows"
        return DPI_AWARENESS
    # 优先 Per-Monitor-V2（-4）：和 Electron 一致，多显示器混合缩放下也正确
    try:
        set_ctx = user32.SetProcessDpiAwarenessContext
        set_ctx.argtypes = [ctypes.c_void_p]
        set_ctx.restype = wintypes.BOOL
        if set_ctx(ctypes.c_void_p(-4)):
            DPI_AWARENESS = "per-monitor-v2"
            return DPI_AWARENESS
    except Exception:
        pass
    if shcore is not None:
        try:
            if shcore.SetProcessDpiAwareness(2) == 0:      # PER_MONITOR_DPI_AWARE
                DPI_AWARENESS = "per-monitor"
                return DPI_AWARENESS
        except Exception:
            pass
    try:
        if user32.SetProcessDPIAware():
            DPI_AWARENESS = "system"
            return DPI_AWARENESS
    except Exception:
        pass
    DPI_AWARENESS = "unaware-failed"
    return DPI_AWARENESS


ensure_dpi_aware()

# ---------- Win32 常量 ----------
GWL_STYLE = -16
WS_CHILD = 0x40000000
WS_POPUP = 0x80000000
WS_VISIBLE = 0x10000000
WS_CAPTION = 0x00C00000
WS_THICKFRAME = 0x00040000
WS_BORDER = 0x00800000
SW_HIDE = 0
SW_SHOW = 5
WM_CLOSE = 0x0010
WM_ACTIVATE = 0x0006
WA_ACTIVE = 1
# SetWindowPos 标志
SWP_NOSIZE = 0x0001
SWP_NOMOVE = 0x0002
SWP_NOZORDER = 0x0004
SWP_NOACTIVATE = 0x0010
SWP_FRAMECHANGED = 0x0020
SWP_SHOWWINDOW = 0x0040

# ---------- 浏览器探测 ----------
# 一、常见安装位置（默认装在 C 盘的绝大多数情况）
_BROWSER_CANDIDATES = [
    ("chrome", "Chrome", [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
    ]),
    ("edge", "Edge", [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"),
    ]),
]

# 二、注册表 App Paths：安装程序会把**真实** exe 路径登记在这里。
#     这是自动检测的主力 —— 用户把浏览器装在 D 盘 / 改过安装目录时，
#     光靠猜默认路径永远猜不到，只有注册表知道它在哪。
#     HKCU 也要查：有的安装器只写当前用户。
_REGISTRY_APPPATHS = [
    ("chrome", "Chrome", r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe"),
    ("edge", "Edge", r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe"),
]

# 能用的只有 Chromium 系：嵌的是它的窗口结构（Chrome_WidgetWin_1 + RenderWidgetHost），
# Firefox 完全不同，硬嵌进去只会得到一片空白。
_CHROMIUM_EXES = {
    "chrome.exe": ("chrome", "Chrome"),
    "msedge.exe": ("edge", "Edge"),
    "chromium.exe": ("chromium", "Chromium"),
    "brave.exe": ("brave", "Brave"),
    "vivaldi.exe": ("vivaldi", "Vivaldi"),
    "thorium.exe": ("thorium", "Thorium"),
}


def _registry_browser_paths() -> list[tuple[str, str, str]]:
    """从注册表 App Paths 里读浏览器 exe 的真实路径。

    返回 [(id, 显示名, exe 路径)]。非 Windows / 无权限时安静返回空列表 ——
    探测失败不该让整个功能不可用，后面还有默认路径兜底。
    """
    out: list[tuple[str, str, str]] = []
    try:
        import winreg
    except Exception:
        return out
    # 32/64 位视图都要看：装在 Program Files (x86) 的 32 位浏览器只在 32 位视图里
    views = [0, getattr(winreg, "KEY_WOW64_64KEY", 0), getattr(winreg, "KEY_WOW64_32KEY", 0)]
    for key, name, sub in _REGISTRY_APPPATHS:
        hit = ""
        for hive in (winreg.HKEY_CURRENT_USER, winreg.HKEY_LOCAL_MACHINE):
            for view in views:
                try:
                    with winreg.OpenKey(hive, sub, 0, winreg.KEY_READ | view) as k:
                        val, _ = winreg.QueryValueEx(k, "")
                except OSError:
                    continue
                val = (val or "").strip().strip('"')
                if val and Path(val).exists():
                    hit = val
                    break
            if hit:
                break
        if hit:
            out.append((key, name, hit))
    return out


def inspect_browser_path(path: str) -> tuple[dict | None, str]:
    """校验一个手动指定的浏览器 exe。返回 (浏览器信息, 错误说明)。

    除了确认文件存在，还要按文件名认一下是不是 Chromium 系 —— 否则用户选错成
    Firefox 或别的程序，要到嵌入那一刻才炸，报的还是看不懂的 Win32 错误。
    """
    p = (path or "").strip().strip('"')
    if not p:
        return None, "路径为空"
    f = Path(p)
    if not f.exists():
        return None, "文件不存在"
    if f.is_dir():
        return None, "这是文件夹，请选到浏览器主程序（例如 chrome.exe）"
    if f.suffix.lower() != ".exe":
        return None, "请选择 .exe 可执行文件"
    ident = _CHROMIUM_EXES.get(f.name.lower())
    if not ident:
        return None, f"不认识的程序「{f.name}」——只支持 Chrome / Edge 等 Chromium 系浏览器"
    return {"id": ident[0], "name": ident[1], "path": str(f.resolve())}, ""


def detect_browsers(custom_path: str = "") -> list[dict]:
    """列出可用的 Chromium 系浏览器。

    顺序即优先级：**自定义路径** → 注册表（真实安装位置）→ 默认安装路径。
    每条带 source 字段（custom / registry / path），界面据此说明它从哪找来的。
    同一个 exe 只出现一次（三路来源可能指向同一文件）。
    """
    found: list[dict] = []
    seen: set[str] = set()

    def add(bid: str, name: str, path: str, source: str) -> None:
        try:
            rp = str(Path(path).resolve())
        except Exception:
            rp = str(path)
        key = rp.lower()
        if key in seen or not Path(rp).exists():
            return
        seen.add(key)
        found.append({"id": bid, "name": name, "path": rp, "source": source})

    if custom_path:
        info, _err = inspect_browser_path(custom_path)
        if info:
            add(info["id"], info["name"], info["path"], "custom")

    for bid, name, exe in _registry_browser_paths():
        add(bid, name, exe, "registry")

    for bid, name, paths in _BROWSER_CANDIDATES:
        for p in paths:
            if p and Path(p).exists():
                add(bid, name, p, "path")

    return found


def _enum_windows(pred) -> list[int]:
    """枚举所有可见顶层窗口，pred(hwnd) 为真的返回。"""
    out = []

    def cb(hwnd, _lp):
        try:
            if pred(hwnd):
                out.append(hwnd)
        except Exception:
            pass
        return True

    user32.EnumWindows(ENUM_WND_PROC(cb), 0)
    return out


def _window_title(hwnd: int) -> str:
    n = user32.GetWindowTextLengthW(hwnd)
    if n <= 0:
        return ""
    buf = ctypes.create_unicode_buffer(n + 1)
    user32.GetWindowTextW(hwnd, buf, n + 1)
    return buf.value


def _window_pid(hwnd: int) -> int:
    pid = wintypes.DWORD()
    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
    return pid.value


def _class_name(hwnd: int) -> str:
    buf = ctypes.create_unicode_buffer(256)
    user32.GetClassNameW(hwnd, buf, 256)
    return buf.value


def _process_image(pid: int) -> str:
    """Resolve the window's real executable, including an already-running broker."""
    kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel32.OpenProcess.restype = wintypes.HANDLE
    kernel32.QueryFullProcessImageNameW.argtypes = [wintypes.HANDLE, wintypes.DWORD,
                                                   wintypes.LPWSTR, ctypes.POINTER(wintypes.DWORD)]
    kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
    handle = kernel32.OpenProcess(0x1000, False, pid)  # QUERY_LIMITED_INFORMATION
    if not handle:
        return ""
    try:
        size = wintypes.DWORD(32768)
        buf = ctypes.create_unicode_buffer(size.value)
        return buf.value if kernel32.QueryFullProcessImageNameW(handle, 0, buf, ctypes.byref(size)) else ""
    finally:
        kernel32.CloseHandle(handle)


def _startup_transparency(hwnd: int):
    """Save the window's opacity, then make even subsequent ShowWindow invisible.

    DWM cloaking rejects windows owned by another process. Layered-window opacity
    can be applied to the external browser without modifying its profile/process.
    """
    style = user32.GetWindowLongW(hwnd, -20)  # GWL_EXSTYLE
    key, alpha, flags = wintypes.DWORD(), ctypes.c_ubyte(), wintypes.DWORD()
    had_alpha = user32.GetLayeredWindowAttributes(hwnd, ctypes.byref(key), ctypes.byref(alpha), ctypes.byref(flags))
    if style & 0x00080000 and not had_alpha:
        # An existing per-pixel layered surface cannot be reconstructed by us.
        return None
    # Do not steal activation or briefly add a taskbar button during startup.
    mask = 0x00080000 | 0x08000000 | 0x00000080 | 0x00040000
    user32.SetWindowLongW(hwnd, -20, (style | mask) & ~0x00040000)
    if not user32.SetLayeredWindowAttributes(hwnd, 0, 0, 2):  # LWA_ALPHA, invisible
        user32.SetWindowLongW(hwnd, -20, style)
        return None
    return (style & mask, (key.value, alpha.value, flags.value) if had_alpha else None)


def _restore_startup_opacity(hwnd: int, saved) -> None:
    if not saved or not user32.IsWindow(hwnd):
        return
    saved_style, alpha = saved
    if saved_style & 0x00080000 and alpha:
        user32.SetLayeredWindowAttributes(hwnd, *alpha)
    # Only restore our style bits; Chrome may have updated unrelated bits.
    mask = 0x00080000 | 0x08000000 | 0x00000080 | 0x00040000
    style = user32.GetWindowLongW(hwnd, -20)
    user32.SetWindowLongW(hwnd, -20, (style & ~mask) | saved_style)


class _StartupWindowGuard:
    """Listen *before* launching, including untitled/transient startup windows.

    STARTUPINFO belongs to the launcher; Chromium may forward to a running broker.
    Zero opacity survives the broker's subsequent ShowWindow calls. Only new
    top-level windows of the chosen executable are touched. On exit all unclaimed
    windows regain their opacity, including failed or ambiguous launches.
    """
    def __init__(self, browser_path: str, existed: set[int]):
        self.expected = os.path.normcase(os.path.realpath(browser_path))
        self.existed = existed
        self.suppressed = {}
        self.events = []
        self.keep = None
        self.ready = threading.Event()
        self.thread_id = 0
        self.error = None
        self.thread = threading.Thread(target=self._run, daemon=True, name="lithub-startup-guard")

    def _on_event(self, hook, event, hwnd, obj, child, tid, stamp):
        if not hwnd or obj != 0 or child != 0 or hwnd in self.existed:
            return
        if event == 0x8001:  # EVENT_OBJECT_DESTROY; HWND values can be reused.
            self.suppressed.pop(hwnd, None)
            return
        if _class_name(hwnd) != "Chrome_WidgetWin_1":
            return
        if user32.GetWindowLongW(hwnd, GWL_STYLE) & WS_CHILD:
            return
        image = _process_image(_window_pid(hwnd))
        if not image or os.path.normcase(os.path.realpath(image)) != self.expected:
            return
        if hwnd not in self.suppressed:
            saved = _startup_transparency(hwnd)
            if saved is not None:
                self.suppressed[hwnd] = saved
            # No title or size requirement here: the first visible frame can
            # precede both. Capture evidence for the native regression test.
            self.events.append((hwnd, event, bool(user32.IsWindowVisible(hwnd)), saved is not None))
        elif event == 0x8002:
            user32.SetLayeredWindowAttributes(hwnd, 0, 0, 2)

    def _run(self):
        callback_type = ctypes.WINFUNCTYPE(None, wintypes.HANDLE, wintypes.DWORD,
                                           wintypes.HWND, wintypes.LONG, wintypes.LONG,
                                           wintypes.DWORD, wintypes.DWORD)
        user32.SetWinEventHook.argtypes = [wintypes.DWORD, wintypes.DWORD, wintypes.HMODULE,
                                          callback_type, wintypes.DWORD, wintypes.DWORD, wintypes.DWORD]
        user32.SetWinEventHook.restype = wintypes.HANDLE
        user32.UnhookWinEvent.argtypes = [wintypes.HANDLE]
        user32.PostThreadMessageW.argtypes = [wintypes.DWORD, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
        callback = callback_type(self._on_event)  # Strong reference until unhook.
        hook = None
        try:
            self.thread_id = kernel32.GetCurrentThreadId()
            msg = wintypes.MSG()
            user32.PeekMessageW(ctypes.byref(msg), None, 0, 0, 0)  # Create message queue.
            hook = user32.SetWinEventHook(0x8000, 0x8002, None, callback, 0, 0, 2)
            if not hook:
                raise RuntimeError("无法监听浏览器窗口创建事件")
            self.ready.set()
            while user32.GetMessageW(ctypes.byref(msg), None, 0, 0) > 0:
                user32.TranslateMessage(ctypes.byref(msg))
                user32.DispatchMessageW(ctypes.byref(msg))
        except Exception as exc:
            self.error = exc
        finally:
            if hook:
                user32.UnhookWinEvent(hook)
            self.ready.set()

    def __enter__(self):
        self.thread.start()
        self.ready.wait()
        if self.error:
            raise self.error
        return self

    def __exit__(self, *args):
        user32.PostThreadMessageW(self.thread_id, 0x0012, 0, 0)  # WM_QUIT
        self.thread.join()
        for hwnd, saved in self.suppressed.items():
            if hwnd != self.keep and user32.IsWindow(hwnd):
                _restore_startup_opacity(hwnd, saved)


class EmbeddedBrowser:
    """管理「用宿主窗口嵌入一个 --app 浏览器窗口」的完整生命周期。

    用法：
        eb = EmbeddedBrowser()
        eb.open("https://chat.deepseek.com/", parent_hwnd, marker="webai")
        eb.set_bounds(x, y, w, h)      # 跟随面板
        eb.hide() / eb.show()
        eb.close()                      # 摘父 + 关窗
    """

    def __init__(self, browser_id: str | None = None, custom_path: str = ""):
        """custom_path：用户在设置里手动指定的浏览器 exe（最高优先级）。

        找浏览器的顺序：自定义路径 → 注册表 App Paths → 默认安装路径。
        用户在设置里填了自定义路径，就**只**认它（填错要立刻报错，而不是
        悄悄换成别的浏览器 —— 那样用户会以为自己指对了）。
        """
        if custom_path:
            info, err = inspect_browser_path(custom_path)
            if not info:
                raise RuntimeError(f"自定义浏览器路径不可用：{err}")
            self.browsers = [info]
        else:
            self.browsers = detect_browsers()
        if not self.browsers:
            raise RuntimeError(
                "未检测到 Chrome 或 Edge。请安装其中一个，"
                "或在「设置 → AI 服务 → 网页 AI」里手动指定浏览器的程序路径。"
            )
        self.browser = None
        for b in self.browsers:
            if browser_id and b["id"] == browser_id:
                self.browser = b
                break
        if self.browser is None:
            self.browser = self.browsers[0]

        self.proc: subprocess.Popen | None = None
        self.hwnd: int | None = None
        self.parent_hwnd: int | None = None
        self.last_requested: tuple[int, int, int, int] | tuple = ()
        self._insets: tuple[int, int, int, int] = (0, 0, 0, 0)
        self._insets_at = 0.0
        self._closed = False
        self._cancel_event = threading.Event()
        self.startup_events = []
        self._startup_opacity = None
        self.input_lost_count = 0     # 巡检发现「点击/按键没落到浏览器上」的次数

    # ---------- 启动并找窗口 ----------
    def _launch(self, url: str) -> str:
        """启动一个 --app 窗口（命令会被转发给已在运行的 Chrome，因此沿用真实 profile）。"""
        args = [
            self.browser["path"],
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-features=Translate",
            f"--app={url}",
            "--window-size=900,800",
            "--window-position=-32000,-32000",   # 先放到屏幕外，避免闪一下
        ]
        try:
            startup = subprocess.STARTUPINFO()
            startup.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            startup.wShowWindow = SW_HIDE
            self.proc = subprocess.Popen(
                args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                startupinfo=startup,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            )
        except Exception as exc:
            return f"启动浏览器失败：{exc}"
        return ""

    def _find_new_window(self, existed: set[int], deadline: float,
                         stop_on_cancel: bool = True) -> int | None:
        """找出「新出现、且稳定存在」的浏览器窗口。

        为什么要等稳定：Chrome 打开 app 窗口时会先建一个占位窗口再换成真正的窗口
        （占位窗口随后被销毁）。抓得太早就会嵌到一个马上消失的窗口上，表现就是
        面板一片空白 + 侧车报「窗口已被关闭」。所以要求同一个候选连续存在 0.4 秒。
        同时要求尺寸够大，把那些 283x40 的临时/工具窗口排除掉。
        """
        last_seen = None
        stable_since = 0.0
        expected = os.path.normcase(os.path.realpath(self.browser["path"]))
        while time.time() < deadline and (not stop_on_cancel or not self._cancel_event.is_set()):
            candidates = []
            # Include hidden windows: STARTUPINFO can hide a fresh process, and a
            # brokered launch must remain discoverable after we hide it below.
            for h in _enum_windows(lambda x: True):
                if h in existed:
                    continue
                if _class_name(h) != "Chrome_WidgetWin_1":
                    continue
                image = _process_image(_window_pid(h))
                if not image or os.path.normcase(os.path.realpath(image)) != expected:
                    continue
                title = _window_title(h)
                if not title:
                    continue
                r = wintypes.RECT()
                user32.GetWindowRect(h, ctypes.byref(r))
                w, hgt = r.right - r.left, r.bottom - r.top
                if w < 400 or hgt < 300:
                    continue
                candidates.append(h)
            # Ambiguous ownership is an error, not a reason to capture the largest window.
            best = candidates[0] if len(candidates) == 1 else None
            if best is not None:
                # Do not leave the standalone window visible during the 400 ms
                # stability check. Offscreen coordinates can be clamped by Chrome;
                # CREATE_NO_WINDOW only suppresses console windows, not browser UI.
                user32.ShowWindow(best, SW_HIDE)
                if best == last_seen:
                    if time.time() - stable_since >= 0.4 and user32.IsWindow(best):
                        return best
                else:
                    last_seen, stable_since = best, time.time()
            else:
                last_seen, stable_since = None, 0.0
            time.sleep(0.05)
        return None

    def _close_orphans(self, parent_hwnd: int) -> None:
        """清掉挂在宿主窗口下面的「孤儿」浏览器窗口。

        为什么会有孤儿：如果**侧车进程曾经重启**（开发期经常），上一个进程嵌进来的
        浏览器窗口还挂在 Electron 窗口下，但新进程已经不记得它了 —— 于是界面上会
        多出一块不受控的浏览器画面，盖住 DOM（连笔记抽屉都点不到）。
        判据：宿主窗口的子窗口里，类名是 Chrome_WidgetWin_1 的只可能是我们 SetParent
        进来的（Electron 自己的渲染窗口是 Chrome_RenderWidgetHostHWND）。所以除当前
        实例外的全部当孤儿关掉。
        """
        if not parent_hwnd or not user32.IsWindow(parent_hwnd):
            return
        kids: list[int] = []

        def cb(h, _lp):
            kids.append(h)
            return True

        try:
            user32.EnumChildWindows(parent_hwnd, ENUM_WND_PROC(cb), 0)
        except Exception:
            return
        for h in kids:
            if h == self.hwnd:
                continue
            if _class_name(h) != "Chrome_WidgetWin_1":
                continue
            try:
                user32.SetParent(h, None)
                user32.MoveWindow(h, -32000, -32000, 900, 800, True)
                user32.PostMessageW(h, WM_CLOSE, 0, 0)
            except Exception:
                pass

    def open(self, url: str, parent_hwnd: int, timeout: float = 30.0,
             cancel_event=None) -> tuple[bool, str]:
        self._cancel_event = cancel_event if cancel_event is not None else threading.Event()
        if self._cancel_event.is_set():
            return False, "打开已取消"
        if sys.platform != "win32":
            return False, "仅支持 Windows"
        if self.alive() or self._closed:
            return False, "请通过会话管理器创建新的浏览器实例"

        # 清掉重启前遗留的嵌入窗口，避免一块不受控的浏览器画面盖在界面上
        self._close_orphans(parent_hwnd)

        # 记录启动前已存在的窗口，稍后用差集找出新窗口
        # Hidden windows that predate this launch belong to the user too.
        existed = set(_enum_windows(lambda h: True))

        with _StartupWindowGuard(self.browser["path"], existed) as guard:
            result = self._open_guarded(url, parent_hwnd, timeout, existed)
            if result[0]:
                guard.keep = self.hwnd
                self._startup_opacity = guard.suppressed.get(self.hwnd)
            self.startup_events = list(guard.events)
            return result

    def _open_guarded(self, url, parent_hwnd, timeout, existed):
        err = self._launch(url)
        if err:
            return False, err

        self.parent_hwnd = parent_hwnd
        # 最多试两轮：第一轮抓到的窗口有可能仍是 Chrome 的临时窗口，
        # 换掉之后真正的窗口其实已经出现了，再抓一次就行。
        for attempt in range(2):
            hwnd = self._find_new_window(existed, time.time() + (timeout if attempt == 0 else 10.0))
            if not hwnd:
                if self._cancel_event.is_set():
                    # Chrome's broker may create the app window just after cancellation.
                    # Briefly identify that window so it can be closed instead of orphaned.
                    self.hwnd = self._find_new_window(existed, time.time() + 2, stop_on_cancel=False)
                    self.close()
                    return False, "打开已取消"
                break
            self.hwnd = hwnd
            if self._cancel_event.is_set():
                self.close()
                return False, "打开已取消"
            ok, rerr = self._reparent(parent_hwnd)
            if not ok:
                self.close()
                return False, rerr
            # 挂上去之后还要确认它还活着（Chrome 换窗口就发生在这个时间窗内）
            time.sleep(0.35)
            if self.alive():
                # Chromium can defer renderer creation for a hidden window.
                # Let it initialize as an invisible child, never as a popup.
                key, alpha, flags = wintypes.DWORD(), ctypes.c_ubyte(), wintypes.DWORD()
                if (user32.GetLayeredWindowAttributes(self.hwnd, ctypes.byref(key), ctypes.byref(alpha), ctypes.byref(flags))
                        and flags.value & 2 and alpha.value == 0):
                    user32.ShowWindow(self.hwnd, 4)  # SW_SHOWNOACTIVATE; opacity stays zero.
                ready = self._wait_for_viewport()
                self.hide()
                if not ready:
                    self.close()
                    return False, "打开已取消" if self._cancel_event.is_set() else "浏览器网页视口尚未就绪，请重试"
                self._watch_parent()
                return True, ""
            self.hwnd = None
            existed.discard(hwnd)

        self.hwnd = None
        self._kill_launcher()
        return False, "浏览器窗口没有出现（可能被策略拦截）"

    def _wait_for_viewport(self) -> bool:
        # Cold profiles may create their renderer after the stable top-level
        # window. Do not expose the unmeasured browser frame in that interval.
        deadline = time.monotonic() + 3.0
        while self.alive() and not self._cancel_event.is_set():
            ready = []
            def cb(hwnd, _lp):
                if (_class_name(hwnd).startswith("Chrome_RenderWidgetHost")
                        and user32.GetWindowLongW(hwnd, GWL_STYLE) & WS_VISIBLE):
                    rect = wintypes.RECT()
                    user32.GetWindowRect(hwnd, ctypes.byref(rect))
                    if rect.right - rect.left > 100 and rect.bottom - rect.top > 100:
                        ready.append(hwnd)
                return True
            user32.EnumChildWindows(self.hwnd, ENUM_WND_PROC(cb), 0)
            if ready:
                return True
            if time.monotonic() >= deadline:
                return False
            self._cancel_event.wait(0.025)
        return False

    def _watch_parent(self) -> None:
        """后台守卫线程，每 1.5 秒做三件事：
1. 宿主窗口没了（用户关掉应用、渲染进程崩溃）→ 自己收拾干净。
           嵌入窗口是**别的进程**的子窗口，宿主窗口销毁时 Windows 不会帮我们关掉它，
           会留下一个没有父窗口的 Chrome 窗口卡在屏幕上。
2. 重新确认 z 序（见 _raise_to_top）：Electron 的渲染窗口在 resize / 重建时会重新
           压到我们上面，那之后点击和快捷键就全失效了 —— 这是「能看不能用」的故障，
           必须周期性兜住，而不是只在嵌入那一刻摆一次。
3. 巡检命中归属（input_ok），失效过就记一笔，方便排查。
        """

        def loop() -> None:
            lost = False
            while self.hwnd and not self._closed:
                time.sleep(1.5)
                if self._closed or not self.hwnd:
                    return
                if not self.alive():
                    return
                ph = self.parent_hwnd
                if ph and not user32.IsWindow(ph):
                    self.close()
                    return
                if not user32.IsWindowVisible(self.hwnd):
                    continue
                # 初次加载/换屏时 Chromium 可能晚于嵌入完成布局。
                # 前端会合并相同的 bounds，不能依赖下一次拖动来裁掉标题栏。
                previous = self._insets
                if self.last_requested and self.content_insets() != previous:
                    try:
                        self.set_bounds(*self.last_requested)
                    except RuntimeError:
                        pass
                self._raise_to_top()
                self._activate_spoof()
                if not self.input_ok():
                    if not lost:
                        lost = True
                        self.input_lost_count += 1
                else:
                    lost = False

        try:
            threading.Thread(target=loop, daemon=True, name="lithub-embed-watch").start()
        except Exception:
            pass

    # ---------- 嵌入 ----------
    def _raise_to_top(self) -> None:
        """把嵌入窗口提到「同级子窗口的最上层」。

        ⚠️ 这一步决定鼠标/键盘能不能用：Electron 自己的渲染窗口
        （Chrome_RenderWidgetHostHWND）是**覆盖整个客户区的兄弟窗口**，默认在 z 序上
        压着我们的窗口。它虽然看起来没盖住网页（Chrome 的内容走 DirectComposition
        单独合成，视觉上仍在最上），但 Win32 的**命中测试和焦点**是按 z 序走的——
        点击和按键全被 Electron 的页面截走，嵌入的浏览器就变成「只能看的一张图」：
        点击没反应、Ctrl+C / Ctrl+V 全失效、也打不了字。
        提到最上层之后点击才会落到浏览器上，浏览器拿到焦点，键盘和剪贴板快捷键才正常。
        """
        if not self.hwnd or not user32.IsWindow(self.hwnd):
            return
        try:
            user32.SetWindowPos(
                self.hwnd, 0, 0, 0, 0, 0,       # hWndInsertAfter=HWND_TOP
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
            )
        except Exception:
            pass

    def _activate_spoof(self) -> None:
        """再骗一下 Chrome：让它以为自己是「被激活的窗口」。

        为什么还得骗：嵌入窗口是**别的进程的子窗口**，Windows 永远不会真正激活它
        （WM_ACTIVATE 只发给顶层窗口）。而 Chrome 收到点击时会先看自己 active 不 active，
        不 active 就不把焦点交给网页的渲染视口 —— 实测：只修 z 序的话，点面板里
        的输入框焦点仍留在 Electron 那边（GUIThreadInfo 里 focus 还是 Electron 窗口），
        于是打字打不进去、Ctrl+C / Ctrl+V 也都不生效。
        post 一条 WM_ACTIVATE(WA_ACTIVE) 之后，Chrome 走「激活窗口」分支：
        点击会把焦点交给网页视口，键盘、输入法、剪贴板快捷键全部正常。
        """
        if not self.hwnd or not user32.IsWindow(self.hwnd):
            return
        try:
            user32.PostMessageW(self.hwnd, WM_ACTIVATE, WA_ACTIVE, 0)
        except Exception:
            pass

    def _reparent(self, parent_hwnd: int) -> tuple[bool, str]:
        """改成 WS_CHILD 并挂到宿主窗口下。

        顺序很重要：**先改样式，再 SetParent**。反过来（先挂再改）时，窗口会先以
        弹出式窗口的身份进入父窗口的子窗口链，Windows 会缓存一份非客户区尺寸，
        之后即便样式改成无边框，Chrome 内部仍按旧的非客户区排版，表现为页面四周
        留一圈黑边、顶部多出一条空白。
        """
        try:
            style = user32.GetWindowLongW(self.hwnd, GWL_STYLE)
            # 去掉弹出式/标题栏/可缩放边框，加上子窗口样式
            style = (style & ~WS_POPUP & ~WS_CAPTION & ~WS_THICKFRAME & ~WS_BORDER & ~WS_VISIBLE) | WS_CHILD
            user32.SetWindowLongW(self.hwnd, GWL_STYLE, style)
            user32.SetParent(self.hwnd, parent_hwnd)
            # 通知窗口「非客户区变了」，强制它重算客户区（少了这步边框尺寸不会刷新）
            user32.SetWindowPos(
                self.hwnd, 0, 0, 0, 0, 0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED,
            )
            user32.ShowWindow(self.hwnd, SW_HIDE)
            return True, ""
        except Exception as exc:
            return False, f"嵌入窗口失败：{exc}"

    def _measure_insets(self) -> tuple[int, int, int, int]:
        """量出「网页内容矩形」相对窗口左上角的内缩 (left, top, right, bottom)。

        为什么需要：Chrome 的 `--app` 窗口除了系统边框，还会自己画一条标题栏
        （favicon + 页面标题 + 最小化/最大化/关闭）在窗口顶部。175% 缩放下这条
        标题栏 + 边框合计约 52px，直接嵌进面板就等于面板顶上糊了一条浏览器标题栏。

        对策不是「想办法让 Chrome 别画」（那条标题栏是 Chrome 自己画的，改 Win32
        样式改不掉，实测把 WS_CAPTION 去掉、强制 RedrawWindow 之后它依然在），
        而是**把它裁掉**：把子窗口整体向左上挪 (left, top)，再用 SetWindowRgn 只
        保留内容矩形。视觉上网页就从面板左上角开始铺满，被裁掉的部分既不显示
        也不吃鼠标事件（窗口区域之外的像素对鼠标是透明的，事件落回宿主窗口）。

        量的办法：找 Chrome 里启用显示的 Chrome_RenderWidgetHostHWND（真正渲染网页的
        子窗口），它相对 app 窗口的位置就是内容内缩。找不到就返回 0（宁可不裁，
        也不要裁错方向）。
        """
        win: list[int] = []

        def cb(h, _lp):
            win.append(h)
            return True

        try:
            user32.EnumChildWindows(self.hwnd, ENUM_WND_PROC(cb), 0)
        except Exception:
            return (0, 0, 0, 0)

        wr = wintypes.RECT()
        user32.GetWindowRect(self.hwnd, ctypes.byref(wr))
        ww, wh = wr.right - wr.left, wr.bottom - wr.top
        if ww <= 0 or wh <= 0:
            return (0, 0, 0, 0)

        best = None
        for h in win:
            # IsWindowVisible 也检查祖先：浏览器在完成定位之前是隐藏的，
            # 此时所有子窗口都会返回 False。只检查子窗口自己的显示位，
            # 既能在发布前测量，又不会选中 Chromium 留下的隐藏旧视口。
            if not (user32.GetWindowLongW(h, GWL_STYLE) & WS_VISIBLE):
                continue
            if not _class_name(h).startswith("Chrome_RenderWidgetHost"):
                continue
            r = wintypes.RECT()
            user32.GetWindowRect(h, ctypes.byref(r))
            cw, ch = r.right - r.left, r.bottom - r.top
            # 只认「差不多铺满窗口」的那一个（Chrome 会同时建几个隐藏/1x1 的）
            if cw < ww * 0.5 or ch < wh * 0.5:
                continue
            best = (r.left - wr.left, r.top - wr.top, wr.right - r.right, wr.bottom - r.bottom)
            break
        if best is None:
            return (0, 0, 0, 0)
        # 防守：内缩不可能超过窗口一半，否则说明量到的不是内容窗口
        l, t, r2, b = (max(0, int(v)) for v in best)
        if l + t >= ww or t + b >= wh or l + r2 >= ww:
            return (0, 0, 0, 0)
        return (l, t, r2, b)

    def content_insets(self) -> tuple[int, int, int, int]:
        """带缓存的 _measure_insets（拖动窗口时每帧都量太重）。

        量到 0 说明窗口可能还没排版完（刚嵌入的头几百毫秒），这种情况不缓存，
        下次调用再量——否则会一直按「没有内缩」去摆，标题栏就裁不掉。
        """
        now = time.time()
        if self._insets != (0, 0, 0, 0) and now - self._insets_at < 3.0:
            return self._insets
        if now - self._insets_at < 0.2:
            return self._insets
        self._insets = self._measure_insets()
        self._insets_at = now
        return self._insets

    def set_bounds(self, x: int, y: int, w: int, h: int) -> None:
        """把**网页内容**摆到父窗口客户区的 (x, y, w, h)。

        单位是**物理像素**（因为本进程已设为 DPI 感知）。前端那边是
        CSS 像素 × devicePixelRatio 得到的物理像素，两边才能对上。

        窗口本身会比内容大一圈（左侧内缩 + 顶部 Chrome 标题栏 + 右边框/下边框），
        再靠 SetWindowRgn 裁掉那圈，只留内容区。
        """
        if not self.hwnd or not user32.IsWindow(self.hwnd):
            raise RuntimeError("浏览器窗口已关闭")
        try:
            x, y = int(x), int(y)
            w, h = max(1, int(w)), max(1, int(h))
            self.last_requested = (x, y, w, h)
            l, t, r, b = self.content_insets()
            for attempt in range(3):
                win_x, win_y = x - l, y - t
                win_w, win_h = w + l + r, h + t + b
                if not user32.MoveWindow(self.hwnd, win_x, win_y, win_w, win_h, True):
                    raise RuntimeError("Windows 拒绝更新浏览器窗口位置")
                # 首次 MoveWindow 后 Chromium 可能才补上自己的边框布局。
                # 用实际内容窗口再校准，避免标题栏消失后仍留下侧边空隙。
                measured = self._measure_insets()
                if measured == (l, t, r, b) or attempt == 2:
                    break
                l, t, r, b = measured
                self._insets = measured
                self._insets_at = time.time()
            rgn = gdi32.CreateRectRgn(l, t, l + w, t + h)
            if rgn:
                # SetWindowRgn 接管 rgn 所有权，不要自己 DeleteObject。
                # 即使内缩归零也更新区域，避免保留上一次布局的旧裁剪。
                if not user32.SetWindowRgn(self.hwnd, rgn, False):
                    try:
                        gdi32.DeleteObject(rgn)
                    except Exception:
                        pass
            # 每次摆位置都重申一次「最上层」+「以为自己被激活」：
            # 窗口尺寸变化 / Electron 渲染窗口重建时这两件事都会被重置，
            # 一旦重置，面板就会退回「只能看、点不动、快捷键全失效」的状态。
            self._raise_to_top()
            self._activate_spoof()
        except Exception as exc:
            raise RuntimeError(f"调整浏览器窗口失败：{exc}") from exc

    def diag(self) -> dict:
        """返回几何诊断信息：把「我要的位置」和「Windows 实际给的」都摊开。

        排查嵌入位置问题时唯一可靠的证据来源：如果实际值 ≈ 期望值 × 系统缩放比，
        就说明坐标被 DPI 虚拟化二次缩放了（进程不是 DPI 感知的）。
        """
        info: dict = {
            "dpi_awareness": DPI_AWARENESS,
            "hwnd": self.hwnd,
            "parent_hwnd": self.parent_hwnd,
            "alive": self.alive(),
            "requested": list(self.last_requested or []),
            "content_insets": list(self._insets),
            "input_lost_count": self.input_lost_count,
            "startup_suppressed_windows": len(self.startup_events),
        }
        if not self.alive():
            return info
        try:
            r = wintypes.RECT()
            user32.GetWindowRect(self.hwnd, ctypes.byref(r))
            pr = wintypes.RECT()
            has_parent = bool(self.parent_hwnd and user32.IsWindow(self.parent_hwnd))
            if has_parent:
                user32.GetWindowRect(self.parent_hwnd, ctypes.byref(pr))
            info["window_rect"] = [r.left, r.top, r.right - r.left, r.bottom - r.top]
            info["parent_rect"] = [pr.left, pr.top, pr.right - pr.left, pr.bottom - pr.top] if has_parent else []
            info["rel_to_parent"] = [r.left - pr.left, r.top - pr.top, r.right - r.left, r.bottom - r.top] if has_parent else []
            client = wintypes.RECT()
            user32.GetClientRect(self.hwnd, ctypes.byref(client))
            info["client_size"] = [client.right, client.bottom]
            info["window_visible"] = bool(user32.IsWindowVisible(self.hwnd))
            info["input_ok"] = self.input_ok()
            if has_parent:
                pc = wintypes.RECT()
                user32.GetClientRect(self.parent_hwnd, ctypes.byref(pc))
                info["parent_client_size"] = [pc.right, pc.bottom]
        except Exception as exc:
            info["error"] = str(exc)
        return info

    def hide(self) -> None:
        if self.hwnd and user32.IsWindow(self.hwnd):
            try:
                user32.ShowWindow(self.hwnd, SW_HIDE)
            except Exception:
                pass

    def show(self) -> None:
        if self.hwnd and user32.IsWindow(self.hwnd):
            try:
                user32.ShowWindow(self.hwnd, SW_SHOW)
                self._raise_to_top()
                self._activate_spoof()
                _restore_startup_opacity(self.hwnd, self._startup_opacity)
                self._startup_opacity = None
            except Exception:
                pass

    def alive(self) -> bool:
        return bool(self.hwnd and user32.IsWindow(self.hwnd))

    def input_ok(self) -> bool:
        """鼠标/键盘是不是真能进到网页里：看嵌在面板矩形里的窗口是不是浏览器自己。

        如果 WindowFromPoint 拿到的是宿主（Electron）的渲染窗口，说明 z 序被打回去了，
        点击和快捷键都会失效——这是最难自己发现的一类故障，所以留一个可自检的方法。
        """
        if not self.alive() or not user32.IsWindow(self.parent_hwnd or 0):
            return False
        try:
            req = self.last_requested or ()
            if len(req) != 4:
                return False
            x, y, w, h = req
            # 面板矩形是「父窗口客户区」坐标；WindowFromPoint 要屏幕坐标，先换算
            pt = wintypes.POINT(int(x + max(1, w // 2)), int(y + max(1, h // 2)))
            if not user32.ClientToScreen(self.parent_hwnd, ctypes.byref(pt)):
                return False
            hit = user32.WindowFromPoint(pt)
            cur, depth = hit, 0
            while cur and depth < 8:
                if cur == self.hwnd:
                    return True
                cur = user32.GetParent(cur)
                depth += 1
            return False
        except Exception:
            return False
        return False

    def current_title(self) -> str:
        return _window_title(self.hwnd) if self.alive() else ""

    # ---------- 清理 ----------
    def _kill_launcher(self) -> None:
        if self.proc:
            try:
                self.proc.terminate()
            except Exception:
                pass
            self.proc = None

    def close(self) -> None:
        """先摘父（恢复成顶层窗口），再发 WM_CLOSE。

        为什么不直接 Kill：Chrome 是多进程的，杀掉启动器不影响已转发的窗口；
        而且直接关可能让 Chrome 报「异常关闭」。先摘父再温和关闭最稳。
        """
        self._closed = True
        hwnd = self.hwnd
        if hwnd and user32.IsWindow(hwnd):
            user32.ShowWindow(hwnd, SW_HIDE)
            try:
                user32.SetParent(hwnd, None)
            except Exception:
                pass
            try:
                # 把窗口挪到屏幕外再关，避免用户看到关闭动画闪一下
                user32.MoveWindow(hwnd, -32000, -32000, 900, 800, True)
                user32.PostMessageW(hwnd, WM_CLOSE, 0, 0)
            except Exception:
                pass
            deadline = time.monotonic() + 1.0
            while user32.IsWindow(hwnd) and time.monotonic() < deadline:
                time.sleep(0.025)
            if user32.IsWindow(hwnd):
                raise RuntimeError("浏览器窗口尚未关闭，请检查是否有未确认的弹窗后重试")
        self.hwnd = None
        self._startup_opacity = None
        self._kill_launcher()
        self.parent_hwnd = None
