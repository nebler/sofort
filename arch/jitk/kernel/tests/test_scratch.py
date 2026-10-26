"""Regression coverage for test output isolation and read-only scratch cleanup."""
import importlib.util
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

TESTS = Path(__file__).resolve().parent


class ScratchTests(unittest.TestCase):
    def test_cleanup_after_exception(self):
        with tempfile.TemporaryDirectory() as parent:
            env = {**os.environ, 'TMPDIR': parent, 'PYTHONPATH': str(TESTS)}
            run = subprocess.run([sys.executable, '-c', '''
from scratch import workspace
root = workspace('JITK_SCRATCH_REGRESSION', 'regression')
(root / 'ro').mkdir()
(root / 'ro/file').write_text('data')
(root / 'ro/file').chmod(0o444)
(root / 'ro').chmod(0o555)
raise RuntimeError('intentional')
'''], env=env, capture_output=True)
            self.assertNotEqual(run.returncode, 0)
            self.assertEqual(list(Path(parent).iterdir()), [])

    def test_override_kept_writable(self):
        with tempfile.TemporaryDirectory() as parent:
            root = Path(parent) / 'work'
            env = {**os.environ, 'JITK_SCRATCH_REGRESSION': str(root), 'PYTHONPATH': str(TESTS)}
            subprocess.run([sys.executable, '-c', '''
from scratch import workspace
root = workspace('JITK_SCRATCH_REGRESSION', 'regression')
(root / 'ro').mkdir()
(root / 'ro').chmod(0o555)
'''], env=env, check=True)
            self.assertTrue((root / 'ro').stat().st_mode & 0o200)

    def test_delegated_receipt_does_not_overwrite_source(self):
        path = TESTS.parents[1] / 'docs/delegate.py'
        spec = importlib.util.spec_from_file_location('delegate', path)
        delegate = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(delegate)
        with tempfile.TemporaryDirectory() as parent:
            root = Path(parent) / 'jitk'
            owner = root / 'kernel'
            owner.mkdir(parents=True)
            (owner / 'README.md').write_text('test owner')
            (owner / 'Makefile').write_text('test:\n\tprintf fresh > receipt.json\n'
                                           '\tprintf fresh > dist/manifest.json\n'
                                           '\tprintf binary > dist/kernel.bin\n')
            (owner / 'dist').mkdir()
            manifest = owner / 'dist/manifest.json'
            manifest.write_text('historical manifest')
            subprocess.run(['git', 'init', '-q', str(root)], check=True)
            subprocess.run(['git', '-C', str(root), 'add', 'kernel/dist/manifest.json'], check=True)
            receipt = owner / 'receipt.json'
            receipt.write_text('historical')
            with patch.object(delegate, 'ROOT', root), patch.object(sys, 'argv', ['delegate', 'kernel', 'test']):
                self.assertEqual(delegate.main(), 0)
            self.assertEqual(receipt.read_text(), 'historical')
            self.assertEqual(manifest.read_text(), 'historical manifest')
            self.assertEqual((owner / 'dist/kernel.bin').read_text(), 'binary')


if __name__ == '__main__':
    unittest.main()
