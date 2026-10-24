"""Windows smoke test: local blank page in an offscreen, test-owned native host.
Does not load an AI website or access LitHub's personal library.
"""
import ctypes
from ctypes import wintypes
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
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
host = user32.CreateWindowExW(0, 'STATIC', 'LitHub test host', 0x00CF0000,
                             -32000, -32000, 1100, 800, None, None, None, None)
assert host, 'test host created'
session = BrowserSession()
browsers = []
def factory():
    browser = EmbeddedBrowser()
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
    assert browser.alive()
    assert Path(_process_image(_window_pid(browser.hwnd))).resolve() == Path(browser.browser['path']).resolve()
    assert not user32.IsWindowVisible(browser.hwnd), 'published browser remains hidden'
    print('PASS real browser executable identity, reparent and initial hiding')
    assert_content_rect(browser,20,30,640,480)
    print('PASS hidden browser titlebar is cropped and web content fills requested rectangle')
    assert session.bounds(x=20, y=30, width=640, height=480, visible=True,
                          seq=1, session_id=result['session_id'])['ok']
    assert list(browser.last_requested) == [20, 30, 640, 480]
    assert session.bounds(x=40,y=60,width=760,height=520,visible=True,
                          seq=2,session_id=result['session_id'])['ok']
    assert_content_rect(browser,40,60,760,520)
    print('PASS native titlebar cropping follows panel resize')
    assert session.bounds(visible=False, seq=3, session_id=result['session_id'])['ok']
    assert not user32.IsWindowVisible(browser.hwnd)
    print('PASS real bounds update and hide')
    hwnd = browser.hwnd
    assert session.close()['ok']
    assert not user32.IsWindow(hwnd), 'closed window actually destroyed'
    print('PASS native close waits for destruction')
    # Cancel a real browser launch/search, not a mocked asynchronous function.
    outcome = []
    thread = threading.Thread(target=lambda: outcome.append(session.open(factory, url + '&cancel=1', host, (0, 0, 400, 500))))
    thread.start()
    time.sleep(0.1)
    assert session.close()['ok']
    thread.join(6)
    assert not thread.is_alive()
    assert outcome and outcome[0].get('cancelled'), outcome
    assert not session.status()['active']
    print('PASS real pending launch cancelled and cleaned')
finally:
    session.close()
    user32.DestroyWindow(host)
    server.shutdown()
