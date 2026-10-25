#!/usr/bin/env python3
"""No-KVM checks of protocol success, corruption, timeout and child cleanup."""
import json,sys,time,subprocess,os,signal
import bench
fake=[sys.executable,'-u','-c','import sys,json;print(\'{"t":"ready","v":1}\',flush=True);m=json.loads(sys.stdin.readline());print(\'{"t":"done","ok":2}\',flush=True)']
r=bench.batch(32,4,fake)
assert r['completed']==32,r
assert not bench.LIVE
old=bench.TIMEOUT;bench.TIMEOUT=.1
for code in ['import time;time.sleep(30)', 'print("garbage",flush=True)', 'print(\'{"t":"ready","v":9}\',flush=True)']:
 row=bench.one(0,[sys.executable,'-u','-c',code]);assert not row['ok'],row;assert not bench.LIVE
bench.TIMEOUT=old
sleeping_code='import time;print(\'{"t":"ready","v":1}\',flush=True);time.sleep(30)'
driver="import bench,sys,json\np=bench.launch(cmd="+repr([sys.executable,'-u','-c',sleeping_code])+")\nprint(p.pid,flush=True)\ntry:sys.stdin.readline()\nfinally:bench.cleanup_all();print(json.dumps({'children_remaining':len(bench.LIVE)}),flush=True)\n"
p=subprocess.Popen([sys.executable,'-u','-c',driver],cwd=bench.ROOT,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
child=int(p.stdout.readline());p.send_signal(signal.SIGTERM);out,err=p.communicate(timeout=5)
assert b'"children_remaining": 0' in out,(out,err)
try:os.kill(child,0)
except ProcessLookupError:pass
else:raise AssertionError('cancelled child survived')
print(json.dumps({'signal_cleanup_cases':1,'success_cases' :32,'negative_cases':3,'children_remaining':len(bench.LIVE),'result':'PASS','uptime_before':r['uptime_before'],'uptime_after':r['uptime_after']},indent=2))
