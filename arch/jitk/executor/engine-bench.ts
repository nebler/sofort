// Per-run cost of the Mac engines through the canonical executor (R10 #10,
// hvf-spike/REPORT.md productionization 5): libkrun (`jitk`, a cold VMM per
// run) vs the HVF engine (`hvf`, persistent engine processes reset between
// runs). Offline measurement; not part of `make test`.
//
//   node build/engine-bench.js [KIND...]       default: jitk hvf; prints JSON
//   node build/engine-bench.js run KIND N      one measured process (internal)
//
// Each KIND runs in its own Node process, sequentially, one execute() at a
// time through a SandboxPool (4 live; libkrun 2 warm) and MicroVMExecutor, per case:
// `return 2` and one tool call. Wall: execute() start to result, p50/p99
// after 10 warmups. CPU: /usr/bin/time's user+sys of that process and every
// process it waited for (Node, the VMMs, the HVF zygote and the engine
// processes it reaps), measured with N runs and with 0 runs; the difference
// over N is the per-run CPU, engine startup excluded. Resolution is 10 ms per
// measurement, so N is chosen per engine to keep it under ~3%.
// JITK_BENCH_N_JITK / JITK_BENCH_N_HVF override N. The machine's load
// averages are recorded before and after.
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {MicroVMExecutor,SandboxPool,type Backend} from './executor.js';
import {selectBackend} from './select-backend.js';

const CASES:Record<string,{code:string;tools?:boolean}>={
  return2:{code:'return 2'},
  one_tool:{code:'return (await t.echo(41))+1',tools:true},
};
const providers=[{name:'t',fns:{echo:async(x:unknown)=>x}}];
const load=()=>execFileSync('/usr/sbin/sysctl',['-n','vm.loadavg'],{encoding:'utf8'}).trim();
const quantile=(v:number[],q:number)=>{const a=[...v].sort((x,y)=>x-y);return a[Math.min(a.length-1,Math.ceil(a.length*q)-1)]!;};

async function measure(kind:string,n:number) {
  process.env.JITK_BACKEND=kind==='jitk'?'jitk':'hvf';
  const selected=selectBackend();
  const engine:Backend=selected.backend;
  // Warm parking needs a parking-gate receipt: libkrun has one; HVF has one
  // once hvf-parking-gate.ts measured this engine binary, else it runs unwarmed.
  const pool=selected.gate?new SandboxPool(engine,2,4,{parkingGate:selected.gate}):new SandboxPool(engine,0,4);
  const ex=new MicroVMExecutor(pool,()=> 'allow',10000);
  const out:Record<string,unknown>={kind,n,selection:selected.selection};
  try {
    await pool.warm();
    for(const [name,c] of Object.entries(CASES)){
      if(n===0)continue;
      const run=async()=>{const t=performance.now();const r=await ex.execute(c.code,c.tools?providers:[]);const ms=performance.now()-t;if(r.error)throw Error(name+': '+r.error);return ms;};
      for(let i=0;i<10;i++)await run();
      const wall:number[]=[];
      for(let i=0;i<n;i++)wall.push(await run());
      out[name]={p50Ms:quantile(wall,.5),p99Ms:quantile(wall,.99),maxMs:Math.max(...wall)};
    }
  } finally {await pool.close();await engine.close?.();}
  console.log(JSON.stringify(out));
}

/** user+sys seconds of one measured child process and everything it reaped. */
function timed(kind:string,n:number):{cpuS:number;result:Record<string,unknown>} {
  const self=fileURLToPath(import.meta.url);
  const r=spawnSync('/usr/bin/time',['-p',process.execPath,self,'run',kind,String(n)],{encoding:'utf8',env:process.env,maxBuffer:1<<24});
  if(r.status!==0)throw Error(`engine-bench ${kind} ${n}: exit ${r.status}\n${r.stderr.slice(-2000)}`);
  const field=(k:string)=>{const m=r.stderr.match(new RegExp('^'+k+' ([0-9.]+)$','m'));if(!m)throw Error('engine-bench: no '+k+' time from /usr/bin/time');return Number(m[1]);};
  const line=r.stdout.trim().split('\n').filter(l=>l.startsWith('{')).at(-1)!;
  return {cpuS:field('user')+field('sys'),result:JSON.parse(line)};
}

if(process.argv[2]==='run'){
  await measure(process.argv[3]!,Number(process.argv[4]));
}else{
  const kinds=process.argv.slice(2).length?process.argv.slice(2):['jitk','hvf'];
  const report:Record<string,unknown>={host:`${process.platform}-${process.arch}`,loadBefore:load(),started:new Date().toISOString(),engines:{}};
  for(const kind of kinds){
    const n=Number(process.env[`JITK_BENCH_N_${kind.toUpperCase()}`]??(kind==='jitk'?300:2000));
    const base=timed(kind,0),full=timed(kind,n);
    const runs=n*Object.keys(CASES).length;
    (report.engines as Record<string,unknown>)[kind]={...full.result,cpuUsPerRun:Math.round((full.cpuS-base.cpuS)/runs*1e6),cpuSeconds:{withRuns:full.cpuS,startupOnly:base.cpuS},runs,load:load()};
  }
  report.loadAfter=load();
  console.log(JSON.stringify(report,null,1));
}
