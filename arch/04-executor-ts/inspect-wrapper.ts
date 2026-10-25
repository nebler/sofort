import {readFile,writeFile,mkdir,rm,copyFile} from 'node:fs/promises';
import {join} from 'node:path';
import {runInNewContext} from 'node:vm';
import {spawnSync} from 'node:child_process';
import {cfDir,normalizeCode} from './upstream.js';
// Exercise the ACTUAL class body from the installed package. Only host Workers
// RPC classes are mocked; its generated executor.js source is not edited.
const text=await readFile(join(cfDir,'index.js'),'utf8');
const executorRegion=text.slice(text.indexOf('const CONNECTOR_CONTROL_KEY'),text.indexOf('//#region src/runtime.ts'));
let captured='';
const sandbox:any={normalizeCode,sanitizeToolName:(s:string)=>s,RpcTarget:class{},Promise,console,Symbol,
  stringifyForCodemode:JSON.stringify,parseForCodemode:JSON.parse};
runInNewContext(executorRegion+'\nglobalThis.Captured=DynamicWorkerExecutor;',sandbox);
const loader={load(config:any){captured=config.modules['executor.js'];return {getEntrypoint(){return {evaluate:async()=>({result:0})};}};}};
await new sandbox.Captured({loader,timeout:1000}).execute("const r = await github.listIssues({repo:'x'}); console.log('count',r.length); return r.length",[{name:'github',fns:{listIssues:async()=>[]},prelude:'github.local=()=>99;'}]);
const dir='/tmp/jitk-04/wrapper';await mkdir(dir,{recursive:true});
await writeFile(join(dir,'executor.mjs'),captured);await writeFile(process.cwd()+'/cloudflare-wrapper.generated.mjs',captured);
const qjs='/tmp/jitk-04/quickjs-2026-06-04/qjs';
function run(label:string,command:string,args:string[]){const r=spawnSync(command,args,{cwd:dir,encoding:'utf8',timeout:5000});const v={label,status:r.status,stdout:r.stdout,stderr:r.stderr,error:r.error?.message};console.log(JSON.stringify(v));return v;}
const results:any[]=[];
await rm(join(dir,'cloudflare:workers'),{force:true});
results.push(run('literal wrapper, no shim',qjs,['executor.mjs']));
await writeFile(join(dir,'cloudflare:workers'), 'export class WorkerEntrypoint {}\n');
await writeFile(join(dir,'drive.mjs'), `import * as std from 'std'; import * as os from 'os';\nimport CodeExecutor from './executor.mjs';\nglobalThis.setTimeout=os.setTimeout;globalThis.clearTimeout=os.clearTimeout;\nconst r=await new CodeExecutor().evaluate({github:{call:async(name,args)=>JSON.stringify({result:[{id:1},{id:2}]})}});\nstd.out.puts(JSON.stringify(r)+'\\n');std.out.flush();std.exit(0);\n`);
results.push(run('unmodified wrapper with Workers/timer shims',qjs,['drive.mjs']));
results.push(run('unmodified wrapper + shims in static musl qjs', 'docker',['run','--rm','--platform','linux/arm64','-v','/tmp/jitk-04:/work:ro','-w','/work/wrapper','alpine','/work/qjs-static','drive.mjs']));
await writeFile(join(dir,'capabilities.mjs'),`import * as std from 'std'; std.out.puts(JSON.stringify(Object.fromEntries(['Promise','Proxy','setTimeout','console','btoa','atob','fetch','TextEncoder'].map(n=>[n,typeof globalThis[n]])))+'\\n');`);
results.push(run('native qjs globals',qjs,['capabilities.mjs']));
await new sandbox.Captured({loader,timeout:1000}).execute("const bytes=await github.echo(new Uint8Array([0,127,255]));return Array.from(bytes)",[{name:'github',fns:{echo:async()=>[]}}]);
await writeFile(join(dir,'binary.mjs'),captured);
await copyFile(new URL('./codec.mjs',import.meta.url),join(dir,'codec.mjs'));
const binaryDrive=`import * as std from 'std';import * as os from 'os';import C from './binary.mjs';globalThis.setTimeout=os.setTimeout;
const r=await new C().evaluate({github:{call:async(name,args)=>JSON.stringify({result:JSON.parse(args)[0]})}});std.out.puts(JSON.stringify(r)+'\\n');std.out.flush();std.exit(0);`;
await writeFile(join(dir,'binary-no-codec.mjs'),binaryDrive);
results.push(run('binary wrapper without base64 globals',qjs,['binary-no-codec.mjs']));
await writeFile(join(dir,'binary-with-codec.mjs'),"import {installBase64} from './codec.mjs';installBase64();\n"+binaryDrive);
results.push(run('binary wrapper with codec shims',qjs,['binary-with-codec.mjs']));
results.push(run('static musl binary wrapper with codec shims','docker',['run','--rm','--platform','linux/arm64','-v','/tmp/jitk-04:/work:ro','-w','/work/wrapper','alpine','/work/qjs-static','binary-with-codec.mjs']));
await writeFile(process.cwd()+'/wrapper-results.json',JSON.stringify(results,null,2)+'\n');
