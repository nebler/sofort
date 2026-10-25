// Shard-only prepared profile. Stock static Bellard QuickJS, std/os event loop.
// Small JSON-only echo capability; deliberately no timers or policy authority.
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const pending=new Map(), source=new ArrayBuffer(8192), repair=new ArrayBuffer(32);
let next=1;
function encode(v) {
  const s=JSON.stringify(v).replace(/[\u007f-\uffff]/g,
    c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
  const b=new Uint8Array(s.length);
  for(let i=0;i<s.length;i++) b[i]=s.charCodeAt(i);
  return b;
}
function decode(b,n) { return String.fromCharCode(...b.subarray(0,n)); }
function finish(ok,value) {
  const b=encode(ok?{ok:value===undefined?null:value}:{err:{name:String(value.name),message:String(value.message)}});
  if(os.write(102,b.buffer,0,b.length)!==b.length) throw Error('FINISH failed');
}
function echo(...args) {
  if(next>32) return Promise.reject(Error('call budget'));
  const id=next++, b=encode(args);
  if(b.length>1024) return Promise.reject(Error('call bytes'));
  return new Promise((resolve,reject)=>{
    pending.set(id,{resolve,reject,buffer:new ArrayBuffer(1024)});
    if(os.write(128+id,b.buffer,0,b.length)!==b.length) throw Error('CALL failed');
  });
}
os.setReadHandler(0,()=>{
  for(const [id,p] of pending) {
    const n=os.read(128+id,p.buffer,0,1024);
    if(n===-11) continue;
    pending.delete(id);
    if(n<0) p.reject(Error('RET failed'));
    else p.resolve(JSON.parse(decode(new Uint8Array(p.buffer),n)));
  }
});
// Dedicated checkpoint: QuickJS, helpers and bootstrap initialized; no run input.
os.write(100,source,0,0);
if(globalThis.__tenantCanary!==undefined) throw Error('snapshot leak');
if(os.read(101,repair,0,32)!==32) throw Error('repair failed');
const rb=new Uint8Array(repair), dv=new DataView(repair);
const run=Object.freeze({generation:String(dv.getBigUint64(0,true)),
  entropy:Array.from(rb.subarray(8,24),b=>b.toString(16).padStart(2,'0')).join(''),
  epoch:String(dv.getBigUint64(24,true))});
const n=os.read(0,source,0,8192);
try {
  const body=new AsyncFunction('tools','run','"use strict";\n'+decode(new Uint8Array(source),n));
  Promise.resolve(body(Object.freeze({echo}),run)).then(v=>finish(true,v),e=>finish(false,e));
} catch(e) { finish(false,e); }
