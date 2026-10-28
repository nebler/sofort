// Offline nested measurement: hold the bench lock (${JITK_BENCH_LOCK:-/home/dev/bench.lock}) when invoking.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {MicroVMExecutor} from './executor.js';
import {SandboxPool} from './pool.js';
import {ShardBackend,type ShardMetrics} from './shard-backend.js';
const n=Number(process.env.JITK_SHARD_BENCH_N??200);
assert.ok(Number.isInteger(n)&&n>=20&&n<=10000);
const rows:ShardMetrics[]=[];
const backend=new ShardBackend({binary:process.env.JITK_SHARD_BINARY!,snapshot:process.env.JITK_SHARD_SNAPSHOT!,slots:1,onMetrics:m=>rows.push(m)});
backend.child.stderr!.on('data',(b:Buffer)=>process.stderr.write(b));
const pool=new SandboxPool(backend,0,1);
const ex=new MicroVMExecutor(pool,()=> 'allow',5000);
const providers={echo:async(x:unknown)=>x};
const code='return (await codemode.echo(41))+1';
const env=()=>({load:readFileSync('/proc/loadavg','utf8').trim(),uptime:readFileSync('/proc/uptime','utf8').trim()});
const ticks=(pid:number)=>{const text=readFileSync(`/proc/${pid}/stat`,'utf8');const fields=text.slice(text.lastIndexOf(')')+2).split(' ');return Number(fields[11])+Number(fields[12]);};
const distribution=(values:number[])=>{const a=[...values].sort((x,y)=>x-y);return {n:a.length,p50:a[Math.ceil(a.length*.5)-1],p99:a[Math.ceil(a.length*.99)-1],max:a.at(-1)};};
const json=(value:unknown)=>JSON.stringify(value,(_key,v)=>typeof v==='bigint'?v.toString():v);
try {
  await backend.ready;
  const pid=backend.child.pid!;
  const watchdog=Number(readFileSync(`/proc/${pid}/task/${pid}/children`,'utf8').trim());
  const hz=Number(execFileSync('getconf',['CLK_TCK'],{encoding:'utf8'}));
  for(let i=0;i<5;i++){const r=await ex.execute(code,providers);assert.equal(r.result,42);assert.equal(r.error,undefined);await pool.drain();}
  rows.length=0;
  const environment={event:'environment',nested:true,node:process.version,kernel:readFileSync('/proc/version','utf8').trim(),n,warmups:5,pid,watchdog,hz,start:env()};
  console.log(json(environment));
  const wall:number[]=[];
  const shardStart=ticks(pid),watchdogStart=ticks(watchdog),nodeStart=process.cpuUsage();
  for(let i=0;i<n;i++){
    const start=performance.now();const r=await ex.execute(code,providers);wall.push(performance.now()-start);
    assert.equal(r.error,undefined);assert.equal(r.result,42);await pool.drain();
  }
  const node=process.cpuUsage(nodeStart),shardTicks=ticks(pid)-shardStart,watchdogTicks=ticks(watchdog)-watchdogStart;
  const cpu={nodeUsPerRun:(node.user+node.system)/n,shardUsPerRun:shardTicks/hz*1e6/n,watchdogUsPerRun:watchdogTicks/hz*1e6/n,procTickResolutionUsPerRun:1e6/hz/n};
  const total=cpu.nodeUsPerRun+cpu.shardUsPerRun+cpu.watchdogUsPerRun;
  const summary={event:'summary',nested:true,executeMs:distribution(wall),echoUs:distribution(rows.flatMap(m=>m.roundTripsNs.map(n=>Number(n)/1e3))),cpu:{...cpu,totalUsPerRun:total,nodeShare:cpu.nodeUsPerRun/total,ownerUsPerRun:rows.reduce((s,m)=>s+Number(m.ownerCpuNs)/1e3,0)/n},end:env()};
  console.log(json(summary));
  wall.forEach((wallMs,i)=>console.log(json({event:'sample',i,wallMs,...rows[i]})));
  rows.length=0;
  for(let i=0;i<20;i++){
    const s=await backend.park();await s.armDeadline!(Date.now()+100);await s.start({kind:'js',source:'async()=>{while(true){}}',tools:{},prelude:''});
    const until=performance.now()+200;while(performance.now()<until){}
    {const ev=await s.next();assert.ok(ev.kind==='fail'&&/deadline_exceeded/.test(ev.message));}s.kill();await s.exited;
  }
  const stop=rows.map(m=>Number(m.stoppedNs-m.deadlineNs)/1e6),reset=rows.map(m=>Number(m.resetDoneNs-m.deadlineNs)/1e6);
  console.log(json({event:'deadlines',nested:true,n:rows.length,nodeBlockedMs:200,stopMs:distribution(stop),resetMs:distribution(reset),receipts:rows,end:env()}));
} finally {await pool.close();}
