#!/usr/bin/env python3
"""Offline nested-KVM ledger. Run as root under the shared flock.

VMM births use the existing clone3(CLONE_INTO_CGROUP) helper. The Python
controller and wait wrappers are excluded from VMM cgroup charges and PSS.
The enclosing parent cgroup limits the entire controller + guests to 3.5 GiB.
"""
import argparse, hashlib, http.client, json, os, re, resource, selectors, signal
import socket, statistics, subprocess, sys, time, traceback
from pathlib import Path
D=Path('/home/dev/a5-linux-ledger')
CG=Path('/sys/fs/cgroup/a5-linux-ledger')
FC=D/'firecracker/release-v1.17.0-aarch64/firecracker-v1.17.0-aarch64'
LIMIT=3758096384
LIVE=[]

def kv(path):
    return {p[0]:int(p[1]) for line in Path(path).read_text().splitlines() if len(p:=line.split())>=2 and p[1].lstrip('-').isdigit()}
def meminfo(): return {k.rstrip(':'):v*1024 for k,v in kv('/proc/meminfo').items()}
def uptime(): return subprocess.check_output(['uptime'],text=True).strip()
def slabinfo():
    out={}
    for s in Path('/proc/slabinfo').read_text().splitlines()[2:]:
        p=s.split()
        if any(t in p[0].lower() for t in ('kvm','kvm_vcpu','kvm_mmu','hyp_','stage2')):
            out[p[0]]={'active_objects':int(p[1]),'objects':int(p[2]),'object_size':int(p[3]),'objects_per_slab':int(p[4]),'pages_per_slab':int(p[5]),'active_bytes':int(p[1])*int(p[3]),'allocated_bytes':int(p[2])*int(p[3])}
    return out
def cgstate(cg):
    return {'memory_current':int((cg/'memory.current').read_text()),'memory_peak':int((cg/'memory.peak').read_text()),'memory_stat':kv(cg/'memory.stat'),'memory_events':kv(cg/'memory.events'),'cpu_stat':kv(cg/'cpu.stat'),'pids_current':int((cg/'pids.current').read_text())}
def system():
    return {'unix':time.time(),'uptime':uptime(),'meminfo':meminfo(),'kvm_slab':slabinfo(),'parent':cgstate(CG),'loadavg':Path('/proc/loadavg').read_text().strip()}
def smaps(pid):
    return {k.rstrip(':'):v*1024 for k,v in kv(f'/proc/{pid}/smaps_rollup').items()}
def mapping_groups(pid):
    out={}; group=None
    for line in Path(f'/proc/{pid}/smaps').read_text().splitlines():
        if re.match(r'^[0-9a-f]+-[0-9a-f]+ ',line):
            p=line.split(maxsplit=5);name=p[5] if len(p)>5 else '[anonymous]'
            if name=='[anonymous]':
                lo,hi=(int(x,16) for x in p[0].split('-'))
                name+=f' size={hi-lo}'
            group=f'{p[1]} {name}';out.setdefault(group,{'mapping_count':0});out[group]['mapping_count']+=1
        elif group and re.match(r'^(Size|Rss|Pss|Private_Clean|Private_Dirty|Shared_Clean|Shared_Dirty|Anonymous|AnonHugePages):',line):
            k,v,*_=line.split();out[group][k.rstrip(':')]=out[group].get(k.rstrip(':'),0)+int(v)*1024
    return out
def delta(a,b): return {k:b.get(k,0)-a.get(k,0) for k in a.keys()|b.keys()}
def save(path,data):
    tmp=path.with_suffix('.tmp');tmp.write_text(json.dumps(data,indent=2)+'\n');tmp.replace(path)
def quant(x):
    s=sorted(x)
    return {'n':len(s),'min':s[0],'p50':statistics.median(s),'p99':s[max(0,int(.99*len(s)+.999)-1)],'max':s[-1],'mean':statistics.mean(s)} if s else None
def api(path,route,data,method='PUT'):
    c=http.client.HTTPConnection('localhost',timeout=15)
    deadline=time.monotonic()+15
    while True:
        s=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM);s.settimeout(15)
        try:s.connect(str(path));break
        except (ConnectionRefusedError,FileNotFoundError):
            s.close()
            if time.monotonic()>deadline:raise
            time.sleep(.001)
    c.sock=s
    c.request(method,route,json.dumps(data),{'Content-Type':'application/json'})
    r=c.getresponse();body=r.read().decode();c.close()
    if r.status not in (200,204):raise RuntimeError(f'Firecracker {method} {route}: {r.status} {body}')
    return json.loads(body) if body else None

class VM:
    seq=0
    def __init__(self,kind,cg,ram=16,count=1):
        VM.seq+=1;self.kind=kind;self.pid=None;self.out=b'';self.err=b'';self.frames=[];self.usage=None
        self.sock=D/f'sock-{os.getpid()}-{VM.seq}'
        if kind.startswith('jitk'):
            cmd=[str(D/'bin/jitk-vmm'),'--image',str(D/'bin/kernel.bin')]
            if kind=='jitk-no-thp':cmd=[str(D/'bin/no-thp'),*cmd]
            if kind=='jitk-trace':cmd=['/usr/bin/strace','-f','-o',str(D/'raw/stack-trace.txt'),'-e','trace=mmap,mprotect,madvise,clone,clone3',*cmd]
        elif kind.startswith('fc-'):cmd=[str(FC),'--api-sock',str(self.sock),'--id',f'a5-{VM.seq}','--level','Error']
        elif kind.startswith('bare'):cmd=[str(D/'bin/bare-kvm'),str(count)]
        elif kind.startswith('hl-'):cmd=[str(D/'bin/hl-ledger'),str(D/'bin/hl-qjs-guest'),str(count),'snapshot' if kind=='hl-shared' else 'boot']
        else:raise ValueError(kind)
        self.start=time.perf_counter_ns();self.cpu0=kv(cg/'cpu.stat')
        env=dict(os.environ)
        if kind=='jitk-malloc-no-thp':env['GLIBC_TUNABLES']='glibc.malloc.hugetlb=0'
        self.p=subprocess.Popen([str(D/'bin/spawn-cg'),str(cg),*cmd],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,bufsize=0,start_new_session=True,env=env)
        LIVE.append(self);self.sel=selectors.DefaultSelector()
        for tag,stream in [('out',self.p.stdout),('err',self.p.stderr)]:self.sel.register(stream,selectors.EVENT_READ,tag)
        deadline=time.monotonic()+30
        if kind.startswith('fc-'):
            while not self.sock.exists():
                self.pump(.002);self.check(deadline)
            self.api_ready_ns=time.perf_counter_ns()
            if kind=='fc-boot':
                api(self.sock,'/machine-config',{'vcpu_count':1,'mem_size_mib':ram,'track_dirty_pages':False})
                api(self.sock,'/boot-source',{'kernel_image_path':str(D/'bin/linux-6.1.128-Image'),'boot_args':'console=ttyS0 earlycon=uart8250,mmio,0x40002000 rdinit=/init panic=-1 reboot=k loglevel=3'})
                api(self.sock,'/actions',{'action_type':'InstanceStart'})
                self.until(b'LEDGER_READY',deadline)
            else:
                api(self.sock,'/snapshot/load',{'snapshot_path':str(D/'bin/fc-state'),'mem_backend':{'backend_type':'File','backend_path':str(D/'bin/fc-memory')},'enable_diff_snapshots':False,'resume_vm':True})
            # Both paths prove that PID 1 is alive and blocked on the console.
            self.out=b'';self.p.stdin.write(b'x\n');self.until(b'LEDGER_ALIVE',deadline)
        elif kind.startswith('jitk'):
            self.until(b'{"t":"ready","v":1}',deadline)
            self.until(b'{"sandbox":"ok"}',deadline,err=True)
        else:self.until(b'"ready":true',deadline)
        while self.pid is None:self.pump(.001);self.check(deadline)
        self.ready_ns=time.perf_counter_ns();self.ready_cpu=delta(self.cpu0,kv(cg/'cpu.stat'))
        assert str(cg.relative_to('/sys/fs/cgroup')) in Path(f'/proc/{self.pid}/cgroup').read_text()
    def check(self,deadline):
        if b'Kernel panic' in self.out:raise RuntimeError(f'{self.kind} guest panic; out={self.out[-6000:]!r}')
        if self.p.poll() is not None:raise RuntimeError(f'{self.kind} died rc={self.p.returncode}; out={self.out[-4000:]!r}; err={self.err[-3000:]!r}')
        if time.monotonic()>deadline:raise TimeoutError(f'{self.kind} deadline; out={self.out[-4000:]!r}; err={self.err[-3000:]!r}')
    def pump(self,timeout=0):
        for key,_ in self.sel.select(timeout):
            b=os.read(key.fileobj.fileno(),65536)
            if not b:self.sel.unregister(key.fileobj);continue
            if key.data=='out':self.out=(self.out+b)[-262144:]
            else:
                self.err=(self.err+b)[-65536:]
                p=re.search(rb'(?:^|\n)P (\d+)\n',self.err)
                if p:self.pid=int(p[1])
                p=re.search(rb'(?:^|\n)R (\{[^\n]+\})',self.err)
                if p:self.usage=json.loads(p[1])
    def until(self,needle,deadline,err=False):
        while needle not in (self.err if err else self.out):self.pump(.01);self.check(deadline)
    def close(self):
        if self not in LIVE:return
        if self.p.poll() is None:
            try:os.killpg(self.p.pid,signal.SIGKILL)
            except ProcessLookupError:pass
        self.p.wait(timeout=5)
        for f in [self.p.stdin,self.p.stdout,self.p.stderr]:f.close()
        self.sel.close();self.sock.unlink(missing_ok=True);LIVE.remove(self)
    def timing(self):
        return {'pid':self.pid,'ready_ms':(self.ready_ns-self.start)/1e6,'cpu_stat_to_ready':self.ready_cpu,'api_ready_ms':(self.api_ready_ns-self.start)/1e6 if hasattr(self,'api_ready_ns') else None}

def mkdircg(name):
    cg=CG/name;cg.mkdir();(cg/'memory.swap.max').write_text('0');return cg
def rmcg(cg):
    if (cg/'cgroup.kill').exists():(cg/'cgroup.kill').write_text('1')
    for _ in range(100):
        try:cg.rmdir();return
        except OSError:time.sleep(.01)
    raise RuntimeError(f'failed cleanup {cg}')
def sample(vms,cg,n):
    procs=[]
    for v in vms:
        v.pump();v.check(time.monotonic()+1)
        procs.append({'pid':v.pid,'smaps_rollup':smaps(v.pid),'status':Path(f'/proc/{v.pid}/status').read_text()})
    state=cgstate(cg);stat=state['memory_stat']
    total=sum(stat.get(k,0) for k in ('anon','file','kernel','sock'))
    return {'unix':time.time(),'n':n,'processes':procs,'process_sum':{k:sum(p['smaps_rollup'].get(k,0) for p in procs) for k in set().union(*(p['smaps_rollup'].keys() for p in procs))},'cgroup':state,'system':system(),'charge_sum_anon_file_kernel_sock':total,'charge_residual':state['memory_current']-total}
def sweep(kind,rep,targets,ram):
    cg=mkdircg(f'ledger-{kind}-{rep}-{os.getpid()}');vms=[]
    r={'kind':kind,'rep':rep,'label':'NESTED','ram_mib':ram if kind.startswith('fc-') else 32 if kind.startswith('jitk') else None,'baseline':system(),'baseline_cgroup':cgstate(cg),'rows':[]}
    path=D/'raw'/f'ledger-{kind}-{rep}.json';save(path,r)
    try:
        for n in targets:
            if kind in ('bare-shared','hl-shared'):
                for v in vms:v.close()
                vms=[]
                vms.append(VM(kind,cg,ram,count=n))
            else:
                while len(vms)<n:
                    current=int((CG/'memory.current').read_text())
                    if len(vms)>=8:
                        avg=int((cg/'memory.current').read_text())/len(vms)
                        if current+max(avg*1.2,32*1024**2)>LIMIT-64*1024**2:raise MemoryError(f'resource guard at {len(vms)} VMs, parent current={current}')
                    vms.append(VM(kind,cg,ram))
            # memcg rstat has a periodic flush interval; rapid small probes can
            # otherwise expose zero/stale memory.stat despite nonzero current.
            time.sleep(3)
            samples=[]
            for _ in range(3):samples.append(sample(vms,cg,n));time.sleep(.2)
            a=kv(cg/'cpu.stat');t=time.monotonic();time.sleep(1);b=kv(cg/'cpu.stat');elapsed=time.monotonic()-t
            row={'n':n,'samples':samples,'creation_timings':[v.timing() for v in vms],'idle_seconds':elapsed,'idle_cpu_stat_delta':delta(a,b),'idle_cpu_pct_core_per_vm':(b['usage_usec']-a['usage_usec'])/elapsed/1e4/n,'representative_mappings':mapping_groups(vms[0].pid)}
            r['rows'].append(row);save(path,r)
            print(json.dumps({'kind':kind,'rep':rep,'n':n,'cgroup_MiB':samples[-1]['cgroup']['memory_current']/2**20,'pss_MiB':samples[-1]['process_sum']['Pss']/2**20,'parent_peak_MiB':int((CG/'memory.peak').read_text())/2**20}),flush=True)
    except Exception as e:r['error']=repr(e);r['traceback']=traceback.format_exc();raise
    finally:
        for v in vms:v.close()
        r['after']=system();r['after_cgroup']=cgstate(cg);save(path,r);rmcg(cg)
    return r

def snapshot(ram):
    cg=mkdircg(f'snapshot-{os.getpid()}');v=None
    try:
        v=VM('fc-boot',cg,ram);time.sleep(.2);api(v.sock,'/vm',{'state':'Paused'},'PATCH')
        api(v.sock,'/snapshot/create',{'snapshot_type':'Full','snapshot_path':str(D/'bin/fc-state'),'mem_file_path':str(D/'bin/fc-memory')})
        save(D/'raw/snapshot.json',{'label':'NESTED','ram_mib':ram,'timing':v.timing(),'system':system(),'files':{f:{'bytes':(D/'bin'/f).stat().st_size,'sha256':hashlib.sha256((D/'bin'/f).read_bytes()).hexdigest()} for f in ('fc-state','fc-memory')}})
        print(f'snapshot saved RAM={ram}',flush=True)
    finally:
        if v:v.close()
        rmcg(cg)
def boot_samples(kind,n,ram,output_path=None,quiet=False):
    r={'kind':kind,'n':n,'label':'NESTED','before':system(),'samples':[]};path=output_path or D/'raw'/f'boot-{kind}.json'
    try:
        for i in range(n):
            cg=mkdircg(f'boot-{kind}-{i}-{os.getpid()}');v=None
            try:
                v=VM(kind,cg,ram);row={**v.timing(),'cgroup_ready':cgstate(cg)}
                if kind.startswith('jitk'):
                    t=time.perf_counter_ns();v.out=b''
                    v.p.stdin.write(b'{"t":"run","code":"return 2","ns":{}}\n')
                    deadline=time.monotonic()+30
                    while b'{"t":"done","ok":2}' not in v.out:
                        v.pump(.001)
                        if b'{"t":"done","ok":2}' in v.out:break
                        v.check(deadline)
                    row['parked_return2_ms']=(time.perf_counter_ns()-t)/1e6
                    while v.p.poll() is None:
                        v.pump(.001)
                        if time.monotonic()>deadline:raise TimeoutError('jitk shutdown after return2')
                    row['exit_code']=v.p.returncode
                    assert v.p.returncode==0
                    row['lifecycle_cpu_stat']=kv(cg/'cpu.stat')
                    row['cold_return2_and_exit_ms']=(time.perf_counter_ns()-v.start)/1e6
                r['samples'].append(row)
            finally:
                if v:v.close()
                rmcg(cg)
    finally:
        r['after']=system();r['ready_ms']=quant([s['ready_ms'] for s in r['samples']]);r['cpu_ms']=quant([s['cpu_stat_to_ready']['usage_usec']/1000 for s in r['samples']]);save(path,r)
    if not quiet:print(json.dumps({'kind':kind,'boot_n':len(r['samples']),'ready_ms':r['ready_ms'],'cpu_ms':r['cpu_ms']}),flush=True)
    return r

def interleaved(kinds,n,ram):
    import random, shutil
    rng=random.Random(20261025);aggregates={}
    for kind in kinds:
        p=D/'raw'/f'boot-{kind}.json'
        if p.exists():shutil.copyfile(p,D/'raw/pilot'/f'boot-sequential-{kind}.json')
        aggregates[kind]={'kind':kind,'n':n,'label':'NESTED','method':'randomized interleaving across all kinds; seed 20261025','before':system(),'samples':[]}
    for i in range(n):
        order=list(kinds);rng.shuffle(order)
        for j,kind in enumerate(order):
            one=boot_samples(kind,1,ram,D/'raw/pilot/boot-interleaved-scratch.json',quiet=True)
            r=aggregates[kind];r['samples'].append({**one['samples'][0],'round':i,'position':j,'environment_before':one['before']});r['after']=one['after']
            r['ready_ms']=quant([s['ready_ms'] for s in r['samples']]);r['cpu_ms']=quant([s['cpu_stat_to_ready']['usage_usec']/1000 for s in r['samples']])
            save(D/'raw'/f'boot-{kind}.json',r)
        print(json.dumps({'interleaved_round':i+1,'n':n}),flush=True)

def main():
    p=argparse.ArgumentParser();p.add_argument('mode',choices=['sweep','snapshot','boot','probe','interleaved']);p.add_argument('--kinds',default='jitk,jitk-no-thp,jitk-malloc-no-thp,bare-process,bare-shared,fc-boot,fc-snapshot,hl-process,hl-shared');p.add_argument('--targets',default='1,16,64,256');p.add_argument('--reps',type=int,default=2);p.add_argument('--n',type=int,default=30);p.add_argument('--ram',type=int,default=16);a=p.parse_args()
    resource.setrlimit(resource.RLIMIT_NOFILE,(65536,65536))
    if a.mode=='snapshot':snapshot(a.ram)
    elif a.mode=='interleaved':interleaved(a.kinds.split(','),a.n,a.ram)
    else:
        for kind in a.kinds.split(','):
            if a.mode=='sweep':
                for rep in range(a.reps):sweep(kind,rep,[int(x) for x in a.targets.split(',')],a.ram)
            elif a.mode=='boot':boot_samples(kind,a.n,a.ram)
            else:
                cg=mkdircg(f'probe-{os.getpid()}');v=None
                try:
                    v=VM(kind,cg,a.ram);print(json.dumps({'timing':v.timing(),'memory':sample([v],cg,1),'out':v.out.decode(errors='replace'),'err':v.err.decode(errors='replace')},indent=2))
                finally:
                    if v:v.close()
                    rmcg(cg)
if __name__=='__main__':
    try:main()
    finally:
        for v in list(LIVE):v.close()
