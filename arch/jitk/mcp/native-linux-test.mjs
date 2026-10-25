// Real SDK -> MCP -> persistent native ring worker. Offline kvm-dev only.
import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
assert.equal(process.platform,'linux'); assert.equal(process.arch,'arm64');
const dir=mkdtempSync(join(tmpdir(),'jitk-native-mcp-'));
const config=join(dir,'config.json');
writeFileSync(config,JSON.stringify({execute:false,timeoutMs:1000,warm:0,providers:[],
  resources:new URL('./resources',import.meta.url).pathname,
  native:{binary:process.env.JITK_NATIVE_BINARY,profiles:JSON.parse(process.env.JITK_NATIVE_PROFILES)}}));
const transport=new StdioClientTransport({command:process.execPath,args:[new URL('./server.mjs',import.meta.url).pathname],
  env:{...process.env,JITK_MCP_CONFIG:config},stderr:'inherit'});
const client=new Client({name:'native-r7',version:'1'});await client.connect(transport);
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
  r=await call('lua',['-e','print(2)'],{'../escape':'AA=='});assert.equal(r.error.code,'LIMIT');
  r=await call('lua',['-e','print(2)'],{'input':'AB=='});assert.equal(r.error.code,'LIMIT');
  r=await call('absent');assert.equal(r.error.code,'UNSUPPORTED');
  r=await call('lua',['-e','while true do end']);assert.equal(r.error.code,'TIMEOUT');
  r=await call('lua',['-e','print(2)']);assert.equal(r.error.code,'SANDBOX');
  console.log(JSON.stringify({status:'PASS',nativeCalls:count,checks:['byte-output','exit42','two-file-generations','160k-output','path/base64-rejection','unknown-profile','deadline-kill','stopped-worker']}));
} finally {await client.close();rmSync(dir,{recursive:true,force:true});}
