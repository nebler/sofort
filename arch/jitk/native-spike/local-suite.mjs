// Compile executable entries from the existing executor test suite.
import {spawnSync} from 'node:child_process';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {writeFileSync} from 'node:fs';
process.chdir(dirname(fileURLToPath(import.meta.url)));
const names=['prepared-check','pool-check','resolve-check','sandbox-check','transport-check','watchdog-check','verify','wrapper-conformance','api-check','policy-check'];
const mode=process.argv[2];
if(!['node','compile'].includes(mode))throw Error('usage: node local-suite.mjs node|compile');
for(const name of names) {
  const r=mode==='compile'
    ?spawnSync(process.execPath,['probe.mjs','suite-'+name,`.work/adapted/executor/build/${name}.js`],{encoding:'utf8',timeout:200000,maxBuffer:8*1024*1024})
    :spawnSync(process.execPath,[`.work/original/executor/build/${name}.js`],{encoding:'utf8',timeout:90000,maxBuffer:4*1024*1024});
  if(mode==='node') {
    writeFileSync(`.work/logs/node-${name}.log`,r.stdout+'\n'+r.stderr);
    console.log(JSON.stringify({name,status:r.status,signal:r.signal,error:r.error?.message,tail:(r.stdout+'\n'+r.stderr).slice(-700)}));
  }else console.log(r.stdout.slice(0,2500));
}
// Native fixtures using process.execPath must be adapted before executing a
// compiled process-backed test: execPath is the test binary, not a JS runner.
// Compilation is safe; do not mistake it for a passing functional suite.
