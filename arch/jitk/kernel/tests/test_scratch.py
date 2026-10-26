"""Regression coverage for test output isolation and read-only scratch cleanup."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

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



if __name__ == '__main__':
    unittest.main()
