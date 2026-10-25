const {SandboxBuilder}=require('/tmp/jitk-09/js-host-api.node');
const source=`import * as math from 'host:math';
 async function handler(e){
   if(e.host) return await math.add(20,22);
   return 42;
 }`;
const emit=(metric,i,t)=>console.log(JSON.stringify({metric,i,ns:Number(process.hrtime.bigint()-t)}));
async function create(){
 const p=await new SandboxBuilder().build();
 p.hostModule('math').register('add', async(a,b)=>a+b);
 const s=await p.loadRuntime();s.addHandler('handler',source);return s.getLoadedSandbox();
}
(async()=>{
 for(let i=0;i<40;i++){
  const t=process.hrtime.bigint();const s=await create();emit('napi_create',i,t);
  if(await s.callHandler('handler',{})!==42)throw Error('result');
  emit('napi_create_to_result',i,t);s.dispose();
 }
 const s=await create();
 for(let i=0;i<210;i++)for(const host of [false,true]){
  const t=process.hrtime.bigint();if(await s.callHandler('handler',{host})!==42)throw Error('result');
  if(i>=10)emit(host?'napi_host':'napi_add',i,t);
 }
 s.dispose();
})().catch(e=>{console.error(e);process.exit(1)});
