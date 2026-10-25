import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { StringDecoder } from 'node:string_decoder';
import type { Executor, ExecuteResult, ResolvedProvider, ExecuteOptions } from '@cloudflare/codemode';
import type { IsolateDriver, IsolateConfig, IsolateContext, ExecutionResult } from '@tanstack/ai-code-mode';
import { normalizeCode, sanitizeToolName } from './upstream.js';
import {parse,stringify} from './codec.mjs';

export type Label = 'user' | 'model' | 'tool-untrusted' | 'host-trusted';
export type Call = Readonly<{id:number; ns:string; fn:string; args:unknown[]}>;
export type Context = Readonly<{executionId:string; signal:AbortSignal; provenance:readonly Label[]}>;
export type Decision = 'allow' | 'deny' | 'requireApproval';
export type Policy = (call:Call, ctx:Context) => Decision | Promise<Decision>;
export interface Sandbox {
  readonly exited:Promise<void>;
  read():Promise<unknown>;
  send(frame:unknown):Promise<void>;
  kill():void;
}
export interface Backend {
  readonly kind:'jitk'|'hyperlight-js'|'local-process-qjs';
  readonly memoryLimitMB:number;
  // Resolves ONLY after {t:'ready',version:1}; launch is separately bounded.
  park(signal?:AbortSignal):Promise<Sandbox>;
}
export class ProcessBackend implements Backend {
  constructor(readonly kind:Backend['kind'], readonly command:string,
    readonly argv:string[], readonly memoryLimitMB=128, readonly cwd?:string) {}
  async park(signal?:AbortSignal):Promise<Sandbox> {
    if (signal?.aborted) throw new Error('aborted');
    const child=spawn(this.command,this.argv,{stdio:'pipe',detached:true,cwd:this.cwd,env:{PATH:'/usr/bin:/bin'}});
    const s=new ProcessSandbox(child);
    const timer=setTimeout(()=>s.kill(),5000);
    const abort=()=>s.kill(); signal?.addEventListener('abort',abort,{once:true});
    try {
      const first=await s.read();
      if (!first || typeof first!=='object' || (first as any).t!=='ready' || (first as any).version!==1) throw new Error('bad ready');
      if(signal?.aborted) throw new Error('aborted');
      return s;
    } catch(e) { s.kill(); await s.exited; throw e; }
    finally {clearTimeout(timer);signal?.removeEventListener('abort',abort);}
  }
}
export class LocalProcessQjsBackend extends ProcessBackend {
  constructor(qjs:string, memoryLimitMB=128,cwd?:string) {
    super('local-process-qjs',qjs,['--memory-limit',String(memoryLimitMB*1048576),fileURLToPath(new URL('./guest.mjs',import.meta.url))],memoryLimitMB,cwd);
  }
}
export class JitkBackend extends ProcessBackend {
  constructor(vmm:string, memoryLimitMB=128) {
    // Proposed jitk-vmm CLI; not implemented by this sketch.
    super('jitk',vmm,['--channel','stdio','--memory-mib',String(memoryLimitMB)],memoryLimitMB);
  }
}
// Hyperlight is a separate supervised helper on a supported host. Its Node
// native addon cannot be SIGKILLed independently inside the dispatcher process.
export class HyperlightBackend extends ProcessBackend {
  constructor(helper:string, memoryLimitMB=128) {super('hyperlight-js',process.execPath,[helper,'--memory-mib',String(memoryLimitMB)],memoryLimitMB);}
}
class ProcessSandbox implements Sandbox {
  readonly exited:Promise<void>;
  private queue:unknown[]=[];
  private waiters:{resolve:(v:unknown)=>void;reject:(e:Error)=>void}[]=[];
  private error?:Error;
  private buffer='';
  constructor(private child:ChildProcessWithoutNullStreams) {
    const decoder=new StringDecoder('utf8');
    const fail=(e:Error,drain=false)=>{if(!drain)this.queue=[];this.error=e;for(const w of this.waiters.splice(0))w.reject(e);};
    this.exited=new Promise(resolve=>child.once('close',()=>{fail(new Error('sandbox exited'),true);resolve();}));
    child.once('error',fail);
    // Kernel/VMM diagnostics never share protocol stdout. Limit before parsing.
    let stderr=0;
    child.stderr.on('data',(b:Buffer)=>{stderr+=b.length;if(stderr>65536)this.kill();});
    child.stdin.on('error',()=>{});
    child.stdout.on('data',(b:Buffer)=>{
      this.buffer+=decoder.write(b);
      if(Buffer.byteLength(this.buffer)>1048576){fail(new Error('frame limit'));this.kill();return;}
      let n:number;
      while((n=this.buffer.indexOf('\n'))>=0){
        const line=this.buffer.slice(0,n);this.buffer=this.buffer.slice(n+1);
        try {
          const m=parse(line), w=this.waiters.shift();
          if(w)w.resolve(m);else this.queue.push(m);
          if(this.queue.length>128)throw new Error('frame queue limit');
        }catch{fail(new Error('invalid/overflow protocol'));this.kill();return;}
      }
    });
  }
  read():Promise<unknown> {
    if(this.queue.length)return Promise.resolve(this.queue.shift());
    if(this.error)return Promise.reject(this.error);
    return new Promise((resolve,reject)=>this.waiters.push({resolve,reject}));
  }
  async send(frame:unknown):Promise<void> {
    const line=stringify(frame)+'\n';
    if(Buffer.byteLength(line)>1048576)throw new Error('frame limit');
    await new Promise<void>((resolve,reject)=>this.child.stdin.write(line,e=>e?reject(e):resolve()));
  }
  kill():void {try{process.kill(-this.child.pid!,'SIGKILL');}catch{} }
}
export class SandboxPool {
  private parked:Sandbox[]=[];
  private live=new Set<Sandbox>();
  private creating=0;
  private closed=false;
  private lifecycle=new AbortController();
  private startups=new Set<Promise<Sandbox>>();
  constructor(readonly backend:Backend, readonly warmCount:number, readonly maxLive:number) {
    if(warmCount<0||maxLive<1||warmCount>maxLive)throw new Error('invalid pool size');
  }
  private async start(signal?:AbortSignal):Promise<Sandbox> {
    const p=this.backend.park(signal?AbortSignal.any([signal,this.lifecycle.signal]):this.lifecycle.signal).then(async s=>{
      if(this.closed){s.kill();await s.exited;throw new Error('pool closed');}return s;
    });
    this.startups.add(p);try{return await p;}finally{this.startups.delete(p);}
  }
  async warm():Promise<void> {
    while(!this.closed && this.parked.length+this.creating<this.warmCount && this.live.size+this.creating<this.maxLive){
      this.creating++;
      try {
        const s=await this.start();
        if(this.closed){s.kill();await s.exited;return;}
        this.live.add(s);this.parked.push(s);
        void s.exited.then(()=>{this.live.delete(s);this.parked=this.parked.filter(x=>x!==s);});
      }finally{this.creating--;}
    }
  }
  async acquire(signal?:AbortSignal):Promise<Sandbox> {
    if(this.closed||signal?.aborted)throw new Error('pool closed/aborted');
    const s=this.parked.pop();if(s)return s;
    // Explicit load shedding: no unbounded queue at the fleet entrypoint.
    if(this.live.size+this.creating>=this.maxLive)throw new Error('pool saturated');
    this.creating++;
    try {
      const fresh=await this.start(signal);
      if(this.closed){fresh.kill();await fresh.exited;throw new Error('pool closed');}
      this.live.add(fresh);void fresh.exited.then(()=>this.live.delete(fresh));return fresh;
    }finally{this.creating--;}
  }
  async release(s:Sandbox):Promise<void> {
    s.kill();await s.exited;this.live.delete(s); // NEVER return a used VM.
    void this.warm().catch(()=>{}); // Production: bounded retry + health reporting.
  }
  async close():Promise<void> {
    this.closed=true;this.lifecycle.abort();for(const s of this.live)s.kill();
    await Promise.allSettled([...this.startups]);await Promise.all([...this.live].map(s=>s.exited));
  }
}
export interface RunOptions extends ExecuteOptions {
  signal?:AbortSignal; timeout?:number; provenance?:readonly Label[];
  // Approval remains host-side and is bound to this exact call/context.
  approve?:(call:Call,ctx:Context)=>Promise<boolean>;
}
export class MicroVMExecutor implements Executor, IsolateDriver {
  constructor(readonly pool:SandboxPool, readonly policy:Policy,
    readonly timeout=30000) {}
  async execute(code:string, providersOrFns:ResolvedProvider[]|Record<string,(...a:unknown[])=>Promise<unknown>>, options:RunOptions={}):Promise<ExecuteResult> {
    // Bound normalization, acquisition, tool round-trips and guest execution.
    const controller=new AbortController(), logs:string[]=[];
    const abort=()=>controller.abort();options.signal?.addEventListener('abort',abort,{once:true});
    if(options.signal?.aborted)abort();
    const timer=setTimeout(abort,options.timeout??this.timeout);
    const labels=new Set<Label>(options.provenance??['model']);
    const baseContext={executionId:crypto.randomUUID(),signal:controller.signal};
    const getContext=():Context=>Object.freeze({...baseContext,provenance:Object.freeze([...labels])});
    const ctx=getContext();
    let sandbox:Sandbox|undefined;let kill:(()=>void)|undefined;let live=true;
    try {
      if(Buffer.byteLength(code)>65536)throw new Error('code limit');
      if(options.connectors?.length)throw new Error('connector RPC unsupported: adapt to ResolvedProvider');
      const source=Array.isArray(providersOrFns)?providersOrFns:[{name:'codemode',fns:providersOrFns}];
      const providers=source.map(p=>{
        const fns:ResolvedProvider['fns']=Object.create(null);
        for(const [key,fn] of Object.entries(p.fns)){
          const safe=sanitizeToolName(key);if(Object.hasOwn(fns,safe))throw new Error('sanitized tool collision');fns[safe]=fn;
        }return {...p,fns};
      });
      const seen=new Set<string>();
      for(const p of providers){
        if(!/^[A-Za-z_$][\w$]*$/.test(p.name)||['console','__rpc','__bindings','Promise','Object','globalThis','setTimeout','undefined'].includes(p.name)||seen.has(p.name))throw new Error('invalid/duplicate namespace');
        seen.add(p.name);
      }
      sandbox=await this.pool.acquire(ctx.signal);const s=sandbox;
      kill=()=>s.kill();ctx.signal.addEventListener('abort',kill,{once:true});
      if(ctx.signal.aborted)throw new Error('aborted');
      const normalized=normalizeCode(code);
      await s.send({t:'run',code:`(${normalized})()`,providers:providers.map(({name,prelude})=>({name,prelude}))});
      const ids=new Set<number>(), pending=new Set<Promise<void>>();let logBytes=0;
      const dispatch=async(call:Call)=>{
        try {
          const p=providers.find(p=>p.name===call.ns);
          if(!p||!Object.hasOwn(p.fns,call.fn))throw new Error('unknown tool');
          const frozen=deepFreeze({...call,args:structuredClone(call.args)}) as Call;
          const callContext=getContext();
          const d=await this.policy(frozen,callContext);
          if(d==='requireApproval' && !(await options.approve?.(frozen,callContext)))throw new Error('approval required');
          if(d!=='allow'&&d!=='requireApproval')throw new Error('policy denied');
          if(!live||ctx.signal.aborted)throw new Error('execution ended');
          labels.add('tool-untrusted');
          const ok=await p.fns[call.fn]!(...structuredClone(frozen.args)); // Whole-run conservative label, never guest-supplied.
          if(live&&!ctx.signal.aborted)await s.send({id:call.id,ok});
        }catch(e){if(live&&!ctx.signal.aborted)await s.send({id:call.id,err:String(e)}).catch(()=>s.kill());}
      };
      while(true){
        const m:any=await s.read();
        if(ctx.signal.aborted)throw new Error('aborted');
        if(!m||typeof m!=='object'||Array.isArray(m))throw new Error('invalid frame');
        if(m.t==='log'){
          if(typeof m.message!=='string'||typeof m.level!=='string')throw new Error('bad log');
          logBytes+=Buffer.byteLength(m.message);if(logBytes>65536||logs.length>=256)throw new Error('log limit');
          logs.push(m.level==='log'?m.message:`[${m.level}] ${m.message}`);
        }else if(m.t==='call'){
          if(!Number.isSafeInteger(m.id)||m.id<0||ids.has(m.id)||typeof m.ns!=='string'||typeof m.fn!=='string'||!Array.isArray(m.args)||ids.size>=1000||pending.size>=32)throw new Error('invalid/budgeted call');
          ids.add(m.id);const p=dispatch(m);pending.add(p);void p.finally(()=>pending.delete(p));
        }else if(m.t==='done')return {result:m.result,logs};
        else if(m.t==='error'&&typeof m.message==='string')throw new Error(m.message);
        else throw new Error('unknown frame');
      }
    }catch(e){return {result:undefined,error:ctx.signal.aborted?'Execution aborted or timed out':String(e),logs};}
    finally {
      live=false;controller.abort();clearTimeout(timer);options.signal?.removeEventListener('abort',abort);
      if(kill)ctx.signal.removeEventListener('abort',kill);
      if(sandbox)await this.pool.release(sandbox);
    }
  }
  async createContext(config:IsolateConfig):Promise<IsolateContext> {
    if(config.memoryLimit!==undefined&&config.memoryLimit!==this.pool.backend.memoryLimitMB)throw new Error('memory limit requires a matching backend pool');
    const lifetime=new AbortController();let running=false;let active:Promise<ExecuteResult>|undefined;
    const fns=Object.fromEntries(Object.entries(config.bindings).map(([key,b])=>[key,async(...args:unknown[])=>b.execute(args[0])]));
    // TanStack passes a stripped JS function body. Expose exact binding keys;
    // each execute gets a fresh process even when this context is reused.
    const aliases=Object.keys(fns);
    for(const key of aliases)if(!/^[A-Za-z_$][\w$]*$/.test(key))throw new Error('invalid binding');
    const prelude=aliases.map(key=>`const ${key}=(...a)=>__bindings[${JSON.stringify(key)}](...a);`).join('\n');
    return {
      execute:async<T>(code:string):Promise<ExecutionResult<T>>=>{
        if(lifetime.signal.aborted||running)return {success:false,error:{name:'Error',message:'context disposed/busy'}};
        running=true;
        try {
          active=this.execute(`async()=>{${code}\n}`,[{name:'bindings',fns,prelude:prelude.replaceAll('__bindings[','bindings[')}],{signal:lifetime.signal,timeout:config.timeout});
          const r=await active;
          if(r.error)return {success:false,error:{name:'Error',message:r.error},logs:r.logs};
          return {success:true,value:r.result as T,logs:r.logs};
        }catch(e){return {success:false,error:{name:'Error',message:String(e)}};}finally{running=false;}
      },
      dispose:async()=>{lifetime.abort();await active;},
    };
  }
}

function deepFreeze(v:unknown):unknown {
  if(v&&typeof v==='object'&&!ArrayBuffer.isView(v)){Object.freeze(v);for(const x of Object.values(v))deepFreeze(x);}
  return v;
}
