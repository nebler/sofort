import type {Backend,Sandbox} from './backend.js';
export type ParkingGate={idleCorePercent:number;evidence:string};
export type PoolOptions={refillConcurrency?:number;parkingGate?:ParkingGate;onEvent?:(event:'kill'|'reaped',sandbox:Sandbox,atMs:number)=>void};
// 05/06: refill latency in seconds; cap includes parked, running, creating/reaping.
export function recommendedWarmCount(lambda:number,refillP99Seconds:number,burst:number,cap:number):number {
  if([lambda,refillP99Seconds,burst,cap].some(x=>!Number.isFinite(x)||x<0))throw Error('invalid sizing inputs');
  return Math.min(Math.ceil(lambda*refillP99Seconds)+Math.ceil(burst),Math.floor(cap));
}
export class SandboxPool {
  private parked:Sandbox[]=[];
  private live=new Set<Sandbox>();
  private tokens=0;
  private creating=0;
  private acquiring=0;
  private maxTokens=0;
  private maxCreating=0;
  private closed=false;
  private lifecycle=new AbortController();
  private disposals=new Set<Promise<void>>();
  private startups=new Set<Promise<Sandbox>>();
  private warming?:Promise<void>;
  readonly refillConcurrency:number;
  constructor(readonly backend:Backend,readonly warmCount:number,readonly maxLive:number,readonly options:PoolOptions={}) {
    if(!Number.isInteger(warmCount)||!Number.isInteger(maxLive)||warmCount<0||maxLive<1||warmCount>maxLive)throw Error('invalid pool size');
    this.refillConcurrency=options.refillConcurrency??2;
    if(!Number.isInteger(this.refillConcurrency)||this.refillConcurrency<1)throw Error('invalid refill concurrency');
    const gate=options.parkingGate;
    if(warmCount&&(!gate||!Number.isFinite(gate.idleCorePercent)||gate.idleCorePercent<0||gate.idleCorePercent>=2||!gate.evidence))throw Error('parking G1 evidence below 2% required');
  }
  snapshot(){return {tokens:this.tokens,creating:this.creating,parked:this.parked.length,live:this.live.size,maxTokens:this.maxTokens,maxCreating:this.maxCreating,closed:this.closed};}
  private async start(signal?:AbortSignal,deadline?:number):Promise<Sandbox> {
    if(this.closed||this.tokens>=this.maxLive||this.creating>=this.refillConcurrency)throw Error('pool saturated');
    this.tokens++;this.creating++;
    this.maxTokens=Math.max(this.tokens,this.maxTokens);this.maxCreating=Math.max(this.creating,this.maxCreating);
    const p=Promise.resolve().then(()=>this.backend.park(signal?AbortSignal.any([signal,this.lifecycle.signal]):this.lifecycle.signal,deadline));
    this.startups.add(p);
    let s:Sandbox;
    try{s=await p;}
    catch(e){this.tokens--;throw e;}
    finally{this.creating--;this.startups.delete(p);}
    this.live.add(s);
    void s.exited.then(()=>{
      // The capacity token remains charged through SIGKILL until process close.
      this.live.delete(s);this.parked=this.parked.filter(x=>x!==s);this.tokens--;
    });
    if(this.closed){s.kill();await s.exited;throw Error('pool closed');}
    return s;
  }
  warm():Promise<void> {
    if(this.warming)return this.warming;
    const fill=async()=>{
      while(!this.closed) {
        const n=Math.min(this.warmCount-this.parked.length-this.creating,
          this.maxLive-this.tokens,this.refillConcurrency-this.creating);
        if(n<=0)return;
        const results=await Promise.allSettled(Array.from({length:n},async()=>{
          const s=await this.start();
          if(!this.closed&&this.live.has(s))this.parked.push(s);
        }));
        const failed=results.find(r=>r.status==='rejected');
        if(failed?.status==='rejected')throw failed.reason;
      }
    };
    this.warming=fill().finally(()=>{this.warming=undefined;});return this.warming;
  }
  async acquire(signal?:AbortSignal,deadline?:number):Promise<Sandbox> {
    if(this.closed||signal?.aborted)throw Error('pool closed/aborted');
    const prepare=async(s:Sandbox)=>{if(deadline!==undefined)try{await s.armDeadline?.(deadline);}catch(e){s.kill();await s.exited;throw e;}return s;};
    const ready=this.parked.pop();if(ready)return prepare(ready);
    // A background refill owns launch slots. Wait for that existing work,
    // rather than shedding a sequential caller while capacity is available.
    // This bounded wait never creates additional VMs or unbounded queue state.
    if(this.warming&&this.creating){
      if(this.acquiring>=this.maxLive)throw Error('pool saturated');
      this.acquiring++;
      const combined=signal?AbortSignal.any([signal,this.lifecycle.signal]):this.lifecycle.signal;
      let abort!:()=>void;
      try{
        await Promise.race([this.warming,new Promise<never>((_,reject)=>{
          abort=()=>reject(Error('pool closed/aborted'));combined.addEventListener('abort',abort,{once:true});
          if(combined.aborted)abort();
        })]);
      }finally{this.acquiring--;combined.removeEventListener('abort',abort);}
      if(this.closed||signal?.aborted)throw Error('pool closed/aborted');
      const s=this.parked.pop();if(s)return prepare(s);
    }
    return this.start(signal,deadline); // explicit admission shedding at actual capacity
  }
  retire(s:Sandbox,beforeKill:()=>void=()=>{}):void {
    // Keep s in live (and its token charged) until both owned children close.
    const task=new Promise<void>(resolve=>setImmediate(()=>{beforeKill();void this.release(s).catch(()=>{}).finally(resolve);}));
    this.disposals.add(task);void task.finally(()=>this.disposals.delete(task));
  }
  async drain():Promise<void>{await Promise.all([...this.disposals]);}
  async release(s:Sandbox):Promise<void> {
    if(!this.live.has(s))return;
    try{this.options.onEvent?.('kill',s,performance.now());}catch{}
    s.kill();await s.exited;
    try{this.options.onEvent?.('reaped',s,performance.now());}catch{}
    // Never reuse a completed VM. Refill is bounded and off the result path.
    if(!this.closed)void this.warm().catch(()=>{});
  }
  async close():Promise<void> {
    this.closed=true;this.lifecycle.abort();for(const s of this.live)s.kill();
    await this.backend.close?.();
    await Promise.allSettled([...this.startups]);await this.warming?.catch(()=>{});
    await Promise.all([...this.live].map(s=>s.exited));await this.drain();
  }
}
