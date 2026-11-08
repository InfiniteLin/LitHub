import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from translation_plugin import PluginManager


class PluginTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.manager = PluginManager(Path(self.temp.name) / 'plugins')

    def prepare_environment(self, folder):
        executable = folder / ('python.exe' if sys.platform == 'win32' else 'bin/python')
        executable.parent.mkdir(parents=True, exist_ok=True)
        executable.write_bytes(b'test')

    def install(self, error=None, cancel=False):
        manager = self.manager
        def bootstrap(folder):
            wheel = folder / 'pip-bootstrap.whl'
            wheel.write_bytes(b'pip')
            return wheel
        calls = []
        def run(cmd, **kwargs):
            calls.append(cmd)
            if error:
                raise ValueError(error)
            if cancel:
                manager.cancel()
        with patch.object(manager, '_json', return_value={'releases': {'1.9.11': [{}]}}), \
                patch.object(manager, '_environment', side_effect=self.prepare_environment), \
                patch.object(manager, '_bootstrap', side_effect=bootstrap), \
                patch.object(manager, '_run', side_effect=run):
            manager._work('install')
        return calls

    def test_stable_compatible_versions_only(self):
        self.assertEqual(PluginManager._latest({'releases': {
            '1.9.11': [{}], '1.10.0': [{}], '1.11.0': [{'yanked': True}],
            '2.0.0': [{}], '1.12.0rc1': [{}]}}), '1.10.0')

    def test_successful_install_routes_to_verified_runtime_and_restore(self):
        calls = self.install()
        self.assertEqual(len(calls), 2)
        snapshot = self.manager.snapshot()
        self.assertEqual(snapshot['source'], 'independent')
        self.assertEqual(snapshot['current'], '1.9.11')
        self.assertIn('pdf2zh==1.9.11', calls[0])
        self.assertTrue(Path(self.manager.command()[0]).is_file())
        self.manager.start('restore')
        self.assertIsNone(self.manager.command())

    def test_failed_reinstall_and_cancel_preserve_active_pointer(self):
        self.install()
        old = self.manager.command()
        self.install(error='network failure')
        self.assertEqual(self.manager.command(), old)
        self.assertEqual(self.manager.snapshot()['status'], 'error')
        self.assertEqual(len(list(self.manager.root.glob('pdf2zh-*'))), 1)
        self.install(cancel=True)
        self.assertEqual(self.manager.command(), old)
        self.assertIn('取消', self.manager.snapshot()['message'])
        self.assertEqual(len(list(self.manager.root.glob('pdf2zh-*'))), 1)

    def test_guard_blocks_install_restore_and_final_activation(self):
        def blocked():
            raise ValueError('active translation')
        self.manager.guard = blocked
        for operation in ('install', 'restore'):
            with self.assertRaisesRegex(ValueError, 'active translation'):
                self.manager.start(operation)
        self.install()
        self.assertIsNone(self.manager.command())
        self.assertEqual(self.manager.snapshot()['status'], 'error')

    def test_duplicate_operation_blocked_and_pointer_paths_rejected(self):
        self.manager.state['status'] = 'installing'
        with self.assertRaises(ValueError):
            self.manager.start('install')
        self.manager.root.mkdir()
        (self.manager.root / 'active.json').write_text(json.dumps({'directory': '../elsewhere', 'version': '1.9.11'}))
        self.assertIsNone(self.manager.command())

    def test_check_does_not_install(self):
        with patch.object(self.manager, '_json', return_value={'releases': {'1.9.11': [{}]}}):
            self.manager._work('check')
        self.assertEqual(self.manager.snapshot()['latest'], '1.9.11')
        self.assertFalse(self.manager.root.exists())


if __name__ == '__main__':
    unittest.main()
