import {performance} from 'node:perf_hooks';
import {writeFile} from 'node:fs/promises';
import {LocalProcessQjsBackend,MicroVMExecutor,SandboxPool} from './executor.js';
const qjs=process.env.QJS??'/tmp/jitk-04/quickjs-2026-06-04/qjs';
const providers=[{name:'github',fns:{listIssues:async(...args:unknown[])=>{if((args[0] as any).repo!=='x')throw new Error('repo');return [{id:1},{id:2}];}}}];
const code="const r = await github.listIssues({repo:'x'}); return r.length";
const samples:Record<string,number[]>={};
for(const warm of [0,4])for(const tools of [false,true]){
  const pool=new SandboxPool(new LocalProcessQjsBackend(qjs),warm,8);
  const executor=new MicroVMExecutor(pool,()=> 'allow');
  await pool.warm();samples[`warm${warm}-${tools?'one-tool':'no-tool'}`]=[];
  for(let i=0;i<110;i++){
    // Refill is outside the measured warm acquire→reap path; report separately.
    if(warm)await pool.warm();
    const start=performance.now(),r=await executor.execute(tools?code:'return 2',providers),ms=performance.now()-start;
    if(r.result!==2||r.error)throw new Error(JSON.stringify(r));
    if(i>=10)samples[`warm${warm}-${tools?'one-tool':'no-tool'}`]!.push(ms);
    if(i===0)console.log(JSON.stringify({warm,tools,result:r}));
  }
  await pool.close();
}
const summary=Object.fromEntries(Object.entries(samples).map(([k,v])=>{const s=[...v].sort((a,b)=>a-b);return[k,{n:s.length,median:s[50],p90:s[90],min:s[0],max:s.at(-1)}];}));
console.log(JSON.stringify(summary,null,2));
await writeFile(process.cwd()+'/bench-results.json',JSON.stringify({node:process.version,qjs,summary,samples},null,2)+'\n');
