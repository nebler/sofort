import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {IDENTITY_VERSION,helperHash,fileHash,verifyPreparedSnapshot} from './prepared-helpers.mjs';
import {ABI_VERSION} from './abi.js';
import {executionBody} from './code.js';
import {shardSource} from './shard-backend.js';
import {sourceChecks} from './shard-source-check.js';
const root=mkdtempSync(join(tmpdir(),'jitk-prepared-')),base=join(root,'snapshot');
try {
  const stale=/stale shard snapshot: prepared helper identity mismatch/;
  assert.throws(()=>verifyPreparedSnapshot(base,ABI_VERSION),stale);
  for(const ext of ['mem','regs','layout'])writeFileSync(base+'.'+ext,'fixture '+ext);
  const identity={version:IDENTITY_VERSION,abiVersion:ABI_VERSION,helperSha256:helperHash,files:Object.fromEntries(['mem','regs','layout'].map(ext=>[ext,fileHash(base+'.'+ext)]))};
  writeFileSync(base+'.identity',JSON.stringify({...identity,helperSha256:'0'.repeat(64)}));
  assert.throws(()=>verifyPreparedSnapshot(base,ABI_VERSION),stale);
  // A snapshot prepared for another ABI version is refused, naming both versions.
  writeFileSync(base+'.identity',JSON.stringify({...identity,abiVersion:ABI_VERSION-1}));
  assert.throws(()=>verifyPreparedSnapshot(base,ABI_VERSION),new RegExp(`prepared for ABI version ${ABI_VERSION-1}, the executor speaks ${ABI_VERSION}`));
  writeFileSync(base+'.identity',JSON.stringify({...identity,version:1}));
  assert.throws(()=>verifyPreparedSnapshot(base,ABI_VERSION),stale);
  writeFileSync(base+'.identity',JSON.stringify(identity));verifyPreparedSnapshot(base,ABI_VERSION);
  writeFileSync(base+'.mem','different checkpoint');
  assert.throws(()=>verifyPreparedSnapshot(base,ABI_VERSION),/shard snapshot identity mismatch: mem/);
  const providers=[{name:'codemode',fns:{echo:async(x:unknown)=>x}}];
  const code='return (await codemode.echo(41))+1';
  const prepared=executionBody(code,providers,true),legacy=executionBody(code,providers);
  assert.ok(!prepared.includes('function stringify')&&!prepared.includes('installBase64'));
  assert.ok(legacy.includes('function stringify')&&legacy.includes('installBase64'));
  const source=shardSource({t:'run',code:prepared,ns:{codemode:['echo']}});
  assert.ok(Buffer.byteLength(source)<600,`minimal binding: ${source.length}`);
  console.log(JSON.stringify({suite:'prepared',status:'PASS',checks:10+await sourceChecks(),sourceBytes:source.length,legacyBodyBytes:legacy.length,helperHash}));
} finally {rmSync(root,{recursive:true,force:true});}
