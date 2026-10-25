import {performance} from 'node:perf_hooks';
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {Dispatcher,encode} from './dispatcher.ts';
const uptime=()=>execFileSync('/usr/bin/uptime',{encoding:'utf8'}).trim();
const pct=(xs,p)=>{const s=[...xs].sort((a,b)=>a-b);return p===.5 && s.length%2===0?(s[s.length/2-1]+s[s.length/2])/2:s[Math.ceil(s.length*p)-1];};
const points=[];
for(const bytes of [1024,102400]) {
 const count=bytes===1024?100:16;
 const frames=Array.from({length:count},(_,j)=>{
  const m={t:'call',id:j+1,ns:'api',fn:'echo',args:['']};
  m.args[0]='x'.repeat(bytes-JSON.stringify(m).length);return encode(m);
 });
 // Warm only the same bounded full decoder path; every session respects budgets.
 const samples=[];const loadBefore=uptime();
 for(let sample=-3;sample<30;sample++) {
  const d=new Dispatcher({kill:f=>{throw Error(f.code);},message:()=>{}});
  d.feed(encode({t:'ready',v:1}));d.send({t:'run',code:'',ns:{api:['echo']}},()=>true);
  let ms=0;
  for(let j=0;j<count;j++) {
   const t=performance.now();d.feed(frames[j]);ms+=performance.now()-t;
   d.send({t:'ret',id:j+1,ok:null},()=>true);
  }
  d.feed(encode({t:'done',ok:null}));d.eof();
  if(sample>=0)samples.push(count/(ms/1000));
 }
 points.push({frameBytesExcludingLF:bytes,framesPerSample:count,n:30,uptimeBefore:loadBefore,uptimeAfter:uptime(),
  framesPerSecond:{p50:pct(samples,.5),p90:pct(samples,.9),p99:pct(samples,.99)},
  perFrameUs:{p50:pct(samples.map(x=>1e6/x),.5),p90:pct(samples.map(x=>1e6/x),.9),p99:pct(samples.map(x=>1e6/x),.99)},samples});
}
const result={node:process.execPath,version:process.version,method:'incremental Dispatcher.feed (scan, ASCII/depth/duplicate/JSON/schema/state/budgets and callback); host ret serialization excluded; 3 warmups; no budget bypass',points};
writeFileSync(new URL('dispatcher-bench.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
