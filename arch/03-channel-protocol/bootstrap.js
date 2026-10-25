// QuickJS 2026-06-04. Wire v1: ASCII JSON lines (Unicode uses \uXXXX).
import * as std from 'std';
import * as os from 'os';

const MAX = 1048576, MAX_CALLS = 4096, WINDOW = 64;
const stringify = JSON.stringify.bind(JSON);
const parse = JSON.parse.bind(JSON);
const pending = new Map();
let next = 1, state = 'parked', logBytes = 0, logCount = 0;
function encode(x) {
  return stringify(x).replace(/[\u007f-\uffff]/g,
    c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}
function send(x) {
  const s = encode(x);
  if (s.length > MAX) throw Error('frame too large');
  std.out.puts(s + '\n');
  std.out.flush();
  if (std.out.error()) throw Error('output failed');
}
function stop() { state = 'closed'; os.setReadHandler(0, null); }
function fatal(e) {
  if (state === 'closed') return;
  try { send({t:'fatal', code:'GUEST', message:String(e).slice(0,1024)}); }
  finally { stop(); std.exit(1); }
}
function call(ns, fn, args = null) {
  if (state !== 'running') return Promise.reject(Error('not running'));
  if (pending.size >= WINDOW || next > MAX_CALLS)
    return Promise.reject(Error('call budget/window exceeded'));
  const id = next++;
  return new Promise((resolve, reject) => {
    pending.set(id, {resolve, reject});
    try { send({t:'call', id, ns, fn, args}); }
    catch (e) { pending.delete(id); reject(e); }
  });
}
function provider(ns, fns) {
  const allowed = new Set(fns);
  return new Proxy(Object.create(null), {get: (_, fn) => {
    if (fn === 'then') return undefined; // Never become a thenable.
    if (typeof fn !== 'string' || !allowed.has(fn)) return undefined;
    return args => call(ns, fn, args);
  }});
}
const log = level => (...args) => {
  // Logging is best effort: bounded per record and per execution.
  const text = args.map(x => typeof x === 'string' ? x : stringify(x)).join(' ').slice(0,512);
  const msg = {t:'log', level, text};
  const n = encode(msg).length;
  if (logBytes + n <= 262144 && logCount < 1024) { logBytes += n; logCount++; send(msg); }
};
globalThis.console = Object.freeze(Object.fromEntries(
  ['log','info','warn','error','debug'].map(k => [k, log(k)])));
globalThis.print = log('log');
globalThis.setTimeout = (fn, ms, ...args) => os.setTimeout(() => fn(...args), ms);
globalThis.clearTimeout = os.clearTimeout;

function receive(m) {
  if (m.t === 'code' && state === 'parked') {
    if (typeof m.source !== 'string' || m.source.length > 262144) throw Error('code size');
    for (const p of m.providers) {
      if (!/^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/.test(p.name) || p.name in globalThis)
        throw Error('provider name');
      Object.defineProperty(globalThis, p.name, {value: provider(p.name, p.fns)});
    }
    state = 'running';
    // Body contract: top-level return/await inside an async function, no imports.
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    Promise.resolve(new AsyncFunction(m.source)()).then(
      value => {
        if (pending.size) throw Error('unawaited calls at completion');
        send({t:'done', ok:true, value:value === undefined ? null : value});
        stop(); std.exit(0); // Timers must not keep a single-use VM alive.
      },
      e => { send({t:'done', ok:false, value:String(e).slice(0,1024)}); stop(); std.exit(0); }
    ).catch(fatal);
    return;
  }
  if (state !== 'running' || (m.t !== 'result' && m.t !== 'err')) throw Error('unexpected message');
  const p = pending.get(m.id);
  if (!p) throw Error('unknown response id');
  pending.delete(m.id);
  if (m.t === 'result') p.resolve(m.value);
  else p.reject(Error(m.code + ': ' + m.message));
}

// No std.in.getline(): it is unbounded, blocks on fragments, and stdio read-ahead
// can hide complete frames from the next readiness notification.
const buffer = new ArrayBuffer(16384), bytes = new Uint8Array(buffer);
let fragments = [], size = 0;
os.setReadHandler(0, () => {
  try {
    const n = os.read(0, buffer, 0, bytes.length);
    if (n <= 0) throw Error('EOF/read failure');
    let start = 0;
    for (let i = 0; i < n; i++) {
      if (bytes[i] > 127 || bytes[i] === 13) throw Error('non-ASCII/CR wire');
      if (bytes[i] === 10) {
        size += i - start;
        if (size > MAX) throw Error('frame too large');
        fragments.push(String.fromCharCode(...bytes.subarray(start,i)));
        const line = fragments.join(''); fragments = []; size = 0;
        receive(parse(line)); start = i + 1;
        if (state === 'closed') return;
      }
    }
    size += n - start;
    if (size > MAX) throw Error('frame too large');
    if (start < n) fragments.push(String.fromCharCode(...bytes.subarray(start,n)));
  } catch (e) { fatal(e); }
});
send({t:'hello', v:1});
send({t:'ready'});
