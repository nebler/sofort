import assert from 'node:assert/strict';
import {HyperlightBackend} from './backend.ts';
import {parseFrame} from './protocol.ts';
const worker='/tmp/jitk-09/adapter-target/release/r2-worker';
const snapshot='/tmp/jitk-09/r2-snapshot';
let checks=0;
async function execute(code:string,tools:Record<string,(...args:any[])=>any>={},timeout=3000) {
  const b=new HyperlightBackend(worker,snapshot,timeout),s=await b.park();
  const calls:any[]=[],logs:any[]=[];
  try {
    await s.send({t:'run',code,ns:{test:Object.keys(tools)}});
    for (;;) {
      const m:any=await s.read();
      if(m.t==='done')return {m,calls,logs};
      if(m.t==='log'){logs.push(m);continue;}
      assert.equal(m.t,'call');assert.equal(m.id,calls.length+1);calls.push(m);
      try {await s.send({t:'ret',id:m.id,ok:await tools[m.fn](...m.args)});}
      catch(e) {await s.send({t:'ret',id:m.id,err:{code:'DENIED',message:'policy denied'}});}
    }
  }finally{s.kill();await s.exited;}
}
assert.equal((await execute('return 2;')).m.ok,2);checks++;
assert.equal((await execute('return await test.echo(2);',{echo:async x=>x})).m.ok,2);checks++;
const batch=await execute('return await Promise.all(Array.from({length:10},(_,i)=>test.echo(i)));',
  {echo:async x=>{await new Promise(r=>setTimeout(r,5));return x;}});
assert.deepEqual(batch.m.ok,Array.from({length:10},(_,i)=>i));assert.equal(batch.calls.length,10);checks++;
assert.equal((await execute('try {await test.no();} catch(e) {return e.code;}',{no:()=>{throw Error();}})).m.ok,'DENIED');checks++;
assert.equal((await execute('console.warn("héllo"); return 2;')).logs[0].msg,'héllo');checks++;
assert.equal((await execute('throw Error("guest failure");')).m.err.message,'guest failure');checks++;
await assert.rejects(()=>execute('while(true){}',{},100));checks++;
const b=new HyperlightBackend(worker,snapshot),s=await b.park();
try {await assert.rejects(()=>s.send({t:'run',code:'return 2;',ns:{},extra:true}));checks++;}
finally{s.kill();await s.exited;}
const controller=new AbortController();controller.abort();
await assert.rejects(()=>b.park(controller.signal));checks++;
assert.throws(()=>parseFrame('{"t":"log","level":"info","msg":"\x7f"}'));checks++;
assert.equal(parseFrame('{"t":"log","level":"info","msg":"\\u007f"}').msg,'\x7f');checks++;
console.log(JSON.stringify({checks,status:'PASS'}));
