import {createRequire} from 'node:module';
import {ABI_VERSION,IPC} from './abi.js';

// Kinds, geometry and bounds are generated from the jitk-abi crate (abi.ts).
export {ABI_VERSION,IPC};
export type Message={kind:number;slot:number;generation:bigint;id:number;bytes:Buffer};
/** READY carries the shard's ABI version (u32 LE); any other version, or none, is refused. */
export function checkReady(m:Message):void {
  if(m.slot||m.generation||m.id)throw Error('shard IPC ready schema');
  const version=m.bytes.length===IPC.readyBytes?m.bytes.readUInt32LE(0):undefined;
  if(version!==ABI_VERSION)throw Error(`shard ABI version ${version??'missing'} does not match the executor's ABI version ${ABI_VERSION}: refusing this shard; rebuild it (make -C arch/jitk deps) and its snapshots (make -C arch/jitk/shard snapshot)`);
}
type Native={fds:number[];send(record:Buffer):boolean;drain():Buffer[];close():void};
type Bridge={create(callback:()=>void):Native;now():bigint};
let bridge:Bridge|undefined;
function binding():Bridge {
  if(process.platform!=='linux')throw Error('shard backend requires Linux');
  return bridge??=createRequire(import.meta.url)('./shard-ipc.node') as Bridge;
}
/** The clock of START deadlines and STATS times: CLOCK_MONOTONIC on Linux (the
 *  native binding); on macOS process.hrtime, which is mach_continuous_time, the
 *  HVF engine's CLOCK_MONOTONIC_RAW (shard/src/clock.rs ipc_ns). */
export function monotonicNs():bigint {return process.platform==='darwin'?process.hrtime.bigint():binding().now();}
export function record(m:Message):Buffer {
  if(!Number.isInteger(m.kind)||m.kind<0||m.kind>0xffffffff||!Number.isInteger(m.slot)||m.slot<0||m.slot>=IPC.slots||m.generation<0n||m.generation>=1n<<62n||!Number.isInteger(m.id)||m.id<0||m.id>0xffffffff||m.bytes.length>IPC.payload)throw Error('shard IPC local envelope');
  const b=Buffer.alloc(IPC.headerBytes+m.bytes.length);
  b.writeUInt32LE(m.kind,0);b.writeUInt32LE(m.slot,4);b.writeBigUInt64LE(m.generation,8);b.writeUInt32LE(m.id,16);b.writeUInt32LE(m.bytes.length,20);m.bytes.copy(b,IPC.headerBytes);return b;
}
export function message(b:Buffer):Message {
  if(b.length<IPC.headerBytes||b.length>IPC.headerBytes+IPC.payload||b.readUInt32LE(20)!==b.length-IPC.headerBytes||b.readBigUInt64LE(24)!==0n)throw Error('shard IPC peer envelope');
  return {kind:b.readUInt32LE(0),slot:b.readUInt32LE(4),generation:b.readBigUInt64LE(8),id:b.readUInt32LE(16),bytes:b.subarray(IPC.headerBytes)};
}
/** uv_poll watches an eventfd. All payloads cross sealed memfd SPSC queues;
 * callbacks receive private native copies, never views into the hostile mmap. */
export class SharedChannel implements Channel {
  readonly native:Native;
  readonly fds:readonly number[];
  private pending:{bytes:Buffer;resolve:()=>void;reject:(e:Error)=>void}[]=[];
  private error?:Error;
  constructor(private receive:(m:Message)=>void,private failed:(e:Error)=>void) {
    this.native=binding().create(()=>{try{this.poll();}catch(e){this.fail(e instanceof Error?e:Error(String(e)));}});
    this.fds=this.native.fds;
  }
  send(m:Message):Promise<void> {
    if(this.error)return Promise.reject(this.error);
    if(this.pending.length>=IPC.outbound){const e=Error('shard IPC writer bound');this.fail(e);return Promise.reject(e);}
    const bytes=record(m);
    return new Promise<void>((resolve,reject)=>{this.pending.push({bytes,resolve,reject});try{this.flush();}catch(e){this.fail(e instanceof Error?e:Error(String(e)));}});
  }
  private flush() {
    while(this.pending.length){const p=this.pending[0];if(!this.native.send(p.bytes))return;this.pending.shift();p.resolve();}
  }
  private poll() {
    // A native batch is <=64 bounded records. No unbounded receive queue.
    for(const b of this.native.drain()){if(this.error)return;this.receive(message(b));}
    if(!this.error)this.flush();
  }
  fail(e:Error) {
    if(this.error)return;this.error=e;this.native.close();
    for(const p of this.pending.splice(0))p.reject(e);this.failed(e);
  }
  close() {this.fail(Error('shard IPC closed'));}
}
/** What ShardBackend needs from a transport. */
export type Channel={send(m:Message):Promise<void>;close():void};
/** macOS (the HVF engine, shard/src/hvf/zygote.rs): the same records, back to
 *  back over the stream socket Node's spawn creates for a 'pipe' stdio entry.
 *  Input is parsed from one bounded buffer (a record plus a read); writes past
 *  IPC.outbound unflushed records fail the channel, as SharedChannel's do. */
export class PipeChannel implements Channel {
  private input:Buffer=Buffer.alloc(0);
  private unflushed=0;
  private error?:Error;
  constructor(private socket:import('node:stream').Duplex,private receive:(m:Message)=>void,private failed:(e:Error)=>void) {
    socket.on('data',(b:Buffer)=>{try{this.data(b);}catch(e){this.fail(e instanceof Error?e:Error(String(e)));}});
    socket.on('error',e=>this.fail(e));
    socket.on('close',()=>this.fail(Error('shard IPC closed by the engine')));
  }
  private data(b:Buffer) {
    if(this.error)return;
    this.input=this.input.length?Buffer.concat([this.input,b]):b;
    while(this.input.length>=IPC.headerBytes){
      const n=this.input.readUInt32LE(20);
      if(n>IPC.payload)throw Error('shard IPC peer envelope');
      if(this.input.length<IPC.headerBytes+n)break;
      // A private copy: message() and the receiver never see the stream buffer.
      const record=Buffer.from(this.input.subarray(0,IPC.headerBytes+n));
      this.input=this.input.subarray(IPC.headerBytes+n);
      this.receive(message(record));
      if(this.error)return;
    }
  }
  send(m:Message):Promise<void> {
    if(this.error)return Promise.reject(this.error);
    if(this.unflushed>=IPC.outbound){const e=Error('shard IPC writer bound');this.fail(e);return Promise.reject(e);}
    const bytes=record(m);this.unflushed++;
    return new Promise<void>((resolve,reject)=>this.socket.write(bytes,e=>{this.unflushed--;if(e)reject(e);else if(this.error)reject(this.error);else resolve();}));
  }
  fail(e:Error) {
    if(this.error)return;this.error=e;this.socket.destroy();this.failed(e);
  }
  close() {this.fail(Error('shard IPC closed'));}
}
