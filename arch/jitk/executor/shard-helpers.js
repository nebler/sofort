// Evaluated by the offline preparer before CHECKPOINT, never injected per run.
// Every object/closure here belongs to restored guest memory, including globals
// deliberately writable by tenant code. No helper state survives slot reset.
installBase64();
const PreparedAsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
// The arena holds big values once (shard/README.md "Limits"): a tool result
// is fresh from the ring reply's JSON.parse, so codec.mjs parse(JSON.stringify
// (v)), a second and third copy, becomes the same binary revival in place;
// the completion stays JSON text, handed to the ring bootstrap as is.
// (JSON.parse objects own every key, "__proto__" too, so assignment sets it.)
const revive=v=>{
  if(!v||typeof v!=='object')return v;
  if(Array.isArray(v)){for(let i=0;i<v.length;i++){const x=v[i],y=revive(x);if(y!==x)v[i]=y;}}
  else for(const k of Object.keys(v)){const x=v[k],y=revive(x);if(y!==x)v[k]=y;}
  if(tag in v&&typeof v.data==='string'){
    const binary=atob(v.data),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));return v[tag]==='ArrayBuffer'?bytes.buffer:bytes;
  }
  return v;
};
// A completion's JSON text from codec(), for run() to give the transport.
class Serialized{constructor(text){this.text=text;}}
globalThis.__jitkPrepared={
  // `code` is the START source's data (executor/shard-backend.ts shardWire):
  // the tenant body, its "use strict" directive included. Compiled here, as
  // data, with the console and namespaces as its parameters.
  source(transport,code,names) {
    return this.run(transport,new PreparedAsyncFunction('console',...names,code),names);
  },
  async codec(descriptors,body,wire) {
    const providers=descriptors.map(([name,allowed])=>new Proxy(Object.create(null),{
      get:(t,k)=>Object.hasOwn(t,k)?t[k]:k!=='then'&&allowed.includes(k)?async(...a)=>revive(await wire[name][k](...JSON.parse(stringify(a)))):undefined
    }));
    const result=await body(...providers);
    const text=stringify(result===undefined?null:result);
    // What JSON.parse(text) would throw for a value with no JSON (a function).
    if(typeof text!=='string')JSON.parse(text);
    return new Serialized(text);
  },
  async run(transport,body,names) {
    // Open calls; `settled` resolves when the last one settles. (No
    // Promise.allSettled: at the outstanding bound its extra promise per call
    // does not fit the glue-2m arena.)
    const pending=new Set();
    let settled;
    const forget=p=>{pending.delete(p);if(!pending.size&&settled)settled();};
    const call=(ns,fn,args)=>{
      const p=transport.echo('call',ns,fn,args).then(r=>{
        if(Object.hasOwn(r,'err')){const e=new Error(r.err.message);e.code=r.err.code;throw e;}
        return r.ok;
      },e=>{
        // The ring bootstrap refuses a CALL over ring::CALL_BYTES before it
        // takes an id: the same typed LIMIT tool error as an oversized reply.
        if(e&&e.message==='call bytes'){const l=new Error('shard tool call limit (1048576 bytes)');l.code='LIMIT';throw l;}
        throw e;
      });
      pending.add(p);p.then(()=>forget(p),()=>forget(p));return p;
    };
    // Logs as protocol/bootstrap.js's logger: JSON per argument, String() of
    // the result (so undefined prints), a placeholder for unserializable
    // values, each line clipped to LIMIT.log UTF-8 bytes, lines past
    // LIMIT.logs or LIMIT.logBytes dropped. They are one-way CONSOLE
    // messages with their own budget, not calls.
    let count=0,total=0;
    const utf8=s=>{let n=0;for(const c of s){const p=c.codePointAt(0);n+=p<128?1:p<2048?2:p<65536?3:4;}return n;};
    const clip=(s,n)=>{
      let bytes=0,out='';
      for(const c of s){
        const p=c.codePointAt(0),size=p<128?1:p<2048?2:p<65536?3:4;
        // The host counts a lone surrogate as U+FFFD; send that.
        if(bytes+size>n)break;
        bytes+=size;out+=p>=0xd800&&p<=0xdfff?'�':c;
      }
      return out;
    };
    const part=x=>{if(typeof x==='string')return x;try{return String(JSON.stringify(x));}catch{return '[unserializable]';}};
    const console=Object.fromEntries(['log','info','warn','error','debug'].map(level=>[level,(...a)=>{
      if(count>=1024||total>=262144)return;
      let msg='';
      for(const x of a){msg=clip(msg+(msg?' ':'')+part(x),Math.min(4096,262144-total));if(utf8(msg)>=4096)break;}
      const n=utf8(msg);if(total+n>262144)return;
      count++;total+=n;
      transport.log(level,msg);
    }]));
    const providers=names.map(name=>new Proxy(Object.create(null),{get:(_t,k)=>k==='then'?undefined:(...a)=>call(name,k,a)}));
    try {
      const result=await body(console,...providers);
      if(pending.size)throw Error('unawaited calls at completion');
      return result instanceof Serialized?transport.json(result.text):result;
    } catch(e) {
      throw {name:String(e&&e.name||'Error').slice(0,128),message:String(e&&e.message||e).slice(0,4096)};
    } finally {if(pending.size)await new Promise(r=>{settled=r;});}
  }
};
