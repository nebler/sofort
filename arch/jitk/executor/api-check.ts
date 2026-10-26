import {receiptPath} from './receipt-path.js';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {MicroVMExecutor,SandboxPool} from './executor.js';
import {selectBackend} from './select-backend.js';
const selected=selectBackend(),pool=new SandboxPool(selected.backend,0,4),ex=new MicroVMExecutor(pool,()=> 'allow');
const loadBefore=execFileSync('/usr/bin/uptime',[],{encoding:'utf8'}).trim(),rows:any[]=[];
try {
 const fanoutSamples:number[]=[];
 for(let sample=0;sample<30;sample++) {
  let count=0,maxOutstanding=0;const waiting:{n:number;resolve:(x:number)=>void}[]=[];
  const start=performance.now();
  const r=await ex.execute('return await Promise.all(Array.from({length:64},(_,i)=>api.work(i)))',[{name:'api',fns:{work:async(n)=>new Promise(resolve=>{
    count++;waiting.push({n:n as number,resolve});maxOutstanding=Math.max(maxOutstanding,waiting.length);
    if(count===64)for(const w of [...waiting].reverse())w.resolve(w.n);
  })}}],{timeout:10000});
  fanoutSamples.push(performance.now()-start);await pool.drain();
  assert(!r.error,JSON.stringify(r));assert.deepEqual(r.result,Array.from({length:64},(_,i)=>i));assert.equal(maxOutstanding,64);
 }
 const sorted=[...fanoutSamples].sort((a,b)=>a-b);
 rows.push({name:'64 calls admitted before any reply; reverse completion order',n:30,calls:1920,maxOutstanding:64,executeMs:{median:sorted[14],p90:sorted[26],p99:sorted[29]},samples:fanoutSamples});
 for(const [name,code,providers,expected] of [
   ['undefined final becomes null','return undefined',[],null],
   ['undefined tool becomes null','return await api.nothing()',[{name:'api',fns:{nothing:async()=>undefined}}],null],
   ['variadic args preserved','return await api.args(1,"two",{three:3})',[{name:'api',fns:{args:async(...a:unknown[])=>a}}],[1,'two',{three:3}]],
   ['caught tool error continues','try{await api.fail()}catch(e){return e.message}',[{name:'api',fns:{fail:async()=>{throw Error('expected failure');}}}],'Error: expected failure']
 ] as const) {
   const result=await ex.execute(code,[...providers] as any);assert(!result.error,JSON.stringify(result));assert.deepEqual(result.result,expected);rows.push({name,result});
 }
}finally{await pool.close();}
const result={selection:selected.selection,loadBefore,loadAfter:execFileSync('/usr/bin/uptime',[],{encoding:'utf8'}).trim(),pool:pool.snapshot(),rows};
writeFileSync(receiptPath('api-check-results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
