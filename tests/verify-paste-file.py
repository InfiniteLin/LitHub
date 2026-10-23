"""端到端验证：面板头「复制 PDF」→ 在网页 AI 输入框里 Ctrl+V → 粘贴进来的是那个 PDF 文件。

为什么不用 CDP：这里要验的是**真实剪贴板 + 真实键盘输入**进入原生子窗口的完整链路。
CDP 的 Input.dispatchKeyEvent 不经过系统剪贴板，测不出「复制的是文件还是文本」。
所以用 Windows 的 SendInput 真按键，并用一个探针页面把结果写进窗口标题，
再从外部用 GetWindowTextW 读回来（不依赖 Chromium 的任何调试接口）。

前置：应用必须以 `--remote-debugging-port=9333` 启动、sidecar 在 8130；
      这里有文献库里的任意一篇 PDF 就行（脚本自己挑第一篇）。

用法：python tests/verify-paste-file.py
"""
from __future__ import annotations

import ctypes
import http.server
import json
import os
import socketserver
import sys
import threading
import time
import urllib.request
from ctypes import wintypes
from pathlib import Path

API = "http://127.0.0.1:8130"
CDP = "http://127.0.0.1:9333"
FIXTURES = Path(__file__).parent / "fixtures"

# 输出里有中文 + 网页标题里的零宽字符（\u200b），Windows 控制台默认 GBK 会直接
# UnicodeEncodeError 把测试打断。强制 UTF-8，并把不可见字符换掉。
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


def _safe(s: str) -> str:
    return "".join(c if (c.isprintable() and c not in "\u200b\u200c\u200d\ufeff") else "?" for c in str(s))


# ---------------- Win32 ----------------

u = ctypes.windll.user32


class POINT(ctypes.Structure):
    _fields_ = [("x", wintypes.LONG), ("y", wintypes.LONG)]


class MOUSEINPUT(ctypes.Structure):
    _fields_ = [("dx", wintypes.LONG), ("dy", wintypes.LONG), ("mouseData", wintypes.DWORD),
                ("dwFlags", wintypes.DWORD), ("time", wintypes.DWORD), ("dwExtraInfo", ctypes.c_void_p)]


class KEYBDINPUT(ctypes.Structure):
    _fields_ = [("wVk", wintypes.WORD), ("wScan", wintypes.WORD), ("dwFlags", wintypes.DWORD),
                ("time", wintypes.DWORD), ("dwExtraInfo", ctypes.c_void_p)]


class INPUT(ctypes.Structure):
    class _U(ctypes.Union):
        _fields_ = [("mi", MOUSEINPUT), ("ki", KEYBDINPUT)]
    _anonymous_ = ("u",)
    _fields_ = [("type", wintypes.DWORD), ("u", _U)]


u.SendInput.argtypes = [ctypes.c_uint, ctypes.c_void_p, ctypes.c_int]
u.SendInput.restype = ctypes.c_uint
u.SetCursorPos.argtypes = [ctypes.c_int, ctypes.c_int]
u.SetCursorPos.restype = ctypes.c_int
u.mouse_event.argtypes = [wintypes.DWORD, wintypes.DWORD, wintypes.DWORD, wintypes.DWORD, ctypes.c_void_p]
u.GetWindowRect.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.RECT)]
u.GetWindowRect.restype = ctypes.c_int
u.GetWindowTextW.argtypes = [wintypes.HWND, ctypes.c_wchar_p, ctypes.c_int]
u.GetWindowTextW.restype = ctypes.c_int
# POINT 是按值传参的：写成 [c_void_p] + byref 会永远返回 0，看着像「窗口被盖住」
u.WindowFromPoint.argtypes = [POINT]
u.WindowFromPoint.restype = wintypes.HWND
u.SetForegroundWindow.argtypes = [wintypes.HWND]
u.SetForegroundWindow.restype = ctypes.c_int
u.ShowWindow.argtypes = [wintypes.HWND, ctypes.c_int]
u.ShowWindow.restype = ctypes.c_int
u.BringWindowToTop.argtypes = [wintypes.HWND]
u.BringWindowToTop.restype = ctypes.c_int
u.AttachThreadInput.argtypes = [wintypes.DWORD, wintypes.DWORD, ctypes.c_int]
u.GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)]
u.GetWindowThreadProcessId.restype = wintypes.DWORD
u.keybd_event.argtypes = [wintypes.BYTE, wintypes.BYTE, wintypes.DWORD, ctypes.c_void_p]
u.GetForegroundWindow.restype = wintypes.HWND
u.SetActiveWindow.argtypes = [wintypes.HWND]
u.SetActiveWindow.restype = wintypes.HWND
u.EnumWindows.argtypes = [ctypes.c_void_p, wintypes.LPARAM]
u.GetClassNameW.argtypes = [wintypes.HWND, ctypes.c_wchar_p, ctypes.c_int]
u.GetClassNameW.restype = ctypes.c_int

MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP = 0x0002, 0x0004
KEYEVENTF_KEYUP = 0x0002
VK_CONTROL, VK_V = 0x11, 0x56


def hwnd_int(x) -> int:
    if x is None:
        return 0
    if isinstance(x, int):
        return x
    v = ctypes.cast(x, ctypes.c_void_p).value
    return int(v or 0)


def window_title(hwnd) -> str:
    buf = ctypes.create_unicode_buffer(1024)
    u.GetWindowTextW(hwnd, buf, 1024)
    return buf.value


def window_class(hwnd) -> str:
    buf = ctypes.create_unicode_buffer(256)
    u.GetClassNameW(hwnd, buf, 256)
    return buf.value


def find_app_window() -> int:
    """找到应用主窗口（Electron 的顶层窗口，标题里带「文枢」）。"""
    found = []

    @ctypes.WINFUNCTYPE(ctypes.c_int, wintypes.HWND, wintypes.LPARAM)
    def cb(h, _):
        if window_class(h) == "Chrome_WidgetWin_1" and "文枢" in window_title(h):
            found.append(hwnd_int(h))
        return 1

    u.EnumWindows(cb, 0)
    return found[0] if found else 0


def force_foreground(hwnd: int, tries: int = 12) -> bool:
    """把窗口提回前台，成功返回 True。

    SetForegroundWindow 经常被系统拒绝（前台锁 / 另一个全屏窗口占着前台），
    用「ALT 抖动 + AttachThreadInput」绕开，并重试几次 —— 因为这个测试里**前台是谁
    决定了按键落到哪**，前台没抢到，后面的 Ctrl+V 全是假阴性。
    """
    target = wintypes.HWND(hwnd)
    for _ in range(tries):
        if hwnd_int(u.GetForegroundWindow()) == hwnd:
            return True
        fg = u.GetForegroundWindow()
        tid_fg = u.GetWindowThreadProcessId(fg, None) if fg else 0
        tid_me = u.GetWindowThreadProcessId(target, None)
        u.keybd_event(0x12, 0, 0, None)      # ALT down
        u.keybd_event(0x12, 0, 2, None)      # ALT up
        if tid_fg and tid_me and tid_fg != tid_me:
            u.AttachThreadInput(tid_fg, tid_me, 1)
        try:
            u.ShowWindow(target, 9)          # SW_RESTORE
            u.BringWindowToTop(target)
            u.SetForegroundWindow(target)
            u.SetActiveWindow(target)
        finally:
            if tid_fg and tid_me and tid_fg != tid_me:
                u.AttachThreadInput(tid_fg, tid_me, 0)
        time.sleep(0.35)
    return hwnd_int(u.GetForegroundWindow()) == hwnd


def click(x: int, y: int) -> None:
    u.SetCursorPos(x, y)
    time.sleep(0.25)
    u.mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, None)
    time.sleep(0.08)
    u.mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, None)
    time.sleep(0.6)


class GUITHREADINFO(ctypes.Structure):
    _fields_ = [("cbSize", wintypes.DWORD),
                ("flags", wintypes.DWORD),
                ("hwndActive", wintypes.HWND),
                ("hwndFocus", wintypes.HWND),
                ("hwndCapture", wintypes.HWND),
                ("hwndMenuOwner", wintypes.HWND),
                ("hwndMoveSize", wintypes.HWND),
                ("hwndCaret", wintypes.HWND),
                ("rcCaret", wintypes.RECT)]


u.GetGUIThreadInfo.argtypes = [wintypes.DWORD, ctypes.POINTER(GUITHREADINFO)]
u.GetGUIThreadInfo.restype = ctypes.c_int


def focus_inside(embedded_hwnd: int) -> tuple[bool, int]:
    """键盘焦点是不是真的在被嵌窗口的输入队列里。

    注意不能只看 GetForegroundWindow()：前台是 Electron 的顶层窗口，而真正接收
    键盘的是 Chrome 自己线程里的焦点窗口。两者可以同时存在（跨进程子窗口 + 我们
    伪造的 WM_ACTIVATE 就是这么工作的），所以必须按 Chrome 的线程 id 查 GUI 状态。
    """
    tid = u.GetWindowThreadProcessId(wintypes.HWND(embedded_hwnd), None)
    if not tid:
        return False, 0
    info = GUITHREADINFO()
    info.cbSize = ctypes.sizeof(GUITHREADINFO)
    if not u.GetGUIThreadInfo(tid, ctypes.byref(info)):
        return False, 0
    focus = hwnd_int(info.hwndFocus)
    return _belongs_to(focus, embedded_hwnd), focus


def click_until_focused(x: int, y: int, embedded_hwnd: int, tries: int = 4):
    """点进网页输入框，直到键盘焦点真的进了 Chrome 的输入队列。

    这一步经常第一次点不进去（点击落在 Electron 渲染窗口上时，焦点仍在那边），
    所以必须重试 + 断言，否则后面的 Ctrl+V 只是验证了「Electron 页面收不到粘贴」。
    """
    last_focus = 0
    for _ in range(tries):
        click(x, y)
        for _ in range(6):
            ok, focus = focus_inside(embedded_hwnd)
            if ok:
                return True, focus, _
            last_focus = focus
            time.sleep(0.25)
    return False, last_focus, tries


def _key(vk: int, up: bool = False) -> None:
    inp = INPUT(type=1)  # INPUT_KEYBOARD
    inp.ki = KEYBDINPUT(wVk=vk, wScan=0, dwFlags=KEYEVENTF_KEYUP if up else 0,
                        time=0, dwExtraInfo=None)
    u.SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT))
    time.sleep(0.06)


def ctrl_v() -> None:
    _key(VK_CONTROL)
    _key(VK_V)
    _key(VK_V, True)
    _key(VK_CONTROL, True)


# ---------------- HTTP ----------------

def api(path: str, method: str = "GET", payload: dict | None = None):
    data = json.dumps(payload).encode() if payload is not None else None
    headers = {"Content-Type": "application/json"} if data else {}
    req = urllib.request.Request(API + path, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode("utf-8"))


def cdp_targets() -> list[dict]:
    """列出 CDP 目标（只用来确认应用开着，不参与按键验证）。"""
    return json.loads(urllib.request.urlopen(CDP + "/json/list", timeout=20).read().decode())


# ---------------- 静态探针页 ----------------

class _Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(FIXTURES), **kw)

    def log_message(self, *a):  # 静音
        pass


def serve_fixtures() -> tuple[socketserver.TCPServer, int]:
    srv = socketserver.TCPServer(("127.0.0.1", 0), _Handler)
    port = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, port


# ---------------- 测试 ----------------

def main() -> int:
    results: list[tuple[str, bool, str]] = []

    def check(name: str, ok: bool, detail: str = "") -> None:
        results.append((name, ok, detail))
        line = f"{'PASS' if ok else 'FAIL'}  {name}" + (f"  — {_safe(detail)}" if detail else "")
        print(line, flush=True)

    # 0. 环境
    try:
        st = api("/api/browser/status")
    except Exception as exc:
        print(f"FAIL  侧车没起来（{exc}）")
        return 1
    check("sidecar 可达", True, f"dpi_awareness={st.get('dpi_awareness')}")

    parent = find_app_window()
    check("找到应用主窗口", bool(parent), f"hwnd={parent}")
    if not parent:
        return 1

    # 1. 挑一篇有 PDF 的文献
    papers = api_papers_pick()
    check("找到可测试的文献", bool(papers), papers.get("title", "") if papers else "无")
    if not papers:
        return 1

    # 2. 起探针页服务
    srv, port = serve_fixtures()
    probe_url = f"http://127.0.0.1:{port}/paste-probe.html"
    check("探针页可访问", urllib.request.urlopen(probe_url, timeout=10).status == 200, probe_url)

    # 3. 嵌进去
    force_foreground(parent)
    time.sleep(0.8)
    emb = api("/api/browser/embed", "POST", {
        "url": probe_url, "browser_id": "chrome", "parent_hwnd": parent,
        "x": 747, "y": 137, "width": 635, "height": 745,
    })
    check("网页已嵌入面板", bool(emb.get("ok")), emb.get("title", ""))

    api("/api/browser/bounds", "POST",
        {"x": 747, "y": 137, "width": 635, "height": 745, "visible": True, "seq": 900001})
    time.sleep(2.0)

    st = api("/api/browser/status")
    hwnd = st.get("hwnd")
    check("嵌入窗口活着且可输入", bool(st.get("alive")) and bool(st.get("input_ok")),
          f"input_ok={st.get('input_ok')} input_lost={st.get('input_lost_count')}")

    rc = wintypes.RECT()
    u.GetWindowRect(wintypes.HWND(hwnd), ctypes.byref(rc))
    L, T, R, B = rc.left, rc.top, rc.right, rc.bottom
    check("嵌入窗口在可见屏幕范围内", R > L and B > T and L > -10000,
          f"rect=({L},{T},{R},{B})")

    # 4. 点击 → 前台 + 焦点 + 命中测试（假阴性闸门，比断言本身更重要）
    #    顺序很重要：**先点**再断言前台。点击本身就会把宿主窗口提到前台，
    #    在点之前断言「前台是不是宿主」在有多窗口的机器上必然误报。
    pt = POINT(L + (R - L) // 2, T + 120)
    hit = hwnd_int(u.WindowFromPoint(pt))
    check("命中测试落到嵌入窗口里", hit != 0 and _belongs_to(hit, hwnd),
          f"hit={hit} expected_under={hwnd} class={window_class(wintypes.HWND(hit)) if hit else None}")

    # 点进输入框，直到键盘焦点真的进了 Chrome 的输入队列。
    # 第一次点经常只把窗口提到前台、焦点还留在 Electron 页面（z 序/激活的固有竞争），
    # 这时后面的 Ctrl+V 只会证明「Electron 页面没收到粘贴」，是纯假阴性。
    focused, focus_hwnd, attempts = click_until_focused(pt.x, pt.y, hwnd)
    fg = hwnd_int(u.GetForegroundWindow())
    check("点击后宿主窗口成为前台", fg == parent, f"foreground={fg} expected={parent}")
    check("键盘焦点真的进了网页（不是停在 Electron 页面）", focused,
          f"focus={focus_hwnd} attempts={attempts + 1}")
    check("点击后页面仍是探针页", window_title(hwnd).startswith("paste-probe"), window_title(hwnd))
    if not focused:
        force_foreground(parent)
        time.sleep(0.6)
        print("       （焦点没拿到，下面的按键结果不可信）")

    copied = api(f"/api/papers/{papers['id']}/copy-file?kind=original", "POST")
    check("复制 PDF 接口成功（不落盘）", bool(copied.get("ok")), copied.get("name", ""))

    ctrl_v()
    time.sleep(2.5)
    title = window_title(hwnd)
    pasted = title[len("PASTED-FILES:"):] if title.startswith("PASTED-FILES:") else ""
    # 期望文件名 = 复制接口返回的那个（论文标题 + .pdf），不是库里的内部 ID
    expected = copied.get("name") or ""
    check("Ctrl+V 把 PDF 文件粘进了网页（CF_HDROP 生效，不是文本）",
          bool(pasted), title)
    check("粘进来的文件名与「复制 PDF」给的一致",
          bool(expected) and pasted == expected, f"pasted={pasted} expected={expected}")
    check("粘进来的不是内部 ID 文件名",
          bool(pasted) and not pasted.startswith(papers["id"] + ".pdf"), pasted)

    # 6. 下载文件夹不能有新增
    downloads = Path(os.environ.get("USERPROFILE", "")) / "Downloads"
    pdfs = {p.name for p in downloads.glob("*.pdf")} if downloads.is_dir() else set()

    # 7. 清理
    try:
        api("/api/browser/close", "POST")
    except Exception:
        pass
    srv.shutdown()
    srv.server_close()

    pdfs_after = {p.name for p in downloads.glob("*.pdf")} if downloads.is_dir() else set()
    check("没有往下载文件夹写文件", pdfs_after == pdfs,
          ", ".join(sorted(pdfs_after - pdfs)) or "无新增")

    print()
    ok = all(r[1] for r in results)
    print("全部通过" if ok else "存在失败项")
    return 0 if ok else 1


def _belongs_to(hit: int, target: int) -> bool:
    cur = wintypes.HWND(hit)
    for _ in range(12):
        if not cur:
            return False
        if hwnd_int(cur) == target:
            return True
        cur = u.GetParent(cur)
    return False


def api_papers_pick():
    """挑一篇页数够、PDF 还在的文献。"""
    papers = api("/api/papers")
    for p in papers:
        if p.get("pages", 0) > 5:
            return p
    return papers[0] if papers else None


if __name__ == "__main__":
    sys.exit(main())
