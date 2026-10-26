#!/usr/bin/env python3
"""Format every kernel input, including handlers reached through generated Rust."""
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parent
subprocess.run(['rustfmt', '+1.95.0', '--edition', '2024', *sys.argv[1:],
                str(root / 'build.rs'), *map(str, sorted((root / 'src').rglob('*.rs')))], check=True)
