#!/usr/bin/env python3
"""Real-VM discovery → Linux oracle → one-handler patch → differential → manifest.

Default: replay recorded proposals from canonical kernel. --live calls the real
read-only headless CLI. Every accepted transaction runs in a fresh temp Git repo.
"""
import argparse, difflib, json, os, pathlib, re, shutil, signal, subprocess, time
from runtime import *
from adapters import guest, linux, compare
from agent import proposal, validate_proposal

LUA_ARGV=['lua','-e',(ROOT/'fixtures.lua').read_text()]
QJS_ARGV=['qjs','--std','-e','os.setReadHandler(0,()=>{const s=std.in.getline();os.setReadHandler(0,null);print("reply:"+s)})']
LUA_OUTPUT=b'{"count":5,"sum":23,"max":9}\n'
SLOTS={int(n):name for n,name in json.loads((CANONICAL/'slots.json').read_text()).items()}

class Receipt:
    def __init__(self,path): self.path=path; path.mkdir(parents=True,exist_ok=False); self.stages={}; self.start=time.perf_counter()
    def stage(self,label,fn):
        before=load(); t=time.perf_counter()
        try: return fn()
        finally:
            self.stages[label]={'seconds':time.perf_counter()-t,'uptime_before':before,'uptime_after':load()}
            dump(self.path/'stages.json',self.stages)
            print(label,round(self.stages[label]['seconds'],3),'s',flush=True)

def oracle(elf,argv,out,expected,samples=1,injections=(),data=b'ping\n',resources=None):
    out.mkdir(parents=True,exist_ok=True)
    dump(out/'oracle-config.json',{'argv':argv,'expected_hex':expected.hex() if expected is not None else None,'stdin_hex':data.hex(),
                                 'samples':samples,'injections':list(injections)})
    info=run(['docker','image','inspect','jitk-oracle:08','--format','{{json .}}'])
    (out/'oracle-image.json').write_bytes(info.stdout)
    container='jitk-08-'+str(os.getpid())+'-'+str(time.time_ns())
    command=['docker','run','--rm','-i','--name',container,'--platform','linux/arm64','--network','none','--read-only',
      '--cap-drop','ALL','--security-opt','no-new-privileges','--pids-limit','16','--memory','512m','--cpus','1',
      '--user','65534:65534','--tmpfs','/tmp:rw,noexec,nosuid,size=16m',
      '-v',f'{elf}:/payload:ro','-v',f'{ROOT}/oracle:/oracle:ro','-v',f'{out}:/out:rw',
      '--entrypoint','python3','jitk-oracle:08','-B','/oracle/run_profile.py']
    if resources:
        for child in sorted(resources.iterdir()): command[command.index('--entrypoint'):command.index('--entrypoint')]=['-v',f'{child.resolve()}:/{child.name}:ro']
    try:
        p=run(command,timeout=90); (out/'driver.stdout').write_bytes(p.stdout); (out/'driver.stderr').write_bytes(p.stderr)
    finally: subprocess.run(['docker','rm','-f',container],capture_output=True,timeout=10,env=SAFE_ENV)
    return json.loads((out/'linux-summary.json').read_text())

def probe(name,out):
    obj=out/(name+'.o');elf=out/(name+'.elf')
    options=['-ffreestanding','-fno-builtin','-fno-stack-protector','-O1','-DTARGET='+str(next(n for n,v in SLOTS.items() if v==name))] if name in ('fstat','pread64') else []
    run(['clang','--target=aarch64-none-elf',*options,'-c',probe_source(name),'-o',obj])
    run(['/opt/homebrew/bin/ld.lld','-T',ROOT/'probe.ld',obj,'-o',elf]); return elf

def discover(image,dest):
    from observations import observe
    # Stop/reap as soon as a COMPLETE missing record is visible; qjs can retry ENOSYS.
    started=time.perf_counter(); before=load(); found=None
    with open(str(dest)+'.stdout','wb') as so:
        p=subprocess.Popen([str(x) for x in host_command(image)],stdin=subprocess.PIPE,stdout=so,stderr=subprocess.PIPE,
                           start_new_session=True,env=SAFE_ENV)
        try:
            p.stdin.write(b'ping\n');p.stdin.flush()
            while time.perf_counter()-started<10:
                raw=pathlib.Path(str(dest)+'.stdout').read_bytes()
                complete=raw[:raw.rfind(b'\n')+1]
                observed=observe(complete)
                if observed['missing']: found=observed['missing'][0]
                if found or observed['fatal_protocol'] or p.poll() is not None: break
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
    dump(str(dest)+'.observations.json',observe(pathlib.Path(str(dest)+'.stdout').read_bytes()))
    assert err==b'{"sandbox":"ok"}\n', ('host-only sandbox ack required',err)
    assert found, f'no missing record in {dest}'
    dump(str(dest)+'.missing.json',found);return found

def validate_source(name,source):
    assert len(source)<12000 and re.fullmatch('[a-z_][a-z_0-9]*',name)
    assert not any(x in source for x in ('unsafe','include!','include_str!','include_bytes!','extern ','std::','asm!','#[path','mod '))
    assert 'pub fn call(' in source

def transaction(name,work,out,manifest,samples,discovery,live=False,sqlite_elf=None,database=None):
    from observations import observe, require_result
    from profiles import PROFILES, mutations, resources
    from sqlite_profile import integration
    profile=PROFILES[name]; nr=profile['nr']; r=Receipt(out)
    assert all(profile['cases'].get(k) for k in ('semantic','error','state'))
    dump(out/'request.json',discovery)
    fixture=r.stage('assemble_probe',lambda:probe(name,out))
    tree=resources(out) if name in ('fstat','pread64') else None
    injections=[name+':error=ENOSYS'] if name.startswith('rt_sig') else []
    refs=r.stage('linux_oracle',lambda:oracle(fixture,[name],out/'oracle',profile['expected'],
                                             injections=injections,resources=tree))
    reference=refs[0]
    # The original narrow ABI adapter still checks complete traces for G4.
    native=None if tree else linux((out/'oracle/linux-00.strace').read_text(),
                                  bytes.fromhex(reference['stdout_hex']),b'',0)
    value=r.stage('headless_cli' if live else 'recorded_proposal',
                  lambda:proposal(name,work,out,discovery,live))
    source=validate_proposal(name,value);validate_source(name,source)
    handler=work/'src/syscalls'/f'{name}.rs';assert not handler.exists() and not handler.is_symlink()
    handler.write_text(source)
    assert sum(len(p.read_text().splitlines()) for p in (work/'src/syscalls').glob('rt_sig*.rs'))<=350
    dump(out/'proposal.json',dict(value,mode='live' if live else 'replay'))
    if tree:
        checks=r.stage('independent_full_stat_and_state',lambda:run(['python3',work/'tests/test_fs.py']))
        (out/'host-handler-tests.log').write_bytes(checks.stdout+checks.stderr)
    image=r.stage('build_candidate',lambda:build(work,out/'build',fixture,[name],tree))
    def verify(image,dest):
        info,raw,err=process(host_command(image),dest)
        observed=observe(raw);dump(str(dest)+'.observations.json',observed)
        check_host(info,err)
        require_result(observed,reference)
        if native is not None: compare(native,guest(raw))
        return info
    # Every case is independent of candidate generation, fixed before proposals.
    times=[]
    for i in range(samples):
        info=r.stage('semantic_error_state_'+str(i),lambda i=i:verify(image,out/f'vm-{i:02}'))
        times.append(info['seconds']*1000)
    rejected=[]
    for label,broken in mutations(name,source).items():
        assert broken!=source, 'mutation must alter source'
        try:
            handler.write_text(broken)
            # Compilation failure never counts as mutation rejection.
            mutant=r.stage('build_mutant_'+label,lambda:build(work,out/('mutant-'+label),fixture,[name],tree))
            try: verify(mutant,out/('mutation-'+label))
            except AssertionError as e:
                observed=json.loads((out/('mutation-'+label+'.observations.json')).read_text())
                assert observed['trace_complete'], 'crash/protocol failure is not semantic mutation evidence'
                rejected.append({'name':label,'rejected':True,'reason':str(e),'source_sha256':sha(handler)})
            else: raise AssertionError('mutation survived: '+label)
        finally: handler.write_text(source)
    assert len(rejected)>=2
    dump(out/'mutations.json',rejected)
    if name in ('fstat','pread64'):
        assert sqlite_elf and database, 'SQLite integration inputs are required'
        app=r.stage('unchanged_sqlite',lambda:integration(work,out/'integration',sqlite_elf,database,oracle))
    else:
        elf=CANONICAL/'payload/qjs' if name=='ppoll' else ROOT/'payload/lua-static'
        argv=QJS_ARGV if name=='ppoll' else LUA_ARGV
        expected=b'reply:ping\n' if name=='ppoll' else LUA_OUTPUT
        r.stage('integration_linux',lambda:oracle(elf,argv,out/'integration-linux',expected,data=b'ping\n' if name=='ppoll' else b''))
        appimage=r.stage('integration_build',lambda:build(work,out/'integration',elf,argv))
        info,raw,err=process(host_command(appimage),out/'integration-run',data=b'ping\n' if name=='ppoll' else b'')
        check_host(info,err); observed=observe(raw);dump(out/'integration.observations.json',observed)
        require_result(observed,{'stdout_hex':expected.hex(),'stderr_hex':'','exit':0},
                       allowed_missing=(134,135) if name.startswith('rt_sig') else ())
        app={'status':'PASS','elf_sha256':sha(elf),'argv':argv}
    previous=json.loads(json.dumps(manifest));manifest['version']+=1
    manifest['contracts']=[c for c in manifest['contracts'] if c['name']!=name]
    evidence={'cases':profile['cases'],'mutations':rejected,'unchanged_integration':app['status'],
              'n':samples,'pass':samples,'repeat_counts_are_not_acceptance':True}
    manifest['contracts'].append({'nr':nr,'name':name,'source_sha256':sha(handler),
      'status':'profile-enosys' if injections else 'restricted',
      'oracle':'native Linux'+(' with explicit ENOSYS injection' if injections else ''),
      'full_linux_abi_equivalence':False,'gate':evidence})
    dump(out/'acceptance.json',evidence);dump(work/'syscalls.manifest.json',manifest)
    run(['git','add',f'src/syscalls/{name}.rs','syscalls.manifest.json'],cwd=work)
    run(['git','commit','-qm','grow '+name+' after semantic, mutation and integration gates'],cwd=work)
    report={'name':name,'mode':'live' if live else 'replay','gate':'PASS','acceptance':evidence,
            'seconds':time.perf_counter()-r.start,'stages':r.stages,'benchmark':distribution(times),
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
    from profiles import PROFILES
    ap=argparse.ArgumentParser()
    ap.add_argument('--run-id',required=True)
    ap.add_argument('--samples',type=int,default=30)
    ap.add_argument('--target',action='append',choices=sorted(PROFILES),
                    help='grow this named target, including an already registered handler; repeat for dependencies')
    ap.add_argument('--sqlite-elf',type=pathlib.Path)
    ap.add_argument('--database',type=pathlib.Path)
    ap.add_argument('--validate-only',action='store_true');ap.add_argument('--live',action='store_true')
    a=ap.parse_args();assert a.samples>=1 and re.fullmatch(r'[a-zA-Z0-9_-]+',a.run_id)
    if a.target and any(n in ('fstat','pread64') for n in a.target):
        ap.error('--sqlite-elf and --database are required for SQLite integration') if not (a.sqlite_elf and a.database) else None
    print('GROW MODE: '+('LIVE headless agent CLI' if a.live else 'REPLAY canonical handler source'),flush=True)
    with scratch() as temporary: execute(a,pathlib.Path(temporary))


def execute(a,temporary):
    from profiles import PROFILES
    from observations import observe
    r=Receipt(ROOT/'results'/a.run_id);out=r.path;work=temporary/'kernel'
    src,hashes=r.stage('copy_kernel',lambda:copy_kernel(work))
    select_host();select_gate();host_hash=sha(host())
    dump(out/'source.json',{'path':str(src),'files':hashes})
    targets=getattr(a,'target',None) or ['ppoll','rt_sigaction','rt_sigprocmask']
    assert len(targets)==len(set(targets)), 'duplicate target'
    manifest=json.loads((work/'syscalls.manifest.json').read_text())
    run(['git','init','-q'],cwd=work);run(['git','config','user.name','jitk grow'],cwd=work)
    run(['git','config','user.email','jitk@example.invalid'],cwd=work)
    run(['git','add','.'],cwd=work);run(['git','commit','-qm','isolated canonical source'],cwd=work)
    transactions=[]
    for name in targets:
        # Removal is local to this transaction, so integration sees all other
        # canonical handlers. Explicit targeting never depends on first miss.
        handler=work/'src/syscalls'/f'{name}.rs';handler.unlink(missing_ok=True)
        manifest['contracts']=[c for c in manifest['contracts'] if c['name']!=name]
        dump(work/'syscalls.manifest.json',manifest)
        run(['git','add','-u'],cwd=work)
        run(['git','commit','--allow-empty','-qm','isolated seed without '+name],cwd=work)
        if getattr(a,'target',None):
            request={'nr':PROFILES[name]['nr'],'name':name,'reason':'explicit target; registration is not acceptance'}
        else:
            elf=CANONICAL/'payload/qjs' if name=='ppoll' else ROOT/'payload/lua-static'
            argv=QJS_ARGV if name=='ppoll' else LUA_ARGV
            image=build(work,out/('before-'+name),elf,argv)
            request=discover(image,out/('before-'+name))
            assert request['nr']==PROFILES[name]['nr']
        transactions.append(transaction(name,work,out/('tx-'+name),manifest,a.samples,request,a.live,
                                        getattr(a,'sqlite_elf',None),getattr(a,'database',None)))
    names=[f'src/syscalls/{n}.rs' for n in targets]+['syscalls.manifest.json']
    (out/'owner.patch').write_text(installation_patch(src,work,names))
    shutil.copyfile(work/'syscalls.manifest.json',out/'syscalls.manifest.json')
    run(['git','bundle','create',out/'accepted.bundle','HEAD'],cwd=work)
    assert tree_hashes(src)==hashes, 'canonical source changed during verification'
    assert sha(host())==host_hash, 'VMM changed during verification'
    report={'gate':'PASS','mode':'live' if a.live else 'replay','targets':targets,
            'transactions':transactions,'seconds':time.perf_counter()-r.start,'uptime':load(),
            'host_sha256':host_hash,'canonical_unchanged':True,
            'controller_sha256':{p.name:sha(p) for p in (ROOT/'loop.py',ROOT/'profiles.py',ROOT/'observations.py')}}
    dump(out/'report.json',report)
    if not a.validate_only:
        dump(ROOT/'release.json',{'run':a.run_id,'report':str((out/'report.json').relative_to(ROOT))})
        dump(ROOT/'.READY',{'run':a.run_id,'canonical_source_files':hashes,'report':str((out/'report.json').relative_to(ROOT))})
    print(json.dumps(report,indent=2))

if __name__=='__main__': main()
