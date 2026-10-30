// Runs inside workerd; host tool functions never enter this process.
import {DynamicWorkerExecutor} from '@cloudflare/codemode';
import {parse, stringify} from '../../../executor/codec.mjs';
import {callHost} from './http-client.ts';
export default {
  async fetch(request,env) {
    const {code,providers,callback,executionId,timeout}=await request.json();
    const resolved=providers.map(p=>({name:p.name,prelude:p.prelude,fns:Object.fromEntries(p.tools.map(tool=>[tool,async(...args)=>{
      return callHost(callback,{executionId,namespace:p.name,tool,args},{parse,stringify});
    }]))}));
    try {
      const executor=new DynamicWorkerExecutor({loader:env.LOADER,timeout,globalOutbound:null});
      const result=await executor.execute(code,resolved);
      return new Response(stringify(result),{headers:{'content-type':'application/json'}});
    }catch(e){return Response.json({error:String(e?.message??e),logs:[]});}
  }
};
