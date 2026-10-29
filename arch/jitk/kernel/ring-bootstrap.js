// Shard-only prepared profile. Native RNG repair, Bellard QuickJS std/os loop.
// Small JSON-only echo capability and one-way console lines; timers are the
// os loop's (the kernel's ppoll deadline wakes through the host); no policy authority.
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
// One record buffer for the source and every reply fragment.
const pending=new Map(), record=new ArrayBuffer(8+16352);
const bytes=new Uint8Array(record), view=new DataView(record);
// Saved before CHECKPOINT: the native hook must repair this same context.
const preparedRandom=Math.random;
let next=1, inflight=0;
// JSON as printable ASCII bytes (\uXXXX past 0x7e), written straight into the
// buffer: no escaped copy of the text, which the arena may not hold twice.
function encode(v) {
  const s=JSON.stringify(v);
  let n=s.length;
  for(let i=0;i<s.length;i++) if(s.charCodeAt(i)>0x7e) n+=5;
  const b=new Uint8Array(n);
  for(let i=0,o=0;i<s.length;i++) {
    const c=s.charCodeAt(i);
    if(c<0x7f) { b[o++]=c; continue; }
    const h=c.toString(16).padStart(4,'0');
    b[o++]=92; b[o++]=117;
    for(let k=0;k<4;k++) b[o++]=h.charCodeAt(k);
  }
  return b;
}
function decode(b,at,n) {
  let s='';
  for(let i=0;i<n;i+=4096) s+=String.fromCharCode(...b.subarray(at+i,at+Math.min(n,i+4096)));
  return s;
}
function finish(ok,value) {
  let b=encode(ok?{ok:value===undefined?null:value}:{err:{name:String(value.name),message:String(value.message)}});
  // As protocol/bootstrap.js: a completion over the frame bound ends as a SerializationError.
  if(b.length>1048576) b=encode({err:{name:'SerializationError',message:'Error: output budget'}});
  if(os.write(102,b.buffer,0,b.length)!==b.length) throw Error('FINISH failed');
}
function echo(...args) {
  // Check every local limit before taking a call ID, so a rejected call
  // cannot shift the ID (and fd) of the next one. The bounds are
  // protocol/bootstrap.js's.
  if(next>4096||pending.size>=64) return Promise.reject(Error('call budget'));
  const b=encode(args);
  if(b.length>1048576) return Promise.reject(Error('call bytes'));
  if(inflight+b.length>2097152) return Promise.reject(Error('call byte budget'));
  const id=next++;
  return new Promise((resolve,reject)=>{
    pending.set(id,{resolve,reject,bytes:b.length,parts:[]});
    inflight+=b.length;
    // A failed write keeps its ID consumed: the host may have seen part of it.
    if(os.write(128+id,b.buffer,0,b.length)!==b.length) {
      pending.delete(id);
      inflight-=b.length;
      reject(Error('CALL failed'));
    }
  });
}
let logs=0;
function log(level,message) {
  if(logs>=1024) return;
  logs++;
  const b=encode([level,message]);
  os.write(103,b.buffer,0,b.length);
}
// Timers as protocol/bootstrap.js's: os timers wake the guest's ppoll.
globalThis.setTimeout=(fn,ms,...args)=>os.setTimeout(()=>fn(...args),ms);
globalThis.clearTimeout=os.clearTimeout;
globalThis.setInterval=(fn,ms,...args)=>{
  const h={};
  const tick=()=>{h.t=os.setTimeout(tick,ms);fn(...args);};
  h.t=os.setTimeout(tick,ms);
  return h;
};
globalThis.clearInterval=h=>{if(h&&h.t!==undefined)os.clearTimeout(h.t);};
os.setReadHandler(0,()=>{
  for(;;) {
    const n=os.read(104,record,0,record.byteLength);
    if(n===-11) return;
    const id=view.getUint32(0,true), p=pending.get(id);
    if(n<8||!p) throw Error('RET failed');
    const ok=view.getUint16(4,true)===2, more=view.getUint16(6,true)&2;
    // Out of memory (the arena class) fails this call, not the event loop:
    // its remaining records are still read and dropped.
    if(!p.error) try { p.parts.push(decode(bytes,8,n-8)); } catch(e) { p.error=e; p.parts=[]; }
    if(more) continue;
    pending.delete(id);
    inflight-=p.bytes;
    if(p.error) p.reject(p.error);
    else if(!ok) p.reject(Error('RET failed'));
    else try { p.resolve(JSON.parse(p.parts.join(''))); } catch(e) { p.reject(e); }
  }
});
// Dedicated checkpoint: QuickJS, helpers and bootstrap initialized; no run input.
const repair=os.snapshotCheckpoint();
if(globalThis.__tenantCanary!==undefined) throw Error('snapshot leak');
if(repair.byteLength!==48) throw Error('repair failed');
const rb=new Uint8Array(repair), dv=new DataView(repair);
const run=Object.freeze({generation:String(dv.getBigUint64(0,true)),
  entropy:Array.from(rb.subarray(8,24),b=>b.toString(16).padStart(2,'0')).join(''),
  epoch:String(dv.getBigUint64(24,true)),
  libcEntropy:Array.from(rb.subarray(32,48),b=>b.toString(16).padStart(2,'0')).join('')});
// The SOURCE message, UTF-8: the run body, then optionally NUL and its `data`
// text (the executor binds tenant code as data: executor/shard-backend.ts
// shardWire). read(0) blocks for each record and returns 0 at its end. One
// streaming decode, so the arena holds the text once.
let text='', data, units=[], need=0, cp=0;
const put=s=>{
  if(data===undefined) {
    const z=s.indexOf('\0');
    if(z<0) { text+=s; return; }
    text+=s.slice(0,z); data=''; s=s.slice(z+1);
  }
  data+=s;
};
const flush=()=>{ if(units.length) { put(String.fromCharCode(...units)); units=[]; } };
for(let n;(n=os.read(0,record,0,record.byteLength))>0;) {
  for(let i=0;i<n;i++) {
    const c=bytes[i];
    if(need) { cp=cp<<6|c&63; if(--need) continue; }
    else if(c<0x80) cp=c;
    else if(c>=0xf0) { cp=c&7; need=3; continue; }
    else if(c>=0xe0) { cp=c&15; need=2; continue; }
    else { cp=c&31; need=1; continue; }
    if(cp===0&&data===undefined) { flush(); data=''; continue; }
    if(cp<0x10000) units.push(cp);
    else { cp-=0x10000; units.push(0xd800|cp>>10,0xdc00|cp&1023); }
    if(units.length>=4096) flush();
  }
}
flush();
try {
  const body=new AsyncFunction('tools','run','data','"use strict";\n'+text);
  text='';
  const input=data; data=undefined;
  Promise.resolve(body(Object.freeze({echo,log}),run,input)).then(v=>finish(true,v),e=>finish(false,e));
} catch(e) { finish(false,e); }
