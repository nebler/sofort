#!/usr/bin/env python3
"""One canonical load-gated, interleaved benchmark controller. Standard library only."""
import argparse, concurrent.futures, ctypes, hashlib, heapq, json, math, os
import platform, random, re, select, signal, statistics, subprocess, sys, time, threading, shutil, runpy, tempfile
from pathlib import Path
HERE=Path(__file__).resolve().parent
kill_descendants=runpy.run_path(str(HERE/'processes.py'))['kill_descendants']
ROOT=HERE.parent
CASES=json.loads((HERE/'cases.json').read_text())
ACTIVE=set()
WATCH=None
WATCH_LOCK=threading.Lock()

def utc():
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()
def command(argv):
    try:return subprocess.check_output(argv, text=True, stderr=subprocess.STDOUT, timeout=5).strip()
    except Exception as e:return repr(e)
def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def quant(xs,q):
    a=sorted(xs);p=(len(a)-1)*q;i=int(p)
    return a[i]+(a[min(i+1,len(a)-1)]-a[i])*(p-i)
def stats(xs,boot=2000):
    rng=random.Random(601)
    replicas=[[xs[rng.randrange(len(xs))] for _ in xs] for _ in range(boot)]
    return {'n':len(xs),'min':min(xs),'max':max(xs),**{
        name:{'value':quant(xs,q),'ci95':[quant([quant(a,q) for a in replicas],.025),quant([quant(a,q) for a in replicas],.975)]}
        for name,q in [('p50',.5),('p90',.9),('p99',.99)]}}
def gate(threshold,budget,poll=1,read=os.getloadavg,clock=time.monotonic,sleep=time.sleep):
    start=clock();observations=[]
    while True:
        load=list(read());elapsed=clock()-start;observations.append({'elapsed_s':elapsed,'load':load})
        if load[0]<threshold or elapsed>=budget:
            return {'threshold':threshold,'budget_s':budget,'wait_s':elapsed,'passed':load[0]<threshold,
                    'timed_out':load[0]>=threshold,'observations':observations}
        sleep(min(poll,max(0,budget-elapsed)))

class Usage(ctypes.Structure):
    _fields_=[('uuid',ctypes.c_uint8*16)]+[(k,ctypes.c_uint64) for k in
        ('user_ns','system_ns','idle','interrupt','pageins','wired','rss','footprint','start','exit')]
LIB=None
if sys.platform=='darwin':
    LIB=ctypes.CDLL('/usr/lib/libproc.dylib')
    LIB.proc_pid_rusage.argtypes=[ctypes.c_int,ctypes.c_int,ctypes.c_void_p]
def usage(pid):
    if LIB:
        r=Usage()
        if LIB.proc_pid_rusage(pid,0,ctypes.byref(r))==0:
            return {k:int(getattr(r,k)) for k in ('user_ns','system_ns','wired','rss','footprint')}
    return None

def watch(line):
    with WATCH_LOCK:
        if WATCH:WATCH.stdin.write((line+'\n').encode());WATCH.stdin.flush()
class Worker:
    def __init__(self,argv,env=None,lifetime=20):
        self.start=time.perf_counter_ns()
        self.p=subprocess.Popen(argv,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,
             bufsize=0,start_new_session=True,env={'PATH':'/usr/bin:/bin',**(env or {})})
        self.pid=self.p.pid;ACTIVE.add(self.pid);watch(f'+{self.pid} {lifetime}')
        self.tree_cleanup = Path(argv[0]).name in ('node', 'node-real') or str(HERE/'executor.mjs') in argv
        self.fds={self.p.stdout.fileno():'out',self.p.stderr.fileno():'err'}
        self.buf=b'';self.err=b'';self.frames=[];self.records=[];self.closed=False
        self.cpu_ms=None;self.returncode=None
    def send(self,frame):
        wire=json.dumps(frame,ensure_ascii=True,separators=(',',':')).encode()+b'\n'
        if len(wire)>1048577:raise ValueError('frame too large')
        self.p.stdin.write(wire)
    def pump(self,timeout):
        for fd in select.select(list(self.fds),[],[],max(0,timeout))[0]:
            b=os.read(fd,65536)
            if not b:self.fds.pop(fd);continue
            if self.fds[fd]=='err':
                self.err+=b
                if len(self.err)>65536:raise ValueError('stderr cap')
            else:
                self.buf+=b
                if len(self.buf)>2097152:raise ValueError('stdout cap')
                while b'\n' in self.buf:
                    line,self.buf=self.buf.split(b'\n',1)
                    if line.startswith(b'\x1e'):self.records.append(line.decode('ascii'));continue
                    if not line.isascii():raise ValueError('non-ASCII frame')
                    self.frames.append(json.loads(line))
    def recv(self,timeout=10):
        end=time.monotonic()+timeout
        while not self.frames:
            if not self.fds or time.monotonic()>=end:raise TimeoutError({'stderr':self.err.decode(errors='replace'),'partial':self.buf[:256].decode(errors='replace')})
            self.pump(min(.1,end-time.monotonic()))
        return self.frames.pop(0)
    def ready(self,ack=False):
        m=self.recv();assert m=={'t':'ready','v':1},m
        if ack:
            end=time.monotonic()+10
            while b'{"sandbox":"ok"}\n' not in self.err:
                if not self.fds or time.monotonic()>=end:raise TimeoutError('missing host sandbox ack')
                self.pump(min(.1,end-time.monotonic()))
    def run(self,case,cold=False):
        c=CASES[case];before=time.perf_counter_ns();load_start=list(os.getloadavg())
        self.send({'t':'run','code':c['code'],'ns':{'test':['echo']}})
        due=[];calls=0;max_pending=0;call_stamps=[];end=time.monotonic()+10
        while True:
            now=time.monotonic_ns()
            while due and due[0][0]<=now:
                _,id,value=heapq.heappop(due);self.send({'t':'ret','id':id,'ok':value})
            while self.frames:
                m=self.frames.pop(0)
                if m['t']=='done':
                    done=time.perf_counter_ns()
                    assert m=={'t':'done','ok':c['expected']},m
                    assert not due,'unawaited tool calls'
                    expected_calls=10 if case=='promise10_5ms' else (1 if case.startswith('one_tool') else 0)
                    assert calls==expected_calls,(calls,expected_calls)
                    return {'latency_ms':(done-(self.start if cold else before))/1e6,
                      'run_ms':(done-before)/1e6,'tool_calls':calls,'max_pending':max_pending,
                      'call_stamps_ns':call_stamps,'load_at_timing_start':load_start,
                      'load_at_result':list(os.getloadavg())}
                if m['t']=='log':continue
                assert m['t']=='call' and m['id']==calls+1 and m['ns']=='test' and m['fn']=='echo' and len(m['args'])==1,m
                calls+=1;call_stamps.append(time.monotonic_ns())
                heapq.heappush(due,(time.monotonic_ns()+int(c['tool_delay_ms']*1e6),m['id'],m['args'][0]))
                max_pending=max(max_pending,len(due))
            if time.monotonic()>end or not self.fds:raise TimeoutError(self.err.decode(errors='replace'))
            wait=max(0,(due[0][0]-time.monotonic_ns())/1e9) if due else .1
            self.pump(min(.1,wait))
    def close(self):
        if self.closed:return
        self.closed=True
        waited,status,r=os.wait4(self.pid,os.WNOHANG)
        if not waited and self.tree_cleanup:
            kill_descendants(self.pid)
            waited,status,r=os.wait4(self.pid,os.WNOHANG)
        if not waited:
            try:os.killpg(self.pid,signal.SIGKILL)
            except ProcessLookupError:pass
            except PermissionError:
                try:os.kill(self.pid,signal.SIGKILL)
                except ProcessLookupError:pass
            _,status,r=os.wait4(self.pid,0)
        self.returncode=os.waitstatus_to_exitcode(status);self.p.returncode=self.returncode
        self.cpu_ms=(r.ru_utime+r.ru_stime)*1000
        watch(f'-{self.pid}');ACTIVE.discard(self.pid)
        for f in (self.p.stdin,self.p.stdout,self.p.stderr):f.close()


def marker_path(directory,keys,defaults):
    if not (directory/'.READY').exists():return None
    raw=(directory/'.READY').read_text()
    try:
        d=json.loads(raw)
        for key in keys:
            if isinstance(d.get(key),str):
                p=Path(d[key]);return str(p if p.is_absolute() else directory/p)
    except (ValueError,AttributeError):pass
    for key in keys:
        m=re.search('^'+key+'=(.+)$',raw,re.M)
        if m:
            p=Path(m[1]);return str(p if p.is_absolute() else directory/p)
    return next((str(p) for p in defaults if p.exists()),None)

def choose(args):
    def artifact(value, env, candidates, label):
        path=value or os.environ.get(env) or next((str(p) for p in candidates if p.is_file()),None)
        if not path or not Path(path).is_file():
            raise SystemExit(f'{label} missing; build it inside {ROOT} or set {env}/explicit CLI override')
        return str(Path(path).resolve())
    image=artifact(args.image,'JITK_IMAGE',[ROOT/'kernel/dist/kernel.bin',ROOT/'kernel/build/kernel.bin'],'kernel image')
    vmm=artifact(args.vmm,'JITK_VMM_BINARY',[ROOT/'vmm/build/jitk-vmm',ROOT/'vmm/target/release/jitk-vmm'],'VMM')
    selection={'kernel_source':'explicit override' if args.image or os.environ.get('JITK_IMAGE') else 'canonical kernel',
               'vmm_source':'explicit override' if args.vmm or os.environ.get('JITK_VMM_BINARY') else 'canonical VMM'}
    scratch=Path(args.scratch_dir or os.environ.get('JITK_BENCH_TMP',tempfile.gettempdir()))
    scratch.mkdir(parents=True,exist_ok=True)
    frozen=Path(tempfile.mkdtemp(prefix='jitk-bench-',dir=scratch)).resolve()
    for key,source,name in [('image',image,'kernel.bin'),('vmm',vmm,'jitk-vmm')]:
        selection['source_'+key]=source;selection[key+'_sha256']=sha(source)
        shutil.copy2(source,frozen/name);selection[key]=str(frozen/name)
        assert sha(selection[key])==selection[key+'_sha256'],'artifact changed while copying'
    selection['argv']=[selection['vmm'],'--image',selection['image'],'--mem-mib','32']
    # Production confinement is required for both implicit and explicit artifacts.
    profile=str(frozen/'jitk.sbbin')
    if args.sandbox_profile and args.sandbox_profile!='auto':
        shutil.copy2(args.sandbox_profile,profile)
    else:
        subprocess.run([selection['vmm'],'--compile-profile',profile,'--images',str(frozen)],check=True,timeout=30,capture_output=True)
    selection.update(require_sandbox_ack=True,sandbox_profile=profile,sandbox_profile_sha256=sha(profile))
    selection['argv']+=['--sandbox-profile',profile]
    if sys.platform=='darwin':
        probe=frozen/'sandbox-probe'
        subprocess.run(['/usr/bin/clang','-O2',str(HERE/'sandbox_probe.c'),'-lsandbox','-o',str(probe)],check=True)
        selection['sandbox_probe']={'binary':str(probe),'profile':profile,'profile_sha256':sha(profile),
                                   'source':'canonical precompiled profile; sandbox_apply call only, no VM'}
    adapter=Path(args.hyperlight_adapter or os.environ.get('HYPERLIGHT_ADAPTER',HERE/'hyperlight/adapter.json'))
    if adapter.exists() and not args.no_hyperlight:
        hl=json.loads(adapter.read_text());hl['descriptor_sha256']=sha(adapter)
        # Descriptors may use paths relative to their own directory.
        for key in ('strict_argv','clone_argv'):
            for i in (0,2):
                value=Path(hl[key][i]);hl[key][i]=str((adapter.parent/value).resolve() if not value.is_absolute() else value)
        hl['hashes']={f:sha(f) for f in hl.get('files',[]) if Path(f).is_file()}
        hl['source_argv']={k:hl[k][:] for k in ('strict_argv','clone_argv')}
        binary=frozen/'hyperlight-worker';shutil.copy2(hl['strict_argv'][0],binary)
        snapshot=frozen/'hyperlight-snapshot';shutil.copytree(hl['strict_argv'][2],snapshot)
        hl['frozen_snapshot_hashes']={str(f.relative_to(snapshot)):sha(f) for f in snapshot.rglob('*') if f.is_file()}
        for key in ('strict_argv','clone_argv'):hl[key]=[str(binary),hl[key][1],str(snapshot)]
        selection['hyperlight']=hl
    base=Path(args.executor_root).resolve() if args.executor_root else ROOT/'executor'
    exe=frozen/'executor'
    integrated=(base/'.READY').exists() or bool(args.executor_root)
    if integrated:
        shutil.copytree(base,exe,ignore=shutil.ignore_patterns('node_modules','__pycache__'))
        modules=next((p/'node_modules' for p in [base,*base.parents] if (p/'node_modules').exists()),None)
        if modules:(exe/'node_modules').symlink_to(modules.resolve(),target_is_directory=True)
    else:modules=None
    selection['executor']={'source':str(base),'integrated':integrated,'build':str(exe/'build'),'node_modules':str(modules) if modules else None,
        'runtime_sha256':{str(f.relative_to(exe)):sha(f) for f in exe.rglob('*')
                          if f.is_file() and 'node_modules' not in f.parts and f.suffix in ('.js','.mjs','.py')}}
    selection['node']=args.node or os.environ.get('NODE')
    if selection['node']:
        if not Path(selection['node']).is_absolute():raise SystemExit('--node/NODE must be an absolute Node executable path')
        selection['node_runtime']=command([selection['node'],'-p','JSON.stringify({execPath:process.execPath,version:process.version})'])
    selection['harness_sha256']={f:sha(HERE/f) for f in ('run.py','cases.json','executor.mjs','watchdog.py','sandbox_probe.c','processes.py')}
    return selection

def make_specs(s):
    specs=[]
    def add(mode,case,**kw):specs.append({'name':mode+'/'+case,'mode':mode,'case':case,**kw})
    for mode in ('jitk-cold','jitk-parked-raw'):
        for case in CASES:add(mode,case)
    for c in (4,8):add('jitk-refill',str(c),concurrency=c)
    add('jitk-parked-memory','one_tool')
    if s.get('sandbox_probe'):
        for case in ('on','off'):add('sandbox-apply',case)
    if s.get('hyperlight'):
        for mode in ('hl-strict','hl-strict-parked','hl-clone'):
            for case in CASES:add(mode,case)
        add('hl-parked-memory','one_tool')
    if s.get('node') and Path(s['executor']['build'],'executor.js').exists():
        for mode in ('executor-cold','executor-parked'):
            for case in CASES:add(mode,case)
    return specs

def refill(s,c):
    # Independent workers; every batch starts c builders and replaces each on READY+reap.
    def one(_):
        w=Worker(s['argv'])
        try:w.ready(ack=s.get('require_sandbox_ack',False));return (time.perf_counter_ns()-w.start)/1e6
        finally:w.close()
    n=c*4;before=time.perf_counter_ns()
    cpu0=__import__('resource').getrusage(__import__('resource').RUSAGE_CHILDREN)
    with concurrent.futures.ThreadPoolExecutor(max_workers=c) as ex:ready=list(ex.map(one,range(n)))
    elapsed=(time.perf_counter_ns()-before)/1e9
    cpu1=__import__('resource').getrusage(__import__('resource').RUSAGE_CHILDREN)
    return {'refill_vms_s':n/elapsed,'cpu_ms_vm':((cpu1.ru_utime+cpu1.ru_stime)-(cpu0.ru_utime+cpu0.ru_stime))*1000/n,
            'vms':n,'wall_s':elapsed,'ready_ms':ready}

def sample(spec,s,clone):
    mode=spec['mode'];case=spec['case']
    if mode=='sandbox-apply':
        cfg=s['sandbox_probe'];w=Worker([cfg['binary'],cfg['profile'],case])
        try:return w.recv()
        finally:w.close()
    if mode=='jitk-refill':return refill(s,spec['concurrency'])
    if mode.startswith('executor-'):
        cmd=[s['node'],str(HERE/'executor.mjs'),s['executor']['build'],mode,case,json.dumps(s)]
        w=Worker(cmd,lifetime=40)
        try:
            # Adapter waits for GO after cold config / parked pool preparation.
            prepared=w.recv()
            if prepared!={'t':'prepared'}:raise RuntimeError({'phase':'executor preparation','response':prepared})
            w.send({'t':'go'});r=w.recv(30)
            if r.get('error'):raise RuntimeError(r)
            assert r['t']=='measurement';return r
        finally:w.close()
    cold=mode in ('jitk-cold','hl-strict','jitk-sandbox-on','jitk-sandbox-off')
    if mode=='hl-clone':
        w=clone
        return w.run(case)
    argv=s['argv'][:];env=None
    if mode in ('hl-strict','hl-strict-parked','hl-parked-memory'):argv=s['hyperlight']['strict_argv'];env=s['hyperlight'].get('env')
    w=Worker(argv,env)
    try:
        w.ready(ack=mode.startswith('jitk-') and s.get('require_sandbox_ack',False))
        if not cold:time.sleep(.005)
        if mode in ('jitk-parked-memory','hl-parked-memory'):
            readings=[]
            for _ in range(5):readings.append(usage(w.pid));time.sleep(.002)
            if not all(readings):raise RuntimeError('libproc memory unavailable')
            r={'rss_mib':statistics.median([x['rss']/1048576 for x in readings]),
               'footprint_mib':statistics.median([x['footprint']/1048576 for x in readings]),'memory_readings':readings}
            r.update(w.run(case))
        else:r=w.run(case,cold)
    finally:w.close()
    r.update(cpu_ms_vm=w.cpu_ms,through_reap_ms=(time.perf_counter_ns()-w.start)/1e6)
    return r

def report(data,out):
    lines=['# Canonical benchmark results','',f"Run: {data['started_at']} → {data.get('finished_at','RUNNING')}. Platform: {data['machine']['platform']}.",
      f"Start: `{data['machine']['uptime']}`. End: `{data.get('uptime_end','RUNNING')}`.",'',
      f"Gate: load1 < {data['config']['load_threshold']}; {data['config']['gate_budget']} s budget/sample. Randomized complete blocks; seed {data['config']['seed']}.",
      'Cold = spawn → validated done; parked = RUN → validated done after READY and 5 ms idle. Tools return asynchronously after 0 or 5 ms as named. JSON case parses/stringifies exactly 1 MiB internally, returns its length (not a 1 MiB protocol frame).',
      'Executor = execute() → validated result; Node startup/pool preparation excluded. Refill = READY + kill/reap, 4 waves per sample. CPU = child user+system through reap; watchdog/supervisor excluded. Parked memory = process RSS/physical footprint, excludes HVF kernel allocations. Sandbox on/off = precompiled sandbox_apply versus clock-only baseline, no VM; not an end-to-end subtraction.',
      'Cached binary/image/signature runs; first validation excluded. Single-use hardware VM except explicitly shared-HW Hyperlight logical clones. No nested-KVM performance.','',
      'Values and brackets: estimate [95% bootstrap CI], 2,000 IID resamples. Quantiles interpolate order statistics. n=30 p99 is poorly resolved; CI does not remove contention or serial dependence.',
      '**Quiet credibility requires ≥30 gate-passed samples per row. A timed-out gate remains a contended sample; no idle-host conclusion follows. Latency percentiles are conditional on validated results; failures are counted separately and never treated as zero-latency successes.**','',
      '| Case / metric | n / fail | p50 [CI95] | p90 [CI95] | p99 [CI95] | load1 range | gated / timed-out |','|---|---:|---:|---:|---:|---:|---:|']
    units={'latency_ms':'ms','refill_vms_s':'VM/s','cpu_ms_vm':'CPU-ms/VM','rss_mib':'MiB RSS','footprint_mib':'MiB footprint','sandbox_apply_ms':'ms sandbox_apply','sandbox_prepare_apply_ms':'ms profile-read+apply','done_to_resolve_ms':'ms done→resolve'}
    for spec in data['specs']:
        a=[r for r in data['samples'] if r['name']==spec['name']];ok=[r for r in a if r['status']=='PASS'];failed=len(a)-len(ok)
        if not ok:
            lines.append(f"| {spec['name']} | 0 / {failed} | UNVERIFIED | — | — | — | — |")
            continue
        quiet=[r for r in ok if r['gate']['passed']]
        groups=[('all',ok)]
        if quiet and len(quiet)<len(ok):groups.append(('gate-passed only'+(' · UNVERIFIED n<30' if len(quiet)<30 else ''),quiet))
        for label,group in groups:
            loads=[r['load_before'][0] for r in group];passed=sum(r['gate']['passed'] for r in group)
            for key,unit in units.items():
                vals=[r[key] for r in group if key in r]
                if not vals:continue
                st=stats(vals)
                def fmt(k):
                    v=st[k];return f"{v['value']:.3f} [{v['ci95'][0]:.3f}, {v['ci95'][1]:.3f}]"
                lines.append(f"| {spec['name']} · {unit} · {label} | {len(vals)} / {failed if label=='all' else 0} | {fmt('p50')} | {fmt('p90')} | {fmt('p99')} | {min(loads):.2f}–{max(loads):.2f} | {passed} / {len(group)-passed} |")
    lines+=['','Source selection (frozen at run start):','', '```json',json.dumps(data['selection'],indent=2),'```','',
      'Missing integrations: '+', '.join(data.get('missing',[]))+'.',
      'Raw observations, timestamps, gate histories, result assertions, machine state, hashes and failures: ['+Path(data['raw_path']).name+']('+Path(data['raw_path']).name+').',
      'All external performance claims must cite this table. R2 tables are historical contended measurements.']
    out.write_text('\n'.join(lines)+'\n')

def test():
    assert quant([1,2,3,4],.5)==2.5
    s=stats([2]*30,50);assert s['p99']=={'value':2.0,'ci95':[2.0,2.0]}
    t=[0];readings=iter([(10,9,8),(5,8,7)])
    g=gate(6,2,1,lambda:next(readings),lambda:t[0],lambda x:t.__setitem__(0,t[0]+x))
    assert g['passed'] and g['wait_s']==1
    g=gate(6,0,read=lambda:(9,8,7));assert g['timed_out']
    p=subprocess.Popen([sys.executable,'-c','import time;time.sleep(30)'],start_new_session=True)
    w=subprocess.Popen([sys.executable,str(HERE/'watchdog.py')],stdin=subprocess.PIPE)
    w.stdin.write(f'+{p.pid} .03\n'.encode());w.stdin.flush()
    assert p.wait(timeout=3)==-signal.SIGKILL
    w.stdin.close();w.wait(timeout=3)
    p=subprocess.Popen([sys.executable,'-c','import time;time.sleep(30)'],start_new_session=True)
    w=subprocess.Popen([sys.executable,str(HERE/'watchdog.py')],stdin=subprocess.PIPE)
    w.stdin.write(f'+{p.pid} 60\n'.encode());w.stdin.close()
    assert p.wait(timeout=3)==-signal.SIGKILL
    w.wait(timeout=3)
    worker=Worker([sys.executable,'-c','print("invalid-json",flush=True); import time; time.sleep(30)'])
    try:
        try:worker.ready()
        except json.JSONDecodeError:pass
        else:raise AssertionError('invalid JSON accepted')
    finally:worker.close()
    assert worker.returncode==-signal.SIGKILL and worker.pid not in ACTIVE
    # A wrapper's detached VM is outside the wrapper's process group.
    source='import subprocess,sys,json; p=subprocess.Popen([sys.executable,"-c","import time;time.sleep(30)"],start_new_session=True);print(json.dumps({"pid":p.pid}),flush=True);p.wait()'
    worker=Worker([sys.executable,'-c',source]);worker.tree_cleanup=True
    child_pid=worker.recv()['pid'];worker.close()
    try:os.kill(child_pid,0)
    except ProcessLookupError:pass
    else:raise AssertionError('detached descendant survived wrapper cleanup')
    parent=subprocess.Popen([sys.executable,'-c',source],stdout=subprocess.PIPE,start_new_session=True)
    child_pid=json.loads(parent.stdout.readline())['pid']
    w=subprocess.Popen([sys.executable,str(HERE/'watchdog.py')],stdin=subprocess.PIPE)
    w.stdin.write(f'+{parent.pid} 60\n'.encode());w.stdin.close()
    parent.wait(timeout=3);w.wait(timeout=3);parent.stdout.close()
    try:os.kill(child_pid,0)
    except ProcessLookupError:pass
    else:raise AssertionError('detached descendant survived external watchdog EOF')
    print('PASS statistics, gate pass/timeout, watchdog deadline/EOF, malformed output, detached descendants')

def main():
    global WATCH
    p=argparse.ArgumentParser();p.add_argument('--samples',type=int,default=30);p.add_argument('--load-threshold',type=float,default=6)
    p.add_argument('--gate-budget',type=float,default=10);p.add_argument('--gate-poll',type=float,default=1)
    p.add_argument('--max-extra-rounds',type=int,default=0,help='bounded extra blocks seeking samples gate-passed observations per case')
    p.add_argument('--seed',type=int,default=603);p.add_argument('--only');p.add_argument('--vmm');p.add_argument('--image');p.add_argument('--sandbox-profile')
    p.add_argument('--scratch-dir');p.add_argument('--node');p.add_argument('--no-hyperlight',action='store_true')
    p.add_argument('--executor-root',help='explicit already-validated integrated executor runtime root')
    p.add_argument('--hyperlight-adapter',help='explicit already-validated owner-09 descriptor')
    p.add_argument('--smoke',action='store_true');p.add_argument('--test',action='store_true');p.add_argument('--report');p.add_argument('--output')
    args=p.parse_args()
    if args.test:test();return
    if args.report:
        data=json.loads(Path(args.report).read_text());report(data,HERE/'RESULTS.md');return
    if not args.smoke and args.samples<30:p.error('canonical run requires samples >= 30')
    if not all(math.isfinite(x) for x in (args.gate_budget,args.gate_poll,args.load_threshold)) or args.gate_budget<0 or args.gate_poll<=0 or args.load_threshold<=0 or args.max_extra_rounds<0:p.error('invalid gate configuration')
    s=choose(args);specs=make_specs(s)
    if args.only:specs=[x for x in specs if re.search(args.only,x['name'])]
    if not specs:p.error('--only matched no cases')
    raw=Path(args.output) if args.output else HERE/('smoke.json' if args.smoke else 'raw.json')
    data={'schema':1,'started_at':utc(),'config':vars(args),'selection':s,'specs':specs,'samples':[],
      'statistics':{'method':'percentile IID bootstrap','draws':2000,'seed':601,'quantile':'linear order-statistic interpolation','confidence':.95},
      'raw_path':str(raw),'machine':{'platform':platform.platform(),'cpu_count':os.cpu_count(),'uptime':command(['/usr/bin/uptime']),
      'sysctl':command(['/usr/sbin/sysctl','hw.model','hw.memsize','hw.ncpu','kern.hv.max_address_spaces']),
      'vm_stat':command(['/usr/bin/vm_stat']),'python':sys.version,'timezone':time.tzname},
      'missing':[]}
    if s['executor']['integrated'] is False:data['missing'].append('integrated executor READY')
    if not s.get('sandbox_probe'):data['missing'].append('precompiled sandbox on/off')
    if not s.get('hyperlight'):data['missing'].append('Hyperlight adapter')
    def save():
        tmp=raw.with_suffix('.tmp');tmp.write_text(json.dumps(data,indent=2)+'\n');tmp.replace(raw)
    WATCH=subprocess.Popen([sys.executable,str(HERE/'watchdog.py')],stdin=subprocess.PIPE)
    clone=None
    try:
        # Warm signature/image admission; validate all worker variants once before measurements.
        for label,argv in [('jitk',s['argv'])]+([('hl-strict',s['hyperlight']['strict_argv'])] if s.get('hyperlight') else []):
            for attempt in range(3):
                entry={'label':label,'attempt':attempt+1,'at':utc(),'load':list(os.getloadavg()),'uptime':command(['/usr/bin/uptime'])}
                w=None
                try:
                    w=Worker(argv);w.ready(ack=label=='jitk' and s.get('require_sandbox_ack',False));w.run('one_tool')
                    entry.update(status='PASS',ms=(time.perf_counter_ns()-w.start)/1e6)
                except Exception as e:entry.update(status='FAIL',error=repr(e))
                finally:
                    if w:w.close()
                    data.setdefault('admission',[]).append(entry);save()
                if entry['status']=='PASS':break
                gate(args.load_threshold,min(args.gate_budget,10),args.gate_poll)
            else:raise RuntimeError('three admission failures; retained in raw JSON')
        if s.get('hyperlight') and any(x['mode']=='hl-clone' for x in specs):
            clone=Worker(s['hyperlight']['clone_argv'],s['hyperlight'].get('env'),lifetime=7200);clone.ready()
        for block in range(2 if args.smoke else args.samples+args.max_extra_rounds):
            order=specs[:];random.Random(args.seed+block).shuffle(order)
            for spec in order:
                g=gate(args.load_threshold,args.gate_budget,args.gate_poll)
                r={'name':spec['name'],'block':block,'started_at':utc(),'gate':g,'load_before':list(os.getloadavg()),
                   'uptime':command(['/usr/bin/uptime'])}
                try:r.update(sample(spec,s,clone));r['status']='PASS'
                except Exception as e:r.update(status='FAIL',error=repr(e))
                r.update(finished_at=utc(),load_after=list(os.getloadavg()));data['samples'].append(r);save()
                print(json.dumps({k:r[k] for k in ('name','block','status','load_before')}),flush=True)
            if not args.smoke and (block+1)%10==0:report(data,HERE/'RESULTS.md')
            if not args.smoke and block+1>=args.samples and all(
                sum(r['name']==spec['name'] and r['status']=='PASS' and r['gate']['passed'] for r in data['samples'])>=args.samples
                for spec in specs):break
    finally:
        if clone:clone.close()
        for pid in list(ACTIVE):
            try:
                kill_descendants(pid)
                done,_=os.waitpid(pid,os.WNOHANG)
                if not done:os.killpg(pid,signal.SIGKILL);os.waitpid(pid,0)
            except PermissionError:
                try:os.kill(pid,signal.SIGKILL);os.waitpid(pid,0)
                except (ProcessLookupError,ChildProcessError):pass
            except (ProcessLookupError,ChildProcessError):pass
            ACTIVE.discard(pid)
        WATCH.stdin.close();WATCH.wait(timeout=5);WATCH=None
        data.update(finished_at=utc(),uptime_end=command(['/usr/bin/uptime']),vm_stat_end=command(['/usr/bin/vm_stat']));save()
        if not args.smoke:report(data,HERE/'RESULTS.md')
    print('RAW '+str(raw),flush=True)
if __name__=='__main__':main()
