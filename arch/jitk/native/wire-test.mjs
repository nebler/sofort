// Checks handwritten transport behavior beyond canonical test.mjs's 27 checks.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {request as httpRequest} from 'node:http';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
process.chdir(dirname(fileURLToPath(import.meta.url)));
const binary=resolve('dist/server');
const init=version=>({protocolVersion:version,capabilities:{},clientInfo:{name:'wire-test',version:'0'}});
const p=spawn(binary,[],{env:process.env,stdio:['pipe','pipe','inherit']});
let buffer='',seq=0;const waiting=new Map();
const exited=new Promise(r=>p.once('exit',r));
p.stdout.on('data',b=>{buffer+=b;let n;while((n=buffer.indexOf('\n'))>=0){const m=JSON.parse(buffer.slice(0,n));buffer=buffer.slice(n+1);waiting.get(m.id)?.(m);}});
async function call(method,params){
 const id=++seq,promise=new Promise(r=>waiting.set(id,r));
 p.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');
 try{return await promise;}finally{waiting.delete(id);}
}
try{
 assert.equal((await call('initialize',init('2025-11-25'))).result.protocolVersion,'2025-11-25');
 assert.equal((await call('initialize',init('unknown'))).result.protocolVersion,'2025-11-25');
 assert.deepEqual((await call('ping')).result,{});
 p.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
 p.stdin.write(JSON.stringify({jsonrpc:'2.0',id:'unsolicited',result:{}})+'\n');
 const running=call('tools/call',{name:'execute',arguments:{code:'while(true){}'}}),id=seq;
 setTimeout(()=>p.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/cancelled',params:{requestId:id,reason:'test'}})+'\n'),50);
 assert.equal((await running).result.structuredContent.error.code,'CANCELLED');
 assert.equal((await call('tools/call',{name:'execute',arguments:{code:'return 2',extra:true}})).error.code,-32602);
 assert.equal((await call('tools/call',{name:'run',arguments:{tool:'lua',args:[1]}})).error.code,-32602);
}finally{p.stdin.end();assert.equal(await exited,0);}
const port=40000+Math.floor(Math.random()*20000);
const h=spawn(binary,['--http',String(port)],{env:process.env,stdio:['ignore','ignore','pipe']});
const hExited=new Promise(r=>h.once('exit',r));
await new Promise((resolve,reject)=>{h.stderr.on('data',b=>{if(String(b).includes('http://'))resolve();});h.once('exit',reject);});
async function status(method,headers){return new Promise((resolve,reject)=>{
 const req=httpRequest({host:'127.0.0.1',port,path:'/mcp',method,headers},res=>{res.resume();resolve(res.statusCode);});
 req.on('error',reject);req.end(method==='POST'?JSON.stringify({jsonrpc:'2.0',id:1,method:'ping'}):undefined);
});}
try{
 const headers={accept:'application/json, text/event-stream','content-type':'application/json'};
 assert.equal(await status('POST',{...headers,origin:'https://evil.example'}),403);
 assert.equal(await status('GET',headers),405);
 assert.equal(await status('POST',{'content-type':'application/json'}),406);
 assert.equal(await status('POST',{...headers,'mcp-protocol-version':'unknown'}),400);
}finally{h.kill('SIGTERM');assert.equal(await hExited,0);}
console.log('native wire: 10 checks passed (versions, ping, cancellation, schemas, HTTP guards)');
