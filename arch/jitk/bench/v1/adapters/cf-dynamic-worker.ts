import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
import {codec, failure, limited, localAdapter, provenance, sha, timeoutMs} from './common.ts';
import type {ResolvedProvider} from './types.ts';
let script:Promise<string>|undefined;
function bundle() {
  return script??=build({entryPoints:[new URL('./cf-worker.mjs',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',external:['cloudflare:*']}).then(r=>r.outputFiles[0].text);
}
export default localAdapter({
  name:'cf-dynamic-worker',isolation:'v8-isolate',where:'local',
  provenance:()=>({...provenance(['@cloudflare/codemode','miniflare','workerd']),
    workerLoader:'local: verified LOADER.get and DynamicWorkerExecutor LOADER.load',
    'worker.sha256':sha(new URL('./cf-worker.mjs',import.meta.url)),
    model:'one workerd process per concurrency lane; fresh loaded Worker per execute; network blocked in guest'}),
  async open({concurrency,timeoutMs:timeout}) {
    const budget=timeoutMs(timeout);
    if(!Number.isSafeInteger(concurrency)||concurrency<1)throw Error('invalid concurrency');
    const source=await bundle();
    const runs=new Map<string,ResolvedProvider[]>();
    const secret=randomUUID();
    const server=createServer(async(req,res)=>{
      try {
        if(req.method!=='POST'||req.url!=='/call'){res.writeHead(404).end();return;}
        if(req.headers.authorization!==`Bearer ${secret}`){res.writeHead(401).end();return;}
        const chunks:Buffer[]=[];let size=0;
        for await(const chunk of req){size+=chunk.length;if(size>16*1024*1024)throw Error('callback input limit');chunks.push(chunk);}
        const call=codec.parse(Buffer.concat(chunks).toString()) as {executionId:string;namespace:string;tool:string;args:unknown[]};
        const provider=runs.get(call.executionId)?.find(p=>p.name===call.namespace);
        const fn=provider&&Object.hasOwn(provider.fns,call.tool)?provider.fns[call.tool]:undefined;
        if(!fn)throw Error('Unknown or expired tool callback');
        res.setHeader('content-type','application/json');
        try {const result=await fn(...call.args);res.end(codec.stringify({result:result??null}));}
        catch(e){res.end(JSON.stringify({error:failure(e).error}));}
      }catch(e){res.writeHead(400,{'content-type':'application/json'}).end(JSON.stringify({error:failure(e).error}));}
    });
    await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    const address=server.address();if(!address||typeof address==='string')throw Error('callback server address');
    const callback={url:`http://127.0.0.1:${address.port}`,token:secret};
    type Lane={mf?:Miniflare};
    const available:Lane[]=Array.from({length:concurrency},()=>({}));
    const make=()=>new Miniflare({modules:true,script:source,compatibilityDate:'2026-07-30',compatibilityFlags:['nodejs_compat'],workerLoaders:{LOADER:{}},inspectorPort:0});
    // Service startup belongs to open(); per-program Worker creation belongs to execute().
    try {for(const lane of available){lane.mf=make();await lane.mf.ready;}}
    catch(e){for(const lane of available)await lane.mf?.dispose();server.close();throw e;}
    const all=[...available];
    return limited(concurrency,async(code,p)=>{
      const lane=available.pop()!;
      const executionId=randomUUID();runs.set(executionId,p);
      let timer:ReturnType<typeof setTimeout>|undefined;
      try {
        if(!lane.mf){lane.mf=make();await lane.mf.ready;}
        const mf=lane.mf;
        const response=await Promise.race([mf.dispatchFetch('http://executor/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code,providers:p.map(x=>({name:x.name,tools:Object.keys(x.fns),prelude:x.prelude})),callback,executionId,timeout:budget})}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Execution timed out')),budget+50);})]);
        const result=codec.parse(await response.text()) as {result?:unknown;logs?:string[];error?:string};
        return result.error?failure(result.error,result.logs??[]):{result:result.result??null,logs:result.logs??[]};
      }catch(e){
        // workerd's guest-side timer cannot preempt a CPU loop. Terminate only
        // this lane's runtime; sibling executions have independent processes.
        await lane.mf?.dispose();lane.mf=undefined;
        return failure(e);
      }finally{clearTimeout(timer);runs.delete(executionId);available.push(lane);}
    },async()=>{
      await Promise.all(all.map(lane=>lane.mf?.dispose()));
      server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
    });
  }
});
