// Reviewer-only real-VM resource tests. No external tools or credentials.
import {copyFileSync,mkdirSync,readFileSync,writeFileSync,chmodSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadavg} from 'node:os';
import {execFileSync} from 'node:child_process';
import {pathToFileURL,fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../jitk/executor',import.meta.url));
const selection=JSON.parse(readFileSync(root+'/integration-selection.json'));
const frozen=process.env.JITK_REVIEW_RESOURCE_DIR||'/tmp/jitk-04/r4/probe-artifacts';mkdirSync(frozen,{recursive:true});
copyFileSync(selection.host.path,frozen+'/jitk-vmm');chmodSync(frozen+'/jitk-vmm',0o755);
copyFileSync(selection.image.path,frozen+'/kernel.bin');
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const api=await import(pathToFileURL(root+'/build/executor.js'));
const backend=new api.JitkBackend(frozen+'/jitk-vmm',{launcher:'01-vmm',image:frozen+'/kernel.bin',startupMs:5000,lifetimeMs:5000});
const armed=[];
const park=backend.park.bind(backend);
backend.park=async(...args)=>{
 const s=await park(...args),arm=s.armDeadline.bind(s),kill=s.kill.bind(s);
 const trace={sandbox:s,parentKillAt:undefined,deadline:undefined};
 s.armDeadline=async deadline=>{trace.deadline=deadline;armed.push(trace);await arm(deadline);};
 s.kill=()=>{trace.parentKillAt??=Date.now();kill();};
 return s;
};
const pool=new api.SandboxPool(backend,1,2,{parkingGate:{idleCorePercent:0,evidence:selection.gate.evidence}});
const executor=new api.MicroVMExecutor(pool,()=> 'allow',1000);
const data={started_utc:new Date().toISOString(),uptime_start:execFileSync('/usr/bin/uptime',{encoding:'utf8'}).trim(),
  vmm_sha256:sha(frozen+'/jitk-vmm'),image_sha256:sha(frozen+'/kernel.bin'),
  executor_sha256:sha(root+'/build/executor.js'),watchdog_sha256:sha(root+'/watchdog.py'),
  executor_source_sha256:sha(root+'/executor.ts'),pool_source_sha256:sha(root+'/pool.ts'),
  scope:'Real fresh single-use VMs; current canonical SDK (original area-10 probe, path changes plus watchdog timestamp observation). Warm preparation excluded; timings are resource/deadline diagnostics, NOT canonical H4 performance. No providers with external effects or credentials.',
  fixed_vm_lifetime_ms:5000,n_per_case:30,rows:[]};
const output=new URL(process.env.JITK_REVIEW_RESOURCE_OUT||'h5-resource-probe.json',import.meta.url);
const save=()=>writeFileSync(output,JSON.stringify(data,null,2)+'\n');
const codes={memory:'const a=[]; while(true) a.push(new Uint8Array(1048576));',
  stack:'function recurse(){return recurse()+1;} return recurse();',
  cpu:'while(true){}',
  blocked_host:'return await review.block();'};
const selectedCases=(process.env.JITK_REVIEW_CASES||'blocked_host').split(',');
let invoked=false,signalReceived=false,toolSignal;
try {
  for(let round=0;round<30;round++)for(const name of selectedCases) {
    await pool.warm();invoked=false;signalReceived=false;toolSignal=undefined;
    const armedBefore=armed.length;
    const timeout=name==='blocked_host'||name==='cpu'?30:1000;
    const providers=name==='blocked_host'?[{name:'review',fns:{block:async function(){
      invoked=true;toolSignal=this?.signal;signalReceived=toolSignal instanceof AbortSignal;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,200);return 2;
    }}}]:[];
    const before=loadavg(),start=performance.now();
    const result=await executor.execute(codes[name],providers,{timeout});
    const elapsed=performance.now()-start;
    await pool.drain();
    const trace=armed.slice(armedBefore).at(-1);
    const receipt=trace?.sandbox.deadlineReceipt;
    const enforcementAt=receipt?.killAt??trace?.parentKillAt;
    const enforcementOvershoot=trace&&enforcementAt!==undefined?Math.max(0,enforcementAt-trace.deadline):undefined;
    await pool.warm();
    const control=await executor.execute('return 2',[],{timeout:1000});
    await pool.drain();
    const row={case:name,round,timeout_ms:timeout,blocking_tool_invoked:invoked,
      elapsed_ms:elapsed,overshoot_ms:Math.max(0,elapsed-timeout),
      callback_signal_received:signalReceived,callback_signal_aborted:toolSignal?.aborted,
      watchdog_receipt:receipt,parent_kill_at:trace?.parentKillAt,absolute_deadline:trace?.deadline,
      vm_enforcement_overshoot_ms:enforcementOvershoot,
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
    data.summary[name]={n:rows.length,timeout_errors:rows.filter(r=>r.error?.includes("timed out")).length,api_overshoot_le50:rows.filter(r=>r.overshoot_ms<=50).length,
      vm_enforcement_overshoot_le50:rows.filter(r=>r.vm_enforcement_overshoot_ms<=50).length,
      watchdog_receipts:rows.filter(r=>r.watchdog_receipt).length,
      callback_signals:rows.filter(r=>r.callback_signal_received&&r.callback_signal_aborted).length,
      max_api_overshoot_ms:Math.max(...rows.map(r=>r.overshoot_ms)),
      max_vm_enforcement_overshoot_ms:Math.max(...rows.map(r=>r.vm_enforcement_overshoot_ms??NaN)),handled:rows.filter(r=>r.handled).length,controls_pass:rows.filter(r=>r.control_ok).length,
      elapsed_ms:{median:quant(elapsed,.5),p90:quant(elapsed,.9),p99:quant(elapsed,.99)},
      blocked_invocations:admitted.length,admitted_overshoot_gt50ms:admitted.filter(r=>r.overshoot_ms>50).length,
      late_successes:admitted.filter(r=>!r.error&&r.elapsed_ms>r.timeout_ms).length};
  }
  save();console.log(JSON.stringify({summary:data.summary,pool_after_close:data.pool_after_close,harness_error:data.harness_error},null,2));
}
