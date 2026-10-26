#!/usr/bin/env python3
"""Host regressions for build generation and kernel ownership/parser boundaries."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent


class Slots(unittest.TestCase):
    def test_dispatch_ignores_json_presentation_and_rejects_invalid_input(self):
        with tempfile.TemporaryDirectory(prefix='jitk-build-check-') as tmp:
            root = Path(tmp)
            out = root / 'out'
            out.mkdir()
            shutil.copytree(ROOT / 'src/syscalls', root / 'src/syscalls')
            if (ROOT / 'generate.py').exists():
                shutil.copy(ROOT / 'generate.py', root)
            (root / 'prepare.py').write_text("import pathlib,sys\n(pathlib.Path(sys.argv[2])/'packed.rs').write_text('')\n")
            exe = root / 'build'
            subprocess.run(['rustc', '--edition=2024', str(ROOT / 'build.rs'), '-o', str(exe)], check=True)
            env = dict(os.environ, CARGO_MANIFEST_DIR=str(root), OUT_DIR=str(out), JITK_SCRIPT='0')
            def generate(value):
                (root / 'slots.json').write_text(value)
                return subprocess.run([str(exe)], env=env, capture_output=True)
            source = (ROOT / 'slots.json').read_text()
            self.assertEqual(generate(source).returncode, 0)
            dispatch = (out / 'dispatch.rs').read_bytes()
            manifest = (out / 'syscalls.json').read_bytes()
            self.assertEqual(generate(json.dumps(json.loads(source), separators=(',', ':'))).returncode, 0)
            self.assertEqual((out / 'dispatch.rs').read_bytes(), dispatch)
            self.assertEqual((out / 'syscalls.json').read_bytes(), manifest)
            for invalid in ['[]', '{"63":"read","63":"write"}', '{"063":"read"}',
                            '{"-1":"read"}', '{"63":1}', '{"63":"../read"}',
                            '{"63":"read"} trailing', '{"63":"type"}']:
                with self.subTest(invalid=invalid):
                    self.assertNotEqual(generate(invalid).returncode, 0)


if __name__ == '__main__':
    unittest.main()
