import assert from 'node:assert/strict';
import {ProtocolError} from '../protocol/dispatcher.js';
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {helperHash,fileHash} from './prepared-helpers.mjs';
import {ShardBackend,type ShardMetrics} from './shard-backend.js';
import {SharedChannel,IPC,monotonicNs,type Message} from './shard-ipc.js';
import {MicroVMExecutor} from './executor.js';
import {SandboxPool,OverloadedError} from './pool.js';
import {transportChecks} from './shard-ipc-check.js';
import {sourceChecks} from './shard-source-check.js';

const binary=process.env.JITK_SHARD_BINARY!,snapshot=process.env.JITK_SHARD_SNAPSHOT!;
if(process.platform!=='linux'||!binary||!snapshot)throw Error('shard-check needs Linux, JITK_SHARD_BINARY and JITK_SHARD_SNAPSHOT');
let assertions=transportChecks()+await sourceChecks();
function check(value:unknown,message:string){assert.ok(value,message);assertions++;console.log(JSON.stringify({event:'check',name:message}));}
const metrics:ShardMetrics[]=[];
const backend=new ShardBackend({binary,snapshot,slots:8,onMetrics:m=>metrics.push(m)});
backend.child.stderr!.on('data',(b:Buffer)=>process.stderr.write(b));
const pool=new SandboxPool(backend,0,8,{refillConcurrency:8});
const executor=new MicroVMExecutor(pool,()=> 'allow',5000);
const execute=async(code:string,fns:Record<string,(...a:any[])=>Promise<any>>={})=>{const result=await executor.execute(code,fns);await pool.drain();return result;};
try {
  let r=await execute('return 2');check(!r.error&&r.result===2,'return2');
  r=await execute('return await codemode.echo(41)',{echo:async x=>x+1});check(!r.error&&r.result===42,'Node provider reply replaces synthetic echo');
  for(const name of ['tools','run','__jitk_ring_custom']){r=await executor.execute(`return await ${name}.echo(3)`,[{name,fns:{echo:async x=>Number(x)+1}}]);await pool.drain();check(!r.error&&r.result===4,'provider namespace '+name);}
  r=await execute('throw null');check(!!r.error&&r.error.includes('Error: null'),'primitive thrown values');
  r=await execute('codemode.echo();return 2',{echo:async()=>{await new Promise(resolve=>setTimeout(resolve,10));return 1;}});check(!!r.error&&r.error.includes('unawaited calls at completion'),'unawaited calls cannot return success');
  let active=0,maxActive=0;
  r=await execute('return await Promise.all(Array.from({length:10},(_,i)=>codemode.echo(i)))',{echo:async x=>{maxActive=Math.max(maxActive,++active);await new Promise(resolve=>setTimeout(resolve,(10-x)*2));active--;return x*2;}});
  assert.deepEqual(r.result,Array.from({length:10},(_,i)=>i*2));check(!r.error&&maxActive===10,'out-of-order concurrent tool replies');
  r=await execute('return await codemode.echo("Grüße 😀")',{echo:async x=>x});check(!r.error&&r.result==='Grüße 😀','scalar Unicode');
  r=await execute('return String.raw`Grüße 😀`');check(!r.error&&r.result==='Grüße 😀','raw Unicode source semantics');
  r=await execute('const v=await codemode.echo(new Uint8Array([0,127,128,255]));return Array.from(v)',{echo:async x=>{assert.ok(x instanceof Uint8Array);return x;}});assert.deepEqual(r.result,[0,127,128,255]);check(!r.error,'codemode binary round trip');
  r=await execute('try{await codemode.fail()}catch(e){return [e.code,e.message]}',{fail:async()=>{throw Error('provider failure');}});check(!r.error&&JSON.stringify(r.result)==='["TOOL_ERROR","Error: provider failure"]','structured tool errors');
  const denied=new MicroVMExecutor(pool,()=> 'deny',5000);
  r=await denied.execute('try{await codemode.echo(1)}catch(e){return e.code}',{echo:async()=>{throw Error('must not invoke');}});await pool.drain();check(!r.error&&r.result==='DENIED','policy denial delivered to guest');
  r=await execute('console.log("hello",2);console.warn("warning");return 7');check(!r.error&&r.result===7&&JSON.stringify(r.logs)==='["hello 2","[warn] warning"]','console logs');
  r=await execute('return await codemode.large()',{large:async()=> 'x'.repeat(2000)});check(!!r.error&&r.error.includes('shard tool reply limit'),'bounded oversized reply is an explicit error');
  r=await execute('return await Promise.all(Array.from({length:33},()=>codemode.echo()))',{echo:async()=>0});check(!!r.error&&r.error.includes('call budget'),'32-call ring budget');
  r=await execute('const a='+JSON.stringify('x'.repeat(8000))+';return a.length');check(!!r.error&&r.error.includes('shard source limit'),'source admission bound');
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
  {
    const nest=(k:number)=>'['.repeat(k)+'0'+']'.repeat(k);
    const raw=(fd:number,text:string)=>`const b=new Uint8Array(${JSON.stringify([...Buffer.from(text,'latin1')])});os.write(${fd},b.buffer,0,b.length);return await new Promise(()=>{});`;
    const ns=[{name:'ns',fns:{fn:async(x:unknown)=>x}}];
    const pid=backend.child.pid;
    let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
    const sibling=executor.execute('return await codemode.wait(7)',{wait:async x=>{await gate;return x;}});
    r=await executor.execute(`return await ns.fn(${nest(30)})`,ns);
    check(!r.error&&JSON.stringify(r.result)===nest(30),'R9 82-byte depth-32 call is valid input');
    for(const [name,code,expected] of [
      ['depth-33 array',`return await ns.fn(${nest(31)})`,/protocol DEPTH/],
      ['depth-33 object',`return await ns.fn(${'{"a":'.repeat(31)}0${'}'.repeat(31)})`,/protocol DEPTH/],
      ['unsafe number','return await ns.fn(2**60)',/protocol NUMBER/],
      ['lone surrogate','return await ns.fn("\\ud800")',/protocol UNICODE/],
      ['raw invalid JSON call',raw(129,'[bad]'),/protocol JSON/],
      ['raw control-byte call',raw(129,'["call","ns","fn",["\x01"]]'),/guest_protocol/],
      ['raw non-ASCII call',raw(129,'["call","ns","fn",["\xff"]]'),/guest_protocol/],
      ['raw log with unknown level',raw(129,'["log","trace","x"]'),/protocol SCHEMA/],
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
  const env=readFileSync(`/proc/${backend.child.pid}/environ`,'utf8');check(env==='PATH=/usr/bin:/bin\0','shard has no inherited credentials/environment');
  // Block Node across the lease deadline. The watchdog must reset independently.
  const sandbox=await backend.park();await sandbox.armDeadline!(Date.now()+120);
  const before=metrics.length;
  await sandbox.send({t:'run',code:'while(true){}',ns:{}});
  const blockUntil=performance.now()+300;while(performance.now()<blockUntil){}
  await assert.rejects(sandbox.read(),/deadline_exceeded/);assertions++;
  const deadline=metrics.slice(before).find(m=>m.resetDoneNs>0n);check(!!deadline,'watchdog reset receipt while Node was blocked');
  check(deadline!.resetDoneNs>=deadline!.deadlineNs&&deadline!.resetDoneNs-deadline!.deadlineNs<50000000n,'responsive-owner deadline reset within 50 ms (nested)');
  sandbox.kill();await sandbox.exited;
  r=await execute('return 42');check(!r.error&&r.result===42,'clean reuse after expiry');
} finally {await pool.close();}

// Exercise environment selection through the same MCP core used by execute.
{
  const previous=process.env.JITK_BACKEND;process.env.JITK_BACKEND='shard';
  const {createJitk}=await import(new URL('../../mcp/jitk.mjs',import.meta.url).href);
  const core=await createJitk({warm:0,maxLive:2,timeoutMs:5000,tools:{tools:{echo:{args:(a:unknown[])=>a,reads:'public',egress:false,writes:false,timeoutMs:1000,invoke:async(a:number[])=>a[0]+1,output:(v:unknown)=>v}}}});
  try{await core.warmed;const r=await core.run('return await tools.echo(41)');check(r.result===42&&!r.error,'JITK_BACKEND=shard through MCP core');}
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
    const next=one.park();held.kill();const s=await next;
    check((s as any).slot===0&&(s as any).generation===2n,'reset slot hands off to the head park() waiter');
    s.kill();await s.exited;
    const pool1=new SandboxPool(one,0,1),ex1=new MicroVMExecutor(pool1,()=> 'allow',5000);let errors=0;
    // No drain(): the R9 probe shape that used to hit 'pool saturated' ~12x/run.
    for(let i=0;i<50;i++){const r=await ex1.execute('return 2',{});if(r.error||r.result!==2)errors++;}
    await pool1.drain();check(errors===0,'sequential executor on 1 shard slot: 50 runs, no admission error');
    const busy=await one.park(),waiting=one.park().then(()=>undefined,(e:Error)=>e);await queued();
    await one.close();check(/shard backend closed/.test(String(await waiting)),'shard death rejects queued park() waiters');busy.kill();
  } finally {await one.close();}
}

// Node treats the shard as hostile: private-copy validation, cursor bounds,
// generations, schemas, direction and duplicate identity must all fail closed.
const scratch=mkdtempSync(join(tmpdir(),'jitk-ipc-test-'));
const peer=join(scratch,'peer');
// Hostile peers have dummy but internally consistent offline identities. This
// keeps real snapshot validation enabled on every ShardBackend construction.
function peerSnapshot(mode:string) {
  const base=join(scratch,mode);
  for(const ext of ['mem','regs','layout'])writeFileSync(base+'.'+ext,'fixture');
  writeFileSync(base+'.identity',JSON.stringify({version:1,helperSha256:helperHash,files:Object.fromEntries(['mem','regs','layout'].map(ext=>[ext,fileHash(base+'.'+ext)]))}));
  return base;
}
const fixture=fileURLToPath(new URL('../.work/bin/fixtures/shard-peer',import.meta.url));
writeFileSync(peer,`#!/bin/sh\nexec '${fixture.replaceAll("'","'\\''")}' "$@"\n`,{mode:0o755});
try {
  const startup=new ShardBackend({binary:peer,snapshot:peerSnapshot('no-ready'),slots:1,owners:1});
  const startupPool=new SandboxPool(startup,0,1);
  try{const r=await new MicroVMExecutor(startupPool,()=> 'allow',20).execute('return 1',{});check(r.error==='Execution aborted or timed out','abort escapes stalled shard startup');}
  finally{await startupPool.close();}
  const stalled=new ShardBackend({binary:peer,snapshot:peerSnapshot('backpressure'),slots:1,owners:1});
  const stalledPool=new SandboxPool(stalled,0,1);
  const stalledExecutor=new MicroVMExecutor(stalledPool,()=> 'allow',100);
  try {
    for(let i=0;i<32;i++){const r=await stalledExecutor.execute('return 1',{});check(!r.error&&r.result===1,'hostile peer fills TX credits');await stalledPool.drain();}
    const r=await stalledExecutor.execute('return 1',{});check(r.error==='Execution aborted or timed out','abort escapes blocked admission write');
  } finally {await stalledPool.close();}
  for(const mode of ['producer','consumer','length','reserved','slot','generation','kind','identity','duplicate','json','nonascii','completion','stats']) {
    const hostile=new ShardBackend({binary:peer,snapshot:peerSnapshot(mode),slots:1,owners:1});
    try {
      const started=performance.now();
      const s=await hostile.park();await s.armDeadline!(Date.now()+3000);await s.send({t:'run',code:'return 1',ns:{tools:['echo']}});
      // The duplicate case may deliver its first valid call before poisoning the batch.
      await assert.rejects((async()=>{for(let i=0;i<3;i++)await s.read();})(),e=>e instanceof ProtocolError||(e instanceof Error&&((e as any).code==='SHARD_IPC'||/^(shard IPC|protocol )/.test(e.message))));assertions++;
      check(performance.now()-started<2000,`Node promptly rejects hostile ${mode}`);
    } finally {await hostile.close();}
  }
} finally {rmSync(scratch,{recursive:true,force:true});}

// Rust service admission validation: each case is a separate offline fixture
// process, never a per-call execution helper.
for(const mode of ['kind','slot','generation','source-length','source-encoding','calls','memory','deadline','reply','cancel','replay']) {
  let resolveReady!:()=>void,failReady!:(e:Error)=>void;
  const ready=new Promise<void>((resolve,reject)=>{resolveReady=resolve;failReady=reject;});
  const channel=new SharedChannel(m=>{if(m.kind===IPC.ready)resolveReady();},e=>failReady(e));
  const child=spawn(binary,['ipc',snapshot,'1','1'],{stdio:['ignore','ignore','pipe',...channel.fds],env:{PATH:'/usr/bin:/bin'}});
  child.stderr!.resume();
  const closed=new Promise<number|null>(resolve=>child.once('close',code=>resolve(code)));
  const timer=setTimeout(()=>{child.kill('SIGKILL');failReady(Error('malformed-case timeout'));},3000);
  try {
    await ready;
    const bytes=Buffer.alloc(24);bytes.writeBigUInt64LE(monotonicNs()+1000000000n);bytes.writeUInt32LE(32,8);bytes.writeUInt32LE(1024,12);bytes.writeUInt32LE(2*1048576,20);
    let m:Message={kind:IPC.start,slot:0,generation:1n,id:0,bytes};
    if(mode==='kind')m.kind=IPC.done;
    if(mode==='slot')m.slot=63;
    if(mode==='generation')m.generation=2n;
    if(mode==='source-length')bytes.writeUInt32LE(0xffffffff,16);
    if(mode==='source-encoding'){m.bytes=Buffer.concat([bytes,Buffer.from([255])]);m.bytes.writeUInt32LE(1,16);}
    if(mode==='calls')bytes.writeUInt32LE(33,8);
    if(mode==='memory')bytes.writeUInt32LE(4*1048576,20);
    if(mode==='deadline')bytes.writeBigUInt64LE(monotonicNs()+61000000000n);
    if(mode==='reply'){m.kind=IPC.reply;m.id=1;m.bytes=Buffer.from('{"ok":"\xff"}','latin1');}
    if(mode==='cancel'){m.kind=IPC.cancel;m.generation=2n;m.bytes=Buffer.alloc(0);}
    await channel.send(m);
    if(mode==='replay')await channel.send(m);
    const code=await closed;check(code!==0&&code!==null,`Rust rejects malformed ${mode}`);
  } finally {clearTimeout(timer);child.kill('SIGKILL');channel.close();await closed;}
}
// Exercise ring wrap and bidirectional pressure beyond the 64-record capacity.
{
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
console.log(JSON.stringify({suite:'shard',assertions,metrics:metrics.length,status:'PASS'}));
