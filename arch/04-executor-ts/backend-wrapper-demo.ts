import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {MicroVMExecutor,LocalProcessQjsBackend,SandboxPool} from './executor.js';
// Run inspect-wrapper first: it captures the installed DynamicWorkerExecutor's
// literal module and creates only a separate cloudflare:workers shim file.
const pool=new SandboxPool(new LocalProcessQjsBackend('/tmp/jitk-04/quickjs-2026-06-04/qjs',128,'/tmp/jitk-04/wrapper'),1,2);
const ex=new MicroVMExecutor(pool,()=> 'allow');await pool.warm();
try {
  const result=await ex.execute(`
    const C=(await import('/tmp/jitk-04/wrapper/executor.mjs')).default;
    return await new C().evaluate({github:{call:async(name,args)=>
      JSON.stringify({result:await github[name](...JSON.parse(args))})}});
  `,[{name:'github',fns:{listIssues:async(...args:unknown[])=>{assert.deepEqual(args,[{repo:'x'}]);return [{id:1},{id:2}];}}}]);
  assert.deepEqual(result,{result:{result:2,logs:['count 2']},logs:[]});
  console.log(JSON.stringify(result));
  await writeFile(process.cwd()+'/backend-wrapper-result.json',JSON.stringify(result,null,2)+'\n');
}finally{await pool.close();}
