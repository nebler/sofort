// Read-only probe: ignored AbortSignal must not be mistaken for completed work.
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const canonical=new URL('../../jitk/executor/policy/policy.mjs',import.meta.url);
const historical=new URL('../../07-security-sandbox/policy.mjs',import.meta.url);
const selected=existsSync(canonical)?canonical:historical;
const sourceSha256=createHash('sha256').update(readFileSync(selected)).digest('hex');
const rules=await import(selected.href);
let invoked=false,aborted=false,revoked=false,settled=false;
const tool={args:a=>a,reads:'public',egress:false,writes:false,timeoutMs:5,
  invoke:async(args,cred,{signal})=>{invoked=true;signal.addEventListener('abort',()=>aborted=true);return new Promise(()=>{});},
  output:v=>v};
const run=rules.createRun({tools:{test:{hang:tool}},deadline:Date.now()+1000});
const decision=rules.decide(run,{t:'call',id:1,ns:'test',fn:'hang',args:[]});
const start=performance.now();
const pending=rules.dispatch(run,decision.call,{issuer:{issue:async()=>({opaque:true}),revoke:async()=>{revoked=true;}}});
void pending.then(()=>settled=true,()=>settled=true);
await new Promise(resolve=>setTimeout(resolve,100));
const result={source:selected.pathname,sourceSha256,integrated:selected===canonical,timeoutMs:5,elapsedMs:performance.now()-start,
  invoked,aborted,revoked,settled,outstanding:run.outstanding,
  interpretation:'AbortSignal is cooperative: no host-side completion/revocation guarantee for a tool that ignores it.'};
writeFileSync(new URL(selected===canonical?'policy-timeout-canonical.json':'policy-timeout-probe.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
