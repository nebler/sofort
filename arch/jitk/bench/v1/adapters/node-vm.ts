import {Script, createContext} from 'node:vm';
import {bridge, failure, limited, localAdapter, programEnvelope, provenance, timeoutMs, unpack} from './common.ts';
import {normalizeCode} from './normalize.ts';
export default localAdapter({
  name:'node-vm',isolation:'none',where:'local',
  provenance:()=>({...provenance(),engine:'node:vm',warning:'host functions reachable; no security boundary'}),
  async open({concurrency,timeoutMs:timeout}) {
    const budget=timeoutMs(timeout);
    return limited(concurrency,async(code,p)=>{
      const {bindings,declarations}=bridge(p,key=>key);
      const context=createContext(bindings);
      // Host references are intentional: this adapter is the no-isolation floor.
      const script=new Script(`(async()=>{${programEnvelope(normalizeCode(code),declarations)}})()`);
      let timer:ReturnType<typeof setTimeout>|undefined;
      try {
        const result=script.runInContext(context,{timeout:budget});
        return unpack(await Promise.race([result,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Execution timed out')),budget);})]));
      }catch(e){return failure(e);}finally{clearTimeout(timer);}
    });
  }
});
