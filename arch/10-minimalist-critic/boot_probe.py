#!/usr/bin/env python3
"""HVF smoke benchmark only: guest immediately powers off, does not run qjs."""
import json, os, pathlib, shutil, statistics, subprocess, time
p=pathlib.Path('/tmp/jitk-10/boot');p.mkdir(exist_ok=True)
for f in ['host','libkrun.2.dylib','kk.bin']:
    shutil.copy2('/tmp/jitk-spike/boot/'+f,p/f)
env=dict(os.environ,DYLD_LIBRARY_PATH=str(p))
cases={'bare':[], '9.69MB-payload':['/tmp/jitk-spike/sc/qjs-static'], '2.40MB-flat-payload':['/tmp/jitk-10/packed/qjs.flat']}
records={k:[] for k in cases}
for n in range(31):
    for k,args in cases.items():
        start=time.perf_counter_ns()
        proc=subprocess.run([str(p/'host'),str(p/'kk.bin'),*args],env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        elapsed=(time.perf_counter_ns()-start)/1e6
        if proc.returncode: raise RuntimeError(proc.stderr.decode())
        if n: records[k].append(elapsed)
summary={k:{'n':len(v),'median_ms':statistics.median(v),'p90_ms':sorted(v)[26],'min_ms':min(v),'max_ms':max(v)} for k,v in records.items()}
out=pathlib.Path(__file__).resolve().parent
(out/'boot-measurements.json').write_text(json.dumps(dict(summary=summary,raw_ms=records),indent=2)+'\n')
print(json.dumps(summary,indent=2))
