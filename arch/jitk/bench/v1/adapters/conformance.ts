/** Sequential, short Mac smoke checks. No benchmark latency claims. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {loadavg, release, cpus} from 'node:os';
import {pathToFileURL} from 'node:url';
import {codec, errorMessage, provenance} from './common.ts';
import type {Adapter, Providers, Result} from './types.ts';
export const names=['node-vm','ai-sdk-code-mode','tanstack-isolated-vm','tanstack-quickjs','hyperlight-js','cf-dynamic-worker'];
const cases: Array<{id:string;code:string;expected:Result;legacy?:boolean}>=[
  {id:'plain',code:'async()=>({answer:42,list:[true,null,"hello"]})',expected:{result:{answer:42,list:[true,null,'hello']},logs:[]}},
  {id:'tool',code:'async()=>await api.echo({answer:42})',expected:{result:{answer:42},logs:[]}},
  {id:'parallel',code:'async()=>await Promise.all([api.echo(1),api.echo(2),api.echo(3)])',expected:{result:[1,2,3],logs:[]}},
  {id:'error',code:'async()=>{throw new Error("boom")}',expected:{result:undefined,logs:[],error:'boom'}},
  {id:'logs',code:'async()=>{console.log("hello",42);console.warn("careful");console.error("oops");return 7}',expected:{result:7,logs:['hello 42','[warn] careful','[error] oops']}},
  {id:'100kb',code:'async()=>{const s=await api.large();return [s.length,s.slice(0,4),s.slice(-4)]}',expected:{result:[102400,'xxxx','xxxx'],logs:[]}},
  {id:'binary',code:'async()=>{const b=await api.bytes();if(!(b instanceof Uint8Array)||b[1]!==128)throw Error("binary type lost");return await api.echo(new Uint8Array([b[0],b[1],b[2]]))}',expected:{result:new Uint8Array([0,128,255]),logs:[]}},
  {id:'legacy',code:'return await codemode.echo("legacy")',legacy:true,expected:{result:'legacy',logs:[]}},
  {id:'timeout',code:'async()=>{while(true){}}',expected:{result:undefined,logs:[],error:'Execution timed out'}},
  {id:'recovery',code:'async()=>await api.echo("alive")',expected:{result:'alive',logs:[]}}
];
type Row={id:string;pass:boolean;ms:number;actual:Result;expected:Result;difference?:string;maxParallelTools:number};
async function child(name:string) {
  const adapter=(await import(`./${name}.ts`)).default as Adapter;
  let executor:Awaited<ReturnType<Adapter['open']>>;
  try {executor=await adapter.open({concurrency:1});}
  catch(e){console.log('CONFORMANCE:'+JSON.stringify({name,status:'unavailable',error:errorMessage(e),provenance:adapter.provenance()}));return;}
  const rows:Row[]=[];
  let active=0,maxActive=0;
  const fns={echo:async(...args:unknown[])=>{active++;maxActive=Math.max(active,maxActive);try{await new Promise(r=>setTimeout(r,3));return args[0];}finally{active--; }},large:async()=> 'x'.repeat(102400),bytes:async()=>new Uint8Array([0,128,255])};
  try {
    for(const c of cases) {
      maxActive=0;
      const providers:Providers=c.legacy?fns:[{name:'api',fns}];
      const start=performance.now();const actual=await executor.execute(c.code,providers) as Result;
      let difference:string|undefined;
      try {assert.deepEqual(actual,c.expected);}catch(e){difference=errorMessage(e);}
      rows.push({id:c.id,pass:!difference,ms:performance.now()-start,actual,expected:c.expected,difference,maxParallelTools:maxActive});
      console.error(`${name}/${c.id}: ${difference?'DIFF':'PASS'} (${Math.round(performance.now()-start)} ms)`);
    }
  }finally{await executor.close();}
  console.log('CONFORMANCE:'+codec.stringify({name,status:'ran',provenance:adapter.provenance(),rows}));
}
async function parent() {
  const selected=process.argv.slice(2).filter(x=>!x.startsWith('--'));
  const adapters=selected.length?selected:names;
  const report={date:new Date().toISOString(),host:{...provenance(),release:release(),cpus:cpus().length,load:loadavg()},timeoutMs:500,results:[] as any[]};
  for(const name of adapters) {
    if(!names.includes(name))throw Error('Unknown adapter '+name);
    const result=await new Promise<any>(resolve=>{
      const processChild=spawn(process.execPath,[new URL('./conformance.ts',import.meta.url).pathname,'--child',name],{cwd:new URL('.',import.meta.url),env:{...process.env,SOFORT_BENCH_TIMEOUT_MS:'500'},stdio:['ignore','pipe','pipe'],detached:true});
      let stdout='',stderr='';let killed=false;
      const timer=setTimeout(()=>{killed=true;try{process.kill(-processChild.pid!,'SIGKILL');}catch{}},25000);
      processChild.stdout.on('data',b=>stdout+=b);processChild.stderr.on('data',b=>{stderr+=b;process.stderr.write(b);});
      processChild.on('error',e=>{clearTimeout(timer);resolve({name,status:'failed',error:errorMessage(e)});});
      processChild.on('close',(code,signal)=>{
        clearTimeout(timer);
        const line=stdout.split('\n').find(x=>x.startsWith('CONFORMANCE:'));
        if(line){try{resolve(codec.parse(line.slice('CONFORMANCE:'.length)));return;}catch{}}
        resolve({name,status:killed?'outer-timeout':'failed',exitCode:code,signal,stdout,stderr});
      });
    });
    report.results.push(result);
    writeFileSync(new URL('./CONFORMANCE.json',import.meta.url),codec.stringify(report)+'\n');
  }
  console.log(JSON.stringify(report.results.map(r=>({name:r.name,status:r.status,passed:r.rows?.filter((x:Row)=>x.pass).length,total:r.rows?.length,error:r.error})),null,2));
  // Differences intentionally remain report data. --strict is opt-in for CI.
  if(process.argv.includes('--strict')&&report.results.some(r=>r.status!=='ran'||r.rows.some((x:Row)=>!x.pass)))process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  if(process.argv[2]==='--child')await child(process.argv[3]);else await parent();
}
