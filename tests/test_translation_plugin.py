import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from translation_plugin import PluginManager


WHEEL = {'filename': 'pdf2zh_next-2.10.2-py3-none-any.whl', 'requires_python': '>=3.10,<3.14'}


class PluginTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.manager = PluginManager(Path(self.temp.name) / 'plugins')
        bundled = patch.object(self.manager, '_bundled_version', return_value='')
        self.bundled = bundled.start()
        self.addCleanup(bundled.stop)

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
        with patch.object(manager, '_json', return_value={'releases': {'2.10.2': [WHEEL]}}), \
                patch.object(manager, '_environment', side_effect=self.prepare_environment), \
                patch.object(manager, '_bootstrap', side_effect=bootstrap), \
                patch.object(manager, '_run', side_effect=run):
            manager._work('install')
        return calls

    def test_stable_compatible_versions_only(self):
        self.assertEqual(PluginManager._latest({'releases': {
            '1.9.11': [WHEEL], '2.10.2': [WHEEL], '2.11.0': [{**WHEEL, 'yanked': True}],
            '2.12.0': [{**WHEEL, 'requires_python': '>=4'}], '2.13.0rc1': [WHEEL],
            '3.0.0': [WHEEL]}}), '2.10.2')

    def test_successful_install_routes_to_verified_runtime_and_restore(self):
        calls = self.install()
        self.assertEqual(len(calls), 3)
        snapshot = self.manager.snapshot()
        self.assertEqual(snapshot['source'], 'independent')
        self.assertEqual(snapshot['package'], 'pdf2zh-next')
        self.assertEqual(snapshot['current'], '2.10.2')
        self.assertIn('pdf2zh-next==2.10.2', calls[0])
        self.assertIn('--bing', calls[1])
        self.assertIn('--openai', calls[2])
        command, _ = self.manager.runtime()
        self.assertEqual(command[-2:], ['-m', 'pdf2zh_next.main'])
        self.assertTrue(Path(command[0]).is_file())
        self.bundled.return_value = '2.10.2'
        self.manager.start('restore')
        self.assertEqual(self.manager.runtime()[0][0], sys.executable)
        self.assertEqual(self.manager.snapshot()['source'], 'bundled')

    def test_failed_reinstall_and_cancel_preserve_active_pointer(self):
        self.install()
        old = self.manager.runtime()
        self.install(error='network failure')
        self.assertEqual(self.manager.runtime(), old)
        self.assertEqual(self.manager.snapshot()['status'], 'error')
        self.assertEqual(len(list(self.manager.root.glob('pdf2zh-next-*'))), 1)
        self.install(cancel=True)
        self.assertEqual(self.manager.runtime(), old)
        self.assertIn('取消', self.manager.snapshot()['message'])
        self.assertEqual(len(list(self.manager.root.glob('pdf2zh-next-*'))), 1)

    def test_existing_legacy_pointer_uses_bundled_next(self):
        self.bundled.return_value = '2.10.2'
        name = 'pdf2zh-1.9.11-123456789abc'
        folder = self.manager.root / name
        self.prepare_environment(folder)
        state = json.dumps({'directory': name, 'version': '1.9.11'})
        (folder / 'ready.json').write_text(state)
        (self.manager.root / 'active.json').write_text(state)
        self.assertEqual(self.manager.snapshot()['current'], '2.10.2')
        self.assertEqual(self.manager.runtime()[0], [sys.executable, '-B', '-m', 'pdf2zh_next.main'])
        self.assertEqual(self.install(), [])
        self.assertTrue((self.manager.root / 'active.json').exists())

    def test_app_update_prefers_newer_bundled_version(self):
        self.install()
        self.bundled.return_value = '2.11.0'
        self.assertEqual(self.manager.runtime()[0][0], sys.executable)
        self.assertEqual(self.manager.snapshot()['current'], '2.11.0')
        self.assertFalse(self.manager.snapshot()['can_restore'])

    def test_guard_blocks_install_restore_and_final_activation(self):
        def blocked():
            raise ValueError('active translation')
        self.manager.guard = blocked
        for operation in ('install', 'restore'):
            with self.assertRaisesRegex(ValueError, 'active translation'):
                self.manager.start(operation)
        self.install()
        with self.assertRaises(FileNotFoundError):
            self.manager.runtime()
        self.assertEqual(self.manager.snapshot()['status'], 'error')

    def test_duplicate_operation_blocked_and_pointer_paths_rejected(self):
        self.manager.state['status'] = 'installing'
        with self.assertRaises(ValueError):
            self.manager.start('install')
        self.manager.root.mkdir()
        (self.manager.root / 'active.json').write_text(json.dumps({'directory': '../elsewhere', 'version': '1.9.11'}))
        with self.assertRaises(FileNotFoundError):
            self.manager.runtime()

    def test_check_does_not_install(self):
        with patch.object(self.manager, '_json', return_value={'releases': {'2.10.2': [WHEEL]}}) as get:
            self.manager._work('check')
        get.assert_called_once_with('https://pypi.org/pypi/pdf2zh-next/json')
        self.assertEqual(self.manager.snapshot()['latest'], '2.10.2')
        self.assertFalse(self.manager.root.exists())


if __name__ == '__main__':
    unittest.main()
