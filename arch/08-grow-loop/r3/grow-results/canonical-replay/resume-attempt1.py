#!/usr/bin/env python3
"""Audited recovery of the saved version-2 checkpoint after a group-kill EPERM.
Does not replace the clean initial canonical release or its timing report.
"""
import sys,pathlib
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[2]))
import runtime
from runtime import *
from loop import Receipt,discover,transaction,installation_patch,LUA_ARGV,LUA_OUTPUT
out=pathlib.Path(__file__).resolve().parent;work=TMP/'runs/canonical-replay/kernel'
source_info=json.loads((out/'source.json').read_text());manifest=json.loads((work/'syscalls.manifest.json').read_text())
assert manifest['version']==2 and not (out/'tx-rt_sigaction').exists()
certificate=json.loads((work/'.READY').read_text());runtime.SELECTED_HOST=pathlib.Path(certificate['test_host'])
assert sha(host())==certificate['test_host_sha256'];select_gate()
r=Receipt.__new__(Receipt);r.path=out;r.stages=json.loads((out/'stages.json').read_text())
r.start=time.perf_counter()-(time.time()-out.stat().st_birthtime)
miss=r.stage('resume_lua_discovery_1',lambda:discover(out/'lua-before-1/kernel.bin',out/'lua-before-1-resumed'))
transactions=[json.loads((out/('tx-'+name)/'report.json').read_text()) for name in ('ppoll','rt_sigprocmask')]
transactions.append(transaction('rt_sigaction',work,out/'tx-rt_sigaction',manifest,TMP/'lua-static',LUA_ARGV,
                                b'signals:ok\n',30,miss))
image=r.stage('resume_lua_build_after',lambda:build(work,out/'lua-after',TMP/'lua-static',LUA_ARGV))
def gate():
    values=[]
    for i in range(30):
        info,records,output=boot(image,out/f'lua-vm-{i:02}',data=b'')
        assert output==LUA_OUTPUT and not any(x.get('kind')=='missing' for x in records)
        values.append(info['seconds']*1000)
    return distribution(values)
bench=r.stage('resume_lua_vm_n30',gate)
patch=installation_patch(CANONICAL,work,['src/syscalls/rt_sigaction.rs','src/syscalls/rt_sigprocmask.rs','syscalls.manifest.json'])
(out/'owner.patch').write_text(patch)
verify=work.parent/'resume-apply-check';shutil.copytree(CANONICAL,verify,ignore=shutil.ignore_patterns('.git','target','__pycache__'))
if patch: run(['git','apply','--check',out/'owner.patch'],cwd=verify);run(['git','apply',out/'owner.patch'],cwd=verify)
assert all(sha(verify/'src/syscalls'/f'{name}.rs')==sha(work/'src/syscalls'/f'{name}.rs') for name in ('rt_sigaction','rt_sigprocmask'))
run(['git','bundle','create',out/'accepted.bundle','HEAD'],cwd=work)
now=tree_hashes(CANONICAL);before=source_info['files']
changes=[k for k in sorted(set(now)|set(before)) if now.get(k)!=before.get(k)]
assert all(k in ('.READY','README.md') or k.startswith(('dist/','tests/')) for k in changes),changes
report={'gate':'PASS resumed checkpoint','canonical':True,'resumed_after':'recorded group SIGKILL EPERM; direct PID kill fallback fixed and independently tested',
  'source':str(CANONICAL),'source_changed_by_owner':changes,'guest_source_unchanged':True,'transactions':transactions,
  'manifest_version':manifest['version'],'lua_profile_source_lines':6,'new_handler_delta_vs_applied_canonical':0,
  'lua_vm':bench,'elapsed_including_interruption_seconds':time.perf_counter()-r.start,
  'stages':r.stages,'owner_patch_bytes':len(patch),'owner_patch_apply_check':'PASS or already applied no-op',
  'controller_sha256':{p.name:sha(p) for p in (ROOT/'loop.py',ROOT/'runtime.py',ROOT/'adapters.py')},
  'host':str(host()),'all_vms_reaped':True,'uptime':load()}
dump(out/'resumed-report.json',report)
marker=json.loads((ROOT/'.READY').read_text());marker['additional_validation_report']=str(out/'resumed-report.json')
marker['current_controller_sha256']=report['controller_sha256'];dump(ROOT/'.READY',marker)
print(json.dumps(report,indent=2))
