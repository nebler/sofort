import {receiptPath} from './receipt-path.js';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {SandboxPool,recommendedWarmCount} from './pool.js';
import type {Backend,Sandbox} from './backend.js';
const gate={idleCorePercent:0,evidence:'deterministic fake backend, no guest CPU'};
const delay=(ms:number)=>new Promise(r=>setTimeout(r,ms));
class Fake implements Backend {
  readonly kind='local-qjs' as const;readonly memoryLimitMB=32;
  activeStarts=0;maxStarts=0;instances:(Sandbox&{reap:()=>void;kills:number})[]=[];
  constructor(readonly autoReap=true){}
  async park(signal?:AbortSignal):Promise<Sandbox> {
    this.activeStarts++;this.maxStarts=Math.max(this.maxStarts,this.activeStarts);
    let reap!:()=>void;
    const exited=new Promise<void>(r=>{reap=r;});
    const s={exited,reap,kills:0,read:async()=>null,send:async()=>{},kill:()=>{s.kills++;if(this.autoReap)setTimeout(reap,20);}};
    this.instances.push(s);
    try {
      await delay(10);
      if(signal?.aborted){s.reap();throw Error('aborted');}
      return s;
    }finally{this.activeStarts--;}
  }
}
const rows:any[]=[],loadBefore=execFileSync('/usr/bin/uptime',[],{encoding:'utf8'}).trim();
assert.throws(()=>new SandboxPool(new Fake(),1,4),/G1/);
assert.throws(()=>new SandboxPool(new Fake(),1,4,{parkingGate:{...gate,idleCorePercent:2}}),/G1/);
assert.throws(()=>new SandboxPool(new Fake(),1,4,{parkingGate:{...gate,idleCorePercent:8}}),/G1/);
rows.push({name:'G1 denies missing / >=2% idle evidence',ok:true});
{
 const b=new Fake(false),p=new SandboxPool(b,0,1),s=await p.acquire();
 const release=p.release(s);
 assert.equal(p.snapshot().tokens,1);await assert.rejects(()=>p.acquire(),/saturated/);
 assert.equal(b.instances[0].kills,1);b.instances[0].reap();await release;
 assert.equal(p.snapshot().tokens,0);await p.close();
 rows.push({name:'capacity held until reap',ok:true,snapshot:p.snapshot()});
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
assert.equal(recommendedWarmCount(100,.015,2,8),4);assert.equal(recommendedWarmCount(1000,.015,2,8),8);
rows.push({name:'ceil(lambda * refill_p99) + burst, capped',ok:true});
const result={loadBefore,loadAfter:execFileSync('/usr/bin/uptime',[],{encoding:'utf8'}).trim(),rows};
writeFileSync(receiptPath('pool-check-results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
