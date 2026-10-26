import {createHash,randomUUID} from 'node:crypto';
import type {Tool,Issuer} from './types.js';
export class Violation extends Error {}
export class LineReader {
  parts:Buffer[]=[];len=0;
  constructor(readonly cap=1<<20){}
  push(chunk:Buffer,onLine:(line:string)=>void):void {
    let start=0,nl=0;
    while((nl=chunk.indexOf(10,start))!==-1){
      if(this.len+nl-start>this.cap)throw new Violation('frame too large');
      this.parts.push(chunk.subarray(start,nl));onLine(Buffer.concat(this.parts).toString('latin1'));
      this.parts=[];this.len=0;start=nl+1;
    }
    if(this.len+chunk.length-start>this.cap)throw new Violation('frame too large');
    if(start<chunk.length){this.parts.push(chunk.subarray(start));this.len+=chunk.length-start;}
  }
}
export interface NormalCall {run:string;id:number;ns:string;fn:string;args:any}
export interface Run {
  id:string;tools:Record<string,Record<string,Tool>>;deadline:number;now:()=>number;
  nextId:number;outstanding:number;calls:number;denials:number;
  tainted:{privateRead:boolean;untrusted:boolean};approvals:Map<string,NormalCall>;granted:NormalCall[];
  limits:{calls:number;outstanding:number;denials:number};dead:boolean;
}
export interface Decision {kind:string;reason:string;digest:string;call:NormalCall}
const NAME=/^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/;
function canonical(v:any):any {
  if(!v||typeof v!=='object')return v;
  if(Array.isArray(v))return v.map((x:any)=>canonical(x));
  const out:Record<string,any>={};for(const k of Object.keys(v).sort())out[k]=canonical(v[k]);return out;
}
export function digest(v:any):string {return createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');}
export function createRun(config:{tools:Record<string,Record<string,Tool>>;deadline:number;now?:()=>number;limits?:{calls?:number;outstanding?:number;denials?:number}}):Run {
  return {id:randomUUID(),tools:config.tools,deadline:config.deadline,now:config.now??Date.now,nextId:1,outstanding:0,calls:0,denials:0,
    tainted:{privateRead:false,untrusted:false},approvals:new Map<string,NormalCall>(),granted:[],
    limits:{calls:config.limits?.calls??256,outstanding:config.limits?.outstanding??64,denials:config.limits?.denials??16},dead:false};
}
export function decide(run:Run,f:any):Decision {
  try{return decide1(run,f);}catch(e){if(e instanceof Violation)run.dead=true;throw e;}
}
function decide1(run:Run,f:any):Decision {
  if(run.dead)throw new Violation('run is dead');
  if(run.now()>=run.deadline)throw new Violation('deadline');
  if(!f||f.t!=='call'||Object.keys(f).sort().join()!=='args,fn,id,ns,t')throw new Violation('envelope');
  if(f.id!==run.nextId)throw new Violation('id sequence');run.nextId++;
  if(!NAME.test(f.ns)||!NAME.test(f.fn))throw new Violation('name');
  if(++run.calls>run.limits.calls)throw new Violation('call budget');
  if(run.outstanding>=run.limits.outstanding)throw new Violation('outstanding');
  const ns=run.tools[f.ns];
  if(!Object.hasOwn(run.tools,f.ns)||!Object.hasOwn(ns,f.fn))throw new Violation('unknown tool');
  const tool=ns[f.fn];
  const deny=(reason:string):Decision=>{
    if(++run.denials>run.limits.denials)throw new Violation('denial budget');
    return {kind:'deny',reason,digest:'',call:{run:run.id,id:f.id,ns:f.ns,fn:f.fn,args:null}};
  };
  let args:any=null;try{args=tool.args(structuredClone(f.args));}catch{return deny('schema');}
  const call:NormalCall={run:run.id,id:f.id,ns:f.ns,fn:f.fn,args};
  const conf=tool.egress&&run.tainted.privateRead,integ=tool.writes&&run.tainted.untrusted;
  if(conf&&!tool.endorsable)return deny('private data may not leave via this tool');
  if(conf||integ||tool.approval==='always'){
    const d=digest(call);run.approvals.set(d,call);return {kind:'approve',reason:'',digest:d,call};
  }
  run.granted.push(call);return {kind:'allow',reason:'',digest:'',call};
}
export function approve(run:Run,d:string):NormalCall|null {
  const call=run.approvals.get(d);run.approvals.delete(d);
  if(!call||run.dead)return null;run.granted.push(call);return call;
}
export async function dispatch(run:Run,call:NormalCall,options:{issuer:Issuer;signal?:AbortSignal}):Promise<any> {
  const idx=run.granted.indexOf(call);
  if(run.dead||idx===-1)throw new Violation('call not granted (forged, replayed or dead run)');
  run.granted.splice(idx,1);
  const tool=run.tools[call.ns][call.fn],remaining=run.deadline-run.now();
  if(remaining<=0)throw new Violation('deadline');
  run.outstanding++;
  const ac=new AbortController(),t=setTimeout(()=>ac.abort(),Math.min(tool.timeoutMs,remaining));
  options.signal?.addEventListener('abort',()=>ac.abort(),{once:true});
  let cred:any=null;
  try {
    cred=await options.issuer.issue({run:run.id,scope:call.ns+'.'+call.fn,ttlMs:Math.min(tool.timeoutMs,remaining)});
    const raw=await tool.invoke(call.args,cred,{signal:ac.signal,idempotencyKey:run.id+':'+call.id});
    const value=tool.output(raw);
    if(tool.reads==='private')run.tainted.privateRead=true;
    if(tool.reads!=='none')run.tainted.untrusted=true;
    return value;
  }finally{clearTimeout(t);run.outstanding--;if(cred)await options.issuer.revoke(cred).catch(()=>{});}
}
