#!/usr/bin/env python3
"""Read-only ledger sampling around six individual Hypervisor.framework APIs."""
from pathlib import Path
import json
import ledger
HERE=Path(__file__).resolve().parent
out=HERE/'hvf-control-raw.json';data={'start':ledger.host(),'repeats':[]}
for i in range(3):
    w=ledger.Worker([str(HERE/'artifacts/hvf-control'),str(HERE/'artifacts/image.bin')])
    r={'repeat':i,'stages':[]};data['repeats'].append(r)
    try:
        for _ in range(7):
            m=w.recv();assert not m['hv_result'],m
            r['stages'].append({**m,'process':ledger.proc(w.pid),'system':ledger.system(),
                'diagnostics':ledger.diagnostics(w.pid,HERE/'raw/hvf-control'/f'r{i}'/m['stage'],full=True)})
            out.write_text(json.dumps(data,indent=2)+'\n');w.p.stdin.write(b'x')
        r['status']='ok'
    finally:r['reap']=w.close();out.write_text(json.dumps(data,indent=2)+'\n')
data['end']=ledger.host();out.write_text(json.dumps(data,indent=2)+'\n')
