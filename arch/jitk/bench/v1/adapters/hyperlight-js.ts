import {build} from 'esbuild';
import {mkdirSync, readFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {failure, localAdapter, provenance, require, sha, timeoutMs} from './common.ts';
import type {Executor} from './types.ts';
const jitk=new URL('../../../',import.meta.url);
let runtime:Promise<any>|undefined;
/** Bundle existing TS glue locally; never build or change the Hyperlight VM. */
async function loadRuntime() {
  return runtime??=(async()=>{
    const entry=fileURLToPath(new URL('./.cache/hyperlight-runtime.mjs',import.meta.url));mkdirSync(dirname(entry),{recursive:true});
    await build({stdin:{contents:`export {MicroVMExecutor} from './executor/executor.ts';export {SandboxPool} from './executor/pool.ts';export {HyperlightBackend} from './bench/hyperlight/backend.ts';export {hyperlightConfig} from './bench/hyperlight/config.ts';export {artifactPath} from './tslib/deps.ts';`,resolveDir:fileURLToPath(jitk),loader:'ts'},outfile:entry,bundle:true,platform:'node',format:'esm',target:'node24',alias:{acorn:require.resolve('acorn')},plugins:[{name:'source-locations',setup(b){
      b.onLoad({filter:/\.(?:ts|mjs|js)$/},async args=>{
        let contents=readFileSync(args.path,'utf8');
        if(args.path.endsWith('/bench/hyperlight/backend.ts'))contents=contents.replace("await import(new URL('../../executor/build/backend.js',import.meta.url).href)","await import('../../executor/backend.ts')");
        if(args.path.endsWith('/executor/policy-adapter.ts'))contents=contents.replace("new URL('../policy/policy.mjs',import.meta.url)",JSON.stringify(new URL('executor/policy/policy.mjs',jitk).href));
        // esbuild normally runs these files from executor/build; preserve their
        // source file locations since this package must write only adapters/.
        contents=contents.replaceAll('import.meta.dirname',JSON.stringify(dirname(args.path))).replaceAll('import.meta.url',JSON.stringify(pathToFileURL(args.path).href));
        return {contents,loader:args.path.endsWith('.ts')?'ts':'js'};
      });
    }}]});
    return import(pathToFileURL(entry).href);
  })();
}
/** The shared process backend reports a guest throw as `name: message` and the
 *  executor wraps that as `Error: name: message`. Other adapters report the
 *  thrown error's message, so return the guest's message for guest errors. */
function guestMessage(v:{error?:string;errorCode?:string}):string {
  const m=v.errorCode==='GUEST_ERROR'||v.errorCode==='LIMIT'?/^Error: [A-Za-z_$][\w$]*: ([\s\S]*)$/.exec(v.error??''):null;
  return m?m[1]!:v.error??'';
}
let selected:Record<string,string>={};
export default localAdapter({
  name:'hyperlight-js',isolation:'microvm',where:'local',
  provenance:()=>({...provenance(['@cloudflare/codemode']),hyperlightHost:'0.18.0',hyperlightJS:'8d208af8ac3ca53f2069c9ef0ca6a45d89e032d7',...selected}),
  async open({concurrency,timeoutMs:timeout}) {
    const budget=timeoutMs(timeout);
    if(process.platform!=='darwin')throw Error('Hyperlight baseline requires macOS HVF; Linux needs separate KVM artifacts');
    const r=await loadRuntime();
    const {worker,snapshot}=r.hyperlightConfig();
    const watchdog=process.env.JITK_WATCHDOG??r.artifactPath('JITK_SHARD_BINARY');
    selected={worker,snapshot,watchdog,'worker.sha256':sha(worker),'snapshot-index.sha256':sha(snapshot+'/index.json'),'watchdog.sha256':sha(watchdog),'executor-source.sha256':sha(new URL('executor/executor.ts',jitk)),'runtime-bundle.sha256':sha(new URL('./.cache/hyperlight-runtime.mjs',import.meta.url))};
    if(Object.values(selected).includes('missing'))throw Error('Hyperlight worker/snapshot/watchdog missing; run make -C arch/jitk deps');
    // Existing backend reads the watchdog environment. Supplying the resolved
    // cache artifact follows executor/run.sh's environment convention.
    process.env.JITK_WATCHDOG??=watchdog;
    const pool=new r.SandboxPool(new r.HyperlightBackend(worker,snapshot,Math.max(5000,budget)),0,concurrency);
    const executor:Executor=new r.MicroVMExecutor(pool,()=> 'allow',budget);
    return {async execute(code,p,options){const v=await executor.execute(code,p,options);return v.error?failure(guestMessage(v),v.logs??[]):{result:v.result,logs:v.logs??[]};},async close(){await pool.close();}};
  }
});
