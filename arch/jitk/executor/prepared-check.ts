import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import vm from 'node:vm';
import {IDENTITY_VERSION,helperHash,helperSource,fileHash,verifyPreparedSnapshot} from './prepared-helpers.mjs';
import {parse,stringify} from './codec.mjs';
import {ABI_VERSION} from './abi.js';
import {executionBody,jsJob} from './code.js';
import {shardSource} from './shard-backend.js';
import {sourceChecks} from './shard-source-check.js';
const root=mkdtempSync(join(tmpdir(),'jitk-prepared-')),base=join(root,'snapshot');
try {
  const stale=/stale shard snapshot: prepared helper identity mismatch/;
  assert.throws(()=>verifyPreparedSnapshot(base,ABI_VERSION),stale);
  for(const ext of ['mem','regs','layout'])writeFileSync(base+'.'+ext,'fixture '+ext);
  const identity={version:IDENTITY_VERSION,abiVersion:ABI_VERSION,helperSha256:helperHash,files:Object.fromEntries(['mem','regs','layout'].map(ext=>[ext,fileHash(base+'.'+ext)]))};
  writeFileSync(base+'.identity',JSON.stringify({...identity,helperSha256:'0'.repeat(64)}));
  assert.throws(()=>verifyPreparedSnapshot(base,ABI_VERSION),stale);
  // A snapshot prepared for another ABI version is refused, naming both versions.
  writeFileSync(base+'.identity',JSON.stringify({...identity,abiVersion:ABI_VERSION-1}));
  assert.throws(()=>verifyPreparedSnapshot(base,ABI_VERSION),new RegExp(`prepared for ABI version ${ABI_VERSION-1}, the executor speaks ${ABI_VERSION}`));
  writeFileSync(base+'.identity',JSON.stringify({...identity,version:1}));
  assert.throws(()=>verifyPreparedSnapshot(base,ABI_VERSION),stale);
  writeFileSync(base+'.identity',JSON.stringify(identity));verifyPreparedSnapshot(base,ABI_VERSION);
  writeFileSync(base+'.mem','different checkpoint');
  assert.throws(()=>verifyPreparedSnapshot(base,ABI_VERSION),/shard snapshot identity mismatch: mem/);
  const providers=[{name:'codemode',fns:{echo:async(x:unknown)=>x}}];
  const code='return (await codemode.echo(41))+1';
  const job=jsJob(code,providers),prepared=executionBody(job,true),legacy=executionBody(job);
  assert.ok(!prepared.includes('function stringify')&&!prepared.includes('installBase64'));
  assert.ok(legacy.includes('function stringify')&&legacy.includes('installBase64'));
  const source=shardSource(prepared,['codemode']);
  assert.ok(Buffer.byteLength(source)<600,`minimal binding: ${source.length}`);
  // The helpers keep one copy of a big value (tool results revived in place,
  // the completion handed over as JSON text): the text the ring bootstrap
  // writes must be what the former deep copies gave, parse(JSON.stringify(v))
  // per tool result and JSON.parse(stringify(result)) at completion.
  const helpers=vm.createContext({});vm.runInContext(helperSource,helpers);
  const tagged=(kind:string,bytes:number[])=>({__codemode_binary_v1__:kind,data:Buffer.from(bytes).toString('base64')});
  const results:unknown[]=[null,0,'größer 🌍 \ud800',[1,[2,{a:null}]],tagged('Uint8Array',[0,127,255]),tagged('ArrayBuffer',[1,2]),
    {list:[tagged('Uint8Array',[9]),{deep:tagged('ArrayBufferView',[])}],n:-0,s:'x'.repeat(70000)},JSON.parse('{"__proto__":{"__codemode_binary_v1__":"Uint8Array","data":"AQ=="},"k":1}')];
  // The tenant also reports the types it received (binary revived or not).
  const shapeSource="const shape=v=>v instanceof Uint8Array?'U8['+Array.from(v)+']':v instanceof ArrayBuffer?'AB['+new Uint8Array(v)+']':Array.isArray(v)?'['+v.map(shape)+']':v&&typeof v==='object'?'{'+Object.keys(v).map(k=>k+':'+shape(v[k]))+'}':JSON.stringify(v);";
  const shape=new Function(shapeSource+'return shape')() as (v:unknown)=>string;
  let checks=0;
  for(const r of results){
    let text:string|undefined;
    const transport={echo:async()=>({ok:JSON.parse(JSON.stringify(r))}),log(){},json:(t:string)=>{text=t;return 'handed over';}};
    const body=executionBody(jsJob(shapeSource+'const r=await codemode.tool();return [shape(r),r]',[{name:'codemode',fns:{tool:async()=>r}}]),true);
    assert.equal(await helpers.__jitkPrepared.source(transport,body,['codemode']),'handed over');
    const before=parse(JSON.stringify(r));
    assert.equal(text,JSON.stringify(JSON.parse(stringify([shape(before),before]))));checks++;
  }
  // No JSON for the value: the error JSON.parse(stringify(fn)) threw before.
  await assert.rejects(helpers.__jitkPrepared.source({echo(){},log(){},json(){}},executionBody(jsJob('return ()=>1',[]),true),[]),(e:{name:string})=>e.name==='SyntaxError');checks++;
  console.log(JSON.stringify({suite:'prepared',status:'PASS',checks:10+checks+await sourceChecks(),sourceBytes:source.length,legacyBodyBytes:legacy.length,helperHash}));
} finally {rmSync(root,{recursive:true,force:true});}
