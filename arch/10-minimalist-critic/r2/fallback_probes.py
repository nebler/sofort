#!/usr/bin/env python3
"""Application fallback evidence only; explicitly not strict syscall equivalence."""
import json, os, pathlib, subprocess, sys
sys.path.insert(0, '/review/oracle')
from normalize import normalize
root = pathlib.Path('/out/fallback'); root.mkdir(exist_ok=True)
sql = "CREATE TABLE t(x INTEGER); INSERT INTO t VALUES(9),(1),(5),(3),(5); SELECT json_object('count',count(*),'sum',sum(x),'max',max(x)) FROM t;"
expected = b'{"count":5,"sum":23,"max":9}\n'
cases = {'lua':(['/bin-input/lua-static','/case/agent.lua'],b'9 1 5 3 5\n'),
         'sqlite':(['/bin-input/sqlite3-static','-batch','-init','/dev/null',':memory:',sql],b'')}
profiles = {'guard-denied':['inject=mmap:error=EINVAL:when=1'],
            'signals-enosys':['inject=rt_sigaction:error=ENOSYS','inject=rt_sigprocmask:error=ENOSYS'],
            'combined':['inject=mmap:error=EINVAL:when=1','inject=rt_sigaction:error=ENOSYS','inject=rt_sigprocmask:error=ENOSYS']}
results = []
for name,(command,data) in cases.items():
    for profile, injections in profiles.items():
        if profile not in os.getenv('ORACLE_PROFILES', 'guard-denied,signals-enosys').split(','):
            continue
        successful, injected = 0, []
        directory = root / (name+'-'+profile); directory.mkdir(exist_ok=True)
        for i in range(30):
            trace = directory/f'{i:02}.strace'
            cmd = ['strace','-f','-qq','-v','-X','raw','-xx','-s','1048576','-o',str(trace)]
            for injection in injections: cmd += ['-e',injection]
            p = subprocess.run(cmd+['--']+command, input=data, capture_output=True, timeout=20,
                cwd='/case', env={'PATH':'/usr/bin:/bin','LANG':'C','LC_ALL':'C','TZ':'UTC'})
            (directory/f'{i:02}.stdout').write_bytes(p.stdout)
            (directory/f'{i:02}.stderr').write_bytes(p.stderr)
            events = normalize(trace.read_text(), require_exit=True)
            assert any(e['errno'] in ('EINVAL','ENOSYS') for e in events)
            injected.append(trace.read_text().count('(INJECTED)'))
            successful += p.returncode == 0 and p.stdout == expected
        results.append(dict(binary=name, profile=profile, n=30, application_pass=successful, injected_per_run=sorted(set(injected)),
                            strict_equivalence=False))
(root/os.getenv('FALLBACK_SUMMARY', 'summary.json')).write_text(json.dumps(results,indent=2)+'\n')
print(json.dumps(results,indent=2))
