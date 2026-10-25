// Pure adapter semantics; real QuickJS coverage lives in shard-check.ts.
import assert from 'node:assert/strict';
import {executionBody} from './code.js';
import {shardSource} from './shard-backend.js';
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
export async function sourceChecks():Promise<number> {
  let checks=0;
  for(const name of ['tools','run','__jitk_ring_custom']){
    const code=executionBody(`return [await ${name}.echo("Grüße 😀"),String.raw\`Grüße 😀\`]`,[{name,fns:{echo:async()=>null}}]);
    const source=shardSource({t:'run',code,ns:{[name]:['echo']}});
    assert.ok(!/[^\x00-\x7f]/.test(source));
    const result=await new AsyncFunction('tools','run',source)({echo:async(kind:string,ns:string,fn:string,args:unknown[])=>{assert.equal(kind,'call');assert.equal(ns,name);assert.equal(fn,'echo');return {ok:args[0]};}},{});
    assert.deepEqual(result,['Grüße 😀','Grüße 😀']);checks++;
  }
  const primitive=shardSource({t:'run',code:executionBody('throw null',[]),ns:{}});
  await assert.rejects(new AsyncFunction('tools','run',primitive)({},{}),{name:'Error',message:'null'});checks++;
  const pending=shardSource({t:'run',code:executionBody('codemode.echo();return 2',[{name:'codemode',fns:{echo:async()=>null}}]),ns:{codemode:['echo']}});
  await assert.rejects(new AsyncFunction('tools','run',pending)({echo:async()=>{await new Promise(resolve=>setImmediate(resolve));return {ok:1};}},{}),{name:'Error',message:'unawaited calls at completion'});checks++;
  assert.throws(()=>shardSource({t:'run',code:' '.repeat(8192),ns:{}}),/source limit/);checks++;
  return checks;
}
if(process.argv[1]?.endsWith('shard-source-check.js'))console.log(JSON.stringify({suite:'shard-source',checks:await sourceChecks(),status:'PASS'}));
