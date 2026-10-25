import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {ShardBackend,type ShardMetrics} from './shard-backend.js';
import {SharedChannel,IPC,monotonicNs,type Message} from './shard-ipc.js';
import {MicroVMExecutor} from './executor.js';
import {SandboxPool} from './pool.js';
import {transportChecks} from './shard-ipc-check.js';
import {sourceChecks} from './shard-source-check.js';

const binary=process.env.JITK_SHARD_BINARY!,snapshot=process.env.JITK_SHARD_SNAPSHOT!;
if(process.platform!=='linux'||!binary||!snapshot)throw Error('shard-check needs Linux, JITK_SHARD_BINARY and JITK_SHARD_SNAPSHOT');
let assertions=transportChecks()+await sourceChecks();
function check(value:unknown,message:string){assert.ok(value,message);assertions++;}
const metrics:ShardMetrics[]=[];
const backend=new ShardBackend({binary,snapshot,slots:8,onMetrics:m=>metrics.push(m)});
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
  r=await execute(' '.repeat(8000)+'return 1');check(!!r.error&&r.error.includes('shard source limit'),'source admission bound');
  const randoms=new Set();
  for(let i=0;i<5;i++){r=await execute('if(globalThis.tenant)throw Error("leak");globalThis.tenant=1;return Math.random()');check(!r.error&&typeof r.result==='number','fresh restore');randoms.add(r.result);}
  check(randoms.size===5,'distinct restored Math.random');
  const results=await Promise.all(Array.from({length:8},(_,i)=>executor.execute(`return await codemode.echo(${i})`,{echo:async x=>x})));
  await pool.drain();check(results.every((r,i)=>!r.error&&r.result===i),'eight concurrent generations');
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

// Node treats the shard as hostile: private-copy validation, cursor bounds,
// generations, schemas, direction and duplicate identity must all fail closed.
const scratch=mkdtempSync(join(tmpdir(),'jitk-ipc-test-'));
const peer=join(scratch,'peer');
const fixture=fileURLToPath(new URL('../fixtures/shard-peer.py',import.meta.url));
writeFileSync(peer,`#!/bin/sh\nexec /usr/bin/python3 '${fixture.replaceAll("'","'\\''")}' "$@"\n`,{mode:0o755});
try {
  for(const mode of ['producer','consumer','length','reserved','slot','generation','kind','identity','duplicate','json','nonascii','completion','stats']) {
    const hostile=new ShardBackend({binary:peer,snapshot:mode,slots:1,owners:1});
    try {
      const started=performance.now();
      const s=await hostile.park();await s.armDeadline!(Date.now()+3000);await s.send({t:'run',code:'return 1',ns:{tools:['echo']}});
      // The duplicate case may deliver its first valid call before poisoning the batch.
      await assert.rejects((async()=>{for(let i=0;i<3;i++)await s.read();})(),/shard|protocol/);assertions++;
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
    if(mode==='reply'){m.kind=IPC.reply;m.id=1;m.bytes=Buffer.from('{"ok":0,"ok":1}');}
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
