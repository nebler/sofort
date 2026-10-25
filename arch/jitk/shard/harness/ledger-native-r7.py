#!/usr/bin/env python3
"""R7 native adapter of ledger-r6.py; same cgroup, settle and slope method."""
import json,os,pathlib,select,signal,statistics,subprocess,time
ROOT=pathlib.Path(os.environ.get('JITK_LEDGER_ROOT','/home/dev/r7-bytes'))
CG=pathlib.Path(os.environ.get('JITK_LEDGER_CGROUP','/sys/fs/cgroup/r7-bytes'))
SNAPSHOT=ROOT/os.environ.get('JITK_LEDGER_SNAPSHOT','images/lua-r7')
TOOLS=os.environ.get('JITK_LEDGER_NATIVE_TOOLS','').split()
FIXTURES=TOOLS or os.environ.get('JITK_LEDGER_FIXTURES','native_lua').split()
BIN=ROOT/'arch/jitk/shard/target/release/real'
SPAWN=ROOT/'spawn-cg'
OUT=pathlib.Path(os.environ.get('JITK_LEDGER_OUTPUT',str(ROOT/'raw')));OUT.mkdir(exist_ok=True)
def read(p): return pathlib.Path(p).read_text()
def numbers(p): return {k:int(v) for k,v in (l.split()[:2] for l in read(p).splitlines())}
def smaps(pid):
    return {k.rstrip(':'):int(v) for k,v,*rest in (l.split() for l in read(f'/proc/{pid}/smaps_rollup').splitlines()[1:]) if v.isdigit()}
def setup():
    CG.mkdir(exist_ok=True)
    (CG/'memory.max').write_text(str(3758096384));(CG/'memory.swap.max').write_text('0')
    (CG/'cgroup.subtree_control').write_text('+memory +cpu')
def observe(cg,pid):
    status=read(f'/proc/{pid}/status')
    return dict(memory_current=int(read(cg/'memory.current')),memory_stat=numbers(cg/'memory.stat'),
      cpu_stat=numbers(cg/'cpu.stat'),smaps_rollup_kib=smaps(pid),status=status,
      meminfo=read('/proc/meminfo'),loadavg=read('/proc/loadavg'),uptime=read('/proc/uptime'),
      slabinfo='\n'.join(l for l in read('/proc/slabinfo').splitlines() if 'kvm' in l.lower()),
      snapshot_smaps='\n'.join(l for l in read(f'/proc/{pid}/smaps').splitlines() if '.mem' in l),
      fds=len(list(pathlib.Path(f'/proc/{pid}/fd').iterdir())))
def cell(name,n,rep):
    cg=CG/f'batch-{rep}-{name}-{n}';cg.mkdir()
    stem=OUT/f'ledger-{rep}-{name}-{n}'
    err=open(str(stem)+'.stderr','w')
    snapshot=ROOT/f'images/{name}-r7' if TOOLS else SNAPSHOT
    request=ROOT/f'ledger-{name}.request' if TOOLS else ROOT/'ledger.request'
    p=subprocess.Popen([str(SPAWN),str(cg),str(BIN),'native-hold',str(snapshot),str(request),str(n),'3600'],
      cwd=ROOT,stdout=subprocess.PIPE,stderr=err,bufsize=0,
      env=dict(os.environ,GLIBC_TUNABLES='glibc.malloc.hugetlb=0'))
    events=[];pid=None;start=time.monotonic()
    try:
        while True:
            if not select.select([p.stdout],[],[],180)[0]:raise TimeoutError('no holder progress')
            line=p.stdout.readline()
            if not line:raise RuntimeError(f'holder died rc={p.poll()} {stem}')
            e=json.loads(line);events.append(e)
            if e['event']=='environment':pid=e['pid']
            if e['event']=='held':break
        assert f'Threads:\t1\n' in read(f'/proc/{pid}/status')
        time.sleep(3)
        samples=[]
        for i in range(3):
            samples.append(observe(cg,pid));time.sleep(.2)
        before=numbers(cg/'cpu.stat')['usage_usec'];time.sleep(1)
        idle=numbers(cg/'cpu.stat')['usage_usec']-before
        result=dict(fixture=name,n=n,rep=rep,events=events,samples=samples,idle_cpu_usec=idle,
          memory_peak=int(read(cg/'memory.peak')),elapsed_s=time.monotonic()-start,cgroup=str(cg),enclosing_memory_current=int(read(CG/'memory.current')))
        stem.with_suffix('.json').write_text(json.dumps(result,indent=2)+'\n')
        print(json.dumps(dict(event='cell',fixture=name,n=n,rep=rep,memory_current=statistics.median(x['memory_current'] for x in samples),idle_cpu_usec=idle)),flush=True)
    finally:
        if pid:
            try:os.kill(pid,signal.SIGTERM)
            except ProcessLookupError:pass
        try:p.wait(timeout=15)
        except subprocess.TimeoutExpired:p.kill();p.wait()
        err.close();p.stdout.close()
        for i in range(50):
            try:cg.rmdir();break
            except OSError:time.sleep(.1)
setup()
for rep in range(2):
    for name in FIXTURES:
        for n in [1,16,64,256]:cell(name,n,rep)
# One larger validation point, after the comparable two 1/16/64/256 curves.
if 'ready' in FIXTURES:cell('ready',1024,2)
(OUT/'ledger-cleanup.json').write_text(json.dumps(dict(memory_events=numbers(CG/'memory.events'),
  remaining_cgroups=[p.name for p in CG.iterdir() if p.is_dir()],loadavg=read('/proc/loadavg')))+'\n')
