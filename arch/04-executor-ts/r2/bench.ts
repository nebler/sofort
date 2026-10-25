import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFileSync,readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {MicroVMExecutor,SandboxPool,recommendedWarmCount} from './executor.js';
import {selectBackend} from './select-backend.js';
const selected=selectBackend(),n=Number(process.env.BENCH_N??50);
if(n<30)throw Error('n >= 30 required');
const uptime=()=>execFileSync('/usr/bin/uptime',[],{encoding:'utf8'}).trim();
function quant(v:number[]){const s=[...v].sort((a,b)=>a-b);const p=(q:number)=>s[Math.max(0,Math.ceil(q*s.length)-1)];return {n:s.length,median:p(.5),p90:p(.9),p99:p(.99),min:s[0],max:s.at(-1)};}
const providers=[{name:'github',fns:{listIssues:async(...args:unknown[])=>{assert.deepEqual(args,[{repo:'x'}]);return [{id:1},{id:2}];}}}];
const cases=[['return2','return 2',2],['one-tool',"const r=await github.listIssues({repo:'x'});return r.length",2],['fanout10',"return (await Promise.all(Array.from({length:10},()=>github.listIssues({repo:'x'})))).map(r=>r.length)",Array(10).fill(2)]] as const;
const rows:any[]=[];
for(const warm of selected.gate?[0,4]:[0]) {
  for(const [name,code,expected] of cases) {
    const pool=new SandboxPool(selected.backend,warm,8,{refillConcurrency:2,parkingGate:selected.gate});
    const ex=new MicroVMExecutor(pool,()=> 'allow');
    const loadBefore=uptime(),samples:number[]=[],refill:number[]=[];
    try {
      for(let i=0;i<n+5;i++) {
        const fill=performance.now();if(warm)await pool.warm();const filled=performance.now()-fill;
        const start=performance.now(),r=await ex.execute(code,providers),ms=performance.now()-start;
        assert(!r.error,JSON.stringify(r));assert.deepEqual(r.result,expected);
        if(i>=5){samples.push(ms);refill.push(filled);}
      }
    }finally{await pool.close();}
    const row={warm,name,loadBefore,loadAfter:uptime(),executeMs:quant(samples),refillWaitMs:quant(refill),pool:pool.snapshot(),samples,refill};
    rows.push(row);console.log(JSON.stringify({...row,samples:undefined,refill:undefined}));
    writeFileSync('bench-results.json',JSON.stringify({node:process.execPath,version:process.version,selection:selected.selection,gate:selected.gate,rows},null,2)+'\n');
  }
}
// Measure single ready-to-reap lifecycle independently for the sizing formula.
const startup:number[]=[],loadBefore=uptime();
for(let i=0;i<n;i++) {
  const start=performance.now(),s=await selected.backend.park();
  startup.push(performance.now()-start);s.kill();await s.exited;
}
const result={node:process.execPath,version:process.version,selection:selected.selection,gate:selected.gate,rows,
  startup:{loadBefore,loadAfter:uptime(),readyMs:quant(startup),samples:startup},
  sizingExample:{lambda:100,burst:2,cap:8,warmCount:recommendedWarmCount(100,quant(startup).p99/1000,2,8)}};
writeFileSync('bench-results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({startup:result.startup.readyMs,sizingExample:result.sizingExample}));
