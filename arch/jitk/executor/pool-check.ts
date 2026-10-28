import {receiptPath} from './receipt-path.js';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {SandboxPool,OverloadedError,recommendedWarmCount} from './pool.js';
import type {Backend,Limits,Session} from './backend.js';
import {v1Limits} from './engine.js';
import {shardLimits} from './shard-backend.js';
const gate={idleCorePercent:0,evidence:'deterministic fake backend, no guest CPU'};
const delay=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const tick=()=>new Promise(r=>setImmediate(r));
class Fake implements Backend {
  readonly limits:Limits;
  activeStarts=0;maxStarts=0;instances:(Session&{reap:()=>void;releases:number})[]=[];dead?:Error;
  constructor(readonly autoReap=true,readonly kind:Backend['kind']='process',readonly startMs=10,readonly reapMs=20){this.limits=kind==='shard'?shardLimits(64):v1Limits(32,60000);}
  async park(signal?:AbortSignal):Promise<Session> {
    if(this.dead)throw this.dead;
    this.activeStarts++;this.maxStarts=Math.max(this.maxStarts,this.activeStarts);
    let reap!:()=>void;
    const released=new Promise<void>(r=>{reap=r;});
    const s={phase:'parked' as const,released,reap,releases:0,start:async()=>{},next:async()=>({kind:'fail' as const,cause:'engine' as const,message:'fake'}),reply:async()=>{},release:()=>{s.releases++;if(this.autoReap)setTimeout(reap,this.reapMs);}};
    this.instances.push(s);
    try {
      await delay(this.startMs);
      if(signal?.aborted){s.reap();throw Error('aborted');}
      if(this.dead){s.reap();throw this.dead;}
      return s;
    }finally{this.activeStarts--;}
  }
  /** Backend death: every live sandbox exits and every later launch fails. */
  die(e:Error){this.dead=e;for(const s of this.instances)s.reap();}
}
// Settlement order of queued acquires, without awaiting them.
const track=(p:Promise<Session>,order:number[],i:number)=>{const r={s:undefined as Session|undefined,e:undefined as unknown};
  void p.then(s=>{r.s=s;order.push(i);},e=>{r.e=e;order.push(i);});return r;};
const rows:any[]=[],loadBefore=execFileSync('/usr/bin/uptime',[],{encoding:'utf8'}).trim();
assert.throws(()=>new SandboxPool(new Fake(),1,4),/G1/);
assert.throws(()=>new SandboxPool(new Fake(),1,4,{parkingGate:{...gate,idleCorePercent:2}}),/G1/);
assert.throws(()=>new SandboxPool(new Fake(),1,4,{parkingGate:{...gate,idleCorePercent:8}}),/G1/);
rows.push({name:'G1 denies missing / >=2% idle evidence',ok:true});
{
 const b=new Fake(false),p=new SandboxPool(b,0,1),s=await p.acquire();
 const release=p.release(s);
 assert.equal(p.snapshot().tokens,1);
 // The reaping VM still owns the only token: the next caller waits, not sheds.
 const order:number[]=[],next=track(p.acquire(),order,0);
 await delay(30);assert.deepEqual(order,[]);assert.equal(p.snapshot().waiting,1);
 assert.equal(b.instances[0].releases,1);b.instances[0].reap();await release;
 await delay(30);assert.deepEqual(order,[0]);assert(next.s&&next.s!==s);
 next.s.release();b.instances[1].reap();await next.s.released;await tick();
 assert.equal(p.snapshot().tokens,0);await p.close();
 rows.push({name:'capacity held until reap; next acquire waits for it',ok:true,snapshot:p.snapshot()});
}
{
 const b=new Fake(),p=new SandboxPool(b,4,4,{parkingGate:gate,refillConcurrency:2});
 await p.warm();assert.equal(b.maxStarts,2);assert.equal(p.snapshot().tokens,4);
 const s=await p.acquire(),release=p.release(s);
 assert.equal(p.snapshot().tokens,4);
 await release;await p.warm();const next=await p.acquire();assert.notEqual(s,next);await p.release(next);
 await p.close();assert.equal(p.snapshot().tokens,0);
 rows.push({name:'single-use / refill concurrency=2 / close reaps all',ok:true,maxStarts:b.maxStarts,snapshot:p.snapshot()});
}
{
 const b=new Fake(),p=new SandboxPool(b,4,4,{parkingGate:gate,refillConcurrency:2});
 const warming=p.warm();await p.close();await assert.rejects(()=>warming,/aborted/);
 assert.equal(p.snapshot().tokens,0);rows.push({name:'close aborts in-flight launches',ok:true,snapshot:p.snapshot()});
}
{
 // Default launch concurrency: the engine's limits.parallelStarts (every slot for a
 // shard, two VMM boots otherwise), capped at maxLive; no backend-kind branch.
 assert.equal(new SandboxPool(new Fake(true,'shard'),0,64).refillConcurrency,64);
 assert.equal(new SandboxPool(new Fake(true,'jitk'),0,64).refillConcurrency,2);
 assert.equal(new SandboxPool(new Fake(true,'shard'),0,8).refillConcurrency,8);
 const custom=new Fake();(custom as {limits:Limits}).limits={...custom.limits,parallelStarts:5};
 assert.equal(new SandboxPool(custom,0,64).refillConcurrency,5);
 rows.push({name:'refillConcurrency default = min(maxLive, limits.parallelStarts)',ok:true});
}
{
 // A sequential caller on one slot (the R9 probe shape): release without
 // awaiting the reap, then acquire again. Before the queue this shed ~12x/run.
 const b=new Fake(true,'shard',0,1),p=new SandboxPool(b,0,1);let errors=0;
 for(let i=0;i<200;i++){try{const s=await p.acquire();p.retire(s);}catch{errors++;}}
 await p.drain();assert.equal(errors,0);assert.equal(b.instances.length,200);await p.close();
 rows.push({name:'sequential caller on 1 slot never sees an error (200 runs)',ok:true,maxWaiting:p.snapshot().maxWaiting});
}
{
 const b=new Fake(false),p=new SandboxPool(b,0,1,{maxWaiting:5}),first=await p.acquire(),order:number[]=[];
 const waiters=Array.from({length:5},(_,i)=>track(p.acquire(),order,i));
 for(let i=0;i<5;i++){
  const held=i?waiters[i-1].s!:first;held.release();b.instances[i].reap();
  while(order.length<i+1)await delay(1);
 }
 assert.deepEqual(order,[0,1,2,3,4]);
 waiters[4].s!.release();b.instances[5].reap();await tick();await p.close();
 rows.push({name:'FIFO: waiters admitted in arrival order',ok:true,order});
}
{
 const b=new Fake(false),p=new SandboxPool(b,0,1,{maxWaiting:2}),held=await p.acquire(),order:number[]=[];
 const a=track(p.acquire(),order,0),c=track(p.acquire(),order,1);
 const err=await p.acquire().then(()=>undefined,e=>e);
 assert(err instanceof OverloadedError);assert.equal(err.code,'OVERLOADED');assert.match(String(err),/OverloadedError: pool overloaded/);
 assert.equal(p.snapshot().waiting,2);
 held.release();b.instances[0].reap();while(!a.s)await delay(1);
 a.s.release();b.instances[1].reap();while(!c.s)await delay(1);
 c.s.release();b.instances[2].reap();await tick();await p.close();assert.deepEqual(order,[0,1]);
 rows.push({name:'bounded queue: beyond maxWaiting rejects OverloadedError',ok:true});
}
{
 const b=new Fake(false),p=new SandboxPool(b,0,1),held=await p.acquire(),order:number[]=[];
 const ac=new AbortController(),aborted=track(p.acquire(ac.signal),order,0),after=track(p.acquire(),order,1);
 const timed=track(p.acquire(undefined,Date.now()+20),order,2);
 await tick();assert.equal(p.snapshot().waiting,3);
 ac.abort();await tick();assert.match(String(aborted.e),/aborted/);assert.equal(p.snapshot().waiting,2);
 await delay(40);assert.match(String(timed.e),/timed out/);assert.equal(p.snapshot().waiting,1);
 // The aborted and expired waiters left no trace: the next release goes to `after`.
 held.release();b.instances[0].reap();while(!after.s)await delay(1);
 assert.deepEqual(order,[0,2,1]);assert.equal(b.instances.length,2);
 after.s.release();b.instances[1].reap();await tick();assert.equal(p.snapshot().tokens,0);await p.close();
 rows.push({name:'abort / deadline while waiting removes the waiter',ok:true});
}
{
 const b=new Fake(false),p=new SandboxPool(b,0,2);await p.acquire();await p.acquire();
 const order:number[]=[],ws=Array.from({length:3},(_,i)=>track(p.acquire(),order,i));
 await tick();assert.equal(p.snapshot().waiting,3);
 b.die(Error('backend died'));
 while(order.length<3)await delay(1);
 for(const w of ws)assert.match(String(w.e),/backend died/);
 assert.equal(p.snapshot().tokens,0);assert.equal(p.snapshot().waiting,0);await p.close();
 rows.push({name:'backend death rejects every waiter',ok:true});
}
{
 const b=new Fake(),p=new SandboxPool(b,0,1);await p.acquire();
 const w=track(p.acquire(),[],0);await p.close();await tick();
 assert.match(String(w.e),/pool closed/);
 rows.push({name:'close rejects waiters',ok:true});
}
{
 // N concurrent callers on M<N slots all complete, with M as the hard cap.
 const b=new Fake(true,'jitk',2,3),p=new SandboxPool(b,0,4,{maxWaiting:50});let done=0;
 await Promise.all(Array.from({length:50},async()=>{const s=await p.acquire();await delay(Math.random()*5);p.retire(s);done++;}));
 await p.drain();assert.equal(done,50);assert(p.snapshot().maxTokens<=4);await p.close();
 rows.push({name:'50 concurrent callers on 4 slots all complete',ok:true,snapshot:p.snapshot()});
}
{
 // Stress, the R9 shape: 48 lanes in flight on 64 slots, then 200 lanes on 64.
 for(const lanes of [48,200]){
  const b=new Fake(true,'shard',0,0),p=new SandboxPool(b,0,64);let started=0,errors=0;const t0=performance.now();
  await Promise.all(Array.from({length:lanes},async()=>{while(started<5000){started++;
   try{const s=await p.acquire();await tick();p.retire(s);}catch{errors++;}}}));
  await p.drain();const snap=p.snapshot();await p.close();
  assert.equal(errors,0);assert(snap.maxTokens<=64);
  rows.push({name:`stress: ${lanes} lanes x 5000 runs on 64 slots, no errors`,ok:true,ms:Math.round(performance.now()-t0),maxWaiting:snap.maxWaiting});
 }
}
assert.equal(recommendedWarmCount(100,.015,2,8),4);assert.equal(recommendedWarmCount(1000,.015,2,8),8);
rows.push({name:'ceil(lambda * refill_p99) + burst, capped',ok:true});
const result={loadBefore,loadAfter:execFileSync('/usr/bin/uptime',[],{encoding:'utf8'}).trim(),rows};
writeFileSync(receiptPath('pool-check-results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
