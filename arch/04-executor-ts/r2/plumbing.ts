import {JitkBackend} from './backend.js';
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const backend=new JitkBackend('/tmp/jitk-01/r2/jitk-vmm',{launcher:'01-vmm',image:'/tmp/jitk-02/kernel.bin',memoryLimitMB:64});
const loadBefore=execFileSync('/usr/bin/uptime',[],{encoding:'utf8'}).trim(),rows:any[]=[];
for(let i=0;i<30;i++) {
  const start=performance.now();
  try {const s=await backend.park();s.kill();await s.exited;throw Error('unexpected protocol-v1 READY from round1 image');}
  catch(e){rows.push({ms:performance.now()-start,error:String(e)});}
}
const samples=rows.map(r=>r.ms).sort((a,b)=>a-b);
const ps=execFileSync('/bin/ps',['-axo','pid=,ppid=,comm='],{encoding:'utf8'}).trim().split('\n');
const remainingChildren=ps.filter(line=>{const [pid,ppid,...cmd]=line.trim().split(/\s+/);return Number(ppid)===process.pid&&!cmd.join(' ').endsWith('/ps');});
if(remainingChildren.length)throw Error('child processes remain: '+remainingChildren.join(','));
const result={label:'01 panic=abort Rust VMM + 02 round1 image; spawn/fail-closed/reap plumbing ONLY; not G3',loadBefore,loadAfter:execFileSync('/usr/bin/uptime',[],{encoding:'utf8'}).trim(),n:rows.length,median:samples[14],p90:samples[26],p99:samples[29],remainingChildren,rows};
writeFileSync('plumbing-results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,rows:undefined},null,2));
