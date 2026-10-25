import {writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {Dispatcher,parseFrame,schema,encode} from './head/arch/jitk/protocol/dispatcher.js';
import {parse,stringify} from './head/arch/jitk/executor/codec.mjs';
const uptime=()=>execFileSync('/usr/bin/uptime',{encoding:'utf8'}).trim();
const rows=[];let sink=0;const loadBefore=uptime();
const one={t:'call',id:1,ns:'api',fn:'echo',args:['x']},ret={t:'ret',id:1,ok:'x'},large={t:'ret',id:1,ok:'x'.repeat(65536)};
const sets=[['call',one,10000],['reply',ret,10000],['reply64k',large,100]];
for(const [shape,obj,n]of sets){const str=JSON.stringify(obj),wire=Buffer.from(str+'\n');
 const ops={json_encode:()=>JSON.stringify(obj).length,json_decode:()=>Object.keys(JSON.parse(str)).length,ascii_replace:()=>str.replace(/[\u007f-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0')).length,
 parseFrame:()=>Object.keys(parseFrame(str)).length,parseFrame_schema:()=>{const f=parseFrame(str);schema(f,shape==='call'?'guest':'host');return 1;},encode_validated:()=>encode(obj).length};
 if(shape==='call')ops.codec_args_roundtrip=()=>parse(JSON.stringify(obj.args)).length;
 if(shape!=='call')ops.codec_reply_roundtrip=()=>Object.keys(JSON.parse(stringify(obj))).length;
 for(const [op,fn]of Object.entries(ops))for(let sample=-3;sample<31;sample++){const t=process.hrtime.bigint();for(let i=0;i<n;i++)sink+=fn();const us=Number(process.hrtime.bigint()-t)/1000/n;if(sample>=0)rows.push({shape,bytes:wire.length,op,sample,n,us});}
}
// Same per-call bounded dispatcher state; session setup excluded from timed intervals.
for(const name of ['one','parallel10','result64k'])for(let sample=-3;sample<31;sample++){
 const batch=name==='parallel10'?10:1,n=name==='result64k'?50:500;let us=0;
 for(let i=0;i<n;i++){let got=0;const d=new Dispatcher({kill:f=>{throw Error(f.code);},message:()=>got++});d.feed(Buffer.from('{"t":"ready","v":1}\n'));d.send({t:'run',code:'',ns:{api:['echo']}},()=>true);
  const calls=Array.from({length:batch},(_,i)=>Buffer.from(JSON.stringify({...one,id:i+1})+'\n'));
  const replies=Array.from({length:batch},(_,i)=>({...name==='result64k'?large:ret,id:i+1}));
  const t=process.hrtime.bigint();for(const call of calls)d.feed(call);for(const reply of replies)d.send(reply,()=>true);us+=Number(process.hrtime.bigint()-t)/1000;sink+=got;
 }if(sample>=0)rows.push({shape:name,op:'dispatcher_feed_send_batch',sample,n,us:us/n,batch});
}
writeFileSync('/tmp/sofort-a4/raw/node-components.json',JSON.stringify({node:process.version,loadBefore,loadAfter:uptime(),rows,sink},null,2)+'\n');console.log('node component samples',rows.length);
