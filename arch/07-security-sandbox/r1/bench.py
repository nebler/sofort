"""Whole child-process wall latency; warm caches; nearest-rank p90; no timeout on measured path."""
import subprocess, time, statistics, math, random, json, pathlib
root=pathlib.Path('/tmp/jitk-07')
commands={
 'copied-host':['./host','kk.bin'],
 'sandbox-exec':['sandbox-exec','-f','profile.sb','./host','kk.bin'],
 'internal-baseline':['./host-init','kk.bin'],
 'sandbox-init-prebuild':['./host-init','kk.bin','internal.sb'],
}
def run(cmd):
 t=time.perf_counter_ns()
 p=subprocess.run(cmd,cwd=root,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 ms=(time.perf_counter_ns()-t)/1e6
 if p.returncode: raise RuntimeError((cmd,p.returncode,p.stderr))
 return ms
for cmd in commands.values():
 for _ in range(3):run(cmd)
rng=random.Random(7); raw={k:[] for k in commands}
for _ in range(30):
 keys=list(commands);rng.shuffle(keys)
 for k in keys:raw[k].append(run(commands[k]))
summary={k:{'n':len(v),'median_ms':statistics.median(v),'p90_ms':sorted(v)[math.ceil(.9*len(v))-1]} for k,v in raw.items()}
result={'method':__doc__,'commands':commands,'summary':summary,'raw_ms':raw}
(root/'latency.json').write_text(json.dumps(result,indent=2))
print(json.dumps(summary,indent=2))
