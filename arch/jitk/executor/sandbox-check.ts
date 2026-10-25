import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {MicroVMExecutor,SandboxPool,ProcessBackend} from './executor.js';
for(const mode of ['host-ack','fragmented-ack','missing-ack','guest-ack']){
 const backend=new ProcessBackend('local-qjs',process.execPath,[fileURLToPath(new URL('../fixtures/ack-peer.mjs',import.meta.url)),mode],32,{requireSandboxAck:true,startupMs:5000});
 const pool=new SandboxPool(backend,0,1),ex=new MicroVMExecutor(pool,()=> 'allow');
 try{
  const r=await ex.execute('return 2',[]);
  if(mode==='host-ack'||mode==='fragmented-ack')assert.equal(r.result,2,JSON.stringify(r));else assert(r.error,mode+' must never release RUN');
 }finally{await pool.close();assert.equal(pool.snapshot().tokens,0);}
}
console.log('PASS host-only ack AND ready, fragmented ack, missing/guest-forged ack rejected');
