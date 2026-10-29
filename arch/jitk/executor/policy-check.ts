import {receiptPath} from './receipt-path.js';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {MicroVMExecutor,SandboxPool} from './executor.js';
import {policySource,type Tool,type Issuer} from './policy-adapter.js';
import {selectBackend} from './select-backend.js';
// Preserve all 22 assertions from the security owner against the exact imported module.
const testPath=policySource.replace('policy.mjs','policy-test.mjs');
const original=readFileSync(testPath,'utf8')
 .replace("'./policy.mjs'",JSON.stringify(pathToFileURL(policySource).href));
await import('data:text/javascript;base64,'+Buffer.from(original).toString('base64'));
const selected=selectBackend(),pool=new SandboxPool(selected.backend,0,8),loadBefore=execFileSync('/usr/bin/uptime',[],{encoding:'utf8'}).trim();
let live=0,minted=0,revoked=0,effects=0;const scopes:string[]=[],keys:string[]=[],rows:any[]=[];
const issuer:Issuer={issue:async s=>{scopes.push(s.scope);live++;minted++;return 'SECRET-'+s.scope;},revoke:async()=>{live--;revoked++;}};
const args=(a:unknown[])=>{if(a.length!==1||typeof a[0]!=='object'||a[0]===null||Object.keys(a[0]).join()!=='q'||typeof (a[0] as any).q!=='string')throw Error('schema');return a;};
const make=(reads:Tool['reads'],egress:boolean,writes:boolean,endorsable=false):Tool=>({args,reads,egress,writes,endorsable,timeoutMs:1000,
 invoke:async(a,cred,ctx)=>{assert.match(cred,/^SECRET-/);assert(!ctx.signal.aborted);keys.push(ctx.idempotencyKey);if(writes)effects++;return {q:reads==='private'?'secret':a[0].q,internal:'redact'};},output:v=>({q:v.q})});
const tools={mail:{search:make('private',false,false),send:make('none',true,true,true)},web:{fetch:make('public',true,false)},api:{pure:make('none',false,false),fail:{...make('none',false,false),invoke:async()=>{throw Error('tool failure');}}},
  vault:{leak:{...make('private',false,false),invoke:async(_a:unknown,cred:unknown)=>{throw Error('upstream said secret '+String(cred));}}}};
const providers=Object.entries(tools).map(([name,fns])=>({name,fns:Object.fromEntries(Object.keys(fns).map(fn=>[fn,async()=>{throw Error('legacy invocation bypassed');}]))}));
const ex=new MicroVMExecutor(pool,()=> 'allow',10000,{tools,issuer});
const check=(name:string,c:unknown)=>{assert(c,name);rows.push({name,ok:true});};
const run=async(code:string,approve?:any)=>{await pool.drain();return ex.execute(code,providers,{approve});};
try{
 let r=await run("return await mail.send({q:'clean'})");check('clean run may send',!r.error&&effects===1);
 r=await run("return await mail.search({q:'x'})");check('private read returns value',(r.result as any)?.q==='secret');
 check('minted credentials revoked',live===0&&minted===revoked);
 check('credentials absent from result',!JSON.stringify(r).includes('SECRET'));
 check('output redaction applied',!JSON.stringify(r).includes('internal'));
 r=await run("await mail.search({q:'x'});return await mail.send({q:'secret'})");check('private read then send needs approval',/approval required/.test(r.error??''));
 check('unapproved write has no effect',effects===1);
 let approvals=0;
 r=await run("await mail.search({q:'x'});return await mail.send({q:'secret'})",async(call:any)=>{approvals++;assert.equal(call.args[0].q,'secret');return true;});
 check('approved exact call executes',!r.error&&Number(effects)===2&&approvals===1);
 r=await run("await mail.search({q:'x'});return await web.fetch({q:'exfil'})",async()=>{throw Error('must not request approval');});check('private read to nonendorsable egress denied',/policy denied/.test(r.error??''));
 r=await run("await web.fetch({q:'one'});return await web.fetch({q:'two'})");check('public browsing stays approval free',!r.error&&(r.result as any)?.q==='two');
 r=await run("await web.fetch({q:'x'});return await mail.send({q:'injected'})");check('untrusted output then writes needs approval',/approval required/.test(r.error??''));
 r=await run("return await mail.send({q:'fresh'})");check('labels reset for a fresh VM/run',!r.error&&Number(effects)===3);
 const before=minted;r=await run("return await web.fetch({q:5})");check('schema denied',/policy denied: schema/.test(r.error??''));check('schema deny mints no credentials',minted===before);
 r=await run("return await api.fail({q:'x'})");check('tool errors returned without their text',/api\.fail failed/.test(r.error??'')&&!/tool failure/.test(r.error??''));
 r=await run("let m='';try{await vault.leak({q:'x'})}catch(e){m=String(e.message)}try{await web.fetch({q:m})}catch(e){return m+'|'+e.message}");
 check('failed private read redacted and still taints',(r.result as string)==='vault.leak failed|Error: policy denied: private data may not leave via this tool');check('credentials revoked on exception',live===0&&minted===revoked);
 check('credentials minted with exact tool scope',scopes.includes('mail.search')&&scopes.includes('mail.send')&&scopes.includes('web.fetch'));
 check('per-call idempotency keys unique',new Set(keys).size===keys.length);
 r=await run("for(let i=0;i<17;i++){try{await web.fetch({q:1})}catch{}}return 2");check('denial budget kills run',Boolean(r.error));
 const limited=new MicroVMExecutor(pool,()=> 'allow',10000,{tools,issuer,limits:{calls:2}});
 r=await limited.execute("await api.pure({q:'a'});await api.pure({q:'b'});return await api.pure({q:'c'})",providers);check('policy call budget kills run with its reason',/policy violation: call budget/.test(r.error??'')&&limited.callLimit===2&&new MicroVMExecutor(pool,()=> 'allow').callLimit===pool.backend.limits.js!.calls);
 r=await run("await api.pure({q:'x'});return await api.pure({q:'y'})");check('none-read computation does not taint',!r.error);
 check('no credentials left live at end',live===0&&minted===revoked);
}finally{await pool.close();}
assert.equal(rows.length,23);writeFileSync(receiptPath('policy-check-results.json'),JSON.stringify({policySource,selection:selected.selection,loadBefore,loadAfter:execFileSync('/usr/bin/uptime',[],{encoding:'utf8'}).trim(),rows,minted,revoked,live},null,2)+'\n');console.log('23 executor policy assertions passed (plus 22 security owner assertions)');
