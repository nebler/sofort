// The native job kind through Engine/Session (R10 W1.2): NativeBackend on a
// stand-in worker (fixtures/native-worker.mjs, the real JNR8 frames), a pool
// and NativeExecutor: framing, the worker's own deadline, and bounded worker
// recovery. Runs on any host; mcp/native-linux-test.mjs covers the real
// `real native-worker` (Linux arm64 KVM) and `hvf native-worker` (macOS).
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {NativeBackend,NativeExecutor,NATIVE_LIMITS,encodeNativeJob,SandboxPool,type NativeOptions,type NativeResult,type NativeError} from './executor.js';
import {MAX_BUDGET_MS,NATIVE_RESTARTS} from './native-backend.js';
import type {NativeJob} from './engine.js';
import {jsJob} from './code.js';

const worker=fileURLToPath(new URL('../fixtures/native-worker.mjs',import.meta.url));
const engine=(o:Partial<NativeOptions>={})=>new NativeBackend({binary:process.execPath,prefix:[worker],profiles:{lua:'/prepared/lua',sh:'/prepared/sh'},...o});
const job=(args:string[],files:Record<string,Uint8Array>={},profile='lua'):NativeJob=>({kind:'native',profile,args,files});
const ok=(r:NativeResult|NativeError):NativeResult=>{assert(!('error' in r),JSON.stringify(r));return r;};
const code=(r:NativeResult|NativeError)=>'error' in r?r.error.code:'OK';
const message=(r:NativeResult|NativeError)=>'error' in r?r.error.message:'';
const pid=async(ex:NativeExecutor)=>Number(Buffer.from(ok(await ex.run(job(['pid']))).stdout).toString());
const delay=(ms:number)=>new Promise(r=>setTimeout(r,ms));
let checks=0;

// JNR8 framing and job validation (formerly mcp/native-test.mjs).
const wire=encodeNativeJob(job(['-e','print(2)'],{'data/binary':Buffer.from([0,255,128])}),NATIVE_LIMITS,250);
assert.equal(wire.readUInt32LE(),wire.length-4);assert.equal(wire.subarray(4,8).toString(),'JNR8');assert.equal(wire.readUInt32LE(8),250);
assert.equal(encodeNativeJob(job([])).readUInt32LE(8),MAX_BUDGET_MS);checks++;
for(const budget of [0,-1,1.5,MAX_BUDGET_MS+1])assert.throws(()=>encodeNativeJob(job([]),NATIVE_LIMITS,budget),/budget/);checks++;
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
    // A worker-reported failure ends the run only: a job failure.
    const first=b.pid;
    const failed=await ex.run(job(['fail']));assert.equal(code(failed),'SANDBOX');assert.match(message(failed),/^native job failed: slot failure/);
    assert.equal(code(await ex.run(job(['echo','again']))),'OK');checks++;
    // A JS job on the native engine fails before the worker sees it.
    const s=await pool.acquire(undefined,Date.now()+1000);
    await assert.rejects(()=>s.start(jsJob('return 1',[])),/native jobs only/);await pool.release(s);
    assert.equal(code(await ex.run(job(['echo']))),'OK');checks++;
    // The worker stops a run at its budget itself and stays: TIMEOUT, same worker.
    const t=await ex.run(job(['spin']),{timeout:150});assert.equal(code(t),'TIMEOUT',JSON.stringify(t));
    assert.equal(await pid(ex),first);assert.equal(b.pid,first);checks++;
  } finally {await pool.close();}
  assert.equal(pool.snapshot().tokens,0);assert.equal(b.pid,undefined);checks++;
}
{
  // A worker silent past its deadline and grace is stopped; the next run gets a new one.
  const b=engine({deadlineGraceMs:100}),pool=new SandboxPool(b,0,1),ex=new NativeExecutor(pool,2000);
  try {
    const first=await pid(ex),started=Date.now();
    const t=await ex.run(job(['hang']),{timeout:150});assert.equal(code(t),'TIMEOUT',JSON.stringify(t));
    assert(Date.now()-started<1000,'TIMEOUT at the deadline, not after the grace');
    const second=await pid(ex);assert.notEqual(second,first);checks++;
    // A worker that dies mid-run fails that run as an engine failure, then restarts.
    const crashed=await ex.run(job(['crash']));assert.equal(code(crashed),'SANDBOX');
    assert.match(message(crashed),/native engine failed \(native worker exited\); the worker restarts/);
    assert.notEqual(await pid(ex),second);checks++;
    // A malformed response stops the worker, not the host.
    const r=await ex.run(job(['garbage']));assert.equal(code(r),'SANDBOX');assert.match(message(r),/response length/);
    assert.equal(code(await ex.run(job(['echo']))),'OK');checks++;
  } finally {await pool.close();}
}
{
  // Cancellation mid-run ends that run at once; the worker finishes it within its
  // budget and stays, so the queued caller runs on the same worker and repeated
  // cancels never spend the restart budget (or lock other callers out).
  const b=engine({restarts:{max:2,windowMs:60000}}),pool=new SandboxPool(b,0,1),ex=new NativeExecutor(pool,2000);
  const holding=async()=>{for(const end=Date.now()+10000;;await new Promise(r=>setImmediate(r))){
    const p=pool.snapshot();if(p.live===1&&p.creating===0&&p.waiting===1)return;
    assert(Date.now()<end,'the job never started: '+JSON.stringify(p));}};
  try {
    const first=b.pid;
    for(let i=0;i<6;i++){
      const ac=new AbortController(),started=Date.now();
      const running=ex.run(job(['spin']),{signal:ac.signal,timeout:200}),queued=ex.run(job(['pid']));
      await holding();ac.abort();
      assert.equal(code(await running),'CANCELLED');assert(Date.now()-started<150,'cancel returns at once');
      assert.equal(Number(Buffer.from(ok(await queued).stdout).toString()),first);
    }
    assert.equal(b.pid,first);checks++;
    // A cancelled run whose worker then misses its deadline is still stopped.
    const ac=new AbortController(),running=ex.run(job(['hang']),{signal:ac.signal,timeout:150}),queued=ex.run(job(['pid']));
    await holding();ac.abort();assert.equal(code(await running),'CANCELLED');
    const next=Number(Buffer.from(ok(await queued).stdout).toString());assert(next>0&&next!==first);checks++;
  } finally {await pool.close();}
}
{
  // A crash loop spends the restart budget: the engine is unavailable until
  // the window passes, then serves again.
  assert.deepEqual(NATIVE_RESTARTS,{max:5,windowMs:60000});
  const b=engine({restarts:{max:2,windowMs:600}}),pool=new SandboxPool(b,0,1),ex=new NativeExecutor(pool,2000);
  try {
    for(let i=0;i<3;i++)assert.match(message(await ex.run(job(['crash']))),/native engine failed/);
    const down=await ex.run(job(['echo']));assert.equal(code(down),'SANDBOX');
    assert.match(message(down),/native engine unavailable: 2 worker restarts within 0.6 s \(last: native worker exited\); retry in 1 s/);
    assert.equal(b.pid,undefined);
    await delay(650);
    assert.equal(code(await ex.run(job(['echo']))),'OK');checks++;
  } finally {await pool.close();}
}
console.log(JSON.stringify({suite:'native',checks,status:'PASS'}));
