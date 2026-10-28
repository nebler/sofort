// The executor's side of the ABI handshake: READY must carry exactly this
// executor's ABI version (abi.ts, generated from the jitk-abi crate). A shard
// built for another version, or one that predates the version (empty READY),
// is refused with an error naming both versions.
import assert from 'node:assert/strict';
import {ABI_VERSION,IPC,checkReady,type Message} from './shard-ipc.js';

const ready=(bytes:Buffer,fields:Partial<Message>={}):Message=>({kind:IPC.ready,slot:0,generation:0n,id:0,bytes,...fields});
const version=(v:number)=>{const b=Buffer.alloc(IPC.readyBytes);b.writeUInt32LE(v);return b;};
let checks=0;
checkReady(ready(version(ABI_VERSION)));checks++;
for(const [bytes,shown] of [[version(ABI_VERSION+1),String(ABI_VERSION+1)],[version(ABI_VERSION-1),String(ABI_VERSION-1)],[Buffer.alloc(0),'missing'],[Buffer.alloc(8),'missing']] as const){
  assert.throws(()=>checkReady(ready(bytes)),new RegExp(`shard ABI version ${shown} does not match the executor's ABI version ${ABI_VERSION}: refusing this shard`));checks++;
}
for(const fields of [{slot:1},{generation:1n},{id:1}]){
  assert.throws(()=>checkReady(ready(version(ABI_VERSION),fields)),/shard IPC ready schema/);checks++;
}
// Geometry the bridge (bridge_abi.h) and ipc/ABI.md also state.
assert.equal(IPC.headerBytes+IPC.payload,16416);checks++;
assert.equal(IPC.outbound,IPC.slots*(IPC.outstanding+IPC.logs+3)+1);checks++;
assert.equal(IPC.messagesPerGeneration,IPC.calls+IPC.logs+3);checks++;
console.log(JSON.stringify({suite:'abi',status:'PASS',checks,abiVersion:ABI_VERSION}));
