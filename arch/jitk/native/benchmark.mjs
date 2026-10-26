// Same validation boundary and RSS settling as native-spike/benchmark.mjs.
// Run under /usr/bin/lockf -k /tmp/sofort-bench.lock. No compiler in timing loop.
import {spawn,execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,statSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
process.chdir(dirname(fileURLToPath(import.meta.url)));
const node=process.env.JITK_NODE||process.execPath;
const native=resolve('dist/server'),nodeServer=resolve('.work/node/mcp/server.mjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const uptime=()=>execFileSync('/usr/bin/uptime',[],{encoding:'utf8'}).trim();
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const env={...process.env,JITK_MCP_CONFIG:resolve('../mcp/jitk-mcp.json')};
async function launch(kind){
 const start=performance.now(),p=spawn(kind==='node'?node:native,kind==='node'?[nodeServer]:[],{env,stdio:['pipe','pipe','pipe']});
 let buffer='',stderr='',seq=0;const waiting=new Map();
 p.stderr.on('data',b=>stderr+=b);
 p.stdout.on('data',b=>{buffer+=b;let n;while((n=buffer.indexOf('\n'))>=0){const m=JSON.parse(buffer.slice(0,n));buffer=buffer.slice(n+1);waiting.get(m.id)?.resolve(m);}});
 const exited=new Promise(r=>p.on('exit',r));
 p.on('error',e=>{for(const w of waiting.values())w.reject(e);waiting.clear();});
 p.on('exit',(code,signal)=>{for(const w of waiting.values())w.reject(Error(`server exited ${code}/${signal}: ${stderr}`));waiting.clear();});
 async function request(method,params){
  const id=++seq,promise=new Promise((resolve,reject)=>waiting.set(id,{resolve,reject}));
  p.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');
  const timeout=setTimeout(()=>waiting.get(id)?.reject(Error('request timed out: '+stderr)),15000);
  try{const m=await promise;if(m.error)throw Error(JSON.stringify(m.error));return m.result;}
  finally{clearTimeout(timeout);waiting.delete(id);}
 }
 async function close(){
  p.stdin.end();let timer;
  await Promise.race([exited,new Promise(r=>{timer=setTimeout(r,5000);})]);clearTimeout(timer);
  if(p.exitCode===null){p.kill('SIGKILL');await exited;throw Error('server did not close');}
 }
 try{
  const init=await request('initialize',{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'native-bench',version:'0'}});
  if(init.serverInfo?.name!=='jitk'||init.protocolVersion!=='2025-03-26'||!init.capabilities?.tools)throw Error('wrong initialize');
  const initializeMs=performance.now()-start;
  p.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
  return {p,initializeMs,request,close};
 }catch(e){p.kill('SIGKILL');await exited;throw e;}
}
const rows=[];
for(const kind of ['node','native']){
 const loadBefore=uptime(),samples=[];
 for(let i=0;i<50;i++){const s=await launch(kind);try{samples.push(s.initializeMs);}finally{await s.close();}}
 const rss=pid=>Number(execFileSync('/bin/ps',['-o','rss=','-p',String(pid)],{encoding:'utf8'}).trim());
 const s=await launch(kind);let idle,after,result;
 try{
  await sleep(1000);idle=rss(s.p.pid);
  result=await s.request('tools/call',{name:'execute',arguments:{code:'return await math.add(1, 1);'}});
  if(result.isError||result.structuredContent?.result!==2)throw Error(JSON.stringify(result));
  await sleep(250);after=rss(s.p.pid);
 }finally{await s.close();}
 const sorted=[...samples].sort((a,b)=>a-b);
 const row={kind,bytes:statSync(kind==='node'?node:native).size,n:50,medianInitializeMs:(sorted[24]+sorted[25])/2,minInitializeMs:sorted[0],maxInitializeMs:sorted[49],idleRssKiB:idle,afterExecuteRssKiB:after,result:result.structuredContent,loadBefore,loadAfter:uptime(),samples};
 rows.push(row);console.log(JSON.stringify({...row,samples:undefined},null,2));
}
const report={date:new Date().toISOString(),nodeVersion:execFileSync(node,['--version'],{encoding:'utf8'}).trim(),compiler:'scriptc 0.4.5',lock:'/tmp/sofort-bench.lock',rows,
 vmm:{path:env.JITK_VMM_BINARY,sha256:hash(env.JITK_VMM_BINARY)},kernel:{path:env.JITK_KERNEL_IMAGE,sha256:hash(env.JITK_KERNEL_IMAGE)},nativeSha256:hash(native)};
writeFileSync('.work/measurements.json',JSON.stringify(report,null,2)+'\n');
