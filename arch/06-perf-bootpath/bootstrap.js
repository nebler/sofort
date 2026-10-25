import * as std from 'std';
__benchStamp('first');
let seq = 0;
function call(ns, fn, args) {
  const id = seq++;
  std.out.puts(JSON.stringify({t:'call',id,ns,fn,args})+'\n');
  std.out.flush();
  const reply = JSON.parse(std.in.getline());
  if (reply.id !== id || reply.err) throw new Error('tool response failed');
  return Promise.resolve(reply.ok);
}
globalThis.tools = new Proxy({}, {get:(_,ns)=>new Proxy({}, {get:(_,fn)=>(args)=>call(ns,fn,args)})});
globalThis.console = Object.fromEntries(['log','warn','error','info','debug'].map(level=>[level,(...args)=>{}]));
__benchStamp('ready');
globalThis.__finish = result => { std.out.puts(JSON.stringify({t:'done',result})+'\n'); std.out.flush(); __benchStamp('done'); };
const snippet = std.in.getline();
(0,eval)(snippet);
