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
export {NativeBackend,NativeExecutor,NativeJobError,NATIVE_LIMITS,encodeNativeJob,type NativeOptions,type NativeResult,type NativeError} from './native-backend.js';
export type Label='user'|'model'|'tool-untrusted'|'host-trusted';
export type Call=Readonly<{id:number;ns:string;fn:string;args:unknown[]}>;
export type Context=Readonly<{executionId:string;signal:AbortSignal;provenance:readonly Label[]}>;
export type Decision='allow'|'deny'|'requireApproval';
/** Why a run failed, from structure (abort, policy violation, the engine's fail cause), never from guest text. */
export type ErrorCode='TIMEOUT'|'POLICY'|'LIMIT'|'SANDBOX'|'GUEST_ERROR';
export type RunResult=ExecuteResult&{errorCode?:ErrorCode};
const CAUSE:Record<string,ErrorCode>={guest:'GUEST_ERROR',limit:'LIMIT',deadline:'TIMEOUT',engine:'SANDBOX'};
/** A 'guest' failure mixes the host decoder's protocol errors with errors the guest raised (its own,
 *  its runtime's resource limits), and the guest picks its error's name and message. It is POLICY only
 *  when it ends in a denial the host sent, SANDBOX only in the host decoder's exact form; resource
 *  words make it LIMIT (as mcp/jitk.mjs classify), which a guest can claim for its own run only. */
function guestCode(error:string,denials:Set<string>):ErrorCode {
  if([...denials].some(d=>error.endsWith(d)))return 'POLICY';
  if(/^Error: protocol [A-Z_]+$/.test(error))return 'SANDBOX';
  return /limit|budget|saturated|overloaded|out of memory|stack overflow/i.test(error)?'LIMIT':'GUEST_ERROR';
}
/** A host denial of one call: the guest gets DENIED. */
class Denied extends Error {}
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
  /** Tool calls per run as enforced (and advertised): the configured policy limit, else the policy
   *  default (256), never above the engine's own budget. */
  get callLimit():number {return Math.min(this.pool.backend.limits.js?.calls??0,this.security.limits?.calls??rules.DEFAULT_LIMITS.calls);}
  async execute(code:string, providersOrFns:ResolvedProvider[]|Record<string,(...a:unknown[])=>Promise<unknown>>, options:RunOptions={}):Promise<RunResult> {
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
    let sandbox:Session|undefined;let stop:(()=>void)|undefined;let live=true;let run:any;let violation:string|undefined;let failCause:string|undefined;let pending=0;const denials=new Set<string>();
    let firstCall=true,firstRet=true;
    try {
      const limits=this.pool.backend.limits.js;
      if(!limits)throw new Error('engine runs no JS jobs');
      if(code.length>limits.code)throw new Error('code limit');
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
            invoke:async(a:unknown[],_credential:unknown,context:{signal:AbortSignal})=>fn.apply(Object.freeze({signal:context.signal}),a),output:(v:unknown)=>v,
            // Credential-free public computation: its own error text is the guest's, as before.
            error:(e:unknown)=>String(e)};
        }
      }
      run=rules.createRun({tools,deadline,limits:{...this.security.limits,calls:this.callLimit}});
      sandbox=await this.pool.acquire(ctx.signal,deadline);mark('acquired');const s=sandbox;
      stop=()=>s.release();ctx.signal.addEventListener('abort',stop,{once:true});
      if(expired())abort();
      if(ctx.signal.aborted)throw new Error('aborted');
      await s.armDeadline?.(deadline);
      await s.start(jsJob(code,providers));
      mark('runSent');
      const dispatch=async(call:Call)=>{
        try {
          // Calls waiting on an async policy or approver count against the outstanding limit too.
          if(++pending>run.limits.outstanding)throw new rules.Violation('outstanding');
          // Undecodable arguments still spend the call id (a schema denial), or the next call fails the id sequence.
          let args:unknown,decoded=true;try{args=guestValue(JSON.stringify(call.args));}catch{decoded=false;args=null;}
          const decision=rules.decide(run,{t:'call',id:call.id,ns:call.ns,fn:call.fn,args});
          if(!decoded)throw new Denied('policy denied: schema');
          if(decision.kind==='deny')throw new Denied('policy denied: '+decision.reason);
          const frozen=deepFreeze({...call,args:structuredClone(decision.call.args)}) as Call;
          const callContext=getContext();
          const d=await this.policy(frozen,callContext);
          if(d!=='allow'&&d!=='requireApproval')throw new Denied('policy denied');
          if(decision.kind==='approve'||d==='requireApproval'){
            if(!(await options.approve?.(frozen,callContext)))throw new Denied('approval required');
            if(decision.kind==='approve'&&!rules.approve(run,decision.digest))throw new rules.Violation('approval digest');
          }
          if(expired())abort();
          if(!live||ctx.signal.aborted)throw new Error('execution ended');
          const ok=await rules.dispatch(run,decision.call,{issuer:this.security.issuer??noCredentials,signal:ctx.signal});
          // Compatibility provenance is observational; only 07's effects decide admission.
          if(run.tainted.untrusted)labels.add('tool-untrusted');
          if(expired())abort();
          if(live&&!ctx.signal.aborted){await s.reply(call.id,{ok:JSON.parse(stringify(ok===undefined?null:ok))});if(firstRet){firstRet=false;mark('firstRet');}}
        }catch(e){
          if(e instanceof rules.Violation){run.dead=true;violation??=(e as Error).message;s.release();return;}
          if(!live||ctx.signal.aborted)return;
          const message=(e instanceof rules.ToolError?(e as Error).message:String(e)).slice(0,4096);
          if(e instanceof Denied)denials.add(message);
          await s.reply(call.id,{err:{code:e instanceof Denied?'DENIED':'TOOL_ERROR',message}}).catch(()=>s.release());
        }finally{pending--;}
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
          return {result:guestValue(JSON.stringify(ev.ok)),logs};
        }else if(ev.kind==='fail'){failCause=ev.cause;throw Error(ev.message);}
        else throw Error(`engine sent a native ${ev.kind} event to a JS job`);
      }
    }catch(e){
      if(expired())abort();
      const error=violation?'policy violation: '+violation:ctx.signal.aborted?'Execution aborted or timed out':String(e);
      const errorCode:ErrorCode|undefined=violation?(/budget|outstanding/.test(violation)?'LIMIT':violation==='deadline'?'TIMEOUT':'POLICY')
        :ctx.signal.aborted?'TIMEOUT':failCause==='guest'?guestCode(error,denials):failCause?CAUSE[failCause]:undefined;
      return {result:undefined,error,errorCode,logs};
    }
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

/** Decode a guest value for host code. JSON.parse makes "__proto__" an own property, and a
 *  merge of it (or of constructor.prototype) into host objects pollutes them: both are dropped.
 *  (Host-side only: codec.mjs is also the guest's codec, compiled into prepared snapshots.) */
function guestValue(text:string):unknown {
  const clean=(v:unknown):unknown=>{
    if(Array.isArray(v))v.forEach(clean);
    else if(v&&typeof v==='object'&&!ArrayBuffer.isView(v)&&!(v instanceof ArrayBuffer))
      for(const k of Object.keys(v)){const x=(v as Record<string,unknown>)[k];
        if(k==='__proto__'||k==='constructor'&&x&&typeof x==='object')delete (v as Record<string,unknown>)[k];else clean(x);}
    return v;
  };
  return clean(parse(text));
}
function deepFreeze(v:unknown):unknown {
  if(v&&typeof v==='object'&&!ArrayBuffer.isView(v)){Object.freeze(v);for(const x of Object.values(v))deepFreeze(x);}
  return v;
}
