#!/usr/bin/env python3
"""09 fair matrix using 06's canonical gate, Worker, watchdog and report code.
Only Hyperlight parking and the exact R2 50 ms workload extend that controller.
"""
import argparse,importlib.util,json,os,platform,random,statistics,subprocess,sys,time
from pathlib import Path
ROOT=Path(__file__).resolve().parent
sys.dont_write_bytecode=True # importing 06 must not write outside this subtree
spec=importlib.util.spec_from_file_location('canonical_bench',ROOT.parent/'run.py')
CONTROLLER_SOURCE=(ROOT.parent/'run.py').read_bytes()
b=importlib.util.module_from_spec(spec)
exec(compile(CONTROLLER_SOURCE,str(ROOT.parent/'run.py'),'exec'),b.__dict__)
JITK=ROOT.parents[1]
NODE=os.environ.get('JITK_NODE','')
BUILD=Path(os.environ.get('HYPERLIGHT_BUILD_DIR',str(ROOT/'build'))).resolve()
WORKER=str(Path(os.environ.get('HYPERLIGHT_WORKER',str(BUILD/'target/release/r2-worker'))).resolve())
SNAPSHOT=str(Path(os.environ.get('HYPERLIGHT_SNAPSHOT',str(BUILD/'snapshot'))).resolve())

def jitk_config():
    cfg={'vmm':str(Path(os.environ.get('JITK_VMM_BINARY',str(JITK/'vmm/build/jitk-vmm'))).resolve()),
         'image':str(Path(os.environ.get('JITK_KERNEL_IMAGE',os.environ.get('JITK_IMAGE',str(JITK/'kernel/dist/kernel.bin')))).resolve()),
         'launcher':'01-vmm','parkingEvidence':str(JITK/'kernel/.READY'),
         'hyperlight':{'worker':WORKER,'snapshot':SNAPSHOT}}
    for key in ('vmm','image'):
        if not Path(cfg[key]).is_file():raise RuntimeError('Missing canonical '+key+': '+cfg[key]+'; build jitk or set JITK_VMM_BINARY and JITK_KERNEL_IMAGE (or JITK_IMAGE)')
    return cfg

def jitk_argv(cfg):
    argv=[cfg['vmm'],'--image',cfg['image'],'--mem-mib','32']
    if sys.platform=='darwin':
        # The production VMM requires a profile scoped to the selected image dir.
        import tempfile
        with tempfile.NamedTemporaryFile(prefix='jitk-hyperlight-',suffix='.sbbin',delete=False) as f:profile=Path(f.name)
        try:
            subprocess.run([cfg['vmm'],'--compile-profile',str(profile),'--images',str(Path(cfg['image']).parent)],check=True,timeout=30,capture_output=True)
            cfg['sandboxProfile']=str(profile)
        except BaseException:
            profile.unlink(missing_ok=True);raise
        argv+=['--sandbox-profile',str(profile)]
    return argv

CASES={k:v for k,v in b.CASES.items() if k!='one_tool'}
CASES['cpu50ms']={'code':'const end=Date.now()+50; let n=0; do {for(let i=0;i<1000;i++)n=(n+i)|0;} while(Date.now()<end); return 2;','expected':2,'tool_delay_ms':0}
b.CASES=CASES
MODES=['jitk-cold','hl-strict-cold','jitk-parked','hl-strict-prespawned','hl-logical-clone']
CONTRACTS={m:('shared HW VM, fresh logical clone per request' if m=='hl-logical-clone' else 'fresh process + single-use HW VM') for m in MODES}
class Suite:
    def __init__(self):
        self.executor=(ROOT.parents[1]/'executor/.READY').exists()
        self.cfg=jitk_config()
        self.argv=jitk_argv(self.cfg)
        self.clone=None
        try:
            self.clone=b.Worker([WORKER,'clone',SNAPSHOT],lifetime=7200);self.clone.ready()
        except BaseException:
            self.close();raise
    def close(self):
        if self.clone:self.clone.close()
        if self.cfg.get('sandboxProfile'):Path(self.cfg['sandboxProfile']).unlink(missing_ok=True)
    def sample(self,mode,case,iteration=0):
        if mode!='hl-logical-clone' and self.executor:
            c={**CASES[case],'calls':10 if case=='promise10_5ms' else 1 if case=='one_tool_5ms' else 0}
            w=b.Worker([NODE,'--experimental-transform-types',str(ROOT/'executor-runner.mjs'),str(JITK/'executor/build'),mode,json.dumps(c),json.dumps(self.cfg)],lifetime=40)
            try:
                ready=w.recv();assert ready['t']=='prepared',ready
                parked=b.usage(ready['worker_pid']) if ready['worker_pid'] else None
                w.send({'t':'go'});r=w.recv(30)
                assert r['t']=='measurement' and 'error' not in r,r
                r.update(parked_memory_bytes=parked,jitk_path='04 integrated executor' if mode.startswith('jitk') else None,host_path='04 integrated executor',isolation=CONTRACTS[mode])
                # Allow executor close to reap both VMM and its watchdog before killing the helper.
                end=time.monotonic()+10
                while w.fds and time.monotonic()<end:w.pump(.05)
                assert not w.fds,'executor cleanup timeout'
                return r
            finally:w.close()
        cold=mode in ('jitk-cold','hl-strict-cold')
        w=self.clone if mode=='hl-logical-clone' else b.Worker(self.argv if mode.startswith('jitk') else [WORKER,'strict',SNAPSHOT])
        r={}
        try:
            if w is not self.clone:w.ready(ack=mode.startswith('jitk'))
            ready_ms=(time.perf_counter_ns()-w.start)/1e6
            if not cold:time.sleep(.005)
            parked=b.usage(w.pid)
            r=w.run(case,cold)
            r.update(parked_memory_bytes=parked,spawn_to_ready_ms=ready_ms if w is not self.clone else None,
                     isolation=CONTRACTS[mode],jitk_path='canonical VMM raw channel (executor not READY at run start)' if mode.startswith('jitk') else None)
            return r
        finally:
            if w is not self.clone:
                w.close();r.update(cpu_ms_vm=w.cpu_ms,through_reap_ms=(time.perf_counter_ns()-w.start)/1e6)

def memory_sample(kind,count,cfg=None):
    owned=kind=='jitk' and cfg is None
    if owned:cfg=jitk_config();jitk_argv(cfg)
    argv=([cfg['vmm'],'--image',cfg['image'],'--mem-mib','32']+(['--sandbox-profile',cfg['sandboxProfile']] if cfg.get('sandboxProfile') else [])) if kind=='jitk' else None
    w=b.Worker(argv if kind=='jitk' else
               [WORKER,'strict',SNAPSHOT] if kind=='hl-strict' else [WORKER,'hold',SNAPSHOT,str(count)])
    try:
        w.ready(ack=kind=='jitk');readings=[]
        for _ in range(5):
            time.sleep(.002);readings.append(b.usage(w.pid))
        assert all(readings)
        return {'footprint_mib':statistics.median(x['footprint']/2**20 for x in readings),
            'rss_mib':statistics.median(x['rss']/2**20 for x in readings),'memory_readings':readings,'units':count}
    finally:
        w.close()
        if owned and cfg.get('sandboxProfile'):Path(cfg['sandboxProfile']).unlink(missing_ok=True)

def main():
    p=argparse.ArgumentParser();p.add_argument('n',type=int,nargs='?',default=30)
    p.add_argument('--gate-budget',type=float,default=.1);p.add_argument('--load-threshold',type=float,default=6)
    p.add_argument('--output',default=str(ROOT/'results'));p.add_argument('--smoke',action='store_true');a=p.parse_args()
    if not a.smoke and a.n<30:p.error('n >=30 required')
    if not NODE or not Path(NODE).is_absolute():p.error('Set JITK_NODE to a verified absolute Node executable')
    if not os.environ.get('HYPERLIGHT_JS_SRC'):p.error('Set HYPERLIGHT_JS_SRC to the pinned checkout; see README.md')
    out=Path(a.output);out.mkdir(exist_ok=True)
    config={**vars(a),'seed':39009,'gate_poll':.1}
    suite=None;data={'schema':1,'started_at':b.utc(),'config':config,'selection':{},'specs':[],
        'samples':[],'raw_path':str(out/'raw.json'),'missing':[],
        'machine':{'platform':platform.platform(),'uptime':b.command(['/usr/bin/uptime']),'cpu_count':os.cpu_count()}}
    for mode in MODES:
        for case in CASES:data['specs'].append({'mode':mode,'case':case,'name':mode+'/'+case})
    for kind,count in [('jitk',1),('hl-strict',1),('hl-logical',1),('hl-logical',17),('hl-logical',33)]:
        data['specs'].append({'mode':'memory','kind':kind,'count':count,'name':f'memory/{kind}/{count}'})
    def save():
        t=out/'raw.tmp';t.write_text(json.dumps(data,indent=2)+'\n');t.replace(out/'raw.json')
    b.WATCH=subprocess.Popen([sys.executable,str(ROOT.parent/'watchdog.py')],stdin=subprocess.PIPE)
    try:
        suite=Suite()
        data['selection']={'jitk':suite.cfg,'executor_ready_at_start':suite.executor,
            'protocol':str(ROOT.parents[1]/'protocol/dispatcher.ts'),
            'canonical_controller_sha256':b.hashlib.sha256(CONTROLLER_SOURCE).hexdigest(),
            'canonical_controller':str(ROOT.parent/'run.py'),'bench_ready_at_start':(ROOT.parent/'.READY').exists(),
            'hyperlight':{**json.loads((ROOT/'adapter.json').read_text()),
                'strict_argv':[WORKER,'strict',SNAPSHOT],'clone_argv':[WORKER,'clone',SNAPSHOT]},'contracts':CONTRACTS,
            'hashes':{x:b.sha(x) for x in [WORKER,suite.cfg['vmm'],suite.cfg['image'],str(ROOT/'executor-runner.mjs')]}}
        if not suite.executor:data['missing'].append('04 integrated executor not READY at start; canonical VMM raw channel used')
        (out/'controller-source.py').write_bytes(CONTROLLER_SOURCE)
        data['selection']['controller_source_archive']='controller-source.py'
        data['selection']['snapshot_index']=json.loads(Path(SNAPSHOT,'index.json').read_text())
        # Untimed signature/cache admission, same test result checked for all variants.
        for mode in MODES:suite.sample(mode,'return2')
        for i in range(a.n):
            specs=data['specs'][:];random.Random(39009+i).shuffle(specs)
            for spec in specs:
                gate=b.gate(a.load_threshold,a.gate_budget,poll=.1)
                r={'name':spec['name'],'block':i,'mode':spec['mode'],'case':spec.get('case'),
                    'started_at':b.utc(),'gate':gate,'load_before':list(os.getloadavg()),'uptime':b.command(['/usr/bin/uptime'])}
                try:
                    r.update(memory_sample(spec['kind'],spec['count'],suite.cfg) if spec['mode']=='memory' else suite.sample(spec['mode'],spec['case'],i));r['status']='PASS'
                except Exception as e:r.update(status='FAIL',error=repr(e))
                r.update(finished_at=b.utc(),load_after=list(os.getloadavg()));data['samples'].append(r);save()
                if r['status']!='PASS':raise RuntimeError(r)
            print(json.dumps({'block':i,'status':'PASS','uptime':b.command(['/usr/bin/uptime'])}),flush=True)
    finally:
        if suite:suite.close()
        for pid in list(b.ACTIVE):
            try:os.killpg(pid,9);os.waitpid(pid,0)
            except (ProcessLookupError,ChildProcessError):pass
            b.ACTIVE.discard(pid)
        b.WATCH.stdin.close();b.WATCH.wait(timeout=5);b.WATCH=None
        data.update(finished_at=b.utc(),uptime_end=b.command(['/usr/bin/uptime']));save()
        b.report(data,out/'RESULTS.md')
if __name__=='__main__':main()
