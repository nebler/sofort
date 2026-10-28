import assert from 'node:assert/strict';
import {HyperlightBackend} from './backend.ts';
import {parseFrame} from '../../protocol/dispatcher.ts';
import {hyperlightConfig,testPrerequisite} from './config.ts';
const skip=testPrerequisite();
if(skip){console.log(JSON.stringify({checks:13,status:'SKIP',reason:skip}));process.exit(0);}
const {worker,snapshot}=hyperlightConfig();
let checks=0;
// Drive one session directly: the typed Session API, no executor policy layer.
async function execute(code:string,tools:Record<string,(...args:any[])=>any>={},timeout=3000) {
  const b=new HyperlightBackend(worker,snapshot,timeout),s=await b.park();
  const calls:any[]=[],logs:any[]=[];
  try {
    await s.start({kind:'js',source:`async()=>{${code}\n}`,tools:{test:Object.keys(tools)},prelude:''});
    for (;;) {
      const ev=await s.next();
      if(ev.kind==='done')return {ok:ev.ok,calls,logs};
      // A guest throw completes the run; anything else is a session failure.
      if(ev.kind==='fail'){if(ev.cause==='guest'&&!/^protocol /.test(ev.message))return {fail:ev.message,calls,logs};throw Error(ev.message);}
      if(ev.kind==='log'){logs.push(ev);continue;}
      assert.equal(ev.id,calls.length+1);calls.push(ev);
      try {await s.reply(ev.id,{ok:await tools[ev.fn](...ev.args)});}
      catch(e) {await s.reply(ev.id,{err:{code:'DENIED',message:'policy denied'}});}
    }
  }finally{s.kill();await s.exited;}
}
assert.equal((await execute('return 2;')).ok,2);checks++;
assert.equal((await execute('return await test.echo(2);',{echo:async x=>x})).ok,2);checks++;
const batch=await execute('return await Promise.all(Array.from({length:10},(_,i)=>test.echo(i)));',
  {echo:async x=>{await new Promise(r=>setTimeout(r,5));return x;}});
assert.deepEqual(batch.ok,Array.from({length:10},(_,i)=>i));assert.equal(batch.calls.length,10);checks++;
assert.equal((await execute('try {await test.no();} catch(e) {return e.code;}',{no:()=>{throw Error();}})).ok,'DENIED');checks++;
assert.equal((await execute('console.warn("héllo"); return 2;')).logs[0].msg,'héllo');checks++;
assert.equal((await execute('throw Error("guest failure");')).fail,'Error: guest failure');checks++;
await assert.rejects(()=>execute('while(true){}',{},100));checks++;
// The v1 run schema still applies behind start(): a reserved namespace is refused.
const b=new HyperlightBackend(worker,snapshot),s=await b.park();
try {await assert.rejects(()=>s.start({kind:'js',source:'async()=>2',tools:{print:[]},prelude:''}));checks++;}
finally{s.kill();await s.exited;}
const controller=new AbortController();controller.abort();
await assert.rejects(()=>b.park(controller.signal));checks++;
assert.throws(()=>parseFrame('{"t":"log","level":"info","msg":"\x7f"}'));checks++;
assert.equal(parseFrame('{"t":"log","level":"info","msg":"\\u007f"}').msg,'\x7f');checks++;
const unicode=await execute('console.log("é".repeat(3000)); return 2;');
assert.equal(Buffer.byteLength(unicode.logs[0].msg),4096);checks++;
const replacement=await execute('console.log("\\ud800"); return 2;');
assert.equal(replacement.logs[0].msg,'\ufffd');checks++;
console.log(JSON.stringify({checks,status:'PASS'}));
