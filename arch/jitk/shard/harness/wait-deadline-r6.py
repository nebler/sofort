#!/usr/bin/env python3
"""Offline correctness observer, outside the shard runtime."""
import json,os,pathlib,signal,subprocess,time
r=pathlib.Path('/home/dev/r6-shard');binary=r/'arch/jitk/shard/target/release/real';out=r/'raw'
p=subprocess.Popen([str(binary),'hold',str(r/'final-r6'),'wait','1024','3'],cwd=r,stdout=subprocess.PIPE,stderr=subprocess.PIPE,bufsize=0)
events=[]
try:
    while True:
        line=p.stdout.readline()
        if not line:raise RuntimeError(p.stderr.read())
        e=json.loads(line);events.append(e)
        if e['event']=='environment':pid=e['pid']
        if e['event']=='held':break
    def sample():
        return dict(status=pathlib.Path(f'/proc/{pid}/status').read_text(),stat=pathlib.Path(f'/proc/{pid}/stat').read_text(),
          smaps=pathlib.Path(f'/proc/{pid}/smaps_rollup').read_text(),loadavg=pathlib.Path('/proc/loadavg').read_text(),uptime=pathlib.Path('/proc/uptime').read_text())
    a=sample();time.sleep(1);b=sample()
    assert 'Threads:\t1\n' in a['status'] and 'Threads:\t1\n' in b['status']
    for line in p.stdout:events.append(json.loads(line))
    assert p.wait(timeout=30)==0,p.stderr.read()
    assert events[-1]['event']=='released' and events[-1]['n']==1024 and events[-1]['lost']==0
    (out/'wait-observed.json').write_text(json.dumps(dict(events=events,samples=[a,b]),indent=2)+'\n')
finally:
    if p.poll() is None:p.kill();p.wait()
    p.stdout.close();p.stderr.close()
# Separate external supervisor proof. No shard-owned watchdog/leases are claimed.
p=subprocess.Popen([str(binary),'bench',str(r/'final-r6'),'spin','1'],cwd=r,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
try:
    first=p.stdout.readline();assert json.loads(first)['event']=='environment'
    time.sleep(.2);before=time.monotonic_ns();p.kill();p.wait(timeout=2);after=time.monotonic_ns()
    assert p.returncode==-signal.SIGKILL
    (out/'external-kill.json').write_text(json.dumps(dict(returncode=p.returncode,signal='SIGKILL',
      observation='external supervisor, not watchdog leases',kill_to_reap_ns=after-before,delay_before_kill_s=.2,
      stdout=first.decode(),stderr=p.stderr.read().decode(),loadavg=pathlib.Path('/proc/loadavg').read_text()))+'\n')
finally:
    if p.poll() is None:p.kill();p.wait()
    p.stdout.close();p.stderr.close()
