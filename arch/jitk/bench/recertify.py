#!/usr/bin/env python3
"""Paired v2 regression subset; all sampling/gates/cleanup come from run.py."""
import argparse, json, os, random, statistics, subprocess, sys, threading, time
from pathlib import Path
import run as bench

SPECS=[{'name':mode+'/'+case,'mode':mode,'case':case} for mode,case in [
    ('jitk-cold','return2'),('jitk-parked-raw','one_tool'),
    ('jitk-parked-raw','promise10_5ms'),('jitk-parked-memory','one_tool')]]

def paired_summary(rows):
    result=[]
    for spec in SPECS:
        a=[r for r in rows if r['name']==spec['name']]
        for metric in ('latency_ms','footprint_mib','rss_mib','cpu_ms_vm'):
            pairs=[]
            for block in sorted({r['block'] for r in a}):
                pair={r['build']:r for r in a if r['block']==block and r['status']=='PASS' and metric in r}
                if len(pair)==2:pairs.append((pair['baseline'][metric],pair['v2'][metric]))
            if not pairs:continue
            delta=[new-old for old,new in pairs]
            st=bench.stats(delta)['p50']
            loads=[r['load_before'][0] for r in a]
            result.append({'case':spec['name'],'metric':metric,'pairs':len(pairs),
                'baseline_median':statistics.median(p[0] for p in pairs),
                'v2_median':statistics.median(p[1] for p in pairs),
                'paired_median_difference':st['value'],'paired_ci95':st['ci95'],
                'load1_range':[min(loads),max(loads)],
                'gate_passed':sum(r['gate']['passed'] for r in a),'samples':len(a),
                'failures':sum(r['status']!='PASS' for r in a)})
    return result

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--vmm',required=True);p.add_argument('--baseline',required=True)
    p.add_argument('--image',required=True);p.add_argument('--scratch-dir',required=True)
    p.add_argument('--output',required=True);p.add_argument('--samples',type=int,default=60)
    p.add_argument('--gate-budget',type=float,default=1);p.add_argument('--seed',type=int,default=604)
    args=p.parse_args()
    if args.samples<60:p.error('recertification requires n>=60 per build/case')
    raw=Path(args.output).resolve();raw.parent.mkdir(parents=True,exist_ok=True)
    data={'schema':1,'started_at':bench.utc(),'config':vars(args),'samples':[],
          'statistics':{'estimator':'median(v2_i - baseline_i), pairs are adjacent randomized builds in a case/block',
                        'bootstrap':'2000 paired IID resamples; percentile CI95; seed 601; no trimming'},
          'load_monitor':[],'machine':{'platform':bench.platform.platform(),'cpu_count':os.cpu_count(),
          'uptime':bench.command(['/usr/bin/uptime']),
          'sysctl':bench.command(['/usr/sbin/sysctl','hw.model','hw.memsize','hw.ncpu','kern.hv.max_address_spaces'])}}
    stop=threading.Event();quiet_seen=threading.Event()
    def monitor():
        while not stop.is_set():
            load=list(os.getloadavg());data['load_monitor'].append({'at':bench.utc(),'load':load})
            if load[0]<6:quiet_seen.set()
            stop.wait(.5)
    thread=threading.Thread(target=monitor);thread.start()
    def save():
        tmp=raw.with_suffix('.tmp');tmp.write_text(json.dumps(data,indent=2)+'\n');tmp.replace(raw)
    selections={}
    bench.WATCH=subprocess.Popen([sys.executable,str(bench.HERE/'watchdog.py')],stdin=subprocess.PIPE)
    try:
        for label,vmm in [('baseline',args.baseline),('v2',args.vmm)]:
            cfg=argparse.Namespace(vmm=vmm,image=args.image,sandbox_profile='auto',scratch_dir=args.scratch_dir,
                hyperlight_adapter=None,no_hyperlight=True,executor_root=None,node=None)
            selections[label]=bench.choose(cfg)
        data['selection']=selections
        # Same artifact/signature admission and exact functional assertion as the main harness.
        for label,selection in selections.items():
            for attempt in range(3):
                entry={'build':label,'attempt':attempt+1,'at':bench.utc(),'load':list(os.getloadavg())};w=None
                try:
                    w=bench.Worker(selection['argv']);w.ready(ack=True);w.run('one_tool');entry['status']='PASS'
                except Exception as e:entry.update(status='FAIL',error=repr(e))
                finally:
                    if w:w.close()
                    data.setdefault('admission',[]).append(entry);save()
                if entry['status']=='PASS':break
                bench.gate(6,args.gate_budget)
            else:raise RuntimeError('three admission failures; raw retained')
        def collect(pass_name):
            for block in range(args.samples):
                order=SPECS[:];rng=random.Random(args.seed+block);rng.shuffle(order)
                for spec in order:
                    builds=['baseline','v2'];rng.shuffle(builds)
                    for label in builds:
                        g=bench.gate(6,args.gate_budget)
                        r={'pass':pass_name,'block':block,'name':spec['name'],'build':label,'started_at':bench.utc(),
                           'gate':g,'load_before':list(os.getloadavg()),'uptime':bench.command(['/usr/bin/uptime'])}
                        try:r.update(bench.sample(spec,selections[label],None));r['status']='PASS'
                        except Exception as e:r.update(status='FAIL',error=repr(e))
                        r.update(finished_at=bench.utc(),load_after=list(os.getloadavg()));data['samples'].append(r);save()
                    print(json.dumps({'pass':pass_name,'block':block,'case':spec['name'],
                        'status':[r['status'] for r in data['samples'][-2:]],'load':list(os.getloadavg())}),flush=True)
        collect('paired')
        if quiet_seen.is_set():
            data['quiet_pass']='triggered by observed load1 < 6; each sample retains the same gate; quiet claims require >=30 passes per row'
            collect('quiet-pass')
        else:data['quiet_pass']='No quiet pass was possible: load1 never dropped below 6 during monitored setup and collection.'
        data['summary']={name:paired_summary([r for r in data['samples'] if r['pass']==name])
                         for name in sorted({r['pass'] for r in data['samples']})}
    finally:
        for pid in list(bench.ACTIVE):
            bench.kill_descendants(pid)
            try:os.killpg(pid,bench.signal.SIGKILL)
            except ProcessLookupError:pass
            try:os.waitpid(pid,0)
            except ChildProcessError:pass
            bench.ACTIVE.discard(pid)
        bench.WATCH.stdin.close();bench.WATCH.wait(timeout=5);bench.WATCH=None
        stop.set();thread.join();data.update(finished_at=bench.utc(),active_owned_pids=list(bench.ACTIVE),
            uptime_end=bench.command(['/usr/bin/uptime']))
        data['load1_monitor_range']=[min(r['load'][0] for r in data['load_monitor']),max(r['load'][0] for r in data['load_monitor'])]
        save()
    print('RAW '+str(raw),flush=True)
if __name__=='__main__':main()
