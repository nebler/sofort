// Research harness runs on Node; the applications under test compile with scriptc.
import {mkdirSync, readdirSync, readFileSync, writeFileSync, cpSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root = dirname(fileURLToPath(import.meta.url));
process.chdir(root);
const hashes = {};
function copySources(from, to) {
  mkdirSync(to, {recursive:true});
  for (const ent of readdirSync(from, {withFileTypes:true})) {
    if (ent.isDirectory() && ['vendor','fixtures','policy','providers','resources'].includes(ent.name)) copySources(`${from}/${ent.name}`,`${to}/${ent.name}`);
    else if (ent.isFile() && /\.(ts|mjs|js)$/.test(ent.name) || ent.isFile() && /^(LICENSE|jitk-mcp.json)/.test(ent.name)) {
      cpSync(`${from}/${ent.name}`,`${to}/${ent.name}`);
      hashes[resolve(from,ent.name)] = createHash('sha256').update(readFileSync(`${from}/${ent.name}`)).digest('hex');
    }
  }
}
for (const name of ['executor','mcp','protocol']) copySources(`../${name}`,`.work/original/${name}`);
mkdirSync('.work/original/kernel',{recursive:true});
cpSync('../kernel/ring-bootstrap.js','.work/original/kernel/ring-bootstrap.js');
for (const variant of ['original','adapted']) {
  if (variant==='adapted') cpSync('.work/original','.work/adapted',{recursive:true});
  const path = `.work/${variant}/executor/executor.ts`;
  // Explicitly exclude comparison backend requiring the Hyperlight N-API addon.
  writeFileSync(path,readFileSync(path,'utf8').replace("export {HyperlightBackend} from '../bench/hyperlight/backend.js';",'// Hyperlight native-addon backend explicitly excluded from native spike.'));
}
function edit(path, transform) { writeFileSync(path,transform(readFileSync(path,'utf8'))); }
edit('.work/adapted/executor/policy-adapter.ts',s=>s.replace('await import(policySource)',"await import('./policy/policy.mjs')"));
edit('.work/adapted/mcp/jitk.mjs',s=>s
  .replace("import(pathToFileURL(resolve(base, p)).href)","import('./providers/demo.mjs')")
  .replace("import(new URL('executor.js', build).href)","import('../executor/executor.ts')")
  .replace("import(new URL('select-backend.js', build).href)","import('../executor/select-backend.ts')"));
// Fixed provider import is a compile experiment, not an arbitrary-plugin implementation.
writeFileSync('.work/source-hashes.json',JSON.stringify(hashes,null,2)+'\n');
console.log(`Prepared ${Object.keys(hashes).length} source copies; only .work/ was written.`);
