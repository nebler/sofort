import type {Engine as Backend,Session} from './engine.js';
export type ParkingGate={idleCorePercent:number;evidence:string};
export type PoolOptions={refillConcurrency?:number;maxWaiting?:number;parkingGate?:ParkingGate;onEvent?:(event:'release'|'released',sandbox:Session,atMs:number)=>void};
// 05/06: refill latency in seconds; cap includes parked, running, creating/reaping.
export function recommendedWarmCount(lambda:number,refillP99Seconds:number,burst:number,cap:number):number {
  if([lambda,refillP99Seconds,burst,cap].some(x=>!Number.isFinite(x)||x<0))throw Error('invalid sizing inputs');
  return Math.min(Math.ceil(lambda*refillP99Seconds)+Math.ceil(burst),Math.floor(cap));
}
/** Real backpressure: the bounded admission queue is full. A momentarily
 *  empty pool is not an error; callers wait in FIFO order for capacity. */
export class OverloadedError extends Error {
  readonly code='OVERLOADED';
  constructor(what:string,readonly limit:number){super(`${what} overloaded: admission queue full (${limit} waiting)`);this.name='OverloadedError';}
}
type Waiter<T>={signal?:AbortSignal;deadline?:number;resolve:(v:T|Promise<T>)=>void;reject:(e:Error)=>void};
/** Bounded FIFO of callers waiting for capacity. A waiter leaves the queue on
 *  abort, at its deadline, or when the owner rejects everyone (close/death). */
export class AdmissionQueue<T> {
  private waiters:Waiter<T>[]=[];
  maxSeen=0;
  constructor(readonly what:string,readonly limit:number) {
    if(!Number.isInteger(limit)||limit<0)throw Error('invalid admission queue bound');
  }
  get length(){return this.waiters.length;}
  wait(signal?:AbortSignal,deadline?:number):Promise<T> {
    if(signal?.aborted)return Promise.reject(Error(this.what+' closed/aborted'));
    if(deadline!==undefined&&Date.now()>=deadline)return Promise.reject(Error('Execution timed out'));
    if(this.waiters.length>=this.limit)return Promise.reject(new OverloadedError(this.what,this.limit));
    return new Promise<T>((resolve,reject)=>{
      let timer:ReturnType<typeof setTimeout>|undefined;
      const done=()=>{signal?.removeEventListener('abort',abort);clearTimeout(timer);};
      const w:Waiter<T>={signal,deadline,resolve:v=>{done();resolve(v);},reject:e=>{done();reject(e);}};
      const leave=(e:Error)=>{const i=this.waiters.indexOf(w);if(i>=0){this.waiters.splice(i,1);w.reject(e);}};
      const abort=()=>leave(Error(this.what+' closed/aborted'));
      signal?.addEventListener('abort',abort,{once:true});
      if(deadline!==undefined)timer=setTimeout(()=>leave(Error('Execution timed out')),Math.max(0,deadline-Date.now()));
      this.waiters.push(w);this.maxSeen=Math.max(this.maxSeen,this.waiters.length);
    });
  }
  /** The head waiter, removed; its owner must settle it. */
  shift():Waiter<T>|undefined {return this.waiters.shift();}
  rejectAll(e:Error) {for(const w of this.waiters.splice(0))w.reject(e);}
}
export class SandboxPool {
  private parked:Session[]=[];
  private live=new Set<Session>();
  private tokens=0;
  private creating=0;
  private maxTokens=0;
  private maxCreating=0;
  private closed=false;
  private lifecycle=new AbortController();
  private disposals=new Set<Promise<void>>();
  private startups=new Set<Promise<Session>>();
  private warming?:Promise<void>;
  private queue:AdmissionQueue<Session>;
  readonly refillConcurrency:number;
  constructor(readonly backend:Backend,readonly warmCount:number,readonly maxLive:number,readonly options:PoolOptions={}) {
    if(!Number.isInteger(warmCount)||!Number.isInteger(maxLive)||warmCount<0||maxLive<1||warmCount>maxLive)throw Error('invalid pool size');
    // A shard slot is a snapshot restore, so every slot may be admitted at once.
    // A process backend boots a whole VMM (several CPU-ms, R9 1c/1d): two
    // concurrent launches pace a burst; queued callers wait rather than fail.
    this.refillConcurrency=options.refillConcurrency??(backend.kind==='shard'?maxLive:2);
    if(!Number.isInteger(this.refillConcurrency)||this.refillConcurrency<1)throw Error('invalid refill concurrency');
    // A waiter costs a closure and its own deadline bounds the wait; the bound
    // only turns a sustained overload into a fast, typed rejection.
    this.queue=new AdmissionQueue('pool',options.maxWaiting??Math.max(64,4*maxLive));
    const gate=options.parkingGate;
    if(warmCount&&(!gate||!Number.isFinite(gate.idleCorePercent)||gate.idleCorePercent<0||gate.idleCorePercent>=2||!gate.evidence))throw Error('parking G1 evidence below 2% required');
  }
  snapshot(){return {tokens:this.tokens,creating:this.creating,parked:this.parked.length,live:this.live.size,waiting:this.queue.length,maxTokens:this.maxTokens,maxCreating:this.maxCreating,maxWaiting:this.queue.maxSeen,closed:this.closed};}
  private canStart(){return !this.closed&&this.tokens<this.maxLive&&this.creating<this.refillConcurrency;}
  private async start(signal?:AbortSignal,deadline?:number):Promise<Session> {
    if(!this.canStart())throw Error('pool saturated'); // callers check canStart(); never reached from acquire
    this.tokens++;this.creating++;
    this.maxTokens=Math.max(this.tokens,this.maxTokens);this.maxCreating=Math.max(this.creating,this.maxCreating);
    const p=Promise.resolve().then(()=>this.backend.park(signal?AbortSignal.any([signal,this.lifecycle.signal]):this.lifecycle.signal,deadline));
    this.startups.add(p);
    let s:Session;
    try{s=await p;}
    catch(e){this.tokens--;throw e;}
    finally{this.creating--;this.startups.delete(p);this.pump();}
    this.live.add(s);
    void s.released.then(()=>{
      // The capacity token remains charged through SIGKILL until process close.
      this.live.delete(s);this.parked=this.parked.filter(x=>x!==s);this.tokens--;this.pump();
    });
    if(this.closed){s.release();await s.released;throw Error('pool closed');}
    return s;
  }
  private async prepare(s:Session,deadline?:number):Promise<Session> {
    if(deadline!==undefined)try{await s.armDeadline?.(deadline);}catch(e){s.release();await s.released;throw e;}
    return s;
  }
  /** Hand freed capacity to waiters in order: a parked VM first, otherwise a
   *  launch dedicated to the head waiter (its signal bounds that launch). */
  private pump() {
    while(this.queue.length&&!this.closed){
      const s=this.parked.pop();
      if(s){const w=this.queue.shift()!;w.resolve(this.prepare(s,w.deadline));continue;}
      if(!this.canStart())return;
      const w=this.queue.shift()!;w.resolve(this.start(w.signal,w.deadline));
    }
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
          if(!this.closed&&this.live.has(s)){this.parked.push(s);this.pump();}
        }));
        const failed=results.find(r=>r.status==='rejected');
        if(failed?.status==='rejected')throw failed.reason;
      }
    };
    this.warming=fill().finally(()=>{this.warming=undefined;});return this.warming;
  }
  async acquire(signal?:AbortSignal,deadline?:number):Promise<Session> {
    if(this.closed||signal?.aborted)throw Error('pool closed/aborted');
    // FIFO: nobody overtakes an earlier waiter, even when capacity just freed.
    if(!this.queue.length){
      const ready=this.parked.pop();if(ready)return this.prepare(ready,deadline);
      if(this.canStart())return this.start(signal,deadline);
    }
    // Capacity is charged until the previous VM is reaped (or a shard slot is
    // reset). Wait for it in order; only a full queue is backpressure.
    const waiting=this.queue.wait(signal,deadline);this.pump();return waiting;
  }
  retire(s:Session,beforeRelease:()=>void=()=>{}):void {
    // Keep s in live (and its token charged) until both owned children close.
    const task=new Promise<void>(resolve=>setImmediate(()=>{beforeRelease();void this.release(s).catch(()=>{}).finally(resolve);}));
    this.disposals.add(task);void task.finally(()=>this.disposals.delete(task));
  }
  async drain():Promise<void>{await Promise.all([...this.disposals]);}
  async release(s:Session):Promise<void> {
    if(!this.live.has(s))return;
    try{this.options.onEvent?.('release',s,performance.now());}catch{}
    s.release();await s.released;
    try{this.options.onEvent?.('released',s,performance.now());}catch{}
    // Never reuse a completed VM. Refill is bounded and off the result path.
    if(!this.closed)void this.warm().catch(()=>{});
  }
  async close():Promise<void> {
    this.closed=true;this.lifecycle.abort();this.queue.rejectAll(Error('pool closed'));for(const s of this.live)s.release();
    await this.backend.close?.();
    await Promise.allSettled([...this.startups]);await this.warming?.catch(()=>{});
    await Promise.all([...this.live].map(s=>s.released));await this.drain();
  }
}
