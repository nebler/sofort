import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {Dispatcher,ProtocolError,LIMIT,encode,parseFrame,parseHostJson,schema} from './dispatcher.ts';
const here=fileURLToPath(new URL('.',import.meta.url));
const ready={t:'ready',v:1},run={t:'run',code:'return 1',ns:{api:['echo']}};
const call=id=>({t:'call',id,ns:'api',fn:'echo',args:[]});
function fixture(start=true) {
  const events=[],kills=[],kernels=[];
  const d=new Dispatcher({message:m=>events.push(m),kill:f=>kills.push(f.code),kernel:s=>kernels.push(s)});
  if(start){d.feed(encode(ready));d.send(run,()=>true);events.length=0;}
  return {d,events,kills,kernels};
}
function outcome(fn) {try{fn();return 'ACCEPT';}catch(e){assert(e instanceof ProtocolError);return e.code;}}
function corpus() {
 const vectors=JSON.parse(readFileSync(here+'vectors.json','utf8'));let runs=0;
 for(const v of vectors.cases) for(const fragment of [false,true]) {
  const {d,kills}=fixture(false);
  const step=s=>{
   if(s.repeat){for(let i=0;i<s.repeat;i++)step(s.step);return;}
   if(s.eof){d.eof();return;}
   if(s.dir==='host'){d.send(s.frame,()=>true);return;}
   const wire=Buffer.from(s.wire,'utf8');
   if(fragment){for(let i=0;i<wire.length;i+=1+(i%31))d.feed(wire.subarray(i,i+1+(i%31)));}
   else d.feed(wire);
  };
  const actual=outcome(()=>v.steps.forEach(step));
  assert.equal(actual,v.expected,`${v.name} fragmented=${fragment}`);
  if(actual==='ACCEPT'){if(v.state)assert.equal(d.snapshot().state,v.state);assert.equal(kills.length,0);}
  else {assert.equal(kills.length,1);assert.notEqual(outcome(()=>d.feed(encode(ready))),'ACCEPT');assert.equal(kills.length,1);}
  runs++;
 }
 return {cases:vectors.cases.length,runs};
}
function boundaries() {
 let f=fixture(); f.d.feed(encode(call(1)));
 const before=f.d.snapshot();assert.equal(f.d.send({t:'ret',id:1,ok:1},()=>false),false);
 assert.deepEqual(f.d.snapshot(),before);assert(f.d.send({t:'ret',id:1,ok:1},()=>true));assert.equal(f.d.snapshot().outstanding,0);
 f=fixture();for(let i=1;i<=4096;i++){f.d.feed(encode(call(i)));f.d.send({t:'ret',id:i,ok:null},()=>true);}
 assert.equal(f.d.snapshot().next,4097);assert.equal(outcome(()=>f.d.feed(encode(call(4097)))),'ID');
 // Exact maximum encoded frame is accepted; next byte is refused before growth.
 f=fixture();const base=JSON.stringify({t:'done',ok:''});const max=Buffer.from(base.slice(0,-2)+'x'.repeat(LIMIT.frame-base.length)+'"}\n');
 assert.equal(max.length,LIMIT.frame+1);assert.equal(outcome(()=>f.d.feed(max)),'ACCEPT');
 f=fixture();assert.equal(outcome(()=>f.d.feed(Buffer.alloc(LIMIT.frame+1,32))),'FRAME_LIMIT');assert.equal(f.d.snapshot().capacity,0);
 f=fixture(false);assert.equal(outcome(()=>f.d.feed(new Uint8Array(LIMIT.wire+1))),'WIRE_LIMIT');assert.equal(f.d.snapshot().inBytes,0);
 f=fixture();for(let i=0;i<17;i++){const x=outcome(()=>f.d.feed(Buffer.from('\x1e'+'x'.repeat(4096)+'\n').subarray()));assert.equal(x,'ACCEPT');}
 f.d.cancel('DEADLINE');f.d.cancel();assert.deepEqual(f.kills,['DEADLINE']);
 // Forged intent reaches the policy callback as data, never implicit capability authority.
 f=fixture();f.d.feed(encode({...call(1),ns:'__proto__',fn:'constructor'}));assert.equal(f.events.length,1);
 assert.equal({}.admin,undefined);
 // Raw DEL must fail both decoder entry points; escaped DEL is valid data.
 assert.equal(outcome(()=>parseFrame('{"t":"done","ok":"\x7f"}')),'ASCII');
 assert.equal(outcome(()=>parseFrame('{"t":"done","ok":"\\u007f"}')),'ACCEPT');
 assert.equal(new TextDecoder().decode(encode({t:'done',ok:'\x7f'})), '{"t":"done","ok":"\\u007f"}\n');
 const built=readFileSync(here+'dispatcher.js','utf8');
 assert(built.includes('c>126') || built.includes('c > 126'));
 return {checks:14,consecutiveCalls:4096,maxFrameBytes:LIMIT.frame};
}
function fuzz() {
 let seed=0x3c0ffee;const rand=n=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)%n;};
 const seeds=[JSON.stringify(call(1)),JSON.stringify({t:'log',level:'info',msg:'hello'}),JSON.stringify({t:'done',ok:{x:[true,null,'\\u1234']}})];
 let accepted=0,rejected=0;
 for(let n=0;n<25000;n++) {
  let s=seeds[rand(seeds.length)];
  for(let k=0,edits=1+rand(4);k<edits;k++) {
   const p=rand(s.length+1),b=String.fromCharCode(rand(256));
   switch(rand(5)) {
    case 0:s=s.slice(0,p)+b+s.slice(p);break;
    case 1:s=s.slice(0,p)+s.slice(p+1);break;
    case 2:s=s.slice(0,p)+b+s.slice(p+1);break;
    case 3:s=s.slice(0,p)+s.slice(p,p+1).repeat(1+rand(12))+s.slice(p);break;
    case 4:s=s.slice(0,p)+'"\\u0074":"call",'+s.slice(p);break;
   }
  }
  const wire=Buffer.from(s+'\n','latin1');
  const a=fixture(),b=fixture();
  const aa=outcome(()=>a.d.feed(wire));
  const bb=outcome(()=>{for(let i=0;i<wire.length;){const take=1+rand(13);b.d.feed(wire.subarray(i,i+take));i+=take;}});
  // Multiple invalid rules can differ with earlier chunk dispatch; here one frame
  // mutations can insert LF, so compare accept/reject and valid event prefixes.
  assert.equal(aa==='ACCEPT',bb==='ACCEPT',`fragment divergence ${n}`);
  assert.deepEqual(a.events,b.events,`event divergence ${n}`);
  for(const f of [a,b]) {
   const st=f.d.snapshot();assert(st.capacity<=LIMIT.frame);assert(st.buffered<=LIMIT.frame);
   assert(st.outstanding<=64);assert(st.inflight<=LIMIT.inflight);assert(f.kills.length<=1);
   if(f.kills.length){assert.equal(st.state,'dead');assert.equal(st.buffered,0);assert.notEqual(outcome(()=>f.d.feed(encode(call(2)))),'ACCEPT');assert.equal(f.kills.length,1);}
  }
  if(aa==='ACCEPT')accepted++;else rejected++;
 }
 return {mutations:25000,chunkDifferentialRuns:50000,accepted,rejected,seed:'0x3c0ffee'};
}
// Directional structure budget: a guest frame over LIMIT.structure values is
// rejected before JSON.parse; a host reply of the same shape (a real tool reply
// can hold 38,746 values) is bounded only by the frame limit.
{
 const wide=JSON.stringify({ok:Array.from({length:LIMIT.structure},(_,i)=>i%10)});
 assert(wide.length<LIMIT.frame);
 assert.throws(()=>parseFrame(wide),e=>e instanceof ProtocolError&&e.code==='STRUCTURE');
 assert.equal(parseHostJson(wide).ok.length,LIMIT.structure);
 assert.throws(()=>parseHostJson(JSON.stringify({ok:'x'.repeat(LIMIT.frame)})),e=>e instanceof ProtocolError&&e.code==='FRAME_LIMIT');
 let deep='0';for(let i=0;i<LIMIT.depth+1;i++)deep='['+deep+']';
 assert.throws(()=>parseHostJson(deep),e=>e instanceof ProtocolError&&e.code==='DEPTH');
}
const result={node:process.execPath,version:process.version,uptime:execFileSync('/usr/bin/uptime',{encoding:'utf8'}).trim(),corpus:corpus(),boundaries:boundaries(),fuzz:fuzz()};
const output=here+(process.env.JITK_RECORD==='1'?'':'.work/');
mkdirSync(output,{recursive:true});
writeFileSync(output+'test-results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
