#!/usr/bin/env python3
"""Offline ledger collector, standard library only. Never installs a runtime helper.

macOS: libproc + read-only ledger(2), vmmap/footprint, vm_stat/sysctl/memory_pressure.
Linux/Asahi: /proc/PID/{stat,smaps,smaps_rollup,status}, /proc/{vmstat,meminfo,pressure/memory}.
Run timing experiments through the shared host's lockf/flock as described in RESULTS.md.
"""
import argparse
import ctypes
import datetime
import hashlib
import json
import os
from pathlib import Path
import platform
import random
import re
import resource
import selectors
import signal
import statistics
import subprocess
import sys
import time

HERE = Path(__file__).resolve().parent
MIB = 1048576
DARWIN = sys.platform == 'darwin'

def utc():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

def command(argv, timeout=30):
    start = time.monotonic()
    try:
        r = subprocess.run(argv, capture_output=True, text=True, timeout=timeout)
        return dict(argv=argv, status=r.returncode, stdout=r.stdout, stderr=r.stderr,
                    elapsed_s=time.monotonic()-start)
    except Exception as e:
        return dict(argv=argv, error=repr(e), elapsed_s=time.monotonic()-start)

def host():
    return dict(utc=utc(), load=list(os.getloadavg()), uptime=command(['uptime']))

class RUsage(ctypes.Structure):
    _fields_ = [('uuid',ctypes.c_uint8*16)] + [(k,ctypes.c_uint64) for k in (
        'user_ticks','system_ticks','idle_wakeups','interrupt_wakeups','pageins','wired','rss',
        'footprint','start','exit','child_user','child_system','child_idle','child_interrupt',
        'child_pageins','child_elapsed','diskread','diskwritten','qos_default','qos_maintenance',
        'qos_background','qos_utility','qos_legacy','qos_initiated','qos_interactive','billed',
        'serviced','logical_writes','footprint_peak','instructions','cycles','billed_energy',
        'serviced_energy','interval_peak','runnable')]

class LedgerTemplate(ctypes.Structure):
    _fields_ = [(k,ctypes.c_char*32) for k in ('name','group','units')]

class LedgerEntry(ctypes.Structure):
    _fields_ = [(k,ctypes.c_int64) for k in ('balance','credit','debit','limit','refill','last')]

if DARWIN:
    LIB=ctypes.CDLL('/usr/lib/libSystem.B.dylib', use_errno=True)
    PROC=ctypes.CDLL('/usr/lib/libproc.dylib', use_errno=True)
    PROC.proc_pid_rusage.argtypes=[ctypes.c_int,ctypes.c_int,ctypes.c_void_p]
    LIB.ledger.argtypes=[ctypes.c_int,ctypes.c_void_p,ctypes.c_void_p,ctypes.c_void_p]
    template=(LedgerTemplate*256)(); n=ctypes.c_int(256)
    if LIB.ledger(2,template,ctypes.byref(n),None):
        raise OSError(ctypes.get_errno(),'read-only LEDGER_TEMPLATE_INFO')
    TEMPLATES=[{k:getattr(t,k).decode() for k in ('name','group','units')} for t in template[:n.value]]
    class Timebase(ctypes.Structure):
        _fields_=[('numer',ctypes.c_uint32),('denom',ctypes.c_uint32)]
    tb=Timebase();LIB.mach_timebase_info(ctypes.byref(tb));TIMEBASE=tb.numer/tb.denom
else:
    TEMPLATES=[];TIMEBASE=1

def proc(pid):
    d=dict(pid=pid,utc=utc())
    if DARWIN:
        r=RUsage()
        if PROC.proc_pid_rusage(pid,4,ctypes.byref(r)):
            return dict(d,error=os.strerror(ctypes.get_errno()))
        d.update({k:int(getattr(r,k)) for k in ('user_ticks','system_ticks','wired','rss','footprint',
                    'footprint_peak','pageins','idle_wakeups','interrupt_wakeups','instructions','cycles')})
        d.update(user_ms=r.user_ticks*TIMEBASE/1e6,system_ms=r.system_ticks*TIMEBASE/1e6)
        entries=(LedgerEntry*256)();n=ctypes.c_int(256)
        if LIB.ledger(1,pid,entries,ctypes.byref(n)):
            d['ledger_error']=os.strerror(ctypes.get_errno())
        else:
            d['ledger']={TEMPLATES[i]['name']:int(e.balance) for i,e in enumerate(entries[:n.value])}
    else:
        root=Path('/proc')/str(pid)
        try:
            for file in ('status','smaps_rollup','smaps','stat'):
                try:d[file]=(root/file).read_text()
                except OSError as e:d[file+'_error']=repr(e)
            stats=d['stat'][d['stat'].rfind(')')+2:].split();hz=os.sysconf('SC_CLK_TCK')
            d.update(user_ms=int(stats[11])*1000/hz,system_ms=int(stats[12])*1000/hz)
            d['smaps_totals']={k:int(v)*1024 for k,v in re.findall(r'^([A-Za-z_]+):\s+(\d+) kB',d.get('smaps_rollup',''),re.M)}
            d['rss']=d['smaps_totals'].get('Rss')
        except OSError as e:d['error']=repr(e)
    return d

def system():
    start=host()
    commands = {
        'vm_stat':['/usr/bin/vm_stat'], 'memory_pressure':['/usr/bin/memory_pressure','-Q'],
        'sysctl_vm':['/usr/sbin/sysctl','vm'],
    } if DARWIN else {k:['cat',v] for k,v in (
        ('vm_stat','/proc/vmstat'),('meminfo','/proc/meminfo'),('memory_pressure','/proc/pressure/memory'))}
    start['commands']={k:command(v) for k,v in commands.items()}
    if DARWIN:
        text=start['commands']['vm_stat'].get('stdout','')
        start['page_size']=int(re.search(r'page size of (\d+)',text)[1])
        start['vm_pages']={k:int(v) for k,v in re.findall(r'^([^:\n]+):\s+(\d+)\.',text,re.M)}
        start['sysctl']={k:v for k,v in re.findall(r'^(vm\.[^:]+): (.*)$',start['commands']['sysctl_vm'].get('stdout',''),re.M)}
    start['finished_utc']=utc()
    return start

class Worker:
    def __init__(self,argv):
        self.p=subprocess.Popen(argv,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,
                                bufsize=0,start_new_session=True,env={'PATH':'/usr/bin:/bin'})
        self.pid=self.p.pid;self.select=selectors.DefaultSelector()
        for pipe in (self.p.stdout,self.p.stderr):self.select.register(pipe,selectors.EVENT_READ)
        self.buf=b'';self.err=b'';self.frames=[];self.closed=False
    def pump(self,timeout):
        for key,_ in self.select.select(timeout):
            b=os.read(key.fileobj.fileno(),65536)
            if not b:self.select.unregister(key.fileobj);continue
            if key.fileobj is self.p.stderr:self.err+=b
            else:
                self.buf+=b
                while b'\n' in self.buf:
                    line,self.buf=self.buf.split(b'\n',1)
                    if line.startswith(b'\x1e'):continue
                    self.frames.append(json.loads(line))
    def recv(self,timeout=15):
        end=time.monotonic()+timeout
        while not self.frames:
            if time.monotonic()>end or not self.select.get_map():
                raise TimeoutError(dict(pid=self.pid,stderr=self.err.decode(errors='replace'),partial=repr(self.buf)))
            self.pump(min(.1,max(0,end-time.monotonic())))
        return self.frames.pop(0)
    def ready(self):
        assert self.recv()=={'t':'ready','v':1}
        if DARWIN:
            end=time.monotonic()+10
            while b'{"sandbox":"ok"}\n' not in self.err:
                if time.monotonic()>end:raise TimeoutError('missing sandbox acknowledgement')
                self.pump(.01)
    def send(self,m):
        self.p.stdin.write(json.dumps(m,separators=(',',':'),ensure_ascii=True).encode()+b'\n')
    def close(self):
        if self.closed:return None
        self.closed=True
        try:os.killpg(self.pid,signal.SIGKILL)
        except ProcessLookupError:pass
        _,status,r=os.wait4(self.pid,0);self.p.returncode=os.waitstatus_to_exitcode(status)
        for f in (self.p.stdin,self.p.stdout,self.p.stderr):f.close()
        self.select.close()
        return dict(user_ms=r.ru_utime*1000,system_ms=r.ru_stime*1000,status=self.p.returncode)

def size(s):
    m=re.fullmatch(r'([\d.]+)([KMGT]?)',s)
    return float(m[1])*1024**(' KMGT'.index(m[2]) if m[2] else 0)

def parse_vmmap(text):
    rows={};in_table=False;zone=False;zones={}
    for line in text.splitlines():
        if line.startswith('REGION TYPE') and 'SIZE' in line:in_table=True;continue
        if line.startswith('MALLOC ZONE'):in_table=False;zone=True;continue
        if in_table:
            m=re.match(r'^(.*?)\s{2,}(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\d+)',line)
            if m:
                try:rows[m[1].strip()]={k:size(v) for k,v in zip(('virtual','resident','dirty','swapped','volatile','nonvolatile','empty'),m.groups()[1:8])}
                except (TypeError,ValueError):pass
        if zone and line.startswith('DefaultMallocZone_'):
            parts=line.split();zones[parts[0]]=dict(zip(('virtual','resident','dirty','swapped','allocations','allocated','fragmented'),[size(x) for x in parts[1:8]]))
    return dict(regions=rows,malloc_zones=zones)

def diagnostics(pid,folder,full=False):
    folder.mkdir(parents=True,exist_ok=True)
    if not DARWIN:return {'process':proc(pid)}
    calls={'vmmap-summary':['vmmap','-summary',str(pid)],
           'footprint':['footprint','-p',str(pid),'-f','bytes','-w'],
           'footprint-object':['footprint','-p',str(pid),'--vmObjectDirty','-f','bytes','-w']}
    if full:calls['vmmap']=['vmmap','-wide',str(pid)]
    result={}
    for k,args in calls.items():
        r=command(args);path=folder/(k+'.txt');path.write_text(r.get('stdout','')+r.get('stderr',''))
        result[k]={'path':str(path.relative_to(HERE)),'status':r.get('status'),'elapsed_s':r['elapsed_s']}
        if k=='vmmap-summary':result['parsed']=parse_vmmap(r.get('stdout',''))
    return result

def memory(args):
    out=Path(args.output);art=Path(args.artifacts).resolve();out.parent.mkdir(parents=True,exist_ok=True)
    data=dict(schema=1,kind='memory',start=host(),machine=dict(platform=platform.platform(),
        sysctl=command(['sysctl','hw.model','hw.memsize','hw.ncpu','kern.hv.max_address_spaces']) if DARWIN else command(['uname','-a']),
        python=sys.version,git=command(['git','rev-parse','HEAD']),timebase_ns_per_tick=TIMEBASE,
        ledger_templates=TEMPLATES),selection=json.loads((art/'selection.json').read_text()),
        config={k:v for k,v in vars(args).items() if k!='fn'},cells=[])
    def save():out.write_text(json.dumps(data,indent=2)+'\n')
    variants=args.variants.split(',');counts=[int(x) for x in args.counts.split(',')]
    rng=random.Random(601)
    for repeat in range(args.repeats):
        cells=[(v,n) for v in variants for n in counts]
        if repeat:rng.shuffle(cells)
        for variant,n in cells:
            cell=dict(repeat=repeat,variant=variant,n=n,start=host(),controller_before=proc(os.getpid()),before=system(),phases={},cleanup=[])
            ws=[];data['cells'].append(cell);save()
            try:
                image=art/('image.bin' if variant=='current' else f'image-{variant}.bin')
                argv=[str(art/'jitk-vmm'),'--image',str(image),'--mem-mib','32']
                if DARWIN and not args.inline_sandbox:argv+=['--sandbox-profile',str(art/'jitk.sbbin')]
                cell['argv']=argv
                cell['ready_count']=0
                for _ in range(n):
                    w=Worker(argv);ws.append(w);w.ready();cell['ready_count']+=1
                time.sleep(.1)
                for phase in ('ready','one_tool_wait'):
                    if phase=='one_tool_wait':
                        for w in ws:w.send({'t':'run','code':'return await test.echo(2);','ns':{'test':['echo']}})
                        for w in ws:
                            m=w.recv();assert m=={'t':'call','id':1,'ns':'test','fn':'echo','args':[2]},m
                    d=dict(start=host(),processes=[proc(w.pid) for w in ws],controller=proc(os.getpid()),system=system(),diagnostics={})
                    cell['phases'][phase]=d;save()
                    if DARWIN and ws and repeat==0:
                        folder=HERE/'raw'/out.stem/'regions'/f'r{repeat}-{variant}-n{n}-{phase}'
                        folder.mkdir(parents=True,exist_ok=True)
                        js=folder/'footprint-all.json'
                        r=command(['footprint',*[a for w in ws for a in ('-p',str(w.pid))],'-f','bytes','-w','-j',str(js)],timeout=180)
                        (folder/'footprint-all.txt').write_text(r.get('stdout','')+r.get('stderr',''))
                        d['batch_footprint']={'status':r.get('status'),'elapsed_s':r['elapsed_s'],'path':str(folder.relative_to(HERE))}
                        save()
                    selected=(list(range(n)) if args.details=='all' else sorted({0,n//2,n-1})) if n else []
                    for i in selected:
                        d['diagnostics'][str(ws[i].pid)]=diagnostics(ws[i].pid,HERE/'raw'/out.stem/'regions'/f'r{repeat}-{variant}-n{n}-{phase}'/str(ws[i].pid),full=(i==0))
                    d['after_diagnostics']=[proc(w.pid) for w in ws];save()
                for w in ws:w.send({'t':'ret','id':1,'ok':2})
                for w in ws:assert w.recv()=={'t':'done','ok':2}
                cell['status']='ok'
            except Exception as e:
                cell['status']='error';cell['error']=repr(e)
                cell['partial_processes']=[proc(w.pid) for w in ws]
                cell['partial_system']=system()
            finally:
                for w in ws:
                    try:cell['cleanup'].append(dict(pid=w.pid,**w.close()))
                    except Exception as e:cell['cleanup'].append(dict(pid=w.pid,error=repr(e)))
                time.sleep(.15);cell['after']=system();cell['controller_after']=proc(os.getpid());cell['end']=host();save()
            print(json.dumps({k:cell.get(k) for k in ('repeat','variant','n','status','error')}),flush=True)
    data['end']=host();save()

def fit(points):
    xs=[x for x,y in points];ys=[y for x,y in points];xm=statistics.mean(xs);ym=statistics.mean(ys)
    slope=sum((x-xm)*(y-ym) for x,y in points)/sum((x-xm)**2 for x in xs)
    intercept=ym-slope*xm
    return dict(slope=slope,intercept=intercept,max_residual=max(abs(y-(slope*x+intercept)) for x,y in points))

def controls(args):
    art=Path(args.artifacts).resolve();out=Path(args.output)
    data=dict(schema=1,kind='prebuild-control',start=host(),repeats=[])
    for repeat in range(args.repeats):
        c=dict(repeat=repeat,before=system(),stages={});data['repeats'].append(c);ws=[]
        try:
            for _ in range(args.count):
                w=Worker([str(art/'jitk-vmm'),'--image',str(art/'image.bin'),'--mem-mib','32','--sandbox-profile',str(art/'jitk.sbbin'),'--wait-go']);ws.append(w)
                end=time.monotonic()+15
                while b'WAIT_GO' not in w.err:
                    if time.monotonic()>end:raise TimeoutError(w.err.decode())
                    w.pump(.01)
            for stage in ('prebuild','ready','one_tool_wait'):
                if stage=='ready':
                    for w in ws:w.p.stdin.write(b'x')
                    for w in ws:w.ready()
                if stage=='one_tool_wait':
                    for w in ws:w.send({'t':'run','code':'return await test.echo(2);','ns':{'test':['echo']}})
                    for w in ws:assert w.recv()['t']=='call'
                c['stages'][stage]=dict(processes=[proc(w.pid) for w in ws],system=system(),diagnostics=diagnostics(ws[0].pid,HERE/'raw'/out.stem/f'r{repeat}-{stage}',full=True))
                out.write_text(json.dumps(data,indent=2)+'\n')
            c['status']='ok'
        except Exception as e:c['status']='error';c['error']=repr(e)
        finally:
            c['cleanup']=[dict(pid=w.pid,**w.close()) for w in ws];c['after']=system()
            out.write_text(json.dumps(data,indent=2)+'\n')
        print('control',repeat,c['status'],flush=True)
    data['end']=host();out.write_text(json.dumps(data,indent=2)+'\n')

def analyze(args):
    d=json.loads(Path(args.input).read_text());summary={'fits':{},'rows':[]}
    for c in d['cells']:
        if c['status']!='ok':continue
        for phase,p in c['phases'].items():
            rows=p['processes'];n=c['n'];sums={k:sum(r.get(k,0) for r in rows) for k in ('footprint','rss','wired','footprint_peak')}
            ledgers={k:sum(r.get('ledger',{}).get(k,0) for r in rows) for k in ('internal','internal_compressed','external','page_table','tkm_private','tkm_shared','phys_footprint','alternate_accounting','purgeable_nonvolatile')}
            def vm(s,k):return s.get('vm_pages',{}).get(k,0)*s.get('page_size',1)
            system_deltas={k:vm(p['system'],k)-(vm(c['before'],k)+vm(c['after'],k))/2 for k in ('Pages wired down','Pages occupied by compressor','Anonymous pages','File-backed pages','Pages free','Pages active','Pages inactive','Pages stored in compressor')}
            summary['rows'].append(dict(repeat=c['repeat'],variant=c['variant'],n=n,phase=phase,sums=sums,ledgers=ledgers,system_deltas=system_deltas))
    for v in sorted({r['variant'] for r in summary['rows']}):
        for phase in ('ready','one_tool_wait'):
            rows=[r for r in summary['rows'] if r['variant']==v and r['phase']==phase]
            if len({r['n'] for r in rows})<2:continue
            summary['fits'][v+'/'+phase]={group+'/'+k:fit([(r['n'],r[group][k]) for r in rows]) for group in ('sums','ledgers','system_deltas') for k in rows[0][group]}
    Path(args.output).write_text(json.dumps(summary,indent=2)+'\n')
    print(json.dumps(summary['fits'],indent=2))

def analyze_cpu(args):
    data=json.loads(Path(args.input).read_text());groups={}
    def delta(a,b):
        if not a or not b or not all(k in a and k in b for k in ('user_ms','system_ms')):return None
        return {k:a[k]-b[k] for k in ('user_ms','system_ms')}
    for r in data['samples']:
        key='/'.join(r[k] for k in ('kind','mode','case'));g=groups.setdefault(key,[])
        before=r.get('vmm_before_run') if r['mode']=='parked' else r['vmm_ready']
        phases={'vmm_boot':r['vmm_ready'],'vmm_execute':delta(r.get('vmm_done'),before),
                'vmm_teardown':delta(r['vmm_total'],r.get('vmm_done')),'vmm_lifecycle':r['vmm_total'],
                'watchdog_run':delta(r.get('watchdog_after'),r.get('watchdog_before'))}
        if r['kind']=='raw':
            phases.update(node_boot=delta(r['ready']['node'],r['node_start']['node']),
                node_execute=delta(r['done']['node'],r['before_run']['node']),
                node_teardown=delta(r['reaped']['node'],r['done']['node']),
                node_lifecycle=delta(r['reaped']['node'],r['node_start']['node']))
        else:
            boot=delta(r['ready']['node'],r['boot_start']['node'])
            execute=delta(r['resolved']['node'],r['before_run']['node'])
            if r['mode']=='cold':execute=delta(execute,boot)
            phases.update(node_boot=boot,node_execute=execute,
                node_teardown=delta(r['after_close']['node'],r['resolved']['node']),
                node_lifecycle=delta(r['after_close']['node'],r['prepare_start']['node']))
        for p in phases.values():
            if p is not None:p['total_ms']=p['user_ms']+p['system_ms']
        phases['service_lifecycle']={k:sum(phases[p][k] for p in ('vmm_lifecycle','node_lifecycle','watchdog_run')) for k in ('user_ms','system_ms','total_ms')} if phases['watchdog_run'] else None
        g.append(phases)
    result={}
    for key,rows in groups.items():
        result[key]={}
        for phase in rows[0]:
            values=[r[phase] for r in rows if r.get(phase) is not None]
            if not values:continue
            result[key][phase]={'n':len(values),**{k:{'p50':statistics.median(x[k] for x in values),'mean':statistics.mean(x[k] for x in values),'min':min(x[k] for x in values),'max':max(x[k] for x in values)} for k in ('user_ms','system_ms','total_ms')}}
    Path(args.output).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))

def main():
    p=argparse.ArgumentParser(description=__doc__);sub=p.add_subparsers(dest='action',required=True)
    m=sub.add_parser('memory');m.add_argument('--artifacts',default=str(HERE/'artifacts'));m.add_argument('--output',default=str(HERE/'memory-raw.json'))
    m.add_argument('--variants',default='current,0,1,8');m.add_argument('--counts',default='1,16,64,256');m.add_argument('--repeats',type=int,default=3);m.add_argument('--details',choices=('sampled','all'),default='sampled');m.set_defaults(fn=memory)
    m.add_argument('--inline-sandbox',action='store_true',help='control: compile the Seatbelt profile inside every VMM')
    a=sub.add_parser('analyze');a.add_argument('input');a.add_argument('--output',default=str(HERE/'summary.json'));a.set_defaults(fn=analyze)
    c=sub.add_parser('analyze-cpu');c.add_argument('input');c.add_argument('--output',default=str(HERE/'cpu-summary.json'));c.set_defaults(fn=analyze_cpu)
    b=sub.add_parser('controls');b.add_argument('--artifacts',default=str(HERE/'artifacts'));b.add_argument('--count',type=int,default=16);b.add_argument('--repeats',type=int,default=3);b.add_argument('--output',default=str(HERE/'controls-raw.json'));b.set_defaults(fn=controls)
    s=sub.add_parser('snapshot');s.add_argument('pids',nargs='*',type=int);s.set_defaults(fn=lambda a:print(json.dumps(dict(host=system(),processes=[proc(x) for x in a.pids]),indent=2)))
    args=p.parse_args();args.fn(args)

if __name__=='__main__':main()
