import {spawn, spawnSync} from 'node:child_process';
import {existsSync, writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
process.chdir(dirname(fileURLToPath(import.meta.url)));
const summary=[];
for(const name of process.argv.slice(2)) {
  if(!existsSync('.work/bin/'+name)) { console.log(`${name}: no binary`); continue; }
  let r;
  if(name==='signals') {
    r=await new Promise(resolve=>{
      const child=spawn('./.work/bin/'+name,[],{stdio:['ignore','pipe','pipe']});
      let stdout='',stderr='';let sent=false;
      const timer=setTimeout(()=>child.kill('SIGKILL'),5000);
      child.stdout.on('data',b=>{stdout+=b;if(!sent && stdout.includes('ready')){sent=true;child.kill('SIGTERM');}});
      child.stderr.on('data',b=>stderr+=b);
      child.on('close',(status,signal)=>{clearTimeout(timer);resolve({status,signal,stdout,stderr});});
    });
  } else {
    r=spawnSync('./.work/bin/'+name,[],{encoding:'utf8',timeout:15000,maxBuffer:2*1024*1024,
      input:name.startsWith('mcp-stdio')?'\u007b"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}\n':undefined});
  }
  const record={name,status:r.status,signal:r.signal,error:r.error?.message,stdout:r.stdout,stderr:r.stderr};
  writeFileSync(`.work/logs/${name}.run.json`,JSON.stringify(record,null,2)+'\n');
  summary.push(record); console.log(JSON.stringify(record).slice(0,2400));
}
