#!/usr/bin/env python3
"""Run fresh validate-only loops; compare normalized JSON receipts and gate evidence.

This is a development acceptance harness, never used by the native controller.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
PYTHON = ROOT.parent / 'grow'
sys.path.insert(0, str(PYTHON))
from observations import observe
TIMING_KEYS = {'seconds', 'uptime', 'uptime_before', 'uptime_after', 'benchmark', 'load_gate',
               'commit', 'controller_sha256'}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else None


def markers():
    return {str(path): digest(path) for root in (ROOT, PYTHON)
            for path in (root / 'release.json', root / '.READY')}


def space():
    free = shutil.disk_usage('/System/Volumes/Data').free
    subprocess.run(['df', '-h', '/System/Volumes/Data'], check=True)
    assert free >= 15 * 1024**3, 'less than 15 GiB free; stop'


def normalize(value, roots):
    if isinstance(value, dict):
        if value.get('discovery_kill_expected'):
            assert value['missing'] and value['returncode'] in (0, -9), 'unexpected discovery termination'
            value = dict(value, returncode='completed-or-killed-after-first-miss')
        if 'verification_sha256' in value and 'verification' in value:
            raw = (json.dumps(value['verification'], indent=2) + '\n').encode()
            assert hashlib.sha256(raw).hexdigest() == value['verification_sha256'], 'invalid verification hash'
            value = dict(value, verification_sha256=hashlib.sha256(json.dumps(normalize(value['verification'], roots), sort_keys=True).encode()).hexdigest())
        return {key: normalize(item, roots) for key, item in sorted(value.items())
                if key not in TIMING_KEYS}
    if isinstance(value, list):
        return [normalize(item, roots) for item in value]
    if isinstance(value, str):
        for root in roots:
            value = value.replace(str(root), '<run>')
        value = value.replace(str(ROOT.parent.parent.parent.parent), '<repo>')
        value = re.sub(r'(?:/private)?/var/folders/[^\s"\']+/jitk-grow-[^/\s"\']+', '<scratch>', value)
        value = re.sub(r'/tmp/jitk-grow-[^/\s"\']+', '<scratch>', value)
        return value
    return value


def differences(a, b, path='$'):
    if type(a) is not type(b):
        return [f'{path}: {type(a).__name__} != {type(b).__name__}']
    if isinstance(a, dict):
        out = [f'{path}: keys {set(a) ^ set(b)}'] if set(a) != set(b) else []
        for key in sorted(set(a) & set(b)):
            out.extend(differences(a[key], b[key], path + '.' + key))
        return out
    if isinstance(a, list):
        if len(a) != len(b):
            return [f'{path}: length {len(a)} != {len(b)}']
        return [line for i, pair in enumerate(zip(a, b))
                for line in differences(*pair, path + f'[{i}]')]
    return [] if a == b else [f'{path}: {str(a)[:180]!r} != {str(b)[:180]!r}']


def receipts(base):
    return {str(path.relative_to(base)): path for path in base.rglob('*.json')}


def observation_receipt(base, name):
    path = base / name
    stem = name.removesuffix('.observations.json')
    raw_path = base / (stem + '.stdout')
    if not raw_path.exists() and stem.endswith('/integration'):
        raw_path = base / (stem + '-run.stdout')
    raw = raw_path.read_bytes()
    stored = json.loads(path.read_text())
    # Assert full raw evidence preservation before applying discovery's stop boundary.
    assert stored == observe(raw), f'observation receipt lost evidence: {path}'
    if name.startswith('before-'):
        prefix = bytearray()
        for line in raw.splitlines(keepends=True):
            prefix.extend(line)
            if b'\x1e' in line:
                record = json.loads(line.split(b'\x1e', 1)[1])
                if record.get('kind') == 'missing':
                    break
        return observe(bytes(prefix))
    return stored


def compare(py, ts, output):
    left, right = receipts(py), receipts(ts)
    errors = []
    if set(left) != set(right):
        errors.append({'file_set_difference': sorted(set(left) ^ set(right))})
    compared = 0
    hashes = {}
    for name in sorted(set(left) & set(right)):
        a = normalize(observation_receipt(py, name) if name.endswith('.observations.json') else json.loads(left[name].read_text()), (py, ts))
        b = normalize(observation_receipt(ts, name) if name.endswith('.observations.json') else json.loads(right[name].read_text()), (py, ts))
        delta = differences(a, b)
        if delta:
            errors.append({'file': name, 'differences': delta[:30], 'total': len(delta)})
        compared += 1
        hashes[name] = {
            'python': hashlib.sha256(json.dumps(a, sort_keys=True).encode()).hexdigest(),
            'typescript': hashlib.sha256(json.dumps(b, sort_keys=True).encode()).hexdigest(),
        }
    py_report = json.loads((py / 'report.json').read_text())
    ts_report = json.loads((ts / 'report.json').read_text())
    rows = []
    for a, b in zip(py_report['transactions'], ts_report['transactions']):
        rows.append({'target': a['name'], 'python': a['gate'], 'typescript': b['gate'],
                     'samples': a['acceptance']['n'],
                     'python_mutants': len(a['acceptance']['mutations']),
                     'typescript_mutants': len(b['acceptance']['mutations']),
                     'integration': [a['acceptance']['unchanged_integration'], b['acceptance']['unchanged_integration']],
                     'stages_equal': set(a['stages']) == set(b['stages'])})
    result = {'status': 'PASS' if not errors else 'FAIL', 'python': str(py), 'typescript': str(ts),
              'json_receipts_compared': compared, 'rows': rows, 'differences': errors,
              'normalized_sha256': hashes}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({key: value for key, value in result.items() if key not in ('normalized_sha256', 'differences')}, indent=2))
    if errors:
        print(f'{len(errors)} differing receipts; see {output}')
    return not errors


def run(command, log):
    space()
    with log.open('w') as stream:
        result = subprocess.run(command, stdout=stream, stderr=subprocess.STDOUT, timeout=1800)
    assert result.returncode == 0, f'{command}: failed; see {log}'


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--prefix', default='grow-ts-parity')
    ap.add_argument('--samples', type=int, default=30)
    ap.add_argument('--sqlite-elf', type=Path)
    ap.add_argument('--database', type=Path)
    ap.add_argument('--compare-only', action='store_true')
    args = ap.parse_args()
    assert re.fullmatch(r'[a-zA-Z0-9_-]+', args.prefix)
    before = markers()
    (ROOT / 'build').mkdir(exist_ok=True)
    all_pass = True
    try:
        if not args.compare_only:
            assert args.sqlite_elf and args.database
            subprocess.run(['make', '-C', str(ROOT), 'build', 'test'], check=True)
        for label in ('original', 'sqlite'):
            py_id = args.prefix + '-python-' + label
            ts_id = args.prefix + '-native-' + label
            py = PYTHON / 'results' / py_id
            ts = ROOT / 'results' / ts_id
            if not args.compare_only:
                common = ['--validate-only', '--samples', str(args.samples)]
                if label == 'sqlite':
                    common += ['--target', 'fstat', '--target', 'pread64', '--sqlite-elf', str(args.sqlite_elf.resolve()), '--database', str(args.database.resolve())]
                run(['python3', '-B', str(PYTHON / 'loop.py'), '--run-id', py_id, *common], ROOT / 'build' / (py_id + '.log'))
                run([str(ROOT / 'build/grow'), '--run-id', ts_id, *common], ROOT / 'build' / (ts_id + '.log'))
            all_pass &= compare(py, ts, ROOT / 'evidence' / (label + '-parity.json'))
    finally:
        assert markers() == before, 'release.json/.READY changed during validate-only parity'
        (ROOT / 'evidence').mkdir(exist_ok=True)
        (ROOT / 'evidence' / 'release-markers.json').write_text(json.dumps({'status': 'PASS', 'unchanged': before}, indent=2) + '\n')
    raise SystemExit(0 if all_pass else 1)


if __name__ == '__main__':
    main()
