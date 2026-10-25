// Development transport, deliberately NOT a security boundary. Production qjs
// must expose only channel I/O; never offer std/os against a host filesystem.
import * as std from 'std';
import * as os from 'os';
import {installBase64,parse,stringify} from './codec.mjs';
installBase64();
const pending = new Map();
let nextId = 0, input = '', ran = false;
function send(m) { std.out.puts(stringify(m) + '\n'); std.out.flush(); }
function rpc(ns, fn, args) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, {resolve, reject});
    send({t:'call', id, ns, fn, args});
  });
}
const console = Object.fromEntries(['log','info','warn','error','debug'].map(level =>
  [level, (...a) => send({t:'log', level, message:a.map(String).join(' ')})]));
globalThis.console = console;
globalThis.setTimeout = os.setTimeout;
globalThis.clearTimeout = os.clearTimeout;
async function receive(m) {
  if (m.t === 'run') {
    if (ran) throw new Error('single use');
    ran = true;
    try {
      const declarations = m.providers.map(p => `const ${p.name}=new Proxy(Object.create(null),{get:(t,f)=>Object.hasOwn(t,f)?t[f]:typeof f==='string'?(...a)=>__rpc(${JSON.stringify(p.name)},f,a):undefined});`).join('\n');
      const aliases = (m.aliases || []).map(name => `const ${name}=(...a)=>__rpc('__bindings',${JSON.stringify(name)},a);`).join('\n');
      const f = new Function('__rpc', 'console', declarations + '\n' + aliases + '\n' + m.providers.map(p=>p.prelude||'').join('\n') + '\nreturn (' + m.code + ');');
      const result = await f(rpc, console);
      send({t:'done', result});
    } catch(e) { send({t:'error', message:String(e)}); }
    std.exit(0);
  } else {
    const p = pending.get(m.id);
    if (!p) throw new Error('unknown response id');
    pending.delete(m.id);
    if (Object.hasOwn(m,'err')) p.reject(new Error(m.err)); else p.resolve(m.ok);
  }
}
// Read bytes directly: mixing std.getline buffering with fd readiness loses
// notifications when several replies arrive in one kernel read.
os.setReadHandler(0, () => {
  const b = new ArrayBuffer(4096), n = os.read(0,b,0,b.byteLength);
  if (n <= 0) std.exit(1);
  input += String.fromCharCode(...new Uint8Array(b,0,n));
  let i;
  while ((i=input.indexOf('\n')) !== -1) {
    const raw=input.slice(0,i); input=input.slice(i+1);
    const utf8=decodeURIComponent(Array.from(raw,c=>'%'+c.charCodeAt(0).toString(16).padStart(2,'0')).join(''));
    receive(parse(utf8)).catch(e=>{send({t:'error',message:String(e)});std.exit(1);});
  }
});
send({t:'ready', version:1});
