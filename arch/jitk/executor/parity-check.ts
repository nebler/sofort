// Backend-parity corpus runner (R10 #7, R9 N6, CUTOVER-PLAN §2.5): runs every
// case in parity/cases.ts on each available Engine through the canonical
// MicroVMExecutor, normalizes (result, logs, error class, effects) and checks
// each backend against the case's expectation, or the documented difference in
// parity/allowlist.ts. An undocumented difference, or an allowlist entry that
// no longer differs, fails. See parity/README.md.
//
//   node build/parity-check.js [run]           this host's backends; writes .work/parity/<host>.json
//   node build/parity-check.js compare A.json B.json...   cross-host: evaluate merged reports
// JITK_PARITY_BACKENDS=jitk,hyperlight-js,shard selects backends (default:
// jitk + hyperlight-js on macOS, jitk + shard on Linux; a selected backend
// that cannot start fails the run). JITK_PARITY_CASES=<regex> filters case ids.
// JITK_PARITY_OUT overrides the report path.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {MicroVMExecutor,SandboxPool,type Backend} from './executor.js';
import {ShardBackend} from './shard-backend.js';
import {selectBackend} from './select-backend.js';
// Hyperlight is a research comparison backend (bench/), not part of the product API.
import {HyperlightBackend} from '../bench/hyperlight/backend.ts';
import {classify} from '../mcp/jitk.mjs';
import demo from '../mcp/providers/demo.mjs';
import {CASES,type Case,type Expect} from './parity/cases.js';
import {ALLOWLIST,type Difference} from './parity/allowlist.js';

type Kind=Backend['kind'];
/** One normalized run: what the diff compares. `message` is reported, not diffed. */
export type Outcome={class:string;result?:unknown;logs?:unknown;effects?:number;message?:string};
type Report={corpus:string;host:{platform:string;arch:string};started:string;backends:Record<string,{kind:Kind;ms:number;cases:Record<string,Outcome>}>};

const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
/** Canonical JSON-able form: bytes as hex, sorted keys, long strings and big values hashed. */
function canon(v:unknown):unknown {
  if(v instanceof Uint8Array)return {$bytes:Buffer.from(v).toString('hex')};
  if(typeof v==='string')return v.length>256?{$string:v.length,sha256:sha(v)}:v;
  if(v===undefined)return {$undefined:true};
  if(Array.isArray(v))return v.map(canon);
  if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canon((v as any)[k])]));
  return v;
}
function bounded(v:unknown):unknown {
  const c=canon(v),s=JSON.stringify(c);
  return s.length>1024?{$json:s.length,sha256:sha(s)}:c;
}
const normalLogs=(logs:string[])=>bounded(logs);
const key=(o:Outcome)=>JSON.stringify({class:o.class,result:o.result,logs:o.logs,effects:o.effects});
function expected(e:Expect):Outcome {
  if('counts' in e)return {class:'BURST',result:bounded(e.counts)};
  if('ok' in e)return {class:'OK',result:bounded(e.ok),logs:e.logs&&normalLogs(e.logs),effects:e.effects};
  return {class:e.error,logs:e.logs&&normalLogs(e.logs),effects:e.effects};
}
/** Does an observed outcome satisfy an expectation? Logs/effects only when stated. */
function satisfies(o:Outcome,e:Expect):boolean {
  const w=expected(e);
  if(o.class!==w.class||JSON.stringify(o.result)!==JSON.stringify(w.result))return false;
  if(w.logs!==undefined&&JSON.stringify(o.logs)!==JSON.stringify(w.logs))return false;
  if(w.effects!==undefined&&o.effects!==w.effects)return false;
  if('error' in e&&e.match&&!new RegExp(e.match).test(o.message??''))return false;
  return true;
}

// The fixture tools every `exec` case may name. A fresh set per backend, so
// effect counters never mix.
function fixtures() {
  const counter={effects:0};
  const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
  const fns:Record<string,(...a:any[])=>Promise<unknown>>={
    listIssues:async()=>[{id:1},{id:2}],
    echo:async(x:unknown)=>x,
    add1:async(x:unknown)=>Number(x)+1,
    big:async(n:number)=>'x'.repeat(n),
    fail:async()=>{throw Error('provider failure');},
    delay:async(ms:number,v:unknown)=>{await sleep(ms);return v;},
    hang:()=>new Promise(()=>{}),
    write:async()=>{counter.effects++;return 'written';},
    blocked:async()=>{counter.effects++;return 'blocked';},
    'list-issues':async()=>5,'a-b':async()=>1,a_b:async()=>2,
  };
  return {counter,fns};
}
const policy=(call:{fn:string})=>call.fn==='write'?'requireApproval' as const:call.fn==='blocked'?'deny' as const:'allow' as const;
// The MCP core's shape (mcp/jitk.mjs createJitk): policy-declared tools; the
// guest stubs carry names only.
const unreachable=async()=>{throw Error('declared Tool.invoke is used');};
const mcpProviders=Object.entries(demo).map(([name,fns])=>({name,fns:Object.fromEntries(Object.keys(fns as object).map(fn=>[fn,unreachable]))}));

/** The pool owns no backend: closing a case pool must not stop a shared shard. */
const borrowed=(b:Backend):Backend=>({kind:b.kind,memoryLimitMB:b.memoryLimitMB,park:(s,d)=>b.park(s,d)});

async function runBackend(kind:Kind,engine:Backend,cases:Case[]):Promise<Record<string,Outcome>> {
  const {counter,fns}=fixtures();
  const pool=new SandboxPool(borrowed(engine),0,4);
  const exec=new MicroVMExecutor(pool,policy,5000);
  const mcp=new MicroVMExecutor(pool,()=> 'allow',5000,{tools:demo as any});
  const out:Record<string,Outcome>={};
  const providers=(c:Case)=>Object.entries(c.tools??{}).map(([name,names])=>({name,prelude:c.prelude?.[name],fns:Object.fromEntries(names.map(f=>{if(!fns[f])throw Error('parity: unknown fixture tool '+f);return [f,fns[f]];}))}));
  const once=async(ex:MicroVMExecutor,c:Case,code:string):Promise<Outcome>=>{
    const before=counter.effects;
    const r=await ex.execute(code,c.fixture==='mcp'?mcpProviders:providers(c),{timeout:c.timeout??5000,approve:c.approve?async()=>true:undefined});
    const effects=counter.effects-before;
    if(r.error===undefined)return {class:'OK',result:bounded(r.result),logs:normalLogs(r.logs??[]),effects};
    return {class:classify(r.error,false),logs:normalLogs(r.logs??[]),effects,message:r.error.slice(0,300)};
  };
  try {
    for(const c of cases){
      const ex=c.fixture==='mcp'?mcp:exec;
      try {
        if(c.burst){
          const p=new SandboxPool(borrowed(engine),0,c.burst.maxLive,{maxWaiting:c.burst.maxWaiting});
          const bx=c.fixture==='mcp'?new MicroVMExecutor(p,()=> 'allow',5000,{tools:demo as any}):new MicroVMExecutor(p,policy,5000);
          try {
            const all=await Promise.all(Array.from({length:c.burst.n},()=>once(bx,c,c.code)));
            const counts:Record<string,number>={};for(const o of all)counts[o.class]=(counts[o.class]??0)+1;
            out[c.id]={class:'BURST',result:bounded(counts),message:[...new Set(all.map(o=>o.message).filter(Boolean))].join(' | ').slice(0,300)||undefined};
          } finally {await p.drain();await p.close();}
        }else{
          if(c.before){await once(ex,c,c.before);await pool.drain();}
          out[c.id]=await once(ex,c,c.code);
        }
      }catch(e){out[c.id]={class:'HARNESS',message:String(e).slice(0,300)};}
      await pool.drain();
    }
  } finally {await pool.close();}
  return out;
}

async function engine(kind:Kind):Promise<Backend> {
  if(kind==='jitk'){
    const previous=process.env.JITK_BACKEND;delete process.env.JITK_BACKEND;
    try{return selectBackend().backend;}finally{if(previous!==undefined)process.env.JITK_BACKEND=previous;}
  }
  if(kind==='shard'){
    const binary=process.env.JITK_SHARD_BINARY,snapshot=process.env.JITK_SHARD_SNAPSHOT;
    if(!binary||!snapshot)throw Error('parity: shard needs JITK_SHARD_BINARY and JITK_SHARD_SNAPSHOT (make -C arch/jitk deps; make -C arch/jitk/shard snapshot)');
    const b=new ShardBackend({binary,snapshot,slots:8});await b.ready;return b;
  }
  if(kind==='hyperlight-js'){
    const base=fileURLToPath(new URL('../../bench/hyperlight/',import.meta.url));
    const d=JSON.parse(readFileSync(resolve(base,'adapter.json'),'utf8'));
    const worker=resolve(base,process.env.HYPERLIGHT_WORKER??d.strict_argv[0]),snapshot=resolve(base,process.env.HYPERLIGHT_SNAPSHOT??d.strict_argv[2]);
    for(const path of [worker,resolve(snapshot,'index.json')])if(!existsSync(path))throw Error('parity: Hyperlight artifact missing: '+path+'; run make -C arch/jitk deps');
    return new HyperlightBackend(worker,snapshot,5000);
  }
  throw Error('parity: unsupported backend '+kind);
}

/** Evaluate merged per-backend outcomes; returns failure lines and prints the matrix. */
export function evaluate(report:Report,cases:Case[]=CASES,allow:Difference[]=ALLOWLIST):string[] {
  const failures:string[]=[];
  const labels=Object.keys(report.backends);
  const byCase=new Map(cases.map(c=>[c.id,c]));
  for(const d of allow)if(!byCase.has(d.case))failures.push(`allowlist: unknown case ${d.case}`);
  const rows:string[][]=[['case',...labels]];
  const used=new Set<Difference>();
  for(const c of cases){
    const row=[c.id];
    for(const label of labels){
      const {kind,cases:outcomes}=report.backends[label]!;
      const o=outcomes[c.id];
      if(!o){row.push('-');continue;}
      const d=allow.find(d=>d.case===c.id&&d.backends.includes(kind));
      if(d)used.add(d);
      if(satisfies(o,c.expect)){
        row.push('ok');
        if(d)failures.push(`${label} ${c.id}: allowlisted difference no longer occurs (${d.limit}); remove the entry`);
      }else if(d&&satisfies(o,d.expect))row.push('allow');
      else{
        row.push('DIFF');
        failures.push(`${label} ${c.id}: ${JSON.stringify(o)} does not match ${d?'allowlisted ':''}${JSON.stringify(d?d.expect:c.expect,(_k,v)=>v instanceof Uint8Array?{$bytes:Buffer.from(v).toString('hex')}:v).slice(0,400)}`);
      }
    }
    rows.push(row);
  }
  // Pairwise: equal normalized outcomes, unless one side is a documented difference.
  for(const c of cases)for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){
    const [a,b]=[labels[i]!,labels[j]!];const [oa,ob]=[report.backends[a]!.cases[c.id],report.backends[b]!.cases[c.id]];
    if(!oa||!ob||key(oa)===key(ob))continue;
    const documented=[a,b].some(l=>allow.some(d=>d.case===c.id&&d.backends.includes(report.backends[l]!.kind)));
    if(!documented)failures.push(`${a} vs ${b} ${c.id}: undocumented difference ${key(oa)} != ${key(ob)}`);
  }
  const ran=new Set(Object.values(report.backends).map(b=>b.kind));
  const unchecked=allow.filter(d=>!used.has(d)&&d.backends.some(k=>ran.has(k)));
  for(const d of unchecked)failures.push(`allowlist: ${d.case} for ${d.backends.join(',')} was not exercised`);
  const width=rows[0]!.map((_,i)=>Math.max(...rows.map(r=>r[i]!.length)));
  for(const r of rows)console.log(r.map((x,i)=>x.padEnd(width[i]!)).join('  ').trimEnd());
  const counts=labels.map(l=>{const v=rows.slice(1).map(r=>r[labels.indexOf(l)+1]);return `${l}: ${v.filter(x=>x==='ok').length} ok, ${v.filter(x=>x==='allow').length} allowlisted, ${v.filter(x=>x==='DIFF').length} undocumented`;});
  console.log(`parity: ${cases.length} cases; ${counts.join('; ')}`);
  return failures;
}

const corpus=sha(JSON.stringify(CASES.map(c=>({...c,expect:expected(c.expect)}))));
const mode=process.argv[2]??'run';
let failures:string[];
if(mode==='compare'){
  const files=process.argv.slice(3);
  if(files.length<1)throw Error('usage: parity-check.js compare REPORT.json...');
  const merged:Report={corpus,host:{platform:'merged',arch:''},started:new Date().toISOString(),backends:{}};
  for(const file of files){
    const r=JSON.parse(readFileSync(file,'utf8')) as Report;
    if(r.corpus!==corpus)throw Error(`parity: ${file} ran another corpus (${r.corpus.slice(0,12)} != ${corpus.slice(0,12)}); rerun it on this tree`);
    for(const [label,b] of Object.entries(r.backends)){let l=label;for(let i=2;merged.backends[l];i++)l=label+'#'+i;merged.backends[l]=b;}
  }
  failures=evaluate(merged);
}else if(mode==='run'){
  const host=`${process.platform}-${process.arch}`;
  const kinds=(process.env.JITK_PARITY_BACKENDS??(process.platform==='linux'?'jitk,shard':'jitk,hyperlight-js')).split(',').filter(Boolean) as Kind[];
  const filter=process.env.JITK_PARITY_CASES?new RegExp(process.env.JITK_PARITY_CASES):undefined;
  const cases=CASES.filter(c=>!filter||filter.test(c.id));
  const report:Report={corpus,host:{platform:process.platform,arch:process.arch},started:new Date().toISOString(),backends:{}};
  const engines=new Map<Kind,Backend>();
  try {
    for(const kind of kinds)engines.set(kind,await engine(kind));
    // Backends run side by side; cases run in order on each.
    await Promise.all(kinds.map(async kind=>{
      const t=performance.now();const outcomes=await runBackend(kind,engines.get(kind)!,cases);
      report.backends[`${process.platform}/${kind}`]={kind,ms:Math.round(performance.now()-t),cases:outcomes};
    }));
  } finally {for(const e of engines.values())await e.close?.();}
  const out=process.env.JITK_PARITY_OUT??fileURLToPath(new URL(`../.work/parity/${host}.json`,import.meta.url));
  mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(report,null,1)+'\n');
  console.log(`parity: report ${out}`);
  failures=evaluate(report,cases,ALLOWLIST.filter(d=>cases.some(c=>c.id===d.case)));
}else throw Error('usage: parity-check.js [run|compare REPORT.json...]');
for(const f of failures)console.log('FAIL '+f);
assert.equal(failures.length,0,`parity: ${failures.length} failures`);
console.log('parity: PASS');
