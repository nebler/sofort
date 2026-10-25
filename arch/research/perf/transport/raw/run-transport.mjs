import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {MicroVMExecutor,JitkBackend} from './head/arch/jitk/executor/build/executor.js';
const require=createRequire(import.meta.url),loop=require('./bin/loopticks.node');
const original={stringify:JSON.stringify,parse:JSON.parse,clone:structuredClone,enc:TextEncoder.prototype.encode,dec:TextDecoder.prototype.decode};
let record,active=false,counts={},returned=0,want=1;
function count(k,n=1){if(active)counts[k]=(counts[k]??0)+n;}
JSON.stringify=function(...a){count('jsonEncode');return original.stringify(...a);};
JSON.parse=function(...a){count('jsonDecode');if(typeof a[0]==='string'&&a[0][0]==='"')count('jsonKeyDecode');return original.parse(...a);};
globalThis.structuredClone=function(...a){count('structuredClone');return original.clone(...a);};
TextEncoder.prototype.encode=function(...a){const r=original.enc.apply(this,a);count('textEncode');count('textEncodeBytes',r.length);return r;};
TextDecoder.prototype.decode=function(...a){const r=original.dec.apply(this,a);count('textDecode');count('textDecodeChars',r.length);return r;};
const big='x'.repeat(65536);
globalThis.__a4probe=(event,v)=>{
 if(!record)return;
 if(event==='stdout.before' && !active && !record.nodeStop && v.includes(Buffer.from('"t":"call"'))){active=true;loop.mark(1);counts={};record.nodeStart=process.hrtime.bigint().toString();record.tickStart=loop.ticks();}
 if(event==='stderr'){record.stderr+=v;return;}
 if(event==='kernel'){record.kernel.push(v);return;}
 if(active){const data=event==='send.encoded'?{bytes:v.length}:event.startsWith('stdout')?{bytes:v.length}:v&&typeof v==='object'?{t:v.t,id:v.id}:v;record.events.push({event,ns:process.hrtime.bigint().toString(),tick:loop.ticks(),data,counts:{...counts}});}
 if(event==='stdin.callback' && v.t==='ret' && ++returned===want){record.nodeStop=process.hrtime.bigint().toString();record.tickStop=loop.ticks();record.nodeCounts={...counts};loop.mark(0);record.nodeSys=loop.sys();active=false;}
};
if(process.env.A4_BASELINE){JSON.stringify=original.stringify;JSON.parse=original.parse;globalThis.structuredClone=original.clone;TextEncoder.prototype.encode=original.enc;TextDecoder.prototype.decode=original.dec;globalThis.__a4probe=undefined;}
const vmm=process.env.A4_VMM??'/tmp/sofort-a4/bin/jitk-vmm';
const image=process.env.A4_IMAGE??'/tmp/sofort-a4/head/arch/jitk/kernel/dist/kernel.bin';
const backend=new JitkBackend(vmm,{launcher:'01-vmm',image,watchdog:vmm,lifetimeMs:30000,env:process.env.A4_INTERPOSE?{DYLD_INSERT_LIBRARIES:'/tmp/sofort-a4/bin/syscalls.dylib'}:{}});
const rows=[];const loadBefore=execFileSync('/usr/bin/uptime',{encoding:'utf8'}).trim();
const n=+(process.env.A4_N??31);
const cases=(process.env.A4_CASES??'one,parallel10,result64k').split(',');
for(let sample=-3;sample<n;sample++)for(const name of cases){
 record={name,sample,events:[],kernel:[],stderr:''};returned=0;want=name==='parallel10'?10:name==='sequential100'?100:1;active=false;
 const sandbox=await backend.park();
 const pool={backend,async acquire(){return sandbox;},retire(){}};
 const ex=new MicroVMExecutor(pool,()=> 'allow');
 const body=name==='sequential100'?"let length=0;for(let i=0;i<100;i++)length+=(await api.echo('x')).length;":name==='one'?"const r=await api.echo('x');const length=r.length;":name==='parallel10'?"const r=await Promise.all(Array.from({length:10},(_,i)=>api.echo('x')));const length=r.length;":"const r=await api.large();const length=r.length;";
 const begin=process.env.A4_BASELINE?'const a4time=os.now();':`globalThis.__a4json=${process.env.A4_DISABLE_GUEST_JSON?'null':'[0,0,0,0,0,0]'};std.err.puts('A4-BEGIN\\n');std.err.flush();`;
 const end=process.env.A4_BASELINE?'const json=null;':"const json=globalThis.__a4json;globalThis.__a4json=null;std.err.puts('A4-END\\n');std.err.flush();";
 const start=process.hrtime.bigint();
 const r=await ex.execute(`${begin}${body}${end}return {length,json${process.env.A4_BASELINE?',guestRoundUs:(os.now()-a4time)*1000':''}};`,[{name:'api',fns:{echo:async x=>x,large:async()=>big}}],{timeout:30000,onTiming:(event,atMs)=>{record.events.push({event:'execute.'+event,atMs});}});
 record.executeUs=Number(process.hrtime.bigint()-start)/1000;record.result=r;
 if(r.error)throw Error(original.stringify(r));
 await sandbox.exited;
 record.guest=record.kernel.filter(x=>x.startsWith('A4 ')).map(x=>x.slice(3).trim().split(/\s+/).map(x=>parseInt(x,16)))[0];
 record.host=record.stderr.split('\n').filter(x=>x.startsWith('A4HOST ')).map(x=>original.parse(x.slice(7)))[0];
 record.sys=record.stderr.split('\n').filter(x=>x.startsWith('A4SYS ')).map(x=>original.parse(x.slice(6)))[0];
 if(record.host)record.windowUs=(record.host.end_ns-record.host.start_ns)/1000;
 if(sample>=0)rows.push(record);
 record=null;
}
const out={date:new Date().toISOString(),node:process.version,loadBefore,loadAfter:execFileSync('/usr/bin/uptime',{encoding:'utf8'}).trim(),vmm,image,n,rows};
const path=process.env.A4_OUT??'/tmp/sofort-a4/raw/transport.json';writeFileSync(path,original.stringify(out,null,2)+'\n');
for(const name of cases){const rs=rows.filter(x=>x.name===name);const median=(xs)=>xs.sort((a,b)=>a-b)[Math.floor(xs.length/2)];console.log(name,original.stringify({executeP50Us:median(rs.map(x=>x.executeUs)),windowP50Us:median(rs.map(x=>x.windowUs??0)),first:rs[0]}).slice(0,1600));}
