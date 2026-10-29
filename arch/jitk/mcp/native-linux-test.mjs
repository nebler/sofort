// Real SDK -> MCP -> persistent native ring worker: Linux arm64 KVM (`real`) or
// macOS arm64 HVF (`hvf`). Offline; JITK_NATIVE_BINARY and JITK_NATIVE_PROFILES
// (lua required). Then the worker dies with the MCP server mid-run.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
assert.ok(['linux','darwin'].includes(process.platform)); assert.equal(process.arch,'arm64');
const dir=mkdtempSync(join(tmpdir(),'jitk-native-mcp-'));
const server=async(name,timeoutMs)=>{
  const config=join(dir,name+'.json');
  writeFileSync(config,JSON.stringify({execute:false,timeoutMs,warm:0,providers:[],
    resources:new URL('./resources',import.meta.url).pathname,
    native:{binary:process.env.JITK_NATIVE_BINARY,profiles:JSON.parse(process.env.JITK_NATIVE_PROFILES)}}));
  const transport=new StdioClientTransport({command:process.execPath,args:[new URL('./server.mjs',import.meta.url).pathname],
    env:{...process.env,JITK_MCP_CONFIG:config},stderr:'inherit'});
  const client=new Client({name:'native-r7',version:'1'});await client.connect(transport);
  return {client,transport};
};
const {client}=await server('config',1000);
let count=0;
const call=async(tool,args=[],files={})=>{
  const r=await client.callTool({name:'run',arguments:{tool,args,files}});count++;
  assert.deepEqual(JSON.parse(r.content[0].text),r.structuredContent);return r.structuredContent;
};
const bytes=s=>Buffer.from(s.data,s.encoding);
try {
  assert.deepEqual((await client.listTools()).tools.map(t=>t.name),['execute','run']);
  let r=await call('lua',['-e','io.write(string.char(0,255,128)); io.flush(); io.stderr:write("err\\n"); os.exit(42)']);
  assert.deepEqual(bytes(r.stdout),Buffer.from([0,255,128]));assert.equal(bytes(r.stderr).toString(),'err\n');assert.equal(r.exitCode,42);
  for (const data of [Buffer.from([1,0,255]),Buffer.from('second')]) {
    r=await call('lua',['-e','io.write(io.open("data/input"):read("*a"))'],{'data/input':data.toString('base64')});
    assert.deepEqual(bytes(r.stdout),data);assert.equal(r.exitCode,0);
  }
  r=await call('lua',['-e','io.write(io.open("data/input"):read("*a"))'],{'data/input':Buffer.alloc(160000,255).toString('base64')});
  assert.equal(bytes(r.stdout).length,160000);
  r=await call('lua',['-e','for i=1,17 do io.write(string.rep("x",65536)); io.flush() end']);
  assert.equal(bytes(r.stdout).length,1048576);assert.equal(r.outputLimited,true);
  r=await call('lua',['-e','print(2)'],{'../escape':'AA=='});assert.equal(r.error.code,'LIMIT');
  r=await call('lua',['-e','print(2)'],{'input':'AB=='});assert.equal(r.error.code,'LIMIT');
  r=await call('absent');assert.equal(r.error.code,'UNSUPPORTED');
  // The worker stops the guest at the budget itself and serves the next call.
  r=await call('lua',['-e','while true do end']);assert.equal(r.error.code,'TIMEOUT');
  r=await call('lua',['-e','print(2)']);assert.equal(bytes(r.stdout).toString(),'2\n');
} finally {await client.close();}
// Parent death: the MCP server is SIGKILLed while its worker spins inside a
// guest with 30 s left; the worker must exit at once, not at its deadline.
const alive=pid=>{try{return !/^Z/.test(execFileSync('ps',['-o','stat=','-p',String(pid)]).toString().trim());}catch{return false;}};
const orphan=await server('orphan',30000);
try {
  const pending=orphan.client.callTool({name:'run',arguments:{tool:'lua',args:['-e','while true do end']}}).catch(()=>{});
  let worker;
  for(const end=Date.now()+10000;!worker;await new Promise(r=>setTimeout(r,50))){
    assert(Date.now()<end,'no native worker under the MCP server');
    try{worker=Number(execFileSync('pgrep',['-P',String(orphan.transport.pid)]).toString().trim().split('\n')[0])||undefined;}catch{}
  }
  await new Promise(r=>setTimeout(r,500)); // the request is in the guest
  process.kill(orphan.transport.pid,'SIGKILL');
  const killed=Date.now();
  while(alive(worker)&&Date.now()-killed<5000)await new Promise(r=>setTimeout(r,10));
  assert(!alive(worker),'the worker outlived the MCP server');
  console.log(JSON.stringify({parentDeath:'worker exited',ms:Date.now()-killed}));
  void pending;
} finally {await orphan.client.close().catch(()=>{});rmSync(dir,{recursive:true,force:true});}
console.log(JSON.stringify({status:'PASS',nativeCalls:count,checks:['byte-output','exit42','two-file-generations','160k-output','output-cap','path/base64-rejection','unknown-profile','worker-deadline','worker-kept','parent-death']}));
