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
/** A message's records (ipc/ABI.md): header and payload each; every record
 *  but the last has flags MORE and a full IPC.payload. The local bound is
 *  Node's direction's (IPC.nodeMessageBytes: a class's REPLY may exceed 1 MiB). */
export function records(m:Message):Buffer[] {
  if(!Number.isInteger(m.kind)||m.kind<0||m.kind>0xffffffff||!Number.isInteger(m.slot)||m.slot<0||m.slot>=IPC.slots||m.generation<0n||m.generation>=1n<<62n||!Number.isInteger(m.id)||m.id<0||m.id>0xffffffff||m.bytes.length>IPC.nodeMessageBytes)throw Error('shard IPC local envelope');
  const count=Math.max(1,Math.ceil(m.bytes.length/IPC.payload)),out:Buffer[]=[];
  for(let i=0;i<count;i++){
    const chunk=m.bytes.subarray(i*IPC.payload,(i+1)*IPC.payload),b=Buffer.alloc(IPC.headerBytes+chunk.length);
    b.writeUInt32LE(m.kind,0);b.writeUInt32LE(m.slot,4);b.writeBigUInt64LE(m.generation,8);b.writeUInt32LE(m.id,16);b.writeUInt32LE(chunk.length,20);
    b.writeUInt32LE(i+1<count?IPC.more:0,IPC.flagsAt);chunk.copy(b,IPC.headerBytes);out.push(b);
  }
  return out;
}
/** One record: the message it starts or continues and whether more records follow. */
export function message(b:Buffer):{m:Message;more:boolean} {
  if(b.length<IPC.headerBytes||b.length>IPC.headerBytes+IPC.payload||b.readUInt32LE(20)!==b.length-IPC.headerBytes)throw Error('shard IPC peer envelope');
  const flags=b.readUInt32LE(IPC.flagsAt),more=flags===IPC.more;
  if((flags&~IPC.more)!==0||b.readUInt32LE(IPC.flagsAt+4)!==0||(more&&b.length!==IPC.headerBytes+IPC.payload))throw Error('shard IPC peer envelope');
  return {m:{kind:b.readUInt32LE(0),slot:b.readUInt32LE(4),generation:b.readBigUInt64LE(8),id:b.readUInt32LE(16),bytes:b.subarray(IPC.headerBytes)},more};
}
/** Reassembles the shard's messages to Node: their records are consecutive,
 *  so at most one is partial, bounded by IPC.messageBytes (they carry guest
 *  bytes; the 1 MiB console frame on every class). */
export class Assembler {
  private partial?:Message;
  private parts:Buffer[]=[];
  private size=0;
  push(record:Buffer):Message|undefined {
    const {m,more}=message(record);
    if(this.partial){
      const p=this.partial;
      if(p.kind!==m.kind||p.slot!==m.slot||p.generation!==m.generation||p.id!==m.id)throw Error('shard IPC fragment identity');
    }else this.partial=m;
    this.size+=m.bytes.length;this.parts.push(m.bytes);
    if(this.size>IPC.messageBytes)throw Error('shard IPC message bound');
    if(more)return undefined;
    const done={...this.partial!,bytes:this.parts.length===1?this.parts[0]:Buffer.concat(this.parts)};
    this.partial=undefined;this.parts=[];this.size=0;
    return done;
  }
}
/** uv_poll watches an eventfd. All payloads cross sealed memfd SPSC queues;
 * callbacks receive private native copies, never views into the hostile mmap. */
export class SharedChannel implements Channel {
  readonly native:Native;
  readonly fds:readonly number[];
  /** Unwritten records in order; a message resolves with its last record. */
  private pending:{bytes:Buffer;resolve?:()=>void;reject:(e:Error)=>void}[]=[];
  private input=new Assembler();
  private error?:Error;
  constructor(private receive:(m:Message)=>void,private failed:(e:Error)=>void) {
    this.native=binding().create(()=>{try{this.poll();}catch(e){this.fail(e instanceof Error?e:Error(String(e)));}});
    this.fds=this.native.fds;
  }
  send(m:Message):Promise<void> {
    if(this.error)return Promise.reject(this.error);
    const all=records(m);
    if(this.pending.length+all.length>IPC.nodeOutbound){const e=Error('shard IPC writer bound');this.fail(e);return Promise.reject(e);}
    // All of a message's records are queued at once, so they stay consecutive.
    return new Promise<void>((resolve,reject)=>{
      all.forEach((bytes,i)=>this.pending.push({bytes,reject,resolve:i===all.length-1?resolve:undefined}));
      try{this.flush();}catch(e){this.fail(e instanceof Error?e:Error(String(e)));}
    });
  }
  private flush() {
    while(this.pending.length){const p=this.pending[0];if(!this.native.send(p.bytes))return;this.pending.shift();p.resolve?.();}
  }
  private poll() {
    // A native batch is <=64 bounded records. No unbounded receive queue.
    for(const b of this.native.drain()){if(this.error)return;const m=this.input.push(b);if(m)this.receive(m);}
    if(!this.error)this.flush();
  }
  fail(e:Error) {
    if(this.error)return;this.error=e;this.native.close();
    for(const p of this.pending.splice(0))if(p.resolve)p.reject(e);this.failed(e);
  }
  close() {this.fail(Error('shard IPC closed'));}
}
/** What ShardBackend needs from a transport. */
export type Channel={send(m:Message):Promise<void>;close():void};
/** macOS (the HVF engine, shard/src/hvf/zygote.rs): the same records, back to
 *  back over the stream socket Node's spawn creates for a 'pipe' stdio entry.
 *  Input is parsed from one bounded buffer (a record plus a read); writes past
 *  IPC.nodeOutbound unflushed records fail the channel, as SharedChannel's do. */
export class PipeChannel implements Channel {
  /** Unparsed input as received, `size` bytes; joined once `need` bytes (the next header or record) are here. */
  private input:Buffer[]=[];
  private size=0;
  private need:number=IPC.headerBytes;
  private assembler=new Assembler();
  private unflushed=0;
  private error?:Error;
  constructor(private socket:import('node:stream').Duplex,private receive:(m:Message)=>void,private failed:(e:Error)=>void) {
    socket.on('data',(b:Buffer)=>{try{this.data(b);}catch(e){this.fail(e instanceof Error?e:Error(String(e)));}});
    socket.on('error',e=>this.fail(e));
    socket.on('close',()=>this.fail(Error('shard IPC closed by the engine')));
  }
  private data(b:Buffer) {
    if(this.error)return;
    this.input.push(b);this.size+=b.length;
    // Small reads are only queued: joining on every read would copy a record once per read.
    if(this.size<this.need)return;
    let input=this.input.length===1?this.input[0]:Buffer.concat(this.input,this.size);
    this.need=IPC.headerBytes;
    while(input.length>=IPC.headerBytes){
      const n=input.readUInt32LE(20);
      if(n>IPC.payload)throw Error('shard IPC peer envelope');
      if(input.length<IPC.headerBytes+n){this.need=IPC.headerBytes+n;break;}
      // A private copy: message() and the receiver never see the stream buffer.
      const record=Buffer.from(input.subarray(0,IPC.headerBytes+n));
      input=input.subarray(IPC.headerBytes+n);
      const m=this.assembler.push(record);
      if(m)this.receive(m);
      if(this.error)return;
    }
    this.input=input.length?[input]:[];this.size=input.length;
  }
  send(m:Message):Promise<void> {
    if(this.error)return Promise.reject(this.error);
    const all=records(m);
    if(this.unflushed+all.length>IPC.nodeOutbound){const e=Error('shard IPC writer bound');this.fail(e);return Promise.reject(e);}
    const bytes=all.length===1?all[0]:Buffer.concat(all);this.unflushed+=all.length;
    return new Promise<void>((resolve,reject)=>this.socket.write(bytes,e=>{this.unflushed-=all.length;if(e)reject(e);else if(this.error)reject(this.error);else resolve();}));
  }
  fail(e:Error) {
    if(this.error)return;this.error=e;this.socket.destroy();this.failed(e);
  }
  close() {this.fail(Error('shard IPC closed'));}
}
