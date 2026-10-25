#!/usr/bin/env python3
"""Real-VM discovery → Linux oracle → one-handler patch → differential → manifest.

Default: replay recorded proposals from canonical kernel. --live calls the real
read-only headless CLI. Every accepted transaction runs in a fresh temp Git repo.
"""
import argparse, difflib, json, os, pathlib, re, shutil, signal, subprocess, time
from runtime import *
from adapters import guest, linux, compare
from agent import proposal, validate_proposal
from prepare import prepare

LUA_ARGV=['lua','-e',(ROOT/'fixtures.lua').read_text()]
QJS_ARGV=['qjs','--std','-e','os.setReadHandler(0,()=>{const s=std.in.getline();os.setReadHandler(0,null);print("reply:"+s)})']
LUA_OUTPUT=b'{"count":5,"sum":23,"max":9}\n'
SLOTS={73:'ppoll',134:'rt_sigaction',135:'rt_sigprocmask'}

class Receipt:
    def __init__(self,path): self.path=path; path.mkdir(parents=True,exist_ok=False); self.stages={}; self.start=time.perf_counter()
    def stage(self,label,fn):
        before=load(); t=time.perf_counter()
        try: return fn()
        finally:
            self.stages[label]={'seconds':time.perf_counter()-t,'uptime_before':before,'uptime_after':load()}
            dump(self.path/'stages.json',self.stages)
            print(label,round(self.stages[label]['seconds'],3),'s',flush=True)

def oracle(elf,argv,out,expected,samples=1,injections=(),data=b'ping\n'):
    out.mkdir(parents=True,exist_ok=True)
    dump(out/'oracle-config.json',{'argv':argv,'expected_hex':expected.hex(),'stdin_hex':data.hex(),
                                 'samples':samples,'injections':list(injections)})
    info=run(['docker','image','inspect','jitk-oracle:08','--format','{{json .}}'])
    (out/'oracle-image.json').write_bytes(info.stdout)
    container='jitk-08-'+str(os.getpid())+'-'+str(time.time_ns())
    command=['docker','run','--rm','-i','--name',container,'--platform','linux/arm64','--network','none','--read-only',
      '--cap-drop','ALL','--security-opt','no-new-privileges','--pids-limit','16','--memory','512m','--cpus','1',
      '--user','65534:65534','--tmpfs','/tmp:rw,noexec,nosuid,size=16m',
      '-v',f'{elf}:/payload:ro','-v',f'{ROOT}/oracle:/oracle:ro','-v',f'{out}:/out:rw',
      '--entrypoint','python3','jitk-oracle:08','-B','/oracle/run_profile.py']
    try:
        p=run(command,timeout=90); (out/'driver.stdout').write_bytes(p.stdout); (out/'driver.stderr').write_bytes(p.stderr)
    finally: subprocess.run(['docker','rm','-f',container],capture_output=True,timeout=10,env=SAFE_ENV)
    return json.loads((out/'linux-summary.json').read_text())

def probe(name,out):
    obj=out/(name+'.o');elf=out/(name+'.elf')
    run(['clang','--target=aarch64-none-elf','-c',probe_source(name),'-o',obj])
    run(['/opt/homebrew/bin/ld.lld','-T',ROOT/'probe.ld',obj,'-o',elf]); return elf

def discover(image,dest):
    # Stop/reap as soon as a COMPLETE missing record is visible; qjs can retry ENOSYS.
    started=time.perf_counter(); before=load(); found=None
    with open(str(dest)+'.stdout','wb') as so:
        p=subprocess.Popen([str(x) for x in host_command(image)],stdin=subprocess.PIPE,stdout=so,stderr=subprocess.PIPE,
                           start_new_session=True,env=SAFE_ENV)
        try:
            p.stdin.write(b'ping\n');p.stdin.flush()
            while time.perf_counter()-started<10:
                raw=pathlib.Path(str(dest)+'.stdout').read_bytes()
                for line in raw.split(b'\n')[:-1]:
                    if b'\x1e' in line:
                        r=json.loads(line.split(b'\x1e',1)[1])
                        if r.get('kind')=='missing': found=r;break
                if found or p.poll() is not None: break
                time.sleep(.001)
            if p.poll() is None: kill_reap(p)
            p.wait(timeout=3)
        finally:
            if p.poll() is None: kill_reap(p)
            p.stdin.close()
            err=p.stderr.read();p.stderr.close()
            pathlib.Path(str(dest)+'.stderr').write_bytes(err)
    dump(str(dest)+'.json',{'seconds':time.perf_counter()-started,'uptime_before':before,'uptime_after':load(),
                          'missing':found,'returncode':p.returncode,'discovery_kill_expected':True})
    assert err==b'{"sandbox":"ok"}\n', ('host-only sandbox ack required',err)
    assert found, f'no missing record in {dest}'
    dump(str(dest)+'.missing.json',found);return found

def validate_source(name,source):
    assert len(source)<12000 and re.fullmatch('[a-z_]+',name)
    assert not any(x in source for x in ('unsafe','include!','include_str!','include_bytes!','extern ','std::','asm!','#[path','mod '))
    assert 'pub fn call(' in source

def transaction(name,work,out,manifest,elf,argv,expected,samples,discovery,live=False):
    r=Receipt(out);nr=next(k for k,v in SLOTS.items() if v==name)
    dump(out/'missing.json',discovery)
    assert discovery['nr']==nr
    fixture=r.stage('assemble_probe',lambda:probe(name,out))
    injections=[] if nr==73 else [name+':error=ENOSYS']
    r.stage('linux_oracle',lambda:oracle(fixture,[name],out/'oracle',expected,1,injections))
    native=linux((out/'oracle/linux-00.strace').read_text(),expected,b'',0)
    dump(out/'linux.canonical.json',native)
    value=r.stage('headless_cli' if live else 'recorded_proposal',
                  lambda:proposal(name,work,out,discovery,live))
    source=validate_proposal(name,value);validate_source(name,source)
    handler=work/'src/syscalls'/f'{name}.rs';assert not handler.exists() and not handler.is_symlink()
    dump(out/'proposal.json',dict(value,mode='live' if live else 'replay'))
    handler.write_text(source)
    status=run(['git','status','--porcelain','--untracked-files=all'],cwd=work).stdout.decode().splitlines()
    assert status==[f'?? src/syscalls/{name}.rs'],status
    image=r.stage('build_candidate',lambda:build(work,out/'build',fixture,[name]))
    def gate():
        values=[]
        for i in range(samples):
            info,raw,err=process(host_command(image),out/f'vm-{i:02}')
            check_host(info,err)
            canonical=guest(raw);compare(native,canonical);values.append(info['seconds']*1000)
            if i==0: dump(out/'guest.canonical.json',canonical)
        return distribution(values)
    bench=r.stage('fresh_vm_differential_n30',gate)
    previous=json.loads(json.dumps(manifest)); manifest['version']+=1
    manifest['contracts'].append({'nr':nr,'name':name,'source_sha256':sha(handler),
      'status':'restricted' if nr==73 else 'profile-enosys',
      'domain':'bounded ppoll G4 fixture; WFI waits' if nr==73 else 'always -38; no signals installed or delivered; no user-memory access',
      'oracle':'native Linux' if nr==73 else 'native Linux strace inject='+name+':error=ENOSYS',
      'full_linux_abi_equivalence':False,'gate':{'n':samples,'pass':samples,'complete_probe_trace':True},
      'evidence_sha256':sha(out/'guest.canonical.json')})
    manifest['kernel_delta_lines']=sum(len(p.read_text().splitlines()) for p in (work/'src/syscalls').glob('rt_sig*.rs'))
    assert manifest['kernel_delta_lines']<=350,'Lua kill line exceeded'
    dump(out/'manifest.before.json',previous);dump(out/'manifest.after.json',manifest)
    dump(work/'syscalls.manifest.json',manifest)
    (out/'manifest.diff').write_text(''.join(difflib.unified_diff((out/'manifest.before.json').read_text().splitlines(True),
      (out/'manifest.after.json').read_text().splitlines(True),fromfile='a/syscalls.manifest.json',tofile='b/syscalls.manifest.json')))
    dump(work/'grow-acceptance.json',{'name':name,'oracle_sha256':sha(out/'linux.canonical.json'),
      'guest_sha256':sha(out/'guest.canonical.json'),'benchmark':bench,'stages':r.stages})
    run(['git','add',f'src/syscalls/{name}.rs','syscalls.manifest.json','grow-acceptance.json'],cwd=work)
    run(['git','commit','-qm','grow '+name+' after real-VM differential gate'],cwd=work)
    (out/'kernel.patch').write_bytes(run(['git','show','--format=','HEAD','--',f'src/syscalls/{name}.rs'],cwd=work).stdout)
    report={'name':name,'mode':'live' if live else 'replay','gate':'PASS','manifest_version_before':previous['version'],'manifest_version_after':manifest['version'],
      'seconds':time.perf_counter()-r.start,'stages':r.stages,'benchmark':bench,
      'commit':run(['git','rev-parse','HEAD'],cwd=work).stdout.decode().strip()}
    dump(out/'report.json',report);return report

def installation_patch(base, updated, names):
    patch=''
    for name in names:
        old=base/name;new=updated/name
        before=old.read_text() if old.is_file() else ''
        after=new.read_text()
        if before==after: continue
        patch+=f'diff --git a/{name} b/{name}\n'
        if not old.is_file(): patch+='new file mode 100644\n'
        patch+=''.join(difflib.unified_diff(before.splitlines(True),after.splitlines(True),
          fromfile='a/'+name if old.is_file() else '/dev/null',tofile='b/'+name))
    return patch

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--run-id',required=True);ap.add_argument('--samples',type=int,default=30)
    ap.add_argument('--validate-only',action='store_true');ap.add_argument('--live',action='store_true')
    a=ap.parse_args();assert a.samples>=30 and re.fullmatch(r'[a-zA-Z0-9_-]+',a.run_id)
    print('GROW MODE: '+('LIVE headless agent CLI' if a.live else 'REPLAY recorded proposals adopted in canonical kernel'),flush=True)
    with scratch() as temporary:
        execute(a,pathlib.Path(temporary))

def execute(a,temporary):
    r=Receipt(ROOT/'results'/a.run_id);out=r.path;work=temporary/'kernel'
    src,hashes=r.stage('copy_kernel',lambda:copy_kernel(work))
    select_host();select_gate();host_hash=sha(host())
    dump(out/'source.json',{'path':str(src),'canonical':src==CANONICAL,'files':hashes})
    # A later replay can deliberately remove profiles already applied by the owner.
    for name in ('rt_sigaction','rt_sigprocmask'):
        (work/'src/syscalls'/f'{name}.rs').unlink(missing_ok=True)
    ppoll=work/'src/syscalls/ppoll.rs'
    ppoll.unlink()
    manifest={'schema':3,'version':0,'scope':'R3 verified contracts; inherited ABI unverified','contracts':[]}
    dump(work/'syscalls.manifest.json',manifest)
    run(['git','init','-q'],cwd=work);run(['git','config','user.name','jitk grow'],cwd=work)
    run(['git','config','user.email','jitk@example.invalid'],cwd=work)
    run(['git','add','.'],cwd=work);run(['git','commit','-qm','isolated canonical seed, ppoll deliberately removed'],cwd=work)
    seed=run(['git','rev-parse','HEAD'],cwd=work).stdout.decode().strip()
    qjs,lua=prepare()
    transactions=[]
    image=r.stage('qjs_build_missing',lambda:build(work,out/'qjs-missing',qjs,QJS_ARGV))
    missing=r.stage('qjs_discovery',lambda:discover(image,out/'qjs-before'))
    transactions.append(transaction('ppoll',work,out/'tx-ppoll',manifest,qjs,QJS_ARGV,b'ping\n ppoll OK\n',a.samples,missing,a.live))
    image=r.stage('qjs_build_after',lambda:build(work,out/'qjs-after',qjs,QJS_ARGV))
    r.stage('qjs_linux',lambda:oracle(qjs,QJS_ARGV,out/'qjs-linux',b'reply:ping\n'))
    info,rec,app=r.stage('qjs_live',lambda:boot(image,out/'qjs-after-run'))
    assert app==b'reply:ping\n' and not any(x.get('kind')=='missing' for x in rec),(app,rec)
    # Plain Linux is the output reference; injected Linux justifies the narrower signal profile.
    r.stage('lua_linux_normal_n30',lambda:oracle(lua,LUA_ARGV,out/'lua-linux-normal',LUA_OUTPUT,a.samples,data=b''))
    r.stage('lua_linux_profile_n30',lambda:oracle(lua,LUA_ARGV,out/'lua-linux-profile',LUA_OUTPUT,a.samples,
             ['rt_sigaction:error=ENOSYS','rt_sigprocmask:error=ENOSYS'],data=b''))
    for index in range(2):
        image=r.stage('lua_build_missing_'+str(index),lambda:build(work,out/f'lua-before-{index}',lua,LUA_ARGV))
        miss=r.stage('lua_discovery_'+str(index),lambda:discover(image,out/f'lua-before-{index}-run'))
        name=SLOTS[miss['nr']];assert name in ('rt_sigaction','rt_sigprocmask')
        transactions.append(transaction(name,work,out/('tx-'+name),manifest,lua,LUA_ARGV,b'signals:ok\n',a.samples,miss,a.live))
    image=r.stage('lua_build_after',lambda:build(work,out/'lua-after',lua,LUA_ARGV))
    def lua_gate():
        values=[]
        for i in range(a.samples):
            info,rec,app=boot(image,out/f'lua-vm-{i:02}',data=b'')
            assert app==LUA_OUTPUT and not any(x.get('kind')=='missing' for x in rec),(app,rec)
            values.append(info['seconds']*1000)
        return distribution(values)
    bench=r.stage('lua_vm_n30',lua_gate)
    # Only Lua handler additions are owner-applicable; ppoll is regrowth of a deleted seed file.
    (out/'lua-kernel.patch').write_text(installation_patch(src,work,
        ['src/syscalls/rt_sigaction.rs','src/syscalls/rt_sigprocmask.rs']))
    shutil.copyfile(work/'syscalls.manifest.json',out/'syscalls.manifest.json')
    (out/'manifest.diff').write_bytes(run(['git','diff',seed,'HEAD','--','syscalls.manifest.json'],cwd=work).stdout)
    # Install only differences from the actual canonical input, allowing no-op replays.
    manifest_patch=installation_patch(src,work,['syscalls.manifest.json'])
    (out/'manifest.install.patch').write_text(manifest_patch)
    (out/'owner.patch').write_bytes((out/'lua-kernel.patch').read_bytes()+manifest_patch.encode())
    verify=work.parent/'apply-check'
    shutil.copytree(src,verify,ignore=shutil.ignore_patterns(*IGNORED))
    if (out/'owner.patch').stat().st_size:
        run(['git','apply','--check',out/'owner.patch'],cwd=verify)
        run(['git','apply',out/'owner.patch'],cwd=verify)
    assert all(sha(verify/'src/syscalls'/f'{name}.rs')==sha(work/'src/syscalls'/f'{name}.rs')
               for name in ('rt_sigaction','rt_sigprocmask'))
    run(['git','bundle','create',out/'accepted.bundle','HEAD'],cwd=work)
    assert tree_hashes(src)==hashes,'canonical source changed during transaction; inspect source snapshot before claiming stability'
    assert sha(host())==host_hash, 'VMM changed during verification'
    report={'gate':'PASS','mode':'live' if a.live else 'replay','kernel_baseline_sha256':sha(src/json.loads((src/'.READY').read_text())['image']),'owner_patch_apply_check':'PASS in separate clean source copy','canonical':src==CANONICAL,'source':str(src),'repository':str(work),'transactions':transactions,
      'kernel_delta_lines':manifest['kernel_delta_lines'],'manifest_version':manifest['version'],
      'seconds':time.perf_counter()-r.start,'stages':r.stages,'lua_vm':bench,'uptime':load(),
      'controller_sha256':{p.name:sha(p) for p in (ROOT/'loop.py',ROOT/'runtime.py',ROOT/'adapters.py')},
      'qjs_image_sha256':sha(out/'qjs-after/kernel.bin'),'lua_image_sha256':sha(image),'lua_elf_sha256':sha(lua),'qjs_elf_sha256':sha(qjs),'host':str(host()),'host_sha256':sha(host())}
    dump(out/'report.json',report)
    if not a.validate_only:
        shutil.copyfile(out/'syscalls.manifest.json',ROOT/'syscalls.manifest.json')
        dump(ROOT/'release.json',{'run':a.run_id,'report':str((out/'report.json').relative_to(ROOT))})
        if src==CANONICAL: dump(ROOT/'.READY',{'run':a.run_id,'canonical_source_files':hashes,'report':str((out/'report.json').relative_to(ROOT))})
    print(json.dumps(report,indent=2))
if __name__=='__main__': main()
