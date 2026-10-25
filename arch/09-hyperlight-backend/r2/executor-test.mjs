import assert from 'node:assert/strict';
import {HyperlightBackend} from './backend.ts';
import {MicroVMExecutor,SandboxPool} from '../../04-executor-ts/r2/build/executor.js';
const backend=new HyperlightBackend('/tmp/jitk-09/adapter-target/release/r2-worker','/tmp/jitk-09/r2-snapshot');
// Runtime integration with 04's unchanged executor. Its product-only TS kind
// union needs 'hyperlight-js' added for a statically typed baseline selector.
const pool=new SandboxPool(backend,0,1),ex=new MicroVMExecutor(pool,call=>call.fn==='deny'?'deny':'allow',3000);
const providers=[{name:'test',fns:{echo:async x=>x,deny:async()=>{throw Error('should never dispatch');}}}];
let checks=0;
try {
  let r=await ex.execute('return 2',providers);assert.equal(r.error,undefined);assert.equal(r.result,2);checks++;
  r=await ex.execute('return await test.echo(2)',providers);assert.equal(r.error,undefined);assert.equal(r.result,2);checks++;
  r=await ex.execute('return await Promise.all(Array.from({length:10},(_,i)=>test.echo(i)))',providers);
  assert.equal(r.error,undefined);assert.deepEqual(r.result,Array.from({length:10},(_,i)=>i));checks++;
  r=await ex.execute('try{await test.deny()}catch(e){return e.message}',providers);assert.equal(r.error,undefined);assert.match(r.result,/policy denied/);checks++;
  r=await ex.execute('globalThis.leak=42;return 1',providers);assert.equal(r.result,1);
  r=await ex.execute('return typeof globalThis.leak',providers);assert.equal(r.result,'undefined');checks++;
  r=await ex.execute('while(true){}',providers,{timeout:100});assert.match(r.error,/timed out/);checks++;
}finally{await pool.close();}
console.log(JSON.stringify({checks,status:'PASS',pool:pool.snapshot()}));
