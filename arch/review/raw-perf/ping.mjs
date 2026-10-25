// Copy to runtime/build; run under flock. Pure Node<->Rust IPC, no KVM/policy.
import {SharedChannel,IPC} from './shard-ipc.js';
import {spawn} from 'node:child_process';
let readyResolve, replyResolve;
const ready=new Promise(r=>readyResolve=r);
const channel=new SharedChannel(m=>{if(m.kind===IPC.ready)readyResolve();else replyResolve();},e=>{throw e;});
const child=spawn(process.env.JITK_SHARD_BINARY,['ipc-probe','echo'],{stdio:['ignore','ignore','inherit',...channel.fds],env:{PATH:'/usr/bin:/bin'}});
await ready;
const samples=[];
const cpu=process.cpuUsage();
for(let i=0;i<1005;i++) {
  const p=new Promise(r=>replyResolve=r),t=performance.now();
  await channel.send({kind:IPC.ping,slot:0,generation:0n,id:0,bytes:Buffer.alloc(32)});
  await p;
  if(i>=5)samples.push((performance.now()-t)*1000);
}
const usage=process.cpuUsage(cpu),sorted=[...samples].sort((a,b)=>a-b);
console.log(JSON.stringify({event:'ping',n:samples.length,p50us:sorted[499],p99us:sorted[989],nodeCpuUs:(usage.user+usage.system)/1005,samples}));
const reaped=new Promise(r=>child.once('close',r));child.kill('SIGKILL');channel.close();await reaped;
