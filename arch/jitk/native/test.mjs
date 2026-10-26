// Native test runner; Node and the SDK are test drivers only.
import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
process.chdir(dirname(fileURLToPath(import.meta.url)));
const node=process.env.JITK_NODE||process.execPath;
mkdirSync('.work',{recursive:true});
function run(args,timeout=180000){
 const r=spawnSync(node,args,{env:process.env,encoding:'utf8',timeout,maxBuffer:8*1024*1024});
 process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');
 return {status:r.status,signal:r.signal,error:r.error?.message};
}
let failed=false;const results=[];
let r=run(['adapt-tests.mjs']);if(r.status!==0)process.exit(1);
for(const name of ['server','pool-check','resolve-check','sandbox-check','transport-check','watchdog-check','api-check','policy-check','verify']){
 const entry=name==='server'?'server.ts':'.work/checks/'+name+'.ts';
 const build=run(['build.mjs',entry]);
 const test=build.status!==0?null:run(['run.mjs',name,...(name==='server'?[node,'.work/mcp-test.mjs']:['./dist/'+name])],100000);
 const ok=build.status===0&&test?.status===0;failed ||= !ok;results.push({name,scope:name==='verify'?'16 backend-independent cases; 4 SDK cases unimplemented':'canonical',ok,build,test});
}
const wire=run(['run.mjs','wire',node,'wire-test.mjs'],100000);failed ||= wire.status!==0;results.push({name:'wire',ok:wire.status===0,test:wire});
results.push({name:'prepared-check',status:'not applicable',reason:'Linux shard snapshot identity, prepared helpers and ring source; no Mac HVF path'});
writeFileSync('.work/test-matrix.json',JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results,null,2));process.exit(failed?1:0);
