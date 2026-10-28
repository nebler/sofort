import assert from 'node:assert/strict';
import {MicroVMExecutor,SandboxPool,type Backend,type Session} from './executor.js';
let vmmReap!:()=>void,watchdogReap!:()=>void,releases=0;
const vmm=new Promise<void>(r=>vmmReap=r),watchdog=new Promise<void>(r=>watchdogReap=r);
const s:Session={phase:'parked',released:Promise.all([vmm,watchdog]).then(()=>{}),start:async()=>{},next:async()=>({kind:'done',ok:2}),reply:async()=>{},release:()=>{releases++;}};
const b:Backend={kind:'jitk',memoryLimitMB:32,park:async()=>s};
const pool=new SandboxPool(b,0,1),ex=new MicroVMExecutor(pool,()=> 'allow');
const result=await ex.execute('return 2',[]);
assert.equal(result.result,2);assert.equal(releases,0,'execute resolved before even its release');
assert.equal(pool.snapshot().tokens,1);
{ // The charged token makes the next caller wait (not shed); abort removes it.
  const ac=new AbortController(),next=pool.acquire(ac.signal);
  await new Promise(r=>setImmediate(r));assert.equal(pool.snapshot().waiting,1);
  ac.abort();await assert.rejects(()=>next,/aborted/);assert.equal(pool.snapshot().waiting,0);
}
await new Promise(r=>setImmediate(r));assert.equal(releases,1);
vmmReap();await new Promise(r=>setImmediate(r));assert.equal(pool.snapshot().tokens,1,'watchdog still owns capacity');
watchdogReap();await new Promise(r=>setImmediate(r));assert.equal(pool.snapshot().tokens,0);
await pool.close();console.log('PASS resolve before release; VMM AND watchdog hold token');
