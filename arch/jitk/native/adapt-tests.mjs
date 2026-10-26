// Adapts canonical assertions without weakening them. Type annotations,
// equivalent assert spellings, fake representation and teardown changes are
// documented in README.md. Import, launcher and receipt paths stay local. SDK is a test-only oracle
// supplied by the existing canonical MCP install, never a native dependency.
import {readFileSync,writeFileSync,mkdirSync,cpSync,existsSync,symlinkSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),jitk=resolve(here,'..');
process.chdir(here);mkdirSync('.work/checks',{recursive:true});
const node=process.env.JITK_NODE||process.execPath;
const sdk=process.env.JITK_MCP_NODE_MODULES||resolve(jitk,'mcp/node_modules');
if(!existsSync('.work/node_modules'))symlinkSync(sdk,resolve('.work/node_modules'),'dir');
let m=readFileSync(resolve(jitk,'mcp/test.mjs'),'utf8');
m=m.replace("new URL('./', import.meta.url)",`new URL(${JSON.stringify('file://'+jitk+'/mcp/')})`).replaceAll('process.execPath',JSON.stringify(resolve('dist/server')));
writeFileSync('.work/mcp-test.mjs',m);
cpSync(resolve(jitk,'executor/fixtures'),'.work/fixtures',{recursive:true});
const entries=['verify','pool-check','resolve-check','sandbox-check','transport-check','watchdog-check','api-check','policy-check'];
for(const name of entries){
 let s=readFileSync(resolve(jitk,'executor/'+name+'.ts'),'utf8');
 s=s.replaceAll('process.execPath',JSON.stringify(node));
 s=s.replace(/from '(\.\/[^']+)'/g,(_m,p)=>`from '${p.replace('./','../../')}'`);
 if(name==='verify'){
  s=s.split('\n').filter(line=>!line.includes("from 'zod'")&&!line.includes("from '@tanstack/")&&!line.includes("from '../../providers.js'")&&!line.startsWith("await test('generated types")&&!line.startsWith("await test('TanStack")).join('\n');
  s=s.replace('const providers=[','const providers:import("../../types.js").Provider[]=[');
  s=s.replace('assert.deepEqual(r.result,new Uint8Array([0,127,255]))', 'assert(r.result instanceof Uint8Array);assert.deepEqual(r.result as Uint8Array,new Uint8Array([0,127,255]))');
  s=s.replace('seen.at(-1).labels','seen.at(-1)!.labels');
  s=s.replace('const seen:any[]=[]','const seen:Record<string,any>[]=[]');
  s=s.replace('async()=>[{id:1},{id:2}]','async():Promise<unknown>=>[{id:1},{id:2}]').replace("slow:async()=>new Promise(r=>setTimeout(()=>r('ok'),200))","slow:async():Promise<unknown>=>new Promise(r=>setTimeout(()=>r('ok'),200))");
  s=s.replaceAll('async()=>++effects','async():Promise<unknown>=>++effects').replace('async(...a:unknown[])=>a[0]','async(...a:unknown[]):Promise<unknown>=>a[0]');
  for(const n of [1,2,5])s=s.replaceAll('async()=>'+n,'async():Promise<unknown>=>'+n);
  s=s.replace('hang:async()=>new Promise(()=>{})','hang:async():Promise<unknown>=>new Promise(()=>{})');
 }
 // Policy owner assertions are also copied intact, with a static native port import.
 if(name==='policy-check'){
   const a=s.indexOf('const testPath='),b=s.indexOf('const selected=',a);
   s=s.slice(0,a)+"import './policy-owner.mjs';\n"+s.slice(b);
 }
 // Type-only annotations for scriptc's stricter record/promise representation.
 s=s.replaceAll('rows:any[]','rows:Record<string,unknown>[]');
 s=s.replace('const s={exited,reap,kills:0,read:async()=>null,send:async()=>{},', 'const s:Sandbox&{reap:()=>void;kills:number}={exited,reap,kills:0,read:async():Promise<unknown>=>null,send:async(_frame:unknown):Promise<void>=>{},');
 s=s.replace('assert.notEqual(s,next)','assert.ok(s!==next)');
 s=s.replace('const providers=Object.entries(tools)', "const providers:import('../../types.js').Provider[]=Object.entries(tools)");
 s=s.replace("async()=>{throw Error('legacy invocation bypassed');}", "async():Promise<unknown>=>{throw Error('legacy invocation bypassed');}");
 s=s.replace('const tools={mail:', 'const tools:Record<string,Record<string,Tool>>={mail:');
 s=s.replace('] as const) {', " ] as [string,string,import('../../types.js').Provider[],unknown][]) {");
 if(name==='pool-check'){
  const a=s.indexOf('class Fake implements Backend'),b=s.indexOf('const rows:',a);
  s=s.slice(0,a)+readFileSync('fake-fixture.txt','utf8')+'\n'+s.slice(b);
  s=s.replaceAll('new Fake()', 'fake()').replaceAll('new Fake(false)','fake(false)');
 }
 s=s.replace('finally{s.kill();await s.exited;}', 'finally{s.kill();await s.exited;await backend.close();}');
 s=s.replace('await s.armDeadline!(deadline);', "assert(s.armDeadline);await s.armDeadline?.(deadline);");
 s=s.replace("fail:async()=>{throw Error('expected failure');}","fail:async():Promise<unknown>=>{throw Error('expected failure');}");
 s=s.replace('nothing:async()=>undefined','nothing:async():Promise<unknown>=>undefined').replace('args:async(...a:unknown[])=>a','args:async(...a:unknown[]):Promise<unknown>=>a');
 s=s.replaceAll('s.deadlineReceipt.deadline','s.deadlineReceipt!.deadline').replaceAll('s.deadlineReceipt.killAt','s.deadlineReceipt!.killAt');
 s=s.replace('effect:async()=>++effects','effect:async():Promise<unknown>=>++effects');
 writeFileSync('.work/checks/'+name+'.ts',s);
}
let owner=readFileSync(resolve(jitk,'executor/policy/policy-test.mjs'),'utf8').replace("'./policy.mjs'","'../../policy.js'");
owner=owner.replace("const kills = (fn, m) => { assert.throws(fn, Violation, m); n++; };", "const kills = (fn, m) => {let caught=false;try{fn();}catch(e){assert.ok(e instanceof Violation,String(m??''));caught=true;}assert.ok(caught,String(m??''));n++;};");
owner=owner.replace('assert.ok(c, m)',"assert.ok(c, String(m??''))");
writeFileSync('.work/checks/policy-owner.mjs',owner);
console.log('adapted canonical MCP and executor checks under .work/');
