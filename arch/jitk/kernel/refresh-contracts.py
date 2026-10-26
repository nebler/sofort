#!/usr/bin/env python3
"""Reverify changed kernel sources before refreshing contract source digests.

The scratch build intentionally omits the historical verification manifest:
its artifacts make no inherited verification claim. Only a successful complete
kernel contract suite permits a source-digest refresh in the canonical manifest.
Historical semantic/mutation evidence is preserved, with an explicit amendment.
"""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'dist/r8'
IGNORED = {'dist', 'target', 'target-ring', 'test-work', 'test-results', '__pycache__', '.READY', '.R4', 'syscalls.manifest.json'}


def digest(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def inputs():
    return {str(p.relative_to(ROOT)): digest(p) for p in sorted(ROOT.rglob('*'))
            if p.is_file() and not any(part in IGNORED for part in p.relative_to(ROOT).parts)}


def writable_remove(path):
    for p in path.rglob('*'):
        if p.is_dir() and not p.is_symlink():
            p.chmod(0o755)
    shutil.rmtree(path)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    before = inputs()
    manifest = ROOT / 'syscalls.manifest.json'
    manifest_sha = digest(manifest)
    value = json.loads(manifest.read_text())
    tmp = Path(tempfile.mkdtemp(prefix='jitk-contract-refresh-'))
    try:
        kernel = tmp / 'kernel'
        shutil.copytree(ROOT, kernel, ignore=shutil.ignore_patterns(*IGNORED))
        for sibling in ('protocol', 'grow', 'bench'):
            (tmp / sibling).symlink_to(ROOT.parent / sibling, target_is_directory=True)
        env = {k: v for k, v in os.environ.items() if k not in {
            'JITK_ELF', 'JITK_ARGV_JSON', 'JITK_SCRIPT', 'JITK_RESOURCES',
            'JITK_OUT_DIR', 'CARGO_TARGET_DIR', 'JITK_TEST_KERNEL', 'JITK_KERNEL_IMAGE',
            'JITK_FS_WORK', 'JITK_GROW_CONTRACT_WORK', 'JITK_PROBE_WORK'}}
        env['JITK_TEST_OUTPUT'] = str(OUT / 'contracts')
        with (OUT / 'contracts.log').open('w') as log:
            subprocess.run(['make', '-C', str(kernel), 'test'], env=env, stdout=log, stderr=subprocess.STDOUT, check=True)
        assert inputs() == before, 'kernel sources changed during contract verification'
        assert digest(manifest) == manifest_sha, 'verification manifest changed during verification'
        changed = {}
        for row in value['contracts']:
            current = digest(ROOT / f'src/syscalls/{row["name"]}.rs')
            if row['source_sha256'] != current:
                changed[row['name']] = dict(old=row['source_sha256'], new=current)
                row['source_sha256'] = current
        receipt = dict(status='PASS', at=datetime.now(timezone.utc).isoformat(),
                       command='make -C SCRATCH/kernel test', sources=before, changed_hashes=changed,
                       log_sha256=digest(OUT / 'contracts.log'))
        raw = json.dumps(receipt, indent=2) + '\n'
        (OUT / 'contract-refresh.json').write_text(raw)
        value['r8_amendment'] = dict(
            scope='Historical gates retained; source digests refreshed only after the complete R8 kernel contract suite passed on an unverified scratch build.',
            generator='refresh-contracts.py', receipt='dist/r8/contract-refresh.json',
            receipt_sha256=hashlib.sha256(raw.encode()).hexdigest(),
            changed_hashes=changed)
        pending = manifest.with_suffix('.json.tmp')
        pending.write_text(json.dumps(value, indent=2) + '\n')
        pending.replace(manifest)
        print(json.dumps(dict(status='PASS', changed_hashes=changed), indent=2))
    finally:
        writable_remove(tmp)


if __name__ == '__main__':
    main()
