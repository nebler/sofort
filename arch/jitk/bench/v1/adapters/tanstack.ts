import type {IsolateDriver, ToolBinding} from '@tanstack/ai-code-mode';
import {bridge, failure, limited, programEnvelope, timeoutMs, unpack} from './common.ts';
import {normalizeCode} from './normalize.ts';
export function openDriver(driver:IsolateDriver,concurrency:number,timeout?:number) {
  const budget=timeoutMs(timeout);
  return limited(concurrency,async(code,p)=>{
    const {bindings,declarations}=bridge(p,key=>key);
    const tools:Record<string,ToolBinding>=Object.fromEntries(Object.entries(bindings).map(([name,execute])=>[name,{name,execute,description:'host callback',inputSchema:{type:'string'}}]));
    const context=await driver.createContext({bindings:tools,timeout:budget,memoryLimit:128});
    let timer:ReturnType<typeof setTimeout>|undefined;
    try {
      const result=await Promise.race([context.execute(programEnvelope(normalizeCode(code),declarations)),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Execution timed out')),budget);})]);
      return result.success ? unpack(result.value) : failure(result.error?.message??'Isolate execution failed',result.logs??[]);
    }finally{clearTimeout(timer);await context.dispose();}
  });
}
