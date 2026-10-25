"""翻译任务运行器：单 worker 队列，逐行解析 pdf2zh 输出更新进度（节流落盘）。"""

import os
import queue
import re
import shutil
import subprocess
import sys
import threading
import time
from pathlib import Path

from store import store

_progress_re = re.compile(r"(\d{1,3})%\|")
_queue: "queue.Queue[str]" = queue.Queue()
_worker: threading.Thread | None = None
_procs: dict[str, subprocess.Popen] = {}   # task_id -> 运行中的子进程
_procs_lock = threading.RLock()
_ACTIVE = {"queued", "running"}


def submit(paper_id: str) -> dict:
    """创建和入队共用锁，并发请求复用同一篇文献的活动任务。"""
    with _procs_lock:
        paper = store.get_paper(paper_id)
        if not paper:
            raise KeyError("文献不存在")
        if paper.get("translated"):
            raise ValueError("该文献已有译文")
        for task in store.list_tasks(limit=None):
            if task["paper_id"] == paper_id and task["status"] in _ACTIVE:
                return task
        task = store.add_task(paper_id)
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
            proc.kill()
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


def _pdf2zh_cmd():
    """找到调用 pdf2zh 的命令前缀（后面再拼参数）。

    三种情况，按顺序试：
      1. 打包版：内置运行时里跑 backend/pdf2zh_cli.py。
         `pip install --target` 不生成 console_scripts，而 pdf2zh 1.x 没有
         `__main__.py`，所以只能用一个我们自己的薄入口脚本。
      2. 开发机：PATH 里的 pdf2zh（普通 pip install 会在 Scripts/ 下生成）。
      3. 当前解释器旁边的 pdf2zh.exe。
    """
    here = Path(__file__).resolve().parent
    cli = here / "pdf2zh_cli.py"
    if cli.exists() and _module_available("pdf2zh.pdf2zh"):
        # 用当前这个解释器（打包版就是内置运行时）跑入口脚本
        return [sys.executable, str(cli)]

    exe = shutil.which("pdf2zh")
    if exe:
        return [exe]
    cand = Path(sys.executable).parent / ("pdf2zh.exe" if os.name == "nt" else "pdf2zh")
    if cand.exists():
        return [str(cand)]
    raise FileNotFoundError(
        "未找到 pdf2zh。请先安装：pip install pdf2zh（打包版应已内置）"
    )


def _module_available(name: str) -> bool:
    """某个模块能不能导入（不真的执行它的重型导入副作用就判断不了，但够用）。"""
    import importlib.util

    try:
        return importlib.util.find_spec(name) is not None
    except Exception:
        return False


def _run_one(task_id: str):
    with _procs_lock:
        task = store.get_task(task_id)
        if not task or task["status"] != "queued":
            return
        paper = store.get_paper(task["paper_id"])
        if not paper:
            store.update_task(task_id, status="failed", note="文献不存在")
            return
        if paper.get("translated"):
            store.update_task(task_id, status="cancelled", note="已有译文，跳过重复任务")
            return
        store.update_task(task_id, status="running", progress=0, note="正在解析版面…")

    src = store.paper_file(paper["id"])
    out_dir = store.output_dir / paper["id"]
    out_dir.mkdir(parents=True, exist_ok=True)

    cfg = store.get_settings()
    service = cfg.get("service") or "bing"
    provider = cfg.get("provider") or ""
    cmd = [
        *_pdf2zh_cmd(),
        str(src),
        "-s", service,
        "-lo", cfg.get("target_lang", "zh"),
        "-o", str(out_dir),
    ]
    # 复用 pdf2zh 内置翻译器：1.9.x 经环境变量配置（set_envs 读取 os.environ），
    # 键名与各翻译器类声明的 envs 一致
    env_extra: dict[str, str] = {}
    if provider == "deepseek" and cfg.get("api_key"):
        service = "deepseek"  # pdf2zh 原生 DeepseekTranslator（内置 base_url）
        cmd = [*_pdf2zh_cmd(), str(src), "-s", service,
               "-lo", cfg.get("target_lang", "zh"), "-o", str(out_dir)]
        env_extra = {
            "DEEPSEEK_API_KEY": cfg["api_key"],
            "DEEPSEEK_MODEL": cfg.get("model") or "deepseek-chat",
        }
    elif service == "openai" and cfg.get("api_key"):
        env_extra = {
            "OPENAI_BASE_URL": cfg.get("base_url") or "https://api.openai.com/v1",
            "OPENAI_API_KEY": cfg["api_key"],
            "OPENAI_MODEL": cfg.get("model") or "gpt-4o-mini",
        }

    env = {**os.environ, "PYTHONIOENCODING": "utf-8", **env_extra}
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
