import {sanitizeToolName} from './code.js';
import {parse,stringify} from './codec.js';
import {executionBody} from './code.js';
import type {Sandbox} from './types.js';
import {SandboxPool} from './pool.js';
import {rules,noCredentials,type PolicyConfig} from './policy-adapter.js';
import {performance} from 'node:perf_hooks';
import {LIMIT} from './protocol.js';
export * from './types.js';
export * from './backend.js';
export * from './pool.js';
import type {Provider,Call,Context,Policy,RunOptions} from './types.js';
export class MicroVMExecutor {
  constructor(readonly pool:SandboxPool, readonly policy:Policy,
    readonly timeout=30000, readonly security:PolicyConfig={}) {}
  async execute(code:string, providersOrFns:Provider[]|Record<string,(...a:unknown[])=>Promise<unknown>>, options:RunOptions={}):Promise<{result?:any;error?:string;logs:string[]}> {
    const mark=(event:string)=>{try{options.onTiming?.(event,performance.now());}catch{}};mark('start');
    // Bound normalization, acquisition, tool round-trips and guest execution.
    const controller=new AbortController(), logs:string[]=[];
    const abort=()=>controller.abort();options.signal?.addEventListener('abort',abort,{once:true});
    if(options.signal?.aborted)abort();
    const timeout=options.timeout??this.timeout;
    const deadline=Date.now()+timeout;
    const expired=()=>Date.now()>=deadline;
    const timer=setTimeout(abort,timeout);
    const labels=new Set<string>(options.provenance??['model']);
    const baseContext={executionId:crypto.randomUUID(),signal:controller.signal};
    const getContext=():Context=>Object.freeze({...baseContext,provenance:Object.freeze([...labels])});
    const ctx=getContext();
    let sandbox:Sandbox|undefined;let kill:(()=>void)|undefined;let live=true;let run:any;
    let firstCall=true,firstRet=true;
    try {
      if(code.length>LIMIT.code)throw new Error('code limit');
      if(options.connectors?.length)throw new Error('connector RPC unsupported: adapt to Provider');
      const source=Array.isArray(providersOrFns)?providersOrFns:[{name:'codemode',fns:providersOrFns}];
      const providers=source.map(p=>{
        const fns:Provider['fns']=Object.create(null);
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
      kill=()=>s.kill();ctx.signal.addEventListener('abort',kill,{once:true});
      if(expired())abort();
      if(ctx.signal.aborted)throw new Error('aborted');
      await s.armDeadline?.(deadline);
      const body=executionBody(code,providers,this.pool.backend.kind==='shard');
      if(body.length>LIMIT.code)throw Error('code limit including trusted adapters');
      await s.send({t:'run',code:body,ns:Object.fromEntries(providers.map(p=>[p.name,Object.keys(p.fns)]))});
      mark('runSent');
      let nextId=1;let pending=0;
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
          if(live&&!ctx.signal.aborted){await s.send({t:'ret',id:call.id,ok:JSON.parse(stringify(ok===undefined?null:ok))});if(firstRet){firstRet=false;mark('firstRet');}}
        }catch(e){if(e instanceof rules.Violation){run.dead=true;s.kill();return;}if(live&&!ctx.signal.aborted)await s.send({t:'ret',id:call.id,err:{code:String(e).includes('policy denied')||String(e).includes('approval required')?'DENIED':'TOOL_ERROR',message:String(e).slice(0,4096)}}).catch(()=>s.kill());}
      };
      while(true){
        const m:any=await s.read();
        if(expired())abort();
        if(ctx.signal.aborted)throw new Error('aborted');
        if(!m||typeof m!=='object'||Array.isArray(m))throw new Error('invalid frame');
        if(m.t==='log'){
          logs.push(m.level==='log'?m.msg:`[${m.level}] ${m.msg}`);
        }else if(m.t==='call'){
          if(firstCall){firstCall=false;mark('firstCall');}
          // Byte/schema/state/ID limits already passed the shared dispatcher.
          if(m.id!==nextId++)throw Error('invalid/budgeted call');
          const p=dispatch(m);pending++;void p.then(()=>{pending--;},()=>{pending--;});
        }else if(m.t==='done'){
          mark('done');
          if(Object.hasOwn(m,'err'))throw Error(`${m.err.name}: ${m.err.message}`);
          return {result:parse(JSON.stringify(m.ok)),logs};
        }
        else throw new Error('unknown frame');
      }
    }catch(e){if(expired())abort();return {result:undefined,error:ctx.signal.aborted?'Execution aborted or timed out':String(e),logs};}
    finally {
      live=false;if(run){run.dead=true;run.approvals.clear();}
      clearTimeout(timer);options.signal?.removeEventListener('abort',abort);
      // Remove the abort→SIGKILL listener before cancelling host tool work.
      if(kill)ctx.signal.removeEventListener('abort',kill);
      // setImmediate runs after the execute promise's subscribers. No kill,
      // reap, refill or tool cancellation occurs on a successful result path.
      if(sandbox)this.pool.retire(sandbox,()=>controller.abort());
      else controller.abort();
      mark('resolve');
    }
  }
}
function deepFreeze(v:unknown):unknown {
  if(v&&typeof v==='object'&&!ArrayBuffer.isView(v)){Object.freeze(v);for(const x of Object.values(v))deepFreeze(x);}
  return v;
}
