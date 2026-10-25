"""Real note APIs in a temporary library. Never touches personal data."""
import contextlib
import io
import json
import os
import sys
import tempfile
import time
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
with tempfile.TemporaryDirectory(prefix='lithub-notes-') as temporary, contextlib.ExitStack() as cleanup:
    base=Path(temporary)
    (base/'library.json').write_text(json.dumps({'papers':{'p1':{'id':'p1','title':'test'}},'settings':{},'tasks':{}}),encoding='utf8')
    os.environ.update(LITHUB_DATA_DIR=str(base),LITHUB_PROGRAM_DIR=str(base),LITHUB_PDF_DEFAULT_DIR=str(base/'pdfs'))
    from fastapi.testclient import TestClient
    from main import app, store, NOTE_IMAGE_DIR
    import search_index
    cleanup.callback(search_index.close)
    client=TestClient(app); cleanup.callback(client.close)
    route='/api/papers/p1/notes'
    note=client.post(route,json={'title':'阅读/笔记','content':'first'}).json()
    nid=note['id']; endpoint=route+'/'+nid
    updated=client.put(endpoint,json={'content':'latest','pinned':True}).json()
    assert updated['content']=='latest' and updated['pinned'] and updated['title']=='阅读/笔记'
    second=client.post(route,json={'title':'second'}).json()
    assert client.get(route).json()[0]['id']==nid
    print('PASS note content, pin ordering and partial updates')
    image=client.post('/api/notes/image',files={'file':('test.png',b'fake image','image/png')}).json()
    content=f'![one](http://127.0.0.1:8130{image["url"]})\n<img src="{image["url"]}" style="width:80px">\n![external](https://example.com{image["url"]})'
    client.put(endpoint,json={'content':content})
    response=client.get(endpoint+'/export')
    assert response.status_code==200 and "filename*=UTF-8''" in response.headers['content-disposition']
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        assert set(archive.namelist())=={'阅读_笔记.md','images/'+image['name']}
        md=archive.read('阅读_笔记.md').decode()
        assert md.count('images/'+image['name'])==2 and 'https://example.com'+image['url'] in md
        assert archive.read('images/'+image['name'])==b'fake image'
    print('PASS portable Markdown + deduplicated image ZIP; external images are never fetched')
    (NOTE_IMAGE_DIR/image['name']).unlink()
    assert client.get(endpoint+'/export').status_code==409
    assert client.delete(endpoint).status_code==200
    restored=client.post(endpoint+'/restore').json()
    assert restored['id']==nid and restored['content']==content and restored['pinned']
    assert client.post(endpoint+'/restore').status_code==404
    client.delete(endpoint)
    timestamp,snapshot=store._note_trash[('p1',nid)]
    store._note_trash[('p1',nid)]=(time.monotonic()-61,snapshot)
    assert client.post(endpoint+'/restore').status_code==404
    assert client.get('/api/papers/missing/notes').status_code==404
    print('PASS missing asset diagnostics, exact note undo, duplicate restore and expiry')

    pinned=client.post(route,json={'title':'created pinned','pinned':True}).json()
    assert pinned['pinned'] is True
    from store import Store
    assert any(n['id']==pinned['id'] and n['pinned'] for n in Store().list_notes('p1'))
    from note_export import export_name
    assert export_name('CON')=='笔记_CON' and export_name('a/b:c')=='a_b_c'
    print('PASS pinned state survives reload and export names are filesystem safe')
