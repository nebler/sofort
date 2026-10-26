import {build} from 'esbuild';
import {readdirSync,copyFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const entries=readdirSync('.').filter(n=>n.endsWith('.ts')&&!n.endsWith('.d.ts')&&n!=='type-proof.ts');
const options={outdir:'build',bundle:true,platform:'node',format:'esm',target:'node24',packages:'external',sourcemap:true,metafile:true,
 plugins:[{name:'canonical-protocol-source',setup(b){
  b.onResolve({filter:/protocol\/dispatcher\.(js|ts)$/},()=>({path:fileURLToPath(new URL('../protocol/dispatcher.ts',import.meta.url))}));
 }}]};
const result=await build({...options,entryPoints:entries,outbase:'.'});
writeFileSync('build/inputs.json',JSON.stringify(result.metafile.inputs,null,2)+'\n');
await build({...options,entryPoints:{demo:'examples/demo.ts'}});
copyFileSync('codec.mjs','build/codec.mjs');


for(const name of ['prepared-helpers.mjs','shard-helpers.js'])copyFileSync(name,'build/'+name);
