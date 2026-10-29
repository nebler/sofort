import {spawn, type ChildProcessWithoutNullStreams} from 'node:child_process';
import {Dispatcher, LIMIT, type Frame} from '../protocol/dispatcher.js';
import {failure,v1Limits,type Engine,type GuestEvent,type Job,type Limits,type Phase,type Reply,type Session} from './engine.js';
import {executionBody} from './code.js';

export type {Engine,GuestEvent,JsJob,JsLimits,Job,Limits,NativeJob,NativeLimits,Phase,Reply,Session} from './engine.js';
/** The public name for an engine (codemode/TanStack/MCP callers construct these). */
export type Backend=Engine;
export type ProcessOptions={cwd?:string; env?:Record<string,string>; startupMs?:number; lifetimeMs?:number;
  /** Engine binary serving `process-watchdog`; defaults to JITK_WATCHDOG, then JITK_SHARD_BINARY. */ watchdog?:string};
/** One shared native deadline watchdog per binary (`hvf process-watchdog` / `real process-watchdog`,
 *  shard/src/watchdog.rs): a separate process, so it still fires while a trusted tool blocks
 *  Node's event loop, spawned once instead of per worker process. */
class Watchdog {
  private static readonly shared=new Map<string,Watchdog>();
  static for(bin:string):Watchdog {
    let w=Watchdog.shared.get(bin);
    if(!w||w.dead){w=new Watchdog(bin);Watchdog.shared.set(bin,w);}
    return w;
  }
  readonly ready:Promise<void>;
  dead?:Error;
  private readonly proc:ChildProcessWithoutNullStreams;
  private readonly vms=new Map<number,{timeout:(m:any)=>void;fail:(e:Error)=>void;armed?:{deadline:number;resolve:()=>void;reject:(e:Error)=>void}}>();
  private constructor(bin:string) {
    // EOF on its stdin (including executor death) kills every registered VM.
    this.proc=spawn(bin,['process-watchdog'],{stdio:'pipe',env:{PATH:'/usr/bin:/bin'}});
    this.proc.unref();for(const p of [this.proc.stdin,this.proc.stdout,this.proc.stderr])(p as any).unref?.();
    this.proc.stdin.on('error',()=>{});this.proc.stderr.resume();
    this.ready=new Promise<void>((resolve,reject)=>{
      let lines='';
      this.proc.stdout.on('data',(b:Buffer)=>{
        lines+=b.toString();let pos;
        while((pos=lines.indexOf('\n'))!==-1){
          const line=lines.slice(0,pos);lines=lines.slice(pos+1);
          let m:any;try{m=JSON.parse(line);}catch{this.die(Error('invalid watchdog response'));return;}
          if(m.ready===true){resolve();continue;}
          const vm=this.vms.get(m.pid);if(!vm)continue;
          if(vm.armed&&m.armed===vm.armed.deadline){vm.armed.resolve();vm.armed=undefined;}
          if(m.timeout){this.vms.delete(m.pid);vm.timeout(m);}
        }
      });
      this.proc.once('error',e=>{reject(e);this.die(e);});
      this.proc.once('close',()=>{const e=Error('watchdog exited');reject(e);this.die(e);});
    });
    this.ready.catch(()=>{});
  }
  private die(e:Error) {
    if(this.dead)return;this.dead=e;
    try{this.proc.kill('SIGKILL');}catch{}
    for(const vm of this.vms.values()){vm.armed?.reject(e);vm.fail(e);}
    this.vms.clear();
  }
  private write(line:string,onError:(e:Error)=>void) {
    if(this.dead){onError(this.dead);return;}
    this.proc.stdin.write(line,e=>{if(e)onError(e);});
  }
  add(pid:number,lifetimeMs:number,timeout:(m:any)=>void,fail:(e:Error)=>void) {
    this.vms.set(pid,{timeout,fail});
    this.write(`add ${pid} ${Math.max(1,Math.round(lifetimeMs))}\n`,fail);
  }
  arm(pid:number,deadline:number):Promise<void> {
    const vm=this.vms.get(pid);
    if(!vm)return Promise.reject(this.dead??Error('sandbox exited'));
    return new Promise<void>((resolve,reject)=>{vm.armed={deadline,resolve,reject};this.write(`arm ${pid} ${deadline}\n`,reject);});
  }
  del(pid:number) {
    const vm=this.vms.get(pid);if(!vm)return;
    this.vms.delete(pid);vm.armed?.reject(Error('sandbox exited'));
    this.write(`del ${pid}\n`,()=>{});
  }
}
function watchdogBinary(options:ProcessOptions):string {
  const bin=options.watchdog??process.env.JITK_WATCHDOG??process.env.JITK_SHARD_BINARY;
  if(!bin)throw Error('watchdog: set ProcessOptions.watchdog, JITK_WATCHDOG or JITK_SHARD_BINARY to the engine binary (`hvf`/`real`, make -C arch/jitk deps)');
  return bin;
}
export class ProcessBackend implements Backend {
  /** Protocol v1; a run lives at most the watchdog lifetime. */
  readonly limits:Limits;
  constructor(readonly kind:Backend['kind'],readonly command:string,readonly argv:string[],
    memoryMB=32,readonly options:ProcessOptions={}) {this.limits=v1Limits(memoryMB,options.lifetimeMs??60000);}
  async park(signal?:AbortSignal,deadline?:number):Promise<Session> {
    if(signal?.aborted)throw Error('aborted');
    const child=spawn(this.command,this.argv,{stdio:'pipe',detached:true,cwd:this.options.cwd,
      env:{PATH:'/usr/bin:/bin',...this.options.env}});
    const s=new ProcessSession(child,Watchdog.for(watchdogBinary(this.options)),this.options.lifetimeMs??60000,deadline);
    const abort=()=>s.release();signal?.addEventListener('abort',abort,{once:true});
    const timer=setTimeout(abort,this.options.startupMs??5000);
    try {
      const [first]:any[]=await Promise.all([s.frame(),s.watchdogReady]);
      if(first.t!=='ready'||first.v!==1)throw Error('bad ready');
      if(signal?.aborted)throw Error('aborted');
      return s;
    }catch(e){s.release();await s.released;throw e;}
    finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
  }
}
/** A worker process speaking protocol v1 on stdio (Hyperlight's, test peers). The v1
 *  Dispatcher is this adapter's decoder: frames exist only here and become GuestEvents. */
class ProcessSession implements Session {
  readonly released:Promise<void>;
  readonly watchdogReady:Promise<void>;
  deadlineReceipt?:{deadline:number;firedAt:number;killAt:number};
  private deadline?:number;
  private queue:Frame[]=[];
  private queueBytes=0;
  private waiters:{resolve:(v:unknown)=>void;reject:(e:Error)=>void}[]=[];
  private error?:Error;
  private fatalError=false;
  private output=Promise.resolve();
  private writes=0;
  private dispatcher:Dispatcher;
  /** The child has exited and its group was killed once: its pid may now belong to anyone. */
  private exited=false;
  constructor(private child:ChildProcessWithoutNullStreams,private watchdog:Watchdog,lifetimeMs:number,deadline?:number) {
    this.deadline=deadline;
    this.dispatcher=new Dispatcher({kill:f=>{this.fail(Error('protocol '+f.code));this.release();},
      message:m=>{
        const w=this.waiters.shift();
        if(w)w.resolve(m);
        else {
          const bytes=JSON.stringify(m).length;
          if(this.queue.length>=LIMIT.frames||this.queueBytes+bytes>LIMIT.wire)throw Error('receive queue limit');
          this.queue.push(m);this.queueBytes+=bytes;
        }
      }});
    const closed=new Promise<void>(resolve=>child.once('close',()=>{this.fail(Error('sandbox exited'),true);resolve();}));
    child.once('error',e=>{this.fail(e);this.release();});
    // Kill the group (any descendants) once as the leader exits; after that release() is a no-op, so a
    // late release never signals a reused pid's group.
    child.once('exit',()=>{this.release();this.exited=true;});
    child.stdout.on('data',(b:Buffer)=>{try{this.dispatcher.feed(b);}catch{/* dispatcher kills */}});
    child.stdout.once('end',()=>{try{this.dispatcher.eof();}catch{/* dispatcher kills */}});
    child.stdin.on('error',()=>{});
    let stderr=0;
    child.stderr.on('data',(b:Buffer)=>{stderr+=b.length;if(stderr>65536){this.fail(Error('stderr limit'));this.release();}});
    this.watchdogReady=Promise.resolve();
    if(child.pid) {
      const pid=child.pid;
      this.watchdogReady=watchdog.ready.then(()=>{
        watchdog.add(pid,lifetimeMs,m=>{this.deadlineReceipt=m;this.fail(Error('Execution timed out'));},e=>{this.fail(e);this.release();});
        if(deadline!==undefined)return watchdog.arm(pid,deadline);
      });
      this.watchdogReady.catch(e=>{this.fail(e);this.release();});
      // Reaped processes leave the watchdog at once; it also drops exits itself (pidfd/kqueue).
      void closed.then(()=>watchdog.del(pid));
    }
    this.released=closed;
  }
  async armDeadline(deadline:number):Promise<void> {
    if(!Number.isFinite(deadline))throw Error('invalid deadline');
    await this.watchdogReady;
    if(this.error)throw this.error;
    if(Date.now()>=deadline)throw Error('Execution timed out');
    if(this.deadline===deadline)return;
    if(this.deadline!==undefined)throw Error('deadline already armed');
    this.deadline=deadline;
    await this.watchdog.arm(this.child.pid!,deadline);
    if(Date.now()>=deadline)throw Error('Execution timed out');
  }
  private fail(e:Error,drain=false) {
    if(this.error)return;
    this.error=e;this.fatalError=!drain;
    if(!drain){this.queue=[];this.queueBytes=0;}
    for(const w of this.waiters.splice(0))w.reject(e);
  }
  get phase():Phase {
    const state=this.dispatcher.snapshot().state;
    return this.error||state==='dead'?'ended':state==='done'?'done':state==='running'?'running':'parked';
  }
  /** The next dispatcher-validated v1 frame (park() reads `ready` with it). */
  frame():Promise<unknown> {
    let p:Promise<unknown>;
    if(this.queue.length){const m=this.queue.shift()!;this.queueBytes-=JSON.stringify(m).length;p=Promise.resolve(m);}
    else if(this.error)p=Promise.reject(this.error);
    else p=new Promise((resolve,reject)=>this.waiters.push({resolve,reject}));
    // A later frame in the same read chunk may poison an already-resolved
    // waiter. Check again at the microtask boundary before exposing its value.
    return p.then(m=>{if(this.fatalError)throw this.error;return m;});
  }
  async start(job:Job):Promise<void> {
    if(job.kind!=='js')throw Error('process engines run JS jobs only');
    await this.send({t:'run',code:executionBody(job),ns:job.tools});
  }
  async next():Promise<GuestEvent> {
    let m:any;
    try{m=await this.frame();}catch(e){return failure(e);}
    // Byte, schema, state, id and budget limits already passed the dispatcher.
    if(m.t==='call')return {kind:'call',id:m.id,ns:m.ns,fn:m.fn,args:m.args};
    if(m.t==='log')return {kind:'log',level:m.level,msg:m.msg};
    if(m.t==='done')return Object.hasOwn(m,'err')?{kind:'fail',cause:'guest',message:`${m.err.name}: ${m.err.message}`}:{kind:'done',ok:m.ok};
    return {kind:'fail',cause:'engine',message:'unknown frame'};
  }
  reply(id:number,r:Reply):Promise<void> {return this.send({t:'ret',id,...r});}
  private send(frame:unknown):Promise<void> {
    // A single writer retains <=1 encoded frame, independent of pipe pressure.
    // Producers (<=64 admitted calls) keep their result until write completion.
    if(++this.writes>65){this.writes--;this.release();return Promise.reject(Error('writer producer limit'));}
    const p=this.output.then(async()=>{
      if(frame&&typeof frame==='object'&&(frame as any).t==='ret'&&this.dispatcher.snapshot().state==='done')return;
      if(this.error)throw this.error;
      let wire:Uint8Array|undefined;
      this.dispatcher.send(frame,bytes=>{wire=bytes;return true;});
      await new Promise<void>((resolve,reject)=>this.child.stdin.write(wire!,e=>e?reject(e):resolve()));
    });
    this.output=p.catch(e=>{this.fail(e);this.release();});
    return p.finally(()=>{this.writes--;});
  }
  release():void {
    if(this.exited)return;
    try{if(this.child.pid)process.kill(-this.child.pid,'SIGKILL');}catch{}
  }
}
