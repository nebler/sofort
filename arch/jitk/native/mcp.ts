import {readdirSync,readFileSync,realpathSync,statSync} from 'node:fs';
import {join,relative,sep} from 'node:path';
import {MicroVMExecutor} from './executor.js';
import {SandboxPool} from './pool.js';
import {selectBackend} from './select-backend.js';
import {describeTools,type Config} from './config.js';
import type {Provider} from './types.js';
const versions=['2025-11-25','2025-06-18','2025-03-26','2024-11-05','2024-10-07'];
const PREFIX='jitk://resources/';
export class RpcError extends Error {constructor(readonly code:number,message:string){super(message);}}
export function object(v:any):boolean{return v!==null&&typeof v==='object'&&!Array.isArray(v);}
function mime(p:string):string {return p.endsWith('.md')?'text/markdown':'text/plain';}
interface Resource {uri:string;name:string;mimeType:string;size:number}
function listResources(root:string):Resource[] {
  const out:Resource[]=[];
  const walk=(dir:string):void=>{
    for(const e of readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:1)){
      if(e.name.startsWith('.'))continue;const path=join(dir,e.name);
      if(e.isDirectory())walk(path);
      else if(e.isFile()){const rel=relative(root,path).split(sep).join('/');out.push({uri:PREFIX+rel,name:rel,mimeType:mime(rel),size:statSync(path).size});}
    }
  };walk(root);return out;
}
export function classify(error:string,cancelled:boolean):string {
  if(error==='Execution aborted or timed out')return cancelled?'CANCELLED':'TIMEOUT';
  if(/policy denied|approval required/.test(error))return 'POLICY';
  if(/limit|budget|saturated|out of memory|stack overflow/i.test(error))return 'LIMIT';
  if(/sandbox exited|protocol [A-Z_]+|invalid frame|unknown frame/.test(error))return 'SANDBOX';
  return 'GUEST_ERROR';
}
export class Product {
  readonly pool:SandboxPool;readonly executor:MicroVMExecutor;readonly providers:Provider[]=[];
  closing=false;
  constructor(readonly cfg:Config){
    const selected=selectBackend();
    this.pool=new SandboxPool(selected.backend,cfg.warm,Math.max(cfg.maxLive,cfg.warm,1),{parkingGate:selected.gate,refillOnExit:true});
    this.executor=new MicroVMExecutor(this.pool,()=> 'allow',cfg.timeoutMs,{tools:cfg.tools});
    for(const name of Object.keys(cfg.tools)){
      const fns:Record<string,(...a:any[])=>Promise<any>>={};for(const fn of Object.keys(cfg.tools[name]))fns[fn]=async():Promise<any>=>{throw Error('declared Tool.invoke is used');};
      this.providers.push({name,fns});
    }
    void this.pool.warm().then(()=>this.executor.execute('return 0',this.providers)).then(()=>this.pool.warm()).catch(()=>{});
  }
  async close():Promise<void>{this.closing=true;await this.pool.close();}
  async execute(code:string,signal:AbortSignal):Promise<any>{
    if(!this.cfg.execute)return {error:{code:'UNSUPPORTED',message:'execute backend disabled by server configuration'},logs:[]};
    const r=await this.executor.execute(code,this.providers,{signal});
    if(r.error===undefined)return {result:r.result??null,logs:r.logs};
    return {error:{code:classify(r.error,signal.aborted),message:r.error},logs:r.logs};
  }
  async request(method:string,params:any,signal:AbortSignal):Promise<any> {
    if(method==='initialize'){
      if(!object(params)||typeof params.protocolVersion!=='string'||!object(params.capabilities)||!object(params.clientInfo)||typeof params.clientInfo.name!=='string'||typeof params.clientInfo.version!=='string')throw new RpcError(-32602,'invalid initialize params');
      return {protocolVersion:versions.includes(params.protocolVersion)?params.protocolVersion:versions[0],capabilities:{tools:{},resources:{}},serverInfo:{name:'jitk',version:'0.1.0'}};
    }
    if(method==='ping')return {};
    if(method==='tools/list')return {tools:[{
      name:'execute',description:`Run JavaScript in a fresh single-use microVM (QuickJS, no network, no filesystem). The code is an async function body: use await and \`return\` a JSON value. console.log output is returned as logs. Deadline ${this.cfg.timeoutMs} ms. Host tools (call with await; Promise.all runs them concurrently):\n${describeTools(this.cfg.tools)}\nErrors carry a code: TIMEOUT, POLICY, LIMIT, SANDBOX, CANCELLED or GUEST_ERROR.`,
      inputSchema:{type:'object',properties:{code:{type:'string',description:'JavaScript async function body'}},required:['code'],additionalProperties:false}},
      {name:'run',description:'Run a prepared static native tool in a fresh Linux arm64 KVM microVM. args excludes argv[0]. files maps relative read-only guest paths to canonical base64 bytes (64 files, 4 MiB archive). Returns stdout/stderr as {encoding:"base64",data}, exitCode, outputLimited (1 MiB combined cap). macOS v1 returns UNSUPPORTED. Configured profiles: '+this.cfg.profiles.join(', '),
        inputSchema:{type:'object',properties:{tool:{type:'string'},args:{type:'array',maxItems:31,items:{type:'string'}},files:{type:'object',maxProperties:64,additionalProperties:{type:'string'}}},required:['tool'],additionalProperties:false}}
    ]};
    if(method==='tools/call'){
      if(!object(params)||typeof params.name!=='string'||(params.arguments!==undefined&&!object(params.arguments)))throw new RpcError(-32602,'invalid tools/call params');
      let out:any=null;const input=params.arguments;
      if(params.name==='execute'){
        if(!object(input)||typeof input.code!=='string')throw new RpcError(-32602,'execute: `code` must be a string');
        if(Object.keys(input).some(k=>k!=='code'))throw new RpcError(-32602,'execute: only code is accepted');
        out=await this.execute(input.code,signal);
      }else if(params.name==='run'){
        if(!object(input)||typeof input.tool!=='string'||Object.keys(input).some(k=>!['tool','args','files'].includes(k)))throw new RpcError(-32602,'run: tool, args, files required');
        if(input.args!==undefined&&(!Array.isArray(input.args)||input.args.length>31||input.args.some((a:any)=>typeof a!=='string')))throw new RpcError(-32602,'run: invalid args');
        if(input.files!==undefined&&(!object(input.files)||Object.keys(input.files).length>64||Object.values(input.files).some((a:any)=>typeof a!=='string')))throw new RpcError(-32602,'run: invalid files');
        out={error:{code:'UNSUPPORTED',message:'native run requires Linux arm64 KVM profiles; macOS v1 is unsupported'}};
      }else throw new RpcError(-32602,'unknown tool: '+params.name);
      return {content:[{type:'text',text:JSON.stringify(out)}],structuredContent:out,isError:Object.hasOwn(out,'error')};
    }
    if(method==='resources/list')return {resources:listResources(this.cfg.resources)};
    if(method==='resources/read'){
      const uri=params?.uri;if(typeof uri!=='string')throw new RpcError(-32602,'invalid resource uri');
      const unknown=():never=>{throw new RpcError(-32602,'unknown resource: '+uri);};
      if(!uri.startsWith(PREFIX))unknown();let path='';
      try{path=realpathSync(join(this.cfg.resources,decodeURIComponent(uri.slice(PREFIX.length))));}catch{unknown();}
      if(!path.startsWith(this.cfg.resources+sep)||!statSync(path).isFile()||statSync(path).size>1<<20)unknown();
      return {contents:[{uri,mimeType:mime(path),text:readFileSync(path,'utf8')}]};
    }
    throw new RpcError(-32601,'Method not found');
  }
}
