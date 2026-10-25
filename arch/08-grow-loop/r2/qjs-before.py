#!/usr/bin/env python3
"""Replay the new missing handler against actual qjs; stop discovery at first miss."""
import json, os, pathlib, shutil, signal, subprocess, time
from loop import ROOT,TMP,load,sha
script='os.setReadHandler(0,()=>{const s=std.in.getline();os.setReadHandler(0,null);print("reply:"+s)})'
work=TMP/'qjs-before';assert not work.exists()
work.mkdir();shutil.copytree(ROOT/'kernel',work/'kernel');shutil.copyfile(ROOT/'build.sh',work/'build.sh')
(work/'kernel/src/syscalls/ppoll.rs').unlink()
out=ROOT/'results/qjs-before';out.mkdir(exist_ok=False)
env={k:v for k,v in os.environ.items() if k in ('PATH','HOME','USER','LOGNAME','SHELL','RUSTUP_HOME','CARGO_HOME')}
env.update(JITK_SCRIPT=script,JITK_ELF=str(TMP/'qjs-stripped'),TMPDIR=str(TMP))
stamp=load();start=time.perf_counter()
p=subprocess.run(['sh','build.sh','--features','qjs,grow-trace'],cwd=work,env=env,capture_output=True,check=True,timeout=60)
build=time.perf_counter()-start
(out/'build.log').write_bytes(p.stdout+p.stderr);shutil.copyfile(TMP/'kernel.bin',out/'missing.bin')
start=time.perf_counter();miss=None
with open(out/'console.stdout','wb') as so,open(out/'console.stderr','wb') as se:
    p=subprocess.Popen([str(TMP/'host'),str(TMP/'kernel.bin')],stdin=subprocess.PIPE,stdout=so,stderr=se,start_new_session=True)
    try:
        p.stdin.write(b'ping\n');p.stdin.flush()
        deadline=time.monotonic()+10
        while time.monotonic()<deadline:
            data=(out/'console.stdout').read_bytes();assert len(data)<8*1024*1024
            for line in data.split(b'\n')[:-1]:
                if b'\x1e' in line:
                    rec=json.loads(line.split(b'\x1e',1)[1])
                    if rec['kind']=='missing': miss=rec;break
            if miss or p.poll() is not None: break
            time.sleep(.005)
        assert miss and miss['nr']==73,miss
    finally:
        if p.poll() is None: os.killpg(p.pid,signal.SIGKILL)
        p.wait();p.stdin.close()
(out/'missing.json').write_text(json.dumps(miss,indent=2)+'\n')
(out/'report.json').write_text(json.dumps({'script':script,'result':'observed real qjs nr73 missing; discovery VM stopped at first miss',
    'build_seconds':build,'discover_and_reap_seconds':time.perf_counter()-start,'returncode':p.returncode,
    'kernel_sha256':sha(out/'missing.bin'),'uptime_before':stamp,'uptime_after':load()},indent=2)+'\n')
print((out/'report.json').read_text())
