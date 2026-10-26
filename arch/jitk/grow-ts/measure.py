#!/usr/bin/env python3
"""Measure process-to-reap --help startup; use the documented benchmark lock."""
import hashlib
import json
import os
from pathlib import Path
import platform
import statistics
import subprocess
import time

root = Path(__file__).resolve().parent
binary = root / 'build/grow'
assert os.getloadavg()[0] < 6, 'load gate exceeded'
before = subprocess.check_output(['uptime'], text=True).strip()
samples = []
for _ in range(100):
    start = time.perf_counter_ns()
    subprocess.run([str(binary), '--help'], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=3)
    samples.append((time.perf_counter_ns() - start) / 1_000_000)
after = subprocess.check_output(['uptime'], text=True).strip()
result = {'method': '100 warm filesystem process launches through --help, wall time spawn-to-reap; includes module initialization and reading fixed assets; no VM/model/oracle',
          'lock': '/usr/bin/lockf -k /tmp/sofort-bench.lock',
          'scriptc': subprocess.check_output([str(root / 'node_modules/.bin/scriptc'), '--version'], text=True).strip(),
          'platform': platform.platform(), 'machine': platform.machine(),
          'binary_bytes': binary.stat().st_size, 'binary_sha256': hashlib.sha256(binary.read_bytes()).hexdigest(),
          'startup_ms': {'n': len(samples), 'median': statistics.median(samples), 'p90': sorted(samples)[89], 'samples': samples},
          'uptime_before': before, 'uptime_after': after}
(root / 'evidence').mkdir(exist_ok=True)
(root / 'evidence/native-binary.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({key: value for key, value in result.items() if key != 'startup_ms'}, indent=2))
print('startup median ms:', result['startup_ms']['median'])
