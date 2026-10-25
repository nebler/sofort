import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {selectBackend} from './select-backend.js';
import {JitkBackend,SandboxPool,MicroVMExecutor} from './executor.js';
selectBackend();
const pinned=JSON.parse(readFileSync('integration-selection.json','utf8'));
const backend=new JitkBackend('/tmp/jitk-01/r2/jitk-vmm',{launcher:'01-vmm',image:pinned.image.path});
const p=new SandboxPool(backend,0,4),ex=new MicroVMExecutor(p,()=> 'allow');
const loadBefore=execFileSync('/usr/bin/uptime',[],{encoding:'utf8'}).trim(),results=[];
try {
 for(const code of ['return 2',"return (await github.listIssues({repo:'x'})).length"]) {
  const r=await ex.execute(code,[{name:'github',fns:{listIssues:async()=>[{id:1},{id:2}]}}]);assert.equal(r.result,2,JSON.stringify(r));assert(!r.error);results.push({code,result:r});
 }
}finally{await p.close();}
const result={launcher:'/tmp/jitk-01/r2/jitk-vmm',kernel:pinned.image,loadBefore,loadAfter:execFileSync('/usr/bin/uptime',[],{encoding:'utf8'}).trim(),results,pool:p.snapshot()};
writeFileSync('alternate-vmm-check-results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
