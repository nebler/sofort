interface Sandbox {exited:Promise<void>;read():Promise<unknown>;send(frame:unknown):Promise<void>;kill():void}
interface Backend {kind:string;memoryLimitMB:number;park(signal?:AbortSignal):Promise<Sandbox>}
class Fake implements Backend {
 kind='local-qjs';memoryLimitMB=32;
 instances:(Sandbox&{reap:()=>void;kills:number})[]=[];
 async park(signal?:AbortSignal):Promise<Sandbox>{
  let reap!:()=>void;const exited=new Promise<void>(r=>{reap=r;});
  const s:Sandbox&{reap:()=>void;kills:number}={exited,reap,kills:0,read:async():Promise<unknown>=>null,send:async(_frame:unknown):Promise<void>=>{},kill:()=>{s.kills++;reap();}};
  this.instances.push(s);if(signal?.aborted)throw Error('aborted');return s;
 }
}
class Pool {constructor(readonly backend:Backend){} async acquire():Promise<Sandbox>{return await this.backend.park();}}
const s=await new Pool(new Fake()).acquire();s.kill();await s.exited;
