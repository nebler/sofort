import {spawn,execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {Dispatcher} from './head/arch/jitk/protocol/dispatcher.js';
const vmm='/tmp/sofort-a4/bin/jitk-vmm',image='/tmp/sofort-a4/baseline-images/kernel.bin';
const script=String.raw`
const rows=[];let sink=0;
const sets=[['call',{t:'call',id:1,ns:'api',fn:'echo',args:['x']},20000],['reply',{t:'ret',id:1,ok:'x'},20000],['reply64k',{t:'ret',id:1,ok:'x'.repeat(65536)},50],['replyUnicode',{t:'ret',id:1,ok:'\u00e9\ud83d\ude00'.repeat(100)},1000]];
const clock=typeof os.now==='function'?os.now:Date.now;
for(const [shape,obj,n]of sets){const str=JSON.stringify(obj);const ops={json_encode:()=>JSON.stringify(obj).length,json_decode:()=>Object.keys(JSON.parse(str)).length,ascii_replace:()=>str.replace(/[\u007f-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0')).length,ascii_encode:()=>JSON.stringify(obj).replace(/[\u007f-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0')).length};
for(const [op,fn]of Object.entries(ops))for(let sample=-3;sample<31;sample++){const t=clock();for(let i=0;i<n;i++)sink+=fn();const us=(clock()-t)*1000/n;if(sample>=0)rows.push({shape,op,sample,n,us,chars:str.length});}}
return {clock:typeof os.now==='function'?'os.now':'Date.now',rows,sink};`;
const loadBefore=execFileSync('/usr/bin/uptime',{encoding:'utf8'}).trim();
const child=spawn(vmm,['--image',image,'--mem-mib','32'],{stdio:'pipe'});let stderr='',result;child.stderr.on('data',b=>stderr+=b);
const d=new Dispatcher({kill:f=>{child.kill('SIGKILL');throw Error(f.code);},message:m=>{if(m.t==='ready')d.send({t:'run',code:script,ns:{}},wire=>child.stdin.write(wire));if(m.t==='done')result=m;}});
child.stdout.on('data',b=>d.feed(b));await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>code===0?resolve():reject(Error('vmm '+code+' '+stderr)));});
if(!result||result.err)throw Error(JSON.stringify(result));writeFileSync('/tmp/sofort-a4/raw/qjs-components.json',JSON.stringify({loadBefore,loadAfter:execFileSync('/usr/bin/uptime',{encoding:'utf8'}).trim(),vmm,image,...result.ok},null,2)+'\n');console.log('qjs component samples',result.ok.rows.length);
