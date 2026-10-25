#!/usr/bin/env python3
"""Completed guest benchmarks; bounded I/O, external watchdog, owned-child cleanup."""
import concurrent.futures as cf
import fcntl, hashlib, json, math, os, resource, selectors, signal, subprocess, sys, threading, time
from pathlib import Path
ROOT=Path(__file__).resolve().parent
LIVE=set(); LOCK=threading.Lock(); GROUPS=[]; STOP=threading.Event()
CMD=[str(ROOT/'.work/jitk-launch'),str(ROOT/'.work/kernel.bin')]
TIMEOUT=float(os.getenv('JITK_TIMEOUT_S','10'))

def uptime(): return subprocess.check_output(['uptime'],text=True).strip()
def quant(xs):
    s=sorted(xs)
    return {k:s[max(0,math.ceil(p*len(s))-1)] for k,p in [('p50',.5),('p90',.9),('p99',.99)]} if s else None
def cleanup(p):
    if p.poll() is None:p.kill()
    p.wait()
    for f in [p.stdin,p.stdout]:
        if f:f.close()
    with LOCK:LIVE.discard(p)
def cleanup_all():
    for p in list(LIVE): cleanup(p)
    for cg in reversed(GROUPS):
        if cg.exists():
            if (cg/'cgroup.kill').exists(): (cg/'cgroup.kill').write_text('1')
            for _ in range(50):
                try:cg.rmdir();break
                except OSError:time.sleep(.02)
def interrupted(sig,frame):
    STOP.set()
    for p in list(LIVE):
        try:p.kill()
        except ProcessLookupError:pass
    raise RuntimeError(f'interrupted by signal {sig}')
for sig in [signal.SIGINT,signal.SIGTERM]:signal.signal(sig,interrupted)

def read_frame(p,want,deadline):
    # Unbuffered pipes and one-byte reads avoid consuming a following frame.
    buf=bytearray()
    with selectors.DefaultSelector() as sel:
        sel.register(p.stdout,selectors.EVENT_READ)
        while time.monotonic()<deadline:
            if not sel.select(max(0,deadline-time.monotonic())):break
            b=os.read(p.stdout.fileno(),1)
            if not b:raise RuntimeError(f'guest EOF before {want}, rc={p.poll()}, tail={bytes(buf[-200:])!r}')
            buf+=b
            if len(buf)>1048576:raise RuntimeError('oversized guest frame')
            if b==b'\n':
                line=bytes(buf);buf.clear()
                if line.startswith(b'\x1e'):continue # distinct kernel diagnostic record
                try:m=json.loads(line)
                except ValueError:raise RuntimeError(f'invalid guest frame {line[:200]!r}')
                if m.get('t')==want:return m
                raise RuntimeError(f'unexpected guest frame {m}')
    raise TimeoutError(f'watchdog waiting for {want}')

def launch(cg=None,cmd=None):
    if STOP.is_set():raise RuntimeError('benchmark cancelled')
    env=os.environ.copy()
    if cg:env['JITK_CGROUP']=str(cg)
    p=subprocess.Popen(cmd or CMD,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,bufsize=0,env=env)
    with LOCK:LIVE.add(p)
    try:
        m=read_frame(p,'ready',time.monotonic()+TIMEOUT)
        if m.get('v')!=1:raise RuntimeError('bad ready version')
        return p
    except BaseException:cleanup(p);raise

def one(_,cmd=None):
    t=time.perf_counter();p=None
    try:
        p=launch(cmd=cmd);ready_ms=(time.perf_counter()-t)*1000
        p.stdin.write(b'{"t":"run","code":"return 1+1","ns":{}}\n')
        m=read_frame(p,'done',time.monotonic()+TIMEOUT)
        if m.get('ok')!=2:raise RuntimeError(f'bad result {m}')
        p.wait(timeout=TIMEOUT)
        if p.returncode!=0:raise RuntimeError(f'exit status {p.returncode}')
        return {'ok':True,'ms':(time.perf_counter()-t)*1000,'ready_ms':ready_ms}
    except Exception as e:return {'ok':False,'error':repr(e),'ms':(time.perf_counter()-t)*1000}
    finally:
        if p:cleanup(p)

def batch(n,c,cmd=None):
    up=uptime();u=resource.getrusage(resource.RUSAGE_CHILDREN);start=time.perf_counter()
    with cf.ThreadPoolExecutor(max_workers=c) as ex:rows=list(ex.map(lambda i:one(i,cmd),range(n)))
    elapsed=time.perf_counter()-start;v=resource.getrusage(resource.RUSAGE_CHILDREN);ok=[x for x in rows if x['ok']]
    return {'concurrency':c,'attempts':n,'completed':len(ok),'completed_vms_s':len(ok)/elapsed,'elapsed_s':elapsed,'latency_ms':quant([x['ms'] for x in ok]),'ready_ms':quant([x['ready_ms'] for x in ok]),'children_cpu_ms_vm':((v.ru_utime+v.ru_stime)-(u.ru_utime+u.ru_stime))*1000/len(ok) if ok else None,'uptime_before':up,'uptime_after':uptime(),'failures':[x for x in rows if not x['ok']],'samples':rows}

def kvm_probe():
    fd=os.open('/dev/kvm',os.O_RDWR|os.O_CLOEXEC)
    try:
        api=fcntl.ioctl(fd,0xae00,0)
        if api!=12:raise RuntimeError(f'KVM API {api}, expected 12')
        vm=fcntl.ioctl(fd,0xae01,0);os.close(vm)
        return {'api':api,'create_vm':'PASS'}
    finally:os.close(fd)

def cpu_stat(cg):return {a:int(b) for a,b in (l.split() for l in (cg/'cpu.stat').read_text().splitlines())}
def density(save):
    base=Path(os.getenv('JITK_CGROUP_ROOT','/sys/fs/cgroup'))
    if not (base/'cgroup.controllers').exists():raise RuntimeError('cgroup v2 required')
    cg=base/f'jitk-05-{os.getpid()}';cg.mkdir();GROUPS.append(cg)
    controls=(base/'cgroup.controllers').read_text().split()
    if not {'memory','cpu'}<=set(controls):raise RuntimeError('memory/cpu controllers unavailable')
    # Enable only on an explicitly selected benchmark parent; no unrelated processes moved.
    (base/'cgroup.subtree_control').write_text('+memory +cpu')
    (cg/'cgroup.subtree_control').write_text('+memory +cpu')
    pools=[];rows=[];hz=os.sysconf('SC_CLK_TCK')
    targets=[int(x) for x in os.getenv('JITK_DENSITY','1,32,64,128,256,512,1024,1536,2048').split(',')]
    try:
        for target in targets:
            up=uptime()
            while len(pools)<target:
                # Preserve 8 GiB headroom on the metal host.
                available=int(next(l.split()[1] for l in Path('/proc/meminfo').read_text().splitlines() if l.startswith('MemAvailable:')))*1024
                if available<8*1024**3:raise RuntimeError('MemAvailable < 8 GiB; density aborted')
                child=cg/f'vm-{len(pools)}';child.mkdir();GROUPS.append(child)
                (child/'memory.max').write_text(str(128*1024**2));(child/'memory.swap.max').write_text('0')
                p=launch(child);pools.append((p,child))
            before=cpu_stat(cg);t=time.monotonic();time.sleep(float(os.getenv('JITK_IDLE_S','3')));seconds=time.monotonic()-t;after=cpu_stat(cg)
            pss=[];mem=[]
            for p,child in pools:
                if p.poll() is not None:raise RuntimeError(f'parked guest died: {p.returncode}')
                sm=Path(f'/proc/{p.pid}/smaps_rollup').read_text()
                pss.append(int(next(l.split()[1] for l in sm.splitlines() if l.startswith('Pss:')))*1024)
                mem.append(int((child/'memory.current').read_text()))
            row={'parked':target,'uptime_before':up,'uptime_after':uptime(),'pss_bytes_vm':quant(pss),'pss_sum_bytes':sum(pss),'memory_current_bytes_vm':quant(mem),'memory_current_sum_bytes':sum(mem),'group_memory_current':int((cg/'memory.current').read_text()),'idle_cpu_pct_core_vm':(after['usage_usec']-before['usage_usec'])/1e6/seconds/target*100,'idle_seconds':seconds}
            rows.append(row);save(rows)
            if row['idle_cpu_pct_core_vm']>=2:raise RuntimeError('D4 idle CPU gate >= 2% core/VM; refusing to grow spinning pool')
        # Validate all held guests still complete rather than just counting sleeping PIDs.
        for p,_ in pools:
            p.stdin.write(b'{"t":"run","code":"return 1+1","ns":{}}\n')
            if read_frame(p,'done',time.monotonic()+TIMEOUT).get('ok')!=2:raise RuntimeError('density result mismatch')
            p.wait(timeout=TIMEOUT)
            if p.returncode:raise RuntimeError('density exit failure')
        return rows
    finally:
        for p,_ in pools:cleanup(p)

def report(data):
    (ROOT/'out').mkdir(exist_ok=True)
    (ROOT/'out/report.json').write_text(json.dumps(data,indent=2)+'\n')
    lines=['# jitk arm64 Linux/KVM benchmark','',f"Status: {data['status']}",f"KVM-dependent measurements: {data.get('kvm_results','UNVERIFIED')}",'','Source/versions and all raw samples: report.json. CPU-ms/VM is getrusage(RUSAGE_CHILDREN) user+system; guest CPU is charged in VMM threads. It excludes Python/broker CPU and kernel work outside child accounting.','']
    if 'error'in data:lines+=['Error: '+data['error'],'']
    for label,rows in [('boot',[data['boot']] if 'boot'in data else []),('sweep',data.get('sweep',[]))]:
        for r in rows:
            lines.append(f"{label}: c={r['concurrency']} completed={r['completed']}/{r['attempts']} rate={r['completed_vms_s']:.2f}/s latency_ms={r['latency_ms']} CPU_ms/VM={r['children_cpu_ms_vm']} uptime={r['uptime_before']}")
    for r in data.get('density',[]):lines.append('density: '+json.dumps(r))
    lines+=['','UNVERIFIED until this report contains successful KVM runs: arm64 boot, timer/IRQ wakeup, rates, density, PSS, cgroup accounting and production capacity. This is a benchmark launcher, not the production jailer.']
    (ROOT/'out/report.md').write_text('\n'.join(lines)+'\n')

def main():
    d={'status':'STARTED','kvm_results':'UNVERIFIED','sources':json.loads((ROOT/'sources.json').read_text()),'uptime_start':uptime(),'uname':list(os.uname()),'cpu_count':os.cpu_count(),'environment_overrides':{k:v for k,v in os.environ.items() if k.startswith('JITK_')}}
    d['artifact_sha256']={str(f.relative_to(ROOT)):hashlib.sha256(f.read_bytes()).hexdigest() for f in [ROOT/'.work/jitk-launch',ROOT/'.work/kernel.bin',ROOT/'.work/libkrun/target/release/libkrun.so'] if f.exists()}
    try:
        if '--build-only'in sys.argv:d['status']='BUILD_ONLY_PASS';return
        soft,hard=resource.getrlimit(resource.RLIMIT_NOFILE)
        wanted=16384
        if hard!=resource.RLIM_INFINITY and hard<wanted:raise RuntimeError(f'RLIMIT_NOFILE hard={hard}, need >= {wanted} for 2048 guests')
        resource.setrlimit(resource.RLIMIT_NOFILE,(max(soft,wanted),hard))
        d['rlimit_nofile']=list(resource.getrlimit(resource.RLIMIT_NOFILE))
        d['kvm']=kvm_probe()
        d['boot']=batch(int(os.getenv('JITK_BOOT_N','1000')),1);report(d)
        if d['boot']['completed']!=d['boot']['attempts']:raise RuntimeError('boot failed; later KVM tests UNVERIFIED')
        d['sweep']=[]
        for c in range(1,int(os.getenv('JITK_MAX_CONCURRENCY','64'))+1):
            r=batch(int(os.getenv('JITK_SWEEP_N','512')),c);d['sweep'].append(r);report(d)
            if r['completed']!=r['attempts']:raise RuntimeError(f'concurrency {c} failed')
        def save(rows):d['density']=list(rows);report(d)
        d['density']=density(save);d['status']='PASS';d['kvm_results']='MEASURED'
    except BaseException as e:d['status']='FAILED';d['error']=repr(e);raise
    finally:
        cleanup_all();d['children_remaining']=len(LIVE);d['uptime_end']=uptime();report(d)
if __name__=='__main__':main()
