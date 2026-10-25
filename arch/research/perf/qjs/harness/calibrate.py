import pathlib,subprocess,os,signal,json
from measure import snap,env
r=pathlib.Path(__file__).resolve().parent
p=subprocess.Popen([str(r/'qjs'),'--std','--memory-limit','16777216','-e',(r/'bootstrap.js').read_text()],stdin=subprocess.PIPE,stdout=subprocess.PIPE,text=True)
ready=json.loads(p.stdout.readline());assert ready==dict(t='ready',v=1),ready
os.kill(p.pid,signal.SIGSTOP)
record=dict(environment=env(),ready=ready,snapshot=snap(p.pid,[]))
os.kill(p.pid,signal.SIGCONT)
p.stdin.write(json.dumps(dict(t='run',code='return 2;',ns={}))+'\n');p.stdin.flush()
record['done']=json.loads(p.stdout.readline());record['returncode']=p.wait(timeout=10)
assert record['done']==dict(t='done',ok=2) and record['returncode']==0
(r/'shipped-calibration.json').write_text(json.dumps(record,indent=2))
print({k:record['snapshot']['smaps'][k] for k in ['Private_Dirty','Pss','Rss']})
