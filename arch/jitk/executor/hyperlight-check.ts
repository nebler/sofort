import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {MicroVMExecutor,SandboxPool,HyperlightBackend,type Backend} from './executor.js';
const d=JSON.parse(readFileSync(new URL('../../bench/hyperlight/adapter.json',import.meta.url),'utf8'));
const base=fileURLToPath(new URL('../../bench/hyperlight/',import.meta.url));
const worker=resolve(base,process.env.HYPERLIGHT_WORKER??d.strict_argv[0]);
const snapshot=resolve(base,process.env.HYPERLIGHT_SNAPSHOT??d.strict_argv[2]);
const artifacts=Object.fromEntries([worker,resolve(snapshot,'index.json')].map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')]));
const b:Backend=new HyperlightBackend(worker,snapshot,5000);
assert.equal(b.kind,'hyperlight-js');
const p=new SandboxPool(b,0,8),ex=new MicroVMExecutor(p,call=>call.fn==='deny'?'deny':'allow'),rows:any[]=[];
const loadBefore=execFileSync('/usr/bin/uptime',[],{encoding:'utf8'}).trim();
const providers=[{name:'api',fns:{echo:async(x:unknown)=>x,deny:async()=>{throw Error('must not invoke');}}}];
try{
 for(const [name,code,value] of [['result','return 2',2],['tool','return await api.echo(3)',3],['unicode','return await api.echo("🌍")','🌍'],['Promise.all','return await Promise.all([api.echo(1),api.echo(2)])',[1,2]],['fresh state','return typeof globalThis.leak','undefined']] as const){
  await p.drain();const r=await ex.execute(code,providers);assert(!r.error,JSON.stringify(r));assert.deepEqual(r.result,value);rows.push({name,ok:true});
 }
 await p.drain();const r=await ex.execute('return await api.deny()',providers);assert.match(r.error!,/policy denied/);rows.push({name:'deny',ok:true});
}finally{await p.close();}
writeFileSync('hyperlight-check-results.json',JSON.stringify({artifacts,loadBefore,loadAfter:execFileSync('/usr/bin/uptime',[],{encoding:'utf8'}).trim(),rows},null,2)+'\n');console.log('6/6 Hyperlight through canonical executor; kind hyperlight-js');
