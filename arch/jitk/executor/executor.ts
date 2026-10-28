import type {Executor,ExecuteResult,ResolvedProvider,ExecuteOptions} from '@cloudflare/codemode';
import type {IsolateDriver,IsolateConfig,IsolateContext,ExecutionResult} from '@tanstack/ai-code-mode';
import {sanitizeToolName} from './upstream.js';
import {parse,stringify} from './codec.mjs';
import {jsJob} from './code.js';
import type {Session} from './engine.js';
import {SandboxPool} from './pool.js';
import {rules,noCredentials,type PolicyConfig} from './policy-adapter.js';
import {performance} from 'node:perf_hooks';
export * from './backend.js';
export * from './pool.js';
export {ShardBackend} from './shard-backend.js';
export type Label='user'|'model'|'tool-untrusted'|'host-trusted';
export type Call=Readonly<{id:number;ns:string;fn:string;args:unknown[]}>;
export type Context=Readonly<{executionId:string;signal:AbortSignal;provenance:readonly Label[]}>;
export type Decision='allow'|'deny'|'requireApproval';
export type Policy=(call:Call,ctx:Context)=>Decision|Promise<Decision>;
export type TimingEvent='start'|'acquired'|'runSent'|'firstCall'|'firstRet'|'done'|'resolve';
export interface RunOptions extends ExecuteOptions {
  onTiming?:(event:TimingEvent,atMs:number)=>void;
  signal?:AbortSignal; timeout?:number; provenance?:readonly Label[];
  // Approval remains host-side and is bound to this exact call/context.
  approve?:(call:Call,ctx:Context)=>Promise<boolean>;
}
export class MicroVMExecutor implements Executor, IsolateDriver {
  constructor(readonly pool:SandboxPool, readonly policy:Policy,
    readonly timeout=30000, readonly security:PolicyConfig={}) {}
  async execute(code:string, providersOrFns:ResolvedProvider[]|Record<string,(...a:unknown[])=>Promise<unknown>>, options:RunOptions={}):Promise<ExecuteResult> {
    const mark=(event:TimingEvent)=>{try{options.onTiming?.(event,performance.now());}catch{}};mark('start');
    // Bound normalization, acquisition, tool round-trips and guest execution.
    const controller=new AbortController(), logs:string[]=[];
    const abort=()=>controller.abort();options.signal?.addEventListener('abort',abort,{once:true});
    if(options.signal?.aborted)abort();
    const timeout=options.timeout??this.timeout;
    const deadline=Date.now()+timeout;
    const expired=()=>Date.now()>=deadline;
    const timer=setTimeout(abort,timeout);
    const labels=new Set<Label>(options.provenance??['model']);
    const baseContext={executionId:crypto.randomUUID(),signal:controller.signal};
    const getContext=():Context=>Object.freeze({...baseContext,provenance:Object.freeze([...labels])});
    const ctx=getContext();
    let sandbox:Session|undefined;let stop:(()=>void)|undefined;let live=true;let run:any;
    let firstCall=true,firstRet=true;
    try {
      if(code.length>this.pool.backend.limits.js.code)throw new Error('code limit');
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
      const tools:Record<string,Record<string,any>>=Object.create(null);
      for(const p of providers){
        tools[p.name]=Object.create(null);
        for(const [name,fn] of Object.entries(p.fns)){
          const nsTools=this.security.tools&&Object.hasOwn(this.security.tools,p.name)?this.security.tools[p.name]:undefined;
          const declared=nsTools&&Object.hasOwn(nsTools,name)?nsTools[name]:undefined;
          if(this.security.tools&&!declared)throw Error('missing tool effects: '+p.name+'.'+name);
          // Legacy public computation providers are explicitly credential-free.
          tools[p.name][name]=declared??{args:(a:unknown[])=>a,reads:'public',egress:false,writes:false,timeoutMs:options.timeout??this.timeout,
            invoke:async(a:unknown[],_credential:unknown,context:{signal:AbortSignal})=>fn.apply(Object.freeze({signal:context.signal}),a),output:(v:unknown)=>v};
        }
      }
      run=rules.createRun({tools,deadline,limits:this.security.limits});
      sandbox=await this.pool.acquire(ctx.signal,deadline);mark('acquired');const s=sandbox;
      stop=()=>s.release();ctx.signal.addEventListener('abort',stop,{once:true});
      if(expired())abort();
      if(ctx.signal.aborted)throw new Error('aborted');
      await s.armDeadline?.(deadline);
      await s.start(jsJob(code,providers));
      mark('runSent');
      const dispatch=async(call:Call)=>{
        try {
          const decision=rules.decide(run,{t:'call',id:call.id,ns:call.ns,fn:call.fn,args:parse(JSON.stringify(call.args))});
          if(decision.kind==='deny')throw Error('policy denied: '+decision.reason);
          const frozen=deepFreeze({...call,args:structuredClone(decision.call.args)}) as Call;
          const callContext=getContext();
          const d=await this.policy(frozen,callContext);
          if(d!=='allow'&&d!=='requireApproval')throw new Error('policy denied');
          if(decision.kind==='approve'||d==='requireApproval'){
            if(!(await options.approve?.(frozen,callContext)))throw Error('approval required');
            if(decision.kind==='approve'&&!rules.approve(run,decision.digest))throw new rules.Violation('approval digest');
          }
          if(expired())abort();
          if(!live||ctx.signal.aborted)throw new Error('execution ended');
          const ok=await rules.dispatch(run,decision.call,{issuer:this.security.issuer??noCredentials,signal:ctx.signal});
          // Compatibility provenance is observational; only 07's effects decide admission.
          if(run.tainted.untrusted)labels.add('tool-untrusted');
          if(expired())abort();
          if(live&&!ctx.signal.aborted){await s.reply(call.id,{ok:JSON.parse(stringify(ok===undefined?null:ok))});if(firstRet){firstRet=false;mark('firstRet');}}
        }catch(e){if(e instanceof rules.Violation){run.dead=true;s.release();return;}if(live&&!ctx.signal.aborted)await s.reply(call.id,{err:{code:String(e).includes('policy denied')||String(e).includes('approval required')?'DENIED':'TOOL_ERROR',message:String(e).slice(0,4096)}}).catch(()=>s.release());}
      };
      while(true){
        // Events are validated by the session's engine adapter (bytes, schema,
        // call ids, budgets); a call id is answered exactly once below.
        const ev=await s.next();
        if(expired())abort();
        if(ctx.signal.aborted)throw new Error('aborted');
        if(ev.kind==='log'){
          logs.push(ev.level==='log'?ev.msg:`[${ev.level}] ${ev.msg}`);
        }else if(ev.kind==='call'){
          if(firstCall){firstCall=false;mark('firstCall');}
          void dispatch({id:ev.id,ns:ev.ns,fn:ev.fn,args:ev.args});
        }else if(ev.kind==='done'){
          mark('done');
          return {result:parse(JSON.stringify(ev.ok)),logs};
        }else throw Error(ev.message);
      }
    }catch(e){if(expired())abort();return {result:undefined,error:ctx.signal.aborted?'Execution aborted or timed out':String(e),logs};}
    finally {
      live=false;if(run){run.dead=true;run.approvals.clear();}
      clearTimeout(timer);options.signal?.removeEventListener('abort',abort);
      // Remove the abort→SIGKILL listener before cancelling host tool work.
      if(stop)ctx.signal.removeEventListener('abort',stop);
      // setImmediate runs after the execute promise's subscribers. No kill,
      // reap, refill or tool cancellation occurs on a successful result path.
      if(sandbox)this.pool.retire(sandbox,()=>controller.abort());
      else controller.abort();
      mark('resolve');
    }
  }
  async createContext(config:IsolateConfig):Promise<IsolateContext> {
    if(config.memoryLimit!==undefined&&config.memoryLimit!==this.pool.backend.limits.memoryMB)throw new Error('memory limit requires a matching backend pool');
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
