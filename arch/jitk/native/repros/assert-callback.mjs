import assert from 'node:assert/strict';
const check=(fn,m)=>assert.throws(fn,Error,m);
check(()=>{throw Error('expected');},'throws');
