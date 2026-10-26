import {receiptPath} from './receipt-path.js';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {execFileSync} from 'node:child_process';
import {MicroVMExecutor,SandboxPool} from './executor.js';
import {normalizeCode,sanitizeToolName} from './upstream.js';
import {selectBackend} from './select-backend.js';
// Public entrypoint resolution only; capture installed wrapper for a compatibility
// fixture. Runtime execution/type generation never import hashed private chunks.
const require=createRequire(import.meta.url);
const text=readFileSync(require.resolve('@cloudflare/codemode'),'utf8');
const region=text.slice(text.indexOf('const CONNECTOR_CONTROL_KEY'),text.indexOf('//#region src/runtime.ts'));
const selected=selectBackend(),pool=new SandboxPool(selected.backend,0,4),ex=new MicroVMExecutor(pool,()=> 'allow');
const results:any[]=[];
const loadBefore=execFileSync('/usr/bin/uptime',[],{encoding:'utf8'}).trim();
try {
  for(const [name,code,expected] of [
    ['github',"const r=await github.listIssues({repo:'x'});console.log('count',r.length);return r.length",{result:2,logs:['count 2']}],
    ['binary',"const r=await github.echo(new Uint8Array([0,127,255]));return Array.from(r)",{result:[0,127,255],logs:[]}]
  ] as const) {
    let source='';
    const context:any={normalizeCode,sanitizeToolName,RpcTarget:class{},Promise,console,Symbol,stringifyForCodemode:JSON.stringify,parseForCodemode:JSON.parse};
    runInNewContext(region+'\nglobalThis.Captured=DynamicWorkerExecutor;',context);
    const loader={load(config:any){source=config.modules['executor.js'];return {getEntrypoint(){return {evaluate:async()=>({result:0})};}};}};
    await new context.Captured({loader,timeout:1000}).execute(code,[{name:'github',fns:{listIssues:async()=>[],echo:async()=>null}}]);
    writeFileSync(receiptPath(`cloudflare-${name}.generated.mjs`),source);
    // Module linkage only: substitute Workers import with a lexical class shim
    // and export-default with return. The emitted class/method body is unchanged.
    // Guest has no virtual filesystem/module loader. Give the wrapper its own
    // console object, as it overwrites console methods to capture its own logs.
    const linked=source.replace(/^import \{ WorkerEntrypoint \} from "cloudflare:workers";\s*/, 'class WorkerEntrypoint {}\n').replace('export default class','return class');
    const body=`const C=(()=>{const console={...globalThis.console};\n${linked}\n})();return await new C().evaluate({github:{call:async(name,args)=>stringify({result:await github[name](...parse(args))})}});`;
    const result=await ex.execute(body,[{name:'github',fns:{listIssues:async(...args:unknown[])=>{assert.deepEqual(args,[{repo:'x'}]);return [{id:1},{id:2}];},echo:async(x)=>x}}]);
    assert.deepEqual(result,{result:expected,logs:[]});results.push({name,result,linkageOnly:true});
    console.log('PASS Cloudflare wrapper '+name);
  }
}finally{await pool.close();}
writeFileSync(receiptPath('wrapper-conformance-results.json'),JSON.stringify({selection:selected.selection,loadBefore,loadAfter:execFileSync('/usr/bin/uptime',[],{encoding:'utf8'}).trim(),results},null,2)+'\n');
