"""Plugin API/task mutual exclusion using an isolated library, without downloads."""
import os
from pathlib import Path
import sys
import tempfile
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
with tempfile.TemporaryDirectory(prefix='lithub-plugin-api-') as temporary:
    root = Path(temporary)
    os.environ.update(LITHUB_DATA_DIR=str(root / 'data'), LITHUB_PROGRAM_DIR=str(root),
                      LITHUB_PDF_DEFAULT_DIR=str(root / 'pdfs'))
    from fastapi.testclient import TestClient
    import main
    import translate
    import search_index
    try:
        with TestClient(main.app) as client, patch.object(translate, 'enqueue'):
            snapshot = client.get('/api/settings/translation-plugin')
            assert snapshot.status_code == 200
            assert snapshot.json()['directory'] == str(root / 'translation-plugins/pdf2zh')
            source = root / 'sample.pdf'
            source.write_bytes(b'test fixture')
            paper = main.store.add_paper(source, 'sample.pdf', 1, 'Plugin test')
            response = client.post('/api/translate', json={'paper_id': paper['id']})
            assert response.status_code == 200, response.text
            task = response.json()
            for operation in ('install', 'restore'):
                response = client.post('/api/settings/translation-plugin/' + operation)
                assert response.status_code == 409, response.text
            client.post(f"/api/tasks/{task['id']}/cancel")
            main.translate.plugin_manager.state['status'] = 'installing'
            response = client.post('/api/translate', json={'paper_id': paper['id']})
            assert response.status_code == 400 and '插件' in response.json()['detail']
            assert client.post('/api/settings/translation-plugin/install').status_code == 409
            assert client.post('/api/settings/translation-plugin/cancel').status_code == 200
            main.translate.plugin_manager.state['status'] = 'idle'
            assert client.post('/api/translate', json={'paper_id': paper['id']}).status_code == 200
        print('PASS plugin API, translation/update mutual exclusion, duplicate install guard and cancellation')
    finally:
        search_index.close()
