#!/usr/bin/env python3
"""Whole subprocess latency, and time until a complete hello line; no warmup exclusion."""
import json, selectors, statistics, subprocess, time, sys
args=[a for a in sys.argv[1:] if a!='hello-only']
cmd=args or ['/tmp/jitk-02/host','/tmp/jitk-02/kernel.bin']
rows=[]
for i in range(30):
    start=time.perf_counter_ns()
    p=subprocess.Popen(cmd,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    line=p.stdout.readline(); first=(time.perf_counter_ns()-start)/1e6
    out=p.stdout.read();err=p.stderr.read();p.wait(timeout=5);elapsed=(time.perf_counter_ns()-start)/1e6
    assert p.returncode==0 and b'hello' in line,(p.returncode,line,out,err)
    if 'hello-only' not in sys.argv: assert b'hi\n' in out,(out,err)
    rows.append({'total_ms':elapsed,'hello_ms':first})
summary={k:{'n':len(rows),'median':statistics.median(r[k] for r in rows),'p90':sorted(r[k] for r in rows)[26],'min':min(r[k] for r in rows),'max':max(r[k] for r in rows)} for k in rows[0]}
print(json.dumps({'command':cmd,'summary':summary,'samples':rows},indent=2))
