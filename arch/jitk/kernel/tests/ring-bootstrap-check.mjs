// Host-side check of kernel/ring-bootstrap.js call bookkeeping with a mock `os`.
// The real script stops at os.snapshotCheckpoint(); everything before it is the
// call path under test.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../ring-bootstrap.js',import.meta.url),'utf8');
// The ABI values the template was expanded with (abi-gen), read back from it.
const value=(re)=>Number(source.match(re)[1]);
const FD_CALL=value(/os\.write\((\d+)\+id/), FD_REPLY=value(/os\.read\((\d+),record/);
const CALLS=value(/next>(\d+)\|\|/), OUTSTANDING=value(/pending\.size>=(\d+)\)/), CALL_BYTES=value(/b\.length>(\d+)\) return Promise\.reject\(Error\('call bytes'\)\)/);

function load({failWrites=new Set()}={}) {
  const writes=[], replies=[];
  let reader;
  const os={
    write(fd,buffer,offset,length){writes.push(fd);return failWrites.has(fd)?-5:length;},
    // FD_REPLY: the queued records (8-byte prefix + payload), then EAGAIN.
    read(fd,buffer){
      if(fd!==FD_REPLY||!replies.length)return -11;
      const r=replies.shift();new Uint8Array(buffer).set(r);return r.length;
    },
    setReadHandler(fd,f){reader=f;},
    setTimeout(){},clearTimeout(){},
    snapshotCheckpoint(){throw Error('stop at checkpoint');},
  };
  const context=vm.createContext({os});
  assert.throws(()=>vm.runInContext(source,context),/stop at checkpoint/);
  const reply=(id,text,more=false)=>{
    const b=new Uint8Array(8+text.length),v=new DataView(b.buffer);
    v.setUint32(0,id,true);v.setUint16(4,2,true);v.setUint16(6,1|(more?2:0),true);
    for(let i=0;i<text.length;i++)b[8+i]=text.charCodeAt(i);
    replies.push(b);
  };
  return {echo:context.echo,writes,reply,read:()=>reader()};
}

let checks=0;
{ // An oversized call must not consume an ID: the next call uses the first call fd.
  const {echo,writes}=load();
  await assert.rejects(echo('x'.repeat(CALL_BYTES)),/call bytes/);
  echo('small');
  assert.deepEqual(writes,[FD_CALL+1]);checks++;
}
{ // A failed write rejects (not throws inside the executor) and keeps its ID consumed.
  const {echo,writes}=load({failWrites:new Set([FD_CALL+1])});
  await assert.rejects(echo('a'),/CALL failed/);
  echo('b');
  assert.deepEqual(writes,[FD_CALL+1,FD_CALL+2]);checks++;
}
{ // At most OUTSTANDING open calls; an answered one frees its place.
  const {echo,reply,read,writes}=load();
  const open=Array.from({length:OUTSTANDING},(_,i)=>echo(i));
  await assert.rejects(echo('over'),/call budget/);
  // A reply's fragments (MORE) join before it is parsed.
  reply(1,'{"ok":',true);reply(1,'7}');read();
  assert.equal(JSON.stringify(await open[0]),'{"ok":7}');
  echo('next');
  assert.equal(writes.at(-1),FD_CALL+OUTSTANDING+1);checks++;
}
assert.ok(CALLS>=OUTSTANDING);
console.log(JSON.stringify({suite:'ring-bootstrap',status:'PASS',checks}));
