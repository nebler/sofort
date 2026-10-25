#!/usr/bin/env python3
"""Run INSIDE Linux arm64. Each VM analogue is a fresh, single-use qjs process."""
import json, subprocess, time, math, random, pathlib, os
ROOT=pathlib.Path(os.environ.get('BENCH_ROOT','/work')); OUT=pathlib.Path('/results')
N=int(os.environ.get('N','100'))
SNIPPET="tools.echo.echo({value:42}).then(result=>{console.log(result);globalThis.__finish(result)})"
# __finish is installed by bootstrap as the host result encoder.
CASES={}
for engine in ('quickjs','quickjs-ng'):
    CASES[engine+'-source']=[str(ROOT/engine/'qjs' if engine=='quickjs' else ROOT/engine/'build/qjs'),str(ROOT/engine/'bootstrap.js')]
    CASES[engine+'-bytecode']=[str(ROOT/engine/'bootstrap-bin')]
CASES['quickjs-samecontext-bytecode']=[str(ROOT/'quickjs/qjs')]
def run(case,warm,stress=0):
    start=time.monotonic_ns()
    p=subprocess.Popen(CASES[case],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,bufsize=1,env=dict(os.environ,JITK_BYTECODE='1') if case=='quickjs-samecontext-bytecode' else None)
    stamps=[]
    for _ in range(2):
        line=p.stderr.readline()
        if not line.startswith('BENCH '): raise RuntimeError((case,line,p.stderr.read(),p.stdout.read()))
        stamps.append(json.loads(line[6:]))
    assert stamps[-1]['stage']=='ready'
    if warm: start=time.monotonic_ns()
    script=SNIPPET
    if stress: script=f'globalThis.held=new Uint8Array({stress}*1024*1024);for(let i=0;i<held.length;i+=4096)held[i]=42;'+script
    p.stdin.write(script+'\n'); p.stdin.flush()
    request=p.stdout.readline(); call=json.loads(request)
    dispatch=time.monotonic_ns()
    assert call['t']=='call' and call['ns']=='echo' and call['fn']=='echo' and call['id']==0
    assert call['args']=={'value':42}
    p.stdin.write(json.dumps({'id':0,'ok':call['args']})+'\n'); p.stdin.flush()
    dispatch_us=(time.monotonic_ns()-dispatch)/1000
    result=json.loads(p.stdout.readline()); end=time.monotonic_ns()
    assert result=={'t':'done','result':{'value':42}}
    line=p.stderr.readline(); stamps.append(json.loads(line[6:]))
    remaining=p.stderr.read(); rc=p.wait()
    if rc or remaining: raise RuntimeError((case,rc,remaining))
    return {'case':case,'warm':warm,'stress_mib':stress,'us':{
       'request_result':(end-start)/1000,'main_first':stamps[0]['elapsed_us'],
       'main_ready':stamps[1]['elapsed_us'],'first_ready':stamps[1]['elapsed_us']-stamps[0]['elapsed_us'],
       'dispatch':dispatch_us},'stamps':stamps}
for case in CASES:
    for _ in range(5): run(case,True)
order=[(c,w,s) for c in CASES for w,s in [(False,0),(True,0),(True,8),(True,16)]]*N
random.Random(6).shuffle(order)
rows=[run(*item) for item in order]
(OUT/'qjs-raw.json').write_text(json.dumps(rows,indent=2)+'\n')
def stats(v):
    v=sorted(v); n=len(v)
    return {'n':n,'median':(v[(n-1)//2]+v[n//2])/2,'p90':v[math.ceil(n*.9)-1],'p99':v[math.ceil(n*.99)-1]}
summary={}
for c,w,s in sorted(set(order)):
    selected=[r for r in rows if (r['case'],r['warm'],r['stress_mib'])==(c,w,s)]
    key=f'{c}-{"warm" if w else "cold"}-{s}MiB'
    summary[key]={k:stats([r['us'][k] for r in selected]) for k in selected[0]['us']}
    for field in ('hwm_kib','js_malloc_bytes','js_used_bytes'):
        summary[key][field]=stats([max(stage[field] for stage in r['stamps']) for r in selected])
(OUT/'qjs-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps(summary,indent=2))
