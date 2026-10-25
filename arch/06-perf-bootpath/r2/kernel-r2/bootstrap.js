std.out.puts('FIRST\n');std.out.flush();
// Stock QuickJS source module: qjs --memory-limit 16M --stack-size 512K -m bootstrap.js
// Convenience API only: the trusted TS dispatcher validates every guest byte.
// Kernel argv uses --std to supply std and os.

const MAX=1048576, WIRE=16777216, stringify=JSON.stringify.bind(JSON), parse=JSON.parse.bind(JSON);
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const pending=new Map();
let state='parked', next=1, inflight=0, outputBytes=0, inputBytes=0, outputFrames=0;
let logCount=0, logBytes=0;
function ascii(m) {
  return stringify(m).replace(/[\u007f-\uffff]/g,
    c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
}
function write(s) {
  if (s.length>MAX || outputBytes+s.length+1>WIRE || outputFrames>=8192) throw Error('output budget');
  outputBytes+=s.length+1; outputFrames++;
  std.out.puts(s+'\n'); std.out.flush();
  if (std.out.error()) throw Error('output failure');
}
function stop(status) { state='closed'; os.setReadHandler(0,null); std.exit(status); }
function fatal() { stop(1); } // No seventh message kind; malformed host input closes.
function finish(ok,value) {
  if (state!=='running') return;
  try {
    if (ok && pending.size) throw Error('unawaited calls at completion');
    write(ascii(ok?{t:'done',ok:value===undefined?null:value}:
      {t:'done',err:{name:String(value && value.name || 'Error').slice(0,128),
        message:String(value && value.message || value).slice(0,4096)}}));
    stop(0);
  } catch(e) {
    try { write(ascii({t:'done',err:{name:'SerializationError',message:String(e).slice(0,1024)}})); }
    finally { stop(1); }
  }
}
function rpc(ns,fn,args) {
  if (state!=='running' || pending.size>=64 || next>4096) return Promise.reject(Error('call budget'));
  let wire;
  try {
    wire=ascii({t:'call',id:next,ns,fn,args});
    if (wire.length>MAX || inflight+wire.length+1>2097152) throw Error('call byte budget');
  } catch(e) { return Promise.reject(e); }
  const id=next;
  return new Promise((resolve,reject)=> {
    try { write(wire); }
    catch(e) { reject(e); fatal(); return; }
    next++; inflight+=wire.length+1; pending.set(id,{resolve,reject,bytes:wire.length+1});
  });
}
function proxy(ns,fns) {
  const allowed=new Set(fns);
  return new Proxy(Object.create(null),{get:(_,fn)=>
    typeof fn==='string' && fn!=='then' && allowed.has(fn)?(...args)=>rpc(ns,fn,args):undefined});
}
function clip(s,n) {
  s=s.slice(0,n); const c=s.charCodeAt(s.length-1);
  return c>=0xd800 && c<=0xdbff?s.slice(0,-1):s;
}
const logger=level=>(...args)=> {
  if (state!=='running' || logCount>=1024 || logBytes>=262144) return;
  let msg='';
  for (const arg of args) {
    let part;
    try { part=typeof arg==='string'?arg:stringify(arg); } catch { part='[unserializable]'; }
    msg=clip(msg+(msg?' ':'')+String(part),Math.min(512,262144-logBytes));
    if (msg.length>=512) break;
  }
  const wire=ascii({t:'log',level,msg});
  if (outputBytes+wire.length+1>WIRE-8192 || outputFrames>=8190) return;
  logCount++; logBytes+=msg.length;
  try { write(wire); } catch { fatal(); }
};
globalThis.console=Object.freeze(Object.fromEntries(['log','info','warn','error','debug'].map(k=>[k,logger(k)])));
globalThis.print=logger('log');
globalThis.setTimeout=(fn,ms,...args)=>os.setTimeout(()=>fn(...args),ms);
globalThis.clearTimeout=os.clearTimeout;

function receive(m) {
  if (m.t==='run' && state==='parked') {
    if (typeof m.code!=='string' || m.code.length>65536 || !m.ns || typeof m.ns!=='object' || Array.isArray(m.ns)) throw Error('run schema');
    const names=Object.keys(m.ns);
    if (names.length>64 || names.some(n=>!/^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/.test(n) || !Array.isArray(m.ns[n]))) throw Error('namespace schema');
    state='running';
    try {
      // Lexical parameters avoid mutating globalThis or building JS declarations.
      const body=new AsyncFunction(...names,'"use strict";\n'+m.code);
      Promise.resolve(body(...names.map(n=>proxy(n,m.ns[n])))).then(v=>finish(true,v),e=>finish(false,e));
    } catch(e) { finish(false,e); }
    return;
  }
  if (state!=='running' || m.t!=='ret' || !Number.isSafeInteger(m.id)) throw Error('response state');
  const p=pending.get(m.id);
  if (!p || Object.hasOwn(m,'ok')===Object.hasOwn(m,'err')) throw Error('response id/schema');
  pending.delete(m.id); inflight-=p.bytes;
  if (Object.hasOwn(m,'ok')) p.resolve(m.ok);
  else {
    if (!m.err || typeof m.err.code!=='string' || typeof m.err.message!=='string') throw Error('ret error schema');
    const e=Error(m.err.message); e.code=m.err.code; p.reject(e);
  }
}
// One raw read per readiness callback. Never mix stdio getline/read-ahead with ppoll.
const storage=new ArrayBuffer(16384), bytes=new Uint8Array(storage);
let line='', size=0;
os.setReadHandler(0,()=> {
  try {
    const n=os.read(0,storage,0,bytes.length);
    if (n<=0 || inputBytes+n>WIRE) throw Error('EOF/read/input budget');
    inputBytes+=n;
    let start=0;
    for (let i=0;i<n;i++) {
      const b=bytes[i];
      if (b===10) {
        if (size+i-start>MAX) throw Error('input frame limit');
        line+=String.fromCharCode(...bytes.subarray(start,i));
        const frame=line; line=''; size=0; start=i+1;
        receive(parse(frame));
      } else if (b<32 || b>126) throw Error('input ASCII');
      else if (size+i-start+1>MAX) throw Error('input frame limit');
    }
    size+=n-start;
    if (start<n) line+=String.fromCharCode(...bytes.subarray(start,n));
  } catch { fatal(); }
});
write(ascii({t:'ready',v:1}));
