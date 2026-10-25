import {spawn,execFileSync} from 'node:child_process';
import {readFileSync,existsSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {Dispatcher,encode,LIMIT} from './dispatcher.ts';
export const here=fileURLToPath(new URL('.',import.meta.url));
export const uptime=()=>execFileSync('/usr/bin/uptime',{encoding:'utf8'}).trim();
export const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
export function selection() {
 const root=fileURLToPath(new URL('../',import.meta.url));
 let image='/tmp/jitk-02/r2/kernel.bin', source='02 R2 fallback';
 if(existsSync(root+'kernel/.READY')) {
  const choices=[root+'kernel/dist/kernel.bin',root+'kernel/kernel.bin',root+'kernel/build/kernel.bin','/tmp/jitk-02/r3/kernel.bin'];
  try {const a=JSON.parse(readFileSync(root+'kernel/artifact.json','utf8'));if(a.image)choices.unshift(a.image);}catch{}
  image=choices.find(existsSync);
  if(!image)throw Error('integrated kernel READY but no image; set JITK_IMAGE');
  source='integrated kernel READY';
 }
 if(process.env.JITK_IMAGE){image=process.env.JITK_IMAGE;source='explicit JITK_IMAGE override';}
 const host=process.env.JITK_VMM||'/tmp/jitk-02/r2/host';
 const cli=process.env.JITK_VMM_CLI||'02-r2';
 const originalImage=image, contents=readFileSync(image), imageSha256=createHash('sha256').update(contents).digest('hex');
 mkdirSync('/tmp/jitk-03/r3',{recursive:true});image='/tmp/jitk-03/r3/kernel-'+imageSha256+'.bin';
 if(!existsSync(image))writeFileSync(image,contents);
 return {image,originalImage,host,cli,source,imageSha256,hostSha256:hash(host),bootstrapSha256:hash(here+'bootstrap.js')};
}
export const stats=xs=>{
 const a=[...xs].sort((x,y)=>x-y),n=a.length;
 return {n,p50:n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2,p90:a[Math.ceil(n*.9)-1],p99:a[Math.ceil(n*.99)-1]};
};
export async function vm(config,act) {
 const started=performance.now();
 const child=spawn(config.host,config.cli==='01-vmm'?['--image',config.image,'--mem-mib','32']:[config.image],
  {stdio:'pipe',detached:true,env:{PATH:'/usr/bin:/bin'}});
 let watchdogFired=false,watchdog,ended=false,queued=0,error,readyAt,doneAt;
 let fault,stderr='',bytes=0,kernel=[],frames=[],done,hostEffects=0;
 const kill=()=>{try{process.kill(-child.pid,'SIGKILL');}catch{}};
 const closed=new Promise(resolve=>child.once('close',(status,signal)=>{ended=true;resolve({status,signal});}));
 child.on('error',e=>{error=e;kill();});child.stdin.on('error',()=>{});
 child.stderr.on('data',b=>{stderr=(stderr+b).slice(0,8192);});
 if(child.pid) {
  watchdog=spawn('/usr/bin/python3',[here+'watchdog.py',String(child.pid),String(config.timeout||process.env.JITK_VM_TIMEOUT||15)],{stdio:'pipe'});
  watchdog.stdin.on('error',()=>{});watchdog.stderr.resume();
  watchdog.stdout.on('data',b=>{if(b.includes('WATCHDOG'))watchdogFired=true;});
  watchdog.on('error',e=>{error=e;kill();});
 }
 const watchdogClosed=watchdog?new Promise(resolve=>watchdog.once('close',resolve)):Promise.resolve();
 const enqueue=wire=>{
  if(queued+wire.length>2*(LIMIT.frame+1))return false;
  queued+=wire.length;child.stdin.write(wire,()=>{queued-=wire.length;});return true;
 };
 let onMessage=()=>{};
 const d=new Dispatcher({kill:f=>{fault=f.code;kill();},kernel:s=>{if(kernel.length<16)kernel.push(s);},message:m=>{
  if(frames.length<LIMIT.frames)frames.push(m);
  if(m.t==='ready')readyAt=performance.now();
  if(m.t==='done'){done=m;doneAt=performance.now();}
  onMessage(m);
 }});
 const api={child,d,kill,frames,kernel,
  set onMessage(fn){onMessage=fn;},
  send:m=>{if(!d.send(m,enqueue))throw Error('bounded output refused');},
  raw:async wire=>{wire=Buffer.from(wire);if(wire.length>2*(LIMIT.frame+1))throw Error('raw queue cap');
   await new Promise((resolve,reject)=>child.stdin.write(wire,e=>e&&!ended?reject(e):resolve()));},
  end:()=>child.stdin.end(),
  effect:()=>{hostEffects++;},
  terminate:code=>d.cancel(code),
 };
 child.stdout.on('data',b=>{bytes+=b.length;try{d.feed(b);}catch(e){if(!fault)error=e;}});
 try {
  // Attach case logic before yielding to any ready frame.
  act(api);
  const exit=await closed;
  if(watchdog){watchdog.kill('SIGKILL');await watchdogClosed;}
  if(error)throw error;
  if(watchdogFired)throw Error('external watchdog fired (not a conformance pass): '+JSON.stringify({bytes,frames:frames.length,kernel,stderr,state:d.snapshot()}));
  return {exit,fault,done,frames,kernel,stderr,hostEffects,stdoutBytes:bytes,
   startupMs:readyAt-started,runMs:doneAt&&readyAt?doneAt-readyAt:undefined,totalMs:performance.now()-started};
 } finally {
  kill();if(watchdog)watchdog.kill('SIGKILL');
  await closed;await watchdogClosed;
 }
}
export function runFrame(code) {return {t:'run',code,ns:{api:['echo','fail']}};}
export {encode,LIMIT};
