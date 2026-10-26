import {receiptPath} from './receipt-path.js';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {MicroVMExecutor,SandboxPool,ProcessBackend} from './executor.js';
const rows:any[]=[],loadBefore=execFileSync('/usr/bin/uptime',[],{encoding:'utf8'}).trim();
for(const mode of ['badready','del','trailing','duplicate','unknown','replay']) {
 let effects=0,policies=0;
 const backend=new ProcessBackend('local-qjs',process.execPath,[fileURLToPath(new URL('../fixtures/protocol-peer.mjs',import.meta.url)),mode]);
 const pool=new SandboxPool(backend,0,1),ex=new MicroVMExecutor(pool,()=>{policies++;return 'allow';});
 try {
  const r=await ex.execute('return 2',[{name:'api',fns:{effect:async()=>++effects}}]);
  assert(r.error,mode+' must fail');assert.equal(effects,mode==='replay'?1:0);
  assert.equal(policies,mode==='replay'?1:0);
  rows.push({mode,result:r,effects,policies});
 }finally{await pool.close();assert.equal(pool.snapshot().tokens,0);}
}
const result={loadBefore,loadAfter:execFileSync('/usr/bin/uptime',[],{encoding:'utf8'}).trim(),rows};
writeFileSync(receiptPath('transport-check-results.json'),JSON.stringify(result,null,2)+'\n');console.log(result);
