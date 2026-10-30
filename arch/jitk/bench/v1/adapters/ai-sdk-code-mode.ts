import {experimental_runCodeMode as runCodeMode} from '@ai-sdk/code-mode';
import {jsonSchema, type Tool} from 'ai';
import {bridge, failure, limited, localAdapter, programEnvelope, provenance, timeoutMs, unpack} from './common.ts';
import {normalizeCode} from './normalize.ts';
export default localAdapter({
  name:'ai-sdk-code-mode',isolation:'wasm',where:'local',
  provenance:()=>({...provenance(['@ai-sdk/code-mode','ai','run']),engine:'QuickJS WASI in worker_threads; fresh context per run'}),
  async open({concurrency,timeoutMs:timeout}) {
    const budget=timeoutMs(timeout);
    return limited(concurrency,async(code,p)=>{
      const {bindings,declarations}=bridge(p,key=>`tools[${JSON.stringify(key)}]`);
      const tools:Record<string,Tool>=Object.fromEntries(Object.entries(bindings).map(([name,execute])=>[name,{inputSchema:jsonSchema({type:'string'}),execute}]));
      try{return unpack(await runCodeMode({js:programEnvelope(normalizeCode(code),declarations),tools,options:{executionPolicy:{timeoutMs:budget,cpuTimeoutMs:budget,memoryLimitBytes:128*1024*1024,maxToolOutputBytes:8*1024*1024,maxResultBytes:8*1024*1024}}}));}
      catch(e){return failure(e);}
    });
  }
});
