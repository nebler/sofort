import {spawn, type ChildProcessWithoutNullStreams} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {Dispatcher, LIMIT, type Frame} from './dispatcher.js';

export interface Sandbox {
  readonly exited:Promise<void>;
  read():Promise<unknown>;
  send(frame:unknown):Promise<void>;
  kill():void;
}
export interface Backend {
  readonly kind:'jitk'|'local-qjs';
  readonly memoryLimitMB:number;
  park(signal?:AbortSignal):Promise<Sandbox>;
}
export type ProcessOptions={cwd?:string; env?:Record<string,string>; startupMs?:number; lifetimeMs?:number};
export class ProcessBackend implements Backend {
  constructor(readonly kind:Backend['kind'],readonly command:string,readonly argv:string[],
    readonly memoryLimitMB=32,readonly options:ProcessOptions={}) {}
  async park(signal?:AbortSignal):Promise<Sandbox> {
    if(signal?.aborted)throw Error('aborted');
    const child=spawn(this.command,this.argv,{stdio:'pipe',detached:true,cwd:this.options.cwd,
      env:{PATH:'/usr/bin:/bin',...this.options.env}});
    const s=new ProcessSandbox(child,this.options.lifetimeMs??60000);
    const abort=()=>s.kill();signal?.addEventListener('abort',abort,{once:true});
    const timer=setTimeout(abort,this.options.startupMs??5000);
    try {
      const first:any=await s.read();
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
    super('local-qjs',qjs,['--memory-limit',String(memoryLimitMB*1048576),'--stack-size','524288','-m',
      fileURLToPath(new URL('../bootstrap.js',import.meta.url))],memoryLimitMB,options);
  }
}
export type JitkOptions=ProcessOptions & {launcher:'01-vmm'|'02-r2';image:string;memoryLimitMB?:number};
export class JitkBackend extends ProcessBackend {
  constructor(vmm:string,config:JitkOptions) {
    const mem=config.memoryLimitMB??32;
    if(mem!==32&&mem!==64)throw Error('jitk RAM must be 32 or 64 MiB');
    if(config.launcher==='02-r2'&&mem!==32)throw Error('02 launcher supports only 32 MiB');
    // Both observed launchers are Rust + panic=abort, one inout port. 01 applies
    // Seatbelt before build; 02 is an integration host, containment not yet merged.
    super('jitk',vmm,config.launcher==='01-vmm'?['--image',config.image,'--mem-mib',String(mem)]:[config.image],mem,config);
  }
}
class ProcessSandbox implements Sandbox {
  readonly exited:Promise<void>;
  private queue:Frame[]=[];
  private queueBytes=0;
  private waiters:{resolve:(v:unknown)=>void;reject:(e:Error)=>void}[]=[];
  private error?:Error;
  private fatalError=false;
  private output=Promise.resolve();
  private writes=0;
  private dispatcher:Dispatcher;
  private watchdog?:ChildProcessWithoutNullStreams;
  constructor(private child:ChildProcessWithoutNullStreams,lifetimeMs:number) {
    this.dispatcher=new Dispatcher({kill:f=>{this.fail(Error('protocol '+f.code));this.kill();},
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
    child.once('error',e=>{this.fail(e);this.kill();});
    child.stdout.on('data',(b:Buffer)=>{try{this.dispatcher.feed(b);}catch{/* dispatcher kills */}});
    child.stdout.once('end',()=>{try{this.dispatcher.eof();}catch{/* dispatcher kills */}});
    child.stdin.on('error',()=>{});
    let stderr=0;
    child.stderr.on('data',(b:Buffer)=>{stderr+=b.length;if(stderr>65536){this.fail(Error('stderr limit'));this.kill();}});
    let watchdogClosed:Promise<void>=Promise.resolve();
    if(child.pid) {
      // Separate process still fires if a trusted tool blocks Node's event loop.
      const w=spawn('/usr/bin/python3',[fileURLToPath(new URL('../watchdog.py',import.meta.url)),
        String(child.pid),String(lifetimeMs/1000)],{stdio:'pipe',env:{PATH:'/usr/bin:/bin'}});
      this.watchdog=w;
      watchdogClosed=new Promise(resolve=>w.once('close',resolve));
      w.stdin.on('error',()=>{});w.stdout.resume();w.stderr.resume();
      w.once('error',e=>{this.fail(e);this.kill();});
      // The watchdog is done once the owned VMM was reaped, even if Python has
      // not initialized yet. No orphaned watchdog or VM at capacity release.
      void closed.then(()=>w.kill('SIGKILL'));
    }
    this.exited=Promise.all([closed,watchdogClosed]).then(()=>{});
  }
  private fail(e:Error,drain=false) {
    if(this.error)return;
    this.error=e;this.fatalError=!drain;
    if(!drain){this.queue=[];this.queueBytes=0;}
    for(const w of this.waiters.splice(0))w.reject(e);
  }
  read():Promise<unknown> {
    let p:Promise<unknown>;
    if(this.queue.length){const m=this.queue.shift()!;this.queueBytes-=JSON.stringify(m).length;p=Promise.resolve(m);}
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
      await new Promise<void>((resolve,reject)=>this.child.stdin.write(wire!,e=>e?reject(e):resolve()));
    });
    this.output=p.catch(e=>{this.fail(e);this.kill();});
    return p.finally(()=>{this.writes--;});
  }
  kill():void {
    try{if(this.child.pid)process.kill(-this.child.pid,'SIGKILL');}catch{}
    this.watchdog?.stdin.end();
  }
}
