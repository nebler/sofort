"""Runs only inside the pinned native arm64 Linux oracle container."""
import json, pathlib, subprocess, time
out=pathlib.Path('/out'); cfg=json.loads((out/'oracle-config.json').read_text())
results=[]
for i in range(cfg['samples']):
    trace=out/f'linux-{i:02}.strace'
    cmd=['strace','-f','-qq','-v','-X','raw','-xx','-s','1048576','-o',str(trace)]
    for injection in cfg.get('injections',[]): cmd+=['-e','inject='+injection]
    started=time.perf_counter()
    # Preserve stdin until exit: this tests POLLIN rather than POLLIN|POLLHUP.
    import os,signal
    with (out/f'linux-{i:02}.stdout').open('wb') as so,(out/f'linux-{i:02}.stderr').open('wb') as se:
        p=subprocess.Popen(cmd+['--','/payload']+cfg['argv'][1:],stdin=subprocess.PIPE,stdout=so,stderr=se,
            start_new_session=True,env={'PATH':'/bin:/usr/bin','LC_ALL':'C','LANG':'C','TZ':'UTC'})
        try:
            data=bytes.fromhex(cfg['stdin_hex'])
            if data: p.stdin.write(data);p.stdin.flush()
            p.wait(timeout=10)
        except BaseException:
            os.killpg(p.pid,signal.SIGKILL);p.wait();raise
        finally: p.stdin.close()
    stdout=(out/f'linux-{i:02}.stdout').read_bytes(); stderr=(out/f'linux-{i:02}.stderr').read_bytes()
    assert p.returncode==0 and stdout.hex()==cfg['expected_hex'] and not stderr,(p.returncode,stdout,stderr)
    text=trace.read_text()
    for injection in cfg.get('injections',[]):
        name=injection.split(':',1)[0]
        assert any(name+'(' in line and '(INJECTED)' in line for line in text.splitlines()), name
    results.append({'returncode':p.returncode,'seconds':time.perf_counter()-started,'stdout_hex':stdout.hex(),
                    'injected_count':trace.read_text().count('(INJECTED)')})
(out/'linux-summary.json').write_text(json.dumps(results,indent=2)+'\n')
