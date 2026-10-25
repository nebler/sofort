#!/usr/bin/env python3
"""Round-4 integration receipts. No mutation of owner subtrees.

poll: one marker observation; wait: observations every 600 s, for <=150 min.
scan: strict byte/symlink scan of EVERY entry (no generated/evidence exemption).
audit: original R3 LOC script plus per-R3-duplicate-group disposition.
run: literal cp -R into an unpredictable basename, make build test, make demo.
"""
import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import signal
import subprocess
import time

HERE = Path(__file__).resolve().parent
AREA = HERE.parent
ROOT = AREA.parent / 'jitk'
CHECKOUT = AREA.parent.parent
SCRATCH = Path('/tmp/jitk-10/r4')
OWNERS = ('kernel', 'executor', 'grow', 'bench', 'bench/hyperlight', 'linux')
EXCLUDED = {'node_modules', 'target', 'build', 'dist', 'results', 'evidence', 'out',
            '.git', '__pycache__', '.work', '.npm-cache'}


def utc():
    return datetime.now(timezone.utc).isoformat()


def digest(data):
    return hashlib.sha256(data).hexdigest()


def save(name, value):
    (HERE / name).write_text(json.dumps(value, indent=2) + '\n')


def context():
    return {'utc': utc(), 'load': list(os.getloadavg()),
            'uptime': subprocess.check_output(['uptime'], text=True).strip()}


def source_inventory(root):
    result = {}
    for directory, subdirs, files in os.walk(root, followlinks=False):
        subdirs[:] = sorted(n for n in subdirs if n not in EXCLUDED and not (Path(directory)/n).is_symlink())
        for name in sorted(files):
            path = Path(directory)/name
            if path.is_symlink():
                result[str(path.relative_to(root))] = {'link': os.readlink(path)}
            elif path.is_file():
                result[str(path.relative_to(root))] = digest(path.read_bytes())
    return result


def poll():
    state = json.loads((HERE/'poll-state.json').read_text())
    row = context()
    row['markers'] = {}
    for owner in OWNERS:
        path = ROOT / owner / '.R4'
        row['markers'][owner] = ({'sha256': digest(path.read_bytes()), 'text': path.read_text()}
                                 if path.is_file() else None)
    row['all_present'] = all(row['markers'].values())
    row['deadline_reached'] = datetime.now(timezone.utc) >= datetime.fromisoformat(state['deadline_utc'])
    state['polls'].append(row)
    save('poll-state.json', state)
    print(json.dumps({'utc': row['utc'], 'present': [k for k,v in row['markers'].items() if v],
                      'all_present': row['all_present'], 'deadline_reached': row['deadline_reached']}), flush=True)
    return row['all_present'] or row['deadline_reached']


def scan(root, output):
    # No directory, extension, binary, receipt, or generated-output exclusions.
    pattern = re.compile(rb'/tmp/jitk-[0-9]{2}(?![0-9])|arch/[0-9]{2}-|'+re.escape(CHECKOUT.name.encode()))
    result = {'context': context(), 'root': str(root), 'scope': 'all regular file bytes and symlink targets; no exclusions; symlinks not followed',
              'pattern': pattern.pattern.decode(), 'files': 0, 'symlinks': 0, 'bytes': 0, 'hits': [], 'errors': []}
    for directory, subdirs, files in os.walk(root, followlinks=False, onerror=lambda e: result['errors'].append(str(e))):
        for name in sorted(subdirs + files):
            p = Path(directory)/name
            try:
                if p.is_symlink():
                    data = os.readlink(p).encode(); result['symlinks'] += 1; kind = 'symlink'
                elif p.is_file():
                    data = p.read_bytes(); result['files'] += 1; kind = 'file'
                else:
                    continue
                result['bytes'] += len(data)
                matches = list(pattern.finditer(data))
                if matches:
                    result['hits'].append({'path': str(p.relative_to(root)), 'kind': kind,
                        'sha256': digest(data), 'matches': len(matches),
                        'examples': [{'byte': m.start(), 'line': data.count(b'\n', 0, m.start())+1,
                                      'matched': m.group().decode(errors='replace')} for m in matches[:20]]})
            except OSError as e:
                result['errors'].append({'path': str(p), 'error': str(e)})
    result['pass'] = not result['hits'] and not result['errors']
    result['hit_files_by_component'] = dict(Counter(h['path'].split('/')[0] for h in result['hits']))
    save(output, result)
    print(json.dumps({k:v for k,v in result.items() if k not in {'hits','errors'}}), flush=True)
    return 0 if result['pass'] else 1


def audit():
    # Load the R3 script unchanged; count copies rather than subtracting them.
    p = ROOT/'docs/count-loc.py'
    spec = importlib.util.spec_from_file_location('r3_loc', p)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    inventory = module.inventory()
    inventory['load_context'] = context(); inventory['script_sha256'] = digest(p.read_bytes())
    save('loc-final.json', inventory)
    old = json.loads((AREA/'r3/source-audit-final.json').read_text())
    groups = []
    for paths in old['identical_source_groups']:
        current = []
        for rel in paths:
            p = ROOT/rel
            current.append({'path': rel, 'exists': p.is_file(),
                            'sha256': digest(p.read_bytes()) if p.is_file() else None,
                            'symlink': os.readlink(p) if p.is_symlink() else None})
        surviving = [v for v in current if v['exists'] and not v['symlink']]
        groups.append({'r3_group': paths, 'current': current,
                       'identical_copies_remain': len(surviving)>1 and len({v['sha256'] for v in surviving})==1})
    result = {'context': context(), 'original_audit_sha256': digest((AREA/'r3/source-audit-final.json').read_bytes()),
              'r3_total': json.loads((AREA/'r3/loc-final.json').read_text())['total'],
              'r4_total': inventory['total'], 'delta': inventory['total']-10658,
              'r3_duplicate_groups': groups, 'current_identical_source_groups': inventory['identical_source_groups'],
              'active_source_inventory': source_inventory(ROOT)}
    save('source-audit-final.json', result)
    print(json.dumps({'total': inventory['total'], 'delta': result['delta'], 'components':inventory['components'],
                      'r3_identical_groups_remaining': [g['r3_group'] for g in groups if g['identical_copies_remain']]}))


def run_command(argv, cwd, env, log, timeout):
    item = {'argv': argv, 'cwd': str(cwd), 'before': context(), 'timeout_s': timeout}
    start = time.monotonic()
    with log.open('w') as stream:
        proc = subprocess.Popen(argv, cwd=cwd, env=env, stdout=stream, stderr=subprocess.STDOUT, start_new_session=True)
        item['pid'] = proc.pid
        try:
            item['exit'] = proc.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            item['timed_out'] = True
            os.killpg(proc.pid, signal.SIGKILL)
            item['exit'] = proc.wait()
        finally:
            # Descendants must not survive a completed or failed top-level command.
            try:
                os.killpg(proc.pid, signal.SIGTERM)
                time.sleep(.2)
                os.killpg(proc.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
    item.update(elapsed_s=time.monotonic()-start, after=context(), log=log.name, log_sha256=digest(log.read_bytes()))
    print(json.dumps(item), flush=True)
    return item


def run():
    SCRATCH.mkdir(parents=True, exist_ok=True)
    destination = SCRATCH/('relocated-'+secrets.token_hex(6))
    work = SCRATCH/(destination.name+'-work'); work.mkdir()
    node = Path(os.environ.get('JITK_NODE', '/tmp/jitk-09/node-real'))
    npm = Path(os.environ.get('JITK_NPM_CLI') or subprocess.check_output(['which','npm'],text=True).strip()).resolve()
    assert node.is_absolute() and node.is_file() and npm.name == 'npm-cli.js' and npm.is_file()
    subprocess.run([str(node), '-e', 'if(+process.versions.node.split(".")[0]<24)process.exit(1)'], check=True)
    env = dict(os.environ, JITK_NODE=str(node), NODE=str(node), JITK_NPM_CLI=str(npm),
               JITK_NPM_CACHE=str(SCRATCH/'npm-cache'),
               JITK_KERNEL_CARGO_TARGET_DIR=str(work/'kernel-target'),
               JITK_VMM_BUILD=str(work/'vmm'), JITK_VMM_BINARY=str(work/'vmm/jitk-vmm'),
               JITK_TEST_IMAGES=str(work/'test-images'), JITK_WORK=str(work/'linux'),
               CARGO_BUILD_JOBS='2', TMPDIR=str(SCRATCH))
    external = {}
    for key in ('HYPERLIGHT_WORKER', 'HYPERLIGHT_SNAPSHOT', 'JITK_NESTED_BASE', 'JITK_CANONICAL_VMM'):
        if key not in env: continue
        original = Path(env[key]).resolve(strict=True)
        target = work/'external-inputs'/key/original.name
        target.parent.mkdir(parents=True,exist_ok=True)
        if key == 'JITK_NESTED_BASE':
            target.mkdir()
            for name in ('base.cpio.gz','vmlinuz'): shutil.copy2(original/name,target/name)
        elif original.is_dir(): shutil.copytree(original,target)
        else:
            shutil.copy2(original,target)
            if key == 'JITK_CANONICAL_VMM': shutil.copy2(original.parent/'build.json',target.parent/'build.json')
        env[key] = str(target)
        external[key] = {'original':str(original),'selected':str(target),
                         'sha256':digest(target.read_bytes()) if target.is_file() else source_inventory(target)}
    # Optional pre-provisioned external inputs are passed explicitly, never silently inferred by owner code.
    receipt = {'started': context(), 'destination': str(destination), 'work':str(work),
               'command': f'cp -R arch/jitk {destination} && (cd {destination} && make build test); make demo',
               'overrides': {k:v for k,v in env.items() if k.startswith(('JITK_','HYPERLIGHT_')) or k in {'CARGO_BUILD_JOBS','TMPDIR','NODE','LIBKRUN_SOURCE'}},
               'external_inputs':external,
               'node_sha256':digest(node.read_bytes()), 'source_before_copy':source_inventory(ROOT)}
    receipt['copy'] = run_command(['cp','-R',str(ROOT),str(destination)], CHECKOUT, env, HERE/'copy.log', 600)
    if receipt['copy']['exit'] == 0:
        receipt['source_after_copy'] = source_inventory(ROOT)
        receipt['copied_source'] = source_inventory(destination)
        receipt['copy_source_stable'] = receipt['source_before_copy'] == receipt['source_after_copy'] == receipt['copied_source']
        save('i1.json', receipt)
        receipt['build_test'] = run_command(['make','build','test'], destination, env, HERE/'build-test.log', 4200)
        save('i1.json', receipt)
        # Run even when aggregate I1 fails, recording the exact first demo failure independently.
        receipt['demo'] = run_command(['make','demo'], destination, env, HERE/'demo.log', 900)
        receipt['post_demo_source'] = source_inventory(destination)
        for name, p in {'built_vmm':work/'vmm/jitk-vmm','built_kernel':destination/'kernel/dist/kernel.bin',
                        'build_manifest':work/'vmm/build.json'}.items():
            receipt[name] = {'path':str(p),'sha256':digest(p.read_bytes())} if p.is_file() else None
    receipt['finished'] = context()
    save('i1.json', receipt)
    return 0 if receipt.get('build_test',{}).get('exit') == receipt.get('demo',{}).get('exit') == 0 else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['poll','wait','scan','audit','run'])
    parser.add_argument('--root',type=Path,default=ROOT)
    parser.add_argument('--output',default='path-scan-final.json')
    args = parser.parse_args()
    if args.action == 'poll': poll(); return 0
    if args.action == 'wait':
        while True:
            state = json.loads((HERE/'poll-state.json').read_text())
            last = state['polls'][-1] if state['polls'] else None
            if last and (last['all_present'] or last['deadline_reached']): return 0
            deadline = datetime.fromisoformat(state['deadline_utc'])
            next_poll = datetime.fromisoformat(last['utc']).timestamp()+600 if last else time.time()
            seconds = max(0,min(next_poll-time.time(),(deadline-datetime.now(timezone.utc)).total_seconds()))
            for _ in range(int(seconds//60)):
                time.sleep(60)
                print(json.dumps({'waiting_utc':utc(),'load':list(os.getloadavg())}),flush=True)
            time.sleep(seconds%60)
            if poll(): return 0
        return 0
    if args.action == 'scan': return scan(args.root,args.output)
    if args.action == 'audit': audit(); return 0
    return run()


if __name__ == '__main__':
    raise SystemExit(main())
