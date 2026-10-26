// Node is the measurement driver, not part of a native application under test.
// Invoke under /usr/bin/lockf -k /tmp/sofort-bench.lock.
import {spawn, execFileSync} from 'node:child_process';
import {statSync, readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
process.chdir(dirname(fileURLToPath(import.meta.url)));
const node = process.env.JITK_NODE;
if (!node?.startsWith('/')) throw Error('absolute JITK_NODE required');
const server = resolve('.work/original/mcp/server.mjs');
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const hash = path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const uptime = ()=>execFileSync('/usr/bin/uptime',[],{encoding:'utf8'}).trim();
async function launch() {
  const start = performance.now();
  const p = spawn(node,[server],{stdio:['pipe','pipe','pipe'],env:process.env});
  let buffer='',stderr='',seq=0;
  const waiting = new Map();
  p.stderr.on('data',b=>stderr+=b);
  p.stdout.on('data',b=>{
    buffer+=b.toString(); let n;
    while((n=buffer.indexOf('\n'))>=0) {
      const line=buffer.slice(0,n);buffer=buffer.slice(n+1);
      const m=JSON.parse(line);const request=waiting.get(m.id);
      if(request){waiting.delete(m.id);request.resolve(m);}
    }
  });
  p.on('error',e=>{for(const w of waiting.values())w.reject(e);waiting.clear();});
  const exited = new Promise(r=>p.on('exit',r));
  p.on('exit',(code,signal)=>{for(const w of waiting.values())w.reject(Error(`server exited ${code}/${signal}: ${stderr}`));waiting.clear();});
  async function request(method,params) {
    const id=++seq;
    const promise=new Promise((resolve,reject)=>waiting.set(id,{resolve,reject}));
    p.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');
    const timeout=setTimeout(()=>waiting.get(id)?.reject(Error(`request timed out: ${stderr}`)),15000);
    try {const m=await promise;if(m.error)throw Error(JSON.stringify(m.error));return m.result;}
    finally {clearTimeout(timeout);waiting.delete(id);}
  }
  try {
    const init=await request('initialize',{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'native-spike',version:'0'}});
    if(init.serverInfo?.name!=='jitk')throw Error('wrong initialize response');
    const initializeMs=performance.now()-start;
    p.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
    return {p,initializeMs,request,stderr:()=>stderr,async close(){p.stdin.end();await Promise.race([exited,sleep(5000)]);if(p.exitCode===null){p.kill('SIGKILL');await exited;}}};
  } catch(e){p.kill('SIGKILL');await exited;throw e;}
}
const loadBefore=uptime(),samples=[];
for(let i=0;i<50;i++){
  const s=await launch();try{samples.push(s.initializeMs);}finally{await s.close();}
}
const rssKiB=pid=>Number(execFileSync('/bin/ps',['-o','rss=','-p',String(pid)],{encoding:'utf8'}).trim());
const s=await launch();let memory;
try {
  await sleep(1000); // Allow startup throwaway execution and warm=2 refill to settle.
  const idle=rssKiB(s.p.pid);
  const output=await s.request('tools/call',{name:'execute',arguments:{code:'return await math.add(1, 1);'}});
  if(output.isError || output.structuredContent?.result!==2)throw Error(JSON.stringify(output));
  await sleep(250); // after successful call, deferred reap/refill has run
  memory={idleRssKiB:idle,afterExecuteRssKiB:rssKiB(s.p.pid),result:output.structuredContent,serverStderr:s.stderr()};
}finally{await s.close();}
const sorted=[...samples].sort((a,b)=>a-b);
const report={date:new Date().toISOString(),nodeVersion:execFileSync(node,['--version'],{encoding:'utf8'}).trim(),
  platform:process.platform,arch:process.arch,lock:'/tmp/sofort-bench.lock',samples,loadBefore,loadAfter:uptime(),
  summary:{n:50,medianInitializeMs:(sorted[24]+sorted[25])/2,minInitializeMs:sorted[0],maxInitializeMs:sorted[49],...memory},
  nodeBytes:statSync(node).size,vmm:{path:process.env.JITK_VMM_BINARY,sha256:hash(process.env.JITK_VMM_BINARY)},
  kernel:{path:process.env.JITK_KERNEL_IMAGE,sha256:hash(process.env.JITK_KERNEL_IMAGE)},
  config:JSON.parse(readFileSync('.work/original/mcp/jitk-mcp.json','utf8'))};
writeFileSync('.work/measurements.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,samples:undefined},null,2));
