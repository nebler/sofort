// UNVERIFIED runtime sketch: typechecked against 0.4.0, unavailable on Darwin.
// Execute only as a supervised, credential-free process on supported Linux x64.
import {createInterface} from 'node:readline';
import {readFile} from 'node:fs/promises';
import {SandboxBuilder} from '@hyperlight-dev/js-host-api';
import {parse,stringify} from './codec.mjs';
const i=process.argv.indexOf('--memory-mib');
const memory=i<0?128:Number(process.argv[i+1]);
const codec=(await readFile(new URL('./codec.mjs',import.meta.url),'utf8')).replaceAll('export function','function');
const pending=new Map<number,(reply:string)=>void>();
const send=(m:unknown)=>{const line=stringify(m)+'\n';if(Buffer.byteLength(line)>1048576)throw new Error('frame limit');process.stdout.write(line);};
const proto=await new SandboxBuilder().setHeapSize(memory*1048576)
  .setInputBufferSize(1048576).setOutputBufferSize(1048576).build();
proto.hostModule('jitk').register('call',async(raw:unknown)=>{
  const call=parse(String(raw));
  if(pending.has(call.id)||pending.size>=32)throw new Error('call limit');
  const reply=new Promise<string>(resolve=>pending.set(call.id,resolve));
  send(call);return reply;
});
const js=await proto.loadRuntime();
js.addHandler('run',`
import * as channel from 'host:jitk';
${codec}
installBase64();
async function handler(m) {
  const logs=[];
  const console=Object.fromEntries(['log','info','warn','error','debug'].map(level=>[level,(...a)=>{
    if(logs.length>=256)throw new Error('log limit');
    logs.push({t:'log',level,message:a.map(String).join(' ')});
  }]));
  let id=0;
  const rpc=async(ns,fn,args)=>{
    const r=parse(await channel.call(stringify({t:'call',id:id++,ns,fn,args})));
    if(Object.hasOwn(r,'err'))throw new Error(r.err);return r.ok;
  };
  const declarations=m.providers.map(p=>'const '+p.name+'=new Proxy(Object.create(null),{get:(t,f)=>Object.hasOwn(t,f)?t[f]:(...a)=>__rpc('+JSON.stringify(p.name)+',f,a)});').join('\\n');
  try {
    const f=new Function('__rpc','console',declarations+'\\n'+m.providers.map(p=>p.prelude||'').join('\\n')+'\\nreturn ('+m.code+');');
    return {t:'done',result:await f(rpc,console),logs};
  }catch(e){return {t:'error',message:String(e),logs};}
}
`);
const loaded=await js.getLoadedSandbox();let used=false;
const input=createInterface({input:process.stdin,crlfDelay:Infinity});
input.on('line',(line)=>{
  if(Buffer.byteLength(line)>1048576)process.exit(1);
  const m=parse(line);
  if(m.t==='run'){
    if(used)process.exit(1);used=true;
    // Dispatcher parent has the authoritative wall deadline and SIGKILL.
    void loaded.callHandler('run',m).then((value:any)=>{
      for(const log of value.logs??[])send(log);
      delete value.logs;send(value);
    },error=>send({t:'error',message:String(error)}));
  }else {
    const resolve=pending.get(m.id);if(!resolve)process.exit(1);
    pending.delete(m.id);resolve(line);
  }
});
input.on('close',()=>process.exit(0));
send({t:'ready',version:1});
