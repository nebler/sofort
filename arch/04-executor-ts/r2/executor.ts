import type {Executor,ExecuteResult,ResolvedProvider,ExecuteOptions} from '@cloudflare/codemode';
import type {IsolateDriver,IsolateConfig,IsolateContext,ExecutionResult} from '@tanstack/ai-code-mode';
import {sanitizeToolName} from './upstream.js';
import {parse,stringify} from './codec.mjs';
import {executionBody} from './code.js';
import type {Sandbox} from './backend.js';
import {SandboxPool} from './pool.js';
import {LIMIT} from './dispatcher.js';
export * from './backend.js';
export * from './pool.js';
export type Label='user'|'model'|'tool-untrusted'|'host-trusted';
export type Call=Readonly<{id:number;ns:string;fn:string;args:unknown[]}>;
export type Context=Readonly<{executionId:string;signal:AbortSignal;provenance:readonly Label[]}>;
export type Decision='allow'|'deny'|'requireApproval';
export type Policy=(call:Call,ctx:Context)=>Decision|Promise<Decision>;
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
      if(code.length>LIMIT.code)throw new Error('code limit');
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
      const body=executionBody(code,providers);
      if(body.length>LIMIT.code)throw Error('code limit including trusted adapters');
      await s.send({t:'run',code:body,ns:Object.fromEntries(providers.map(p=>[p.name,Object.keys(p.fns)]))});
      let nextId=1;const pending=new Set<Promise<void>>();
      const dispatch=async(call:Call)=>{
        try {
          const p=providers.find(p=>p.name===call.ns);
          if(!p||!Object.hasOwn(p.fns,call.fn))throw new Error('unknown tool');
          const frozen=deepFreeze({...call,args:parse(JSON.stringify(call.args))}) as Call;
          const callContext=getContext();
          const d=await this.policy(frozen,callContext);
          if(d==='requireApproval' && !(await options.approve?.(frozen,callContext)))throw new Error('approval required');
          if(d!=='allow'&&d!=='requireApproval')throw new Error('policy denied');
          if(!live||ctx.signal.aborted)throw new Error('execution ended');
          labels.add('tool-untrusted');
          const ok=await p.fns[call.fn]!(...structuredClone(frozen.args)); // Whole-run conservative label, never guest-supplied.
          if(live&&!ctx.signal.aborted)await s.send({t:'ret',id:call.id,ok:JSON.parse(stringify(ok===undefined?null:ok))});
        }catch(e){if(live&&!ctx.signal.aborted)await s.send({t:'ret',id:call.id,err:{code:String(e).includes('policy denied')||String(e).includes('approval required')?'DENIED':'TOOL_ERROR',message:String(e).slice(0,4096)}}).catch(()=>s.kill());}
      };
      while(true){
        const m:any=await s.read();
        if(ctx.signal.aborted)throw new Error('aborted');
        if(!m||typeof m!=='object'||Array.isArray(m))throw new Error('invalid frame');
        if(m.t==='log'){
          logs.push(m.level==='log'?m.msg:`[${m.level}] ${m.msg}`);
        }else if(m.t==='call'){
          // Byte/schema/state/ID limits already passed the shared dispatcher.
          if(m.id!==nextId++)throw Error('invalid/budgeted call');
          const p=dispatch(m);pending.add(p);void p.then(()=>pending.delete(p),()=>pending.delete(p));
        }else if(m.t==='done'){
          if(Object.hasOwn(m,'err'))throw Error(`${m.err.name}: ${m.err.message}`);
          return {result:parse(JSON.stringify(m.ok)),logs};
        }
        else throw new Error('unknown frame');
      }
    }catch(e){return {result:undefined,error:ctx.signal.aborted?'Execution aborted or timed out':String(e),logs};}
    finally {
      live=false;controller.abort();clearTimeout(timer);options.signal?.removeEventListener('abort',abort);
      if(kill)ctx.signal.removeEventListener('abort',kill);
      if(sandbox)await this.pool.release(sandbox).catch(()=>{});
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
