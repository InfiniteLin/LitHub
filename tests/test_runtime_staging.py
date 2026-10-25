import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('runtime_stage', Path(__file__).resolve().parents[1] / 'build/prepare-runtime.py')
stage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stage)


class RuntimeStagingTests(unittest.TestCase):
    def test_only_known_test_trees_and_build_tools_are_excluded(self):
        for path in ('Lib/site-packages/numpy/tests/test_a.py', 'Lib/site-packages/scipy/linalg/tests/data.npz',
                     'Lib/site-packages/pip/__init__.py', 'Lib/site-packages/pip-1.0.dist-info/METADATA',
                     'Lib/site-packages/foo/__pycache__/a.pyc'):
            self.assertIsNotNone(stage.excluded(Path(path)), path)
        for path in ('Lib/site-packages/numpy/testing/__init__.py', 'Lib/site-packages/scipy/_lib/_testutils.py',
                     'Lib/site-packages/numpy.libs/blas.dll', 'Lib/site-packages/pdf2zh-1.9.11.dist-info/METADATA',
                     'Lib/site-packages/custom_package/tests/__init__.py', 'Lib/site-packages/pipelinelib/__init__.py'):
            self.assertIsNone(stage.excluded(Path(path)), path)

    def test_staging_keeps_original_and_removes_stale_output_safely(self):
        with tempfile.TemporaryDirectory() as temporary:
            source, output = Path(temporary) / 'source', Path(temporary) / 'output'
            source.mkdir()
            files = {'python.exe': b'python', 'Lib/site-packages/pkg/core.py': b'print(1)',
                     'Lib/site-packages/pkg/core.pyc': b'cache',
                     'Lib/site-packages/pkg/legacy.pyc': b'sourceless module',
                     'Lib/site-packages/numpy/tests/test_a.py': b'test',
                     'Lib/site-packages/numpy/testing/__init__.py': b'helper'}
            for name, data in files.items():
                target = source / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(data)
            first = stage.prepare(source, output, verify=False)
            self.assertEqual(first['source_files'], 6)
            self.assertEqual(first['staged_files'], 4)
            self.assertTrue((source / 'Lib/site-packages/numpy/tests/test_a.py').exists())
            self.assertTrue((output / 'Lib/site-packages/numpy/testing/__init__.py').exists())
            self.assertTrue((output / 'Lib/site-packages/pkg/legacy.pyc').exists())
            (output / 'stale.bin').write_bytes(b'old')
            (source / 'Lib/site-packages/pkg/core.py').write_bytes(b'print(222)')
            stage.prepare(source, output, verify=False)
            self.assertFalse((output / 'stale.bin').exists())
            self.assertEqual((output / 'Lib/site-packages/pkg/core.py').read_bytes(), b'print(222)')
            with self.assertRaises(ValueError):
                stage.prepare(source, source, verify=False)
            unowned = Path(temporary) / 'unowned'
            unowned.mkdir()
            (unowned / 'keep.txt').write_text('important')
            with self.assertRaises(ValueError):
                stage.prepare(source, unowned, verify=False)
            self.assertTrue((unowned / 'keep.txt').exists())


if __name__ == '__main__':
    unittest.main()
