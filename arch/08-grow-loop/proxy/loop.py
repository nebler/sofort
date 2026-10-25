#!/usr/bin/env python3
"""Measured pre-VM growth loop: pure Rust stub -> ptrace injection -> qjs."""
import hashlib, json, os, pathlib, shutil, subprocess, sys, time
from compare import compare
root=pathlib.Path(__file__).resolve().parents[1]
work=pathlib.Path(os.getenv('JITK_PROXY_RUN_DIR','/tmp/jitk-08/loop'))
assert work.resolve().is_relative_to(pathlib.Path('/tmp/jitk-08').resolve())
if work.exists(): raise SystemExit('refuse to overwrite existing loop repo')
shutil.copytree(root/'proxy',work,ignore=shutil.ignore_patterns('__pycache__'))
(work/'.gitignore').write_text('/dispatcher\n/unit-tests\n__pycache__/\n')
(work/'syscalls.manifest.json').write_text(json.dumps({'surface_version':'0.0.0-demo','status':'proxy-only','syscalls':[]},indent=2)+'\n')
results=root/'results/proxy';results.mkdir(exist_ok=True)

def run(args, **kw):
    kw.setdefault('timeout',60)
    return subprocess.run(args,cwd=work,check=True,**kw)
def oracle(name,errno=None):
    env=dict(os.environ,INJECT_ERRNO=errno or '')
    run([str(root/'oracle/run.sh'),'/tmp/jitk-08/qjs-static',str(root/'workloads'),
         str(results/name),str(root/'workloads/empty.stdin'),'hello.js'],env=env)
def compile_driver():
    run(['rustc','--edition=2021','driver.rs','-o','dispatcher'])
    return int(subprocess.check_output([str(work/'dispatcher'),'1','21523','0'],text=True,timeout=5))
start=time.monotonic()
run(['git','init','-q']);run(['git','config','user.name','jitk experiment'])
run(['git','config','user.email','jitk@example.invalid'])
run(['git','add','.']);run(['git','commit','-qm','seed ENOSYS proxy'])
oracle('oracle')
initial=compile_driver(); assert initial==-38
oracle('before','ENOSYS')
try: compare(results/'oracle',results/'before')
except AssertionError as e: before=str(e)
else: raise AssertionError('broken proxy incorrectly accepted')
events=[json.loads(x) for x in (results/'before/trace.jsonl').read_text().splitlines()]
miss=next(e for e in events if e['errno']=='ENOSYS')
assert miss['name']=='ioctl' and miss['args'][:2]==['1','0x5413'],miss
(results/'missing.json').write_text(json.dumps(dict(type='missing',**miss),indent=2)+'\n')
source=work/'kernel/src/syscalls/ioctl.rs'
linux=[json.loads(x) for x in (results/'oracle/trace.jsonl').read_text().splitlines()]
observed=[e for e in linux if e['name']=='ioctl']
assert len(observed)==1 and observed[0]['args'][:2]==['1','0x5413']
prompt='''Implement ONLY kernel/src/syscalls/ioctl.rs; return JSON per schema with full replacement source.
This is a pure Rust userspace stand-in for a no_std kernel syscall, not a real VM.
No tools or filesystem access needed. API: pub fn ioctl(fd:i64,request:u64,arg:u64)->i64.
Specification: only valid virtual descriptors 0,1,2 exist. Other fd => -EBADF (-9).
For valid fd + TIOCGWINSZ (0x5413): -ENOTTY (-25), no access to arg.
Other requests => -ENOSYS (-38). Do not introduce unsafe, dependencies, imports, or change the API.
Implement the errno stub, do not return fake success. No explanation; JSON only.
Current kernel source:\n'''+source.read_text()+'\nMissing syscall:\n'+json.dumps(miss)+'\nLinux oracle trace:\n'+json.dumps(observed)
(results/'agent-prompt.txt').write_text(prompt)
env=dict(os.environ,CODEX_HOME='/tmp/jitk-08/codex-home',TMPDIR='/tmp/jitk-08')
agent=['codex','exec','--ephemeral','--ignore-user-config','--skip-git-repo-check',
       '--sandbox','read-only','--output-schema',str(work/'agent.schema.json'),
       '--output-last-message',str(results/'agent.json'),'-']
with open(results/'agent.log','w') as log:
    run(agent,input=prompt,text=True,env=env,stdout=log,stderr=subprocess.STDOUT,timeout=120)
patch=json.loads((results/'agent.json').read_text())
assert patch['path']=='kernel/src/syscalls/ioctl.rs'
assert len(patch['source'])<4096 and not any(x in patch['source'] for x in ['unsafe','include!','extern ','std::'])
# Agent cannot write directly; controller materializes exactly the allowed regular file.
assert not source.is_symlink();source.write_text(patch['source'])
delta=run(['git','diff','--name-only'],capture_output=True,text=True).stdout.splitlines()
assert delta==['kernel/src/syscalls/ioctl.rs'],delta
status=run(['git','status','--porcelain','--untracked-files=all'],capture_output=True,text=True).stdout.splitlines()
assert status==[' M kernel/src/syscalls/ioctl.rs'],status
value=compile_driver();assert value==-25
run(['rustc','--edition=2021','--test','driver.rs','-o','unit-tests'])
unit=run([str(work/'unit-tests')],capture_output=True,text=True).stdout
(results/'tests.txt').write_text(unit)
oracle('after','ENOTTY');compare(results/'oracle',results/'after')
# Test a wrong implementation too: matching application output must not pass.
assert (results/'before/stdout.bin').read_bytes()==(results/'oracle/stdout.bin').read_bytes()
receipt={'strict_trace_sha256':hashlib.sha256((results/'after/trace.jsonl').read_bytes()).hexdigest(),
         'unit_tests':4,'scalar_fuzz_cases':10000,'scope':'host stub + ptrace injection, not VM'}
manifest={'surface_version':'0.1.0-demo','status':'proxy-only','syscalls':[{'nr':29,'name':'ioctl',
          'domain':'fds 0..2 + request 0x5413 => ENOTTY; bad fd => EBADF; other request => ENOSYS',
          'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest()}],'receipt':receipt}
(work/'syscalls.manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
(results/'accepted.manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
run(['git','add','kernel/src/syscalls/ioctl.rs','syscalls.manifest.json'])
run(['git','commit','-qm','grow ioctl TIOCGWINSZ errno stub after differential gate'])
sha=run(['git','rev-parse','HEAD'],capture_output=True,text=True).stdout.strip()
(results/'accepted.rs').write_text(source.read_text())
(results/'patch.diff').write_text(run(['git','show','--format=fuller','HEAD'],capture_output=True,text=True).stdout)
report={'proxy':'strace ptrace fault injection; pure Rust errno stub compiled on host',
        'before':before,'stdout_alone_would_pass':True,'after':'exact trace/stdout/stderr/exit match',
        'unit_tests':4,'scalar_fuzz_cases':10000,'commit':sha,'seconds':round(time.monotonic()-start,3)}
(results/'report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
