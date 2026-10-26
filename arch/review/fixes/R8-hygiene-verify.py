#!/usr/bin/env python3
"""Reproduce hygiene validation; all new receipts/logs live under ignored .work/."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[3]
SUITES = 'kernel vmm vmm/sandbox protocol executor executor/policy mcp grow bench bench/hyperlight linux'.split()
parser = argparse.ArgumentParser()
parser.add_argument('--certify', action='store_true')
parser.add_argument('--suites', nargs='*', default=SUITES)
args = parser.parse_args()
out = ROOT / '.work/validation'
out.mkdir(parents=True, exist_ok=True)
status = lambda: subprocess.check_output(['git', 'status', '--porcelain'], cwd=ROOT, text=True)
assert not status(), 'start from a clean worktree'
result = {'head': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
          'uptime': subprocess.check_output(['uptime'], text=True).strip(), 'suites': {}}
for suite in args.suites:
    command = [sys.executable, str(ROOT / 'arch/jitk/docs/delegate.py'), suite, 'test']
    with (out / (suite.replace('/', '-') + '.log')).open('w') as log:
        completed = subprocess.run(command, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT)
    result['suites'][suite] = completed.returncode
    print(f'{suite}: {completed.returncode}', flush=True)
    assert completed.returncode == 0, f'{suite} failed; see {log.name}'
if args.certify:
    path = ROOT / 'arch/jitk/docs/delegate.py'
    spec = importlib.util.spec_from_file_location('delegate', path)
    delegate = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(delegate)
    with delegate.test_tree() as tree:
        command = ['/usr/bin/lockf', '-k', '/tmp/sofort-bench.lock',
                   '/bin/sh', str(tree / 'executor/run.sh'), 'certify']
        with (out / 'certify.log').open('w') as log:
            completed = subprocess.run(command, cwd=tree / 'executor', stdout=log, stderr=subprocess.STDOUT)
        result['certify'] = completed.returncode
        assert completed.returncode == 0, f'certification failed; see {log.name}'
        for name in ('.READY', 'breakdown-results.json', 'integration-selection.json'):
            shutil.copy2(tree / 'executor' / name, out / ('certify-' + name.lstrip('.')))
result['status_after'] = status()
assert not result['status_after'], result['status_after']
(out / 'summary.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
