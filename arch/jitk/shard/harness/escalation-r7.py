#!/usr/bin/env python3
"""Offline failure injection: SIGSTOP the shard after leases arm; watchdog must pidfd-kill it."""
import json,os,pathlib,select,signal,subprocess,sys,time
root=pathlib.Path(sys.argv[1]);binary=root/sys.argv[2]
snapshot=root/(sys.argv[3] if len(sys.argv)>3 else 'arena')
raw=pathlib.Path(os.environ.get('JITK_R7_OUTPUT',str(root/'raw')));raw.mkdir(exist_ok=True)
log=raw/'escalation.stderr'
with log.open('wb') as err:
    p=subprocess.Popen([str(binary),'deadlines',str(snapshot),'spin','8'],stdout=subprocess.PIPE,stderr=err,bufsize=0)
    rows=[];start=time.monotonic();pid=None
    try:
        while True:
            if not select.select([p.stdout],[],[],10)[0]:raise TimeoutError('no armed event')
            line=p.stdout.readline()
            if not line:raise RuntimeError('shard exited before arming')
            row=json.loads(line);rows.append(row)
            if row['event']=='environment':pid=row['pid']
            if row['event']=='deadline_armed':break
        os.kill(pid,signal.SIGSTOP)
        stopped=time.monotonic_ns()
        rc=p.wait(timeout=10)
        reaped=time.monotonic_ns()
        assert rc==-signal.SIGKILL,(rc,log.read_text())
        assert 'watchdog escalation:' in log.read_text()
        print(json.dumps(dict(event='escalation',returncode=rc,pid=pid,deadline_ns=row['deadline_ns'],
            sigstop_at_ns=stopped,reaped_at_ns=reaped,deadline_to_reap_ns=reaped-row['deadline_ns'],
            grace_ms=100,events=rows,stderr=log.read_text(),loadavg=pathlib.Path('/proc/loadavg').read_text(),
            uptime=pathlib.Path('/proc/uptime').read_text())))
    finally:
        if p.poll() is None:p.kill();p.wait()
