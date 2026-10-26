#!/usr/bin/env python3
"""An oversized FIFO profile must be rejected without waiting for writer EOF."""
import argparse
import os
from pathlib import Path
import subprocess
import tempfile
import threading

parser = argparse.ArgumentParser()
parser.add_argument('--binary', required=True)
parser.add_argument('--image', required=True)
args = parser.parse_args()
with tempfile.TemporaryDirectory(prefix='jitk-profile-bound-') as directory:
    fifo = Path(directory) / 'profile'
    os.mkfifo(fifo)
    release = threading.Event()
    def write():
        with fifo.open('wb', buffering=0) as stream:
            stream.write(bytes((1 << 16) + 1))
            release.wait(10)
    writer = threading.Thread(target=write, daemon=True)
    writer.start()
    child = subprocess.Popen([args.binary, '--image', args.image, '--sandbox-profile', str(fifo)],
                             stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        stdout, stderr = child.communicate(timeout=3)
        assert child.returncode == 70 and b'bad compiled profile' in stderr, (child.returncode, stderr)
    finally:
        if child.poll() is None:
            child.kill()
            child.communicate()
        release.set()
        writer.join(timeout=2)
print('PASS: oversized profile rejected before EOF (maximum read 65537 bytes)')
