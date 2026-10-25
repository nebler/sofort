// Reviewer-only real-VM resource tests. No external tools or credentials.
import {copyFileSync,mkdirSync,readFileSync,writeFileSync,chmodSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadavg} from 'node:os';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const root='/tmp/jitk-10/h2-01/jitk/executor';
const selection=JSON.parse(readFileSync(new URL('h2-executor-selection.json',import.meta.url)));
const frozen=process.env.JITK_REVIEW_RESOURCE_DIR||'/tmp/jitk-10/h5-resource';mkdirSync(frozen,{recursive:true});
copyFileSync(selection.host.path,frozen+'/jitk-vmm');chmodSync(frozen+'/jitk-vmm',0o755);
copyFileSync(selection.image.path,frozen+'/kernel.bin');
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const api=await import(pathToFileURL(root+'/build/executor.js'));
const backend=new api.JitkBackend(frozen+'/jitk-vmm',{launcher:'01-vmm',image:frozen+'/kernel.bin',startupMs:5000,lifetimeMs:5000});
const pool=new api.SandboxPool(backend,1,2,{parkingGate:{idleCorePercent:0,evidence:selection.gate.evidence}});
const executor=new api.MicroVMExecutor(pool,()=> 'allow',1000);
const data={started_utc:new Date().toISOString(),uptime_start:execFileSync('/usr/bin/uptime',{encoding:'utf8'}).trim(),
  vmm_sha256:sha(frozen+'/jitk-vmm'),image_sha256:sha(frozen+'/kernel.bin'),
  scope:'Real fresh single-use VMs; reviewed SDK copy. Warm preparation excluded; timings are resource/deadline diagnostics, NOT canonical H4 performance. No providers with external effects or credentials.',
  fixed_vm_lifetime_ms:5000,n_per_case:30,rows:[]};
const output=new URL(process.env.JITK_REVIEW_RESOURCE_OUT||'h5-resource-probe.json',import.meta.url);
const save=()=>writeFileSync(output,JSON.stringify(data,null,2)+'\n');
const codes={memory:'const a=[]; while(true) a.push(new Uint8Array(1048576));',
  stack:'function recurse(){return recurse()+1;} return recurse();',
  cpu:'while(true){}',
  blocked_host:'return await review.block();'};
const selectedCases=(process.env.JITK_REVIEW_CASES||'memory,stack,blocked_host').split(',');
let invoked=false;
try {
  for(let round=0;round<30;round++)for(const name of selectedCases) {
    await pool.warm();invoked=false;
    const timeout=name==='blocked_host'||name==='cpu'?30:1000;
    const providers=name==='blocked_host'?[{name:'review',fns:{block:async()=>{
      invoked=true;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,200);return 2;
    }}}]:[];
    const before=loadavg(),start=performance.now();
    const result=await executor.execute(codes[name],providers,{timeout});
    const elapsed=performance.now()-start;
    await pool.drain();await pool.warm();
    const control=await executor.execute('return 2',[],{timeout:1000});
    await pool.drain();
    const row={case:name,round,timeout_ms:timeout,blocking_tool_invoked:invoked,
      elapsed_ms:elapsed,overshoot_ms:Math.max(0,elapsed-timeout),
      result:result.result,error:result.error,control_ok:control.result===2&&!control.error,
      handled:name==='blocked_host'?undefined:Boolean(result.error),load_before:before,load_after:loadavg()};
    data.rows.push(row);save();
    if(!row.control_ok)throw Error('fresh-VM liveness control failed');
  }
}catch(error){data.harness_error=String(error);process.exitCode=1;}
finally {
  await pool.close();data.pool_after_close=pool.snapshot();
  data.finished_utc=new Date().toISOString();data.uptime_end=execFileSync('/usr/bin/uptime',{encoding:'utf8'}).trim();
  const quant=(xs,q)=>{const a=xs.slice().sort((a,b)=>a-b);return q===.5&&a.length%2===0?(a[a.length/2-1]+a[a.length/2])/2:a[Math.ceil(q*a.length)-1];};
  data.summary={};
  for(const name of selectedCases){
    const rows=data.rows.filter(r=>r.case===name),elapsed=rows.map(r=>r.elapsed_ms),admitted=rows.filter(r=>r.blocking_tool_invoked);
    data.summary[name]={n:rows.length,handled:rows.filter(r=>r.handled).length,controls_pass:rows.filter(r=>r.control_ok).length,
      elapsed_ms:{median:quant(elapsed,.5),p90:quant(elapsed,.9),p99:quant(elapsed,.99)},
      blocked_invocations:admitted.length,admitted_overshoot_gt50ms:admitted.filter(r=>r.overshoot_ms>50).length,
      late_successes:admitted.filter(r=>!r.error&&r.elapsed_ms>r.timeout_ms).length};
  }
  save();console.log(JSON.stringify({summary:data.summary,pool_after_close:data.pool_after_close,harness_error:data.harness_error},null,2));
}
