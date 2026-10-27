// Offline integrated execute ledger. Invoke under the shared benchmark lock.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MicroVMExecutor,SandboxPool,ShardBackend} from '../build/executor.js';
const mode=process.argv[2], n=Number(process.argv[3]);
const backend=new ShardBackend({binary:process.env.JITK_SHARD_BINARY,snapshot:process.env.JITK_SHARD_SNAPSHOT,slots:mode==='hold'?n:1});
const pool=new SandboxPool(backend,0,mode==='hold'?n:1,{refillConcurrency:64});
const ex=new MicroVMExecutor(pool,()=> 'allow',60000);
// JITK_HELPERS_FIXTURE=return2 holds `return 2` runs instead (linux-memory ledger).
const fixture=process.env.JITK_HELPERS_FIXTURE||'one_tool', want=fixture==='return2'?2:42;
const code=fixture==='return2'?'return 2':'return (await codemode.echo(41))+1', providers={echo:async x=>x};
const env=()=>({load:readFileSync('/proc/loadavg','utf8').trim(),uptime:readFileSync('/proc/uptime','utf8').trim()});
try {
 await backend.ready;
 console.log(JSON.stringify({event:'environment',mode,n,pid:process.pid,shard:backend.child.pid,node:process.version,...env()}));
 if(mode==='hold') {
  // Retain successfully stopped VMs before retirement/reset, including peak JS
  // dirty pages from the complete real executor/Node policy lifecycle.
  pool.retire=()=>{};
  const results=await Promise.all(Array.from({length:n},()=>ex.execute(code,providers)));
  for(const r of results){assert.equal(r.error,undefined);assert.equal(r.result,want);}
  console.log(JSON.stringify({event:'held',n,...env()}));
  await new Promise(resolve=>process.once('SIGTERM',resolve));
 } else {
  for(let i=0;i<5;i++){assert.equal((await ex.execute(code,providers)).result,want);await pool.drain();}
  const times=[];
  for(let i=0;i<n;i++){
   const t=performance.now(),r=await ex.execute(code,providers);times.push(performance.now()-t);
   assert.equal(r.error,undefined);assert.equal(r.result,want);await pool.drain();
  }
  const sorted=[...times].sort((a,b)=>a-b);
  console.log(JSON.stringify({event:'timing',n,warmups:5,p50Ms:sorted[Math.ceil(n*.5)-1],p99Ms:sorted[Math.ceil(n*.99)-1],times,...env()}));
 }
} finally {await pool.close();}
