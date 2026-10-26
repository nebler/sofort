// Evaluated by the offline preparer before CHECKPOINT, never injected per run.
// Every object/closure here belongs to restored guest memory, including globals
// deliberately writable by tenant code. No helper state survives slot reset.
installBase64();
const PreparedAsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
globalThis.__jitkPrepared={
  source(transport,source,names) {
    return this.run(transport,new PreparedAsyncFunction('console',...names,'"use strict";\n'+source),names);
  },
  async codec(descriptors,body,wire) {
    const providers=descriptors.map(([name,allowed])=>new Proxy(Object.create(null),{
      get:(t,k)=>Object.hasOwn(t,k)?t[k]:k!=='then'&&allowed.includes(k)?async(...a)=>parse(JSON.stringify(await wire[name][k](...JSON.parse(stringify(a))))):undefined
    }));
    const result=await body(...providers);
    return JSON.parse(stringify(result===undefined?null:result));
  },
  async run(transport,body,names) {
    const logs=[],pending=new Set();
    const call=(ns,fn,args)=>{
      const p=transport.echo('call',ns,fn,args).then(r=>{
        if(Object.hasOwn(r,'err')){const e=new Error(r.err.message);e.code=r.err.code;throw e;}
        return r.ok;
      });
      pending.add(p);p.then(()=>pending.delete(p),()=>pending.delete(p));return p;
    };
    const console=Object.fromEntries(['log','info','warn','error','debug'].map(level=>[level,(...a)=>{
      const p=transport.echo('log',level,a.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' '));
      p.catch(()=>{});logs.push(p);
    }]));
    const providers=names.map(name=>new Proxy(Object.create(null),{get:(_t,k)=>k==='then'?undefined:(...a)=>call(name,k,a)}));
    try {
      const result=await body(console,...providers);
      if(pending.size)throw Error('unawaited calls at completion');
      return result;
    } catch(e) {
      throw {name:String(e&&e.name||'Error').slice(0,128),message:String(e&&e.message||e).slice(0,4096)};
    } finally {await Promise.allSettled([...pending]);await Promise.all(logs);}
  }
};
