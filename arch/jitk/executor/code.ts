import {readFileSync} from 'node:fs';
import type {ResolvedProvider} from '@cloudflare/codemode';
import {normalizeCode} from './upstream.js';
// Embed the optional codemode binary adapter as ordinary user code. Protocol v1
// remains JSON-only; no private imports, prelude fields or transport extensions.
const codec=readFileSync(new URL('./codec.mjs',import.meta.url),'utf8').replaceAll('export function ','function ');
export function executionBody(code:string,providers:ResolvedProvider[],prepared=false):string {
  if(prepared){
    const names=providers.map(p=>p.name);
    const descriptors=providers.map(p=>[p.name,Object.keys(p.fns)]);
    return `return await globalThis.__jitkPrepared.codec(${JSON.stringify(descriptors)},async(${names.join(",")})=>{\n${providers.map(p=>p.prelude??"").join("\n")}\nreturn await (${normalizeCode(code)})();\n},{${names.join(",")}});`;
  }
  const declarations=providers.map(p=>{
    const key=JSON.stringify(p.name),allowed=JSON.stringify(Object.keys(p.fns));
    return `const ${p.name}=new Proxy(Object.create(null),{get:(t,k)=>Object.hasOwn(t,k)?t[k]:k!=='then'&&${allowed}.includes(k)?async(...a)=>parse(JSON.stringify(await __wire[${key}][k](...JSON.parse(stringify(a))))):undefined});`;
  }).join('\n');
  return `return await (async (__wire)=>{\n${codec}\ninstallBase64();\n${declarations}\n${providers.map(p=>p.prelude??'').join('\n')}\nconst result=await (${normalizeCode(code)})();\nreturn JSON.parse(stringify(result===undefined?null:result));\n})({${providers.map(p=>p.name).join(',')}});`;
}
