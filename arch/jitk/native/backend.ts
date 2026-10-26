import {spawn, type ChildProcess} from 'node:child_process';
import {execFileSync} from 'node:child_process';
import {dirname,join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {Dispatcher, LIMIT, type Frame} from './protocol.js';

import type {Sandbox,Backend} from './types.js';
export type ProcessOptions={cwd?:string; env?:Record<string,string>; startupMs?:number; lifetimeMs?:number;requireSandboxAck?:boolean;
  /** jitk-vmm binary providing `--watchdog`; defaults to JITK_WATCHDOG, then JITK_VMM_BINARY. */ watchdog?:string};
/** One shared native deadline watchdog per binary (vmm/src/watchdog.rs): a separate process, so it
 *  still fires while a trusted tool blocks Node's event loop, spawned once instead of per VM. */
class Watchdog {
  private static readonly shared=new Map<string,Watchdog>();
  static for(bin:string):Watchdog {
    let w=Watchdog.shared.get(bin);
    if(!w||w.dead){w=new Watchdog(bin);Watchdog.shared.set(bin,w);}
    return w;
  }
  readonly ready:Promise<void>;
  readonly exited:Promise<void>;
  static async closeAll():Promise<void> {
    const all:Promise<void>[]=[];for(const w of Watchdog.shared.values()){w.proc.stdin!.end();all.push(w.exited);}
    Watchdog.shared.clear();await Promise.all(all);
  }
  dead?:Error;
  private readonly proc:ChildProcess;
  private readonly vms=new Map<number,{timeout:(m:any)=>void;fail:(e:Error)=>void;armed?:{deadline:number;resolve:()=>void;reject:(e:Error)=>void}}>();
  private constructor(bin:string) {
    // EOF on its stdin (including executor death) kills every registered VM.
    this.proc=spawn(bin,['--watchdog'],{stdio:'pipe',env:{PATH:'/usr/bin:/bin'}});
    
    this.exited=new Promise<void>(resolve=>this.proc.once('close',()=>resolve()));
    this.proc.stdin!.on('error',()=>{});this.proc.stderr!.on('data',()=>{});
    this.ready=new Promise<void>((resolve,reject)=>{
      let lines='';
      this.proc.stdout!.on('data',(b:Buffer)=>{
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
    try{this.proc.stdin!.write(line);}catch(e){onError(e instanceof Error?e:Error(String(e)));}
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
// glibc's malloc THP backs the VMM heap with huge pages: -5.99 MiB/VM on Linux (research/perf/linux-ledger).
const LINUX_MALLOC_ENV:Record<string,string>=process.platform==='linux'?{GLIBC_TUNABLES:'glibc.malloc.hugetlb=0'}:{};
function watchdogBinary(options:ProcessOptions):string {
  const bin=options.watchdog??process.env.JITK_WATCHDOG??process.env.JITK_VMM_BINARY;
  if(!bin)throw Error('watchdog: set ProcessOptions.watchdog, JITK_WATCHDOG or JITK_VMM_BINARY to a jitk-vmm binary');
  return bin;
}
export class ProcessBackend implements Backend {
  constructor(readonly kind:Backend['kind'],readonly command:string,readonly argv:string[],
    readonly memoryLimitMB=32,readonly options:ProcessOptions={}) {}
  async close():Promise<void>{await Watchdog.closeAll();}
  async park(signal?:AbortSignal,deadline?:number):Promise<Sandbox> {
    if(signal?.aborted)throw Error('aborted');
    const args:string[]=['-i','PATH=/usr/bin:/bin'];
    if(this.options.env)for(const k of Object.keys(this.options.env))args.push(k+'='+this.options.env[k]);
    args.push(this.command);for(const a of this.argv)args.push(a);
    const child=spawn('/usr/bin/env',args,{stdio:'pipe',detached:true,cwd:this.options.cwd||process.cwd()});
    const s=new ProcessSandbox(child,Watchdog.for(watchdogBinary(this.options)),this.options.lifetimeMs??60000,this.options.requireSandboxAck??false,deadline);
    const abort=()=>s.kill();signal?.addEventListener('abort',abort,{once:true});
    const timer=setTimeout(abort,this.options.startupMs??5000);
    try {
      const first:any=await s.read();await s.confined;await s.watchdogReady;
      if(first.t!=='ready'||first.v!==1)throw Error('bad ready');
      if(signal?.aborted)throw Error('aborted');
      return s;
    }catch(e){s.kill();await s.exited;throw e;}
    finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
  }
}
// UNSAFE development backend: QuickJS std/os can access the host filesystem.
export class LocalProcessQjsBackend extends ProcessBackend {
  constructor(qjs:string,memoryLimitMB=32,options:ProcessOptions={}) {
    super('local-qjs',qjs,['--memory-limit',String(memoryLimitMB*1048576),'--stack-size','524288','--std','-e',
      readFileSync(new URL('../protocol/bootstrap.js',import.meta.url),'utf8')],memoryLimitMB,options);
  }
}
const profiles=new Map<string,string>();
let profileDirectory:string|undefined;
function compiledProfile(vmm:string,image:string):string {
  const key=createHash('sha256').update(readFileSync(vmm)).update(dirname(image)).digest('hex');
  const cached=profiles.get(key);if(cached)return cached;
  if(!profileDirectory){
    profileDirectory=mkdtempSync(join(tmpdir(),'jitk-executor-profiles-'));
    process.once('exit',()=>rmSync(profileDirectory!,{recursive:true,force:true}));
  }
  const path=join(profileDirectory,`${key}.sbbin`);
  execFileSync(vmm,['--compile-profile',path,'--images',dirname(image)],{stdio:'pipe',timeout:10000});
  profiles.set(key,path);return path;
}
export type JitkOptions=ProcessOptions & {launcher:'01-vmm'|'02-r2';image:string;memoryLimitMB?:number;sandboxProfile?:string};
export class JitkBackend extends ProcessBackend {
  constructor(vmm:string,config:JitkOptions) {
    const mem=config.memoryLimitMB??32;
    if(mem!==32&&mem!==64)throw Error('jitk RAM must be 32 or 64 MiB');
    if(config.launcher==='02-r2'&&mem!==32)throw Error('02 launcher supports only 32 MiB');
    const requireSandboxAck=config.requireSandboxAck??config.launcher==='01-vmm';
    const sandboxProfile=config.sandboxProfile??(requireSandboxAck&&process.platform==='darwin'?compiledProfile(vmm,config.image):undefined);
    config={...config,requireSandboxAck,sandboxProfile};
    if(config.launcher==='01-vmm')config.watchdog??=vmm;
    super('jitk',vmm,config.launcher==='01-vmm'?['--image',config.image,'--mem-mib',String(mem),...(sandboxProfile?['--sandbox-profile',sandboxProfile]:[])]:[config.image],mem,config);
  }
}
class ProcessSandbox implements Sandbox {
  readonly exited:Promise<void>;
  readonly confined:Promise<void>;
  readonly watchdogReady:Promise<void>;
  deadlineReceipt?:{deadline:number;firedAt:number;killAt:number};
  private deadline?:number;
  private rejectConfined?:(e:Error)=>void;
  private queue:string[]=[];
  private queueBytes=0;
  private waiters:{resolve:(v:unknown)=>void;reject:(e:Error)=>void}[]=[];
  private error?:Error;
  private fatalError=false;
  private output=Promise.resolve();
  private writes=0;
  private dispatcher:Dispatcher;
  constructor(private child:ChildProcess,private watchdog:Watchdog,lifetimeMs:number,requireSandboxAck:boolean,deadline?:number) {
    this.deadline=deadline;
    let acknowledge=()=>{};
    this.confined=requireSandboxAck?new Promise<void>((resolve,reject)=>{acknowledge=resolve;this.rejectConfined=reject;}):Promise.resolve();
    this.dispatcher=new Dispatcher({kill:f=>{this.fail(Error('protocol '+f.code));this.kill();},
      message:m=>{
        const w=this.waiters.shift();
        if(w)w.resolve(m);
        else {
          const bytes=JSON.stringify(m).length;
          if(this.queue.length>=LIMIT.frames||this.queueBytes+bytes>LIMIT.wire)throw Error('receive queue limit');
          this.queue.push(JSON.stringify(m));this.queueBytes+=bytes;
        }
      }});
    const closed=new Promise<void>(resolve=>child.once('close',()=>{this.fail(Error('sandbox exited'),true);resolve();}));
    child.once('error',e=>{this.fail(e);this.kill();});
    child.stdout!.on('data',(b:Buffer)=>{try{this.dispatcher.feed(b);}catch{/* dispatcher kills */}});
    child.stdout!.once('end',()=>{try{this.dispatcher.eof();}catch{/* dispatcher kills */}});
    child.stdin!.on('error',()=>{});
    let stderr=0;
    let hostLines='';
    child.stderr!.on('data',(b:Buffer)=>{stderr+=b.length;if(stderr>65536){this.fail(Error('stderr limit'));this.kill();return;}
      hostLines+=b.toString('utf8');let pos;
      while((pos=hostLines.indexOf('\n'))!==-1){const line=hostLines.slice(0,pos);hostLines=hostLines.slice(pos+1);if(line==='{"sandbox":"ok"}')acknowledge();}
    });
    this.watchdogReady=Promise.resolve();
    if(child.pid) {
      const pid=child.pid;
      this.watchdogReady=watchdog.ready.then(()=>{
        watchdog.add(pid,lifetimeMs,m=>{this.deadlineReceipt=m;this.fail(Error('Execution timed out'));},e=>{this.fail(e);this.kill();});
        if(deadline!==undefined)return watchdog.arm(pid,deadline);
      });
      this.watchdogReady.catch(e=>{this.fail(e);this.kill();});
      // Reaped VMMs leave the watchdog at once; it also drops exits itself (pidfd/kqueue).
      void closed.then(()=>watchdog.del(pid));
    }
    this.exited=closed;
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
    this.error=e;this.fatalError=!drain;this.rejectConfined?.(e);
    if(!drain){this.queue=[];this.queueBytes=0;}
    for(const w of this.waiters.splice(0))w.reject(e);
  }
  read():Promise<unknown> {
    let p:Promise<unknown>;
    if(this.queue.length){const m=this.queue.shift()!;this.queueBytes-=m.length;p=Promise.resolve(JSON.parse(m));}
    else if(this.error)p=Promise.reject(this.error);
    else p=new Promise((resolve,reject)=>this.waiters.push({resolve,reject}));
    // A later frame in the same read chunk may poison an already-resolved
    // waiter. Check again at the microtask boundary before exposing its value.
    return p.then(m=>{if(this.fatalError)throw this.error;return m;});
  }
  send(frame:unknown):Promise<void> {
    // A single writer retains <=1 encoded frame, independent of pipe pressure.
    // Producers (<=64 admitted calls) keep their result until write completion.
    if(++this.writes>65){this.writes--;this.kill();return Promise.reject(Error('writer producer limit'));}
    const p=this.output.then(async()=>{
      if(frame&&typeof frame==='object'&&(frame as any).t==='ret'&&this.dispatcher.snapshot().state==='done')return;
      if(this.error)throw this.error;
      let wire:Uint8Array|undefined;
      this.dispatcher.send(frame,bytes=>{wire=bytes;return true;});
      if(!this.child.stdin!.write(wire!))await new Promise<void>((resolve,reject)=>{this.child.stdin!.once('drain',resolve);this.child.stdin!.once('error',reject);});
    });
    this.output=p.catch(e=>{this.fail(e);this.kill();});
    return p.finally(()=>{this.writes--;});
  }
  kill():void {
    try{if(this.child.pid)process.kill(-this.child.pid,'SIGKILL');}catch{}
  }
}

export type {Backend,Sandbox} from './types.js';
