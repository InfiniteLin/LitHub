"""Isolated HTTP integration test; seeds its own DB to disable legacy-data migration."""
import hashlib
from io import BytesIO
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pypdf import PdfWriter


def pdf(width):
    writer = PdfWriter()
    writer.add_blank_page(width=width, height=200)
    buffer = BytesIO()
    writer.write(buffer)
    return buffer.getvalue()


with tempfile.TemporaryDirectory(prefix='lithub-pdf-http-') as temporary:
    base = Path(temporary)
    metadata, program = base / 'metadata', base / 'program'
    metadata.mkdir()
    # paths.py must see an existing library. Never copy the developer's real data.
    (metadata / 'library.json').write_text(json.dumps({'papers': {}, 'settings': {}, 'tasks': {}}), encoding='utf-8')
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    env = {**os.environ, 'LITHUB_DATA_DIR': str(metadata), 'LITHUB_PROGRAM_DIR': str(program),
           'LITHUB_PDF_DEFAULT_DIR': str(program / 'pdfs'), 'PYTHONDONTWRITEBYTECODE': '1'}
    env['LITHUB_API_PORT'] = str(port)
    process = None
    def request(route, method='GET', body=None, content_type='application/json'):
        data = json.dumps(body).encode() if isinstance(body, dict) else body
        req = urllib.request.Request(f'http://127.0.0.1:{port}{route}', data=data, method=method,
                                     headers={'Content-Type': content_type})
        with urllib.request.urlopen(req, timeout=15) as response:
            result = response.read()
            return json.loads(result) if 'application/json' in response.headers.get('Content-Type', '') else result
    def start():
        child = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'main:app', '--host', '127.0.0.1',
                                  '--port', str(port), '--app-dir', 'backend', '--log-level', 'error'],
                                 cwd=Path(__file__).resolve().parents[1], env=env,
                                 stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
                                 creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        for _ in range(100):
            if child.poll() is not None:
                raise RuntimeError(child.stderr.read().decode(errors='replace'))
            try:
                request('/api/health')
                return child
            except Exception: time.sleep(0.1)
        child.terminate()
        child.wait()
        raise RuntimeError('sidecar readiness timeout')
    def upload(content):
        boundary = 'LitHubTestBoundary'
        body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="sample.pdf"\r\n'
                'Content-Type: application/pdf\r\n\r\n').encode() + content + f'\r\n--{boundary}--\r\n'.encode()
        return request('/api/import', 'POST', body, f'multipart/form-data; boundary={boundary}')
    try:
        process = start()
        first = upload(pdf(100))
        current = request('/api/settings/pdf-storage')
        assert Path(current['directory']) == program / 'pdfs'
        original = program / 'pdfs/files' / f'{first["id"]}.pdf'
        assert original.is_file()
        request(f'/api/papers/{first["id"]}/notes', 'POST', {'title': 'note', 'content': 'preserve note'})
        target = base / '自定义文献目录'
        result = request('/api/settings/pdf-storage', 'POST', {'directory': str(target)})
        assert Path(result['directory']) == target
        assert original.is_file(), 'source backup retained'
        assert hashlib.sha256(request(f'/api/papers/{first["id"]}/file')).hexdigest() == first['hash']
        assert request(f'/api/papers/{first["id"]}/notes')[0]['content'] == 'preserve note'
        second = upload(pdf(120))
        assert (target / 'files' / f'{second["id"]}.pdf').is_file()
        print('PASS default program folder, Unicode migration, preserved PDF and notes, new imports')
        process.terminate()
        process.wait(5)
        process = start()
        assert Path(request('/api/settings/pdf-storage')['directory']) == target
        assert len(request('/api/papers')) == 2
        request(f'/api/papers/{second["id"]}', 'DELETE')
        assert not (target / 'files' / f'{second["id"]}.pdf').exists()
        print('PASS persistence across sidecar restart and deletion in configured directory')
    finally:
        if process and process.poll() is None:
            process.terminate()
            process.wait(5)
