import assert from 'node:assert/strict';
import {encodeRun, createNativeRunner} from './native.mjs';
const wire = encodeRun({tool:'lua',args:['-e','print(2)'],files:{'data/binary':'AP+A'}});
assert.equal(wire.readUInt32LE(),wire.length-4);assert.equal(wire.subarray(4,8).toString(),'JNR7');
for(const input of [ {tool:'../bad'}, {tool:'lua',args:['a\0b']}, {tool:'lua',args:['\ud800']},
  {tool:'lua',args:Array(32).fill('x')}, {tool:'lua',args:['x'.repeat(8192)]},
  ...['../a','/a','a//b','a\0b'].map(p=>({tool:'lua',files:{[p]:'AA=='}})),
  {tool:'lua',files:{a:'not base64'}}, {tool:'lua',files:{a:'AA='}}, {tool:'lua',files:{a:'AA=='.repeat(5)}} ]) {
  assert.throws(()=>encodeRun(input));
}
const runner=createNativeRunner(undefined,1000);
assert.equal((await runner.run({tool:'lua'})).error.code,'UNSUPPORTED');await runner.close();
console.log('native MCP framing/validation: 13 cases passed');
