import {receiptPath} from '../lib.ts';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {cases} from './cases.mjs';
import {vm,selection,here,uptime,stats,runFrame} from '../vm.mjs';
const config=selection(),n=Number(process.env.JITK_VM_N||30);
const result={config,n,node:process.execPath,method:'Fresh hardware VM per attack. Test fixture policy holds/denies calls, never invokes a provider. No credentials or external effects. Kernel natural kill or dispatcher SIGKILL required; watchdog is failure.',cases:[]};
for(const c of cases.filter(c=>!process.env.JITK_CASE||new RegExp(process.env.JITK_CASE).test(c.name))) {
 const loadBefore=uptime(),samples=[],errors=[],outcomes=[];
 for(let i=0;i<n;i++)try {
  let calls=0,logs=0;
  const r=await vm({...config,timeout:c.reply?120:15},s=>{
   s.onMessage=m=>{
    if(m.t==='ready'){s.send(runFrame(c.code));return;}
    if(m.t==='log'){logs++;return;}
    if(m.t==='call') {
     calls++;
     // This is a bounded, deny-default fixture policy. Never dispatch by prototype.
     const caps=Object.freeze({api:Object.freeze({echo:true,fail:true})});
     if(!Object.hasOwn(caps,m.ns)||!Object.hasOwn(caps[m.ns],m.fn)){s.terminate('POLICY');return;}
     if(c.reply)s.send({t:'ret',id:m.id,ok:null});
    }
   };
  });
  const detail=JSON.stringify({fault:r.fault,exit:r.exit,kernel:r.kernel,done:r.done,calls,logs});
  assert.equal(r.hostEffects,0,detail);assert.equal(r.done,undefined,detail);assert.equal(calls,c.calls,detail);
  if(c.kernel) {
   assert.equal(r.fault,undefined,detail);assert.equal(r.exit.signal,null,detail);
   assert(r.kernel.some(s=>/control|fault|kill|bad.output/i.test(s)),detail);
  }else {assert.equal(r.fault,c.fault,detail);assert.equal(r.exit.signal,'SIGKILL',detail);}
  samples.push(r.totalMs);outcomes.push({exit:r.exit,fault:r.fault,kernel:r.kernel,calls,logs,stdoutBytes:r.stdoutBytes,hostEffects:r.hostEffects});
 }catch(e){errors.push(String(e).slice(0,2048));}
 const row={name:c.name,pass:samples.length,fail:n-samples.length,loadBefore,loadAfter:uptime(),totalMs:samples.length?stats(samples):null,samples,errors:[...new Set(errors)],outcomes};
 result.cases.push(row);console.log(c.name,`${row.pass}/${n}`,errors[0]||'');
}
writeFileSync(receiptPath('hostile/results.json'),JSON.stringify(result,null,2)+'\n');
if(result.cases.some(c=>c.fail))process.exitCode=1;
