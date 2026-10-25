#!/usr/bin/env python3
"""Warm file-cache, fresh process/VM on every sample; RAW timestamps match trace.c."""
import json, os, random, subprocess, time, math, pathlib, sys
ROOT = pathlib.Path('/tmp/jitk-06')
N = int(sys.argv[1]) if len(sys.argv)>1 else 100
OUT = pathlib.Path(sys.argv[2]) if len(sys.argv)>2 else pathlib.Path(__file__).parent
clock = lambda: time.clock_gettime_ns(time.CLOCK_MONOTONIC_RAW)
for suffix in ('original','stripped'):
    (ROOT/f'raw-{suffix}.bin').write_bytes((ROOT/'kk.bin').read_bytes()+(ROOT/f'qjs-{suffix}').read_bytes())
cases = {'noop':['--noop'], 'bare':['kk.bin'],
         'initrd-original':['kk.bin','qjs-original'], 'initrd-stripped':['kk.bin','qjs-stripped'],
         'raw-original':['raw-original.bin'], 'raw-stripped':['raw-stripped.bin'],
         'raw-stripped-16':['raw-stripped.bin','','16'], 'raw-stripped-32':['raw-stripped.bin','','32']}
env = dict(os.environ, DYLD_LIBRARY_PATH=str(ROOT/'instrumented'))
def run(name):
    args=[str(ROOT/'host-buffered')]+[str(ROOT/a) if a.endswith('.bin') or a.startswith('qjs-') else a for a in cases[name]]
    start=clock()
    p=subprocess.run(args,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,env=env,timeout=10,close_fds=False)
    end=clock()
    if p.returncode: raise RuntimeError((name,p.returncode,p.stderr.decode()))
    e=json.loads(p.stderr)['events']; d=dict(e)
    row={'case':name,'events':e,'spawn_ns':start,'wait_ns':end}
    m={'total':end-start,'spawn_to_main':d['main']-start,
       'spawn_to_constructor':d['constructor']-start,
       'constructor_to_main':d['main']-d['constructor'],
       'main_to_build':d.get('build_begin',d['exit_begin'])-d['main'],
       'exit_to_wait':end-d['exit_begin']}
    if name!='noop':
        first=min(t for k,t in e if k=='vcpu_run_begin')
        last=max(t for k,t in e if k=='vcpu_run_end')
        for key in ('vm_create','vm_map','vcpu_create','vcpu_run'):
            m[key]=sum(t for k,t in e if k==key+'_end')-sum(t for k,t in e if k==key+'_begin')
        m.update(build_api=d['build_end']-d['build_begin'],
                 build_to_guest=first-d['build_begin'], guest_span=last-first,
                 shutdown_dispatch=d['exit_begin']-last,
                 payload_api=d['payload_api_end']-d['payload_api_begin'])
        for key in ('guest_mmap','kernel_read','kernel_write','initrd_read','initrd_write'):
            m[key]=sum(t for k,t in e if k==key+'_end')-sum(t for k,t in e if k==key+'_begin')
        m['builder_other']=m['build_to_guest']-m['vm_create']-m['vm_map']-m['vcpu_create']
        m['payload_total']=sum(m[k] for k in ('kernel_read','kernel_write','initrd_read','initrd_write'))
        m['builder_residual']=m['builder_other']-sum(m[k] for k in ('guest_mmap','kernel_read','kernel_write','initrd_read','initrd_write'))
    row['us']={k:v/1000 for k,v in m.items()}
    return row
for name in cases:
    for _ in range(5): run(name)
order=list(cases)*N; random.Random(6).shuffle(order)
rows=[run(name) for name in order]
(OUT/'boot-raw.json').write_text(json.dumps(rows,indent=2)+'\n')
def stats(v):
    v=sorted(v)
    return {'n':len(v),'median':(v[(len(v)-1)//2]+v[len(v)//2])/2,
            'p90':v[math.ceil(len(v)*.90)-1],'p99':v[math.ceil(len(v)*.99)-1]}
summary={name:{key:stats([r['us'][key] for r in rows if r['case']==name])
               for key in next(r for r in rows if r['case']==name)['us']} for name in cases}
(OUT/'boot-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
for name,v in summary.items():
    print(name)
    for k,s in v.items(): print('  %-20s %8.2f %8.2f %8.2f us'%(k,s['median'],s['p90'],s['p99']))
