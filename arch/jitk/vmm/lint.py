#!/usr/bin/env python3
"""Cargo lint gate using build.py's exact pinned external crate artifacts."""
import os
from pathlib import Path
import platform
import subprocess

root = Path(__file__).resolve().parent
build = Path(os.environ.get('JITK_VMM_BUILD', f'/tmp/jitk-01/r3/{platform.system().lower()}'))
deps = build / 'libkrun/target/release/deps'
flags = ['--cfg', 'sandbox_ready', '-C', 'panic=abort', '-Zpanic_abort_tests',
         '-L', f'dependency={deps}', '--extern', f'krun={deps}/libkrun.rlib']
for crate, pattern in [('libc', 'liblibc-*.rlib'), ('utils', 'libkrun_utils-*.rlib')]:
    matches = list(deps.glob(pattern))
    if len(matches) != 1:
        raise SystemExit(f'build the pinned VMM first: expected one {pattern} in {deps}')
    flags += ['--extern', f'{crate}={matches[0]}']
env = {**os.environ, 'RUSTC_BOOTSTRAP': '1', 'CARGO_ENCODED_RUSTFLAGS': '\x1f'.join(flags)}
subprocess.run(['cargo', '+1.95.0', 'clippy', '--manifest-path', str(root / 'Cargo.toml'),
                '--locked', '--offline', '--all-targets', '--', '-Dwarnings',
                '-Dclippy::undocumented_unsafe_blocks'], env=env, check=True)
