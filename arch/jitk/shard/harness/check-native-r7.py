#!/usr/bin/env python3
"""Shard regression gate: rebuild fresh profiles, compare all 41 cases twice.

Linux arm64 KVM plus the checksum-pinned census artifacts are required; missing
prerequisites fail the gate. Prepared files are temporary, receipts are retained.
"""
import json, os, pathlib, shutil, signal, subprocess, tempfile
from native_r7_lock import locked

ROOT = pathlib.Path(os.environ.get('JITK_NATIVE_ROOT', str(pathlib.Path(__file__).resolve().parents[4]))).resolve()
HARNESS = ROOT/'arch/jitk/shard/harness'
OUT = pathlib.Path(os.environ.get('JITK_NATIVE_CHECK_OUTPUT', str(ROOT/'arch/jitk/shard/test-results/native'))).resolve()

def checked(command, env, seconds=600):
    # Offline-only group cleanup also stops a hung descendant KVM worker.
    p = subprocess.Popen(command, env=env, start_new_session=True)
    try:
        code = p.wait(timeout=seconds)
    except BaseException:
        os.killpg(p.pid, signal.SIGKILL)
        p.wait()
        raise
    if code:
        raise subprocess.CalledProcessError(code, command)

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.native-check-', dir=ROOT) as tmp:
        run = pathlib.Path(tmp)
        env = dict(os.environ, JITK_NATIVE_ROOT=str(ROOT), JITK_NATIVE_RUN_DIR=tmp)
        for key in ('JITK_NATIVE_CLASSES', 'JITK_NATIVE_TOOLS'):
            env.pop(key, None)  # The gate always tests the shipped six profiles.
        checked(['python3', str(HARNESS/'prepare-native-r7.py')], env)
        for rep in (1, 2):
            checked(locked(['python3', str(HARNESS/'native-corpus-r7.py')]), env)
            rows = json.loads((run/'raw/corpus.json').read_text())
            assert len(rows) == 41 and all(r['pass_exact'] for r in rows)
            shutil.copyfile(run/'raw/corpus.json', OUT/f'corpus-{rep}.json')
        for probe in ('fd', 'regions'):
            checked(['python3', str(HARNESS/f'check-native-{probe}-r7.py')], env)
        # A recognized larger-class sidecar cannot enlarge a smaller image.
        bad = run/'images/mismatched'
        for ext in ('mem', 'regs'):
            bad.with_suffix('.'+ext).symlink_to(run/f'images/lua-r7.{ext}')
        bad.with_suffix('.layout').write_bytes((run/'images/zstd-r7.layout').read_bytes())
        denied = subprocess.run([str(ROOT/'arch/jitk/shard/target/release/real'),
            'native-worker', f'bad={bad}'], stdin=subprocess.DEVNULL, capture_output=True)
        assert denied.returncode != 0 and b'snapshot/layout mismatch' in denied.stderr
        (run/'raw/layout-defense.json').write_text(json.dumps(dict(
            rejected=True, returncode=denied.returncode, stderr=denied.stderr.decode()))+'\n')
        shutil.copytree(run/'raw', OUT, dirs_exist_ok=True)
        shutil.copyfile(run/'profiles.json', OUT/'profiles.json')
    print('native regression: 41/41 exact twice; fd and region probes PASS')

if __name__ == '__main__':
    main()
