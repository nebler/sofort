import assert from 'node:assert/strict';
import {HyperlightBackend} from './backend.ts';
import {MicroVMExecutor,SandboxPool} from '../../executor/build/executor.js';
import {hyperlightConfig,testPrerequisite} from './config.ts';
const skip=testPrerequisite();
if(skip){console.log('SKIP: '+skip);process.exit(0);}
const {worker,snapshot}=hyperlightConfig();
const backend=new HyperlightBackend(worker,snapshot);
// Runtime integration with 04's built integrated executor; truthful benchmark kind.
const pool=new SandboxPool(backend,0,1),ex=new MicroVMExecutor(pool,call=>call.fn==='deny'?'deny':'allow',3000);
const providers=[{name:'test',fns:{echo:async x=>x,deny:async()=>{throw Error('should never dispatch');}}}];
let checks=0;
async function execute(...args) {
  // E4 resolves before reap; a capacity-1 sequential conformance test waits
  // for its explicit admission token between independent runs.
  const end=performance.now()+5000;
  while(pool.snapshot().tokens){if(performance.now()>end)throw Error('reap timeout');await new Promise(r=>setTimeout(r,1));}
  return ex.execute(...args);
}
try {
  let r=await execute('return 2',providers);assert.equal(r.error,undefined);assert.equal(r.result,2);checks++;
  r=await execute('return await test.echo(2)',providers);assert.equal(r.error,undefined);assert.equal(r.result,2);checks++;
  r=await execute('return await Promise.all(Array.from({length:10},(_,i)=>test.echo(i)))',providers);
  assert.equal(r.error,undefined);assert.deepEqual(r.result,Array.from({length:10},(_,i)=>i));checks++;
  r=await execute('try{await test.deny()}catch(e){return e.message}',providers);assert.equal(r.error,undefined);assert.match(r.result,/policy denied/);checks++;
  r=await execute('globalThis.leak=42;return 1',providers);assert.equal(r.result,1);
  r=await execute('return typeof globalThis.leak',providers);assert.equal(r.result,'undefined');checks++;
  r=await execute('while(true){}',providers,{timeout:100});assert.match(r.error,/timed out/);checks++;
}finally{await pool.close();}
console.log(JSON.stringify({checks,status:'PASS',pool:pool.snapshot()}));
