"""并行运行翻译任务，每个任务独立读取进度和管理引擎子进程。"""

import os
import signal
import subprocess
import threading
import time

import engine_progress
from store import store
from translation_plugin import manager as plugin_manager

_procs: dict[str, subprocess.Popen] = {}   # task_id -> 运行中的子进程
_procs_lock = threading.RLock()
_ACTIVE = {"queued", "running"}
_STARTUP_TIMEOUT = 300
_API_CONNECT_TIMEOUT = 60


def submit(paper_id: str, retranslate: bool = False) -> dict:
    """同一篇文献复用活动任务，不同文献各自启动。"""
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
        task = store.add_task(paper_id, retranslate=retranslate)
        try:
            _start_task(task["id"])
        except RuntimeError as exc:
            store.update_task(task["id"], status="failed", note=f"无法启动翻译任务：{exc}")
        return store.get_task(task["id"])


def cancel_task(task_id: str) -> dict | None:
    """排队任务直接跳过；运行任务终止进程。终态保持幂等。"""
    with _procs_lock:
        task = store.get_task(task_id)
        if not task or task["status"] not in _ACTIVE:
            return task
        proc = _procs.get(task_id)
        if proc:
            _stop_process(proc)
        store.update_task(task_id, status="cancelled", note="已取消")
        return store.get_task(task_id)


def cancel(paper_id: str) -> bool:
    """删除文献时取消该文献的所有活动任务。"""
    with _procs_lock:
        tasks = [t for t in store.list_tasks(limit=None)
                 if t["paper_id"] == paper_id and t["status"] in _ACTIVE]
        for task in tasks:
            cancel_task(task["id"])
        return bool(tasks)


def stop_all():
    for task in store.list_tasks(limit=None):
        if task["status"] in _ACTIVE:
            try:
                cancel_task(task["id"])
            except OSError:
                continue


def _stop_process(proc):
    if proc.poll() is not None:
        return
    # BabelDOC runs in a child of the engine launcher.
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


def _run_one(task_id: str):
    with _procs_lock:
        task = store.get_task(task_id)
        if not task or task["status"] not in _ACTIVE:
            return
        paper = store.get_paper(task["paper_id"])
        if not paper:
            store.update_task(task_id, status="failed", note="文献不存在")
            return
        if paper.get("translated") and not task.get("retranslate"):
            store.update_task(task_id, status="cancelled", note="已有译文，跳过重复任务")
            return
        if task["status"] == "queued":
            store.update_task(task_id, status="running", note="正在启动翻译引擎…")

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
    last_flush = float("-inf")
    progress = saved_progress = 0
    stage = ""
    code = 1
    startup_timeout_note = None
    startup_api_error = None
    translating = False

    def expire_startup(only_api=False):
        nonlocal startup_timeout_note
        with _procs_lock:
            if (startup_timeout_note or translating or proc.poll() is not None
                    or not _is_active(task_id)
                    or (only_api and stage != engine_progress.CONNECT_API)):
                return
            if stage == engine_progress.CONNECT_API:
                startup_timeout_note = "连接翻译 API 超时，请检查网络后重试"
            elif stage == engine_progress.PREPARE_ASSETS:
                startup_timeout_note = "准备版面模型和字体超时，请检查网络后重试"
            else:
                startup_timeout_note = "启动翻译引擎超时，请重试"
        _stop_process(proc)

    startup_timer = threading.Timer(_STARTUP_TIMEOUT, expire_startup)
    api_timer = threading.Timer(_API_CONNECT_TIMEOUT, expire_startup, kwargs={"only_api": True})
    startup_timer.daemon = api_timer.daemon = True
    startup_timer.start()
    try:
        assert proc.stdout is not None
        for line in proc.stdout:
            line = line.strip()
            if message := engine_progress.startup_error_message(line):
                startup_api_error = message
                continue
            parsed = engine_progress.parse(line)
            if parsed:
                pct, new_stage = parsed
                if pct is not None:
                    progress = max(progress, min(99, pct))
                changed_stage = bool(new_stage and new_stage != stage)
                now = time.monotonic()
                should_flush = changed_stage or (progress > saved_progress and now - last_flush >= 0.4)
                if translating and not should_flush:
                    continue
                # 阶段切换时一起提交最新进度，包括节流期间收到的数值。
                with _procs_lock:
                    if not startup_timeout_note and _is_active(task_id):
                        stage = new_stage or stage
                        if not translating and (pct is not None or stage not in engine_progress.STARTUP_STAGES):
                            translating = True
                            startup_timer.cancel()
                        if not translating and stage == engine_progress.CONNECT_API and api_timer.ident is None:
                            api_timer.start()
                        if should_flush:
                            label = engine_progress.stage_label(stage) if stage else "正在翻译"
                            store.update_task(task_id, progress=progress, note=label)
                            last_flush, saved_progress = now, progress
            low = line.lower()
            if "error" in low or "traceback" in low:
                if env.get("PDF2ZH_OPENAI_API_KEY"):
                    line = line.replace(env["PDF2ZH_OPENAI_API_KEY"], "***")
                err_tail.append(line)
                if len(err_tail) > 6:
                    err_tail.pop(0)
        code = proc.wait()
    finally:
        startup_timer.cancel()
        api_timer.cancel()
        try:
            _stop_process(proc)
            proc.wait()
        finally:
            if proc.stdout:
                proc.stdout.close()
            with _procs_lock:
                _procs.pop(task_id, None)

    elapsed = int(time.time() - started)
    mono = _find_output(out_dir, "mono")
    dual = _find_output(out_dir, "dual")

    pages = _page_count(mono) if code == 0 and mono else None
    with _procs_lock:
        if not _is_active(task_id):
            return
        if code == 0 and mono and not startup_timeout_note:
            store.update_paper(
                paper["id"],
                translated=True,
                translated_file=str(mono),
                translated_dual_file=str(dual) if dual else None,
                translation_task_id=task_id,
                pages=pages or paper.get("pages"),
            )
            store.update_task(task_id, status="done", progress=100,
                              note=f"用时 {elapsed // 60} 分 {elapsed % 60} 秒 · 已生成对照版")
        else:
            detail = " / ".join(err_tail[-2:]) if err_tail else f"pdf2zh 退出码 {code}"
            note = startup_api_error or startup_timeout_note or detail
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


def _run_task(task_id: str):
    try:
        _run_one(task_id)
    except Exception as exc:
        with _procs_lock:
            if _is_active(task_id):
                store.update_task(task_id, status="failed", note=f"任务异常：{exc}")


def _start_task(task_id: str):
    threading.Thread(target=_run_task, args=(task_id,), daemon=True).start()


def _plugin_switch_guard():
    if any(t["status"] in _ACTIVE for t in store.list_tasks(limit=None)):
        raise ValueError("请先完成或取消翻译任务，再更新或恢复翻译插件")


plugin_manager.guard = _plugin_switch_guard
