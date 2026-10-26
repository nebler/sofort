// Bounded execution; keep raw logs/samples ignored. Sample before killing a hang.
import {spawn,execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
process.chdir(dirname(fileURLToPath(import.meta.url)));
const [name,command,...args]=process.argv.slice(2);
mkdirSync('.work',{recursive:true});
const p=spawn(command,args,{env:process.env,stdio:['ignore','pipe','pipe'],detached:true});
let stdout='',stderr='',timedOut=false;
p.stdout.on('data',b=>{stdout+=b;process.stdout.write(b);});p.stderr.on('data',b=>{stderr+=b;process.stderr.write(b);});
const timer=setTimeout(()=>{
 timedOut=true;
 try{execFileSync('/usr/bin/sample',[String(p.pid),'1','1','-file',resolve('.work/'+name+'.sample')],{timeout:5000,stdio:'ignore'});}catch{}
 try{process.kill(-p.pid,'SIGKILL');}catch{}
},Number(process.env.JITK_TEST_TIMEOUT_MS||90000));
p.on('error',e=>{stderr+=String(e);});
p.on('close',(status,signal)=>{
 clearTimeout(timer);writeFileSync('.work/'+name+'.log',stdout+'\n'+stderr);
 const result={name,status,signal,timedOut};writeFileSync('.work/'+name+'.json',JSON.stringify(result,null,2)+'\n');console.log(result);process.exit(status??1);
});
