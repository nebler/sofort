"""Runs only inside the pinned native arm64 Linux oracle container."""
import json, pathlib, subprocess, time, selectors
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
        p=subprocess.Popen(cmd+['--','/payload']+cfg['argv'][1:],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,
            start_new_session=True,env={'PATH':'/bin:/usr/bin','LC_ALL':'C','LANG':'C','TZ':'UTC'})
        try:
            data=bytes.fromhex(cfg['stdin_hex'])
            if data: p.stdin.write(data);p.stdin.flush()
            # All three standard descriptors are pipes on both sides. Keep
            # stdin open for ppoll, drain stdout/stderr without a pipe deadlock.
            with selectors.DefaultSelector() as sel:
                sel.register(p.stdout, selectors.EVENT_READ, so)
                sel.register(p.stderr, selectors.EVENT_READ, se)
                while sel.get_map():
                    if time.perf_counter()-started > 10: raise TimeoutError('Linux oracle')
                    for key, _ in sel.select(.05):
                        b=os.read(key.fileobj.fileno(),65536)
                        if b: key.data.write(b)
                        else: sel.unregister(key.fileobj)
            p.wait(timeout=1)
        except BaseException:
            os.killpg(p.pid,signal.SIGKILL);p.wait();raise
        finally: p.stdin.close(); p.stdout.close(); p.stderr.close()
    stdout=(out/f'linux-{i:02}.stdout').read_bytes(); stderr=(out/f'linux-{i:02}.stderr').read_bytes()
    if cfg.get('expected_hex') is not None:
        assert p.returncode==cfg.get('exit',0) and stdout.hex()==cfg['expected_hex'] and stderr.hex()==cfg.get('stderr_hex',''),(p.returncode,stdout,stderr)
    text=trace.read_text()
    for injection in cfg.get('injections',[]):
        name=injection.split(':',1)[0]
        assert any(name+'(' in line and '(INJECTED)' in line for line in text.splitlines()), name
    results.append({'returncode':p.returncode,'exit':p.returncode,'seconds':time.perf_counter()-started,'stdout_hex':stdout.hex(),'stderr_hex':stderr.hex(),
                    'injected_count':trace.read_text().count('(INJECTED)')})
(out/'linux-summary.json').write_text(json.dumps(results,indent=2)+'\n')
