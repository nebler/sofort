// The ring engine's own suite, on either host: the KVM shard on Linux, the
// HVF engine on macOS arm64 (shard/src/hvf/zygote.rs; one confined process
// per slot). Sections that exercise one transport (the memfd queues and their
// hostile peer fixture on Linux; engine processes on macOS) say so.
import assert from 'node:assert/strict';
import {copyFileSync,mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync,spawn,type ChildProcess} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {IDENTITY_VERSION,helperHash,fileHash} from './prepared-helpers.mjs';
import {ABI_VERSION,ARENA_CLASSES} from './abi.js';
import {DEFAULT_SHARD_CLASS,ShardBackend,type ShardMetrics,type ShardQuarantine,type ShardRestore,type ShardSession} from './shard-backend.js';
import {ShardSet} from './shard-set.js';
import {PipeChannel,SharedChannel,IPC,monotonicNs,type Channel,type Message} from './shard-ipc.js';
import {MicroVMExecutor} from './executor.js';
import {SandboxPool,OverloadedError} from './pool.js';
import {hvfGate} from './select-backend.js';
import {transportChecks} from './shard-ipc-check.js';
import {sourceChecks} from './shard-source-check.js';

const binary=process.env.JITK_SHARD_BINARY!,snapshot=process.env.JITK_SHARD_SNAPSHOT!;
const linux=process.platform==='linux',hvf=process.platform==='darwin'&&process.arch==='arm64';
if(!(linux||hvf)||!binary||!snapshot)throw Error('shard-check needs Linux (KVM) or macOS arm64 (HVF), JITK_SHARD_BINARY and JITK_SHARD_SNAPSHOT');
let assertions=(linux?transportChecks():0)+await sourceChecks();
/** The engine's IPC child processes (HVF: the zygote's engine processes, one per slot). */
const children=(pid:number)=>{try{return execFileSync('/usr/bin/pgrep',['-P',String(pid)],{encoding:'utf8'}).trim().split('\n').filter(Boolean).map(Number);}catch{return [];}};
/** HVF: the zygote's one child is its template, which forks every engine process (shard/src/hvf/template.rs). */
const engines=(pid:number)=>(hvf?children(pid).flatMap(children):children(pid)).sort((a,b)=>a-b);
/** Start the engine binary on this host's transport, as ShardBackend does. */
function engine(args:string[],receive:(m:Message)=>void,failed:(e:Error)=>void):{child:ChildProcess;channel:Channel} {
  if(linux){
    const channel=new SharedChannel(receive,failed);
    return {channel,child:spawn(binary,args,{stdio:['ignore','ignore','pipe',...channel.fds],env:{PATH:'/usr/bin:/bin'}})};
  }
  const child=spawn(binary,args,{stdio:['ignore','ignore','pipe','pipe'],env:{PATH:'/usr/bin:/bin'}});
  return {child,channel:new PipeChannel(child.stdio[3] as import('node:stream').Duplex,receive,failed)};
}
function check(value:unknown,message:string){assert.ok(value,message);assertions++;console.log(JSON.stringify({event:'check',name:message}));}
const metrics:ShardMetrics[]=[];
const backend=new ShardBackend({binary,snapshot,slots:8,onMetrics:m=>metrics.push(m)});
backend.child.stderr!.on('data',(b:Buffer)=>process.stderr.write(b));
const pool=new SandboxPool(backend,0,8,{refillConcurrency:8});
const executor=new MicroVMExecutor(pool,()=> 'allow',5000);
const execute=async(code:string,fns:Record<string,(...a:any[])=>Promise<any>>={})=>{const result=await executor.execute(code,fns);await pool.drain();return result;};
try {
  // Guest semantics and limits shared with the other backends (results, Unicode,
  // bytes, tool errors, denial, logs, reply/call/source bounds, hostile JSON) are
  // parity corpus cases (parity/cases.ts, `make test-linux`). This suite keeps what
  // only the shard has: restore, slot concurrency, failure domains, IPC peers.
  let active=0,maxActive=0;
  let r=await execute('return await Promise.all(Array.from({length:10},(_,i)=>codemode.echo(i)))',{echo:async x=>{maxActive=Math.max(maxActive,++active);await new Promise(resolve=>setTimeout(resolve,(10-x)*2));active--;return x*2;}});
  assert.deepEqual(r.result,Array.from({length:10},(_,i)=>i*2));check(!r.error&&maxActive===10,'out-of-order concurrent tool replies');
  r=await execute('globalThis.__jitkPrepared.codec.marker=42;globalThis.btoa=()=>"poison";globalThis.helperCanary=42;return 1');
  check(!r.error&&r.result===1,'tenant can mutate prepared helper/global');
  r=await execute('return [globalThis.__jitkPrepared.codec.marker===undefined,btoa("a"),typeof globalThis.helperCanary]');
  check(!r.error&&JSON.stringify(r.result)==='[true,"YQ==","undefined"]','next generation restores pristine helper/global');
  const randoms=new Set();
  for(let i=0;i<5;i++){r=await execute('if(globalThis.tenant)throw Error("leak");globalThis.tenant=1;return Math.random()');check(!r.error&&typeof r.result==='number','fresh restore');randoms.add(r.result);}
  check(randoms.size===5,'distinct restored Math.random');
  const results=await Promise.all(Array.from({length:8},(_,i)=>executor.execute(`return await codemode.echo(${i})`,{echo:async x=>x})));
  await pool.drain();check(results.every((r,i)=>!r.error&&r.result===i),'eight concurrent generations');
  // R9 N1: guest payloads that Node rejects fail only their own sandbox. A sibling
  // on the same shard holds a tool call open across all of them, then completes.
  // The JSON-level cases (depth 32/33, unsafe number, lone surrogate) are
  // parity corpus cases; these raw ring writes exist only on the shard.
  {
    const raw=(fd:number,text:string)=>`const b=new Uint8Array(${JSON.stringify([...Buffer.from(text,'latin1')])});os.write(${fd},b.buffer,0,b.length);return await new Promise(()=>{});`;
    const ns=[{name:'ns',fns:{fn:async(x:unknown)=>x}}];
    const pid=backend.child.pid;
    let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
    const sibling=executor.execute('return await codemode.wait(7)',{wait:async x=>{await gate;return x;}});
    for(const [name,code,expected] of [
      ['raw invalid JSON call',raw(129,'[bad]'),/protocol JSON/],
      ['raw control-byte call',raw(129,'["call","ns","fn",["\x01"]]'),/guest_protocol/],
      ['raw non-ASCII call',raw(129,'["call","ns","fn",["\xff"]]'),/guest_protocol/],
      ['raw log as a call',raw(129,'["log","log","x"]'),/protocol SCHEMA/],
      ['raw log with unknown level',raw(103,'["trace","x"]'),/protocol SCHEMA/],
      ['raw non-ASCII log',raw(103,'["log","\xff"]'),/guest_protocol/],
      ['raw non-object DONE',raw(102,'[1]'),/protocol SCHEMA/],
      ['raw DONE with smuggled frame type',raw(102,'{"t":"call","ok":1}'),/protocol SCHEMA/],
    ] as const){
      r=await executor.execute(code,ns);
      check(!!r.error&&expected.test(r.error),`hostile ${name} fails only its own sandbox`);
    }
    release();const done=await sibling;
    check(!done.error&&done.result===7,'sibling on the same shard completes after every hostile run');
    check(backend.child.pid===pid&&backend.child.exitCode===null&&backend.child.signalCode===null,'shard process survives hostile payloads');
    r=await execute('return 2');check(!r.error&&r.result===2,'shard serves new runs after hostile payloads');
  }
  let issued=0,revoked=0;
  const privateExecutor=new MicroVMExecutor(pool,()=> 'allow',5000,{issuer:{issue:async()=>{issued++;return 'HOST_ONLY_TEST_TOKEN';},revoke:async()=>{revoked++;}},tools:{codemode:{secret:{args:a=>a,reads:'private',egress:false,writes:false,timeoutMs:1000,invoke:async(_a,credential)=>{assert.equal(credential,'HOST_ONLY_TEST_TOKEN');return 'private result';},output:v=>v}}}});
  r=await privateExecutor.execute('return await codemode.secret()',{secret:async()=>null});await pool.drain();check(!r.error&&r.result==='private result'&&issued===1&&revoked===1,'canonical policy owns issuance/revocation');
  if(linux){const env=readFileSync(`/proc/${backend.child.pid}/environ`,'utf8');check(env==='PATH=/usr/bin:/bin\0','shard has no inherited credentials/environment');}
  else for(const pid of [backend.child.pid!,...engines(backend.child.pid!)]){
    // ps -E appends the environment to the command line.
    const line=execFileSync('/bin/ps',['-E','-o','command=','-p',String(pid)],{encoding:'utf8'}).trim();
    check(line.endsWith(' PATH=/usr/bin:/bin')&&!/ HOME=| USER=| TMPDIR=/.test(line),`engine process ${pid} has no inherited credentials/environment`);
  }
  // Block Node across the lease deadline. The watchdog must reset independently.
  const sandbox=await backend.park();await sandbox.armDeadline!(Date.now()+120);
  const before=metrics.length;
  await sandbox.start({kind:'js',source:'async()=>{while(true){}}',tools:{},prelude:''});
  const blockUntil=performance.now()+300;while(performance.now()<blockUntil){}
  {const ev=await sandbox.next();assert.ok(ev.kind==='fail'&&ev.cause==='deadline'&&/deadline_exceeded/.test(ev.message),JSON.stringify(ev));assertions++;}
  const deadline=metrics.slice(before).find(m=>m.resetDoneNs>0n);check(!!deadline,'watchdog reset receipt while Node was blocked');
  check(deadline!.resetDoneNs>=deadline!.deadlineNs&&deadline!.resetDoneNs-deadline!.deadlineNs<50000000n,`responsive-owner deadline reset within 50 ms (${linux?'nested':'HVF'})`);
  sandbox.release();await sandbox.released;
  r=await execute('return 42');check(!r.error&&r.result===42,'clean reuse after expiry');
} finally {await pool.close();}

// Memory classes (../shard/README.md "Limits"). The code-mode shape, a 512 KiB
// tool result read and a small answer returned, is a clean out-of-memory
// LIMIT on the glue-2m class and works on the larger ones, where a
// 320 KiB value also round-trips (reply in, completion out). glue-8m and
// glue-16m also read a 1,152 KiB tool result (over the 1 MiB frame of
// glue-2m/4m; glue-8m's heap holds 1,227 KiB) and refuse one past their class
// reply bound. STATS
// reports each run's heap high-water within the class's arena. Each class's
// snapshot: JITK_SHARD_SNAPSHOT_GLUE_<N>M, else the jitk cache's.
{
  const deps=fileURLToPath(new URL('../../tools/.work/bin/deps',import.meta.url));
  const classSnapshot=(c:string)=>process.env['JITK_SHARD_SNAPSHOT_'+c.toUpperCase().replace('-','_')]||execFileSync(deps,['path','JITK_SHARD_SNAPSHOT'],{encoding:'utf8',env:{...process.env,JITK_SHARD_SNAPSHOT:'',JITK_SHARD_CLASS:c}}).trim();
  const large=classSnapshot('glue-4m');
  const {errorClass}=await import(new URL('../../mcp/jitk.mjs',import.meta.url).href);
  /** A tool result whose reply JSON ({"ok":...}) is `bytes` long. */
  const value=(bytes:number,fill:string)=>{const v={rows:Array.from({length:8},(_,id)=>({id,ok:true})),text:''};v.text=fill.repeat(bytes-JSON.stringify({ok:v}).length);assert.equal(JSON.stringify({ok:v}).length,bytes);return v;};
  const read=value(512*1024,'x'),echoed=value(320*1024,'y'),page=value(1152*1024,'z');
  const digest='const r=await codemode.big();return [r.rows.length,r.text.length,r.text.slice(-2)]';
  const classes=[['glue-2m',classSnapshot('glue-2m')],['glue-4m',large],['glue-8m',classSnapshot('glue-8m')],['glue-16m',classSnapshot('glue-16m')]] as const;
  for(const [memoryClass,base] of classes){
    const heaps:number[]=[];
    const b=new ShardBackend({binary,snapshot:base,slots:1,owners:1,memoryClass,onMetrics:m=>heaps.push(m.heapPeakBytes)});
    const p=new SandboxPool(b,0,1),x=new MicroVMExecutor(p,()=> 'allow',10000);
    const run=async(code:string,fns:Record<string,()=>Promise<unknown>>={})=>{heaps.length=0;const r=await x.execute(code,fns);await p.drain();return r;};
    const cls=ARENA_CLASSES[memoryClass];
    try{
      check(b.memoryClass===memoryClass&&b.limits.memoryMB===cls.admissionBytes>>20&&b.limits.js?.arenaBytes===cls.arenaBytes&&b.limits.js?.replyBytes===cls.replyBytes,`${memoryClass}: limits of its class`);
      let r=await run(digest,{big:async()=>read});
      if(memoryClass==='glue-2m')check(!!r.error&&/out of memory/.test(r.error)&&errorClass(r)==='LIMIT',`glue-2m: a 512 KiB tool result is a clean LIMIT (${r.error})`);
      else{
        check(!r.error&&JSON.stringify(r.result)===JSON.stringify([8,read.text.length,'xx']),`${memoryClass}: a 512 KiB tool result is read (${r.error??'ok'})`);
        check(heaps.length===1&&heaps[0]!>512*1024&&heaps[0]!<=cls.arenaBytes,`${memoryClass}: STATS heap high-water above the reply, within the arena (${heaps})`);
        r=await run('return await codemode.big()',{big:async()=>echoed});
        check(!r.error&&JSON.stringify(r.result)===JSON.stringify(echoed),`${memoryClass}: a 320 KiB value round-trips (${r.error??'ok'})`);
      }
      if(cls.replyBytes>1<<20){
        r=await run(digest,{big:async()=>page});
        check(!r.error&&JSON.stringify(r.result)===JSON.stringify([8,page.text.length,'zz']),`${memoryClass}: a 1,152 KiB tool result is read (${r.error??'ok'})`);
        // As on the console path, a host reply over the frame fails its run.
        r=await run(digest,{big:async()=>value(cls.replyBytes+1,'w')});
        check(!!r.error&&/FRAME_LIMIT/.test(r.error),`${memoryClass}: a reply past the class bound (${cls.replyBytes} bytes) fails its run (${r.error})`);
      }
      r=await run('return 2');check(!r.error&&r.result===2,`${memoryClass}: the slot serves the next run`);
    }finally{await p.close();}
  }
  // The backend runs only the class it was given (default DEFAULT_SHARD_CLASS).
  assert.throws(()=>new ShardBackend({binary,snapshot:large,slots:1,owners:1}),new RegExp(`shard snapshot is glue-4m, not the selected ${DEFAULT_SHARD_CLASS}`));assertions++;
}

// Exercise environment selection through the same MCP core used by execute.
{
  const kind=linux?'shard':'hvf';
  const previous=process.env.JITK_BACKEND;process.env.JITK_BACKEND=kind;
  const {createJitk}=await import(new URL('../../mcp/jitk.mjs',import.meta.url).href);
  const core=await createJitk({warm:0,maxLive:2,timeoutMs:5000,tools:{tools:{echo:{args:(a:unknown[])=>a,reads:'public',egress:false,writes:false,timeoutMs:1000,invoke:async(a:number[])=>a[0]+1,output:(v:unknown)=>v}}}});
  try{await core.warmed;const r=await core.run('return await tools.echo(41)');check(r.result===42&&!r.error,`JITK_BACKEND=${kind} through MCP core`);}
  finally{await core.close();if(previous===undefined)delete process.env.JITK_BACKEND;else process.env.JITK_BACKEND=previous;}
}

// Admission waits instead of shedding: park() queues behind a resetting slot,
// is bounded, abortable, and a dead shard rejects its waiters.
{
  const one=new ShardBackend({binary,snapshot,slots:1,owners:1,maxWaiting:1});
  try {
    const held=await one.park(),ac=new AbortController(),queued=()=>new Promise(r=>setImmediate(r));
    const aborted=one.park(ac.signal);await queued();
    await assert.rejects(one.park(),e=>e instanceof OverloadedError&&e.code==='OVERLOADED');assertions++;
    ac.abort();await assert.rejects(aborted,/aborted/);assertions++;
    const next=one.park();held.release();const s=await next;
    check((s as any).slot===0&&(s as any).generation===2n,'reset slot hands off to the head park() waiter');
    s.release();await s.released;
    const pool1=new SandboxPool(one,0,1),ex1=new MicroVMExecutor(pool1,()=> 'allow',5000);let errors=0;
    // No drain(): the R9 probe shape that used to hit 'pool saturated' ~12x/run.
    for(let i=0;i<50;i++){const r=await ex1.execute('return 2',{});if(r.error||r.result!==2)errors++;}
    await pool1.drain();check(errors===0,'sequential executor on 1 shard slot: 50 runs, no admission error');
    const busy=await one.park(),waiting=one.park().then(()=>undefined,(e:Error)=>e);await queued();
    await one.close();check(/shard backend closed/.test(String(await waiting)),'shard death rejects queued park() waiters');busy.release();
  } finally {await one.close();}
}

// A shard set: one engine process per slot here. Runs use every process at
// once; a killed engine fails only its own run and is replaced; an engine that
// cannot start fails the set after STARTUP_FAILURES instead of respawning.
{
  const set=new ShardSet({binary,snapshot,slots:3,slotsPerProcess:1});
  const spool=new SandboxPool(set,0,3,{refillConcurrency:3}),sex=new MicroVMExecutor(spool,()=> 'allow',10000);
  try {
    await set.ready;
    const first=set.processes.map(p=>p.child.pid);
    check(first.length===3&&new Set(first).size===3,'shard set: three engine processes of one slot');
    let started=0,all!:()=>void,open!:()=>void;
    const allStarted=new Promise<void>(r=>{all=r;}),gate=new Promise<void>(r=>{open=r;});
    const wait=async()=>{if(++started===3)all();await gate;return 1;};
    const runs=[0,1,2].map(()=>sex.execute('return await codemode.wait()',{wait}));
    await allStarted;
    check(set.processes.every(p=>p.free===0),'shard set: three concurrent runs take one slot in each process');
    const victim=set.processes[0];
    const gone=new Promise(r=>victim.child.once('close',r));victim.child.kill('SIGKILL');await gone;open();
    const rs=await Promise.all(runs);await spool.drain();
    check(rs.filter(r=>r.error).length===1&&rs.filter(r=>!r.error&&r.result===1).length===2,'shard set: a killed engine fails only its own run: '+JSON.stringify(rs.map(r=>r.error??r.result)));
    await set.processes[0].ready;
    check(set.processes[0]!==victim&&!first.includes(set.processes[0].child.pid),'shard set: the killed engine is replaced by a new process');
    const again=await Promise.all([1,2,3].map(i=>sex.execute(`return ${i}`,{})));
    check(again.every((r,i)=>!r.error&&r.result===i+1),'shard set: all three slots serve after the replacement');
  } finally {await spool.close();await set.close();}
  const reaped=set.processes.map(p=>p.child).every(c=>c.exitCode!==null||c.signalCode!==null);
  check(reaped,'shard set: close() reaps every engine process');
  // A set runs one shard's owner threads, split across its engines (at least
  // one each), not a whole shard's per engine: 8 x 8 ran 32 on 6 cores.
  const argvOwners=(p:ShardBackend)=>Number(readFileSync(`/proc/${p.child.pid}/cmdline`,'utf8').split('\0').filter(Boolean).at(-1));
  if(linux)for(const [slots,slotsPerProcess,owners,want] of [[8,4,undefined,[2,2]],[64,8,undefined,Array(8).fill(1)],[8,4,3,[3,3]],[3,2,undefined,[2,1]]] as const){
    const split=new ShardSet({binary,snapshot,slots,slotsPerProcess,owners});
    try{await split.ready;check(JSON.stringify(split.processes.map(argvOwners))===JSON.stringify(want),`shard set: ${slots} slots by ${slotsPerProcess}${owners?`, ${owners} owners`:''} run ${want.join('+')} owner threads`);}
    finally{await split.close();}
  }
  const bad=new ShardSet({binary:'/nonexistent/jitk-engine',snapshot,slots:2,slotsPerProcess:1});
  await assert.rejects(bad.ready);
  for(let i=0;i<100&&!/keeps failing/.test(String(await bad.park().catch(e=>e)));i++)await new Promise(r=>setTimeout(r,20));
  await assert.rejects(bad.park(),/keeps failing at startup/);await bad.close();
  check(true,'shard set: an engine that cannot start fails the set');
}

// Node treats the shard as hostile: private-copy validation, cursor bounds,
// generations, schemas, direction and duplicate identity must all fail closed.
// Linux: the hostile peer fixture speaks the memfd queues. (The macOS
// PipeChannel decodes with the same message() envelope check.)
if(linux){
const scratch=mkdtempSync(join(tmpdir(),'jitk-ipc-test-'));
const peer=join(scratch,'peer');
// Hostile peers have dummy but internally consistent offline identities. This
// keeps real snapshot validation enabled on every ShardBackend construction.
function peerSnapshot(mode:string) {
  const base=join(scratch,mode);
  for(const ext of ['mem','regs'])writeFileSync(base+'.'+ext,'fixture');
  // The class record Node reads (shard-backend.ts snapshotClass): the real snapshot's.
  copyFileSync(snapshot+'.layout',base+'.layout');
  writeFileSync(base+'.identity',JSON.stringify({version:IDENTITY_VERSION,abiVersion:ABI_VERSION,helperSha256:helperHash,files:Object.fromEntries(['mem','regs','layout'].map(ext=>[ext,fileHash(base+'.'+ext)]))}));
  return base;
}
const fixture=fileURLToPath(new URL('../.work/bin/fixtures/shard-peer',import.meta.url));
writeFileSync(peer,`#!/bin/sh\nexec '${fixture.replaceAll("'","'\\''")}' "$@"\n`,{mode:0o755});
try {
  const startup=new ShardBackend({binary:peer,snapshot:peerSnapshot('no-ready'),slots:1,owners:1});
  const startupPool=new SandboxPool(startup,0,1);
  try{const r=await new MicroVMExecutor(startupPool,()=> 'allow',20).execute('return 1',{});check(r.error==='Execution aborted or timed out','abort escapes stalled shard startup');}
  finally{await startupPool.close();}
  // A shard announcing another ABI version in READY is refused, not used.
  const otherAbi=new ShardBackend({binary:peer,snapshot:peerSnapshot('bad-abi'),slots:1,owners:1});
  const otherAbiPool=new SandboxPool(otherAbi,0,1);
  try{
    const refused=await otherAbi.ready.then(()=>undefined,(e:Error)=>e);
    check(refused?.message.includes(`shard ABI version ${ABI_VERSION+1} does not match the executor's ABI version ${ABI_VERSION}`),'READY with another ABI version is refused');
    const r=await new MicroVMExecutor(otherAbiPool,()=> 'allow',1000).execute('return 1',{});check(r.error!==undefined&&r.result===undefined,'no execution on a refused shard');
  } finally{await otherAbiPool.close();}
  const stalled=new ShardBackend({binary:peer,snapshot:peerSnapshot('backpressure'),slots:1,owners:1});
  const stalledPool=new SandboxPool(stalled,0,1);
  const stalledExecutor=new MicroVMExecutor(stalledPool,()=> 'allow',100);
  try {
    for(let i=0;i<32;i++){const r=await stalledExecutor.execute('return 1',{});check(!r.error&&r.result===1,'hostile peer fills TX credits');await stalledPool.drain();}
    const r=await stalledExecutor.execute('return 1',{});check(r.error==='Execution aborted or timed out','abort escapes blocked admission write');
  } finally {await stalledPool.close();}
  // QUARANTINED: Node stops counting the slot, reports it, and fails the shard
  // once no slot is left (the peer quarantines every slot it resets).
  {
    const lost:ShardQuarantine[]=[];
    const q=new ShardBackend({binary:peer,snapshot:peerSnapshot('quarantine'),slots:2,owners:1,onQuarantine:x=>lost.push(x)});
    const qPool=new SandboxPool(q,0,2);
    try {
      const r=await new MicroVMExecutor(qPool,()=> 'allow',2000).execute('return 1',{});await qPool.drain();
      check(!r.error&&r.result===1,'a run whose reset quarantines its slot still completes');
      check(lost.length===1&&lost[0].slot===0&&lost[0].reason==='reset failed: fixture'&&lost[0].lost===1&&lost[0].slots===2,'QUARANTINED reaches onQuarantine with its reason and lost capacity');
      check(q.capacity.lost===1,'backend capacity counts the quarantined slot');
      const s=await q.park();check((s as any).slot===1,'a quarantined slot is never claimed again');
      s.release();await s.released;
      check(q.capacity.lost===2&&lost.length===2,'second quarantine reported');
      await assert.rejects(q.park(),/shard capacity lost: all 2 slots quarantined/);assertions++;
    } finally {await qPool.close();}
  }
  for(const mode of ['producer','consumer','length','reserved','slot','generation','kind','identity','duplicate','json','nonascii','completion','stats']) {
    const hostile=new ShardBackend({binary:peer,snapshot:peerSnapshot(mode),slots:1,owners:1});
    try {
      const started=performance.now();
      const s=await hostile.park();await s.armDeadline!(Date.now()+3000);await s.start({kind:'js',source:'async()=>1',tools:{tools:['echo']},prelude:''});
      // The duplicate case may deliver its first valid call before poisoning the batch.
      {let ev=await s.next();for(let i=0;i<2&&ev.kind!=='fail';i++)ev=await s.next();assert.ok(ev.kind==='fail'&&/IPC|^protocol /.test(ev.message),mode+': '+JSON.stringify(ev));assertions++;}
      check(performance.now()-started<2000,`Node promptly rejects hostile ${mode}`);
    } finally {await hostile.close();}
  }
} finally {rmSync(scratch,{recursive:true,force:true});}
}

// HVF: every slot is a process the zygote supervises. A dead engine process
// takes only its slot out of service (its run fails as engine, its reset is
// QUARANTINED with the reason) until the zygote has re-forked it (RESTORED);
// a run whose process cannot stop at its deadline is killed by the zygote
// (escalation); a crash loop fails the engine; close() reaps them all.
if(hvf){
  const until=async(what:string,done:()=>boolean,ms=3000)=>{
    const end=Date.now()+ms;
    while(!done()){if(Date.now()>end)throw Error('timed out waiting for '+what);await new Promise(r=>setTimeout(r,10));}
  };
  const lost:ShardQuarantine[]=[],back:ShardRestore[]=[];
  const two=new ShardBackend({binary,snapshot,slots:2,onQuarantine:q=>lost.push(q),onRestore:r=>back.push(r)});
  try {
    await two.ready;
    const zygote=two.child.pid!,children=engines(zygote);
    check(children.length===2,'one engine process per slot');
    assert.throws(()=>(two as any).receive({kind:IPC.restored,slot:1,generation:1n,id:0,bytes:Buffer.alloc(0)}),/restore schema\/state/);
    check(two.capacity.lost===0,'RESTORED for a slot that is not quarantined is a shard contract violation');
    // A stopped engine process cannot kick its own vCPU: the zygote kills it
    // ESCALATION (100 ms) after the deadline and reports a deadline.
    const s=await two.park() as ShardSession;await s.armDeadline!(Date.now()+100);
    const t=performance.now();
    await s.start({kind:'js',source:'async()=>{while(true){}}',tools:{},prelude:''});
    await new Promise(r=>setTimeout(r,20));
    for(const pid of children)process.kill(pid,'SIGSTOP');
    const ev=await s.next();const waited=performance.now()-t;
    for(const pid of engines(zygote))process.kill(pid,'SIGCONT');
    check(ev.kind==='fail'&&ev.cause==='deadline'&&/engine process killed/.test(ev.message),'zygote escalation kills a stuck engine process: '+JSON.stringify(ev));
    check(waited>=100&&waited<1000,`escalation after the deadline plus 100 ms (${waited.toFixed(0)} ms)`);
    const t0=performance.now();
    s.release();await s.released;
    check(lost.length===1&&lost[0].slot===s.slot&&/engine process exited \(signal 9\)/.test(lost[0].reason),'the killed slot is QUARANTINED with its reason: '+JSON.stringify(lost.map(q=>q.reason)));
    // The zygote re-forks it from the snapshot; RESTORED gives the capacity back.
    await until('RESTORED',()=>back.length===1);
    const restoreMs=performance.now()-t0;
    check(back[0].slot===s.slot&&back[0].generation===s.generation&&back[0].lost===0&&two.capacity.lost===0,'the quarantined slot is RESTORED at its generation: '+JSON.stringify(back.map(r=>({...r,generation:String(r.generation)}))));
    const respawned=engines(zygote);
    check(respawned.length===2&&respawned.filter(pid=>!children.includes(pid)).length===1,`the killed engine process is reaped and replaced (restored in ${restoreMs.toFixed(1)} ms)`);
    // Both slots serve, the restored one included.
    const pool2=new SandboxPool(two,0,2),ex2=new MicroVMExecutor(pool2,()=> 'allow',5000);
    const both=await Promise.all([1,2].map(i=>ex2.execute(`return await codemode.echo(${i})`,{echo:async x=>{await new Promise(r=>setTimeout(r,20));return x;}})));await pool2.drain();
    check(both.every((r,i)=>!r.error&&r.result===i+1),'the restored slot and its sibling serve at once: '+JSON.stringify(both));
    // An engine process that dies while its slot is idle is re-forked before
    // Node needs it: no run fails, nothing is quarantined.
    const before=engines(zygote);
    process.kill(before[0]!,'SIGKILL');
    await until('idle re-fork',()=>{const now=engines(zygote);return now.length===2&&!now.includes(before[0]!);});
    const again=await Promise.all([3,4].map(i=>ex2.execute(`return ${i}`,{})));await pool2.drain();
    check(again.every((r,i)=>!r.error&&r.result===i+3)&&lost.length===1&&two.capacity.lost===0,'an engine process that dies while idle is replaced silently: '+JSON.stringify(again));
    await pool2.close();
  } finally {await two.close();}
  // A crash loop fails the engine closed instead of re-forking forever: one
  // slot gets restore_budget(1) = 4 re-forks per 60 s (shard/src/hvf/zygote.rs).
  {
    const one=new ShardBackend({binary,snapshot,slots:1});
    let stderr='';one.child.stderr!.on('data',(b:Buffer)=>{stderr+=b;});
    const exited=new Promise<void>(resolve=>one.child.once('close',()=>resolve()));
    try {
      await one.ready;
      const zygote=one.child.pid!;
      let killed=0,pid=engines(zygote)[0]!;
      while(one.child.exitCode===null&&one.child.signalCode===null&&killed<10){
        process.kill(pid,'SIGKILL');killed++;
        await until('re-fork or failure',()=>{const now=engines(zygote);return one.child.exitCode!==null||(now.length===1&&now[0]!==pid);}).catch(()=>{});
        await new Promise(r=>setTimeout(r,20));
        pid=one.child.exitCode===null?engines(zygote)[0]!:pid;
      }
      await exited;
      check(killed===5&&/crash loop/.test(stderr),`a crash loop fails the engine after ${killed} kills: ${stderr.trim()}`);
      await assert.rejects(one.park(),/shard IPC closed by the engine|sandbox exited: shard/);assertions++;
    } finally {await one.close();}
  }
  // Warm parking (hvf-parking-gate.ts): select-backend takes a gate receipt
  // only for the engine binary and snapshot it measured, with at least the
  // slots asked for. The receipts here are synthetic test inputs in a
  // scratch directory, never a receipt path the executor reads.
  {
    const dir=mkdtempSync(join(tmpdir(),'jitk-hvf-gate-')),path=join(dir,'gate.json');
    const sha=(p:string)=>execFileSync('/usr/bin/shasum',['-a','256',p],{encoding:'utf8'}).split(' ')[0];
    const receipt={engine:'hvf',status:'PASS',exchanges:1000,idle_core_percent:0,slots:8,engine_sha256:sha(binary),snapshot_identity_sha256:sha(snapshot+'.identity')};
    const saved=process.env.JITK_HVF_PARKING_GATE;
    try {
      process.env.JITK_HVF_PARKING_GATE=path;
      const gate=(r:object,slots=8)=>{writeFileSync(path,JSON.stringify(r));return hvfGate(binary,snapshot,slots);};
      check(gate(receipt)?.evidence===path,'a matching HVF gate receipt is accepted');
      check(!gate({...receipt,engine_sha256:'0'.repeat(64)})&&!gate({...receipt,snapshot_identity_sha256:'0'.repeat(64)})&&!gate(receipt,9)&&
        !gate({...receipt,idle_core_percent:2})&&!gate({...receipt,exchanges:999})&&!gate({...receipt,status:'FAIL'}),
        'another engine, snapshot, more slots, 2% idle, fewer exchanges or a FAIL is not');
      // Parked HVF sessions serve as unparked ones do.
      const g=gate(receipt)!;
      const warm=new ShardBackend({binary,snapshot,slots:2});
      const wpool=new SandboxPool(warm,2,2,{parkingGate:g}),wex=new MicroVMExecutor(wpool,()=> 'allow',5000);
      try {
        await wpool.warm();
        check(wpool.snapshot().parked===2,'the warm pool parks both HVF slots');
        const rs=await Promise.all([5,6].map(i=>wex.execute(`return await codemode.echo(${i})`,{echo:async x=>x})));
        check(rs.every((r,i)=>!r.error&&r.result===i+5),'parked HVF sessions run: '+JSON.stringify(rs));
      } finally {await wpool.close();await warm.close();}
    } finally {
      if(saved===undefined)delete process.env.JITK_HVF_PARKING_GATE;else process.env.JITK_HVF_PARKING_GATE=saved;
      rmSync(dir,{recursive:true,force:true});
    }
  }
  // close() lets the zygote reap its engine processes: none is left behind.
  const three=new ShardBackend({binary,snapshot,slots:3});
  await three.ready;const pids=engines(three.child.pid!);await three.close();
  const alive=pids.filter(pid=>{try{process.kill(pid,0);return true;}catch{return false;}});
  check(pids.length===3&&alive.length===0,'close() leaves no engine process behind');
}

// Rust service admission validation: each case is a separate offline fixture
// process, never a per-call execution helper.
for(const mode of ['kind','slot','generation','source-length','source-encoding','calls','memory','deadline','reply','cancel','replay']) {
  let resolveReady!:()=>void,failReady!:(e:Error)=>void;
  const ready=new Promise<void>((resolve,reject)=>{resolveReady=resolve;failReady=reject;});
  const {child,channel}=engine(linux?['ipc',snapshot,'1','1']:['ipc',snapshot,'1'],m=>{if(m.kind===IPC.ready)resolveReady();},e=>failReady(e));
  child.stderr!.resume();
  const closed=new Promise<number|null>(resolve=>child.once('close',code=>resolve(code)));
  const timer=setTimeout(()=>{child.kill('SIGKILL');failReady(Error('malformed-case timeout'));},3000);
  try {
    await ready;
    const bytes=Buffer.alloc(24);bytes.writeBigUInt64LE(monotonicNs()+1000000000n);bytes.writeUInt32LE(IPC.calls,8);bytes.writeUInt32LE(IPC.callBytes,12);bytes.writeUInt32LE(2*1048576,20);
    let m:Message={kind:IPC.start,slot:0,generation:1n,id:0,bytes};
    if(mode==='kind')m.kind=IPC.done;
    if(mode==='slot')m.slot=63;
    if(mode==='generation')m.generation=2n;
    if(mode==='source-length')bytes.writeUInt32LE(0xffffffff,16);
    if(mode==='source-encoding'){m.bytes=Buffer.concat([bytes,Buffer.from([255])]);m.bytes.writeUInt32LE(1,16);}
    if(mode==='calls')bytes.writeUInt32LE(IPC.calls+1,8);
    if(mode==='memory')bytes.writeUInt32LE(4*1048576,20);
    if(mode==='deadline')bytes.writeBigUInt64LE(monotonicNs()+61000000000n);
    if(mode==='reply'){m.kind=IPC.reply;m.id=1;m.bytes=Buffer.from('{"ok":"\xff"}','latin1');}
    if(mode==='cancel'){m.kind=IPC.cancel;m.generation=2n;m.bytes=Buffer.alloc(0);}
    await channel.send(m);
    if(mode==='replay')await channel.send(m);
    const code=await closed;check(code!==0&&code!==null,`Rust rejects malformed ${mode}`);
  } finally {clearTimeout(timer);child.kill('SIGKILL');channel.close();await closed;}
}
// Exercise ring wrap and bidirectional pressure beyond the 64-record capacity
// (Linux: the memfd queues and the shard's ipc-probe).
if(linux){
  let resolveReady!:()=>void,resolveAll!:()=>void,rejectAll!:(e:Error)=>void;
  const ready=new Promise<void>(resolve=>{resolveReady=resolve;});
  const all=new Promise<void>((resolve,reject)=>{resolveAll=resolve;rejectAll=reject;});let received=0;
  const channel=new SharedChannel(m=>{if(m.kind===IPC.ready){resolveReady();return;}assert.equal(m.kind,IPC.ping);assert.equal(m.id,++received);assert.equal(m.bytes.length,1024);if(received===2048)resolveAll();},()=>{});
  const child=spawn(binary,['ipc-probe','echo'],{stdio:['ignore','ignore','pipe',...channel.fds],env:{PATH:'/usr/bin:/bin'}});child.stderr!.resume();
  const closed=new Promise<void>(resolve=>child.once('close',()=>resolve()));
  const timer=setTimeout(()=>{child.kill('SIGKILL');rejectAll(Error('IPC pressure test timeout'));},5000);
  try{await ready;await Promise.all(Array.from({length:2048},(_,i)=>channel.send({kind:IPC.ping,slot:0,generation:0n,id:i+1,bytes:Buffer.alloc(1024,i%256)})));await all;check(received===2048,'shared-memory wrap and backpressure');}
  finally{clearTimeout(timer);child.kill('SIGKILL');channel.close();await closed;}
}
console.log(JSON.stringify({suite:linux?'shard':'hvf',assertions,metrics:metrics.length,status:'PASS'}));
