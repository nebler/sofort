// The persistent native worker (shard `real native-worker`, shard/ABI-R7.md
// "Persistent worker IPC") as an Engine: a session runs one NativeJob, a whole
// static program from a prepared profile, and yields its output streams and
// exit status as GuestEvents. The worker runs one job at a time, so the engine
// has one session; park() callers wait in FIFO order instead of being refused.
// A deadline or a release mid-run kills the whole worker (it has no per-run
// cancel); later park() calls fail until the engine is rebuilt.
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
  maxWaiting?:number};
export class NativeBackend implements Engine {
  readonly kind='native' as const;
  readonly limits:Limits;
  private child:ChildProcessWithoutNullStreams;
  private closed:Promise<void>;
  private active?:NativeSession;
  private queue:AdmissionQueue<NativeSession>;
  private dead?:Error;
  constructor(readonly options:NativeOptions) {
    const profiles=Object.entries(options.profiles??{});
    if(!options.binary||profiles.length<1||profiles.length>16||profiles.some(([p,b])=>!PROFILE.test(p)||typeof b!=='string'))
      throw Error('native config requires binary and 1..16 tool: snapshot-base profiles');
    // No fixed memory class or deadline horizon: the Node deadline bounds a run.
    this.limits={sessions:1,parallelStarts:1,deadlineMs:Infinity,native:{...NATIVE_LIMITS,profiles:Object.freeze(profiles.map(([p])=>p))}};
    this.queue=new AdmissionQueue('native worker',options.maxWaiting??64);
    this.child=spawn(options.binary,[...(options.prefix??[]),'native-worker',...profiles.map(([name,base])=>`${name}=${base}`)],
      {stdio:'pipe',env:{PATH:'/usr/bin:/bin'}});
    this.child.stderr.resume(); // No guest stream travels on worker stderr.
    this.child.stdin.on('error',()=>this.die(Error('sandbox exited: native worker IPC closed')));
    this.child.once('error',()=>this.die(Error('sandbox exited: native worker could not start')));
    this.closed=new Promise(resolve=>this.child.once('close',()=>{this.die(Error('sandbox exited: native worker exited'));resolve();}));
    this.child.stdout.on('data',(b:Buffer)=>{if(this.active)this.active.receive(b);else this.die(Error('sandbox exited: native worker output outside a run'));});
  }
  /** Kill the worker: the running session fails and every waiter is rejected. */
  die(e:Error) {
    if(this.dead)return;this.dead=e;
    try{this.child.kill('SIGKILL');}catch{}
    this.active?.failed(e);this.queue.rejectAll(this.stopped());
  }
  private stopped(){return Error(`sandbox exited: native worker is stopped (${this.dead!.message}); restart the MCP server`);}
  async park(signal?:AbortSignal,deadline?:number):Promise<Session> {
    if(signal?.aborted)throw Error('aborted');
    if(this.dead)throw this.stopped();
    const s=this.active||this.queue.length?await this.queue.wait(signal,deadline):this.claim();
    if(signal?.aborted){s.release();await s.released;throw Error('aborted');}
    if(deadline!==undefined)try{await s.armDeadline(deadline);}catch(e){s.release();await s.released;throw e;}
    return s;
  }
  private claim():NativeSession {this.active=new NativeSession(this);return this.active;}
  /** The worker is idle again: hand it to the head waiter. */
  released(s:NativeSession) {
    if(this.active!==s)return;this.active=undefined;
    if(this.dead)return;
    const w=this.queue.shift();if(w)w.resolve(this.claim());
  }
  write(bytes:Buffer):Promise<void> {
    if(this.dead)return Promise.reject(this.stopped());
    return new Promise((resolve,reject)=>this.child.stdin.write(bytes,e=>e?reject(e):resolve()));
  }
  async close():Promise<void> {this.die(Error('native backend closed'));await this.closed;}
}
type Fail=Extract<GuestEvent,{kind:'fail'}>;
class NativeSession implements Session {
  readonly released:Promise<void>;
  private resolveReleased!:()=>void;
  private state:Phase='parked';
  /** A request is with the worker: releasing now kills it. */
  private inFlight=false;
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
    this.timer=setTimeout(()=>{
      this.end({kind:'fail',cause:'deadline',message:'native deadline expired; worker stopped'});
      if(this.inFlight)this.backend.die(Error('native deadline expired'));
    },deadline-Date.now());
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
  /** Worker stdout while this session's request is in flight; any violation kills the worker. */
  receive(chunk:Buffer) {
    const die=(message:string)=>this.backend.die(Error('sandbox exited: '+message));
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
        {kind:'fail',cause:'engine',message:why});
      return;
    }
    if(status!==STATUS_OK||exitCode>255||limited>1||out+err!==n-RESPONSE_HEADER)return die('invalid native completion');
    this.complete();
    this.emit({kind:'stdout',bytes:b.subarray(24,24+out)});
    this.emit({kind:'stderr',bytes:b.subarray(24+out)});
    this.emit({kind:'done',ok:{exitCode,outputLimited:limited===1}});
  }
  private complete() {this.inFlight=false;this.state='done';this.bytes=Buffer.alloc(0);clearTimeout(this.timer);}
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
  /** The worker died: this session ends and its capacity is gone with it. */
  failed(e:Error) {
    this.end({kind:'fail',cause:'engine',message:e.message});
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
    if(this.freed)return;
    clearTimeout(this.timer);
    this.end({kind:'fail',cause:'engine',message:'sandbox exited'});
    // The worker has no per-run cancel: a release mid-run stops it (failed() follows).
    if(this.inFlight){this.backend.die(Error('native run cancelled'));return;}
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
        if(signal?.aborted)return error('CANCELLED','native run cancelled; worker stopped');
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
