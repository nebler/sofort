// Run from executor/ after build. Fail closed if any shared input changes.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {selectBackend} from './build/select-backend.js';
// Certification is an explicit recording action; its child checks refresh evidence.
process.env.JITK_RECORD='1';
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
rmSync('.READY',{force:true});
const selected=selectBackend();assert(selected.integrated,'canonical VMM and kernel .READY required');
const selection=JSON.parse(readFileSync('integration-selection.json','utf8'));
assert(existsSync('policy/policy.mjs'),'canonical 07 policy required');
const paths=[...Object.keys(JSON.parse(readFileSync('build/inputs.json','utf8'))),selection.host.path,selection.image.path,'../protocol/bootstrap.js','policy/policy.mjs','../vmm/src/watchdog.rs','policy/policy-test.mjs','fixtures/parking-gate.json'];
const before=Object.fromEntries(paths.map(p=>[p,hash(p)]));
for(const file of ['pool-check','resolve-check','sandbox-check','transport-check','watchdog-check','verify','wrapper-conformance','api-check','policy-check','hyperlight-check','demo','breakdown']){
 console.log('CERTIFY '+file);
 execFileSync(process.execPath,['build/'+file+'.js'],{stdio:'inherit',timeout:file==='breakdown'?240000:120000});
}
for(const [p,digest] of Object.entries(before))assert.equal(hash(p),digest,'artifact changed during certification: '+p);
selectBackend();const after=JSON.parse(readFileSync('integration-selection.json','utf8'));
assert(after.integrated);assert.equal(after.host.sha256,selection.host.sha256);assert.equal(after.image.sha256,selection.image.sha256);
const evidence=JSON.parse(readFileSync('breakdown-results.json','utf8'));assert(evidence.integrated&&evidence.n>=50);
assert.equal(evidence.artifacts.host.sha256,selection.host.sha256);assert.equal(evidence.artifacts.image.sha256,selection.image.sha256);
writeFileSync('.READY',JSON.stringify({status:'PASS',at:new Date().toISOString(),...selection,inputs:before,
 tests:'20 executor + Cloudflare/TanStack + 30x64 calls + 22 security policy + 22 executor policy + 6 Hyperlight + lifecycle/ack/hostile/watchdog',
 timings:'breakdown-results.json',n:evidence.n},null,2)+'\n');
console.log('READY: final integrated executor certification passed');
