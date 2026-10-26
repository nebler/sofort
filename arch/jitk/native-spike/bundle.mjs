import {build} from 'esbuild';
import {mkdirSync, readdirSync, cpSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';
process.chdir(dirname(fileURLToPath(import.meta.url)));
const base = resolve('.work/adapted');
const executor = base+'/executor';
mkdirSync(executor+'/build',{recursive:true});
const entries = readdirSync(executor).filter(n=>n.endsWith('.ts') && !n.endsWith('.d.ts') && !['type-proof.ts','hyperlight-check.ts','breakdown.ts'].includes(n));
await build({entryPoints:entries.map(n=>executor+'/'+n),outdir:executor+'/build',bundle:true,packages:'external',platform:'node',format:'esm',target:'node24',
  plugins:[{name:'canonical-protocol-source',setup(b){b.onResolve({filter:/protocol\/dispatcher\.(js|ts)$/},()=>({path:base+'/protocol/dispatcher.ts'}));}}]});
for (const name of ['codec.mjs','prepared-helpers.mjs','shard-helpers.js']) cpSync(executor+'/'+name,executor+'/build/'+name);
cpSync(base+'/kernel/ring-bootstrap.js',executor+'/build/ring-bootstrap.js');
console.log(`Bundled ${entries.length} executor entries without changing executable logic; packages external.`);
