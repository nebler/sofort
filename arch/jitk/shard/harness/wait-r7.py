#!/usr/bin/env python3
"""Offline observer: WAIT density with stable threads, retained memory and CPU deltas."""
import json,os,pathlib,select,subprocess,sys,time
root=pathlib.Path(sys.argv[1]);binary=root/sys.argv[2];n=int(sys.argv[3])
snapshot=root/(sys.argv[4] if len(sys.argv)>4 else 'arena')
raw=pathlib.Path(os.environ.get('JITK_R7_OUTPUT',str(root/'raw')));raw.mkdir(exist_ok=True)
with (raw/f'wait-{n}.stderr').open('wb') as err:
    p=subprocess.Popen([str(binary),'hold',str(snapshot),'wait',str(n),'3'],stdout=subprocess.PIPE,stderr=err,bufsize=0)
    rows=[]
    try:
        while True:
            assert select.select([p.stdout],[],[],120)[0],'no WAIT progress'
            line=p.stdout.readline();assert line,'holder exited'
            row=json.loads(line);rows.append(row)
            if row['event']=='environment':pid=row['pid']
            if row['event']=='held':break
        status=pathlib.Path(f'/proc/{pid}/status').read_text()
        task_ids=sorted(x.name for x in pathlib.Path(f'/proc/{pid}/task').iterdir())
        children={child for tid in task_ids for child in pathlib.Path(f'/proc/{pid}/task/{tid}/children').read_text().split()}
        assert len(children)==1,children
        watchdog_pid=children.pop()
        watchdog_cmdline=pathlib.Path(f'/proc/{watchdog_pid}/cmdline').read_bytes().split(b'\0')
        watchdog_status=pathlib.Path(f'/proc/{watchdog_pid}/status').read_text()
        assert watchdog_cmdline[1]==b'watchdog' and 'Threads:\t1\n' in watchdog_status
        before=pathlib.Path(f'/proc/{pid}/stat').read_text();time.sleep(1)
        after=pathlib.Path(f'/proc/{pid}/stat').read_text()
        smaps=pathlib.Path(f'/proc/{pid}/smaps_rollup').read_text()
        rest=p.communicate(timeout=120)[0];rows.extend(json.loads(x) for x in rest.splitlines());assert p.returncode==0
        def ticks(s):f=s[s.rfind(')')+2:].split();return int(f[11])+int(f[12])
        assert int(status.split('Threads:\t')[1].splitlines()[0])==rows[0]['threads']
        assert rows[-1]['event']=='released' and rows[-1]['lost']==0
        print(json.dumps(dict(n=n,events=rows,status=status,task_ids=task_ids,watchdog_pid=int(watchdog_pid),
            watchdog_status=watchdog_status,watchdog_cmdline=[x.decode() for x in watchdog_cmdline if x],stat_before=before,stat_after=after,
            idle_cpu_ticks=ticks(after)-ticks(before),smaps_rollup=smaps,
            loadavg=pathlib.Path('/proc/loadavg').read_text(),uptime=pathlib.Path('/proc/uptime').read_text())))
    finally:
        if p.poll() is None:p.kill();p.wait()
