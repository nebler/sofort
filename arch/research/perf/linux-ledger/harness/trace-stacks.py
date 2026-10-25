#!/usr/bin/env python3
"""Diagnostic, excluded from memory/timing fits: correlate THPs with stacks."""
import time
from pathlib import Path
import ledger as l
cg=l.mkdircg(f'trace-{time.monotonic_ns()}')
try:
    v=l.VM('jitk-trace',cg);time.sleep(3)
    procs={}
    for pid in (cg/'cgroup.procs').read_text().split():
        p=Path('/proc')/pid
        procs[pid]={'exe':str((p/'exe').resolve()),'smaps':(p/'smaps').read_text(),'threads':{t.name:{k:(t/k).read_text() for k in ('comm','wchan','syscall','stat')} for t in (p/'task').iterdir()}}
    l.save(l.D/'raw/stack-diagnostic.json',{'label':'DIAGNOSTIC strace overhead; excluded from fitted measurements','system':l.system(),'processes':procs})
finally:
    for v in list(l.LIVE):v.close()
    l.rmcg(cg)
