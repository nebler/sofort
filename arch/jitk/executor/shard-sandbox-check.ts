// Shard sandbox failure domains without KVM or the native bridge (runs on macOS).
// A fake host stands in for ShardBackend. Any throw from receive() is what
// SharedChannel.poll turns into die(), i.e. SIGKILL of every slot on the shard.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ShardSandbox,type ShardHost} from './shard-backend.js';
import {IPC,type Message} from './shard-ipc.js';

// Resolved from the bundle in executor/build/.
type Row=[kind:'call'|'done',name:string,outcome:'ok'|'node'|'shard',payload:string];
const corpus=(JSON.parse(readFileSync(new URL('../../abi/guest-payloads.json',import.meta.url),'utf8')) as {cases:Row[]}).cases;
class FakeShard implements ShardHost {
  sent:Message[]=[];
  freed:ShardSandbox[]=[];
  fault?:Error;
  now() {return 1n;}
  send(kind:number,s:ShardSandbox,id=0,bytes:Buffer=Buffer.alloc(0)) {this.sent.push({kind,slot:s.slot,generation:s.generation,id,bytes});return Promise.resolve();}
  released(s:ShardSandbox) {this.freed.push(s);}
  metrics() {}
  fatal(e:Error) {this.fault??=e;}
  // ShardBackend.receive: a throw here kills the whole shard connection.
  deliver(s:ShardSandbox,kind:number,id=0,bytes:Buffer=Buffer.alloc(0)) {
    try{s.receive({kind,slot:s.slot,generation:s.generation,id,bytes});}catch(e){this.fatal(e as Error);}
  }
  async running(slot:number) {
    const s=new ShardSandbox(this,slot,1n);await s.armDeadline(Date.now()+5000);
    await s.send({t:'run',code:'return 1',ns:{ns:['fn']}});return s;
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
      const frame=await hostile.read() as {t:string};
      assert.equal(frame.t,kind==='done'?'done':JSON.parse(payload)[0],name);
    }else if(kind==='call'&&bytes.length>IPC.callBytes){
      // Over the shard's own CALL bound: only a lying shard can deliver this.
      assert.match(String(shard.fault),/^Error: shard IPC call /,name);checks++;continue;
    }else{
      await assert.rejects(hostile.read(),/^Error: protocol [A-Z_]+$/,name);
      const cancel=shard.sent.filter(m=>m.kind===IPC.cancel);
      assert.deepEqual(cancel.map(m=>[m.slot,m.generation]),[[0,1n]],name+': CANCEL for that generation only');
      shard.deliver(hostile,IPC.released);
      await hostile.exited;assert.deepEqual(shard.freed,[hostile],name+': slot released after reset');
    }
    assert.equal(shard.fault,undefined,name+': shard connection survives');
    // The sibling on the same shard is unaffected and completes normally.
    const call=await sibling.read() as {t:string;id:number};assert.equal(call.t,'call',name);
    await sibling.send({t:'ret',id:call.id,ok:2});
    assert.ok(shard.sent.some(m=>m.kind===IPC.reply&&m.slot===1&&m.bytes.toString()==='{"ok":2}'),name);
    shard.deliver(sibling,IPC.stats,0,stats());shard.deliver(sibling,IPC.done,0,Buffer.from('{"ok":2}'));
    assert.deepEqual(await sibling.read(),{t:'done',ok:2},name);
    assert.equal(shard.fault,undefined,name+': shard connection survives sibling completion');
    checks++;
  }
  // Contract violations by the shard itself still fail the whole connection.
  for(const [name,violate] of [
    ['call identity',(s:ShardSandbox)=>s.receive({kind:IPC.call,slot:0,generation:1n,id:2,bytes:Buffer.from('["log","log","x"]')})],
    ['done before stats',(s:ShardSandbox)=>s.receive({kind:IPC.done,slot:0,generation:1n,id:0,bytes:Buffer.from('{"ok":1}')})],
    ['done with outstanding call',(s:ShardSandbox)=>{
      s.receive({kind:IPC.call,slot:0,generation:1n,id:1,bytes:Buffer.from('["call","ns","fn",[]]')});
      s.receive({kind:IPC.stats,slot:0,generation:1n,id:0,bytes:stats()});
      s.receive({kind:IPC.done,slot:0,generation:1n,id:0,bytes:Buffer.from('{"ok":1}')});
    }],
    ['release while running',(s:ShardSandbox)=>s.receive({kind:IPC.released,slot:0,generation:1n,id:0,bytes:Buffer.alloc(0)})],
  ] as const) {
    const s=await new FakeShard().running(0);
    assert.throws(()=>violate(s),/^Error: shard IPC /,name);checks++;
  }
  return checks;
}
if(process.argv[1]?.endsWith('shard-sandbox-check.js'))console.log(JSON.stringify({suite:'shard-sandbox',checks:await sandboxChecks(),status:'PASS'}));
