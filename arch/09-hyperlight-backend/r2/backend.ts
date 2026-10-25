import {spawn, type ChildProcessWithoutNullStreams} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import type {Backend, Sandbox} from '../../04-executor-ts/r2/backend.ts';
// Read-only copy of 03's 2026-10-24 R2 dispatcher. It owns all v1 validation.
import {Dispatcher, type Frame} from './protocol.ts';

// 04 restricts its product kind union to jitk|local-qjs. The baseline adds a
// truthful discriminator while implementing the entire lifecycle contract.
export type BaselineBackend = Omit<Backend,'kind'> & {readonly kind:'hyperlight-js'};
export class HyperlightBackend implements BaselineBackend {
  readonly kind = 'hyperlight-js' as const;
  readonly isolation = 'strict-single-use' as const;
  readonly memoryLimitMB = 16; // JS guest heap; process/HVF overhead is additional.
  constructor(readonly worker:string, readonly snapshot:string,
    readonly watchdogMs=5000) {}
  async park(signal?:AbortSignal):Promise<Sandbox> {
    if (signal?.aborted) throw Error('aborted');
    const child=spawn(this.worker,['strict',this.snapshot],
      {env:{},stdio:'pipe',detached:true});
    const s=new HyperlightSandbox(child,this.watchdogMs,signal);
    try {
      const m=await s.read() as Frame;
      if (m.t!=='ready' || m.v!==1) throw Error('bad ready');
      return s;
    } catch(e) {s.kill();await s.exited;throw e;}
  }
}
class HyperlightSandbox implements Sandbox {
  readonly exited:Promise<void>;
  private queue:Frame[]=[];
  private waiters:{resolve:(m:Frame)=>void;reject:(e:Error)=>void}[]=[];
  private error?:Error;
  private dispatcher:Dispatcher;
  constructor(private child:ChildProcessWithoutNullStreams,watchdogMs:number,signal?:AbortSignal) {
    const fail=(e:Error,drain=false)=>{
      if (this.error) return;
      if (!drain) this.queue=[];
      this.error=e;for(const w of this.waiters.splice(0))w.reject(e);
    };
    this.dispatcher=new Dispatcher({
      kill:f=>{fail(Error(f.code));this.kill();},
      message:m=>{
        const w=this.waiters.shift();if(w)w.resolve(m);else this.queue.push(m);
        if(this.queue.length>128)this.dispatcher.cancel('QUEUE_LIMIT');
      }
    });
    const timer=setTimeout(()=>{fail(Error('watchdog deadline'));this.kill();},watchdogMs);
    const abort=()=>{fail(Error('aborted'));this.kill();};
    signal?.addEventListener('abort',abort,{once:true});
    const closed=new Promise<void>(resolve=>child.once('close',()=>{
      clearTimeout(timer);signal?.removeEventListener('abort',abort);
      try{this.dispatcher.eof();}catch{}
      fail(Error('worker exited'),true);resolve();
    }));
    // This still fires if a trusted tool blocks Node's event loop.
    const watchdog=spawn('/usr/bin/python3',[fileURLToPath(new URL('./watchdog.py',import.meta.url)),
      String(child.pid),String(watchdogMs/1000)],{stdio:'pipe',env:{}});
    watchdog.stdin.on('error',()=>{});watchdog.stdout.resume();watchdog.stderr.resume();
    const reaped=new Promise<void>(resolve=>watchdog.once('close',()=>resolve()));
    watchdog.once('error',e=>{fail(e);this.kill();});
    void closed.then(()=>watchdog.kill('SIGKILL'));
    this.exited=Promise.all([closed,reaped]).then(()=>{});
    child.once('error',e=>{fail(e);this.kill();});
    child.stdin.on('error',e=>{fail(e);this.kill();});
    let stderr=0;
    child.stderr.on('data',(b:Buffer)=>{if((stderr+=b.length)>65536){fail(Error('stderr limit'));this.kill();}});
    child.stdout.on('data',(b:Buffer)=>{try{this.dispatcher.feed(b);}catch{}});
  }
  read():Promise<unknown> {
    if(this.queue.length)return Promise.resolve(this.queue.shift());
    if(this.error)return Promise.reject(this.error);
    return new Promise((resolve,reject)=>this.waiters.push({resolve,reject}));
  }
  async send(frame:unknown):Promise<void> {
    if(this.error)throw this.error;
    const sent=this.dispatcher.send(frame,wire=>{
      if(this.child.stdin.writableLength+wire.length>2097152)return false;
      this.child.stdin.write(wire);return true;
    });
    if(!sent){this.kill();throw Error('backpressure limit');}
  }
  kill():void {
    try{process.kill(-this.child.pid!,'SIGKILL');}catch{}
  }
}
