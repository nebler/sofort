import type {Provider} from './types.js';
// Acorn was used only to accept alternate source forms, never to enforce policy.
// MCP documents an async function body. Whole arrow functions are recognized
// conservatively; arbitrary statements/expressions are parsed only by guest QuickJS.
export function normalizeCode(code:string):string {
  let s=code.trim();const fence=s.match(/^```(?:js|javascript|typescript|ts|tsx|jsx)?\s*\n([\s\S]*?)```\s*$/);
  if(fence)s=fence[1].trim();
  if(/^(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/.test(s))return s;
  return 'async () => {\n'+s+'\n}';
}
const reserved=('abstract arguments await boolean break byte case catch char class const continue debugger default delete do double else enum eval export extends false final finally float for function goto if implements import in instanceof int interface let long native new null package private protected public return short static super switch synchronized this throw throws transient true try typeof undefined var void volatile while with yield').split(' ');
export function sanitizeToolName(name:string):string {
  let s=name.replace(/[-.\s]/g,'_').replace(/[^a-zA-Z0-9_$]/g,'');if(!s)return '_';
  if(/^[0-9]/.test(s))s='_'+s;if(reserved.includes(s))s+='_';return s;
}
// Build embeds this ordinary guest source as a string; it is never host-evaluated.
import {guestCodec} from './guest-source.js';
export function executionBody(code:string,providers:Provider[],prepared=false):string {
  if(prepared)throw Error('Linux prepared shard backend is out of scope');
  const decl:string[]=[];const names:string[]=[];const preludes:string[]=[];
  for(const p of providers){
    names.push(p.name);preludes.push(p.prelude??'');
    const key=JSON.stringify(p.name),allowed=JSON.stringify(Object.keys(p.fns));
    decl.push(`const ${p.name}=new Proxy(Object.create(null),{get:(t,k)=>Object.hasOwn(t,k)?t[k]:k!=='then'&&${allowed}.includes(k)?async(...a)=>parse(JSON.stringify(await __wire[${key}][k](...JSON.parse(stringify(a))))):undefined});`);
  }
  return `return await (async (__wire)=>{\n${guestCodec}\ninstallBase64();\n${decl.join('\n')}\n${preludes.join('\n')}\nconst result=await (${normalizeCode(code)})();\nreturn JSON.parse(stringify(result===undefined?null:result));\n})({${names.join(',')}});`;
}
