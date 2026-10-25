"""Explicit legacy second-QEMU backend; its watchdog lives on the Mac."""
import json
import os
from pathlib import Path
import sys

from watch import run

w = Path(sys.argv[1])
log = Path(sys.argv[2])
command = ['qemu-system-aarch64', '-M', 'virt,virtualization=on,gic-version=3',
           '-accel', 'hvf', '-cpu', 'host', '-smp', os.getenv('JITK_NESTED_VCPUS', '1'),
           '-m', '6144', '-kernel', str(w / 'vmlinuz'), '-initrd', str(w / 'test.cpio.gz'),
           '-append', 'console=ttyAMA0 rdinit=/init quiet', '-nographic', '-no-reboot']
(log.parent / 'nested-command.json').write_text(json.dumps(
    [arg.replace(str(w), '$JITK_WORK') for arg in command], indent=2) + '\n')
sys.exit(run(command, log))
