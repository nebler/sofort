import type {Backend,Sandbox} from './backend.js';
export type ParkingGate={idleCorePercent:number;evidence:string};
export type PoolOptions={refillConcurrency?:number;parkingGate?:ParkingGate};
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
  private maxTokens=0;
  private maxCreating=0;
  private closed=false;
  private lifecycle=new AbortController();
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
  private async start(signal?:AbortSignal):Promise<Sandbox> {
    if(this.closed||this.tokens>=this.maxLive||this.creating>=this.refillConcurrency)throw Error('pool saturated');
    this.tokens++;this.creating++;
    this.maxTokens=Math.max(this.tokens,this.maxTokens);this.maxCreating=Math.max(this.creating,this.maxCreating);
    const p=this.backend.park(signal?AbortSignal.any([signal,this.lifecycle.signal]):this.lifecycle.signal);
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
  async acquire(signal?:AbortSignal):Promise<Sandbox> {
    if(this.closed||signal?.aborted)throw Error('pool closed/aborted');
    const s=this.parked.pop();if(s)return s;
    return this.start(signal); // no hidden queue: explicit admission shedding
  }
  async release(s:Sandbox):Promise<void> {
    if(!this.live.has(s))return;
    s.kill();await s.exited;
    // Never reuse a completed VM. Refill is bounded and off the result path.
    if(!this.closed)void this.warm().catch(()=>{});
  }
  async close():Promise<void> {
    this.closed=true;this.lifecycle.abort();for(const s of this.live)s.kill();
    await Promise.allSettled([...this.startups]);await this.warming?.catch(()=>{});
    await Promise.all([...this.live].map(s=>s.exited));
  }
}
