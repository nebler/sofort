#!/usr/bin/env python3
"""One external supervisor, identical source/tool implementation, balanced order.

No Node/npm launchers. Every worker is SIGKILLed and reaped in finally.
Memory is an observed per-process maximum sampled with proc_pid_rusage V0
on the same event loop (250 us nominal; actual sample gaps retained).
"""
import ctypes, hashlib, heapq, json, math, os, platform, random, select
import shutil, signal, statistics, subprocess, sys, time
from pathlib import Path
ROOT=Path(__file__).resolve().parent
REPO=ROOT.parents[2]
TMP=Path('/tmp/jitk-09'); WORKER=str(TMP/'adapter-target/release/r2-worker')
SNAPSHOT=str(TMP/'r2-snapshot')
SAMPLE=.00025
class Usage(ctypes.Structure):
    _fields_=[('uuid',ctypes.c_uint8*16)]+[(k,ctypes.c_uint64) for k in (
        'user_ns','system_ns','pkg_idle_wkups','interrupt_wkups','pageins',
        'wired','rss','footprint','start','exit')]
libproc=ctypes.CDLL('/usr/lib/libproc.dylib')
libproc.proc_pid_rusage.argtypes=[ctypes.c_int,ctypes.c_int,ctypes.c_void_p]
def usage(pid):
    r=Usage()
    if libproc.proc_pid_rusage(pid,0,ctypes.byref(r)):return None
    return {k:int(getattr(r,k)) for k in ('rss','footprint','wired','user_ns','system_ns')}
def uptime():return subprocess.check_output(['/usr/bin/uptime'],text=True).strip()
def digest(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def quant(a):
    s=sorted(a)
    return {'n':len(s),'median':statistics.median(s),
        'p90':s[math.ceil(.90*len(s))-1],'p99':s[math.ceil(.99*len(s))-1]}
class Worker:
    def __init__(self,argv):
        self.start=time.perf_counter_ns()
        self.p=subprocess.Popen(argv,stdin=subprocess.PIPE,stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,env={},start_new_session=True,bufsize=0)
        for f in (self.p.stdout,self.p.stderr):os.set_blocking(f.fileno(),False)
        self.fds={self.p.stdout.fileno():'out',self.p.stderr.fileno():'err'}
        self.buf=b'';self.stderr=b'';self.frames=[];self.records=[];self.raw=False;self.raw_stdout=b''
        self.reset_memory()
    def reset_memory(self):
        self.base=usage(self.p.pid);self.peak={k:0 for k in ('rss','footprint','wired')}
        self.samples=0;self.last_sample=None;self.max_gap_ns=0
        self.sample()
    def sample(self):
        r=usage(self.p.pid)
        if r:
            now=time.perf_counter_ns()
            if self.last_sample:self.max_gap_ns=max(self.max_gap_ns,now-self.last_sample)
            self.last_sample=now;self.samples+=1
            for k in self.peak:self.peak[k]=max(self.peak[k],r[k])
    def send(self,m):
        wire=json.dumps(m,ensure_ascii=True,separators=(',',':')).encode()+b'\n'
        if len(wire)>1048577:raise ValueError('frame limit')
        self.p.stdin.write(wire)
    def pump(self,timeout):
        self.sample()
        ready,_,_=select.select(list(self.fds),[],[],max(0,min(SAMPLE,timeout)))
        for fd in ready:
            b=os.read(fd,65536)
            if not b:self.fds.pop(fd);continue
            if self.fds[fd]=='err':
                self.stderr+=b
                if len(self.stderr)>65536:raise ValueError('stderr limit')
                continue
            if self.raw:self.raw_stdout+=b;continue
            self.buf+=b
            if len(self.buf)>2097152:raise ValueError('buffer limit')
            while b'\n' in self.buf:
                line,self.buf=self.buf.split(b'\n',1)
                if line.startswith(b'\x1e'):self.records.append(line.decode('ascii'));continue
                if not line.isascii():raise ValueError('ASCII wire')
                self.frames.append(json.loads(line))
        self.sample()
    def ready(self):
        end=time.monotonic()+5
        while not self.frames:
            if time.monotonic()>end:raise TimeoutError(self.stderr.decode(errors='replace'))
            if not self.fds:raise RuntimeError(self.stderr.decode(errors='replace'))
            self.pump(end-time.monotonic())
        assert self.frames.pop(0)=={'t':'ready','v':1}
    def run(self,code,expected,cold):
        # A persistent supervisor is a transport, never a reused guest sandbox.
        if not cold:self.reset_memory()
        before=time.perf_counter_ns()
        self.send({'t':'run','code':code,'ns':{'test':['echo']}})
        scheduled=[];calls=[];next_id=1;max_pending=0;logs=[]
        end=time.monotonic()+5
        while True:
            if time.monotonic()>end:raise TimeoutError(self.stderr.decode(errors='replace'))
            now=time.monotonic_ns()
            while scheduled and scheduled[0][0]<=now:
                _,id,value=heapq.heappop(scheduled)
                self.send({'t':'ret','id':id,'ok':value})
            while self.frames:
                m=self.frames.pop(0)
                if m['t']=='done':
                    done=time.perf_counter_ns();self.sample()
                    assert m=={'t':'done','ok':expected},m
                    assert not scheduled,'unawaited calls'
                    return {'latency_ms':(done-(self.start if cold else before))/1e6,
                        'run_ms':(done-before)/1e6,'tool_calls':len(calls),'max_pending':max_pending,
                        'issue_span_ms':(calls[-1]-calls[0])/1e6 if len(calls)>1 else 0,
                        'memory_peak_bytes':self.peak,'memory_baseline_bytes':self.base,
                        'memory_increment_bytes':{k:self.peak[k]-(self.base or {}).get(k,0) for k in self.peak},
                        'memory_samples':self.samples,'memory_max_sample_gap_us':self.max_gap_ns/1000,
                        'logs':logs,'kernel_records':self.records[-4:]}
                if m['t']=='log':logs.append(m);continue
                assert m['t']=='call' and m['id']==next_id and m['ns']=='test' and m['fn']=='echo',m
                assert len(m['args'])==1
                next_id+=1;calls.append(time.monotonic_ns())
                heapq.heappush(scheduled,(time.monotonic_ns()+5_000_000,m['id'],m['args'][0]))
                max_pending=max(max_pending,len(scheduled))
            due=(scheduled[0][0]-time.monotonic_ns())/1e9 if scheduled else SAMPLE
            self.pump(min(SAMPLE,max(0,due)))
            if not self.fds and not self.frames:raise RuntimeError({'exit':self.p.poll(),'stderr':self.stderr.decode()})
    def close(self):
        if self.p.poll() is None:
            try:os.killpg(self.p.pid,signal.SIGKILL)
            except ProcessLookupError:pass
            except PermissionError:self.p.kill()
        self.p.wait(timeout=3)
        for f in (self.p.stdin,self.p.stdout,self.p.stderr):f.close()

CASES={
    'return2':('return 2;',2),
    'one_tool_5ms':('return await test.echo(2);',2),
    'promise10_5ms':('return await Promise.all(Array.from({length:10},(_,i)=>test.echo(i)));',list(range(10))),
    'json1m':('const s=\'{"x":"\'+"x".repeat(1048568)+\'"}\'; return JSON.stringify(JSON.parse(s)).length;',1048576),
    'cpu50ms':('const end=Date.now()+50; let n=0; do {for(let i=0;i<1000;i++)n=(n+i)|0;} while(Date.now()<end); return 2;',2)
}
def select_jitk():
    r2=REPO/'arch/02-guest-kernel/r2'
    markers=[r2/'READY',Path('/tmp/jitk-02/r2/READY')]
    ready=next((p for p in markers if p.exists()),None)
    src=Path('/tmp/jitk-02/r2' if ready else '/tmp/jitk-02')
    dst=TMP/'r2-jitk';dst.mkdir(exist_ok=True)
    for name in ('host','kernel.bin'):shutil.copy2(src/name,dst/name)
    return {'ready_marker':str(ready) if ready else None,'source':str(src),
        'argv':[str(dst/'host'),str(dst/'kernel.bin')],
        'host_sha256':digest(dst/'host'),'kernel_sha256':digest(dst/'kernel.bin')}
def bench(n=30):
    jitk=select_jitk();full=bool(jitk['ready_marker'])
    metadata={'uptime':uptime(),'machine':platform.platform(),'cpu':platform.processor(),
        'n':n,'jitk':jitk,'sampling_seconds':SAMPLE,'tool_latency_ms':5,
        'worker_sha256':digest(WORKER),'snapshot_index':json.loads(Path(SNAPSHOT,'index.json').read_text()),
        'measurement':'request/spawn to validated done; cold cleanup separately; page cache warm',
        'memory':'external proc_pid_rusage V0, observed max including entire resident process, no HVF kernel allocation attribution',
        'full_g5':full}
    (ROOT/'metadata.json').write_text(json.dumps(metadata,indent=2)+'\n')
    if not full:
        metadata['fallback_jitk']=jitk
        fallback(n,jitk)
        # Respect READY if it arrives while the permitted R1 comparison runs.
        jitk=select_jitk();full=bool(jitk['ready_marker'])
        metadata.update(jitk=jitk,full_g5=full,uptime_workloads=uptime())
        (ROOT/'metadata.json').write_text(json.dumps(metadata,indent=2)+'\n')
    fresh=Worker([WORKER,'fresh',SNAPSHOT]);clone=None
    raw=ROOT/'raw.jsonl';out=raw.open('w')
    try:
        fresh.ready();clone=Worker([WORKER,'clone',SNAPSHOT]);clone.ready()
        modes=(['jitk-cold'] if full else [])+['hl-strict','hl-fresh-inprocess','hl-snapshot-logical']
        for i in range(n):
            names=list(CASES);random.Random(9000+i).shuffle(names)
            for case in names:
                # Latin-square rotation balances within-block machine changes.
                order=modes[i%len(modes):]+modes[:i%len(modes)]
                if (i//len(modes))%2:order=list(reversed(order))
                for mode in order:
                    load=uptime();cold=mode in ('jitk-cold','hl-strict');w=None
                    try:
                        w=Worker(jitk['argv'] if mode=='jitk-cold' else [WORKER,'strict',SNAPSHOT]) if cold else (fresh if mode=='hl-fresh-inprocess' else clone)
                        if cold:w.ready()
                        record=w.run(*CASES[case],cold)
                        if cold:
                            start=w.start;w.close();w=None
                            record['through_reap_ms']=(time.perf_counter_ns()-start)/1e6
                        record.update(mode=mode,case=case,iteration=i,uptime=load,status='PASS')
                    except Exception as e:
                        record={'mode':mode,'case':case,'iteration':i,'uptime':load,'status':'FAIL','error':repr(e)}
                    finally:
                        if cold and w:w.close()
                    out.write(json.dumps(record)+'\n');out.flush()
                    if record['status']!='PASS':raise RuntimeError(record)
            print(json.dumps({'iteration':i,'status':'PASS'}),flush=True)
    finally:
        out.close();fresh.close()
        if clone:clone.close()
    summarize(raw)
def fallback(n,jitk):
    # The unchanged R1 image supports only a compiled-in print("hi").
    # No synthetic tools/JSON/CPU result is attributed to jitk.
    path=ROOT/'fallback.jsonl'
    with path.open('w') as out:
        for i in range(n):
            for mode in (['jitk-r1-print','hl-strict-print'] if i%2==0 else ['hl-strict-print','jitk-r1-print']):
                load=uptime();w=Worker(jitk['argv'] if mode=='jitk-r1-print' else [WORKER,'strict',SNAPSHOT])
                try:
                    if mode=='hl-strict-print':
                        w.ready();r=w.run('print("hi");',None,True)
                        assert r['logs'][0]['msg']=='hi'
                        w.p.wait(timeout=5)
                        r['latency_ms']=(time.perf_counter_ns()-w.start)/1e6
                    else:
                        # R1 includes non-JSON diagnostics, collect without the v1 decoder.
                        w.raw=True;end=time.monotonic()+5
                        while w.p.poll() is None or w.fds:
                            if time.monotonic()>end:raise TimeoutError('R1 print')
                            w.pump(SAMPLE)
                        elapsed=(time.perf_counter_ns()-w.start)/1e6
                        assert b'hi\n' in w.raw_stdout,(w.raw_stdout,w.stderr)
                        r={'latency_ms':elapsed,'memory_peak_bytes':w.peak,'memory_samples':w.samples,
                           'output':w.raw_stdout.decode(errors='replace')}
                    r.update(mode=mode,case='print-only',iteration=i,uptime=load,status='PASS')
                    out.write(json.dumps(r)+'\n');out.flush()
                finally:w.close()
    summarize(path)
def summarize(path):
    rows=[json.loads(s) for s in path.read_text().splitlines()]
    result=[]
    for mode,case in sorted({(r['mode'],r['case']) for r in rows}):
        a=[r for r in rows if (r['mode'],r['case'])==(mode,case)]
        row={'mode':mode,'case':case,'latency_ms':quant([r['latency_ms'] for r in a]),
            'memory_peak_mib':{k:quant([r['memory_peak_bytes'][k]/1048576 for r in a if r['memory_peak_bytes']]) for k in ('rss','footprint')}
            if all(r['memory_peak_bytes'] for r in a) else None}
        for key in ('run_ms','max_pending','issue_span_ms','memory_samples','memory_max_sample_gap_us','through_reap_ms'):
            if key in a[0]:row[key]=quant([r[key] for r in a])
        result.append(row)
    (ROOT/(path.stem+'-summary.json')).write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2))
if __name__=='__main__':
    if len(sys.argv)>1 and sys.argv[1]=='summary':summarize(ROOT/'raw.jsonl')
    else:bench(int(sys.argv[1]) if len(sys.argv)>1 else 30)
