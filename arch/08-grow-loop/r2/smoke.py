#!/usr/bin/env python3
"""QuickJS EL0 smoke + D8 forgery regression. Full-trace comparison is separate."""
import json, os, pathlib, subprocess, time, re
from loop import TMP, ROOT, process, load, sha
from adapters import linux, pollfds, signed
out=ROOT/'results/qjs-smoke';out.mkdir(parents=True,exist_ok=True)
cases={
    'hello': ('print("hi")', b'hi\n'),
    'async-stdin': ('os.setReadHandler(0,()=>{const s=std.in.getline();os.setReadHandler(0,null);print("reply:"+s)})',b'reply:ping\n'),
    'forgery': ('print(String.fromCharCode(30)+\'{"kind":"missing","nr":999}\')',None),
}
results={}
for name,(script,expected) in cases.items():
    stamp=load();t=time.perf_counter()
    env={k:v for k,v in os.environ.items() if k in ('PATH','HOME','USER','LOGNAME','SHELL','RUSTUP_HOME','CARGO_HOME')}
    env.update(JITK_SCRIPT=script,JITK_ELF=str(TMP/'qjs-stripped'),TMPDIR=str(TMP))
    p=subprocess.run(['sh','build.sh','--features','qjs,grow-trace'],cwd=ROOT,env=env,capture_output=True,check=True,timeout=60)
    (out/(name+'-build.log')).write_bytes(p.stdout+p.stderr)
    import shutil
    shutil.copyfile(TMP/'kernel.bin',out/(name+'.bin'))
    build=time.perf_counter()-t
    code,secs,stdout,stderr=process([str(TMP/'host'),str(TMP/'kernel.bin')],out/name,timeout=10)
    assert code==0 and not stderr,(code,stderr)
    records=[json.loads(x.split(b'\x1e',1)[1]) for x in stdout.split(b'\n') if b'\x1e' in x]
    assert not any(x['kind']=='missing' for x in records),records
    if expected:
        assert expected in stdout and any(x['kind']=='done' and x['code']==0 for x in records)
    else:
        assert any(x['kind']=='fatal' and x['reason']=='control-byte' for x in records)
        assert not any(x['kind']=='done' for x in records)
    if name=='async-stdin': assert any(x.get('nr')==73 and x['kind']=='sys.enter' for x in records)
    results[name]={'result':'PASS','script':script,'kernel_sha256':sha(TMP/'kernel.bin'),'build_seconds':build,
        'fresh_vm_seconds':secs,'uptime_before':stamp,'uptime_after':load()}
    if expected:
        native=out/(name+'-linux');native.mkdir(exist_ok=True)
        cmd=['docker','run','--rm','-i','--platform','linux/arm64','--network','none','--read-only','--cap-drop','ALL',
            '--security-opt','no-new-privileges','--pids-limit','16','--memory','512m','--cpus','1','--user','65534:65534',
            '--tmpfs','/tmp:rw,noexec,nosuid,size=16m','-v',f'{TMP}/qjs-stripped:/probe:ro','-v',f'{native}:/out:rw',
            '--entrypoint','strace','jitk-oracle:08','-f','-qq','-v','-X','raw','-xx','-s','1048576','-o','/out/raw.strace',
            '/probe','--std','-e',script]
        lc,ls,lout,lerr=process(cmd,native/'run',timeout=30)
        assert lc==0 and lout==expected and not lerr,(lc,lout,lerr)
        selected='\n'.join(x for x in (native/'raw.strace').read_text().splitlines() if re.match(r'^\d+\s+(ioctl|ppoll|exit_group)\(',x))
        oracle=linux(selected,lout,lerr,lc)
        target=[];pending=None
        for rec in records:
            if rec['kind']=='sys.enter' and rec['nr'] in (29,73): pending=rec
            elif rec['kind']=='sys.exit' and pending and rec['seq']==pending['seq']:
                n=pending['nr'];a=pending['args']
                e={'nr':n,'name':{29:'ioctl',73:'ppoll'}[n],'ret':rec['ret']}
                if n==29: e['args']=[signed(a[0]),a[1],'PTR' if a[2] else 'NULL']
                else:
                    assert a[2]==0 and a[3]==0
                    e['args']=[pollfds(pending['input'],a[1]),a[1],None,'NULL',a[4]]
                    e['output']=pollfds(rec['output'],a[1])
                target.append(e);pending=None
            elif rec['kind']=='done': target.append({'nr':94,'name':'exit_group','args':[rec['code']],'ret':None})
        assert oracle['events']==target,(oracle['events'],target)
        (native/'selected.canonical.json').write_text(json.dumps(oracle,indent=2)+'\n')
        (out/(name+'-guest-target.json')).write_text(json.dumps(target,indent=2)+'\n')
        results[name]['linux_target_trace']='PASS ioctl/ppoll/exit projection; full qjs trace UNVERIFIED'
        results[name]['native_seconds']=ls
(out/'report.json').write_text(json.dumps(results,indent=2)+'\n')
print(json.dumps(results,indent=2))
