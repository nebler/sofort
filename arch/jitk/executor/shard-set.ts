import type {Engine,Limits,Session} from './engine.js';
import {SHARD_OWNERS,ShardBackend,shardLimits,type ShardOptions} from './shard-backend.js';

/** Startup failures in a row (an engine that dies before READY, e.g. refusing
 *  degraded confinement) after which the set fails instead of respawning. */
export const STARTUP_FAILURES=3;
export type ShardSetOptions=Omit<ShardOptions,'slots'|'onDeath'>&{
  /** Slots in total, at most 64 per engine process. */
  slots:number;
  /** Slots per engine process: 1 runs every VM in its own process. */
  slotsPerProcess:number;
  /** Owner threads per engine process (at most its slots). Default: one
   *  shard's SHARD_OWNERS split across the engines, at least one each. */
  owners?:number;
};
/** Several shard engine processes behind one Engine. An engine process maps
 *  the memory of every guest it runs, so it is one trust and failure domain: a
 *  guest that took over its engine reaches only that process's slots, and a
 *  crash fails only that process's runs. A dead engine is replaced; runs on the
 *  others continue. The default single 64-slot shard is the densest choice;
 *  slotsPerProcess=1 is the most isolated, at one engine and watchdog process
 *  per VM (shard/README.md "Trust domains"). */
export class ShardSet implements Engine {
  readonly kind:'shard'|'hvf'=process.platform==='darwin'?'hvf':'shard';
  readonly limits:Limits;
  readonly ready:Promise<void>;
  private shards:ShardBackend[]=[];
  private startupFailures=0;
  /** Engines that reached READY: a later death is a crash, not a startup failure. */
  private started=new WeakSet<ShardBackend>();
  /** park() calls in flight per engine: claimed slots that free does not show yet. */
  private parking=new Map<ShardBackend,number>();
  /** Owner threads per engine (before the slot cap). */
  private readonly owners:number;
  private dead?:Error;
  private closed=false;
  constructor(readonly options:ShardSetOptions) {
    const {slots,slotsPerProcess}=options;
    if(!Number.isInteger(slots)||!Number.isInteger(slotsPerProcess)||slotsPerProcess<1||slotsPerProcess>64||slots<1||slots>4096)throw Error('shard set capacity limit');
    this.limits=shardLimits(slots,options.memoryClass);
    // Owner threads run vCPUs. Every engine taking a whole shard's owners
    // would run more of them than the host has cores (8 x 8: 32): preempted
    // inside KVM_RUN, they lose time to vCPU switches (8 x 8 first use 2.4x
    // slower on nested KVM, shard/README.md "Trust domains"). The set gets
    // one shard's budget.
    this.owners=options.owners??Math.max(1,Math.floor(SHARD_OWNERS/Math.ceil(slots/slotsPerProcess)));
    for(let left=slots;left>0;left-=slotsPerProcess)this.shards.push(this.spawn(this.shards.length,Math.min(left,slotsPerProcess)));
    this.ready=Promise.all(this.shards.map(s=>s.ready)).then(()=>{});this.ready.catch(()=>{});
  }
  private spawn(i:number,slots:number):ShardBackend {
    const {slotsPerProcess:_,...options}=this.options;
    const owners=Math.min(this.owners,slots);
    const shard:ShardBackend=new ShardBackend({...options,slots,owners,onDeath:e=>this.died(i,shard,e)});
    shard.ready.then(()=>{this.started.add(shard);if(this.shards[i]===shard)this.startupFailures=0;},()=>{});
    return shard;
  }
  /** Replace a failed engine; its own runs have already failed. */
  private died(i:number,shard:ShardBackend,e:Error) {
    if(this.closed||this.dead||this.shards[i]!==shard)return;
    if(!this.started.has(shard)&&++this.startupFailures>=STARTUP_FAILURES){this.fail(Error('shard set: engine keeps failing at startup: '+e.message));return;}
    this.shards[i]=this.spawn(i,shard.capacity.slots);
  }
  private fail(e:Error) {
    this.dead=e;
    for(const s of this.shards)void s.close();
  }
  /** Engine processes and their slots (tests and benchmarks). */
  get processes():readonly ShardBackend[] {return this.shards;}
  park(signal?:AbortSignal,deadline?:number):Promise<Session> {
    if(this.dead)return Promise.reject(this.dead);
    if(this.closed)return Promise.reject(Error('shard set closed'));
    // The engine with the most free slots, less the park() calls already on
    // their way to one (a claim lands only after park's first await); with
    // none free, the shortest queue.
    const score=(s:ShardBackend)=>s.free-(this.parking.get(s)??0);
    let best=this.shards[0];
    for(const s of this.shards)if(score(s)>score(best)||(score(s)===score(best)&&!s.failed&&(best.failed||s.waiting<best.waiting)))best=s;
    const shard=best;this.parking.set(shard,(this.parking.get(shard)??0)+1);
    return shard.park(signal,deadline).finally(()=>{const n=this.parking.get(shard)!-1;if(n)this.parking.set(shard,n);else this.parking.delete(shard);});
  }
  async close():Promise<void> {
    if(this.closed)return;this.closed=true;
    await Promise.all(this.shards.map(s=>s.close()));
  }
}
