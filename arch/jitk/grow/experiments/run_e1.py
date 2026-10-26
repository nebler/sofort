"""Resumable, seeded E1 matrix. Pilot and main samples have separate CSVs."""
import argparse
import concurrent.futures
import csv
import datetime
import hashlib
import itertools
import json
import os
from pathlib import Path
import platform
import random
import shutil
import subprocess
import sys
import time

from run_e0 import FIELDS

ROOT = Path(__file__).resolve().parents[1]
VMM = Path('/tmp/jitk-01/r3/darwin/jitk-vmm')
SQLITE = Path('/tmp/growos-inputs-20261026/sqlite3-static')
DATABASE = ROOT/'results/r7-grow/demo.db'
MODELS = {'old': 'gpt-6-sol', 'new': 'gpt-6.1-sol'}


def capture(*cmd):
    return subprocess.check_output(cmd, text=True).strip()


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read(path, default=None):
    return json.loads(path.read_text()) if path.exists() else default


def design(phase, n):
    cells = itertools.product(('ppoll','fstat','pread64'), ('full','terse','none'), MODELS, range(1,n+1))
    cells = list(cells)
    random.Random(20261026).shuffle(cells)
    return [(f'e1-{phase}-v2-20261026-{target}-{spec}-{model}-{rep:02}', target, spec, model, rep)
            for target, spec, model, rep in cells]


def rows(cell, metadata):
    run_id, target, spec, model, rep = cell
    tx = ROOT/'results'/run_id/('tx-'+target)
    report = read(tx/'report.json', {})
    result = []
    for item in report.get('attempts', []):
        attempt = item['attempt']; dest = tx/f'attempt-{attempt}'
        stages = read(dest/'stages.json', {})
        visible = [v['passed'] for k,v in stages.items() if k.startswith('semantic_error_state_')]
        value = read(dest/'proposal.json', {})
        result.append(dict(run_id=run_id, date=metadata['date'], host=metadata['host'], model=MODELS[model],
            cli=metadata['cli'], spec_level=spec, target=target, attempt=attempt,
            accepted=int(item['accepted']), rejecting_gate='' if item['accepted'] else item['gate'],
            visible_pass=int(len(visible)==30 and all(visible)),
            heldout_pass=int(stages.get('heldout_candidate',{}).get('passed',False)),
            mutants_rejected=len(read(dest/'mutations.json',[])),
            integration_pass=int(item['accepted']), wall_s=item['wall_s'],
            cli_calls=int(read(dest/'agent-mode.json',{}).get('mode')=='live'),
            human_minutes=0, handler_lines=len(value['source'].splitlines()) if 'source' in value else '', human_lines=0))
    return result


def run_cell(cell, metadata):
    run_id, target, spec, model, rep = cell
    out = ROOT/'results'/run_id
    if (out/'experiment.json').exists():
        return read(out/'experiment.json')
    disk = capture('df','-h','/System/Volumes/Data')
    if shutil.disk_usage('/System/Volumes/Data').free < 15*1024**3:
        raise RuntimeError('STOP: less than 15 GiB free')
    command = [sys.executable,'-B',str(ROOT/'loop.py'),'--run-id',run_id,'--validate-only','--live',
               '--target',target,'--spec',spec,'--attempts','3','--samples','30']
    if target != 'ppoll':
        command += ['--sqlite-elf',str(SQLITE),'--database',str(DATABASE)]
    receipt = dict(date=datetime.datetime.now().astimezone().isoformat(), command=command,
                   disk_before=disk, uptime_before=capture('uptime'), model=MODELS[model],
                   replicate=rep, source_commit=metadata['source_commit'],controller_sha256=metadata['controller_sha256'])
    started = time.monotonic()
    with (ROOT/'experiments'/f'{run_id}.log').open('wb') as log:
        p = subprocess.run(command, env=dict(os.environ,JITK_VMM_BINARY=str(VMM),JITK_GROW_MODEL=MODELS[model]), stdout=log, stderr=subprocess.STDOUT)
    receipt.update(returncode=p.returncode, wall_s=time.monotonic()-started,
                   uptime_after=capture('uptime'),disk_after=capture('df','-h','/System/Volumes/Data'))
    receipt['paused'] = bool(list(out.glob('tx-*/paused.json')))
    receipt['accepted'] = read(out/('tx-'+target)/'report.json',{}).get('accepted',False)
    receipt['protected_after'] = {name:digest(ROOT/name) for name in ('.READY','release.json')}
    assert receipt['protected_after']==metadata['protected_before']
    (out/'experiment.json').write_text(json.dumps(receipt,indent=2)+'\n')
    print(run_id, 'PASS' if receipt['accepted'] else 'PAUSED' if receipt['paused'] else 'FAIL', round(receipt['wall_s'],1), flush=True)
    return receipt


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--phase',choices=('pilot','main'),required=True)
    ap.add_argument('--workers',type=int,default=3);args=ap.parse_args()
    n=2 if args.phase=='pilot' else 10
    cells=design(args.phase,n)
    assert len(cells)==18*n
    path=ROOT/'experiments'/('E1-pilot' if args.phase=='pilot' else 'E1')
    metadata = dict(date=datetime.datetime.now().astimezone().isoformat(),host=platform.platform(),
        cli=capture('codex','--version'),models=MODELS,source_commit=capture('git','rev-parse','HEAD'),
        controller_sha256={p.name:digest(p) for p in ROOT.glob('*.py')},
        oracle_image=capture('docker','image','inspect','jitk-oracle:08','--format','{{.Id}}'),
        vmm_sha256=digest(VMM),sqlite_sha256=digest(SQLITE),database_sha256=digest(DATABASE),
        disk_before=capture('df','-h','/System/Volumes/Data'),uptime_before=capture('uptime'),
        protected_before={name:digest(ROOT/name) for name in ('.READY','release.json')},
        n_per_cell=n,workers=args.workers,seed=20261026,phase=args.phase,design=cells,
        accounting='human_minutes=0 and human_lines=0: no interactive human coding during sampling; prior human profile/spec work is not measured; implementation-agent work is reported separately')
    existing=read(path.with_suffix('.json'))
    if existing:
        assert existing['controller_sha256']==metadata['controller_sha256'], 'controller changed; do not mix runs'
        metadata=existing
    path.with_suffix('.json').write_text(json.dumps(metadata,indent=2)+'\n')
    completed={};remaining=iter(cells);halt=False
    def save():
        with path.with_suffix('.csv').open('w',newline='') as file:
            writer=csv.DictWriter(file,fieldnames=FIELDS);writer.writeheader()
            for cell in cells:
                if cell[0] in completed: writer.writerows(rows(cell,metadata))
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        pending={}
        for _ in range(args.workers):
            cell=next(remaining,None)
            if cell:pending[pool.submit(run_cell,cell,metadata)]=cell
        while pending:
            done,_=concurrent.futures.wait(pending,return_when=concurrent.futures.FIRST_COMPLETED)
            for future in done:
                cell=pending.pop(future);result=future.result();completed[cell[0]]=result
                halt |= result['paused'] or (ROOT/'experiments/STOP-E1').exists()
                save()
                if not halt:
                    following=next(remaining,None)
                    if following:pending[pool.submit(run_cell,following,metadata)]=following
    metadata.update(completed=len(completed),accepted=sum(r['accepted'] for r in completed.values()),paused=halt,
                    disk_after=capture('df','-h','/System/Volumes/Data'),uptime_after=capture('uptime'))
    path.with_suffix('.json').write_text(json.dumps(metadata,indent=2)+'\n')
    print(json.dumps({k:metadata[k] for k in ('completed','accepted','paused','disk_after')}),flush=True)


if __name__=='__main__':
    main()
