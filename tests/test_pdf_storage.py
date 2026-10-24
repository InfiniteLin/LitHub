import copy
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from pdf_storage import PdfStorage, digest, writable


class PdfStorageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='lithub-storage-')
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.program = self.base / 'program'
        self.data = self.base / 'metadata'
        self.data.mkdir()
        self.db = {'library_id': 'library-one', 'papers': {}, 'settings': {}, 'tasks': {},
                   'notes': {'a': [{'content': 'keep note'}]}}
        self.storage = PdfStorage(self.data, self.program)
        self.saved = 0

    def save(self): self.saved += 1

    def seed(self):
        original = self.data / 'files/a.pdf'
        original.parent.mkdir(parents=True)
        original.write_bytes(b'original PDF bytes')
        mono = self.data / 'out/a/a-mono.pdf'
        mono.parent.mkdir(parents=True)
        mono.write_bytes(b'translated PDF bytes')
        dual = mono.with_name('a-dual.pdf')
        dual.write_bytes(b'bilingual PDF bytes')
        self.db['papers']['a'] = {'title': 'paper', 'hash': digest(original),
                                  'translated_file': str(mono), 'translated_dual_file': str(dual)}

    def test_new_library_defaults_to_program_folder(self):
        self.storage.initialize(self.db, self.save)
        self.assertEqual(self.storage.root, self.program / 'pdfs')
        self.assertTrue(self.storage.files.is_dir())
        self.assertEqual(self.saved, 1)

    def test_existing_pdfs_move_together_and_keep_original_copy(self):
        self.seed()
        notes = copy.deepcopy(self.db['notes'])
        self.storage.initialize(self.db, self.save)
        self.assertEqual(self.storage.root, self.data, 'legacy library is not moved during startup')
        self.storage.change(self.db, self.storage.default, self.save)
        self.assertEqual(self.storage.root, self.program / 'pdfs')
        self.assertEqual(digest(self.storage.files / 'a.pdf'), self.db['papers']['a']['hash'])
        self.assertTrue((self.data / 'files/a.pdf').is_file())
        self.assertTrue(Path(self.db['papers']['a']['translated_file']).is_relative_to(self.storage.root))
        self.assertTrue(Path(self.db['papers']['a']['translated_dual_file']).is_file())
        self.assertEqual(notes, self.db['notes'])
        result = self.storage.change(self.db, self.base / 'custom', self.save)
        self.assertEqual(result['copied_files'], 3)
        self.assertTrue((self.program / 'pdfs/files/a.pdf').is_file())
        # Returning to a compatible directory owned by this library is safe.
        self.storage.change(self.db, self.program / 'pdfs', self.save)
        self.assertEqual(self.storage.root, self.program / 'pdfs')

    def test_read_only_default_falls_back_to_existing_library(self):
        def check(directory):
            if directory == self.program / 'pdfs': raise PermissionError('read-only program folder')
            writable(directory)
        with patch('pdf_storage.writable', side_effect=check):
            self.storage.initialize(self.db, self.save)
        self.assertEqual(self.storage.root, self.data)
        self.assertIn('read-only', self.storage.warning)
        self.assertTrue(self.storage.files.is_dir())

    def test_save_failure_rolls_back_paths_and_copied_files(self):
        self.seed()
        before = copy.deepcopy(self.db)
        target = self.base / 'custom'
        def fail(): raise OSError('disk full')
        with self.assertRaises(OSError): self.storage.change(self.db, target, fail)
        self.assertEqual(self.db, before)
        self.assertEqual(self.storage.root, self.data)
        self.assertFalse((target / 'files/a.pdf').exists())
        self.assertTrue((self.data / 'files/a.pdf').exists())

    def test_corrupt_copy_is_rejected_without_switch(self):
        self.seed()
        with patch('pdf_storage.shutil.copyfileobj', side_effect=lambda source, out: out.write(b'broken')):
            with self.assertRaises(OSError): self.storage.change(self.db, self.base / 'custom', self.save)
        self.assertEqual(self.storage.root, self.data)
        self.assertNotIn('pdf_storage_dir', self.db['settings'])

    def test_busy_translation_blocks_migration(self):
        self.db['tasks']['t'] = {'status': 'queued'}
        with self.assertRaisesRegex(ValueError, '翻译'): self.storage.change(self.db, self.base / 'custom', self.save)
        self.assertFalse((self.base / 'custom').exists())

    def test_foreign_library_and_conflicting_file_are_not_overwritten(self):
        self.seed()
        self.storage.initialize(self.db, self.save)
        self.storage.change(self.db, self.storage.default, self.save)
        target = self.base / 'other'
        target.mkdir()
        (target / self.storage.marker).write_text('{"library_id":"another-library"}', encoding='utf-8')
        with self.assertRaisesRegex(ValueError, '其他文献库'): self.storage.change(self.db, target, self.save)
        (self.data / 'files/a.pdf').write_bytes(b'conflict')
        with self.assertRaisesRegex(ValueError, '已有文件|内容不同'): self.storage.change(self.db, self.data, self.save)
        self.assertEqual((self.data / 'files/a.pdf').read_bytes(), b'conflict')

    def test_invalid_and_overlapping_paths_are_rejected(self):
        self.seed()
        for target in ('', 'relative-path', str(self.data / 'files/nested'), str(self.program)):
            with self.assertRaises(ValueError): self.storage.change(self.db, target, self.save)

    def test_missing_pdf_does_not_switch_to_empty_folder(self):
        self.seed()
        (self.data / 'files/a.pdf').unlink()
        with self.assertRaisesRegex(ValueError, '原文文件缺失'): self.storage.change(self.db, self.base / 'custom', self.save)
        self.assertNotIn('pdf_storage_dir', self.db['settings'])

    def test_unavailable_saved_directory_is_reported_without_resetting(self):
        self.seed()
        self.db['settings']['pdf_storage_dir'] = str(self.base / 'offline')
        self.storage.initialize(self.db, self.save)
        self.assertEqual(self.storage.root, self.base / 'offline')
        self.assertIn('不可用', self.storage.warning)
        self.assertFalse(self.storage.root.exists())


if __name__ == '__main__': unittest.main()
