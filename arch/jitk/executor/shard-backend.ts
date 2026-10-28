import {verifyPreparedSnapshot} from './prepared-helpers.mjs';
import {spawn,type ChildProcess} from 'node:child_process';
import {Dispatcher,ProtocolError,encode,parseFrame,parseJson,type Frame} from '../protocol/dispatcher.js';
import type {Backend,Sandbox} from './backend.js';
import {AdmissionQueue} from './pool.js';
import {ARENA_CLASSES} from './abi.js';
import {ABI_VERSION,IPC,SharedChannel,checkReady,monotonicNs,type Message} from './shard-ipc.js';

export type ShardMetrics={deadlineNs:bigint;slot:number;generation:bigint;ownerCpuNs:bigint;stoppedNs:bigint;resetDoneNs:bigint;roundTripsNs:bigint[]};
/** maxWaiting bounds park() callers queued for a free slot (default max(64, 4 x slots)). */
export type ShardOptions={binary:string;snapshot:string;slots?:number;owners?:number;maxWaiting?:number;onMetrics?:(m:ShardMetrics)=>void};
const ascii=(s:string)=>s.replace(/[\u007f-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
/** Bind tenant code to helpers already compiled in restored guest memory. */
export function shardSource(frame:Frame):string {
  const names=Object.keys(frame.ns as object);
  // Only JSON string data is ASCII escaped: preserve raw templates/regex tokens.
  const wire=`return await globalThis.__jitkPrepared.source(tools,${ascii(JSON.stringify(frame.code))},${JSON.stringify(names)});`;
  if(Buffer.byteLength(wire)>IPC.sourceBytes)throw Error(`shard source limit including trusted adapters (${IPC.sourceBytes} bytes)`);
  return wire;
}

export class ShardBackend implements Backend {
  readonly kind='shard' as const;
  readonly memoryLimitMB=2;
  readonly ready:Promise<void>;
  readonly child:ChildProcess;
  private channel:SharedChannel;
  private sandboxes=new Map<number,ShardSandbox>();
  private queue:AdmissionQueue<ShardSandbox>;
  private generations:bigint[];
  private dead?:Error;
  private resolveReady!:()=>void;
  private rejectReady!:(e:Error)=>void;
  private didReady=false;
  private startup:ReturnType<typeof setTimeout>;
  private closed=false;
  private readonly onExit=()=>this.child.kill('SIGKILL');
  constructor(readonly options:ShardOptions) {
    if(process.platform!=='linux')throw Error('shard backend requires Linux');
    verifyPreparedSnapshot(options.snapshot,ABI_VERSION);
    const slots=options.slots??64,owners=options.owners??4;
    if(!Number.isInteger(slots)||slots<1||slots>64||!Number.isInteger(owners)||owners<1||owners>4)throw Error('shard capacity limit');
    this.generations=Array<bigint>(slots).fill(0n);this.queue=new AdmissionQueue('shard pool',options.maxWaiting??Math.max(64,4*slots));
    this.ready=new Promise<void>((resolve,reject)=>{this.resolveReady=resolve;this.rejectReady=reject;});this.ready.catch(()=>{});
    this.channel=new SharedChannel(m=>this.receive(m),e=>this.die(e));
    // Exactly these descriptors and a credential-free environment are inherited.
    this.child=spawn(options.binary,['ipc',options.snapshot,String(slots),String(owners)],{stdio:['ignore','ignore','pipe',...this.channel.fds],env:{PATH:'/usr/bin:/bin'}});
    process.once('exit',this.onExit);
    let stderr=0;
    this.child.stderr!.on('data',(b:Buffer)=>{stderr+=b.length;if(stderr>65536)this.die(Error('shard stderr limit'));});
    this.child.once('error',e=>this.die(e));
    this.child.once('close',()=>{process.removeListener('exit',this.onExit);this.die(Error('sandbox exited: shard'));});
    this.startup=setTimeout(()=>this.die(Error('shard startup timeout')),5000);
  }
  private die(e:Error) {
    if(this.dead)return;this.dead=e;clearTimeout(this.startup);this.rejectReady(e);
    this.child?.kill('SIGKILL');this.channel?.close();
    for(const s of this.sandboxes.values())s.failed(e);this.sandboxes.clear();this.queue.rejectAll(e);
  }
  private receive(m:Message) {
    if(m.kind===IPC.ready){
      if(this.didReady)throw Error('shard IPC ready schema');
      checkReady(m);
      this.didReady=true;clearTimeout(this.startup);this.resolveReady();return;
    }
    if(!this.didReady||m.slot>=this.generations.length||m.generation===0n)throw Error('shard IPC peer slot/state');
    const s=this.sandboxes.get(m.slot);
    // Unsolicited and stale messages fail the whole untrusted shard closed.
    if(!s||m.generation!==s.generation)throw Error('shard IPC stale generation');
    s.receive(m);
  }
  async park(signal?:AbortSignal,deadline?:number):Promise<Sandbox> {
    if(signal?.aborted)throw Error('aborted');
    if(signal){
      let abort!:()=>void;
      try{await Promise.race([this.ready,new Promise<never>((_,reject)=>{abort=()=>reject(Error('aborted'));signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();})]);}
      finally{signal.removeEventListener('abort',abort);}
    }else await this.ready;
    if(this.dead)throw this.dead;
    if(signal?.aborted)throw Error('aborted');
    // All slots busy or resetting: wait in FIFO order; released() hands over.
    const slot=this.queue.length?-1:this.generations.findIndex((_,i)=>!this.sandboxes.has(i));
    const s=slot<0?await this.queue.wait(signal,deadline):this.claim(slot);
    if(signal?.aborted){s.kill();await s.exited;throw Error('aborted');}
    if(deadline!==undefined)try{await s.armDeadline(deadline);}catch(e){s.kill();await s.exited;throw e;}
    return s;
  }
  private claim(slot:number):ShardSandbox {
    const generation=++this.generations[slot];
    if(generation>=1n<<62n)throw Error('shard generation exhausted');
    const s=new ShardSandbox(this,slot,generation);this.sandboxes.set(slot,s);return s;
  }
  send(kind:number,s:ShardSandbox,id=0,bytes:Buffer=Buffer.alloc(0)):Promise<void> {return this.channel.send({kind,slot:s.slot,generation:s.generation,id,bytes});}
  released(s:ShardSandbox) {
    if(this.sandboxes.get(s.slot)!==s)throw Error('shard release identity');this.sandboxes.delete(s.slot);
    // The slot just finished its reset: give it straight to the head waiter.
    const w=this.queue.shift();if(!w)return;
    try{w.resolve(this.claim(s.slot));}catch(e){w.reject(e as Error);}
  }
  metrics(m:ShardMetrics) {try{this.options.onMetrics?.(m);}catch{}}
  fatal(e:Error) {this.die(e);}
  now():bigint {return monotonicNs();}
  async close():Promise<void> {
    if(this.closed)return;this.closed=true;
    const reaped=this.child.exitCode!==null||this.child.signalCode!==null?Promise.resolve():new Promise<void>(resolve=>this.child.once('close',()=>resolve()));
    this.die(Error('shard backend closed'));await reaped;
  }
}
/** What a sandbox needs from its shard; tests substitute a fake channel. */
export type ShardHost=Pick<ShardBackend,'now'|'send'|'released'|'metrics'|'fatal'>;
/** Errors thrown from receive() mean the shard itself broke the IPC contract
 * (envelope, identity, order, state) and fail the whole connection. Guest
 * payload content is tenant data: invalid content fails only this generation. */
export class ShardSandbox implements Sandbox {
  readonly exited:Promise<void>;
  private resolveExit!:()=>void;
  private state:'parked'|'running'|'done'|'releasing'|'released'='parked';
  private deadline?:number;
  private error?:Error;
  private frames:Frame[]=[];
  private waiter?:{resolve:(v:unknown)=>void;reject:(e:Error)=>void};
  private dispatcher:Dispatcher;
  private nextWire=1;
  private nextCall=1;
  private pending=new Map<number,number>();
  private wirePending=new Set<number>();
  private gotMetrics=false;
  private received=0;
  private admittedDeadlineNs=0n;
  private stopped:Promise<never>;
  private rejectStopped!:(e:Error)=>void;
  constructor(private backend:ShardHost,readonly slot:number,readonly generation:bigint) {
    this.exited=new Promise(resolve=>{this.resolveExit=resolve;});
    this.stopped=new Promise((_,reject)=>{this.rejectStopped=reject;});this.stopped.catch(()=>{});
    this.dispatcher=new Dispatcher({kill:f=>this.abandon(Error('protocol '+f.code)),message:m=>{
      if(m.t==='ready')return;
      if(this.waiter){const w=this.waiter;this.waiter=undefined;w.resolve(m);}
      else {if(this.frames.length>=34)throw Error('shard receive queue bound');this.frames.push(m);}
    }});
    this.dispatcher.feed(encode({t:'ready',v:1}));
  }
  async armDeadline(deadline:number) {
    if(!Number.isFinite(deadline)||Date.now()>=deadline)throw Error('Execution timed out');
    if(this.deadline!==undefined&&this.deadline!==deadline)throw Error('deadline already armed');
    this.deadline=deadline;
  }
  failed(e:Error) {this.rejectStopped(e);if(!this.error){this.error=e;this.frames=[];this.waiter?.reject(e);this.waiter=undefined;}this.state='released';this.resolveExit();}
  private feed(frame:unknown) {this.dispatcher.feed(encode(frame));}
  /** Fail this generation only: reject the reader and reset the slot via CANCEL. */
  private abandon(e:Error) {this.error??=e;this.kill();}
  private guest(handle:()=>void) {
    try{handle();}catch(e){this.abandon(Error('protocol '+(e instanceof ProtocolError?e.code:'HOST_ERROR')));}
  }
  private call(bytes:Buffer,wire:number) {
    const v=parseJson(bytes.toString('latin1'));
    if(Array.isArray(v)&&v.length===4&&v[0]==='call'&&typeof v[1]==='string'&&typeof v[2]==='string'&&Array.isArray(v[3])){
      const id=this.nextCall++;this.pending.set(id,wire);
      this.feed({t:'call',id,ns:v[1],fn:v[2],args:v[3]});
    }else if(Array.isArray(v)&&v.length===3&&v[0]==='log'){
      this.feed({t:'log',level:v[1],msg:v[2]});
      this.wirePending.delete(wire);
      void this.backend.send(IPC.reply,this,wire,Buffer.from('{"ok":null}')).catch(e=>this.backend.fatal(e));
    }else throw new ProtocolError('SCHEMA');
  }
  private done(bytes:Buffer) {
    const v=parseFrame(bytes.toString('latin1'));
    if(Object.hasOwn(v,'t'))throw new ProtocolError('SCHEMA');
    this.feed({...v,t:'done'});this.state='done';
  }
  receive(m:Message) {
    if(++this.received>35)throw Error('shard IPC per-run message bound');
    if(m.kind===IPC.call){if(m.id<1||m.id>32||m.bytes.length>1024)throw Error('shard IPC call bound');}
    else if(m.kind===IPC.done){if(m.id||m.bytes.length>16352)throw Error('shard IPC completion bound');}
    else if(m.kind===IPC.error){if(m.id||m.bytes.length>512)throw Error('shard IPC error bound');}
    else if(m.kind===IPC.stats){if(m.id||m.bytes.length<32||m.bytes.length>288||m.bytes.readBigUInt64LE(24)>32n||m.bytes.length!==32+8*Number(m.bytes.readBigUInt64LE(24)))throw Error('shard IPC metrics bound');}
    else if(m.kind!==IPC.released)throw Error('shard IPC direction/kind');
    if(m.kind===IPC.released){
      if(this.state!=='releasing'||m.id||m.bytes.length)throw Error('shard IPC release schema/state');
      this.state='released';this.backend.released(this);this.resolveExit();return;
    }
    if(this.state==='releasing')return; // draining this generation while reset is in progress
    if(this.state!=='running')throw Error('shard IPC run state');
    if(m.kind===IPC.call){
      if(m.id!==this.nextWire++||m.id>32||m.bytes.length>1024)throw Error('shard IPC call identity/size');
      this.wirePending.add(m.id);
      this.guest(()=>this.call(m.bytes,m.id));
    }else if(m.kind===IPC.stats){
      if(m.id||this.gotMetrics||m.bytes.length<32)throw Error('shard IPC metrics schema');
      const n=m.bytes.readBigUInt64LE(24);
      if(n>32n||m.bytes.length!==32+8*Number(n))throw Error('shard IPC metrics bound');
      this.gotMetrics=true;
      this.backend.metrics({deadlineNs:this.admittedDeadlineNs,slot:this.slot,generation:this.generation,ownerCpuNs:m.bytes.readBigUInt64LE(0),stoppedNs:m.bytes.readBigUInt64LE(8),resetDoneNs:m.bytes.readBigUInt64LE(16),roundTripsNs:Array.from({length:Number(n)},(_,i)=>m.bytes.readBigUInt64LE(32+8*i))});
    }else if(m.kind===IPC.done){
      if(m.id||m.bytes.length>16352||!this.gotMetrics||this.wirePending.size)throw Error('shard IPC done schema/outstanding');
      this.guest(()=>this.done(m.bytes));
    }else if(m.kind===IPC.error){
      if(m.id||m.bytes.length>512||!this.gotMetrics)throw Error('shard IPC error schema');
      this.error=Error(m.bytes.toString('utf8'));this.waiter?.reject(this.error);this.waiter=undefined;this.state='done';
    }else throw Error('shard IPC direction/kind');
  }
  read():Promise<unknown> {
    let next:Promise<unknown>;
    if(this.error)next=Promise.reject(this.error);
    else if(this.frames.length)next=Promise.resolve(this.frames.shift());
    else if(this.waiter)next=Promise.reject(Error('concurrent sandbox read'));
    else next=new Promise((resolve,reject)=>{this.waiter={resolve,reject};});
    // A later record in this native batch can poison an already resolved waiter.
    return next.then(value=>{if(this.error)throw this.error;return value;});
  }

  private async write(kind:number,id:number,bytes:Buffer):Promise<void> {
    // A hostile peer may withhold TX credit forever. Abort must also escape a
    // blocked admission/reply write, while channel staging remains bounded.
    await Promise.race([this.backend.send(kind,this,id,bytes),this.stopped]);
  }
  async send(value:unknown):Promise<void> {
    if(this.error)throw this.error;
    const frame=value as Frame;
    let accepted=false;
    this.dispatcher.send(frame,()=>{accepted=true;return true;});
    if(!accepted)throw Error('shard IPC send state');
    if(frame.t==='run'){
      if(this.state!=='parked'||this.deadline===undefined)throw Error('shard run requires admission deadline');
      const source=Buffer.from(shardSource(frame),'ascii');
      const remaining=Math.max(0,this.deadline-Date.now());
      if(remaining>60000)throw Error('shard deadline limit (60000 ms)');
      const payload=Buffer.alloc(IPC.startHeaderBytes+source.length);
      this.admittedDeadlineNs=this.backend.now()+BigInt(Math.floor(remaining*1e6));
      payload.writeBigUInt64LE(this.admittedDeadlineNs,0);
      payload.writeUInt32LE(IPC.calls,8);payload.writeUInt32LE(IPC.callBytes,12);payload.writeUInt32LE(source.length,16);payload.writeUInt32LE(ARENA_CLASSES['glue-2m'].admissionBytes,20);source.copy(payload,IPC.startHeaderBytes);
      this.state='running';await this.write(IPC.start,0,payload);
    }else if(frame.t==='ret'){
      const wire=this.pending.get(frame.id as number);if(wire===undefined)throw Error('shard unknown reply');
      this.pending.delete(frame.id as number);this.wirePending.delete(wire);
      let payload=Buffer.from(ascii(JSON.stringify(Object.hasOwn(frame,'ok')?{ok:frame.ok}:{err:frame.err})));
      if(payload.length>IPC.replyBytes)payload=Buffer.from(`{"err":{"code":"LIMIT","message":"shard tool reply limit (${IPC.replyBytes} bytes)"}}`);
      await this.write(IPC.reply,wire,payload);
    }else throw Error('shard host frame');
  }
  kill() {
    if(this.state==='released'||this.state==='releasing')return;
    this.state='releasing';
    this.error??=Error('sandbox exited');this.rejectStopped(this.error);
    this.waiter?.reject(this.error);this.waiter=undefined;
    void this.backend.send(IPC.cancel,this).catch(e=>this.backend.fatal(e));
  }
}
