import {createServer,type IncomingMessage,type ServerResponse} from 'node:http';
import {StringDecoder} from 'node:string_decoder';
import {loadConfig} from './config.js';
import {Product,RpcError,object} from './mcp.js';
const product=new Product(loadConfig());
const active=new Map<string,AbortController>();
let closing=false;
async function shutdown():Promise<void>{if(closing)return;closing=true;for(const ac of active.values())ac.abort();try{await product.close();}finally{process.exit(0);}}
process.once('SIGINT',()=>{void shutdown();});
process.once('SIGTERM',()=>{void shutdown();});
function error(id:any,code:number,message:string):any{return {jsonrpc:'2.0',id,error:{code,message}};}
async function handle(wire:string,scope:string):Promise<string>{
  let m:any=null;try{m=JSON.parse(wire);}catch{return JSON.stringify(error(null,-32700,'Parse error'));}
  const hasId=object(m)&&Object.hasOwn(m,'id');
  if(!object(m)||m.jsonrpc!=='2.0'||typeof m.method!=='string'||(hasId&&typeof m.id!=='string'&&!(typeof m.id==='number'&&Number.isSafeInteger(m.id))))return JSON.stringify(error(null,-32600,'Invalid Request'));
  if(m.params!==undefined&&!object(m.params))return hasId?JSON.stringify(error(m.id,-32602,'Invalid params')):'';
  if(!hasId){
    if(m.method==='notifications/cancelled'){
      const id=m.params?.requestId;active.get(scope+JSON.stringify(id))?.abort();
    }
    return '';
  }
  const key=scope+JSON.stringify(m.id);
  if(active.has(key))return JSON.stringify(error(m.id,-32600,'duplicate active request id'));
  if(active.size>=128)return JSON.stringify(error(m.id,-32000,'request limit'));
  const ac=new AbortController();active.set(key,ac);
  try{return JSON.stringify({jsonrpc:'2.0',id:m.id,result:await product.request(m.method,m.params,ac.signal)});}
  catch(e){return JSON.stringify(error(m.id,e instanceof RpcError?e.code:-32603,e instanceof Error?e.message:String(e)));}
  finally{active.delete(key);}
}
const http=process.argv.indexOf('--http');
if(http===-1){
  const decoder=new StringDecoder('utf8');let buffer='';
  process.stdin.on('data',(b:Uint8Array)=>{
    buffer+=decoder.write(b);if(buffer.length>1<<20){process.stderr.write('jitk-mcp: input frame limit\n');void shutdown();return;}
    let n=0;while((n=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,n).replace(/\r$/,'');buffer=buffer.slice(n+1);if(!line)continue;
      void handle(line,'stdio:').then(reply=>{if(reply&&!closing)process.stdout.write(reply+'\n');});
    }
  });
  process.stdin.once('end',()=>{void shutdown();});
}else{
  const port=Number(process.argv[http+1]);
  if(!Number.isInteger(port)||port<1||port>65535)throw Error('invalid HTTP port');
  const allowed=['127.0.0.1:'+port,'localhost:'+port];
  const reply=(res:ServerResponse,status:number,body:string):void=>{res.statusCode=status;if(body)res.setHeader('content-type','application/json');res.end(body);};
  createServer((req:IncomingMessage,res:ServerResponse)=>{
    const host=req.headers['host']??'',origin=req.headers['origin'];
    if(!allowed.includes(host)||(origin!==undefined&&!allowed.some(h=>origin==='http://'+h))){reply(res,403,JSON.stringify(error(null,-32000,'Forbidden Host or Origin')));return;}
    if(req.url!=='/mcp'){reply(res,404,'');return;}
    if(req.method!=='POST'){res.setHeader('allow','POST');reply(res,405,'');return;}
    const accept=req.headers['accept']??'';
    if(!accept.includes('application/json')||!accept.includes('text/event-stream')){reply(res,406,JSON.stringify(error(null,-32000,'Accept application/json and text/event-stream required')));return;}
    if(!(req.headers['content-type']??'').startsWith('application/json')){reply(res,415,'');return;}
    const version=req.headers['mcp-protocol-version'];
    if(version!==undefined&&!['2025-11-25','2025-06-18','2025-03-26','2024-11-05','2024-10-07'].includes(version)){reply(res,400,JSON.stringify(error(null,-32000,'Unsupported protocol version')));return;}
    let body='',size=0,over=false;const decoder=new StringDecoder('utf8');
    req.on('data',(b:Buffer)=>{size+=b.length;if(size>1<<20){if(!over){over=true;reply(res,413,'');}return;}body+=decoder.write(b);});
    req.on('end',()=>{if(over)return;body+=decoder.end();void handle(body,'http:').then(out=>reply(res,out?200:202,out));});
    req.on('error',()=>res.destroy());
  }).listen(port,'127.0.0.1',()=>process.stderr.write('jitk-mcp: http://127.0.0.1:'+port+'/mcp\n'));
}
process.stderr.write('jitk-mcp: native macOS HVF; warm='+product.cfg.warm+'\n');
