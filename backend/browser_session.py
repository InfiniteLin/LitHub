"""Thread-safe ownership of the one embedded browser; independent of Win32/FastAPI."""
import threading
import uuid


class BrowserSession:
    def __init__(self):
        self._lock = threading.RLock()
        self._operations = threading.Lock()
        self._generation = 0
        self._cancel = threading.Event()
        self._browser = None
        self._busy = False
        self._session_id = ""
        self._seq = 0
        self._stale = 0
        self._stopping = False

    def open(self, factory, url, parent, rect):
        with self._lock:
            if self._stopping:
                return {"ok": False, "cancelled": True, "error": "应用正在退出"}
            self._cancel.set()
            self._cancel = cancel = threading.Event()
            self._generation += 1
            generation = self._generation
            self._busy = True
        browser = None
        published = False
        with self._operations:
            try:
                if cancel.is_set():
                    return {"ok": False, "cancelled": True, "error": "打开已取消"}
                with self._lock:
                    if self._browser:
                        self._browser.close()
                        self._browser = None
                    self._session_id = ""
                browser = factory()
                ok, error = browser.open(url, parent, cancel_event=cancel)
                if cancel.is_set():
                    return {"ok": False, "cancelled": True, "error": "打开已取消"}
                if not ok:
                    return {"ok": False, "error": error or "嵌入失败"}
                with self._lock:
                    if cancel.is_set() or generation != self._generation:
                        return {"ok": False, "cancelled": True, "error": "打开已取消"}
                    browser.set_bounds(*rect)
                    browser.hide()  # Only a current, confirmed bounds request may expose it.
                    self._session_id = uuid.uuid4().hex
                    self._seq = 0
                    self._browser = browser
                    published = True
                    return {"ok": True, "session_id": self._session_id,
                            "browser": browser.browser["name"],
                            "browser_path": browser.browser.get("path", ""),
                            "title": browser.current_title()}
            finally:
                if browser is not None and not published:
                    browser.close()
                with self._lock:
                    if generation == self._generation:
                        self._busy = False

    def close(self, timeout=5):
        # Cancel before waiting: an in-flight window search must be able to stop.
        with self._lock:
            self._cancel.set()
            self._generation += 1
            generation = self._generation
        if not self._operations.acquire(timeout=timeout):
            return {"ok": False, "busy": True, "error": "浏览器仍在清理，请重试"}
        try:
            with self._lock:
                if generation != self._generation:
                    return {"ok": True, "superseded": True}
                if self._browser:
                    self._browser.close()
                self._browser = None
                self._session_id = ""
                self._seq = 0
                self._busy = False
                return {"ok": True}
        finally:
            self._operations.release()

    def bounds(self, *, x=0, y=0, width=1, height=1, visible=False, seq=0, session_id=""):
        with self._lock:
            if self._busy:
                return {"ok": False, "busy": True}
            browser = self._browser
            if browser is None:
                return {"ok": False, "closed": True, "error": "没有正在嵌入的浏览器"}
            if session_id and session_id != self._session_id:
                return {"ok": False, "stale": True, "error": "浏览器会话已更换"}
            if not browser.alive():
                return {"ok": False, "closed": True, "error": "浏览器窗口已关闭"}
            if seq and seq <= self._seq:
                self._stale += 1
                return {"ok": True, "stale": True}
            if visible:
                browser.set_bounds(x, y, width, height)
                browser.show()
            else:
                browser.hide()
            if seq:
                self._seq = seq
            return {"ok": True, "seq": seq}

    def shutdown(self):
        with self._lock:
            self._stopping = True
        return self.close()

    def status(self):
        with self._lock:
            browser = self._browser
            result = {"active": bool(browser and browser.alive()), "busy": self._busy,
                      "session_id": self._session_id, "last_bounds_seq": self._seq,
                      "bounds_stale_dropped": self._stale}
            if browser:
                try:
                    result.update(browser.diag())
                except Exception:
                    pass
            return result
