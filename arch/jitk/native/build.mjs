// Node is only the build driver. No bundler or runtime npm dependencies.
import {spawnSync,execFileSync} from 'node:child_process';
import {mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
process.chdir(dirname(fileURLToPath(import.meta.url)));
const disk=execFileSync('/bin/df',['-k','/System/Volumes/Data'],{encoding:'utf8'}).trim().split('\n').at(-1).trim().split(/\s+/);
if(Number(disk[3])<15*1024*1024)throw Error('STOP: disk below 15 GiB');
mkdirSync('dist',{recursive:true});mkdirSync('.work',{recursive:true});
const entry=process.argv[2]||'server.ts', output=resolve('dist/'+entry.replace(/.*\//,'').replace(/\.(ts|mjs)$/,''));
rmSync(output,{force:true});
const r=spawnSync('./node_modules/.bin/scriptc',['build',entry,'-o',output],{encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024,env:{...process.env,SCRIPTC_CACHE_DIR:resolve('.work/cache')}});
writeFileSync('.work/build-'+entry.replace(/.*\//,'').replace(/\.(ts|mjs)$/,'')+'.log',r.stdout+'\n'+r.stderr);
console.log((r.stdout+'\n'+r.stderr).slice(0,12000));
if(r.error)console.error(r.error.message);
process.exit(r.status??1);
