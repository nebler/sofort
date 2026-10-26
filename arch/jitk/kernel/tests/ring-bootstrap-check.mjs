// Host-side check of kernel/ring-bootstrap.js call bookkeeping with a mock `os`.
// The real script stops at os.snapshotCheckpoint(); everything before it is the
// call path under test.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function load({failWrites=new Set()}={}) {
  const writes=[];
  const os={
    write(fd,buffer,offset,length){writes.push(fd);return failWrites.has(fd)?-5:length;},
    read(){return -11;},
    setReadHandler(){},
    snapshotCheckpoint(){throw Error('stop at checkpoint');},
  };
  const context=vm.createContext({os});
  const source=readFileSync(new URL('../ring-bootstrap.js',import.meta.url),'utf8');
  assert.throws(()=>vm.runInContext(source,context),/stop at checkpoint/);
  return {echo:context.echo,writes};
}

{ // An oversized call must not consume an ID: the next call uses fd 129.
  const {echo,writes}=load();
  await assert.rejects(echo('x'.repeat(2000)),/call bytes/);
  echo('small');
  assert.deepEqual(writes,[129]);
}
{ // A failed write rejects (not throws inside the executor) and keeps its ID consumed.
  const {echo,writes}=load({failWrites:new Set([129])});
  await assert.rejects(echo('a'),/CALL failed/);
  echo('b');
  assert.deepEqual(writes,[129,130]);
}
console.log(JSON.stringify({suite:'ring-bootstrap',status:'PASS',checks:2}));
