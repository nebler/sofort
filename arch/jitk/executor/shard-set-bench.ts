// Offline nested measurement (Linux): what one engine process per trust domain
// costs. For 64 slots as 1x64, 8x8 and 64x1 engine processes: time to READY,
// resident memory of the engines and their watchdogs (PSS and RSS), sequential
// run latency, and 64 concurrent runs. Hold the bench lock
// (${JITK_BENCH_LOCK:-$HOME/bench.lock}) when invoking.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MicroVMExecutor} from './executor.js';
import {SandboxPool} from './pool.js';
import {ShardSet} from './shard-set.js';
const binary=process.env.JITK_SHARD_BINARY!,snapshot=process.env.JITK_SHARD_SNAPSHOT!;
assert.ok(process.platform==='linux'&&binary&&snapshot,'Linux with JITK_SHARD_BINARY and JITK_SHARD_SNAPSHOT');
const slots=64,n=Number(process.env.JITK_SHARD_SET_BENCH_N??200);
const distribution=(values:number[])=>{const a=[...values].sort((x,y)=>x-y);return {n:a.length,p50:a[Math.ceil(a.length*.5)-1],p99:a[Math.ceil(a.length*.99)-1],max:a.at(-1)};};
const kib=(pid:number,file:string,key:string)=>Number(readFileSync(`/proc/${pid}/${file}`,'utf8').match(new RegExp(`^${key}:\\s+(\\d+) kB`,'m'))?.[1]??0);
const tree=(pid:number):number[]=>{
  const kids=readFileSync(`/proc/${pid}/task/${pid}/children`,'utf8').trim().split(/\s+/).filter(Boolean).map(Number);
  return [pid,...kids.flatMap(tree)];
};
for(const perProcess of (process.env.JITK_SHARD_SET_BENCH_SHAPES??'64,8,1').split(',').map(Number)){
  const t0=performance.now();
  const set=new ShardSet({binary,snapshot,slots,slotsPerProcess:perProcess});
  await set.ready;
  const readyMs=performance.now()-t0;
  const pool=new SandboxPool(set,0,slots,{refillConcurrency:slots}),ex=new MicroVMExecutor(pool,()=> 'allow',10000);
  try {
    const providers={echo:async(x:unknown)=>x},code='return (await codemode.echo(41))+1';
    for(let i=0;i<5;i++){const r=await ex.execute(code,providers);assert.equal(r.result,42);}
    await pool.drain();
    const wall:number[]=[];
    for(let i=0;i<n;i++){const s=performance.now();const r=await ex.execute(code,providers);wall.push(performance.now()-s);assert.equal(r.result,42);await pool.drain();}
    // Every slot used once, so each engine has restored and touched all its slots.
    let open!:()=>void;const gate=new Promise<void>(r=>{open=r;});let started=0,all!:()=>void;const allStarted=new Promise<void>(r=>{all=r;});
    const c0=performance.now();
    const runs=Array.from({length:slots},()=>ex.execute('return await codemode.hold()',{hold:async()=>{if(++started===slots)all();await gate;return 1;}}));
    await allStarted;const concurrentStartMs=performance.now()-c0;
    const pids=set.processes.flatMap(p=>tree(p.child.pid!));
    const memory={processes:pids.length,pssKiB:pids.reduce((a,p)=>a+kib(p,'smaps_rollup','Pss'),0),rssKiB:pids.reduce((a,p)=>a+kib(p,'status','VmRSS'),0)};
    open();const rs=await Promise.all(runs);await pool.drain();
    assert.ok(rs.every(r=>!r.error&&r.result===1));
    console.log(JSON.stringify({event:'shape',engines:set.processes.length,slotsPerProcess:perProcess,readyMs,memory,
      pssPerSlotKiB:memory.pssKiB/slots,executeMs:distribution(wall),concurrentStartMs,load:readFileSync('/proc/loadavg','utf8').trim()}));
  } finally {await pool.close();await set.close();}
}
