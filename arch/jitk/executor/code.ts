import {readFileSync} from 'node:fs';
import type {ResolvedProvider} from '@cloudflare/codemode';
import {normalizeCode} from './upstream.js';
import type {Job} from './engine.js';
import {LIMIT} from '../protocol/dispatcher.js';
// Embed the optional codemode binary adapter as ordinary user code. Protocol v1
// remains JSON-only; no private imports, prelude fields or transport extensions.
const codec=readFileSync(new URL('./codec.mjs',import.meta.url),'utf8').replaceAll('export function ','function ');
/** The engine-neutral job for tenant code and its resolved providers. */
export function jsJob(source:string,providers:ResolvedProvider[]):Job {
  return {kind:'js',source,tools:Object.fromEntries(providers.map(p=>[p.name,Object.keys(p.fns)])),prelude:providers.map(p=>p.prelude??'').join('\n')};
}
/** The guest function body for a job, within LIMIT.code. `prepared` binds to
 * helpers already compiled in a restored shard snapshot instead of the codec. */
export function executionBody(job:Job,prepared=false):string {
  const body=prepared?preparedBody(job):embeddedBody(job);
  if(body.length>LIMIT.code)throw Error('code limit including trusted adapters');
  return body;
}
function preparedBody(job:Job):string {
  const names=Object.keys(job.tools),descriptors=Object.entries(job.tools);
  return `return await globalThis.__jitkPrepared.codec(${JSON.stringify(descriptors)},async(${names.join(",")})=>{\n${job.prelude}\nreturn await (${normalizeCode(job.source)})();\n},{${names.join(",")}});`;
}
function embeddedBody(job:Job):string {
  const names=Object.keys(job.tools);
  const declarations=Object.entries(job.tools).map(([name,fns])=>{
    const key=JSON.stringify(name),allowed=JSON.stringify(fns);
    return `const ${name}=new Proxy(Object.create(null),{get:(t,k)=>Object.hasOwn(t,k)?t[k]:k!=='then'&&${allowed}.includes(k)?async(...a)=>parse(JSON.stringify(await __wire[${key}][k](...JSON.parse(stringify(a))))):undefined});`;
  }).join('\n');
  return `return await (async (__wire)=>{\n${codec}\ninstallBase64();\n${declarations}\n${job.prelude}\nconst result=await (${normalizeCode(job.source)})();\nreturn JSON.parse(stringify(result===undefined?null:result));\n})({${names.join(',')}});`;
}
