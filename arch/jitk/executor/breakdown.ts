import {receiptPath} from './receipt-path.js';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {MicroVMExecutor,SandboxPool,type TimingEvent} from './executor.js';
import {selectBackend} from './select-backend.js';
const selected=selectBackend();const artifacts=JSON.parse(readFileSync(receiptPath('integration-selection.json'),'utf8'));if(!selected.gate)throw Error('warm G1 gate required');
const uptime=()=>execFileSync('/usr/bin/uptime',[],{encoding:'utf8'}).trim();
const rows:any[]=[],loadBefore=uptime();let lifecycle:Record<string,number>={};
const pool=new SandboxPool(selected.backend,2,4,{parkingGate:selected.gate,onEvent:(event,_s,at)=>{lifecycle[event]=at;}});
const ex=new MicroVMExecutor(pool,()=> 'allow');
try{
 await pool.warm();
 for(let i=0;i<55;i++){
  // Complete each disposal and refill before measuring the next parked sample.
  // Refill wait is recorded separately and excluded from execute latency.
  const waitStart=performance.now();await pool.warm();const refillWaitMs=performance.now()-waitStart;
  const load=uptime();
  const gate=JSON.parse(execFileSync(fileURLToPath(new URL('../../bench/build/gate',import.meta.url)),['6','0'],{encoding:'utf8'}));
  const marks:Partial<Record<TimingEvent|'callerResolve',number>>={};lifecycle={};
  const r=await ex.execute('return await api.echo(2)',[{name:'api',fns:{echo:async x=>x}}],{onTiming:(event,at)=>marks[event]=at});
  marks.callerResolve=performance.now();assert.equal(r.result,2);assert(!r.error);
  assert.equal(lifecycle.release,undefined,'SIGKILL must follow caller resolution');
  await new Promise<void>((resolve,reject)=>{const deadline=performance.now()+5000;const poll=()=>{if(lifecycle.released)resolve();else if(performance.now()>deadline)reject(Error('disposal did not reap within 5s'));else setTimeout(poll,1);};poll();});
  const m=marks as Record<string,number>;
  if(i>=5)rows.push({load,gate,refillWaitMs,marks,...lifecycle,
   acquire:m.acquired-m.start,sendRun:m.runSent-m.acquired,firstCall:m.firstCall-m.runSent,
   ret:m.firstRet-m.firstCall,done:m.done-m.firstRet,resolve:m.callerResolve-m.done,
   execute:m.callerResolve-m.start,killAfterResolve:lifecycle.release-m.callerResolve,reapAfterResolve:lifecycle.released-m.callerResolve});
 }
}finally{await pool.close();}
const stats=(key:string)=>{const a=rows.map(r=>r[key]).sort((a,b)=>a-b);return {n:a.length,median:a[Math.ceil(a.length*.5)-1],p90:a[Math.ceil(a.length*.9)-1],p99:a[Math.ceil(a.length*.99)-1]};};
const result={artifacts,selection:selected.selection,loadBefore,loadAfter:uptime(),warmups:5,n:rows.length,
 unit:'ms',summary:Object.fromEntries(['acquire','sendRun','firstCall','ret','done','resolve','execute','killAfterResolve','reapAfterResolve'].map(k=>[k,stats(k)])),rows,pool:pool.snapshot()};
writeFileSync(receiptPath('breakdown-results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,rows:undefined},null,2));
