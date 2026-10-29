// MCP `run` input decoding; the JNR8 framing and the native Engine are
// executor/native-check.ts (needs the built executor).
import assert from 'node:assert/strict';
import {nativeJob, createNativeRunner} from './native.mjs';
const runner = await createNativeRunner(undefined, 1000);
const limits = runner.limits;
const job = nativeJob({tool:'lua',args:['-e','print(2)'],files:{'data/binary':'AP+A'}}, limits);
assert.equal(job.kind,'native');assert.equal(job.profile,'lua');assert.deepEqual([...job.files['data/binary']],[0,255,128]);
for(const files of [{a:'not base64'}, {a:'AA='}, {a:1}, [], Object.fromEntries(Array.from({length:limits.files+1},(_,i)=>[`f${i}`,'AA==']))]) {
  assert.throws(()=>nativeJob({tool:'lua',files}, limits));
}
assert.equal((await runner.run({tool:'lua'})).error.code,'UNSUPPORTED');await runner.close();
console.log('native MCP input/validation: 8 cases passed');
