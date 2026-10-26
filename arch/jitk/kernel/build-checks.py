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
            subprocess.run(['rustc', '+1.95.0', '--edition=2024', str(ROOT / 'build.rs'), '-o', str(exe)], check=True)
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


class Borrowing(unittest.TestCase):
    def test_mutable_open_cannot_escape(self):
        with tempfile.TemporaryDirectory(prefix='jitk-borrow-check-') as tmp:
            root = Path(tmp)
            source = (ROOT / 'src/fs.rs').read_text()
            # Old API accepts two live mutable references. The replacement must
            # reject returning a mutable reference from the scoped callback.
            if "Result<&'static mut Open" in source:
                body = 'let a = fs::get(3).unwrap(); let b = fs::get(3).unwrap(); a.pos = 1; b.pos = 2;'
            else:
                body = 'let _a = fs::with_open(3, |o| o);'
            harness = r"""
#![allow(dead_code, static_mut_refs)]
mod syscalls {
    pub fn copyin(_:usize,_:&mut [u8])->Result<(),isize>{Ok(())}
    pub fn copyout(_:usize,_:&[u8])->Result<(),isize>{Ok(())}
}
mod mmu {pub fn physical(n:usize)->usize{n}}
mod user {pub const FS:usize=0;pub const FS_LEN:usize=0;}
""" + f'#[path={json.dumps(str(ROOT / "src/fs.rs"))}] mod fs;\nfn main(){{ {body} }}'
            (root / 'check.rs').write_text(harness)
            result = subprocess.run(['rustc', '+1.95.0', '--edition=2024', str(root / 'check.rs'), '-o', str(root / 'check')], capture_output=True)
            self.assertNotEqual(result.returncode, 0, 'mutable Open escaped the safe API')
            self.assertIn(b'lifetime may not live long enough', result.stderr)

    def test_scoped_descriptor_state(self):
        with tempfile.TemporaryDirectory(prefix='jitk-fd-check-') as tmp:
            root = Path(tmp)
            harness = r"""
#![allow(dead_code)]
mod syscalls {
    pub fn copyin(_:usize,_:&mut [u8])->Result<(),isize>{Ok(())}
    pub fn copyout(_:usize,_:&[u8])->Result<(),isize>{Ok(())}
}
mod mmu {pub fn physical(n:usize)->usize{n}}
mod user {pub const FS:usize=0;pub const FS_LEN:usize=0;}
mod console {pub unsafe fn native()->bool{false}pub unsafe fn load(_:usize)->u64{0}}
""" + f'#[path={json.dumps(str(ROOT / "src/ring_abi.rs"))}] mod ring_abi;#[path={json.dumps(str(ROOT / "src/fs.rs"))}] mod fs;' + f'#[path={json.dumps(str(ROOT / "src/fs_checks.rs"))}] mod checks;'
            (root / 'check.rs').write_text(harness)
            for features in [[], ['--cfg', 'feature="transport-ring"']]:
                subprocess.run(['rustc', '+1.95.0', '--edition=2024', '--test', *features, str(root / 'check.rs'), '-o', str(root / 'check')], check=True)
                subprocess.run([str(root / 'check')], check=True)


class Fdt(unittest.TestCase):
    def test_bounded_boot_configuration(self):
        with tempfile.TemporaryDirectory(prefix='jitk-fdt-check-') as tmp:
            root = Path(tmp)
            (root / 'test.rs').write_text('#![allow(dead_code, reason="Boot wrapper is unused by host parser checks.")]\n' + '\n'.join(f'#[path={json.dumps(str(ROOT / "src" / file))}] mod {name};' for file, name in [('fdt.rs','fdt'), ('fdt_checks.rs','checks')]))
            subprocess.run(['rustc', '+1.95.0', '--edition=2024', '--test', str(root / 'test.rs'), '-o', str(root / 'test')], check=True)
            subprocess.run([str(root / 'test')], check=True)


if __name__ == '__main__':
    unittest.main()
