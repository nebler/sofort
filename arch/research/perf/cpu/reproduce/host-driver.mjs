import {writeFileSync,readFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {loadavg} from 'node:os';
import {pathToFileURL} from 'node:url';
const R='/tmp/sofort-a2',N=+(process.env.N??50),W=5,delay=ms=>new Promise(r=>setTimeout(r,ms));
const tracing=process.env.A2_HOOKS==='1';if(tracing)await import('./host-hooks.mjs');
const variant=process.env.A2_VARIANT??'base';
const {MicroVMExecutor,SandboxPool,JitkBackend}=await import(pathToFileURL(`${R}/arch/jitk/executor/build/executor${variant==='base'?'-base':''}.js`));
const results=[];
const {createRequire}=await import('node:module');const native=createRequire(import.meta.url)('./rusage.node');
const sample=()=>({children:native.children(),t:performance.now()*1000,cpu:process.cpuUsage(),ru:process.resourceUsage(),uv:performance.nodeTiming.uvMetricsInfo,elu:performance.eventLoopUtilization()});
for(const mode of ['parked','cold']){
 const backend=new JitkBackend(`${R}/vmm-base`,{launcher:'01-vmm',image:`${R}/images/base/kernel.bin`,sandboxProfile:`${R}/profile.sbbin`});
 const pool=new SandboxPool(backend,mode==='parked'?1:0,3,{refillConcurrency:1,parkingGate:{idleCorePercent:0,evidence:'pinned kernel existing G1; profiling only'}});
 const ex=new MicroVMExecutor(pool,()=> 'allow',10000);
 try{
  for(let i=0;i<N+W;i++)for(const c of (i%2?['one_tool','return2']:['return2','one_tool'])){
   await pool.drain();if(mode==='parked')await pool.warm();await delay(5);
   const label=mode+'/'+c;globalThis.__a2?.begin(label);
   const start=sample(),marks=[];
   const out=await ex.execute(c==='return2'?'return 2;':'return await test.echo(2);',[{name:'test',fns:{echo:async a=>a}}],{onTiming:(name,at)=>marks.push({name,t:at*1000,cpu:process.cpuUsage()})});
   const end=sample();globalThis.__a2?.end({mode,case:c,warmup:i<W});
   if(out.error||out.result!==2)throw Error(JSON.stringify(out));
   await pool.drain();if(mode==='parked')await pool.warm();const serviceEnd=sample();
   results.push({label,i,warmup:i<W,start,end,serviceEnd,marks,load:loadavg(),pid:globalThis.__a2lastPid});
  }
 }finally{await pool.close();}
}
writeFileSync(`${R}/raw/host-${variant}-${tracing?'hooks':'control'}${process.env.A2_SUFFIX??''}.json`,JSON.stringify({N,variant,tracing,rows:results},null,2));
