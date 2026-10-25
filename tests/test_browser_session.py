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

    def test_normal_close_does_not_mark_application_stopping(self):
        session = BrowserSession()
        self.assertTrue(session.open(FakeBrowser, '', 1, (0, 0, 1, 1))['ok'])
        self.assertTrue(session.close()['ok'])
        self.assertFalse(session.status()['stopping'])
        self.assertTrue(session.open(FakeBrowser, '', 1, (0, 0, 1, 1))['ok'])
        session.shutdown()
        self.assertTrue(session.status()['stopping'])


class WindowSelectionTests(unittest.TestCase):
    def select(self, windows, cancel=False, existed=(), hidden=False):
        # Run the real selection method with deterministic Win32 doubles; no desktop changes.
        source = Path(__file__).resolve().parents[1] / 'backend/browser_embed.py'
        cls = next(n for n in ast.parse(source.read_text(encoding='utf-8')).body
                   if isinstance(n, ast.ClassDef) and n.name == 'EmbeddedBrowser')
        method = next(n for n in cls.body if isinstance(n, ast.FunctionDef) and n.name == '_find_new_window')
        self.hidden_calls = []
        visible = {h: not hidden for h in windows}
        calls = self.hidden_calls
        class Win:
            def IsWindowVisible(self, hwnd): return visible[hwnd]
            def ShowWindow(self, hwnd, mode):
                calls.append((hwnd, mode, clock[0]))
                visible[hwnd] = False
            def IsWindow(self, hwnd): return True
            def GetWindowRect(self, hwnd, ptr):
                ptr._obj.left = ptr._obj.top = 0
                ptr._obj.right, ptr._obj.bottom = windows[hwnd][2]
        clock = [0.0]
        def advance(delay): clock[0] += delay
        namespace = {'time': SimpleNamespace(time=lambda: clock[0], sleep=advance),
                     'os': os, 'ctypes': ctypes, 'wintypes': wintypes, 'user32': Win(),
                     'SW_HIDE': 0,
                     '_enum_windows': lambda pred: [h for h in windows if pred(h)], '_window_title': lambda h: 'test',
                     '_class_name': lambda h: windows[h][0], '_window_pid': lambda h: h,
                     '_process_image': lambda pid: windows[pid][1]}
        exec(compile(ast.Module(body=[method], type_ignores=[]), str(source), 'exec'), namespace)
        event = threading.Event()
        if cancel: event.set()
        instance = SimpleNamespace(browser={'path': 'chrome.exe'}, _cancel_event=event)
        return namespace['_find_new_window'](instance, set(existed), 1.0)

    def test_hide_before_stability_wait_and_keep_finding_hidden_window(self):
        self.assertEqual(self.select({1: ('Chrome_WidgetWin_1', 'chrome.exe', (900, 800))}), 1)
        self.assertEqual(self.hidden_calls[0], (1, 0, 0.0))

    def test_hidden_startup_window_is_discovered(self):
        self.assertEqual(self.select({1: ('Chrome_WidgetWin_1', 'chrome.exe', (900, 800))}, hidden=True), 1)

    def test_preexisting_hidden_windows_are_untouched(self):
        self.assertIsNone(self.select({1: ('Chrome_WidgetWin_1', 'chrome.exe', (900, 800))}, existed=(1,), hidden=True))
        self.assertEqual(self.hidden_calls, [])

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


class StartupGuardTests(unittest.TestCase):
    def setUp(self):
        source = Path(__file__).resolve().parents[1] / 'backend/browser_embed.py'
        nodes = [node for node in ast.parse(source.read_text(encoding='utf-8')).body
                 if getattr(node, 'name', '') in ('_startup_transparency', '_restore_startup_opacity', '_StartupWindowGuard')]
        self.styles = {1: 0x40000, 2: 0x40000, 3: 0x40000, 4: 0x40000}
        self.alpha = {}
        owner = self
        class Win:
            def GetWindowLongW(self, h, flag): return owner.styles[h] if flag == -20 else (0x40000000 if h == 4 else 0)
            def SetWindowLongW(self, h, flag, style): owner.styles[h] = style
            def GetLayeredWindowAttributes(self, h, key, alpha, flags):
                if h not in owner.alpha: return False
                key._obj.value, alpha._obj.value, flags._obj.value = owner.alpha[h]
                return True
            def SetLayeredWindowAttributes(self, h, key, alpha, flags):
                owner.alpha[h] = (key, alpha, flags)
                return True
            def IsWindowVisible(self, h): return False
            def IsWindow(self, h): return True
            def PostThreadMessageW(self, *args): return True
        self.ns = dict(os=os, threading=threading, ctypes=ctypes, wintypes=wintypes, user32=Win(),
                       GWL_STYLE=-16, WS_CHILD=0x40000000,
                       _class_name=lambda h: 'Chrome_WidgetWin_1', _window_pid=lambda h: h,
                       _process_image=lambda h: 'other.exe' if h == 3 else 'chrome.exe')
        exec(compile(ast.Module(body=nodes, type_ignores=[]), str(source), 'exec'), self.ns)
        self.guard = self.ns['_StartupWindowGuard']('chrome.exe', {1})
        self.guard.thread = SimpleNamespace(join=lambda: None)

    def event(self, hwnd=2, event=0x8000, obj=0):
        self.guard._on_event(None, event, hwnd, obj, 0, 0, 0)

    def test_untitled_creation_is_transparent_and_no_activate_before_show(self):
        self.event()
        self.assertEqual(self.alpha[2], (0, 0, 2))
        self.assertTrue(self.styles[2] & 0x8000000)
        self.assertTrue(self.styles[2] & 0x80)
        self.assertFalse(self.styles[2] & 0x40000)
        self.event(event=0x8002)
        self.assertEqual(self.guard.suppressed[2], (0x40000, None))

    def test_existing_other_executable_and_child_windows_are_untouched(self):
        for h in (1, 3, 4): self.event(h)
        self.event(obj=-4)
        self.assertEqual(self.guard.suppressed, {})
        self.assertEqual(self.alpha, {})

    def test_failure_or_ambiguity_restores_all_unclaimed_window_styles(self):
        self.event()
        self.guard.__exit__(RuntimeError, RuntimeError('failed'), None)
        self.assertEqual(self.styles[2], 0x40000)

    def test_claimed_window_stays_transparent_until_explicit_restore(self):
        self.event()
        self.guard.keep = 2
        self.guard.__exit__(None, None, None)
        self.assertTrue(self.styles[2] & 0x80000)
        self.ns['_restore_startup_opacity'](2, self.guard.suppressed[2])
        self.assertEqual(self.styles[2], 0x40000)

    def test_existing_layered_opacity_and_unrelated_style_changes_are_preserved(self):
        self.styles[2] |= 0x80000
        self.alpha[2] = (42, 170, 3)
        self.event()
        self.styles[2] |= 0x200
        self.guard.__exit__(None, None, None)
        self.assertEqual(self.styles[2], 0xC0200)
        self.assertEqual(self.alpha[2], (42, 170, 3))

    def test_destroyed_handle_is_not_restored_as_an_unrelated_reused_window(self):
        self.event()
        self.event(event=0x8001)
        self.assertEqual(self.guard.suppressed, {})


if __name__ == '__main__': unittest.main()
