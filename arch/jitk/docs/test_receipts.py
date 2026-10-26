"""Offline regressions for receipt preservation and explicit recording."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class ReceiptTests(unittest.TestCase):
    def test_protocol_generators_compare_instead_of_rewriting(self):
        node = os.environ.get('JITK_NODE')
        if not node:
            self.skipTest('set JITK_NODE to a verified absolute Node >=24')
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            for name in ('build.mjs', 'dispatcher.ts', 'dispatcher.js', 'make-vectors.py', 'vectors.json'):
                shutil.copy2(ROOT / 'protocol' / name, directory / name)
            env = {key: value for key, value in os.environ.items() if key != 'JITK_RECORD'}
            for script, executable, fixture in [('build.mjs', node, 'dispatcher.js'),
                                                ('make-vectors.py', sys.executable, 'vectors.json')]:
                path = directory / fixture
                before = (path.read_bytes(), path.stat().st_mtime_ns)
                subprocess.run([executable, str(directory / script)], check=True, env=env,
                               capture_output=True)
                self.assertEqual((path.read_bytes(), path.stat().st_mtime_ns), before)
                path.write_text('stale evidence')
                stale = subprocess.run([executable, str(directory / script)], env=env, capture_output=True)
                self.assertNotEqual(stale.returncode, 0)
                self.assertEqual(path.read_text(), 'stale evidence')
                subprocess.run([executable, str(directory / script)], check=True,
                               env={**env, 'JITK_RECORD': '1'}, capture_output=True)
                self.assertEqual(path.read_bytes(), before[0])

    def test_kernel_build_keeps_recorded_manifest(self):
        # Exercise artifact.py without compiling a guest: its payload/verification
        # inputs are immaterial to the output-path contract.
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            script = directory / 'artifact.py'
            shutil.copy2(ROOT / 'kernel/artifact.py', script)
            output = directory / 'dist'
            output.mkdir()
            (output / 'kernel.bin').write_bytes(b'fixture image')
            (output / 'manifest.json').write_text('recorded')
            packed = directory / 'out'
            packed.mkdir()
            for name in ('features', 'syscalls', 'packed', 'argv'):
                (packed / f'{name}.json').write_text('[]')
            elf = directory / 'guest'
            elf.with_suffix('.d').write_text(str(packed / 'packed.rs'))
            env = {key: value for key, value in os.environ.items() if key != 'JITK_RECORD'}
            subprocess.run([sys.executable, str(script), str(elf), str(output)], check=True,
                           env=env, capture_output=True)
            self.assertEqual((output / 'manifest.json').read_text(), 'recorded')
            self.assertTrue((directory / '.work/dist/manifest.json').is_file())
            subprocess.run([sys.executable, str(script), str(elf), str(output)], check=True,
                           env={**env, 'JITK_RECORD': '1'}, capture_output=True)
            self.assertEqual(json.loads((output / 'manifest.json').read_text())['bytes'], 13)


    def test_failed_linux_setup_preserves_recorded_ready_and_reports(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            for name in ('nested.sh', 'output.sh'):
                source = ROOT / 'linux' / name
                if source.exists():
                    shutil.copy2(source, directory / name)
            (directory / '.READY').write_text('recorded readiness')
            (directory / 'out').mkdir()
            for name in ('report.json', 'report.md'):
                (directory / 'out' / name).write_text('recorded report')
            env = {key: value for key, value in os.environ.items()
                   if key not in ('JITK_RECORD', 'JITK_WORK', 'JITK_LINUX_OUT', 'JITK_LINUX_READY')}
            result = subprocess.run(['/bin/bash', str(directory / 'nested.sh')], env=env,
                                    capture_output=True)
            self.assertNotEqual(result.returncode, 0)  # missing built VM inputs
            self.assertEqual((directory / '.READY').read_text(), 'recorded readiness')
            self.assertEqual((directory / 'out/report.json').read_text(), 'recorded report')
            self.assertEqual((directory / 'out/report.md').read_text(), 'recorded report')


if __name__ == '__main__':
    unittest.main()
