import {MicroVMExecutor,SandboxPool} from '../executor.js';
import {selectBackend} from '../select-backend.js';
import {performance} from 'node:perf_hooks';
import {execFileSync} from 'node:child_process';
// The code-mode agent's output. No model/network dependency is needed to replay it.
const agentCode=`const results = await Promise.all([
  github.listIssues({repo:'jitk/kernel'}),
  github.listIssues({repo:'jitk/executor'})
]);
return {issues:results.flat(), total:results.flat().length};`;
const selected=selectBackend();
console.log(selected.selection);console.log(execFileSync('/usr/bin/uptime',[],{encoding:'utf8'}).trim());
const pool=new SandboxPool(selected.backend,selected.gate?2:0,8,{parkingGate:selected.gate});
const ex=new MicroVMExecutor(pool,()=> 'allow');
let active=0,maxActive=0;
const times:Record<string,number>={};
try{
 await pool.warm();
 console.log('Agent writes code:\n'+agentCode);
 const started=performance.now();
 const result=await ex.execute(agentCode,[{name:'github',fns:{listIssues:async(args)=>{
   active++;maxActive=Math.max(maxActive,active);
   try{await new Promise(r=>setTimeout(r,5));return [{repo:(args as any).repo,title:'Ship fresh single-use VMs'}];}finally{active--;}
 }}}],{onTiming:(event,at)=>{times[event]=at-started;}});
 times.callerResolve=performance.now()-started;
 console.log('Fresh microVM result:',JSON.stringify(result));
 console.log('Concurrent tools:',maxActive,'timings ms:',JSON.stringify(times));
 if(result.error||maxActive!==2)throw Error('demo failed');
}finally{await pool.close();}
