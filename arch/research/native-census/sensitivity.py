#!/usr/bin/env python3
import json,pathlib,re
import census
R=census.R;out=R/'raw/sensitivity';out.mkdir(exist_ok=True);rows=[]
cases={'jq':['mprotect','getrandom','set_robust_list','rseq','prlimit64'], 'jq-musl':['getrandom'], 'sqlite3':['fstat','pread64','faccessat','getpid','rt_sigaction','rt_sigprocmask'], 'rg':['rt_sigaction','sigaltstack','mprotect','fstat','getrandom','sched_getaffinity','uname','madvise'], 'sd':['rt_sigaction','sigaltstack','mprotect','getrandom'], 'xz':['pipe2','geteuid','prctl','landlock_create_ruleset','prlimit64','sysinfo','fstat','fadvise64'], 'bb-tar':['getuid'], 'qsv':['rt_sigaction','fstat','mkdirat']}
for name,syscalls in cases.items():
 n=json.loads((R/'raw'/name/'native.json').read_text());w=n['workload'];reference=n['results'][0]
 for call in syscalls:
  dest=out/(name+'-'+call+'.strace');result=census.proc(['strace','-f','-qq','-s','0','-o',dest,'-e','inject='+call+':error=ENOSYS',w['binary']]+w['argv'],bytes.fromhex(w['stdin_hex']),timeout=3)
  result.update(name=name,syscall=call,same_stdout=result['stdout_hex']==reference['stdout_hex'],preserved=not result['timeout'] and result['returncode']==reference['returncode'] and result['stdout_hex']==reference['stdout_hex'],injected='(INJECTED)' in dest.read_text())
  census.dump(out/(name+'-'+call+'.json'),result);rows.append(result);print(name,call,'preserved',result['preserved'],'injected',result['injected'],flush=True)
census.dump(R/'raw/sensitivity.json',rows)
