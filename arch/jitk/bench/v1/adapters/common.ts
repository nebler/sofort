import {createHash} from 'node:crypto';
import {readFileSync, existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import type {Adapter, Providers, ResolvedProvider, Result} from './types.ts';
export const require = createRequire(import.meta.url);
export const timeoutMs = (override?:number) => {
  const n = Number(override ?? process.env.SOFORT_BENCH_TIMEOUT_MS ?? 30_000);
  if (!Number.isSafeInteger(n) || n < 1) throw Error('invalid SOFORT_BENCH_TIMEOUT_MS');
  return n;
};
export const errorMessage = (e: unknown): string =>
  e && typeof e === 'object' && 'message' in e ? String(e.message) : String(e);
export function failure(e: unknown, logs: string[] = []): Result {
  const message = errorMessage(e);
  return {result: undefined, logs: [...logs], error: /timed? ?out|interrupted|aborted/i.test(message) ? 'Execution timed out' : message};
}
export function sha(path: string | URL): string {
  return existsSync(path) ? createHash('sha256').update(readFileSync(path)).digest('hex') : 'missing';
}
export function version(name: string): string {
  try {
    let dir = dirname(fileURLToPath(import.meta.resolve(name)));
    for (;;) {
      try {const p=JSON.parse(readFileSync(join(dir,'package.json'),'utf8')); if(p.name===name)return p.version;} catch {}
      const parent=dirname(dir);if(parent===dir)break;dir=parent;
    }
  } catch {}
  return 'unavailable';
}
export function provenance(packages: string[] = []): Record<string,string> {
  return {node: process.version, platform: `${process.platform}/${process.arch}`,
    'package-lock.sha256': sha(new URL('./package-lock.json',import.meta.url)),
    ...Object.fromEntries(packages.map(p=>[p,version(p)]))};
}
export function providers(input: Providers): ResolvedProvider[] {
  const list = Array.isArray(input) ? input : [{name:'codemode',fns:input}];
  const seen = new Set<string>();
  for(const p of list) {
    if(!/^[A-Za-z_$][\w$]*$/.test(p.name) || ['console','globalThis','tools','__bench','Promise','Object','undefined'].includes(p.name) || seen.has(p.name)) throw Error('invalid/duplicate namespace');
    seen.add(p.name);
  }
  return list;
}
/** Admission only: a new engine context is still created on every execution. */
export function limited(concurrency: number, run: (code:string,p:ResolvedProvider[])=>Promise<Result>, cleanup:()=>Promise<void> = async()=>{}) {
  if(!Number.isSafeInteger(concurrency)||concurrency<1)throw Error('invalid concurrency');
  let closed=false,active=0;
  const waiting: Array<()=>void>=[];
  const pending=new Set<Promise<Result>>();
  const executor = {
    execute(code:string,input:Providers): Promise<Result> {
      const task=(async()=>{
        if(closed)return failure('Executor closed');
        if(active>=concurrency)await new Promise<void>(r=>waiting.push(r));
        else active++;
        if(closed)return failure('Executor closed');
        try{return await run(code,providers(input));}catch(e){return failure(e);}
        finally{const wake=waiting.shift();if(wake)wake();else active--;}
      })();
      pending.add(task);void task.finally(()=>pending.delete(task));return task;
    },
    async close() {closed=true;for(const wake of waiting.splice(0))wake();await Promise.allSettled([...pending]);await cleanup();}
  };
  return executor;
}
/** Use Sofort/codemode's exact binary wire codec on JSON-only bridges. */
const codecURL = new URL('../../../executor/codec.mjs',import.meta.url);
export const codecSource = readFileSync(codecURL,'utf8').replaceAll('export function ','function ');
export const codec = await import(codecURL.href) as {
  stringify(v:unknown):string; parse(s:string):unknown;
};
export const wireValue = (v:unknown):unknown => JSON.parse(codec.stringify(v===undefined?null:v));
export const unwireValue = (v:unknown):unknown => codec.parse(JSON.stringify(v));
export const codecPrelude = `const __benchCodec=(()=>{${codecSource}\ninstallBase64();return {parse,stringify};})();`;
/** Inject namespaces over single-input bindings, retaining variadic argument order. */
export function bridge(p:ResolvedProvider[], reference:(key:string)=>string) {
  const bindings: Record<string,(input:unknown)=>Promise<unknown>>=Object.create(null);
  const declarations=p.map(provider=>{
    const fields=Object.entries(provider.fns).map(([name,fn])=>{
      const key=`bench_tool_${Object.keys(bindings).length}`;
      bindings[key]=async input=>codec.stringify((await fn(...codec.parse(String(input)) as unknown[]))??null);
      return `${JSON.stringify(name)}:async(...args)=>__benchCodec.parse(await ${reference(key)}(__benchCodec.stringify(args)))`;
    });
    return `const ${provider.name}={${fields.join(',')}};${provider.prelude??''}`;
  }).join('\n');
  return {bindings, declarations:`${codecPrelude}\n${declarations}`};
}
/** A local console shim allows runCodeMode (value-only API) to return logs too. */
export function programEnvelope(code:string, declarations=''):string {
  return `${declarations}\nconst __benchLogs=[];
const console=Object.fromEntries(['log','warn','error','info','debug'].map(level=>[level,(...args)=>__benchLogs.push((level==='log'?'':'['+level+'] ')+args.map(String).join(' '))]));
try {const value=await (${code})();return {result:JSON.parse(__benchCodec.stringify(value===undefined?null:value)),logs:__benchLogs};}
catch(e){return {error:String(e?.message??e),logs:__benchLogs};}`;
}
export function unpack(envelope: unknown): Result {
  const e=envelope as {result?:unknown;logs?:string[];error?:string};
  return e.error !== undefined ? failure(e.error,e.logs??[]) : {result:unwireValue(e.result),logs:[...(e.logs??[])]};
}
export function localAdapter(adapter: Adapter): Adapter {
  const original=adapter.provenance;
  let deadlineMs=timeoutMs();
  return {...adapter,async open(opts){deadlineMs=timeoutMs(opts.timeoutMs);return adapter.open(opts);},provenance:()=>({...original(),
    'adapter.sha256':sha(new URL(`./${adapter.name}.ts`,import.meta.url)),
    'common.sha256':sha(new URL('./common.ts',import.meta.url)),
    'normalize.sha256':sha(new URL('./normalize.ts',import.meta.url)),
    'codec.sha256':sha(codecURL),timeoutMs:String(deadlineMs)})};
}
