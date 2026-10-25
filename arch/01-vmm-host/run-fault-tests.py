#!/usr/bin/env python3
import json,pathlib,statistics,subprocess,time
samples=[]
for _ in range(10):
    t=time.perf_counter()
    p=subprocess.run(['/tmp/jitk-01/jitk-vmm','/tmp/jitk-01/fault.bin'],capture_output=True,timeout=3)
    samples.append({'rc':p.returncode,'elapsed_ms':1000*(time.perf_counter()-t),'stderr':p.stderr.decode()})
pathlib.Path(__file__).with_name('fault-abort-repeat-results.json').write_text(json.dumps(samples,indent=2)+'\n')
print('n=10', 'median_ms=',statistics.median(s['elapsed_ms'] for s in samples),'p90_ms=', sorted(s['elapsed_ms'] for s in samples)[8])
assert all(s['rc']==-6 for s in samples)
