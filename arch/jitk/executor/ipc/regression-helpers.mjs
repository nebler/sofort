// Run unchanged against the old and new executor builds / matching snapshots.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {MicroVMExecutor,SandboxPool,ShardBackend}=await import(pathToFileURL(process.env.JITK_REGRESSION_BUILD).href);
const binary=process.env.JITK_SHARD_BINARY,snapshot=process.env.JITK_SHARD_SNAPSHOT;
let failures=0;
async function test(name,fn){try{await fn();console.log(JSON.stringify({name,status:'PASS'}));}catch(e){failures++;console.log(JSON.stringify({name,status:'FAIL',error:String(e)}));}}
await test('stale helper identity rejected at load',async()=>{
 let stale;
 try{assert.throws(()=>{stale=new ShardBackend({binary,snapshot:process.env.JITK_STALE_SNAPSHOT,slots:1,owners:1});},/stale shard snapshot: prepared helper identity mismatch/);}
 finally{await stale?.close();}
});
await test('same slot restores mutated helper and global',async()=>{
 const backend=new ShardBackend({binary,snapshot,slots:1,owners:1}),pool=new SandboxPool(backend,0,1);
 const ex=new MicroVMExecutor(pool,()=> 'allow',5000);
 try{
  const first=await ex.execute('globalThis.__jitkPrepared.codec.marker=42;globalThis.btoa=()=>"poison";globalThis.helperCanary=42;return 1',{});
  await pool.drain();assert.equal(first.error,undefined);assert.equal(first.result,1);
  const next=await ex.execute('return [globalThis.__jitkPrepared.codec.marker===undefined,btoa("a"),typeof globalThis.helperCanary]',{});
  await pool.drain();assert.equal(next.error,undefined);assert.deepEqual(next.result,[true,'YQ==','undefined']);
 } finally {await pool.close();}
});
process.exitCode=failures?1:0;
