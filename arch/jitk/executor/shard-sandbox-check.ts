// Shard sandbox failure domains without KVM or the native bridge (runs on macOS).
// A fake host stands in for ShardBackend. Any throw from receive() is what
// SharedChannel.poll turns into die(), i.e. SIGKILL of every slot on the shard.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ShardSession,type ShardHost} from './shard-backend.js';
import {IPC,type Message} from './shard-ipc.js';

// Resolved from the bundle in executor/build/.
type Row=[kind:'call'|'done',name:string,outcome:'ok'|'node'|'shard',payload:string];
const corpus=(JSON.parse(readFileSync(new URL('../../abi/guest-payloads.json',import.meta.url),'utf8')) as {cases:Row[]}).cases;
class FakeShard implements ShardHost {
  sent:Message[]=[];
  freed:ShardSession[]=[];
  fault?:Error;
  now() {return 1n;}
  send(kind:number,s:ShardSession,id=0,bytes:Buffer=Buffer.alloc(0)) {this.sent.push({kind,slot:s.slot,generation:s.generation,id,bytes});return Promise.resolve();}
  lost:string[]=[];
  released(s:ShardSession,quarantine?:string) {this.freed.push(s);if(quarantine!==undefined)this.lost.push(quarantine);}
  metrics() {}
  fatal(e:Error) {this.fault??=e;}
  // ShardBackend.receive: a throw here kills the whole shard connection.
  deliver(s:ShardSession,kind:number,id=0,bytes:Buffer=Buffer.alloc(0)) {
    try{s.receive({kind,slot:s.slot,generation:s.generation,id,bytes});}catch(e){this.fatal(e as Error);}
  }
  async running(slot:number) {
    const s=new ShardSession(this,slot,1n);await s.armDeadline(Date.now()+5000);
    await s.start({kind:'js',source:'async()=>1',tools:{ns:['fn']},prelude:''});return s;
  }
}
const stats=()=>Buffer.alloc(32);
export async function sandboxChecks():Promise<number> {
  let checks=0;
  for(const [kind,name,outcome,payload] of corpus) {
    const shard=new FakeShard();
    const sibling=await shard.running(1),hostile=await shard.running(0);
    shard.deliver(sibling,IPC.call,1,Buffer.from('["call","ns","fn",[1]]'));
    const bytes=Buffer.from(payload,'latin1');
    if(kind==='call')shard.deliver(hostile,IPC.call,1,bytes);
    else {shard.deliver(hostile,IPC.stats,0,stats());shard.deliver(hostile,IPC.done,0,bytes);}
    if(outcome==='ok'){
      const ev=await hostile.next();
      // A valid DONE carrying a guest throw is a 'guest' fail, never a protocol error.
      const body=JSON.parse(payload);
      assert.equal(ev.kind,kind==='call'?body[0]:Object.hasOwn(body,'ok')?'done':'fail',name);
      if(ev.kind==='fail')assert.ok(ev.cause==='guest'&&!/^protocol /.test(ev.message),name);
    }else if(kind==='call'&&bytes.length>IPC.callBytes){
      // Over the shard's own CALL bound: only a lying shard can deliver this.
      assert.match(String(shard.fault),/^Error: shard IPC call /,name);checks++;continue;
    }else{
      {const ev=await hostile.next();assert.ok(ev.kind==='fail'&&ev.cause==='guest'&&/^protocol [A-Z_]+$/.test(ev.message),name+': '+JSON.stringify(ev));}
      const cancel=shard.sent.filter(m=>m.kind===IPC.cancel);
      assert.deepEqual(cancel.map(m=>[m.slot,m.generation]),[[0,1n]],name+': CANCEL for that generation only');
      shard.deliver(hostile,IPC.released);
      await hostile.released;assert.deepEqual(shard.freed,[hostile],name+': slot released after reset');
    }
    assert.equal(shard.fault,undefined,name+': shard connection survives');
    // The sibling on the same shard is unaffected and completes normally.
    const call=await sibling.next();assert.equal(call.kind,'call',name);if(call.kind!=='call')throw Error(name);
    await sibling.reply(call.id,{ok:2});
    assert.ok(shard.sent.some(m=>m.kind===IPC.reply&&m.slot===1&&m.bytes.toString()==='{"ok":2}'),name);
    shard.deliver(sibling,IPC.stats,0,stats());shard.deliver(sibling,IPC.done,0,Buffer.from('{"ok":2}'));
    assert.deepEqual(await sibling.next(),{kind:'done',ok:2},name);
    assert.equal(shard.fault,undefined,name+': shard connection survives sibling completion');
    checks++;
  }
  // Contract violations by the shard itself still fail the whole connection.
  for(const [name,violate] of [
    ['call identity',(s:ShardSession)=>s.receive({kind:IPC.call,slot:0,generation:1n,id:2,bytes:Buffer.from('["log","log","x"]')})],
    ['done before stats',(s:ShardSession)=>s.receive({kind:IPC.done,slot:0,generation:1n,id:0,bytes:Buffer.from('{"ok":1}')})],
    ['done with outstanding call',(s:ShardSession)=>{
      s.receive({kind:IPC.call,slot:0,generation:1n,id:1,bytes:Buffer.from('["call","ns","fn",[]]')});
      s.receive({kind:IPC.stats,slot:0,generation:1n,id:0,bytes:stats()});
      s.receive({kind:IPC.done,slot:0,generation:1n,id:0,bytes:Buffer.from('{"ok":1}')});
    }],
    ['release while running',(s:ShardSession)=>s.receive({kind:IPC.released,slot:0,generation:1n,id:0,bytes:Buffer.alloc(0)})],
  ] as const) {
    const s=await new FakeShard().running(0);
    assert.throws(()=>violate(s),/^Error: shard IPC /,name);checks++;
  }
  // Typed events straight from records: logs share the CALL wire ids, tool calls
  // get their own ids, and each reply goes back on its call's wire.
  {
    const shard=new FakeShard(),s=await shard.running(0);
    assert.equal(s.phase,'running');
    shard.deliver(s,IPC.call,1,Buffer.from('["log","warn","w"]'));
    shard.deliver(s,IPC.call,2,Buffer.from('["call","ns","fn",["a"]]'));
    assert.deepEqual(await s.next(),{kind:'log',level:'warn',msg:'w'});
    assert.ok(shard.sent.some(m=>m.kind===IPC.reply&&m.id===1&&m.bytes.toString()==='{"ok":null}'),'log acknowledged on its wire');
    assert.deepEqual(await s.next(),{kind:'call',id:1,ns:'ns',fn:'fn',args:['a']});
    await s.reply(1,{ok:'Grüße'});
    assert.equal(shard.sent.find(m=>m.kind===IPC.reply&&m.id===2)?.bytes.toString(),'{"ok":"Gr\\u00fc\\u00dfe"}','reply on the call wire, ASCII escaped');
    await assert.rejects(s.reply(1,{ok:1}),/shard unknown reply/,'each id answered once');
    shard.deliver(s,IPC.stats,0,stats());shard.deliver(s,IPC.done,0,Buffer.from('{"err":{"name":"TypeError","message":"x"}}'));
    assert.deepEqual(await s.next(),{kind:'fail',cause:'guest',message:'TypeError: x'});
    assert.equal(s.phase,'done','a guest throw is a completed run');s.release();assert.equal(s.phase,'ended');
    assert.equal(shard.fault,undefined);checks++;
  }
  // Host replies pass the same output limits as v1 frames; a bad one fails only
  // its own generation. An oversized valid reply becomes a LIMIT error instead.
  for(const [name,r,code] of [['unsafe number',{ok:2**60},'NUMBER'],['lone surrogate',{ok:'\ud800'},'UNICODE'],['bad error code',{err:{code:'lower',message:''}},'SCHEMA'],['extra key',{ok:1,x:1},'SCHEMA'],['BigInt',{ok:1n},'SERIALIZE']] as const){
    const shard=new FakeShard(),s=await shard.running(0);
    shard.deliver(s,IPC.call,1,Buffer.from('["call","ns","fn",[]]'));await s.next();
    await assert.rejects(s.reply(1,r as never),{message:code},name);
    assert.deepEqual(await s.next(),{kind:'fail',cause:'guest',message:'protocol '+code},name);assert.equal(s.phase,'ended',name);
    assert.ok(shard.sent.some(m=>m.kind===IPC.cancel)&&!shard.sent.some(m=>m.kind===IPC.reply),name+': CANCEL, no reply');checks++;
  }
  {
    const shard=new FakeShard(),s=await shard.running(0);
    shard.deliver(s,IPC.call,1,Buffer.from('["call","ns","fn",[]]'));await s.next();
    await s.reply(1,{ok:'x'.repeat(2000)});
    assert.match(shard.sent.find(m=>m.kind===IPC.reply)!.bytes.toString(),/"LIMIT".*1024 bytes/);checks++;
  }
  // A run error preempts queued calls (no tool runs after it) and keeps its cause.
  for(const [text,cause] of [['deadline_exceeded','deadline'],['guest_protocol: x','guest'],['memory_bound: y','limit'],['slot_unavailable: z','engine']] as const){
    const shard=new FakeShard(),s=await shard.running(0);
    shard.deliver(s,IPC.call,1,Buffer.from('["call","ns","fn",[]]'));
    shard.deliver(s,IPC.stats,0,stats());shard.deliver(s,IPC.error,0,Buffer.from(text));
    assert.deepEqual(await s.next(),{kind:'fail',cause,message:text});assert.equal(s.phase,'ended',text);checks++;
  }
  // QUARANTINED ends a cancelled generation like RELEASED, carrying its reason;
  // out of state or with a bad payload it is a shard contract violation.
  {
    const shard=new FakeShard(),s=await shard.running(0);
    shard.deliver(s,IPC.stats,0,stats());shard.deliver(s,IPC.error,0,Buffer.from('slot_unavailable: quarantined after a failed reset'));
    assert.equal((await s.next()).kind,'fail');s.release();
    shard.deliver(s,IPC.quarantined,0,Buffer.from('reset failed: EINVAL'));
    await s.released;assert.deepEqual(shard.freed,[s]);assert.deepEqual(shard.lost,['reset failed: EINVAL']);
    assert.equal(shard.fault,undefined);checks++;
  }
  for(const [name,bytes,cancel] of [['before CANCEL','x',false],['empty reason','',true],['control byte','a\x01',true],['over ERROR_BYTES','x'.repeat(IPC.errorBytes+1),true]] as const){
    const shard=new FakeShard(),s=await shard.running(0);
    if(cancel)s.release();
    shard.deliver(s,IPC.quarantined,0,Buffer.from(bytes,'latin1'));
    assert.match(String(shard.fault),/^Error: shard IPC release/,name);assert.deepEqual(shard.lost,[],name);checks++;
  }
  // The run's namespace schema is the v1 one: a reserved name fails this generation.
  {
    const shard=new FakeShard(),s=new ShardSession(shard,0,1n);await s.armDeadline(Date.now()+5000);
    await assert.rejects(s.start({kind:'js',source:'async()=>1',tools:{print:['x']},prelude:''}),{message:'SCHEMA'});
    assert.deepEqual(shard.sent.map(m=>m.kind),[IPC.cancel]);checks++;
  }
  return checks;
}
if(process.argv[1]?.endsWith('shard-sandbox-check.js'))console.log(JSON.stringify({suite:'shard-sandbox',checks:await sandboxChecks(),status:'PASS'}));
