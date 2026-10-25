import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {selectBackend} from './select-backend.js';
const selection=selectBackend();
const loadBefore=execFileSync('/usr/bin/uptime',[],{encoding:'utf8'}).trim();
const s=await selection.backend.park();
try {
  const rows=execFileSync('/bin/ps',['-axo','pid=,ppid=,comm='],{encoding:'utf8'}).trim().split('\n');
  const child=rows.map(line=>line.trim().split(/\s+/)).find(([pid,ppid,...cmd])=>Number(ppid)===process.pid&&!cmd.join(' ').includes('python')&&Number(pid)!==process.pid);
  if(!child)throw Error('VM child PID not found');
  const pid=child[0];
  const cpu=()=>{
    const time=execFileSync('/bin/ps',['-o','time=','-p',pid],{encoding:'utf8'}).trim().split(':').map(Number);
    return time.reduce((n,x)=>n*60+x,0);
  };
  const before=cpu(),start=performance.now();
  await new Promise(resolve=>setTimeout(resolve,10000));
  const delta=cpu()-before,elapsed=(performance.now()-start)/1000;
  const result={selection:selection.selection,pid,loadBefore,loadAfter:execFileSync('/usr/bin/uptime',[],{encoding:'utf8'}).trim(),elapsedSeconds:elapsed,cpuSeconds:delta,idleCorePercent:delta/elapsed*100};
  writeFileSync(selection.backend.kind==='jitk'?'jitk-idle.json':'local-idle.json',JSON.stringify(result,null,2)+'\n');console.log(result);
}finally{s.kill();await s.exited;}
