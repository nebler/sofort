import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Dispatcher,LIMIT} from './dispatcher.ts';
const here=fileURLToPath(new URL('.',import.meta.url));
const native=process.env.JITK_QJS||'/tmp/jitk-03/quickjs-2026-06-04/qjs';
const staticQjs='/tmp/jitk-spike/sc/qjs-static';
const uptime=()=>execFileSync('/usr/bin/uptime',{encoding:'utf8'}).trim();
const pct=(xs,p)=>{const s=[...xs].sort((a,b)=>a-b);return p===.5 && s.length%2===0?(s[s.length/2-1]+s[s.length/2])/2:s[Math.ceil(s.length*p)-1];};
const stats=xs=>({n:xs.length,p50:pct(xs,.5),p90:pct(xs,.9),p99:pct(xs,.99)});
const code=`
const values=await Promise.all(Array.from({length:64},(_,i)=>(async()=>{
 const v=await api.echo(i,'é😀'); console.debug('ack:'+i); return v;
})()));
let caught='';try{await api.fail('test');}catch(e){caught=e.code;console.error('caught:'+e.code);}
console.log('log');console.info('unicode é😀');console.warn('warn');
await new Promise(resolve=>setTimeout(resolve,1));
return {values,caught,timer:true};`;
const linuxContainer='jitk-03-r2-pipes-'+process.pid;
async function session(backend,program=code,logTest=false) {
 const started=performance.now();
 const child=backend==='native'?spawn(native,['--memory-limit','16M','--stack-size','512K','-m',here+'bootstrap.js'],{stdio:['pipe','pipe','pipe'],detached:true}):
  spawn('docker',['exec','-i',linuxContainer,'/qjs','--memory-limit','16M','--stack-size','512K','-m','/work/bootstrap.js'],{stdio:['pipe','pipe','pipe']});
 let closed=false;const close=new Promise(resolve=>child.on('close',(status,signal)=>{closed=true;resolve({status,signal});}));
 let d,done,readyAt,runAt,doneAt,error,stderr='',queued=0,logs=[],calls=[],retOrder=[],rtts=[],retTimes=new Map();
 let resolveDone,rejectDone;const completion=new Promise((resolve,reject)=>{resolveDone=resolve;rejectDone=reject;});
 const timer=setTimeout(()=>rejectDone(Error('30 second watchdog '+backend+' logTest='+logTest)),30000);
 const enqueue=wire=>{
  if(queued+wire.length>2*(LIMIT.frame+1))return false;
  queued+=wire.length;child.stdin.write(wire,e=>{queued-=wire.length;if(e && !done)rejectDone(e);});return true;
 };
 const send=m=>assert(d.send(m,enqueue),'bounded queue refused a tiny ret');
 d=new Dispatcher({kill:f=>rejectDone(Error('dispatcher '+f.code)),message:m=>{
  if(m.t==='ready'){
   readyAt=performance.now();runAt=performance.now();
   // Fragment run into seven-byte writes to exercise qjs raw-read accumulation.
   d.send({t:'run',code:program,ns:{api:['echo','fail']}},wire=>{
    for(let i=0;i<wire.length;i+=7){assert(enqueue(wire.subarray(i,i+7)));}return true;
   });
  } else if(m.t==='call'){
   calls.push(m);
   if(m.fn==='fail'){send({t:'ret',id:m.id,err:{code:'DENIED',message:'policy denied'}});return;}
   assert.equal(m.args.length,2);assert.equal(m.args[1],'é😀');
   if(calls.length===64) for(const c of [...calls].reverse()){
    retTimes.set(c.id,performance.now());retOrder.push(c.id);send({t:'ret',id:c.id,ok:c.args[0]});
   }
  } else if(m.t==='log'){
   logs.push(m);
   if(m.msg.startsWith('ack:')){const id=1+Number(m.msg.slice(4));assert(retTimes.has(id));rtts.push(performance.now()-retTimes.get(id));}
  } else if(m.t==='done'){done=m;doneAt=performance.now();resolveDone();}
 }});
 child.stdout.on('data',chunk=>{try{d.feed(chunk);}catch(e){rejectDone(e);}});
 child.stderr.on('data',chunk=>{stderr=(stderr+chunk.toString()).slice(0,65536);});
 child.on('error',rejectDone);child.stdin.on('error',e=>{if(!done)rejectDone(e);});
 close.then(({status,signal})=>{if(!done)rejectDone(Error(`early exit ${status}/${signal}: ${stderr}`));});
 try {
  await completion;
  const exit=await Promise.race([close,new Promise((_,reject)=>setTimeout(()=>reject(Error('reap timeout '+backend+' logTest='+logTest)),15000).unref())]);
  d.eof();assert.equal(exit.status,0,stderr);
  if(logTest){assert.equal(logs.length,1024);assert(logs.every(l=>l.msg.length<=512));assert.equal(done.ok,123);}
  else {
   assert.deepEqual(done,{t:'done',ok:{values:Array.from({length:64},(_,i)=>i),caught:'DENIED',timer:true}});
   assert.equal(calls.length,65);assert.deepEqual(retOrder,Array.from({length:64},(_,i)=>64-i));assert.equal(rtts.length,64);
   assert.deepEqual(new Set(logs.map(l=>l.level)),new Set(['log','info','warn','error','debug']));
  }
  return {startupMs:readyAt-started,runDoneMs:doneAt-runAt,rttMs:rtts,logs:logs.length,callCount:calls.length};
 } finally {
  clearTimeout(timer);
  if(!closed){if(backend==='native'){try{process.kill(-child.pid,'SIGKILL');}catch{}}else child.kill('SIGKILL');}
  if(backend!=='native' && !done){try{execFileSync('docker',['rm','-f',linuxContainer],{stdio:'ignore',timeout:10000});}catch{}}
  await close;
 }
}
const results=[];
try {
for(const backend of ['native','static-linux-docker']) {
 const loadBefore=uptime(),samples=[];console.log('starting',backend);
 if(backend!=='native')execFileSync('docker',['run','-d','--rm','--name',linuxContainer,'--network','none','--read-only','--cap-drop','ALL',
 '--mount',`type=bind,source=${here},target=/work,readonly`,'--mount',`type=bind,source=${staticQjs},target=/qjs,readonly`,
 'alpine:3.22','sleep','600'],{stdio:'ignore',timeout:30000});
 for(let i=0;i<30;i++){samples.push(await session(backend));if((i+1)%10===0)console.log(backend,i+1,'sessions');}
 const boundedLog=await session(backend,"for(let i=0;i<2000;i++)console.log('x');return 123",true);
 results.push({backend,n:30,uptimeBefore:loadBefore,uptimeAfter:uptime(),
  startupMs:stats(samples.map(s=>s.startupMs)),runDoneMs:stats(samples.map(s=>s.runDoneMs)),
  replyAckRttMs:stats(samples.flatMap(s=>s.rttMs)),boundedLog,samples});
}
} finally {try{execFileSync('docker',['rm','-f',linuxContainer],{stdio:'ignore',timeout:10000});}catch{}}
const result={node:process.execPath,version:process.version,bootstrapSHA256:createHash('sha256').update(readFileSync(here+'bootstrap.js')).digest('hex'),
 staticSHA256:createHash('sha256').update(readFileSync(staticQjs)).digest('hex'),
 method:'64 calls emitted before any reply; host sends ret 64..1; RTT is host ret enqueue → guest promise continuation/debug ack → host validated log. No external tool/network work. Static qjs is fresh per session via docker exec -i in one temporary Linux arm64 container; CLI startup included in startupMs; not virtio.',results};
writeFileSync(here+'e2e-results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result.results.map(({samples,...r})=>r),null,2));
