#!/usr/bin/env python3
"""Verify collected evidence, not an implementation-mirroring production test."""
from pathlib import Path
import hashlib
import json
import subprocess
HERE=Path(__file__).resolve().parent
load=lambda f:json.loads((HERE/f).read_text())
main=load('memory-raw.json');extra=load('memory-n60-raw.json');cpu=load('cpu-raw.json')
assert len(main['cells'])==60 and main.get('end')
assert len(extra['cells'])==12 and len(extra['component_files'])==12
cells=main['cells']+extra['cells'];good=[c for c in cells if c['status']=='ok'];bad=[c for c in cells if c['status']=='error']
assert len(good)==48 and len(bad)==24
assert all(c['n'] in (64,256) for c in bad)
assert {sum(x.get('status')==-9 for x in c['cleanup']) for c in bad}=={61}
residuals=[];counter_count=0
for c in good:
    assert len(c['cleanup'])==c['n']
    for phase,p in c['phases'].items():
        assert len(p['processes'])==c['n']
        for r in p['processes']:
            t=r['ledger'];expected=t['internal']-t['alternate_accounting']+t['internal_compressed']-t['alternate_accounting_compressed']+t['iokit_mapped']+t['purgeable_nonvolatile']+t['purgeable_nonvolatile_compress']+t['page_table']
            residuals.append(expected-r['footprint']);counter_count+=1
        for q in p['diagnostics'].values():
            for name in ('vmmap-summary','vmmap','footprint','footprint-object'):
                if name in q:assert q[name]['status']==0 and (HERE/q[name]['path']).is_file()
        if 'batch_footprint' in p:assert p['batch_footprint']['status']==0
assert max(map(abs,residuals))==0
assert len(cpu['samples'])==240 and cpu.get('end')
assert len({r['pid'] for r in cpu['samples']})==240
for kind in ('raw','executor'):
    for mode in ('cold','parked'):
        for case in ('return2','one_tool'):
            assert sum(r['kind']==kind and r['mode']==mode and r['case']==case for r in cpu['samples'])==30
hvf=load('hvf-control-raw.json');assert hvf.get('end') and len(hvf['repeats'])==3
assert all(r['status']=='ok' and len(r['stages'])==7 for r in hvf['repeats'])
assert all(r['status']=='ok' for r in load('controls-raw.json')['repeats'])
assert all(c['status']=='ok' for c in load('inline-raw.json')['cells'])
selection=load('artifacts/selection.json')
for key in ('vmm','image','image-0','image-1','image-8'):
    assert hashlib.sha256(Path(selection[key]['path']).read_bytes()).hexdigest()==selection[key]['sha256']
ps=subprocess.check_output(['ps','-axo','command='],text=True).splitlines()
owned=[s for s in ps if s.startswith(str(HERE/'artifacts/jitk-vmm')) or s.startswith(str(HERE/'artifacts/hvf-control'))]
assert not owned,owned
result={'status':'PASS','memory_cells_success':len(good),'expected_capacity_failures':len(bad),
        'failure_ready_vms':61,'per_process_counter_snapshots':counter_count,
        'max_footprint_ledger_formula_error_bytes':max(map(abs,residuals)),
        'validated_cpu_samples':240,'hvf_control_repeats':3,'owned_workers_remaining':owned,
        'scope_bytes':sum(p.stat().st_size for p in HERE.rglob('*') if p.is_file() and 'node_modules' not in p.parts)}
(HERE/'verification.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
