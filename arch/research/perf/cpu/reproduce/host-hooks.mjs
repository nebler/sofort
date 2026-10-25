import cp from 'node:child_process';
import {createRequire} from 'node:module';
const native=createRequire(import.meta.url)('./rusage.node');
const kids=new Map();
import {syncBuiltinESMExports} from 'node:module';
import {writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
const pid=process.pid, rows=[];let current=null;let total={};let next=0;
const mark=(name,extra={})=>{if(!current)return;current.marks.push({name,us:performance.now()*1000,cpu:process.cpuUsage(),...extra});};
function snapshot(){return {children:native.children(),kids:Object.fromEntries([...kids].map(([pid,role])=>[pid,{role,cpu:native.pid(pid)}])),cpu:process.cpuUsage(),ru:process.resourceUsage(),uv:performance.nodeTiming.uvMetricsInfo,elu:performance.eventLoopUtilization(),t:performance.now()*1000,hr:Number(process.hrtime.bigint()/1000n)};}
function begin(label){current={label,pid,begin:snapshot(),marks:[],io:[],counts:{}};return current;}
function end(extra={}){if(!current)return;current.end=snapshot();Object.assign(current,extra);rows.push(current);current=null;}
function io(role,direction,b){if(!current)return;const n=typeof b==='string'?Buffer.byteLength(b):b?.byteLength??0;const k=role+':'+direction;current.counts[k]=(current.counts[k]??0)+1;current.io.push({role,direction,n,us:performance.now()*1000});}
const orig=cp.spawn;cp.spawn=function(command,args,...options){const child=orig.call(this,command,args,...options);const role=(args??[]).includes('--watchdog')?'watchdog':String(command).includes('vmm')?'vmm':'other';
 kids.set(child.pid,role);child.once('exit',()=>kids.delete(child.pid));
 child.__a2id=++next;if(role==='vmm')globalThis.__a2lastPid=child.pid;
 if(child.stdin){const write=child.stdin.write;child.stdin.write=function(b,...rest){io(role,'write',b);return write.call(this,b,...rest);};}
 for(const [s,name] of [[child.stdout,'stdout'],[child.stderr,'stderr']])if(s)s.on('data',b=>io(role,name,b));
 return child;};syncBuiltinESMExports();
globalThis.__a2={mark,begin,end,rows,snapshot};
process.on('exit',()=>{if(process.env.A2_HOST_LOG)writeFileSync(process.env.A2_HOST_LOG.replace('{pid}',String(pid)),JSON.stringify({pid,rows},null,2));});
