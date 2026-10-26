// Recreate source-only workaround variants; never edits ../executor or ../mcp.
import {cpSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {build} from 'esbuild';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
process.chdir(dirname(fileURLToPath(import.meta.url)));
cpSync('.work/adapted','.work/mac-only',{recursive:true});
function edit(path,fn) {writeFileSync(path,fn(readFileSync(path,'utf8')));}
edit('.work/mac-only/executor/executor.ts',s=>s.replace("export {ShardBackend} from './shard-backend.js';",'// Linux shard addon excluded from this Mac-only experiment.'));
const backend=readFileSync('.work/mac-only/executor/backend.ts','utf8');
writeFileSync('.work/mac-only/executor/native-contracts.ts',backend.slice(backend.indexOf('export interface Sandbox'),backend.indexOf('export type ProcessOptions')));
for(const name of ['pool.ts','pool-check.ts'])edit('.work/mac-only/executor/'+name,s=>s.replace("from './backend.js'","from './native-contracts.js'"));
mkdirSync('.work/reduced',{recursive:true});
writeFileSync('.work/reduced/backend-main.ts',"import {ProcessBackend} from '../adapted/executor/backend.ts';\nconsole.log(new ProcessBackend('local-qjs','/bin/cat',[]).kind);\n");
writeFileSync('.work/reduced/select-main.ts',"import {selectBackend} from '../adapted/executor/select-backend.ts';\nconsole.log(selectBackend().selection);\n");
writeFileSync('.work/adapted/executor/local-tests.ts',"// Executable entry, not a library: existing fake/offline tests, unchanged assertions.\nawait import('./pool-check.ts');\nawait import('./resolve-check.ts');\nawait import('./prepared-check.ts');\n");
const options={bundle:true,packages:'external',platform:'node',format:'esm',target:'node24'};
function protocol(variant){return {name:'canonical-protocol',setup(b){b.onResolve({filter:/protocol\/dispatcher\.(js|ts)$/},()=>({path:resolve(`.work/${variant}/protocol/dispatcher.ts`)}));}};}
await build({...options,entryPoints:['.work/mac-only/executor/resolve-check.ts'],outdir:'.work/mac-only/executor/build',plugins:[protocol('mac-only')]});
for(const name of ['backend-main','select-main'])await build({...options,entryPoints:[`.work/reduced/${name}.ts`],outfile:`.work/adapted/executor/build/${name}.js`,plugins:[protocol('adapted')]});
await build({...options,entryPoints:['.work/adapted/executor/local-tests.ts'],outdir:'.work/adapted/executor/build',plugins:[protocol('adapted')]});
// The Node control uses the original server/provider loader with the local bundles.
cpSync('.work/adapted/executor/build','.work/original/executor/build',{recursive:true});
for(const variant of ['adapted','original']) {
  mkdirSync(`.work/${variant}/vmm`,{recursive:true});
  cpSync('../vmm/.READY',`.work/${variant}/vmm/.READY`);
  cpSync('../kernel/.READY',`.work/${variant}/kernel/.READY`);
}
console.log('Prepared Mac-only, reduced backend, fake-suite executable, and Node-control variants.');
