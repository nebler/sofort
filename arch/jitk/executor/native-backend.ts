// The persistent native worker (shard `real native-worker`, shard/ABI-R7.md
// "Persistent worker IPC") as an Engine: a session runs one NativeJob, a whole
// static program from a prepared profile, and yields its output streams and
// exit status as GuestEvents. The worker runs one job at a time, so the engine
// has one session; park() callers wait in FIFO order instead of being refused.
// Each request carries its budget: the worker stops the guest at the deadline
// itself, reports it (status 2) and stays usable; it also dies with this
// process. Node's timer only backs that up: a worker still silent
// deadlineGraceMs past the deadline, a release mid-run (there is no per-run
// cancel) or a broken worker is killed, and the next request gets a new one.
// NATIVE_RESTARTS bounds those restarts per window; past it the engine is
// unavailable until the window has passed, so a crash loop cannot spin.
// Failure messages say which: `native job failed` (that request; the worker
// is fine), `native engine failed` (the worker died or was stopped during the
// run and restarts), `native engine unavailable` (the restart budget is spent).
import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process';
import type {Engine,GuestEvent,Job,Limits,NativeJob,NativeLimits,Phase,Reply,Session} from './engine.js';
import {AdmissionQueue,type SandboxPool} from './pool.js';

/** The JNR8 request and response bounds (shard/ABI-R7.md; not yet in jitk-abi). */
export const NATIVE_LIMITS:Omit<NativeLimits,'profiles'>=Object.freeze({args:31,argvBytes:8192,files:64,pathBytes:1024,pathComponents:16,
  inputBytes:4*1024*1024,outputBytes:1024*1024});
const PROFILE=/^[A-Za-z0-9_-]{1,64}$/;
/** No lone surrogates (String.isWellFormed, ES2024). */
const wellFormed=(s:string)=>!/\p{Cs}/u.test(s);
/** Request bytes past the input files (framing, argv, paths). */
const REQUEST_SLACK=16384;
/** Response header: five u32 words after the length; a failure carries <=512 bytes. */
const RESPONSE_HEADER=20,FAILURE_BYTES=512;
/** Worker status words: success, this run failed, its budget expired (shard inputs.rs). */
const STATUS_OK=0,STATUS_FAILED=1,STATUS_DEADLINE=2;
/** A run's budget in the request (u32 ms; also the budget of a run without a deadline). */
export const MAX_BUDGET_MS=0xffffffff;
/** Worker restarts allowed per window; past them the engine is unavailable until the window has passed. */
export const NATIVE_RESTARTS=Object.freeze({max:5,windowMs:60000});
/** Past a deadline, how long the worker may take to report it before Node kills the worker. */
export const NATIVE_DEADLINE_GRACE_MS=1000;

/** A job refused before it reaches the worker. */
export class NativeJobError extends Error {
  constructor(readonly code:'LIMIT'|'UNSUPPORTED',message:string){super(message);this.name='NativeJobError';}
}
/** The JNR8 request for a job, within the limits; argv[0] is the profile; the
 *  worker stops the run budgetMs after it starts. */
export function encodeNativeJob(job:NativeJob,limits:Omit<NativeLimits,'profiles'>=NATIVE_LIMITS,budgetMs=MAX_BUDGET_MS):Buffer {
  const limit=(message:string)=>new NativeJobError('LIMIT',message);
  if(typeof job.profile!=='string'||!PROFILE.test(job.profile))throw limit('invalid tool profile');
  if(!Number.isInteger(budgetMs)||budgetMs<1||budgetMs>MAX_BUDGET_MS)throw limit('invalid native run budget');
  const {args,files}=job;
  if(!Array.isArray(args)||args.length>limits.args||args.some(a=>typeof a!=='string'||a.includes('\0')||!wellFormed(a)))
    throw limit(`args must contain at most ${limits.args} scalar strings without NUL`);
  if(!files||typeof files!=='object'||Array.isArray(files)||Object.keys(files).length>limits.files)throw limit(`files must contain at most ${limits.files} paths`);
  const argv=[job.profile,...args];
  if(argv.reduce((n,a)=>n+Buffer.byteLength(a)+1,0)>limits.argvBytes)throw limit(`argv exceeds ${limits.argvBytes} bytes`);
  const parts:Buffer[]=[Buffer.from('JNR8')];
  const u16=(n:number)=>{const b=Buffer.alloc(2);b.writeUInt16LE(n);parts.push(b);};
  const u32=(n:number)=>{const b=Buffer.alloc(4);b.writeUInt32LE(n);parts.push(b);};
  const text=(s:string)=>{const b=Buffer.from(s);u16(b.length);parts.push(b);};
  u32(budgetMs);text(job.profile);u16(argv.length);for(const a of argv)text(a);
  u16(Object.keys(files).length);
  let bytes=0;
  for(const [path,data] of Object.entries(files)){
    const components=path.split('/');
    if(!wellFormed(path)||path.includes('\0')||Buffer.byteLength(path)>limits.pathBytes||components.length>limits.pathComponents||
        components.some(c=>!c||c==='.'||c==='..'||Buffer.byteLength(c)>255))throw limit('invalid relative input path');
    if(!(data instanceof Uint8Array))throw limit('file contents must be bytes');
    bytes+=data.length;
    if(bytes>limits.inputBytes)throw limit(`input files exceed ${limits.inputBytes} bytes`);
    text(path);u32(data.length);parts.push(Buffer.from(data.buffer,data.byteOffset,data.length));
  }
  const size=parts.reduce((n,p)=>n+p.length,0);
  if(size>limits.inputBytes+REQUEST_SLACK)throw limit('native request exceeds wire budget');
  const head=Buffer.alloc(4);head.writeUInt32LE(size);
  return Buffer.concat([head,...parts],size+4);
}

export type NativeOptions={binary:string;
  /** Profile name -> prepared snapshot base; 1..16. */
  profiles:Record<string,string>;
  /** Arguments before `native-worker` (a test worker script under Node). */
  prefix?:string[];
  /** park() callers queued for the worker (default 64). */
  maxWaiting?:number;
  /** Worker restarts per window (default NATIVE_RESTARTS). */
  restarts?:{max:number;windowMs:number};
  /** Past a deadline, how long the worker may take to report it (default NATIVE_DEADLINE_GRACE_MS). */
  deadlineGraceMs?:number};
export class NativeBackend implements Engine {
  readonly kind='native' as const;
  readonly limits:Limits;
  readonly graceMs:number;
  private restarts:{max:number;windowMs:number};
  /** The live worker; none while the engine is unavailable or closed. */
  private child?:ChildProcessWithoutNullStreams;
  private exits=new Set<Promise<void>>();
  /** Start times of the workers in the current window, the first included. */
  private starts:number[]=[];
  /** Why and until when the engine is unavailable (restart budget spent). */
  private down?:{until:number;why:string};
  private active?:NativeSession;
  private queue:AdmissionQueue<NativeSession>;
  private closed?:Error;
  constructor(readonly options:NativeOptions) {
    const profiles=Object.entries(options.profiles??{});
    if(!options.binary||profiles.length<1||profiles.length>16||profiles.some(([p,b])=>!PROFILE.test(p)||typeof b!=='string'))
      throw Error('native config requires binary and 1..16 tool: snapshot-base profiles');
    this.restarts=options.restarts??NATIVE_RESTARTS;this.graceMs=options.deadlineGraceMs??NATIVE_DEADLINE_GRACE_MS;
    if(!Number.isInteger(this.restarts.max)||this.restarts.max<0||!(this.restarts.windowMs>0)||!(this.graceMs>=0))
      throw Error('invalid native restart budget or deadline grace');
    // No fixed memory class or deadline horizon: each request's budget bounds its run in the worker.
    this.limits={sessions:1,parallelStarts:1,deadlineMs:Infinity,native:{...NATIVE_LIMITS,profiles:Object.freeze(profiles.map(([p])=>p))}};
    this.queue=new AdmissionQueue('native worker',options.maxWaiting??64);
    this.starts.push(Date.now());this.spawn();
  }
  /** The live worker's pid, if any. */
  get pid():number|undefined {return this.child?.pid;}
  private spawn() {
    const {options}=this,profiles=Object.entries(options.profiles);
    const child=spawn(options.binary,[...(options.prefix??[]),'native-worker',...profiles.map(([name,base])=>`${name}=${base}`)],
      {stdio:'pipe',env:{PATH:'/usr/bin:/bin'}});
    this.child=child;
    const fail=(why:string)=>this.fail(child,why);
    child.stderr.resume(); // No guest stream travels on worker stderr.
    child.stdin.on('error',()=>fail('native worker IPC closed'));
    child.once('error',()=>fail('native worker could not start'));
    const exit=new Promise<void>(resolve=>child.once('close',()=>{fail('native worker exited');resolve();}));
    this.exits.add(exit);void exit.then(()=>this.exits.delete(exit));
    child.stdout.on('data',(b:Buffer)=>{
      if(this.child!==child)return; // a stopped worker's last bytes
      if(this.active?.inFlight)this.active.receive(b);else fail('native worker output outside a run');
    });
  }
  /** The worker broke or was stopped: kill it, fail the run it had, and start
   *  the next one within the restart budget. Stale events of an earlier worker are ignored. */
  private fail(child:ChildProcessWithoutNullStreams,why:string) {
    if(this.child!==child)return;
    this.child=undefined;
    try{child.kill('SIGKILL');}catch{}
    const s=this.active;this.active=undefined;
    if(this.closed){s?.failed(this.closed.message);this.queue.rejectAll(this.closed);return;}
    s?.failed(`sandbox exited: native engine failed (${why}); the worker restarts`);
    if(!this.restart(why)){this.queue.rejectAll(this.unavailable());return;}
    const w=this.queue.shift();if(w)w.resolve(this.claim());
  }
  /** A new worker, unless the window's restarts are spent: then the engine is unavailable until it passes. */
  private restart(why:string):boolean {
    const now=Date.now(),{max,windowMs}=this.restarts;
    this.starts=this.starts.filter(t=>now-t<windowMs);
    // The window's first worker is no restart.
    if(this.starts.length>max){this.down={until:this.starts[0]+windowMs,why};return false;}
    this.down=undefined;this.starts.push(now);this.spawn();return true;
  }
  private unavailable() {
    const {max,windowMs}=this.restarts,d=this.down!;
    return Error(`sandbox exited: native engine unavailable: ${max} worker restarts within ${windowMs/1000} s (last: ${d.why}); `+
      `retry in ${Math.max(1,Math.ceil((d.until-Date.now())/1000))} s`);
  }
  /** Stop the worker running `s` (no per-run cancel; a missed deadline). */
  stop(s:NativeSession,why:string) {if(this.active===s&&this.child)this.fail(this.child,why);}
  async park(signal?:AbortSignal,deadline?:number):Promise<Session> {
    if(signal?.aborted)throw Error('aborted');
    if(this.closed)throw this.closed;
    if(!this.child&&!this.restart(this.down?.why??'stopped'))throw this.unavailable();
    const s=this.active||this.queue.length?await this.queue.wait(signal,deadline):this.claim();
    if(signal?.aborted){s.release();await s.released;throw Error('aborted');}
    if(deadline!==undefined)try{await s.armDeadline(deadline);}catch(e){s.release();await s.released;throw e;}
    return s;
  }
  private claim():NativeSession {this.active=new NativeSession(this);return this.active;}
  /** The worker is idle again: hand it to the head waiter. */
  released(s:NativeSession) {
    if(this.active!==s)return;this.active=undefined;
    if(!this.child)return;
    const w=this.queue.shift();if(w)w.resolve(this.claim());
  }
  write(bytes:Buffer):Promise<void> {
    const child=this.child;
    if(!child)return Promise.reject(this.closed??Error('sandbox exited: native engine restarting'));
    return new Promise((resolve,reject)=>child.stdin.write(bytes,e=>e?reject(e):resolve()));
  }
  async close():Promise<void> {
    this.closed??=Error('sandbox exited: native backend closed');
    if(this.child)this.fail(this.child,'closed');
    this.queue.rejectAll(this.closed);
    await Promise.all([...this.exits]);
  }
}
type Fail=Extract<GuestEvent,{kind:'fail'}>;
class NativeSession implements Session {
  readonly released:Promise<void>;
  private resolveReleased!:()=>void;
  private state:Phase='parked';
  /** A request is with the worker: releasing now stops it, unless its deadline passed. */
  inFlight=false;
  /** Released in flight past the deadline: freed when the worker reports or is stopped. */
  private draining=false;
  private freed=false;
  private deadline?:number;
  private timer?:ReturnType<typeof setTimeout>;
  private bytes=Buffer.alloc(0);
  private events:GuestEvent[]=[];
  private waiter?:(e:GuestEvent)=>void;
  private failure?:Fail;
  constructor(private backend:NativeBackend) {this.released=new Promise(resolve=>{this.resolveReleased=resolve;});}
  get phase():Phase {return this.freed||this.failure&&this.state!=='done'?'ended':this.state;}
  async armDeadline(deadline:number) {
    if(!Number.isFinite(deadline)||Date.now()>=deadline)throw Error('Execution timed out');
    if(this.deadline===deadline)return;
    if(this.deadline!==undefined)throw Error('deadline already armed');
    this.deadline=deadline;
    this.timer=setTimeout(()=>this.expired(),deadline-Date.now());
  }
  /** The run ends now; the worker, which stops the guest at the same
   *  deadline, has the grace to report it before it is stopped. */
  private expired() {
    this.end({kind:'fail',cause:'deadline',message:'native deadline expired'});
    if(this.inFlight)this.timer=setTimeout(()=>this.backend.stop(this,'native worker missed its deadline'),this.backend.graceMs);
  }
  async start(job:Job):Promise<void> {
    if(this.failure)throw Error(this.failure.message);
    if(this.state!=='parked')throw Error('native session already started');
    if(job.kind!=='native')throw Error('the native worker runs native jobs only');
    if(!this.backend.limits.native!.profiles.includes(job.profile))throw new NativeJobError('UNSUPPORTED','unknown prepared native tool profile');
    const left=this.deadline===undefined?MAX_BUDGET_MS:Math.ceil(this.deadline-Date.now());
    const request=encodeNativeJob(job,this.backend.limits.native,Math.min(MAX_BUDGET_MS,Math.max(1,left)));
    this.state='running';this.inFlight=true;
    await this.backend.write(request);
  }
  /** Worker stdout while this session's request is in flight; any violation stops the worker. */
  receive(chunk:Buffer) {
    const die=(message:string)=>this.backend.stop(this,message);
    const max=this.backend.limits.native!.outputBytes;
    if(!this.inFlight)return die('native worker output outside a run');
    if(this.bytes.length+chunk.length>4+RESPONSE_HEADER+max)return die('native response budget');
    this.bytes=Buffer.concat([this.bytes,chunk]);
    const b=this.bytes;
    if(b.length<4)return;
    const n=b.readUInt32LE(0);
    if(n<RESPONSE_HEADER||n>RESPONSE_HEADER+max||b.length>n+4)return die('invalid native response length');
    if(b.length!==n+4)return;
    const status=b.readUInt32LE(4),exitCode=b.readUInt32LE(8),out=b.readUInt32LE(12),err=b.readUInt32LE(16),limited=b.readUInt32LE(20);
    if((status===STATUS_FAILED||status===STATUS_DEADLINE)&&n<=RESPONSE_HEADER+FAILURE_BYTES){
      // The worker reports this run failed, or stopped at its budget, and stays usable.
      const why=b.subarray(24).toString('utf8');this.complete();
      this.end(status===STATUS_DEADLINE?{kind:'fail',cause:'deadline',message:'native deadline expired: '+why}:
        {kind:'fail',cause:'engine',message:'native job failed: '+why});
      return;
    }
    if(status!==STATUS_OK||exitCode>255||limited>1||out+err!==n-RESPONSE_HEADER)return die('invalid native completion');
    this.complete();
    this.emit({kind:'stdout',bytes:b.subarray(24,24+out)});
    this.emit({kind:'stderr',bytes:b.subarray(24+out)});
    this.emit({kind:'done',ok:{exitCode,outputLimited:limited===1}});
  }
  private complete() {
    this.inFlight=false;this.state='done';this.bytes=Buffer.alloc(0);clearTimeout(this.timer);
    if(this.draining)this.free();
  }
  private emit(e:GuestEvent) {
    if(this.failure)return;
    if(this.waiter){const w=this.waiter;this.waiter=undefined;w(e);}else this.events.push(e);
  }
  /** A failure preempts queued events. */
  private end(f:Fail) {
    if(this.failure)return;
    this.failure=f;this.events=[];
    const w=this.waiter;this.waiter=undefined;w?.(f);
  }
  /** The worker died or was stopped: this session ends with it. */
  failed(message:string) {
    this.end({kind:'fail',cause:'engine',message});
    this.inFlight=false;this.state='ended';clearTimeout(this.timer);
    if(!this.freed){this.freed=true;this.resolveReleased();}
  }
  next():Promise<GuestEvent> {
    if(this.failure)return Promise.resolve(this.failure);
    if(this.events.length)return Promise.resolve(this.events.shift()!);
    if(this.waiter)return Promise.resolve({kind:'fail',cause:'engine',message:'concurrent sandbox read'});
    return new Promise(resolve=>{this.waiter=resolve;});
  }
  async reply(_id:number,_r:Reply):Promise<void> {throw Error('native jobs make no tool calls');}
  release():void {
    if(this.freed||this.draining)return;
    this.end({kind:'fail',cause:'engine',message:'sandbox exited'});
    if(this.inFlight){
      // Past its deadline the worker is stopping the guest itself: wait for its report (the grace timer backs it).
      if(this.failure!.cause==='deadline'){this.draining=true;return;}
      // No per-run cancel: a release mid-run stops the worker (failed() follows).
      clearTimeout(this.timer);this.backend.stop(this,'native run cancelled');return;
    }
    clearTimeout(this.timer);this.free();
  }
  private free() {
    this.freed=true;if(this.state!=='done')this.state='ended';
    this.resolveReleased();this.backend.released(this);
  }
}

export type NativeResult={stdout:Uint8Array;stderr:Uint8Array;exitCode:number;outputLimited:boolean};
export type NativeError={error:{code:'LIMIT'|'UNSUPPORTED'|'TIMEOUT'|'CANCELLED'|'SANDBOX';message:string}};
/** Runs native jobs on a pool over a native engine; the codes are the MCP `run` tool's. */
export class NativeExecutor {
  constructor(readonly pool:SandboxPool,readonly timeout=10000) {}
  async run(job:NativeJob,options:{signal?:AbortSignal;timeout?:number}={}):Promise<NativeResult|NativeError> {
    const error=(code:NativeError['error']['code'],message:string):NativeError=>({error:{code,message}});
    const {signal}=options;
    const limits=this.pool.backend.limits.native;
    if(!limits)return error('UNSUPPORTED','engine runs no native jobs');
    if(signal?.aborted)return error('CANCELLED','native run cancelled');
    // Refuse a bad job before it waits for, or finds stopped, the worker.
    if(!limits.profiles.includes(job.profile))return error('UNSUPPORTED','unknown prepared native tool profile');
    try{encodeNativeJob(job,limits);}catch(e){if(e instanceof NativeJobError)return error(e.code,e.message);throw e;}
    let s:Session|undefined;
    const stop=()=>s?.release();
    signal?.addEventListener('abort',stop,{once:true});
    try {
      s=await this.pool.acquire(signal,Date.now()+(options.timeout??this.timeout));
      if(signal?.aborted)return error('CANCELLED','native run cancelled');
      await s.start(job);
      let stdout:Uint8Array=new Uint8Array(),stderr:Uint8Array=new Uint8Array();
      while(true){
        const ev=await s.next();
        if(signal?.aborted)return error('CANCELLED','native run cancelled; the worker restarts');
        if(ev.kind==='stdout')stdout=ev.bytes;
        else if(ev.kind==='stderr')stderr=ev.bytes;
        else if(ev.kind==='done'){const ok=ev.ok as {exitCode:number;outputLimited:boolean};return {stdout,stderr,exitCode:ok.exitCode,outputLimited:ok.outputLimited};}
        else if(ev.kind==='fail')return error(ev.cause==='deadline'?'TIMEOUT':ev.cause==='limit'?'LIMIT':'SANDBOX',ev.message);
        else return error('SANDBOX',`engine sent a ${ev.kind} event to a native job`);
      }
    }catch(e){
      if(signal?.aborted)return error('CANCELLED','native run cancelled');
      if(e instanceof NativeJobError)return error(e.code,e.message);
      const message=e instanceof Error?e.message:String(e);
      return error(/timed out/.test(message)?'TIMEOUT':/overloaded/.test(message)?'LIMIT':'SANDBOX',message);
    }finally{
      signal?.removeEventListener('abort',stop);
      if(s)void this.pool.release(s).catch(()=>{});
    }
  }
}
