import {verifyPreparedSnapshot} from './prepared-helpers.mjs';
import {spawn,type ChildProcess} from 'node:child_process';
import {LIMIT,ProtocolError,RunBudget,checkCall,checkCode,checkDone,checkLog,checkReply,checkTools,parseFrame,parseJson} from '../protocol/dispatcher.js';
import type {Engine,GuestEvent,Job,Limits,Phase,Reply,Session} from './engine.js';
import {failure} from './engine.js';
import {executionBody} from './code.js';
import {AdmissionQueue} from './pool.js';
import {ARENA_CLASSES} from './abi.js';
import {ABI_VERSION,IPC,PipeChannel,SharedChannel,checkReady,monotonicNs,type Channel,type Message} from './shard-ipc.js';

/** How long after a run's deadline the engine may take to report its end
 *  before Node kills it: well past the engines' own escalation (KVM watchdog,
 *  HVF zygote: 100 ms after the deadline) plus a reset. */
export const DEADLINE_GRACE_MS=1000;
/** CANCEL to RELEASED/QUARANTINED: the engine kicks the vCPU at once and
 *  resets the slot or quarantines it (KVM: the CANCEL kicks the slot's owner
 *  thread out of KVM_RUN, also while another of its slots runs; HVF: the
 *  reader kicks, within the zygote's 1 s reset grace, RESET_GRACE_NS);
 *  silence past this bound means the engine itself is stuck. */
export const RELEASE_GRACE_MS=3000;
export type ShardMetrics={deadlineNs:bigint;slot:number;generation:bigint;ownerCpuNs:bigint;stoppedNs:bigint;resetDoneNs:bigint;roundTripsNs:bigint[]};
/** A slot the shard took out of service (IPC QUARANTINED): `lost` of `slots` are out of service now.
 *  On Linux a lost slot never returns; the HVF engine re-forks it and reports RESTORED. */
export type ShardQuarantine={slot:number;generation:bigint;reason:string;lost:number;slots:number};
/** A quarantined slot back in service (IPC RESTORED, HVF): `lost` of `slots` are still out. */
export type ShardRestore={slot:number;generation:bigint;lost:number;slots:number};
/** maxWaiting bounds park() callers queued for a free slot (default max(64, 4 x slots)).
 *  onQuarantine/onRestore observe lost and returned capacity; without them each is one stderr line. */
export type ShardOptions={binary:string;snapshot:string;slots?:number;owners?:number;maxWaiting?:number;onMetrics?:(m:ShardMetrics)=>void;onQuarantine?:(q:ShardQuarantine)=>void;onRestore?:(r:ShardRestore)=>void};
const ascii=(s:string)=>s.replace(/[\u007f-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
/** Bind tenant code to helpers already compiled in restored guest memory. */
export function shardSource(code:string,names:string[]):string {
  const wire=shardWire(code,names);
  if(Buffer.byteLength(wire)>IPC.sourceBytes)throw Error(`shard source limit including trusted adapters (${IPC.sourceBytes} bytes)`);
  return wire;
}
/** The START source for a guest body, unchecked; the parity corpus sizes its
 *  source boundary cases with it (executor/parity/cases.ts). UTF-8: the run
 *  body, NUL, then the tenant code as data, which the prepared helper compiles
 *  (kernel/ring-bootstrap.js.in decodes it once). So it is LIMIT.code plus a
 *  bounded adapter and always fits ring::SOURCE_LIMIT; the run body drops its
 *  reference so the arena holds the code text once. */
export function shardWire(code:string,names:string[]):string {
  return `return await globalThis.__jitkPrepared.source(tools,[data,data=undefined][0],${JSON.stringify(names)});\0"use strict";\n${code}`;
}

/** The ring profile's limits (jitk-abi, executor/ipc/ABI.md) for a shard of this many slots:
 *  the console path's (protocol/dispatcher.ts LIMIT) but for the arena-bound memory. */
export function shardLimits(slots:number):Limits {
  const arena=ARENA_CLASSES['glue-2m'];
  return {memoryMB:arena.admissionBytes/(1<<20),sessions:slots,parallelStarts:slots,deadlineMs:IPC.deadlineHorizonNs/1e6,
    js:{code:LIMIT.code,sourceBytes:IPC.sourceBytes,calls:IPC.calls,callBytes:IPC.callBytes,replyBytes:IPC.replyBytes,doneBytes:IPC.doneBytes,
      logs:LIMIT.logs,logBytes:LIMIT.log,timers:true,arenaBytes:arena.arenaBytes}};
}

/** The ring engine over the IPC of executor/ipc/ABI.md. On Linux it is the
 *  KVM shard (kind 'shard': owner threads, shared-memory queues). On macOS
 *  arm64 it is the HVF engine (kind 'hvf', shard/src/hvf/zygote.rs): the same
 *  messages over a stream socket to a zygote with one confined engine process
 *  per slot; `owners` does not apply. Both run the same prepared snapshot
 *  format, guest kernel and limits. */
export class ShardBackend implements Engine {
  readonly kind:'shard'|'hvf'=process.platform==='darwin'?'hvf':'shard';
  readonly limits:Limits;
  readonly ready:Promise<void>;
  readonly child:ChildProcess;
  private channel:Channel;
  private sessions=new Map<number,ShardSession>();
  private queue:AdmissionQueue<ShardSession>;
  private generations:bigint[];
  /** Slots the shard reported QUARANTINED and not RESTORED: never claimed. */
  private lost=new Set<number>();
  private dead?:Error;
  private resolveReady!:()=>void;
  private rejectReady!:(e:Error)=>void;
  private didReady=false;
  private startup:ReturnType<typeof setTimeout>;
  private closed=false;
  private readonly onExit=()=>this.child.kill('SIGKILL');
  constructor(readonly options:ShardOptions) {
    const hvf=process.platform==='darwin';
    if(process.platform!=='linux'&&!(hvf&&process.arch==='arm64'))throw Error('shard backend requires Linux (KVM) or macOS arm64 (HVF)');
    verifyPreparedSnapshot(options.snapshot,ABI_VERSION);
    const slots=options.slots??(hvf?8:64),owners=options.owners??4;
    if(!Number.isInteger(slots)||slots<1||slots>64||!Number.isInteger(owners)||owners<1||owners>4)throw Error('shard capacity limit');
    this.limits=shardLimits(slots);this.generations=Array<bigint>(slots).fill(0n);this.queue=new AdmissionQueue('shard pool',options.maxWaiting??Math.max(64,4*slots));
    this.ready=new Promise<void>((resolve,reject)=>{this.resolveReady=resolve;this.rejectReady=reject;});this.ready.catch(()=>{});
    // Exactly these descriptors and a credential-free environment are inherited.
    if(hvf){
      this.child=spawn(options.binary,['ipc',options.snapshot,String(slots)],{stdio:['ignore','ignore','pipe','pipe'],env:{PATH:'/usr/bin:/bin'}});
      this.channel=new PipeChannel(this.child.stdio[3] as import('node:stream').Duplex,m=>this.receive(m),e=>this.die(e));
    }else{
      const channel=new SharedChannel(m=>this.receive(m),e=>this.die(e));this.channel=channel;
      this.child=spawn(options.binary,['ipc',options.snapshot,String(slots),String(owners)],{stdio:['ignore','ignore','pipe',...channel.fds],env:{PATH:'/usr/bin:/bin'}});
    }
    process.once('exit',this.onExit);
    let stderr=0;
    this.child.stderr!.on('data',(b:Buffer)=>{stderr+=b.length;if(stderr>65536)this.die(Error('shard stderr limit'));});
    this.child.once('error',e=>this.die(e));
    this.child.once('close',()=>{process.removeListener('exit',this.onExit);this.die(Error('sandbox exited: shard'));});
    this.startup=setTimeout(()=>this.die(Error('shard startup timeout')),5000);
  }
  private die(e:Error,graceful=false) {
    if(this.dead)return;this.dead=e;clearTimeout(this.startup);this.rejectReady(e);
    // HVF: closing the socket makes the zygote kill and reap its engine
    // processes before it exits (no orphans); SIGKILL if it does not, soon.
    if(graceful&&this.kind==='hvf'&&this.child.exitCode===null&&this.child.signalCode===null)setTimeout(()=>this.child.kill('SIGKILL'),1000).unref();
    else this.child?.kill('SIGKILL');
    this.channel?.close();
    for(const s of this.sessions.values())s.failed(e);this.sessions.clear();this.queue.rejectAll(e);
  }
  private receive(m:Message) {
    if(m.kind===IPC.ready){
      if(this.didReady)throw Error('shard IPC ready schema');
      checkReady(m);
      this.didReady=true;clearTimeout(this.startup);this.resolveReady();return;
    }
    if(!this.didReady||m.slot>=this.generations.length||m.generation===0n)throw Error('shard IPC peer slot/state');
    if(m.kind===IPC.restored){this.restored(m);return;}
    const s=this.sessions.get(m.slot);
    // Unsolicited and stale messages fail the whole untrusted shard closed.
    if(!s||m.generation!==s.generation)throw Error('shard IPC stale generation');
    s.receive(m);
  }
  async park(signal?:AbortSignal,deadline?:number):Promise<Session> {
    if(signal?.aborted)throw Error('aborted');
    if(signal){
      let abort!:()=>void;
      try{await Promise.race([this.ready,new Promise<never>((_,reject)=>{abort=()=>reject(Error('aborted'));signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();})]);}
      finally{signal.removeEventListener('abort',abort);}
    }else await this.ready;
    if(this.dead)throw this.dead;
    if(signal?.aborted)throw Error('aborted');
    // All slots busy or resetting: wait in FIFO order; released() hands over.
    const slot=this.queue.length?-1:this.generations.findIndex((_,i)=>!this.sessions.has(i)&&!this.lost.has(i));
    const s=slot<0?await this.queue.wait(signal,deadline):this.claim(slot);
    if(signal?.aborted){s.release();await s.released;throw Error('aborted');}
    if(deadline!==undefined)try{await s.armDeadline(deadline);}catch(e){s.release();await s.released;throw e;}
    return s;
  }
  private claim(slot:number):ShardSession {
    const generation=++this.generations[slot];
    if(generation>=1n<<62n)throw Error('shard generation exhausted');
    const s=new ShardSession(this,slot,generation);this.sessions.set(slot,s);return s;
  }
  send(kind:number,s:ShardSession,id=0,bytes:Buffer=Buffer.alloc(0)):Promise<void> {return this.channel.send({kind,slot:s.slot,generation:s.generation,id,bytes});}
  /** Physical slots, and those out of service after a quarantine (capacity is slots - lost). */
  get capacity() {return {slots:this.generations.length,lost:this.lost.size};}
  released(s:ShardSession,quarantine?:string) {
    if(this.sessions.get(s.slot)!==s)throw Error('shard release identity');this.sessions.delete(s.slot);
    if(quarantine!==undefined){this.quarantined(s,quarantine);return;}
    // The slot just finished its reset: give it straight to the head waiter.
    const w=this.queue.shift();if(!w)return;
    try{w.resolve(this.claim(s.slot));}catch(e){w.reject(e as Error);}
  }
  /** The slot is out of service: account for it and report it. On Linux it
   *  never returns, so the shard fails once none is left; the HVF engine
   *  re-forks it (RESTORED, or the engine fails closed on a crash loop). */
  private quarantined(s:ShardSession,reason:string) {
    this.lost.add(s.slot);
    const q:ShardQuarantine={slot:s.slot,generation:s.generation,reason,lost:this.lost.size,slots:this.generations.length};
    if(this.options.onQuarantine)try{this.options.onQuarantine(q);}catch{}
    else process.stderr.write(`jitk shard: slot ${q.slot} quarantined (${reason}); capacity ${q.slots-q.lost}/${q.slots}\n`);
    if(this.kind==='shard'&&this.lost.size===this.generations.length)this.die(Error(`shard capacity lost: all ${q.slots} slots quarantined`));
  }
  /** A quarantined slot serves again at the generation its QUARANTINED
   *  ended: count it, report it, give it to the head waiter. */
  private restored(m:Message) {
    if(this.kind!=='hvf'||!this.lost.has(m.slot)||this.sessions.has(m.slot)||m.generation!==this.generations[m.slot]||m.id||m.bytes.length)throw Error('shard IPC restore schema/state');
    this.lost.delete(m.slot);
    const r:ShardRestore={slot:m.slot,generation:m.generation,lost:this.lost.size,slots:this.generations.length};
    if(this.options.onRestore)try{this.options.onRestore(r);}catch{}
    else process.stderr.write(`jitk shard: slot ${r.slot} restored; capacity ${r.slots-r.lost}/${r.slots}\n`);
    const w=this.queue.shift();if(!w)return;
    try{w.resolve(this.claim(m.slot));}catch(e){w.reject(e as Error);}
  }
  metrics(m:ShardMetrics) {try{this.options.onMetrics?.(m);}catch{}}
  fatal(e:Error) {this.die(e);}
  now():bigint {return monotonicNs();}
  async close():Promise<void> {
    if(this.closed)return;this.closed=true;
    const reaped=this.child.exitCode!==null||this.child.signalCode!==null?Promise.resolve():new Promise<void>(resolve=>this.child.once('close',()=>resolve()));
    this.die(Error('shard backend closed'),true);await reaped;
  }
}
/** What a session needs from its shard; tests substitute a fake channel. */
export type ShardHost=Pick<ShardBackend,'now'|'send'|'released'|'metrics'|'fatal'>;
type Fail=Extract<GuestEvent,{kind:'fail'}>;
/** The host side of one slot generation's run, in one place: what a pause/fork
 * would have to capture next to the slot's guest memory (R9 N12). */
type ShardRun={
  phase:'parked'|'running'|'done'|'releasing'|'released';
  /** Guest call ids, open calls and the log budget, under the v1 limits. */
  budget:RunBudget;
  /** Call id -> the ring CALL id that awaits its REPLY (the same number since logs left the call ids, ABI 11). */
  wires:Map<number,number>;
  /** Next expected CALL id (<=IPC.calls). */
  nextWire:number;
  /** Messages received this generation (<=IPC.messagesPerGeneration). */
  records:number;
  stats:boolean;
  admittedDeadlineNs:bigint;
};
/** Errors thrown from receive() mean the shard itself broke the IPC contract
 * (envelope, identity, order, state) and fail the whole connection. Guest
 * payload content is tenant data: invalid content fails only this generation.
 * Records decode straight into GuestEvents: one parse under the protocol
 * limits, the v1 field validators and a RunBudget; no v1 frames. */
export class ShardSession implements Session {
  readonly released:Promise<void>;
  private resolveReleased!:()=>void;
  private run:ShardRun={phase:'parked',budget:new RunBudget(),wires:new Map(),nextWire:1,records:0,stats:false,admittedDeadlineNs:0n};
  private deadline?:number;
  private overdue?:ReturnType<typeof setTimeout>;
  private failure?:Fail;
  private events:GuestEvent[]=[];
  private waiter?:(e:GuestEvent)=>void;
  private stopped:Promise<never>;
  private rejectStopped!:(e:Error)=>void;
  constructor(private backend:ShardHost,readonly slot:number,readonly generation:bigint) {
    this.released=new Promise(resolve=>{this.resolveReleased=resolve;});
    this.stopped=new Promise((_,reject)=>{this.rejectStopped=reject;});this.stopped.catch(()=>{});
  }
  get phase():Phase {
    const p=this.run.phase;
    return this.failure||p==='releasing'||p==='released'?'ended':p;
  }
  async armDeadline(deadline:number) {
    if(!Number.isFinite(deadline)||Date.now()>=deadline)throw Error('Execution timed out');
    if(this.deadline!==undefined&&this.deadline!==deadline)throw Error('deadline already armed');
    this.deadline=deadline;
  }
  failed(e:Error) {this.disarm();this.rejectStopped(e);this.end({...failure(e),cause:'engine'});this.run.phase='released';this.resolveReleased();}
  /** The supervisor's end of the run deadline (shard/README.md, "Deadlines"):
   *  the engine stops a run at its deadline and reports DONE/ERROR (or, after
   *  CANCEL, RELEASED); if none arrives DEADLINE_GRACE_MS later, the engine
   *  is past enforcing its own deadlines and Node kills it. release() re-arms
   *  it for the reset: RELEASED must follow CANCEL within RELEASE_GRACE_MS,
   *  also after a completed run. The check waits a
   *  setImmediate so that I/O already received is processed first. */
  private arm(ms:number,missed:string) {
    this.overdue=setTimeout(()=>setImmediate(()=>{
      if(this.overdue===undefined)return;
      this.backend.fatal(Error(`shard missed a deadline: slot ${this.slot} generation ${this.generation} ${missed}`));
    }),ms);
    this.overdue.unref();
  }
  private disarm() {clearTimeout(this.overdue);this.overdue=undefined;}
  private emit(e:GuestEvent) {
    if(this.waiter){const w=this.waiter;this.waiter=undefined;w(e);}
    // Open calls, every log line, then the completion.
    else {if(this.events.length>=IPC.outstanding+IPC.logs+2)throw Error('shard receive queue bound');this.events.push(e);}
  }
  /** A session failure preempts queued events: no tool runs after it. */
  private end(f:Fail) {
    if(this.failure)return;
    this.failure=f;this.events=[];
    const w=this.waiter;this.waiter=undefined;w?.(f);
  }
  /** Fail this generation only: end the reader and reset the slot via CANCEL. */
  private abandon(e:Error) {this.end({kind:'fail',cause:'guest',message:e.message});this.release();}
  private guest(handle:()=>void) {
    try{handle();}catch(e){this.abandon(Error('protocol '+(e instanceof ProtocolError?e.code:'HOST_ERROR')));}
  }
  /** Host-built content that fails a protocol check also ends only this generation. */
  private host<T>(build:()=>T):T {
    try{return build();}catch(e){if(e instanceof ProtocolError)this.abandon(Error('protocol '+e.code));throw e;}
  }
  private call(bytes:Buffer,wire:number) {
    const v=parseJson(bytes.toString('latin1'));
    if(!Array.isArray(v)||v.length!==4||v[0]!=='call')throw new ProtocolError('SCHEMA');
    const [,ns,fn,args]=v;checkCall(ns,fn,args);
    const id=this.run.budget.next;this.run.budget.call(id,bytes.length);this.run.wires.set(id,wire);
    this.emit({kind:'call',id,ns:ns as string,fn:fn as string,args:args as unknown[]});
  }
  /** A console line: one-way, under the v1 log budget (RunBudget.log). */
  private log(bytes:Buffer) {
    const v=parseJson(bytes.toString('latin1'));
    if(!Array.isArray(v)||v.length!==2)throw new ProtocolError('SCHEMA');
    const [level,msg]=v;checkLog(level,msg);this.run.budget.log(msg as string);
    this.emit({kind:'log',level:level as string,msg:msg as string});
  }
  private done(bytes:Buffer) {
    const v=parseFrame(bytes.toString('latin1'));checkDone(v);
    const ok=Object.hasOwn(v,'ok');
    this.run.budget.done(ok);this.run.phase='done';
    const err=v.err as {name:string;message:string};
    this.emit(ok?{kind:'done',ok:v.ok}:{kind:'fail',cause:'guest',message:`${err.name}: ${err.message}`});
  }
  receive(m:Message) {
    const run=this.run;
    if(++run.records>IPC.messagesPerGeneration)throw Error('shard IPC per-run message bound');
    const rounds=IPC.statsRoundTrips;
    if(m.kind===IPC.call){if(m.id<1||m.id>IPC.calls||m.bytes.length>IPC.callBytes)throw Error('shard IPC call bound');}
    else if(m.kind===IPC.log){if(m.id||m.bytes.length>IPC.consoleBytes)throw Error('shard IPC log bound');}
    else if(m.kind===IPC.done){if(m.id||m.bytes.length>IPC.doneBytes)throw Error('shard IPC completion bound');}
    else if(m.kind===IPC.error){if(m.id||m.bytes.length>IPC.errorBytes)throw Error('shard IPC error bound');}
    else if(m.kind===IPC.stats){if(m.id||m.bytes.length<IPC.statsFixedBytes||m.bytes.length>IPC.statsFixedBytes+8*rounds||m.bytes.readBigUInt64LE(24)>BigInt(rounds)||m.bytes.length!==IPC.statsFixedBytes+8*Number(m.bytes.readBigUInt64LE(24)))throw Error('shard IPC metrics bound');}
    else if(m.kind!==IPC.released&&m.kind!==IPC.quarantined)throw Error('shard IPC direction/kind');
    // DONE/ERROR drained during a reset leave the reset's own bound armed.
    if((m.kind===IPC.done||m.kind===IPC.error)&&run.phase!=='releasing'||m.kind===IPC.released||m.kind===IPC.quarantined)this.disarm();
    // RELEASED, or QUARANTINED with its reason, ends the generation Node cancelled.
    if(m.kind===IPC.released||m.kind===IPC.quarantined){
      const reason=m.kind===IPC.quarantined?m.bytes.toString('latin1'):undefined;
      if(run.phase!=='releasing'||m.id||(reason===undefined?m.bytes.length:!/^[\x20-\x7e]+$/.test(reason)||m.bytes.length>IPC.errorBytes))throw Error('shard IPC release schema/state');
      run.phase='released';this.backend.released(this,reason);this.resolveReleased();return;
    }
    if(run.phase==='releasing')return; // draining this generation while reset is in progress
    if(run.phase!=='running')throw Error('shard IPC run state');
    if(m.kind===IPC.call){
      if(m.id!==run.nextWire++||m.id>IPC.calls||m.bytes.length>IPC.callBytes)throw Error('shard IPC call identity/size');
      this.guest(()=>this.call(m.bytes,m.id));
    }else if(m.kind===IPC.log){
      this.guest(()=>this.log(m.bytes));
    }else if(m.kind===IPC.stats){
      if(m.id||run.stats||m.bytes.length<IPC.statsFixedBytes)throw Error('shard IPC metrics schema');
      const n=m.bytes.readBigUInt64LE(24);
      if(n>BigInt(rounds)||m.bytes.length!==IPC.statsFixedBytes+8*Number(n))throw Error('shard IPC metrics bound');
      run.stats=true;
      this.backend.metrics({deadlineNs:run.admittedDeadlineNs,slot:this.slot,generation:this.generation,ownerCpuNs:m.bytes.readBigUInt64LE(0),stoppedNs:m.bytes.readBigUInt64LE(8),resetDoneNs:m.bytes.readBigUInt64LE(16),roundTripsNs:Array.from({length:Number(n)},(_,i)=>m.bytes.readBigUInt64LE(32+8*i))});
    }else if(m.kind===IPC.done){
      if(m.id||m.bytes.length>IPC.doneBytes||!run.stats||run.wires.size)throw Error('shard IPC done schema/outstanding');
      this.guest(()=>this.done(m.bytes));
    }else if(m.kind===IPC.error){
      if(m.id||m.bytes.length>IPC.errorBytes||!run.stats)throw Error('shard IPC error schema');
      const text=m.bytes.toString('utf8');
      this.end({kind:'fail',cause:/^deadline/.test(text)?'deadline':/^memory_bound/.test(text)?'limit':/^slot_/.test(text)?'engine':'guest',message:text});run.phase='done';
    }else throw Error('shard IPC direction/kind');
  }
  next():Promise<GuestEvent> {
    let next:Promise<GuestEvent>;
    if(this.failure)next=Promise.resolve(this.failure);
    else if(this.events.length)next=Promise.resolve(this.events.shift()!);
    else if(this.waiter)return Promise.resolve({kind:'fail',cause:'engine',message:'concurrent sandbox read'});
    else next=new Promise(resolve=>{this.waiter=resolve;});
    // A later record in this native batch can poison an already resolved waiter.
    return next.then(e=>this.failure??e);
  }

  private async write(kind:number,id:number,bytes:Buffer):Promise<void> {
    // A hostile peer may withhold TX credit forever. Abort must also escape a
    // blocked admission/reply write, while channel staging remains bounded.
    await Promise.race([this.backend.send(kind,this,id,bytes),this.stopped]);
  }
  async start(job:Job):Promise<void> {
    if(this.failure)throw Error(this.failure.message);
    if(job.kind!=='js')throw Error('the shard runs JS jobs only');
    if(this.run.phase!=='parked'||this.deadline===undefined)throw Error('shard run requires admission deadline');
    const code=executionBody(job,true);
    this.host(()=>{checkCode(code);checkTools(job.tools);});
    const source=Buffer.from(shardSource(code,Object.keys(job.tools)),'utf8');
    const remaining=Math.max(0,this.deadline-Date.now());
    if(remaining>60000)throw Error('shard deadline limit (60000 ms)');
    const payload=Buffer.alloc(IPC.startHeaderBytes+source.length);
    this.run.admittedDeadlineNs=this.backend.now()+BigInt(Math.floor(remaining*1e6));
    payload.writeBigUInt64LE(this.run.admittedDeadlineNs,0);
    payload.writeUInt32LE(IPC.calls,8);payload.writeUInt32LE(IPC.callBytes,12);payload.writeUInt32LE(source.length,16);payload.writeUInt32LE(ARENA_CLASSES['glue-2m'].admissionBytes,20);source.copy(payload,IPC.startHeaderBytes);
    this.run.phase='running';this.arm(remaining+DEADLINE_GRACE_MS,`reported no end ${DEADLINE_GRACE_MS} ms after it`);await this.write(IPC.start,0,payload);
  }
  async reply(id:number,r:Reply):Promise<void> {
    if(this.failure)throw Error(this.failure.message);
    const wire=this.run.wires.get(id);if(wire===undefined)throw Error('shard unknown reply');
    // One encode: the protocol's host-output limits apply to exactly these bytes;
    // parseJson's frame bound (LIMIT.frame) is ring::REPLY_BYTES, so a reply
    // over it fails this generation as it fails a console-path run.
    const text=this.host(()=>{
      let s:string|undefined;
      try{s=JSON.stringify(r);}catch{throw new ProtocolError('SERIALIZE');}
      if(s===undefined)throw new ProtocolError('SERIALIZE');
      s=ascii(s);checkReply(parseJson(s));return s;
    });
    this.run.wires.delete(id);this.run.budget.reply(id);
    const payload=Buffer.from(text);
    if(payload.length>IPC.replyBytes)throw Error('shard reply bound');
    await this.write(IPC.reply,wire,payload);
  }
  release() {
    if(this.run.phase==='released'||this.run.phase==='releasing')return;
    this.run.phase='releasing';
    this.disarm();this.arm(RELEASE_GRACE_MS,`acknowledged no reset ${RELEASE_GRACE_MS} ms after CANCEL`);
    this.end({kind:'fail',cause:'engine',message:'sandbox exited'});this.rejectStopped(Error(this.failure!.message));
    void this.backend.send(IPC.cancel,this).catch(e=>this.backend.fatal(e));
  }
}
