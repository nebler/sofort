import {writeFileSync}from'node:fs';import{execFileSync}from'node:child_process';import*as rules from'./head/arch/jitk/executor/policy/policy.mjs';import{parse,stringify}from'./head/arch/jitk/executor/codec.mjs';
const uptime=()=>execFileSync('/usr/bin/uptime',{encoding:'utf8'}).trim();const rows=[],loadBefore=uptime();let sink=0;
const issuer={issue:async()=>undefined,revoke:async()=>{}},signal=new AbortController().signal;
const tool={args:a=>a,reads:'public',egress:false,writes:false,timeoutMs:30000,invoke:async a=>a[0],output:v=>v};
function freeze(v){if(v&&typeof v==='object'&&!ArrayBuffer.isView(v)){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;}
for(const mode of['decide','decide_dispatch','executor_policy_path'])for(let sample=-3;sample<31;sample++){
 let us=0;const n=2000;
 for(let i=0;i<n;i++){
  const run=rules.createRun({tools:{api:{echo:tool}},deadline:Date.now()+30000});const call={t:'call',id:1,ns:'api',fn:'echo',args:['x']};
  const t=process.hrtime.bigint();
  const decision=rules.decide(run,mode==='executor_policy_path'?{...call,args:parse(JSON.stringify(call.args))}:call);
  if(mode==='executor_policy_path'){freeze({...call,args:structuredClone(decision.call.args)});await (()=>'allow')();}
  if(mode!=='decide'){const ok=await rules.dispatch(run,decision.call,{issuer,signal:undefined});if(mode==='executor_policy_path')sink+=JSON.parse(stringify(ok)).length;}
  us+=Number(process.hrtime.bigint()-t)/1000;
 }if(sample>=0)rows.push({mode,sample,n,us:us/n});
}
writeFileSync('/tmp/sofort-a4/raw/policy-components.json',JSON.stringify({loadBefore,loadAfter:uptime(),node:process.version,rows,sink,signalNote:'signal omitted to avoid creating 2000 persistent abort listeners; separate actual-call probes pass live signal'},null,2)+'\n');console.log('policy samples',rows.length);
