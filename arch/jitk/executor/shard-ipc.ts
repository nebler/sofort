import {createRequire} from 'node:module';

export const IPC=Object.freeze({start:1,reply:2,cancel:3,call:16,done:17,error:18,released:19,ready:20,ping:21,stats:22,payload:16384,capacity:64,slots:64,calls:32,callBytes:1024});
export type Message={kind:number;slot:number;generation:bigint;id:number;bytes:Buffer};
type Native={fds:number[];send(record:Buffer):boolean;drain():Buffer[];close():void};
type Bridge={create(callback:()=>void):Native;now():bigint};
let bridge:Bridge|undefined;
function binding():Bridge {
  if(process.platform!=='linux')throw Error('shard backend requires Linux');
  return bridge??=createRequire(import.meta.url)('./shard-ipc.node') as Bridge;
}
export function monotonicNs():bigint {return binding().now();}
export function record(m:Message):Buffer {
  if(!Number.isInteger(m.kind)||m.kind<0||m.kind>0xffffffff||!Number.isInteger(m.slot)||m.slot<0||m.slot>=IPC.slots||m.generation<0n||m.generation>=1n<<62n||!Number.isInteger(m.id)||m.id<0||m.id>0xffffffff||m.bytes.length>IPC.payload)throw Error('shard IPC local envelope');
  const b=Buffer.alloc(32+m.bytes.length);
  b.writeUInt32LE(m.kind,0);b.writeUInt32LE(m.slot,4);b.writeBigUInt64LE(m.generation,8);b.writeUInt32LE(m.id,16);b.writeUInt32LE(m.bytes.length,20);m.bytes.copy(b,32);return b;
}
export function message(b:Buffer):Message {
  if(b.length<32||b.length>32+IPC.payload||b.readUInt32LE(20)!==b.length-32||b.readBigUInt64LE(24)!==0n)throw Error('shard IPC peer envelope');
  return {kind:b.readUInt32LE(0),slot:b.readUInt32LE(4),generation:b.readBigUInt64LE(8),id:b.readUInt32LE(16),bytes:b.subarray(32)};
}
/** uv_poll watches an eventfd. All payloads cross sealed memfd SPSC queues;
 * callbacks receive private native copies, never views into the hostile mmap. */
export class SharedChannel {
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
    if(this.pending.length>=IPC.slots*35+1){const e=Error('shard IPC writer bound');this.fail(e);return Promise.reject(e);}
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
