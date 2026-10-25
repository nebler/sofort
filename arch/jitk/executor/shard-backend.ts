import {spawn,type ChildProcess} from 'node:child_process';
import {Dispatcher,encode,parseFrame,type Frame} from '../protocol/dispatcher.js';
import type {Backend,Sandbox} from './backend.js';
import {IPC,SharedChannel,monotonicNs,type Message} from './shard-ipc.js';

export type ShardMetrics={deadlineNs:bigint;slot:number;generation:bigint;ownerCpuNs:bigint;stoppedNs:bigint;resetDoneNs:bigint;roundTripsNs:bigint[]};
export type ShardOptions={binary:string;snapshot:string;slots?:number;owners?:number;onMetrics?:(m:ShardMetrics)=>void};
const ascii=(s:string)=>s.replace(/[\u007f-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
/** Adapt the existing executor body to the prepared ring profile's single raw
 * transport capability. The provider registry, policy and credentials stay in Node. */
export function shardSource(frame:Frame):string {
  const names=Object.keys(frame.ns as object);
  let prefix='__jitk_ring_';while(names.some(name=>name.startsWith(prefix)))prefix+='_';
  const providers=names.map(name=>`const ${name}=new Proxy(Object.create(null),{get:(_t,k)=>k==='then'?undefined:(...a)=>${prefix}call(${JSON.stringify(name)},k,a)});`).join('\n');
  const source=`return await(async(${prefix}transport)=>{
const ${prefix}logs=[],${prefix}pending=new Set();
const ${prefix}call=(ns,fn,args)=>{const p=${prefix}transport.echo('call',ns,fn,args).then(r=>{if(Object.hasOwn(r,'err')){const e=new Error(r.err.message);e.code=r.err.code;throw e;}return r.ok;});${prefix}pending.add(p);p.then(()=>${prefix}pending.delete(p),()=>${prefix}pending.delete(p));return p;};
const console=Object.fromEntries(['log','info','warn','error','debug'].map(level=>[level,(...a)=>{const p=${prefix}transport.echo('log',level,a.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' '));p.catch(()=>{});${prefix}logs.push(p);}]));
${providers}
let ${prefix}result;try{${prefix}result=await(async()=>{${frame.code}\n})();if(${prefix}pending.size)throw Error('unawaited calls at completion');}catch(e){throw {name:String(e&&e.name||'Error').slice(0,128),message:String(e&&e.message||e).slice(0,4096)};}finally{await Promise.allSettled([...${prefix}pending]);await Promise.all(${prefix}logs);}return ${prefix}result;
})(tools);`;
  // Encode source as a JSON string, then parse its original Unicode in the
  // guest. Escaping source tokens directly would change String.raw/RegExp.source.
  const wire=`return await(new(Object.getPrototypeOf(async function(){}).constructor)('tools','run',${ascii(JSON.stringify(source))}))(tools,run);`;
  if(Buffer.byteLength(wire)>8192)throw Error('shard source limit including trusted adapters (8192 bytes)');
  return wire;
}

export class ShardBackend implements Backend {
  readonly kind='shard' as const;
  readonly memoryLimitMB=2;
  readonly ready:Promise<void>;
  readonly child:ChildProcess;
  private channel:SharedChannel;
  private sandboxes=new Map<number,ShardSandbox>();
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
    const slots=options.slots??64,owners=options.owners??4;
    if(!Number.isInteger(slots)||slots<1||slots>64||!Number.isInteger(owners)||owners<1||owners>4)throw Error('shard capacity limit');
    this.generations=Array<bigint>(slots).fill(0n);
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
    for(const s of this.sandboxes.values())s.failed(e);this.sandboxes.clear();
  }
  private receive(m:Message) {
    if(m.kind===IPC.ready){
      if(this.didReady||m.slot||m.generation||m.id||m.bytes.length)throw Error('shard IPC ready schema');
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
    const slot=this.generations.findIndex((_,i)=>!this.sandboxes.has(i));
    if(slot<0)throw Error('shard pool saturated');
    const generation=++this.generations[slot];
    if(generation>=1n<<62n)throw Error('shard generation exhausted');
    const s=new ShardSandbox(this,slot,generation);this.sandboxes.set(slot,s);
    if(deadline!==undefined)try{await s.armDeadline(deadline);}catch(e){s.kill();await s.exited;throw e;}
    return s;
  }
  send(kind:number,s:ShardSandbox,id=0,bytes:Buffer=Buffer.alloc(0)):Promise<void> {return this.channel.send({kind,slot:s.slot,generation:s.generation,id,bytes});}
  released(s:ShardSandbox) {if(this.sandboxes.get(s.slot)!==s)throw Error('shard release identity');this.sandboxes.delete(s.slot);}
  metrics(m:ShardMetrics) {try{this.options.onMetrics?.(m);}catch{}}
  fatal(e:Error) {this.die(e);}
  async close():Promise<void> {
    if(this.closed)return;this.closed=true;
    const reaped=this.child.exitCode!==null||this.child.signalCode!==null?Promise.resolve():new Promise<void>(resolve=>this.child.once('close',()=>resolve()));
    this.die(Error('shard backend closed'));await reaped;
  }
}
class ShardSandbox implements Sandbox {
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
  constructor(private backend:ShardBackend,readonly slot:number,readonly generation:bigint) {
    this.exited=new Promise(resolve=>{this.resolveExit=resolve;});
    this.stopped=new Promise((_,reject)=>{this.rejectStopped=reject;});this.stopped.catch(()=>{});
    this.dispatcher=new Dispatcher({kill:f=>{this.backend.fatal(Error('protocol '+f.code));},message:m=>{
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
      const v=parseFrame(`{"args":${m.bytes.toString('latin1')}}`).args;
      if(!Array.isArray(v))throw Error('shard IPC call schema');
      this.wirePending.add(m.id);
      if(v.length===4&&v[0]==='call'&&typeof v[1]==='string'&&typeof v[2]==='string'&&Array.isArray(v[3])){
        const id=this.nextCall++;this.pending.set(id,m.id);
        this.feed({t:'call',id,ns:v[1],fn:v[2],args:v[3]});
      }else if(v.length===3&&v[0]==='log'){
        this.feed({t:'log',level:v[1],msg:v[2]});
        this.wirePending.delete(m.id);
        void this.backend.send(IPC.reply,this,m.id,Buffer.from('{"ok":null}')).catch(e=>this.backend.fatal(e));
      }else throw Error('shard IPC call schema');
    }else if(m.kind===IPC.stats){
      if(m.id||this.gotMetrics||m.bytes.length<32)throw Error('shard IPC metrics schema');
      const n=m.bytes.readBigUInt64LE(24);
      if(n>32n||m.bytes.length!==32+8*Number(n))throw Error('shard IPC metrics bound');
      this.gotMetrics=true;
      this.backend.metrics({deadlineNs:this.admittedDeadlineNs,slot:this.slot,generation:this.generation,ownerCpuNs:m.bytes.readBigUInt64LE(0),stoppedNs:m.bytes.readBigUInt64LE(8),resetDoneNs:m.bytes.readBigUInt64LE(16),roundTripsNs:Array.from({length:Number(n)},(_,i)=>m.bytes.readBigUInt64LE(32+8*i))});
    }else if(m.kind===IPC.done){
      if(m.id||m.bytes.length>16352||!this.gotMetrics||this.wirePending.size)throw Error('shard IPC done schema/outstanding');
      const text=m.bytes.toString('latin1');if(text[0]!=='{')throw Error('shard IPC done JSON');
      this.feed(parseFrame('{"t":"done",'+text.slice(1)));this.state='done';
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
      const payload=Buffer.alloc(24+source.length);
      this.admittedDeadlineNs=monotonicNs()+BigInt(Math.floor(remaining*1e6));
      payload.writeBigUInt64LE(this.admittedDeadlineNs,0);
      payload.writeUInt32LE(32,8);payload.writeUInt32LE(1024,12);payload.writeUInt32LE(source.length,16);payload.writeUInt32LE(2*1048576,20);source.copy(payload,24);
      this.state='running';await this.write(IPC.start,0,payload);
    }else if(frame.t==='ret'){
      const wire=this.pending.get(frame.id as number);if(wire===undefined)throw Error('shard unknown reply');
      this.pending.delete(frame.id as number);this.wirePending.delete(wire);
      let payload=Buffer.from(ascii(JSON.stringify(Object.hasOwn(frame,'ok')?{ok:frame.ok}:{err:frame.err})));
      if(payload.length>1024)payload=Buffer.from('{"err":{"code":"LIMIT","message":"shard tool reply limit (1024 bytes)"}}');
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
