// The HVF engine's parking gate: what kernel/.READY's G1 states for a parked
// libkrun VM (kernel/tests/measure.ts `park`), measured on the HVF engine, so
// a SandboxPool may keep HVF sessions parked (warm). Offline; not part of
// `make test`. Writes .work/hvf-parking-gate.json (JITK_RECORD=1:
// executor/hvf-parking-gate.json), which select-backend accepts only for the
// engine binary and prepared snapshot it measured, and at most its slots.
//
//   node build/hvf-parking-gate.js     JITK_SHARD_BINARY, JITK_SHARD_SNAPSHOT,
//                                      JITK_HVF_SLOTS (default 8)
//
// 1. Idle: every slot parked (a claimed session: its engine process idle on
//    a pristine slot) for 10 s. CPU is `ps` cputime of the zygote and every
//    engine process (10 ms resolution); the gate is below 2% of one core.
// 2. Exchanges: 1000 tool-call round trips through MicroVMExecutor, each
//    checked. A run carries at most IPC.calls (4096 since ABI 11, as G1's
//    libkrun run, so all 1000 fit one run); as in G1 every 100th waits 3 s
//    with its call outstanding (the guest parked in WAIT).
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {MicroVMExecutor,SandboxPool} from './executor.js';
import {ShardBackend} from './shard-backend.js';
import {IPC} from './shard-ipc.js';
import {receiptPath} from './receipt-path.js';
import {hvfGate} from './select-backend.js';

const EXCHANGES=1000,IDLE_S=10,PAUSE_EVERY=100,PAUSE_MS=3000;
const binary=process.env.JITK_SHARD_BINARY,snapshot=process.env.JITK_SHARD_SNAPSHOT;
if(process.platform!=='darwin'||process.arch!=='arm64'||!binary||!snapshot)throw Error('hvf-parking-gate needs macOS arm64, JITK_SHARD_BINARY (the signed hvf engine) and JITK_SHARD_SNAPSHOT');
const slots=Number(process.env.JITK_HVF_SLOTS??8);
// `--if-stale` (make test): keep a receipt select-backend still accepts.
if(process.argv.includes('--if-stale')&&hvfGate(binary,snapshot,slots)){
  console.log('hvf-parking-gate: the receipt for this engine and snapshot is current: '+hvfGate(binary,snapshot,slots)!.evidence);
  process.exit(0);
}
const sha=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex');
const sh=(cmd:string,args:string[])=>execFileSync(cmd,args,{encoding:'utf8'}).trim();
const load=()=>sh('/usr/sbin/sysctl',['-n','vm.loadavg']);
/** cputime seconds of each pid (`ps -o time=`: [[h:]m:]s.cc). */
const cpu=(pids:number[])=>sh('/bin/ps',['-o','time=','-p',pids.join(',')]).split('\n').reduce((n,t)=>n+t.trim().split(':').reduce((a,v)=>a*60+Number(v),0),0);
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const quantile=(v:number[],q:number)=>{const a=[...v].sort((x,y)=>x-y);return a[Math.min(a.length-1,Math.ceil(a.length*q)-1)]!;};

const result:Record<string,unknown>={gate:'G1',engine:'hvf',slots,engine_sha256:sha(binary),snapshot,snapshot_identity_sha256:sha(snapshot+'.identity'),
  macos:sh('/usr/bin/sw_vers',['-productVersion']),load_before:load(),started:new Date().toISOString()};
const backend=new ShardBackend({binary,snapshot,slots});
let exchanges=0;
try {
  await backend.ready;
  const zygote=backend.child.pid!;
  const pids=[zygote,...sh('/usr/bin/pgrep',['-P',String(zygote)]).split('\n').filter(Boolean).map(Number)];
  if(pids.length!==slots+1)throw Error(`expected ${slots} engine processes, found ${pids.length-1}`);
  const parked=await Promise.all(Array.from({length:slots},()=>backend.park()));
  const c0=cpu(pids),t0=performance.now();
  await sleep(IDLE_S*1000);
  const idle=(performance.now()-t0)/1000,used=cpu(pids)-c0;
  Object.assign(result,{idle_seconds:idle,idle_cpu_seconds:used,idle_core_percent:used/idle*100,idle_processes:pids.length});
  for(const s of parked)s.release();
  await Promise.all(parked.map(s=>s.released));

  const pool=new SandboxPool(backend,0,slots);
  // The 07 policy layer's default call budget is 256 per run; G1 is 1000 in one.
  const executor=new MicroVMExecutor(pool,()=> 'allow',60000,{limits:{calls:EXCHANGES}});
  // Each call returns its own argument; the run returns their sum, and the
  // host checks every argument arrives in order.
  const echo=async(x:unknown)=>{
    if(x!==exchanges)throw Error(`exchange ${exchanges}: got ${JSON.stringify(x)}`);
    if(++exchanges%PAUSE_EVERY===0)await sleep(PAUSE_MS);
    return x;
  };
  const walls:number[]=[];
  while(exchanges<EXCHANGES){
    const n=Math.min(IPC.calls,EXCHANGES-exchanges),base=exchanges,t=performance.now();
    const r=await executor.execute(`let s=0;for(let i=0;i<${n};i++)s+=await t.echo(${base}+i);return s;`,[{name:'t',fns:{echo}}]);
    const want=n*base+n*(n-1)/2;
    if(r.error||r.result!==want)throw Error(`run ${walls.length}: ${r.error??JSON.stringify(r.result)} (want ${want})`);
    walls.push(performance.now()-t);await pool.drain();
  }
  await pool.close();
  const unpaused=walls.filter(ms=>ms<PAUSE_MS);
  Object.assign(result,{exchanges,runs:walls.length,calls_per_run:IPC.calls,pause:{every:PAUSE_EVERY,ms:PAUSE_MS},
    run_ms_without_pause:{n:unpaused.length,p50:quantile(unpaused,.5),max:Math.max(...unpaused)}});
  result.status=(result.idle_core_percent as number)<2&&exchanges===EXCHANGES?'PASS':'FAIL';
} catch(e) {
  result.status='FAIL';result.error=(e as Error).message;result.exchanges=exchanges;
} finally {await backend.close();}
result.load_after=load();
result.scope='HVF engine G1 analogue: all slots parked idle, 1000 checked exchanges across ring-profile runs; contended functional gate on a shared machine, not a performance claim.';
const path=receiptPath('hvf-parking-gate.json');
writeFileSync(path,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
if(result.status!=='PASS')process.exitCode=1;
