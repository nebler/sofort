import {spawnSync, execFileSync} from 'node:child_process';
import {mkdirSync, writeFileSync, existsSync, statSync, rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';
process.chdir(dirname(fileURLToPath(import.meta.url)));
const [name, source, ...flags] = process.argv.slice(2);
if (!name || !source) throw Error('usage: node probe.mjs NAME SOURCE [scriptc flags]');
const disk = execFileSync('/bin/df',['-k','/System/Volumes/Data'],{encoding:'utf8'}).trim().split('\n').at(-1).trim().split(/\s+/);
if (Number(disk[3]) < 15*1024*1024) throw Error('STOP: below 15 GiB available');
mkdirSync('.work/logs',{recursive:true}); mkdirSync('.work/bin',{recursive:true});
const executable = resolve(`.work/bin/${name}`);
rmSync(executable,{force:true}); // A failed rebuild must not leave a runnable stale binary.
const args = ['build',source,'-o',executable,...flags];
const start = Date.now();
const result = spawnSync('./node_modules/.bin/scriptc',args,{encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024,
  env:{...process.env,SCRIPTC_CACHE_DIR:resolve('.work/cache')}});
const record={name,source,args,status:result.status,signal:result.signal,error:result.error?.message,elapsedMs:Date.now()-start,
  bytes: result.status===0 && existsSync(executable) ? statSync(executable).size : null};
writeFileSync(`.work/logs/${name}.log`,result.stdout+'\n'+result.stderr);
writeFileSync(`.work/logs/${name}.json`,JSON.stringify(record,null,2)+'\n');
console.log(JSON.stringify(record));
console.log((result.stdout+'\n'+result.stderr).slice(0,6000));
