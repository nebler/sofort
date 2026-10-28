// The native job kind through Engine/Session (R10 W1.2): NativeBackend on a
// stand-in worker (fixtures/native-worker.mjs, the real JNR7 frames), a pool
// and NativeExecutor. Runs on any host; mcp/native-linux-test.mjs covers the
// real `real native-worker` on Linux arm64 KVM.
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {NativeBackend,NativeExecutor,NATIVE_LIMITS,encodeNativeJob,SandboxPool,type NativeResult,type NativeError} from './executor.js';
import type {NativeJob} from './engine.js';
import {jsJob} from './code.js';

const worker=fileURLToPath(new URL('../fixtures/native-worker.mjs',import.meta.url));
const engine=()=>new NativeBackend({binary:process.execPath,prefix:[worker],profiles:{lua:'/prepared/lua',sh:'/prepared/sh'}});
const job=(args:string[],files:Record<string,Uint8Array>={},profile='lua'):NativeJob=>({kind:'native',profile,args,files});
const ok=(r:NativeResult|NativeError):NativeResult=>{assert(!('error' in r),JSON.stringify(r));return r;};
const code=(r:NativeResult|NativeError)=>'error' in r?r.error.code:'OK';
let checks=0;

// JNR7 framing and job validation (formerly mcp/native-test.mjs).
const wire=encodeNativeJob(job(['-e','print(2)'],{'data/binary':Buffer.from([0,255,128])}));
assert.equal(wire.readUInt32LE(),wire.length-4);assert.equal(wire.subarray(4,8).toString(),'JNR7');checks++;
for(const bad of [job([],{},'../bad'),job(['a\0b']),job(['\ud800']),job(Array(32).fill('x')),job(['x'.repeat(8192)]),
  ...['../a','/a','a//b','a\0b','\udc00'].map(p=>job([],{[p]:new Uint8Array(1)})),
  job([],Object.fromEntries(Array.from({length:65},(_,i)=>[`f${i}`,new Uint8Array(0)]))),
  job([],{a:new Uint8Array(NATIVE_LIMITS.inputBytes+1)})]){
  assert.throws(()=>encodeNativeJob(bad),/args|argv|path|profile|files|input/);checks++;
}

{
  const b=engine();
  assert.equal(b.kind,'native');assert.equal(b.limits.sessions,1);assert.equal(b.limits.js,undefined);
  assert.deepEqual(b.limits.native?.profiles,['lua','sh']);checks++;
  const pool=new SandboxPool(b,0,b.limits.sessions),ex=new NativeExecutor(pool,2000);
  assert.equal(pool.refillConcurrency,1);checks++;
  try {
    let r=ok(await ex.run(job(['echo','a','b'],{'data/in':Buffer.from([1,0,255])})));
    assert.equal(Buffer.from(r.stdout).toString(),'a b');assert.deepEqual([...r.stderr],[1,0,255]);
    assert.equal(r.exitCode,3);assert.equal(r.outputLimited,false);checks++;
    r=ok(await ex.run(job(['big'])));assert.equal(r.stdout.length,NATIVE_LIMITS.outputBytes);assert.equal(r.outputLimited,true);checks++;
    // One worker, one session: concurrent runs queue in FIFO order (the worker
    // used to answer LIMIT "busy").
    const order:number[]=[];
    const all=await Promise.all([0,1,2].map(i=>ex.run(job(['delay','30',String(i)])).then(r=>{order.push(i);return r;})));
    assert.deepEqual(all.map(r=>Buffer.from(ok(r).stdout).toString()),['30 0','30 1','30 2']);assert.deepEqual(order,[0,1,2]);checks++;
    // Refused before the worker: unknown profile, bad path.
    assert.equal(code(await ex.run(job([],{},'absent'))),'UNSUPPORTED');checks++;
    assert.equal(code(await ex.run(job([],{'../escape':new Uint8Array(1)}))),'LIMIT');checks++;
    // A worker-reported failure ends the run only.
    const failed=await ex.run(job(['fail']));assert.equal(code(failed),'SANDBOX');assert.match((failed as NativeError).error.message,/slot failure/);
    assert.equal(code(await ex.run(job(['echo','again']))),'OK');checks++;
    // A JS job on the native engine fails before the worker sees it.
    const s=await pool.acquire(undefined,Date.now()+1000);
    await assert.rejects(()=>s.start(jsJob('return 1',[])),/native jobs only/);await pool.release(s);
    assert.equal(code(await ex.run(job(['echo']))),'OK');checks++;
    // The deadline kills the whole worker; later runs report it stopped.
    const t=await ex.run(job(['hang']),{timeout:150});assert.equal(code(t),'TIMEOUT',JSON.stringify(t));
    const after=await ex.run(job(['echo']));assert.equal(code(after),'SANDBOX');assert.match((after as NativeError).error.message,/stopped/);checks++;
  } finally {await pool.close();}
  assert.equal(pool.snapshot().tokens,0);checks++;
}
{
  // Cancellation mid-run stops the worker; a queued caller is rejected too.
  const b=engine(),pool=new SandboxPool(b,0,1),ex=new NativeExecutor(pool,2000),ac=new AbortController();
  try {
    const running=ex.run(job(['hang']),{signal:ac.signal}),queued=ex.run(job(['echo']));
    setTimeout(()=>ac.abort(),50);
    assert.equal(code(await running),'CANCELLED');assert.equal(code(await queued),'SANDBOX');checks++;
  } finally {await pool.close();}
}
{
  // A malformed response kills the worker, not the host.
  const b=engine(),pool=new SandboxPool(b,0,1),ex=new NativeExecutor(pool,2000);
  try {
    const r=await ex.run(job(['garbage']));assert.equal(code(r),'SANDBOX');assert.match((r as NativeError).error.message,/response length/);checks++;
  } finally {await pool.close();}
}
console.log(JSON.stringify({suite:'native',checks,status:'PASS'}));
