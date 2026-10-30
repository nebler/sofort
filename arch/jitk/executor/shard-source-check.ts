// Pure adapter semantics; real QuickJS coverage lives in shard-check.ts.
import assert from 'node:assert/strict';
import {executionBody,jsJob} from './code.js';
import {helperSource} from './prepared-helpers.mjs';
import {shardSource} from './shard-backend.js';
import {IPC} from './abi.js';
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
/** The ring bootstrap's run of a START source (kernel/ring-bootstrap.js.in):
 *  the text before the first NUL is the body, the rest its `data`. Its
 *  json(text) completions come back parsed, as FINISH would write them. */
function ring(source:string,tools:object):Promise<unknown> {
  const at=source.indexOf('\0');
  assert.ok(at>0,'the run body and the tenant code are separated by NUL');
  return new AsyncFunction('tools','run','data','"use strict";\n'+source.slice(0,at))({json:(text:string)=>JSON.parse(text),...tools},{},source.slice(at+1));
}
export async function sourceChecks():Promise<number> {
  new Function(helperSource)();
  let checks=0;
  for(const name of ['tools','run','__jitk_ring_custom']){
    const code=executionBody(jsJob(`return [await ${name}.echo("Grüße 😀"),String.raw\`Grüße 😀\`]`,[{name,fns:{echo:async()=>null}}]),true);
    const source=shardSource(code,[name]);
    // The adapter is ASCII; the tenant code travels as its own UTF-8 text.
    assert.ok(!/[^\x00-\x7f]/.test(source.slice(0,source.indexOf('\0'))));
    const result=await ring(source,{echo:async(kind:string,ns:string,fn:string,args:unknown[])=>{assert.equal(kind,'call');assert.equal(ns,name);assert.equal(fn,'echo');return {ok:args[0]};}});
    assert.deepEqual(result,['Grüße 😀','Grüße 😀']);checks++;
  }
  // A NUL inside the tenant code is data, not a separator.
  const nul=shardSource(executionBody(jsJob('return "a\\0b".length+"\0".length',[]),true),[]);
  assert.equal(await ring(nul,{}),4);checks++;
  const primitive=shardSource(executionBody(jsJob('throw null',[]),true),[]);
  await assert.rejects(ring(primitive,{}),{name:'Error',message:'null'});checks++;
  const pending=shardSource(executionBody(jsJob('codemode.echo();return 2',[{name:'codemode',fns:{echo:async()=>null}}]),true),['codemode']);
  await assert.rejects(ring(pending,{echo:async()=>{await new Promise(resolve=>setImmediate(resolve));return {ok:1};}}),{name:'Error',message:'unawaited calls at completion'});checks++;
  assert.throws(()=>shardSource(' '.repeat(IPC.sourceBytes),[]),/source limit/);checks++;
  delete (globalThis as any).__jitkPrepared;
  return checks;
}
if(process.argv[1]?.endsWith('shard-source-check.js'))console.log(JSON.stringify({suite:'shard-source',checks:await sourceChecks(),status:'PASS'}));
