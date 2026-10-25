// Offline CPU experiment. Uses frozen production code and a read-only native collector.
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {loadavg,uptime} from 'node:os';
import assert from 'node:assert/strict';
const here=fileURLToPath(new URL('.',import.meta.url));
const native=createRequire(import.meta.url)(here+'ledger_native.node');
const [artifacts=here+'artifacts',output=here+'cpu-raw.json',samples='30']=process.argv.slice(2);
const {MicroVMExecutor,SandboxPool,JitkBackend}=await import(pathToFileURL(artifacts+'/executor/build/executor.js'));
const vmm=artifacts+'/jitk-vmm',image=artifacts+'/image.bin',profile=artifacts+'/jitk.sbbin';
const argv=['--image',image,'--mem-mib','32','--sandbox-profile',profile];
const stamp=()=>({at:performance.now(),node:native.rusage(0)});
const diff=(a,b)=>({user_ms:a.user_ms-b.user_ms,system_ms:a.system_ms-b.system_ms});
const data={schema:1,start:new Date().toISOString(),load_start:loadavg(),node_memory_start:native.usage(process.pid),samples:[],method:'read-only libproc at READY/DONE, getrusage(CHILDREN) through reap, Node getrusage(SELF); refill disabled after warming; native watchdog shared across samples'};
{
  const a=native.rusage(0),t=performance.now();for(let i=0;i<1000;i++)native.usage(process.pid);
  data.instrumentation={libproc_calls:1000,wall_ms:performance.now()-t,cpu:diff(native.rusage(0),a)};
}
function lines(proc) {
  const q=[],wait=[];let error;
  createInterface({input:proc.stdout}).on('line',s=>{
    try{const m=JSON.parse(s);if(wait.length)wait.shift().resolve(m);else q.push(m);}catch(e){error=e;for(const w of wait.splice(0))w.reject(e);}
  });
  proc.once('error',e=>{error=e;for(const w of wait.splice(0))w.reject(e);});
  return ()=>q.length?Promise.resolve(q.shift()):error?Promise.reject(error):new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('measurement frame timeout')),20000);
    wait.push({resolve:m=>{clearTimeout(timer);resolve(m);},reject:e=>{clearTimeout(timer);reject(e);}});
  });
}
const watchdog=spawn(vmm,['--watchdog'],{stdio:'pipe'});watchdog.stderr.resume();
const wdrecv=lines(watchdog);assert.deepEqual(await wdrecv(),{ready:true});
const wdBase=native.usage(watchdog.pid);
async function raw(mode,which) {
  const r={kind:'raw',mode,case:which,utc:new Date().toISOString(),load:loadavg(),host_uptime_s:uptime(),node_start:stamp(),children_before:native.rusage(1)};
  const p=spawn(vmm,argv,{stdio:'pipe',detached:true});let err='',acknowledge;
  const ack=new Promise(resolve=>acknowledge=resolve);
  p.stderr.on('data',b=>{err+=b;if(err.includes('{"sandbox":"ok"}'))acknowledge();});
  const closed=new Promise(resolve=>p.on('close',(code,signal)=>resolve({code,signal})));
  const recv=lines(p),send=m=>p.stdin.write(JSON.stringify(m)+'\n');
  watchdog.stdin.write(`add ${p.pid} 30000\n`);
  r.watchdog_before=native.usage(watchdog.pid);r.pid=p.pid;
  try {
    assert.deepEqual(await recv(),{t:'ready',v:1});await ack;
    r.ready=stamp();r.vmm_ready=native.usage(p.pid);
    if(mode==='parked')await new Promise(resolve=>setTimeout(resolve,5));
    r.before_run=stamp();r.vmm_before_run=native.usage(p.pid);
    const deadline=Date.now()+10000;watchdog.stdin.write(`arm ${p.pid} ${deadline}\n`);await wdrecv();
    send({t:'run',code:which==='return2'?'return 2;':'return await test.echo(2);',ns:{test:['echo']}});
    let m=await recv();
    if(which==='one_tool'){assert.equal(m.t,'call');r.call=stamp();r.vmm_call=native.usage(p.pid);send({t:'ret',id:m.id,ok:2});m=await recv();}
    assert.deepEqual(m,{t:'done',ok:2});r.done=stamp();r.vmm_done=native.usage(p.pid);
  }finally{try{process.kill(-p.pid,'SIGKILL');}catch{}r.exit=await closed;watchdog.stdin.write(`del ${p.pid}\n`);}
  r.reaped=stamp();r.vmm_total=diff(native.rusage(1),r.children_before);r.watchdog_after=native.usage(watchdog.pid);
  return r;
}
// The backend owns a second, production watchdog. Its lifetime and steady deltas are reported.
const backend=new JitkBackend(vmm,{launcher:'01-vmm',image,sandboxProfile:profile,watchdog:vmm,startupMs:10000,lifetimeMs:60000});
let productionWatchdog;
async function executor(mode,which) {
  const r={kind:'executor',mode,case:which,utc:new Date().toISOString(),load:loadavg(),host_uptime_s:uptime(),marks:{},children_before:native.rusage(1)};
  const pool=new SandboxPool(backend,mode==='parked'?1:0,1,{refillConcurrency:1,parkingGate:{idleCorePercent:0,evidence:'existing READY gate'},onEvent:(event,s)=>{
    r[event]=stamp();r['vmm_'+event]=native.usage(s.child.pid);
  }});
  const original=backend.park.bind(backend);
  backend.park=async(...args)=>{
    r.boot_start=stamp();const s=await original(...args);r.ready=stamp();r.pid=s.child.pid;r.vmm_ready=native.usage(r.pid);
    productionWatchdog=s.watchdog.proc;r.watchdog_pid=productionWatchdog.pid;
    data.production_watchdog_ready??=native.usage(productionWatchdog.pid);
    const read=s.read.bind(s);s.read=async()=>{const m=await read();if(m?.t==='done'){r.vmm_done=native.usage(r.pid);r.done_read=stamp();}return m;};return s;
  };
  try{
    r.prepare_start=stamp();
    if(mode==='parked'){await pool.warm();await new Promise(resolve=>setTimeout(resolve,5));}
    // No automatic extra VM: lifecycle CPU is one admitted VM, plus its independently measured boot.
    pool.warmCount=0;
    r.watchdog_before=productionWatchdog?native.usage(productionWatchdog.pid):{};
    r.before_run=stamp();r.vmm_before_run=r.pid?native.usage(r.pid):{};
    const ex=new MicroVMExecutor(pool,()=> 'allow',10000);
    const result=await ex.execute(which==='return2'?'return 2;':'return await test.echo(2);',
      [{name:'test',fns:{echo:async x=>x}}],{onTiming:(event,at)=>r.marks[event]={at,node:native.rusage(0)}});
    r.resolved=stamp();assert.equal(result.result,2);assert(!result.error);
    await pool.close();r.after_close=stamp();r.vmm_total=diff(native.rusage(1),r.children_before);
    r.watchdog_after=native.usage(productionWatchdog.pid);
  }finally{await pool.close();backend.park=original;}
  return r;
}
try{
  // Complete randomized blocks, deterministic seed via a simple fixed order rotation.
  const specs=[['raw','cold','return2'],['raw','cold','one_tool'],['raw','parked','return2'],['raw','parked','one_tool'],['executor','cold','return2'],['executor','cold','one_tool'],['executor','parked','return2'],['executor','parked','one_tool']];
  for(let i=0;i<Number(samples);i++){
    for(let j=0;j<specs.length;j++){
      const [kind,mode,which]=specs[(j+i*3)%specs.length];
      const r=await(kind==='raw'?raw(mode,which):executor(mode,which));r.block=i;data.samples.push(r);
    }
    writeFileSync(output,JSON.stringify(data,null,2)+'\n');
    if(i%5===0)process.stderr.write(`CPU block ${i+1}/${samples}\n`);
  }
}finally{
  data.node_memory_end=native.usage(process.pid);
  data.watchdogs={raw:{pid:watchdog.pid,start:wdBase,end:native.usage(watchdog.pid)},production:productionWatchdog?{pid:productionWatchdog.pid,end:native.usage(productionWatchdog.pid)}:null};
  const stop=async p=>{if(!p||p.exitCode!==null)return;p.ref();for(const s of [p.stdin,p.stdout,p.stderr])s.ref?.();const done=new Promise(resolve=>p.once('close',resolve));p.stdin.end();await done;};
  let before=native.rusage(1);await stop(watchdog);data.watchdogs.raw.lifecycle=diff(native.rusage(1),before);
  before=native.rusage(1);await stop(productionWatchdog);if(data.watchdogs.production)data.watchdogs.production.lifecycle=diff(native.rusage(1),before);
  data.end=new Date().toISOString();data.load_end=loadavg();
  writeFileSync(output,JSON.stringify(data,null,2)+'\n');
}
