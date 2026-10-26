// Reproduce the spike's Node control in ignored scratch, with unchanged product
// source except removal of the unused Hyperlight addon export. No npm install.
import {mkdirSync,readdirSync,readFileSync,writeFileSync,cpSync,symlinkSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const here=dirname(fileURLToPath(import.meta.url)),jitk=resolve(here,'..');process.chdir(here);
const modules=process.env.JITK_EXECUTOR_NODE_MODULES||resolve(jitk,'executor/node_modules');
const mcpModules=process.env.JITK_MCP_NODE_MODULES||resolve(jitk,'mcp/node_modules');
const {build}=await import(pathToFileURL(resolve(modules,'esbuild/lib/main.js')).href);
const hashes={};
function copy(from,to){
 mkdirSync(to,{recursive:true});
 for(const e of readdirSync(from,{withFileTypes:true})){
  if(e.isDirectory()&&['vendor','fixtures','policy','providers','resources'].includes(e.name))copy(resolve(from,e.name),resolve(to,e.name));
  else if(e.isFile()&&(/\.(ts|mjs|js)$/.test(e.name)||/^(LICENSE|jitk-mcp.json|\.READY)/.test(e.name))){
   cpSync(resolve(from,e.name),resolve(to,e.name));hashes[resolve(from,e.name)]=createHash('sha256').update(readFileSync(resolve(from,e.name))).digest('hex');
  }
 }
}
for(const name of ['executor','mcp','protocol','kernel'])copy(resolve(jitk,name),resolve('.work/node',name));
for(const [name,path] of [['executor',modules],['mcp',mcpModules]])if(!existsSync('.work/node/'+name+'/node_modules'))symlinkSync(path,resolve('.work/node/'+name+'/node_modules'),'dir');
const source='.work/node/executor/executor.ts';
writeFileSync(source,readFileSync(source,'utf8').replace("export {HyperlightBackend} from '../bench/hyperlight/backend.js';",'// Unused Hyperlight export excluded, same Node control as native-spike.'));
await build({entryPoints:['.work/node/executor/executor.ts','.work/node/executor/select-backend.ts'],outdir:'.work/node/executor/build',bundle:true,platform:'node',format:'esm',target:'node24',packages:'external',
 plugins:[{name:'protocol',setup(b){b.onResolve({filter:/protocol\/dispatcher\.(js|ts)$/},()=>({path:resolve('.work/node/protocol/dispatcher.ts')}));}}]});
for(const f of ['codec.mjs','prepared-helpers.mjs','shard-helpers.js'])cpSync('.work/node/executor/'+f,'.work/node/executor/build/'+f);
cpSync('.work/node/kernel/ring-bootstrap.js','.work/node/executor/build/ring-bootstrap.js');
writeFileSync('.work/node-source-hashes.json',JSON.stringify(hashes,null,2)+'\n');console.log('Node control prepared in .work/node/');
