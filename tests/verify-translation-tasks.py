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
        'papers': {'p1': {'id': 'p1', 'title': 'test', 'translated': False}},
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

    def start():
        response = client.post('/api/translate', json={'paper_id': 'p1'})
        assert response.status_code == 200, response.text
        return response.json()

    def cancel(task):
        response = client.post(f'/api/tasks/{task["id"]}/cancel')
        assert response.status_code == 200, response.text
        return response.json()

    with patch.object(translate, 'enqueue') as enqueue:
        with ThreadPoolExecutor(max_workers=12) as pool:
            tasks = list(pool.map(lambda _: start(), range(24)))
        first = tasks[0]
        assert len({t['id'] for t in tasks}) == 1
        enqueue.assert_called_once_with(first['id'])
        for _ in range(60):
            store.add_task('another-paper')
        assert start()['id'] == first['id'], 'dedup must search beyond the latest 50 tasks'
        active = client.get('/api/tasks?active_only=true').json()
        assert len(active) == 61 and first['id'] in {t['id'] for t in active}, 'update guard must inspect all active tasks'
        assert cancel(first)['status'] == 'cancelled'
        assert first['id'] not in {t['id'] for t in client.get('/api/tasks?active_only=true').json()}
        assert cancel(first)['status'] == 'cancelled'
        with patch.object(translate.subprocess, 'Popen') as popen:
            translate._run_one(first['id'])
            popen.assert_not_called()
        retry = start()
        assert retry['id'] != first['id'] and retry['status'] == 'queued'
    print('PASS concurrent API deduplication, full queue lookup, queued cancellation and resubmission')

    # Cancel while the worker is preparing the command, before Popen registration.
    entered, release = threading.Event(), threading.Event()
    def slow_command():
        entered.set()
        assert release.wait(5)
        return [sys.executable, '-c', 'pass']
    with patch.object(translate, '_pdf2zh_cmd', slow_command), patch.object(translate.subprocess, 'Popen') as popen:
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

    with patch.object(translate, 'enqueue'):
        running = start()
    with patch.object(translate, '_pdf2zh_cmd', return_value=[sys.executable, '-u', '-c',
              "import time; print('10%|', flush=True); time.sleep(30)"]):
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

    with patch.object(translate, 'enqueue'):
        completed = start()
    command = [sys.executable, '-c', "from pathlib import Path; Path('test-mono.pdf').write_bytes(b'test')"]
    with patch.object(translate, '_pdf2zh_cmd', return_value=command), patch.object(translate, '_page_count', return_value=1):
        translate._run_one(completed['id'])
    assert store.get_task(completed['id'])['status'] == 'done'
    assert store.get_paper('p1')['translated']
    assert cancel(completed)['status'] == 'done'
    assert client.post('/api/translate', json={'paper_id': 'p1'}).status_code == 400
    assert client.post('/api/translate', json={'paper_id': 'missing'}).status_code == 404
    assert client.post('/api/tasks/missing/cancel').status_code == 404
    print('PASS normal completion, terminal cancellation idempotency and missing resource handling')
