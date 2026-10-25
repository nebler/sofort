import {Client} from './arch/jitk/mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import {StdioClientTransport} from './arch/jitk/mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js';
import {writeFileSync} from 'node:fs';import {performance} from 'node:perf_hooks';import {loadavg} from 'node:os';
const R='/tmp/sofort-a2',N=+(process.env.N??50),W=5,delay=ms=>new Promise(r=>setTimeout(r,ms)),tracing=process.env.A2_HOOKS==='1';
const args=[...(process.env.A2_CPUPROF?['--cpu-prof','--cpu-prof-interval=100',`--cpu-prof-dir=${R}/raw`]:[]),...(tracing?['--import',`${R}/host-hooks.mjs`]:[]),`${R}/arch/jitk/mcp/server${tracing?'':'-base'}.mjs`];
const env={...process.env,JITK_VMM_BINARY:`${R}/vmm-base`,JITK_KERNEL_IMAGE:`${R}/images/base/kernel.bin`,A2_HOST_LOG:`${R}/raw/mcp-server-{pid}.json`};
const transport=new StdioClientTransport({command:process.execPath,args,env,stderr:'pipe'});let err='';transport.stderr?.on('data',b=>err+=b);
const client=new Client({name:'a2-cpu',version:'1'});await client.connect(transport);await delay(200);const rows=[];
try{for(let i=0;i<N+W;i++)for(const c of (i%2?['one_tool','return2']:['return2','one_tool'])){
 await delay(30);const a=process.cpuUsage(),t=performance.now()*1000;
 const out=await client.callTool({name:'execute',arguments:{code:c==='return2'?'return 2;':'return await math.add(1,1);'}});
 const end=performance.now()*1000,cpu=process.cpuUsage(a);if(out.structuredContent?.result!==2)throw Error(JSON.stringify(out));rows.push({case:c,i,warmup:i<W,t,end,cpu,load:loadavg()});
}}finally{await client.close();}
writeFileSync(`${R}/raw/mcp-client-${tracing?'hooks':'control'}${process.env.A2_SUFFIX??''}.json`,JSON.stringify({N,tracing,rows,stderr:err},null,2));
