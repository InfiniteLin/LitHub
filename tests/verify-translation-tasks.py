"""Translation APIs and worker races in a temporary library, without AI requests."""
import contextlib
from concurrent.futures import ThreadPoolExecutor
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
import time
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))

with tempfile.TemporaryDirectory(prefix='lithub-translation-') as temporary, contextlib.ExitStack() as cleanup:
    base = Path(temporary)
    (base / 'library.json').write_text(json.dumps({
        'papers': {pid: {'id': pid, 'title': pid, 'translated': False}
                   for pid in ('p1', 'p2', 'p3', 'p4')},
        'settings': {}, 'tasks': {},
    }), encoding='utf8')
    os.environ.update(LITHUB_DATA_DIR=str(base), LITHUB_PROGRAM_DIR=str(base),
                      LITHUB_PDF_DEFAULT_DIR=str(base / 'pdfs'))
    from fastapi.testclient import TestClient
    from main import app, store
    import translate
    import search_index
    cleanup.callback(search_index.close)
    client = TestClient(app)
    cleanup.callback(client.close)

    def start(paper_id='p1'):
        response = client.post('/api/translate', json={'paper_id': paper_id})
        assert response.status_code == 200, response.text
        return response.json()

    def cancel(task):
        response = client.post(f'/api/tasks/{task["id"]}/cancel')
        assert response.status_code == 200, response.text
        return response.json()

    with patch.object(translate, '_start_task') as launch:
        with ThreadPoolExecutor(max_workers=12) as pool:
            tasks = list(pool.map(lambda _: start(), range(24)))
        first = tasks[0]
        assert len({t['id'] for t in tasks}) == 1
        launch.assert_called_once_with(first['id'])
        for _ in range(60):
            store.add_task('another-paper')
        assert start()['id'] == first['id'], 'dedup must search beyond the latest 50 tasks'
        active = client.get('/api/tasks?active_only=true').json()
        assert len(active) == 61 and first['id'] in {t['id'] for t in active}, 'update guard must inspect all active tasks'
        assert first['id'] in {t['id'] for t in client.get('/api/tasks').json()}
        assert cancel(first)['status'] == 'cancelled'
        assert first['id'] not in {t['id'] for t in client.get('/api/tasks?active_only=true').json()}
        assert cancel(first)['status'] == 'cancelled'
        with patch.object(translate.subprocess, 'Popen') as popen:
            translate._run_one(first['id'])
            popen.assert_not_called()
        retry = start()
        assert retry['id'] != first['id'] and retry['status'] == 'running'
        assert retry['note'] == '正在启动翻译引擎…'
    print('PASS deduplication beyond task history, cancellation before launch and immediate resubmission')

    # Cancel while the worker is preparing the command, before Popen registration.
    entered, release = threading.Event(), threading.Event()
    def slow_command():
        entered.set()
        assert release.wait(5)
        return [sys.executable, '-c', 'pass'], base / 'engine-home'
    with patch.object(translate.plugin_manager, 'runtime', slow_command), patch.object(translate.subprocess, 'Popen') as popen:
        with ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(translate._run_one, retry['id'])
            try:
                assert entered.wait(5)
                assert cancel(retry)['status'] == 'cancelled'
            finally:
                release.set()
            future.result(timeout=5)
        popen.assert_not_called()
    print('PASS cancellation during startup never launches a process')

    with patch.object(translate, '_start_task'):
        running = start()
    with patch.object(translate.plugin_manager, 'runtime', return_value=(
              [sys.executable, '-u', '-c', "import time; print('10%|', flush=True); time.sleep(30)"],
              base / 'engine-home')):
        with ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(translate._run_one, running['id'])
            proc = None
            try:
                deadline = time.monotonic() + 5
                while time.monotonic() < deadline:
                    with translate._procs_lock:
                        proc = translate._procs.get(running['id'])
                    if proc:
                        break
                    time.sleep(.02)
                assert proc is not None
                assert cancel(running)['status'] == 'cancelled'
                future.result(timeout=5)
                assert proc.poll() is not None
                assert store.get_task(running['id'])['status'] == 'cancelled'
                assert not store.get_paper('p1')['translated']
            finally:
                if proc and proc.poll() is None:
                    proc.kill()
                    proc.wait(timeout=5)
    print('PASS running cancellation kills a real process and cannot publish translated output')

    # 用子进程模拟一批紧邻的进度事件，检查任务记录的阶段和进度。
    with patch.object(translate, '_start_task'):
        progressed = start()
    script = (
        "import sys\n"
        "sys.path.insert(0, r'%s')\n"
        "from engine_progress import progress_line, stage_line\n"
        "print(progress_line(5, 'Parse Page Layout'), flush=True)\n"
        "print(progress_line(30), flush=True)\n"
        "print(stage_line('Translate Paragraphs'), flush=True)\n"
        "print(progress_line(22, 'Typesetting'), flush=True)\n"
        "print(progress_line(100, 'Save PDF'), flush=True)\n"
    ) % str(Path(__file__).resolve().parents[1] / 'backend')
    seen = []
    original_update = store.update_task
    def record(tid, **fields):
        if tid == progressed['id'] and 'note' in fields:
            seen.append((fields.get('progress'), fields['note']))
        return original_update(tid, **fields)
    with patch.object(translate.plugin_manager, 'runtime', return_value=(
              [sys.executable, '-u', '-c', script], base / 'engine-home')), \
         patch.object(translate, '_page_count', return_value=1), \
         patch.object(store, 'update_task', side_effect=record):
        translate._run_one(progressed['id'])
    assert (5, '解析版面') in seen, seen
    assert (30, '翻译正文') in seen, seen
    assert (30, '排版') in seen, seen
    assert (99, '保存 PDF') in seen, seen
    print('PASS startup label, burst progress on stage change, monotonic updates and completion cap')
    # 该任务本身没有产出 PDF，按失败收尾；文献不应被标记为已翻译
    assert store.get_task(progressed['id'])['status'] == 'failed'
    assert not store.get_paper('p1')['translated']

    with patch.object(translate, '_start_task'):
        completed = start()
    command = [sys.executable, '-c', "from pathlib import Path; Path('test-mono.pdf').write_bytes(b'test')"]
    with patch.object(translate.plugin_manager, 'runtime', return_value=(command, base / 'engine-home')), patch.object(translate, '_page_count', return_value=1):
        translate._run_one(completed['id'])
    assert store.get_task(completed['id'])['status'] == 'done'
    assert store.get_paper('p1')['translated']
    assert cancel(completed)['status'] == 'done'
    assert client.post('/api/translate', json={'paper_id': 'p1'}).status_code == 400
    assert client.post('/api/translate', json={'paper_id': 'missing'}).status_code == 404
    assert client.post('/api/tasks/missing/cancel').status_code == 404
    print('PASS normal completion, terminal cancellation idempotency and missing resource handling')

    old = store.get_paper('p1')['translated_file']
    with patch.object(translate, '_start_task'):
        def restart():
            response = client.post('/api/translate', json={'paper_id':'p1','retranslate':True})
            assert response.status_code == 200, response.text
            return response.json()
        with ThreadPoolExecutor(max_workers=8) as pool:
            reruns = list(pool.map(lambda _: restart(), range(16)))
        rerun = reruns[0]
        assert len({t['id'] for t in reruns}) == 1 and rerun['retranslate']
        assert start()['id'] == rerun['id']
    with patch.object(translate.plugin_manager, 'runtime', return_value=(
              [sys.executable, '-c', 'raise SystemExit(1)'], base / 'engine-home')):
        translate._run_one(rerun['id'])
    assert store.get_task(rerun['id'])['status'] == 'failed'
    assert store.get_paper('p1')['translated_file'] == old and Path(old).exists()
    with patch.object(translate, '_start_task'):
        cancelled = restart()
        cancel(cancelled)
    assert store.get_paper('p1')['translated_file'] == old
    with patch.object(translate, '_start_task'):
        renewed = restart()
    command = [sys.executable,'-c',"import sys; from pathlib import Path; assert '--ignore-cache' in sys.argv; Path('new-mono.pdf').write_bytes(b'new')"]
    with patch.object(translate.plugin_manager, 'runtime', return_value=(command, base / 'engine-home')), patch.object(translate, '_page_count', return_value=1):
        translate._run_one(renewed['id'])
    current = store.get_paper('p1')
    assert current['translation_task_id'] == renewed['id']
    assert current['translated_file'] != old and Path(current['translated_file']).read_bytes() == b'new'
    assert Path(old).exists()
    print('PASS retranslation deduplication, cache bypass, failed/cancelled old-output preservation and successful replacement')

    # 启动三个真实子进程。每个进程等自己的信号，串行实现无法通过这里的同步检查。
    script = """
import time
from pathlib import Path
print('LITHUB-PROGRESS 25 Parse Page Layout', flush=True)
while not Path('finish').exists():
    time.sleep(0.02)
Path('test-mono.pdf').write_bytes(Path.cwd().name.encode())
"""
    command = [sys.executable, '-u', '-c', script]

    def wait_until(check):
        deadline = time.monotonic() + 8
        while not check():
            assert time.monotonic() < deadline, 'timed out waiting for concurrent translation'
            time.sleep(.02)

    jobs = []
    with patch.object(translate.plugin_manager, 'runtime', return_value=(command, base / 'engine-home')), \
         patch.object(translate, '_page_count', return_value=1):
        try:
            for pid in ('p2', 'p3', 'p4'):
                jobs.append(start(pid))
            assert all(job['status'] == 'running' for job in jobs)
            wait_until(lambda: all(store.get_task(job['id'])['progress'] == 25 for job in jobs))
            with translate._procs_lock:
                assert len({translate._procs[job['id']].pid for job in jobs}) == 3
            assert start('p3')['id'] == jobs[1]['id']
            assert cancel(jobs[0])['status'] == 'cancelled'
            for job in jobs[1:]:
                assert store.get_task(job['id'])['status'] == 'running'
                (store.output_dir / job['paper_id'] / job['id'] / 'finish').touch()
            wait_until(lambda: all(store.get_task(job['id'])['status'] == 'done' for job in jobs[1:]))
            assert not store.get_paper('p2')['translated']
            for job in jobs[1:]:
                paper = store.get_paper(job['paper_id'])
                assert paper['translation_task_id'] == job['id']
                assert Path(paper['translated_file']).read_text() == job['id']
        finally:
            for job in jobs:
                translate.cancel_task(job['id'])
            wait_until(lambda: not any(job['id'] in translate._procs for job in jobs))
    print('PASS three engine processes run in parallel; cancellation, deduplication and output stay isolated')
