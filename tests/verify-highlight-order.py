"""Verify persistent highlight order in a disposable library, including legacy ties."""
import os
import sys
import tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
with tempfile.TemporaryDirectory(prefix='lithub-highlight-') as directory:
    os.environ['LITHUB_DATA_DIR'] = directory
    os.environ['LITHUB_PDF_DEFAULT_DIR'] = str(Path(directory) / 'pdfs')
    from store import Store
    store = Store()
    old = store.add_annotation('paper', dict(view='en',kind='highlight',color='yellow',rects=[dict(x=.1,y=.3,w=.5,h=.1)]))
    new = store.add_annotation('paper', dict(view='en',kind='highlight',color='blue',rects=[dict(x=.1,y=.2,w=.5,h=.2)]))
    # Old libraries had second precision: geometry sorting must not lose storage order.
    for a in store._db['annotations']['paper']:
        a['created'] = '2026-11-06T10:00:00'
    store._flush()
    reloaded = Store()
    records = reloaded.list_annotations('paper')
    assert [a['id'] for a in records] == [new['id'], old['id']]
    assert [a['paint_order'] for a in records] == [1,0]
    changed = reloaded.update_annotation('paper', old['id'], color='pink')
    assert changed['modified'] > changed['created']
    stamp = changed['modified']
    assert reloaded.update_annotation('paper', old['id'], comment='test')['modified'] == stamp
    persisted = Store().list_annotations('paper')
    assert next(a for a in persisted if a['id']==old['id'])['modified'] == stamp
    assert len(persisted) == 2, 'original records remain available for deletion/undo'
print('PASS persisted highlight precedence, legacy second ties, recolor and reload')

