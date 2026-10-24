import ast
import ctypes
from ctypes import wintypes
from pathlib import Path
import os
import sys
import threading
import time
import unittest
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from browser_session import BrowserSession


class FakeBrowser:
    browser = {'name': 'test', 'path': 'test'}

    def __init__(self):
        self.closed = False
        self.visible = False
        self.rect = None

    def open(self, url, parent, cancel_event=None): return True, ''
    def close(self): self.closed = True
    def alive(self): return not self.closed
    def show(self): self.visible = True
    def hide(self): self.visible = False
    def set_bounds(self, *rect): self.rect = rect
    def current_title(self): return 'test'
    def diag(self): return {}


class SessionTests(unittest.TestCase):
    def test_close_cancels_pending_open_and_waits_for_cleanup(self):
        session = BrowserSession()
        started = threading.Event()
        browser = FakeBrowser()
        def opening(url, parent, cancel_event=None):
            started.set()
            cancel_event.wait(2)
            return True, ''
        browser.open = opening
        results = []
        worker = threading.Thread(target=lambda: results.append(session.open(lambda: browser, '', 1, (0, 0, 400, 500))))
        worker.start()
        self.assertTrue(started.wait(1))
        self.assertTrue(session.close()['ok'])
        worker.join(1)
        self.assertFalse(worker.is_alive())
        self.assertTrue(results[0]['cancelled'])
        self.assertTrue(browser.closed)
        self.assertFalse(session.status()['active'])

    def test_session_identity_and_sequence(self):
        session = BrowserSession()
        first = FakeBrowser()
        a = session.open(lambda: first, '', 1, (0, 0, 400, 500))
        self.assertFalse(first.visible)
        session.bounds(seq=10, visible=True, session_id=a['session_id'])
        self.assertTrue(first.visible)
        self.assertTrue(session.bounds(seq=9, visible=False)['stale'])
        self.assertTrue(first.visible)
        second = FakeBrowser()
        b = session.open(lambda: second, '', 1, (0, 0, 400, 500))
        self.assertTrue(first.closed)
        self.assertNotEqual(a['session_id'], b['session_id'])
        self.assertTrue(session.bounds(seq=100, visible=True, session_id=a['session_id'])['stale'])
        self.assertFalse(second.visible)
        self.assertTrue(session.bounds(seq=1, visible=True, session_id=b['session_id'])['ok'])
        self.assertTrue(second.visible)
        session.close()

    def test_failed_open_and_failed_close_are_not_reported_as_success(self):
        session = BrowserSession()
        browser = FakeBrowser()
        browser.open = lambda *args, **kwargs: (False, 'failure')
        self.assertFalse(session.open(lambda: browser, '', 1, (0, 0, 1, 1))['ok'])
        self.assertTrue(browser.closed)
        browser = FakeBrowser()
        session.open(lambda: browser, '', 1, (0, 0, 1, 1))
        def broken_close(): raise RuntimeError('failure')
        browser.close = broken_close
        with self.assertRaises(RuntimeError): session.close()
        self.assertTrue(session.status()['active'])

    def test_shutdown_rejects_late_open(self):
        session = BrowserSession()
        session.shutdown()
        def unexpected_factory(): self.fail('shutdown must not launch another browser')
        self.assertTrue(session.open(unexpected_factory, '', 1, (0, 0, 1, 1))['cancelled'])


class WindowSelectionTests(unittest.TestCase):
    def select(self, windows, cancel=False):
        # Run the real selection method with deterministic Win32 doubles; no desktop changes.
        source = Path(__file__).resolve().parents[1] / 'backend/browser_embed.py'
        cls = next(n for n in ast.parse(source.read_text(encoding='utf-8')).body
                   if isinstance(n, ast.ClassDef) and n.name == 'EmbeddedBrowser')
        method = next(n for n in cls.body if isinstance(n, ast.FunctionDef) and n.name == '_find_new_window')
        class Win:
            def IsWindowVisible(self, hwnd): return True
            def IsWindow(self, hwnd): return True
            def GetWindowRect(self, hwnd, ptr):
                ptr._obj.left = ptr._obj.top = 0
                ptr._obj.right, ptr._obj.bottom = windows[hwnd][2]
        clock = [0.0]
        def advance(delay): clock[0] += delay
        namespace = {'time': SimpleNamespace(time=lambda: clock[0], sleep=advance),
                     'os': os, 'ctypes': ctypes, 'wintypes': wintypes, 'user32': Win(),
                     '_enum_windows': lambda pred: list(windows), '_window_title': lambda h: 'test',
                     '_class_name': lambda h: windows[h][0], '_window_pid': lambda h: h,
                     '_process_image': lambda pid: windows[pid][1]}
        exec(compile(ast.Module(body=[method], type_ignores=[]), str(source), 'exec'), namespace)
        event = threading.Event()
        if cancel: event.set()
        instance = SimpleNamespace(browser={'path': 'chrome.exe'}, _cancel_event=event)
        return namespace['_find_new_window'](instance, set(), 1.0)

    def test_unrelated_larger_window_is_rejected(self):
        self.assertEqual(self.select({1: ('Chrome_WidgetWin_1', 'chrome.exe', (900, 800)),
                                      2: ('OtherApp', 'other.exe', (1600, 1000))}), 1)

    def test_wrong_browser_path_is_rejected(self):
        self.assertIsNone(self.select({1: ('Chrome_WidgetWin_1', 'edge.exe', (900, 800))}))

    def test_ambiguous_windows_are_not_guessed(self):
        self.assertIsNone(self.select({1: ('Chrome_WidgetWin_1', 'chrome.exe', (900, 800)),
                                      2: ('Chrome_WidgetWin_1', 'chrome.exe', (1600, 1000))}))

    def test_cancel_stops_selection(self):
        self.assertIsNone(self.select({}, cancel=True))


class ContentInsetsTests(unittest.TestCase):
    def measure(self, children):
        source = Path(__file__).resolve().parents[1] / 'backend/browser_embed.py'
        cls = next(n for n in ast.parse(source.read_text(encoding='utf-8')).body
                   if isinstance(n, ast.ClassDef) and n.name == 'EmbeddedBrowser')
        method = next(n for n in cls.body if isinstance(n, ast.FunctionDef) and n.name == '_measure_insets')
        class Win:
            def EnumChildWindows(self, hwnd, callback, data):
                for child in children: callback(child, data)
            def IsWindowVisible(self, hwnd):
                return False  # 隐藏的祖先不等于网页内容窗口未启用显示。
            def GetWindowLongW(self, hwnd, flag): return 0x10000000 if children[hwnd][1] else 0
            def GetWindowRect(self, hwnd, ptr):
                rect = (100, 200, 900, 700) if hwnd == 99 else children[hwnd][2]
                ptr._obj.left, ptr._obj.top, ptr._obj.right, ptr._obj.bottom = rect
        namespace = {'ctypes': ctypes, 'wintypes': wintypes, 'user32': Win(),
                     'ENUM_WND_PROC': lambda callback: callback, 'GWL_STYLE': -16, 'WS_VISIBLE': 0x10000000,
                     '_class_name': lambda h: children[h][0]}
        exec(compile(ast.Module(body=[method], type_ignores=[]), str(source), 'exec'), namespace)
        return namespace['_measure_insets'](SimpleNamespace(hwnd=99))

    def test_hidden_parent_still_measures_chromium_titlebar(self):
        self.assertEqual(self.measure({1: ('Chrome_RenderWidgetHostHWND', True, (108, 246, 892, 694))}),
                         (8, 46, 8, 6))

    def test_hidden_old_viewport_and_small_transient_windows_are_ignored(self):
        self.assertEqual(self.measure({
            1: ('Chrome_RenderWidgetHostHWND', False, (100, 200, 900, 700)),
            2: ('Chrome_RenderWidgetHostHWND', True, (100, 200, 101, 201)),
            3: ('Chrome_RenderWidgetHostHWND', True, (108, 246, 892, 694)),
        }), (8, 46, 8, 6))

    def test_unavailable_viewport_keeps_geometry_uncropped(self):
        self.assertEqual(self.measure({1: ('Intermediate D3D Window', True, (100, 200, 900, 700))}),
                         (0, 0, 0, 0))


if __name__ == '__main__': unittest.main()
