import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {writeFileSync} from 'node:fs';
import {Dispatcher} from './dispatcher.ts';
const here=fileURLToPath(new URL('.',import.meta.url)),container='jitk-03-r2-edge-'+process.pid;
const tests=[
 ['syntax','return (','SyntaxError'],
 ['throw','throw new TypeError("boom")','TypeError'],
 ['BigInt','return 1n','SerializationError'],
 ['unawaited','void api.echo();return 2','SerializationError'],
 ['failure cancels pending','void api.echo();throw Error("boom")','Error']
];
async function run(backend,code,name) {
 const child=backend==='native'?spawn('/tmp/jitk-03/quickjs-2026-06-04/qjs',['--memory-limit','16M','-m',here+'bootstrap.js']):
  spawn('docker',['exec','-i',container,'/qjs','--memory-limit','16M','-m','/work/bootstrap.js']);
 let done,stderr='',closed=false,resolve,reject;
 const result=new Promise((r,j)=>{resolve=r;reject=j;});
 const close=new Promise(r=>child.on('close',status=>{closed=true;r(status);}));
 const timer=setTimeout(()=>reject(Error('edge watchdog '+backend)),30000);
 const d=new Dispatcher({kill:f=>reject(Error(f.code)),message:m=>{
  if(m.t==='ready')d.send({t:'run',code,ns:{api:['echo']}},wire=>{child.stdin.write(wire);return true;});
  if(m.t==='done'){done=m;resolve();}
 }});
 child.stdout.on('data',b=>{try{d.feed(b);}catch(e){reject(e);}});
 child.stderr.on('data',b=>{stderr=(stderr+b.toString()).slice(0,4096);});
 child.on('error',reject);child.stdin.on('error',e=>{if(!done)reject(e);});
 close.then(s=>{if(!done)reject(Error('early exit '+s+' '+stderr));});
 try {
  await result;assert.equal(done.err.name,name);assert.equal(d.snapshot().outstanding,0);
  const status=await close;d.eof();assert.equal(status,name==='SerializationError'?1:0);
  return {backend,expected:name,actual:done.err.name,status};
 } finally {clearTimeout(timer);if(!closed)child.kill('SIGKILL');await close;}
}
const results=[];
try {
 execFileSync('docker',['run','-d','--rm','--name',container,'--network','none','--read-only','--cap-drop','ALL',
 '--mount',`type=bind,source=${here},target=/work,readonly`,'--mount','type=bind,source=/tmp/jitk-spike/sc/qjs-static,target=/qjs,readonly','alpine:3.22','sleep','300'],{stdio:'ignore',timeout:30000});
 for(const backend of ['native','static-linux-docker'])for(const [test,code,name]of tests)results.push({test,...await run(backend,code,name)});
} finally {try{execFileSync('docker',['rm','-f',container],{stdio:'ignore',timeout:10000});}catch{}}
writeFileSync(here+'edge-results.json',JSON.stringify({node:process.execPath,results},null,2)+'\n');console.log(JSON.stringify(results,null,2));
