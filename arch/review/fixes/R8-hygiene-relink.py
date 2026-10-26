#!/usr/bin/env python3
"""Relink the VMM against existing pinned libkrun rlibs, without rebuilding upstream."""
import hashlib
import json
import os
from pathlib import Path
import platform
import subprocess

root = Path(__file__).resolve().parents[3] / 'arch/jitk/vmm'
out = Path(os.environ['JITK_VMM_BUILD']).resolve()
out.mkdir(parents=True, exist_ok=True)
deps = out / 'libkrun/target/release/deps'
args = ['rustc', '+1.95.0', '--edition=2024', '-O', '-C', 'lto=fat', '-C',
        'panic=abort', '--cfg', 'sandbox_ready', '--extern', f'krun={deps}/libkrun.rlib',
        '-L', f'dependency={deps}']
for crate, pattern in [('libc', 'liblibc-*.rlib'), ('utils', 'libkrun_utils-*.rlib')]:
    matches = list(deps.glob(pattern))
    assert len(matches) == 1, (crate, matches)
    args += ['--extern', f'{crate}={matches[0]}']

sources = [('src/main.rs', 'jitk-vmm')]
if platform.system() == 'Linux':
    sources += [('tests/seccomp-probe.rs', 'seccomp-probe')]
for source, name in sources:
    subprocess.run(args + [str(root / source), '-o', str(out / name)], check=True)
    if platform.system() == 'Darwin':
        subprocess.run(['strip', '-x', str(out / name)], check=True)
        subprocess.run(['codesign', '--force', '--sign', '-', '--entitlements',
                        str(root / 'hypervisor.entitlements'), str(out / name)], check=True)
    else:
        subprocess.run(['strip', str(out / name)], check=True)

hash_file = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
metadata = {
    'revision': 'a1d8616765da03980f3be1bb8714bfdd3842f33c',
    'patches_sha256': {p.name: hash_file(p) for p in (root / 'patches').glob('*.diff')},
    'panic': 'abort', 'features': [], 'sandbox_ready': True,
    'binary': str(out / 'jitk-vmm'), 'binary_sha256': hash_file(out / 'jitk-vmm'),
    'rustc': subprocess.check_output(['rustc', '+1.95.0', '--version'], text=True).strip(),
    'relink_command': args,
    'source_sha256': {str(p.relative_to(root)): hash_file(p)
                      for p in [*root.glob('src/*.rs'), root / 'sandbox/mod.rs']},
}
(out / 'build.json').write_text(json.dumps(metadata, indent=2) + '\n')
print(json.dumps(metadata, indent=2))
