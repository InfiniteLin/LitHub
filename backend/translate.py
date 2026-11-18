"""翻译任务运行器：单 worker 队列，逐行解析翻译引擎输出。"""

import os
import queue
import re
import signal
import subprocess
import threading
import time

from store import store
from translation_plugin import manager as plugin_manager

_progress_re = re.compile(r"(\d{1,3})%\|")
_queue: "queue.Queue[str]" = queue.Queue()
_worker: threading.Thread | None = None
_procs: dict[str, subprocess.Popen] = {}   # task_id -> 运行中的子进程
_procs_lock = threading.RLock()
_ACTIVE = {"queued", "running"}


def submit(paper_id: str, retranslate: bool = False) -> dict:
    """创建和入队共用锁，并发请求复用同一篇文献的活动任务。"""
    with plugin_manager.lock, _procs_lock:
        if plugin_manager.snapshot()["status"] == "installing":
            raise ValueError("翻译插件正在更新，请完成或取消更新后再开始翻译")
        paper = store.get_paper(paper_id)
        if not paper:
            raise KeyError("文献不存在")
        for task in store.list_tasks(limit=None):
            if task["paper_id"] == paper_id and task["status"] in _ACTIVE:
                return task
        if paper.get("translated") and not retranslate:
            raise ValueError("该文献已有译文，请选择重新翻译")
        task = store.add_task(paper_id)
        if retranslate:
            store.update_task(task["id"], retranslate=True)
            task = store.get_task(task["id"])
        enqueue(task["id"])
        return task


def cancel_task(task_id: str) -> dict | None:
    """排队任务直接跳过；运行任务终止进程。终态保持幂等。"""
    with _procs_lock:
        task = store.get_task(task_id)
        if not task or task["status"] not in _ACTIVE:
            return task
        proc = _procs.get(task_id)
        if proc and proc.poll() is None:
            # The Next engine also starts a BabelDOC child process.
            if os.name == "nt":
                try:
                    subprocess.run(["taskkill", "/PID", str(proc.pid), "/T", "/F"],
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                   creationflags=subprocess.CREATE_NO_WINDOW, timeout=10, check=False)
                except (OSError, subprocess.TimeoutExpired):
                    pass
                if proc.poll() is None:
                    proc.kill()
            else:
                try:
                    os.killpg(proc.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
        store.update_task(task_id, status="cancelled", note="已取消")
        return store.get_task(task_id)


def cancel(paper_id: str) -> bool:
    """删除文献时同时取消排队和运行任务，包括旧版本留下的重复任务。"""
    with _procs_lock:
        tasks = [t for t in store.list_tasks(limit=None)
                 if t["paper_id"] == paper_id and t["status"] in _ACTIVE]
        for task in tasks:
            cancel_task(task["id"])
        return bool(tasks)


def _run_one(task_id: str):
    with _procs_lock:
        task = store.get_task(task_id)
        if not task or task["status"] != "queued":
            return
        paper = store.get_paper(task["paper_id"])
        if not paper:
            store.update_task(task_id, status="failed", note="文献不存在")
            return
        if paper.get("translated") and not task.get("retranslate"):
            store.update_task(task_id, status="cancelled", note="已有译文，跳过重复任务")
            return
        store.update_task(task_id, status="running", progress=0, note="正在解析版面…")

    src = store.paper_file(paper["id"])
    # A failed/cancelled retry must not overwrite the previous usable PDF.
    out_dir = store.output_dir / paper["id"] / task_id
    out_dir.mkdir(parents=True, exist_ok=True)

    cfg = store.get_settings()
    service = cfg.get("service") or "bing"
    target_lang = cfg.get("target_lang", "zh")
    command, isolated_home = plugin_manager.runtime()
    cmd = [*command, str(src), "--" + service, "--lang-out", target_lang,
           "--output", str(out_dir), "--use-alternating-pages-dual",
           "--no-auto-extract-glossary", "--disable-config-auto-save"]
    if task.get("retranslate"):
        cmd.append("--ignore-cache")
    isolated_home.mkdir(parents=True, exist_ok=True)
    env = {key: value for key, value in os.environ.items() if not key.upper().startswith("PDF2ZH_")}
    env.update(PYTHONIOENCODING="utf-8", USERPROFILE=str(isolated_home), HOME=str(isolated_home))
    if service == "openai":
        if not all(cfg.get(k) for k in ("api_key", "base_url", "model")):
            raise ValueError("请先在「设置 → AI 服务」添加并配置 API，或改用必应翻译")
        env.update(PDF2ZH_OPENAI_BASE_URL=cfg["base_url"], PDF2ZH_OPENAI_API_KEY=cfg["api_key"],
                   PDF2ZH_OPENAI_MODEL=cfg["model"])
    err_tail = []
    with _procs_lock:
        if not _is_active(task_id):
            return
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="ignore",
            env=env,
            cwd=str(out_dir),
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
            start_new_session=os.name != "nt",
        )
        _procs[task_id] = proc

    started = time.time()
    last_flush, last_pct = 0.0, -1
    code = 1
    try:
        assert proc.stdout is not None
        for line in proc.stdout:
            line = line.strip()
            m = _progress_re.search(line)
            if m:
                # 进度节流：约 0.4s 落盘一次，避免逐行触发全量 JSON 写入
                pct = min(95, int(m.group(1)))
                now = time.time()
                if pct != last_pct and now - last_flush >= 0.4:
                    last_flush, last_pct = now, pct
                    with _procs_lock:
                        if _is_active(task_id):
                            store.update_task(task_id, progress=pct, note=f"正在翻译… {pct}%")
            low = line.lower()
            if "error" in low or "traceback" in low:
                if env.get("PDF2ZH_OPENAI_API_KEY"):
                    line = line.replace(env["PDF2ZH_OPENAI_API_KEY"], "***")
                err_tail.append(line)
                if len(err_tail) > 6:
                    err_tail.pop(0)
        code = proc.wait()
    finally:
        with _procs_lock:
            _procs.pop(task_id, None)

    elapsed = int(time.time() - started)
    mono = _find_output(out_dir, "mono")
    dual = _find_output(out_dir, "dual")

    with _procs_lock:
        if not _is_active(task_id):
            return
        if code == 0 and mono:
            store.update_paper(
                paper["id"],
                translated=True,
                translated_file=str(mono),
                translated_dual_file=str(dual) if dual else None,
                translation_task_id=task_id,
                pages=_page_count(mono) or paper.get("pages"),
            )
            store.update_task(task_id, status="done", progress=100,
                              note=f"用时 {elapsed // 60} 分 {elapsed % 60} 秒 · 已生成对照版")
        else:
            note = " / ".join(err_tail[-2:]) if err_tail else f"pdf2zh 退出码 {code}"
            store.update_task(task_id, status="failed", note=note[:200])


def _is_active(task_id: str) -> bool:
    task = store.get_task(task_id)
    return bool(task and task["status"] in _ACTIVE)


def _find_output(out_dir, kind: str = "mono"):
    cands = sorted(out_dir.glob(f"*{kind}*.pdf"), key=lambda p: p.stat().st_mtime, reverse=True)
    return cands[0] if cands else None


def _page_count(pdf_path) -> int | None:
    try:
        from pypdf import PdfReader
        return len(PdfReader(str(pdf_path)).pages)
    except Exception:
        return None


def _worker_loop():
    while True:
        tid = _queue.get()
        try:
            _run_one(tid)
        except Exception as exc:  # 队列不因单任务异常而停摆
            with _procs_lock:
                if _is_active(tid):
                    store.update_task(tid, status="failed", note=f"任务异常：{exc}")
        finally:
            _queue.task_done()


def enqueue(task_id: str):
    global _worker
    if _worker is None or not _worker.is_alive():
        _worker = threading.Thread(target=_worker_loop, daemon=True)
        _worker.start()
    _queue.put(task_id)


def _plugin_switch_guard():
    if any(t["status"] in _ACTIVE for t in store.list_tasks(limit=None)):
        raise ValueError("请先完成或取消翻译任务，再更新或恢复翻译插件")


plugin_manager.guard = _plugin_switch_guard
