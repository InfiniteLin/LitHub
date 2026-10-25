"""Windows smoke test: local blank page in an offscreen, test-owned native host.
Does not load an AI website or access LitHub's personal library.
"""
import ctypes
from ctypes import wintypes
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
import subprocess
import tempfile
import threading
import time
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from browser_session import BrowserSession
from browser_embed import (EmbeddedBrowser, _process_image, _window_pid, user32, gdi32,
                           ENUM_WND_PROC, _class_name, GWL_STYLE, WS_VISIBLE)


class Page(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(b'<title>LitHub native regression</title><p>Local native window test</p>')
    def log_message(self, *args): pass


user32.CreateWindowExW.argtypes = [wintypes.DWORD, wintypes.LPCWSTR, wintypes.LPCWSTR,
                                  wintypes.DWORD, ctypes.c_int, ctypes.c_int, ctypes.c_int,
                                  ctypes.c_int, wintypes.HWND, wintypes.HMENU,
                                  wintypes.HINSTANCE, ctypes.c_void_p]
user32.CreateWindowExW.restype = wintypes.HWND
user32.DestroyWindow.argtypes = [wintypes.HWND]
server = ThreadingHTTPServer(('127.0.0.1', 0), Page)
threading.Thread(target=server.serve_forever, daemon=True).start()
host = user32.CreateWindowExW(0, 'STATIC', 'LitHub test host', 0x10CF0000,
                             -32000, -32000, 1100, 800, None, None, None, None)
assert host, 'test host created'
session = BrowserSession()
browsers = []
profile = tempfile.TemporaryDirectory(prefix='lithub-native-', ignore_cleanup_errors=True)

def assert_zero_opacity(hwnd):
    key, alpha, flags = wintypes.DWORD(), ctypes.c_ubyte(), wintypes.DWORD()
    assert user32.GetLayeredWindowAttributes(hwnd, ctypes.byref(key), ctypes.byref(alpha), ctypes.byref(flags))
    assert flags.value & 2 and alpha.value == 0, 'startup window cannot paint a visible frame'

class HiddenStartupBrowser(EmbeddedBrowser):
    def _launch(self, url):
        # Reproduce a broker ignoring SW_HIDE/offscreen startup hints. This test
        # uses an isolated profile and deliberately requests an onscreen window.
        self.proc = subprocess.Popen([self.browser['path'], f'--user-data-dir={profile.name}',
            '--no-first-run', '--no-default-browser-check', '--disable-background-mode',
            '--window-position=80,80', '--window-size=900,800', f'--app={url}'],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return ''

    def _reparent(self, parent_hwnd):
        assert_zero_opacity(self.hwnd)
        assert not user32.IsWindowVisible(self.hwnd), 'standalone window hidden before embedding'
        return super()._reparent(parent_hwnd)

def factory():
    browser = HiddenStartupBrowser()
    browsers.append(browser)
    return browser

def assert_content_rect(browser, x, y, width, height):
    children = []
    def cb(hwnd, data):
        if _class_name(hwnd).startswith('Chrome_RenderWidgetHost') and user32.GetWindowLongW(hwnd, GWL_STYLE) & WS_VISIBLE:
            rect = wintypes.RECT()
            user32.GetWindowRect(hwnd, ctypes.byref(rect))
            children.append((rect.left, rect.top, rect.right-rect.left, rect.bottom-rect.top))
        return True
    user32.EnumChildWindows(browser.hwnd, ENUM_WND_PROC(cb), 0)
    point = wintypes.POINT(x, y)
    user32.ClientToScreen(host, ctypes.byref(point))
    expected = (point.x, point.y, width, height)
    assert any(all(abs(a-b) <= 1 for a,b in zip(rect,expected)) for rect in children), (expected, children, browser.diag())
    region = gdi32.CreateRectRgn(0, 0, 0, 0)
    try:
        assert user32.GetWindowRgn(browser.hwnd, region) != 0
        rect = wintypes.RECT()
        gdi32.GetRgnBox(region, ctypes.byref(rect))
        left, top, _, _ = browser.content_insets()
        assert (rect.left, rect.top, rect.right, rect.bottom) == (left, top, left+width, top+height)
    finally:
        gdi32.DeleteObject(region)

try:
    url = f'http://127.0.0.1:{server.server_port}/?test={uuid.uuid4().hex}'
    result = session.open(factory, url, host, (20, 30, 640, 480))
    assert result['ok'], result
    browser = browsers[-1]
    assert any(e[0] == browser.hwnd and e[1] == 0x8000 and e[3] for e in browser.startup_events), browser.startup_events
    assert_zero_opacity(browser.hwnd)
    print('PASS cold launch intercepted at window creation, invisible before embedding')
    assert browser.alive()
    assert Path(_process_image(_window_pid(browser.hwnd))).resolve() == Path(browser.browser['path']).resolve()
    assert not user32.IsWindowVisible(browser.hwnd), 'published browser remains hidden'
    print('PASS real browser executable identity, reparent and initial hiding')
    assert_content_rect(browser,20,30,640,480)
    print('PASS hidden browser titlebar is cropped and web content fills requested rectangle')
    assert session.bounds(x=20, y=30, width=640, height=480, visible=True,
                          seq=1, session_id=result['session_id'])['ok']
    assert list(browser.last_requested) == [20, 30, 640, 480]
    assert browser._startup_opacity is None
    assert not user32.GetWindowLongW(browser.hwnd, -20) & 0x80000, 'panel opacity restored after showing'
    assert session.bounds(x=40,y=60,width=760,height=520,visible=True,
                          seq=2,session_id=result['session_id'])['ok']
    assert_content_rect(browser,40,60,760,520)
    print('PASS native titlebar cropping follows panel resize')
    assert session.bounds(visible=False, seq=3, session_id=result['session_id'])['ok']
    assert not user32.IsWindowVisible(browser.hwnd)
    print('PASS real bounds update and hide')
    # Keep a real browser process alive while another launcher forwards to it.
    warm = BrowserSession()
    warm_host = user32.CreateWindowExW(0, 'STATIC', 'LitHub warm test host', 0x10CF0000,
                                     -32000, -32000, 1100, 800, None, None, None, None)
    assert warm_host
    try:
        result2 = warm.open(factory, url + '&warm=1', warm_host, (20, 30, 640, 480))
        assert result2['ok'], result2
        browser2 = browsers[-1]
        assert _window_pid(browser2.hwnd) == _window_pid(browser.hwnd), 'warm launch uses existing browser broker'
        assert any(e[0] == browser2.hwnd and e[1] == 0x8000 and e[3] for e in browser2.startup_events), browser2.startup_events
        assert_zero_opacity(browser2.hwnd)
        assert not user32.GetWindowLongW(browser.hwnd, -20) & 0x80000, 'existing browser remains untouched'
        print('PASS brokered warm launch stays transparent; existing window untouched')
    finally:
        warm.close()
        user32.DestroyWindow(warm_host)
    hwnd = browser.hwnd
    assert session.close()['ok']
    assert not user32.IsWindow(hwnd), 'closed window actually destroyed'
    print('PASS native close waits for destruction')
    # Cancel a real browser launch/search, not a mocked asynchronous function.
    outcome = []
    thread = threading.Thread(target=lambda: outcome.append(session.open(factory, url + '&cancel=1', host, (0, 0, 400, 500))))
    thread.start()
    time.sleep(0.1)
    closed = []
    closer = threading.Thread(target=lambda: closed.append(session.close()))
    closer.start()
    deadline = time.monotonic() + 10
    msg = wintypes.MSG()
    # Keep the native host responsive, just like Electron's UI thread.
    while (thread.is_alive() or closer.is_alive()) and time.monotonic() < deadline:
        while user32.PeekMessageW(ctypes.byref(msg), None, 0, 0, 1):
            user32.TranslateMessage(ctypes.byref(msg))
            user32.DispatchMessageW(ctypes.byref(msg))
        time.sleep(0.01)
    assert closed and closed[0]['ok'], closed
    assert not thread.is_alive()
    assert outcome and outcome[0].get('cancelled'), outcome
    assert not session.status()['active']
    print('PASS real pending launch cancelled and cleaned')
finally:
    session.close()
    user32.DestroyWindow(host)
    server.shutdown()
    profile.cleanup()
