// Linux transport checks require no KVM and start no helper process.
import assert from 'node:assert/strict';
import {fstatSync,ftruncateSync,writeSync} from 'node:fs';
import {SharedChannel,records,IPC} from './shard-ipc.js';
export function transportChecks():number {
  let checks=0;
  const endpoint=()=>new SharedChannel(()=>{},()=>{});
  const b=endpoint();
  try {
    assert.equal(fstatSync(b.fds[0]).size,2105344);checks++;
    assert.throws(()=>ftruncateSync(b.fds[0],0),/EPERM/);checks++;
    assert.throws(()=>Reflect.apply(b.native.send,b.native,[]),/requires Buffer/);checks++;
    assert.throws(()=>b.native.send(Buffer.alloc(31)),/local IPC record/);checks++;
    const tooLong=Buffer.alloc(32);tooLong.writeUInt32LE(0xffffffff,20);
    assert.throws(()=>b.native.send(tooLong),/local IPC record/);checks++;
    // MORE on a short record, an unknown flag, a nonzero reserved word.
    for(const [at,value] of [[24,1],[24,2],[28,1]]){
      const invalid=Buffer.alloc(32);invalid[at]=value;
      assert.throws(()=>b.native.send(invalid),/local IPC record/);checks++;
    }
    const cursor=Buffer.alloc(8);cursor.writeBigUInt64LE(65n);writeSync(b.fds[0],cursor,0,8,192);
    assert.throws(()=>b.native.drain(),/producer/);checks++;
    cursor.writeBigUInt64LE(0xffffffffffffffffn);writeSync(b.fds[0],cursor,0,8,192);
    assert.throws(()=>b.native.drain(),/producer/);checks++;
    cursor.writeBigUInt64LE(2n);writeSync(b.fds[0],cursor,0,8,128);
    assert.throws(()=>b.native.send(records({kind:IPC.cancel,slot:0,generation:1n,id:0,bytes:Buffer.alloc(0)})[0]),/consumer/);checks++;
  } finally {b.close();}
  const copy=endpoint();
  try {
    const [packet]=records({kind:IPC.call,slot:0,generation:1n,id:1,bytes:Buffer.from('private')});
    writeSync(copy.fds[0],packet,0,packet.length,1054720);
    const cursor=Buffer.alloc(8);cursor.writeBigUInt64LE(1n);writeSync(copy.fds[0],cursor,0,8,192);
    const [received]=copy.native.drain();
    writeSync(copy.fds[0],Buffer.from('changed'),0,7,1054720+32);
    assert.equal(received.subarray(32).toString(),'private');checks++;
  } finally {copy.close();}
  return checks;
}
if(process.argv[1]?.endsWith('shard-ipc-check.js'))console.log(JSON.stringify({suite:'shard-ipc',checks:transportChecks(),status:'PASS'}));
