import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import {vm,selection,here,uptime,stats,runFrame,encode} from './vm.mjs';
const config=selection(), n=Number(process.env.JITK_VM_N||30);
const cases=JSON.parse(readFileSync(here+'vectors.json','utf8')).guestCases;
const result={config,n,node:process.execPath,method:'Fresh hardware VM per case; watchdog is failure; totalMs includes boot/reap. Contended functional timings only.',cases:[]};
for(const c of cases.filter(c=>!process.env.JITK_CASE||new RegExp(process.env.JITK_CASE).test(c.name))) {
 const loadBefore=uptime(),samples=[],errors=[];
 for(let i=0;i<n;i++)try {
  const r=await vm(config,s=>{
   let calls=[];
   const guarded=fn=>Promise.resolve().then(fn).catch(e=>{errors.push(String(e).slice(0,2048));s.terminate('TEST_FAILURE');});
   s.onMessage=m=>{
    if(m.t==='ready')guarded(async()=>{
     if(c.input==='eof'){s.end();return;}
     if(c.input==='oversized'){await s.raw(' '.repeat(1048577));return;}
     if(c.input==='DEL'){await s.raw('{"t":"run","code":"\x7f","ns":{}}\n');return;}
     if(c.fragment) {
      // Commit host state once, but release small pieces across readiness turns.
      let wire;s.d.send(runFrame(c.code),b=>{wire=b;return true;});
      for(let k=0;k<wire.length;k+=7){await s.raw(wire.subarray(k,k+7));await delay(1);}
     }else s.send(runFrame(c.code));
    });
    if(m.t==='call') {
     calls.push(m);
     if(c.reply==='reverse' && calls.length===c.calls)for(const call of [...calls].reverse())s.send({t:'ret',id:call.id,ok:call.args[0]});
     if(c.reply==='error')s.send({t:'ret',id:m.id,err:{code:'DENIED',message:'policy denied'}});
     if(c.reply==='unknown')guarded(()=>s.raw(encode({t:'ret',id:4096,ok:0})));
     if(c.reply==='duplicate')guarded(()=>s.raw(Buffer.concat([Buffer.from(encode({t:'ret',id:m.id,ok:0})),Buffer.from(encode({t:'ret',id:m.id,ok:0}))])));
    }
   };
  });
  assert.equal(r.fault,undefined,JSON.stringify({exit:r.exit,fault:r.fault,done:r.done,kernel:r.kernel,stderr:r.stderr}));
  assert.equal(r.exit.signal,null,JSON.stringify({exit:r.exit,fault:r.fault,done:r.done,kernel:r.kernel,stderr:r.stderr}));
  if(c.fatal){assert.equal(r.done,undefined);assert(r.kernel.some(x=>/exit|fault|kill/i.test(x)),JSON.stringify({exit:r.exit,fault:r.fault,done:r.done,kernel:r.kernel,stderr:r.stderr}));}
  else {
   assert.deepEqual(r.done,{t:'done',ok:c.ok},JSON.stringify({exit:r.exit,fault:r.fault,done:r.done,kernel:r.kernel,stderr:r.stderr}));
   if(c.calls)assert.equal(r.frames.filter(x=>x.t==='call').length,c.calls);
   const logs=r.frames.filter(x=>x.t==='log');
   if(c.logBudget){assert.equal(logs.reduce((a,x)=>a+Buffer.byteLength(x.msg),0),262144);assert(logs.every(x=>Buffer.byteLength(x.msg)<=4096));}
   if(c.scalarLogs)assert.deepEqual(logs.map(x=>x.msg),['é'.repeat(2047),'\ufffd']);
  }
  samples.push(r.totalMs);
 }catch(e){errors.push(String(e).slice(0,2048));}
 result.cases.push({name:c.name,pass:samples.length,fail:n-samples.length,loadBefore,loadAfter:uptime(),totalMs:samples.length?stats(samples):null,samples,errors:[...new Set(errors)]});
 console.log(c.name,`${samples.length}/${n}`,errors[0]||'');
}
writeFileSync(here+'vm-results.json',JSON.stringify(result,null,2)+'\n');
if(result.cases.some(c=>c.fail))process.exitCode=1;
