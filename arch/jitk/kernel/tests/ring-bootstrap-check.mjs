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
const FD_FINISH=value(/os\.write\((\d+),b\.buffer,0,b\.length\)!==b\.length\) throw Error\('FINISH failed'\)/), RECEIPT=value(/repair\.byteLength!==(\d+)\)/);

// `records`: the SOURCE message as read(0) returns it; without it the script
// stops at the checkpoint.
function load({failWrites=new Set(),records}={}) {
  const writes=[], replies=[], payloads=[];
  let reader;
  const os={
    write(fd,buffer,offset,length){writes.push(fd);payloads.push(Buffer.from(buffer,offset,length).toString('latin1'));return failWrites.has(fd)?-5:length;},
    // FD_REPLY: the queued records (8-byte prefix + payload), then EAGAIN.
    read(fd,buffer){
      if(fd===0){const r=records.shift();if(!r)return 0;new Uint8Array(buffer).set(r);return r.length;}
      if(fd!==FD_REPLY||!replies.length)return -11;
      const r=replies.shift();new Uint8Array(buffer).set(r);return r.length;
    },
    setReadHandler(fd,f){reader=f;},
    setTimeout(){},clearTimeout(){},
    snapshotCheckpoint(){if(!records)throw Error('stop at checkpoint');return new ArrayBuffer(RECEIPT);},
  };
  const context=vm.createContext({os});
  if(records)vm.runInContext(source,context);
  else assert.throws(()=>vm.runInContext(source,context),/stop at checkpoint/);
  const reply=(id,text,more=false)=>{
    const b=new Uint8Array(8+text.length),v=new DataView(b.buffer);
    v.setUint32(0,id,true);v.setUint16(4,2,true);v.setUint16(6,1|(more?2:0),true);
    for(let i=0;i<text.length;i++)b[8+i]=text.charCodeAt(i);
    replies.push(b);
  };
  return {echo:context.echo,encode:context.encode,writes,payloads,reply,read:()=>reader()};
}
// The byte-wise encoder the bulk one replaced: the wire bytes must not change.
function encodeReference(v) {
  let out='';
  for(const c of JSON.stringify(v).split('').map(u=>u.charCodeAt(0)))out+=c<0x7f?String.fromCharCode(c):'\\u'+c.toString(16).padStart(4,'0');
  return out;
}
const samples=['', 'plain', 'x'.repeat(70000), 'caf\u00e9 \u20ac \u4e2d\u6587 \u{1f600}', '\ud800 lone \udfff', '\u007f\u0080\u00ff\uffff', 'a\u0000b\n"q"\\', '~\u00e9~'];

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
{ // Calls encode to the same printable-ASCII JSON as the byte-wise encoder.
  const {echo,payloads}=load();
  for(const x of samples){echo(x,{k:[x,1.5,null]});assert.equal(payloads.at(-1),encodeReference([x,{k:[x,1.5,null]}]));}
  checks++;
}
{ // Replies decode byte for byte (Latin-1, as the host sends printable ASCII), across fragments.
  const {echo,reply,read}=load();
  const text=JSON.stringify({ok:'\u00e9'+'y'.repeat(9000)}).replace(/[\u007f-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
  const p=echo('r');reply(1,text.slice(0,5000),true);reply(1,text.slice(5000));read();
  assert.equal(JSON.stringify(await p),JSON.stringify(JSON.parse(text)));checks++;
}
{ // SOURCE: UTF-8 split anywhere across records (also inside a sequence) decodes as one text,
  // the first NUL separating the run body from its data.
  const short='\u00e9\u{1f600}\u0000z', long='\u00e9\u20ac\u4e2d\u{1f600}'.repeat(3000)+'a\u0000b'+'z'.repeat(5000);
  for(const [data,size,body] of [[short,1],[short,2],[short,3],[long,4093],[long,4096],[long,16352],[long,16352,'return tools.json(JSON.stringify(data));']]){
    const wire=Buffer.from((body??'return data;')+'\u0000'+data), records=[];
    for(let i=0;i<wire.length;i+=size)records.push(wire.subarray(i,i+size));
    const {payloads,writes}=load({records});
    await new Promise(r=>setImmediate(r));
    assert.equal(writes.at(-1),FD_FINISH);
    assert.equal(payloads.at(-1),encodeReference({ok:data}));
  }
  checks++;
}
{ // A completion as JSON text (tools.json, the prepared helpers' path) is written as the value would be.
  const run=body=>{const wire=Buffer.from(body),records=[];for(let i=0;i<wire.length;i+=16352)records.push(wire.subarray(i,i+16352));const {payloads}=load({records});return new Promise(r=>setImmediate(r)).then(()=>payloads.at(-1));};
  for(const v of samples)assert.equal(await run(`return tools.json(${JSON.stringify(JSON.stringify([v,{k:v}]))})`),encodeReference({ok:[v,{k:v}]}));
  assert.equal(await run('return tools.json(1)'),encodeReference({err:{name:'TypeError',message:'JSON text'}}));
  checks++;
}
assert.ok(CALLS>=OUTSTANDING);
console.log(JSON.stringify({suite:'ring-bootstrap',status:'PASS',checks}));
