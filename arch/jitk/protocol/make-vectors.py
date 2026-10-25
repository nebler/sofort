import json
from pathlib import Path
out=Path(__file__).parent
ready={'t':'ready','v':1}
run={'t':'run','code':'return 1','ns':{'api':['echo','fail']}}
call={'t':'call','id':1,'ns':'api','fn':'echo','args':[]}
def g(x):return {'dir':'guest','wire':json.dumps(x,separators=(',',':'))+'\n'}
def h(x):return {'dir':'host','frame':x}
def raw(s):return {'dir':'guest','wire':s+'\n'}
setup=[g(ready),h(run)]
cases=[]
def add(name,steps,expected='ACCEPT',state=None):
 c={'name':name,'steps':steps,'expected':expected}
 if state:c['state']=state
 cases.append(c)
add('ready',[g(ready)],state='parked')
add('empty final',setup+[g({'t':'done','ok':None}),{'eof':True}],state='done')
add('variadic unicode and out-of-order',setup+[g({**call,'args':[1,'é😀',{'x':False}]}),g({**call,'id':2}),h({'t':'ret','id':2,'ok':False}),h({'t':'ret','id':1,'err':{'code':'DENIED','message':'no'}}),g({'t':'log','level':'info','msg':'hello\nworld'}),g({'t':'done','ok':True})],state='done')
add('error final cancels pending',setup+[g(call),g({'t':'done','err':{'name':'Error','message':'x'}})],state='done')
add('kernel text',[raw('\x1eENOSYS nr=123'),g(ready),h(run),g({'t':'done','ok':0}),raw('\x1eexit=0'),{'eof':True}],state='done')
add('spaces',setup+[raw(' { "t" : "done", "ok" : null } ')],state='done')
add('depth32',setup+[g(call)])
# Generate nested boundary algorithmically instead of hand counting.
x=0
for _ in range(30):x=[x]
cases[-1]['steps']=setup+[g({**call,'args':[x]})]
add('depth33',setup+[g({**call,'args':[[x]]})],'DEPTH')
for name,s,code in [
 ('old hello','{"t":"hello","v":1}','SCHEMA'),
 ('version alias','{"t":"ready","version":1}','SCHEMA'),
 ('duplicate key','{"t":"done","ok":1,"ok":2}','DUPLICATE'),
 ('escaped duplicate','{"t":"done","ok":{"x":1,"\\u0078":2}}','DUPLICATE'),
 ('nested duplicate','{"t":"done","ok":[{"a":0,"a":1}]}','DUPLICATE'),
 ('surrogate value','{"t":"done","ok":"\\ud800"}','UNICODE'),
 ('surrogate key','{"t":"done","ok":{"\\udc00":1}}','UNICODE'),
 ('nonfinite','{"t":"done","ok":1e999}','NUMBER'),
 ('large number','{"t":"done","ok":9007199254740992}','NUMBER'),
 ('bad JSON','{"t":"done","ok":}','JSON'),
 ('trailing JSON','{"t":"done","ok":1}{}','JSON'),
 ('trailing comma','{"t":"done","ok":1,}','JSON'),
 ('object required','[]','SCHEMA'),
 ('raw Unicode','{"t":"done","ok":"é"}','ASCII'),
 ('raw tab','{\t"t":"done","ok":1}','ASCII'),
 ('raw RS inside','{"t":"done","ok":"\x1e"}','ASCII'),
 ('raw DEL','{"t":"done","ok":"\x7f"}','ASCII'),
 ('both done branches','{"t":"done","ok":1,"err":{"name":"Error","message":"x"}}','SCHEMA'),
 ('extra done field','{"t":"done","ok":1,"approved":true}','SCHEMA'),
 ('empty line','','FRAME_LIMIT'),
]:add(name,setup+[raw(s)],code)
for name,frame,code in [
 ('args object',{**call,'args':{}},'SCHEMA'),
 ('zero id',{**call,'id':0},'ID'),
 ('skipped id',{**call,'id':2},'ID'),
 ('fraction id',{**call,'id':1.5},'ID'),
 ('id above total',{**call,'id':4097},'ID'),
 ('extra call field',{**call,'approved':True},'SCHEMA'),
 ('bad name',{**call,'ns':'a.b'},'SCHEMA'),
 ('bad log level',{'t':'log','level':'fatal','msg':'x'},'SCHEMA'),
 ('log size',{'t':'log','level':'info','msg':'x'*4097},'SCHEMA'),
 ('guest ret',{'t':'ret','id':1,'ok':1},'SCHEMA'),
 ('duplicate ready',ready,'STATE'),
 ('missing done value',{'t':'done'},'SCHEMA'),
]:add(name,setup+[g(frame)],code)
add('call before run',[g(ready),g(call)],'STATE')
add('done before ready',[g({'t':'done','ok':0})],'STATE')
add('success with pending',setup+[g(call),g({'t':'done','ok':1})],'OUTSTANDING_DONE')
add('duplicate call id',setup+[g(call),g(call)],'ID')
add('unknown ret',setup+[h({'t':'ret','id':1,'ok':1})],'ID')
add('duplicate ret',setup+[g(call),h({'t':'ret','id':1,'ok':1}),h({'t':'ret','id':1,'ok':1})],'ID')
add('second run',setup+[h(run)],'STATE')
add('host wrong ret error',setup+[g(call),h({'t':'ret','id':1,'err':{'code':'bad','message':'x'}})],'SCHEMA')
add('run extra', [g(ready),h({**run,'providers':[]})],'SCHEMA')
add('then method',[g(ready),h({**run,'ns':{'api':['then']}})],'SCHEMA')
add('reserved namespace',[g(ready),h({**run,'ns':{'return':['echo']}})],'SCHEMA')
add('duplicate method',[g(ready),h({**run,'ns':{'api':['echo','echo']}})],'SCHEMA')
add('prototype data is ordinary JSON',setup+[raw('{"t":"done","ok":{"__proto__":{"admin":true},"constructor":1}}')],state='done')
add('done then guest',setup+[g({'t':'done','ok':1}),g({'t':'log','level':'info','msg':'x'})],'STATE')
add('EOF before ready',[{'eof':True}],'EOF')
add('EOF parked',[g(ready),{'eof':True}],'EOF')
add('EOF partial',setup+[{'dir':'guest','wire':'{"t":"done"'},{'eof':True}],'EOF')
add('CRLF',setup+[{'dir':'guest','wire':'{"t":"done","ok":0}\r\n'}],'ASCII')
add('64 outstanding',setup+[g({**call,'id':i}) for i in range(1,65)],state='running')
add('65 outstanding',setup+[g({**call,'id':i}) for i in range(1,66)],'OUTSTANDING')
add('log count',setup+[{'repeat':1025,'step':g({'t':'log','level':'debug','msg':''})}],'LOG_LIMIT')
add('log total',setup+[{'repeat':65,'step':g({'t':'log','level':'debug','msg':'x'*4096})}],'LOG_LIMIT')
add('frame count',[{'repeat':8193,'step':raw('\x1ex')}],'FRAME_COUNT')
add('kernel cap',[{'dir':'guest','wire':'\x1e'+'x'*4097}],'KERNEL_LIMIT')
add('frame cap no LF',setup+[{'dir':'guest','wire':'x'*1048577}],'FRAME_LIMIT')
add('structure',setup+[g({'t':'done','ok':[0]*32768})],'STRUCTURE')
add('inflight',setup+[g({**call,'id':i,'args':['x'*800000]}) for i in range(1,4)],'INFLIGHT')
add('code cap',[g(ready),h({**run,'code':'x'*65537})],'SCHEMA')
add('unicode code byte cap',[g(ready),h({**run,'code':'é'*32769})],'SCHEMA')
add('unicode log byte cap',setup+[g({'t':'log','level':'info','msg':'é'*2049})],'SCHEMA')
add('wire total',[{'repeat':4095,'step':raw('\x1e'+'x'*4096)}],'WIRE_LIMIT')
(out/'vectors.json').write_text(json.dumps({'format':'jitk-v1-conformance-1','description':'steps in order; guest wire is UTF-8 bytes (including explicit LF); host frame is an object; repeat expands step; eof calls transport EOF. ACCEPT means no violation, not application success. Stop at first error. For chunk testing subdivide guest bytes arbitrarily.','cases':cases},indent=2)+'\n')
print(len(cases),'cases')
# Cases executable against the guest endpoint, not synthetic host decoder feeds.
# run.code strings are async function bodies. Fatal means no done and guest exit;
# watchdog kills are failures, never conformance evidence.
guest_cases=[
 {'name':'fragmented run','code':'return 42','fragment':True,'ok':42},
 {'name':'64 outstanding reverse rets','code':'return await Promise.all(Array.from({length:64},(_,i)=>api.echo(i)))','calls':64,'reply':'reverse','ok':list(range(64))},
 {'name':'error ret caught','code':"try { await api.fail(); } catch(e) { return {code:e.code,message:e.message}; }",'calls':1,'reply':'error','ok':{'code':'DENIED','message':'policy denied'}},
 {'name':'unknown ret id fatal','code':'await api.echo(1); return 99','calls':1,'reply':'unknown','fatal':True},
 {'name':'duplicate ret id fatal','code':'await api.echo(1); await new Promise(()=>{});','calls':1,'reply':'duplicate','fatal':True},
 {'name':'EOF before run','input':'eof','fatal':True},
 {'name':'oversized frame no LF','input':'oversized','fatal':True},
 {'name':'raw DEL host frame','input':'DEL','fatal':True},
 {'name':'Unicode log byte budget','code':"for(let i=0;i<2000;i++)console.info('é😀'.repeat(1000));return 7",'ok':7,'logBudget':True},
 {'name':'Unicode scalar log clipping','code':"console.info('é'.repeat(2047)+'😀');console.info('\\ud800');return 8",'ok':8,'scalarLogs':True},
]
p=out/'vectors.json'
v=json.loads(p.read_text());v['guestCases']=guest_cases
v['guestDescription']='Fresh VM per guestCase. Host sends run with api echo/fail. reverse waits for all calls then returns args[0] descending; error returns DENIED; unknown sends id 4096; duplicate sends same ret twice before completion. input overrides run. fatal requires no done and natural guest termination before watchdog. logBudget verifies decoded UTF-8 totals.'
p.write_text(json.dumps(v,indent=2)+'\n')
print(len(guest_cases),'real-guest cases')
