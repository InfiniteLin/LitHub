import json
import os
from pathlib import Path
import sys
import tempfile
import subprocess
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from note_storage import NoteStorage


class NoteStorageTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        self.data = self.base / 'appdata'
        self.program = self.base / 'software'
        self.legacy = self.data / 'notes'
        self.legacy.mkdir(parents=True)
        self.name = 'a' * 32 + '.png'
        (self.legacy / self.name).write_bytes(b'original image')
        self.notes = {'paper': [{'id': 'note', 'content': '![image](/api/notes/image/' + self.name + ')'}]}

    def storage(self, program=None, previous=None, library='test-library'):
        return NoteStorage(self.data, program or self.program, library, previous)

    def test_migration_and_reload_without_resurrecting_deleted_notes(self):
        store = self.storage()
        self.assertEqual(store.load(self.notes), self.notes)
        self.assertTrue(store.file.is_relative_to(self.program))
        self.assertEqual((store.images / self.name).read_bytes(), b'original image')
        self.assertTrue((self.legacy / self.name).exists())
        self.assertEqual(json.loads((store.root / 'migration-backup.json').read_text()), self.notes)
        store.save({})
        self.assertEqual(self.storage().load(self.notes), {})

    def test_relocation_copies_current_notes_and_images(self):
        first = self.storage()
        first.load(self.notes)
        second = self.storage(self.base / 'new-software', first.root)
        self.assertEqual(second.load({}), self.notes)
        self.assertEqual((second.images / self.name).read_bytes(), b'original image')
        self.assertTrue(first.file.exists())

    def test_failed_copy_is_retryable_and_does_not_activate_empty_index(self):
        store = self.storage()
        with patch('note_storage.shutil.copyfile', side_effect=OSError('disk full')):
            with self.assertRaises(OSError): store.load(self.notes)
        self.assertFalse(store.file.exists())
        self.assertEqual(store.load(self.notes), self.notes)

    def test_invalid_or_missing_index_never_becomes_empty_library(self):
        store = self.storage()
        store.load(self.notes)
        store.file.write_text('corrupt')
        with self.assertRaises(ValueError): self.storage().load({})
        with self.assertRaises(FileNotFoundError):
            self.storage(self.base / 'other', self.base / 'missing').load({})

    def test_atomic_save_failure_retains_old_index(self):
        store = self.storage()
        store.load(self.notes)
        before = store.file.read_bytes()
        with patch('note_storage.os.replace', side_effect=OSError('disk full')):
            with self.assertRaises(OSError): store.save({})
        self.assertEqual(store.file.read_bytes(), before)

    def test_real_store_migrates_contents_out_of_metadata_and_reopens(self):
        self.data.mkdir(exist_ok=True)
        (self.data / 'library.json').write_text(json.dumps({'library_id':'test-library','papers':{},'tasks':{},'settings':{},'notes':self.notes}))
        script = '''
import json, os
from pathlib import Path
from store import store, Store, STORE_PATH
assert store.get_note('paper','note')['content'].startswith('![image]')
assert store.note_images_dir.is_relative_to(Path(os.environ['LITHUB_PROGRAM_DIR']))
assert (store.note_images_dir/('a'*32+'.png')).read_bytes()==b'original image'
assert 'notes' not in json.loads(STORE_PATH.read_text(encoding='utf8'))
store.update_note('paper','note',content='new content')
assert Store().get_note('paper','note')['content']=='new content'
os.environ['LITHUB_PROGRAM_DIR'] += '-new-location'
moved=Store()
assert moved.get_note('paper','note')['content']=='new content'
assert moved.note_images_dir.is_relative_to(Path(os.environ['LITHUB_PROGRAM_DIR']))
'''
        result = subprocess.run([sys.executable, '-c', script], cwd=Path(__file__).resolve().parents[1]/'backend',
            env={**os.environ,'LITHUB_DATA_DIR':str(self.data),'LITHUB_PROGRAM_DIR':str(self.program)},capture_output=True,text=True,encoding='utf8',timeout=20)
        self.assertEqual(result.returncode,0,result.stderr)


if __name__ == '__main__': unittest.main()
