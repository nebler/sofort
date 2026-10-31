// Runs one task program in the reference QuickJS (ws.c), with its tools as
// the Wasm reference had them (working-set.ts): a tool call goes to the
// driver as one stdout line, and its reply comes back as JSON text that is
// parsed here. The text is read from a file the driver writes (REPLY_DIR/ID),
// so a reply is one string, never fragments.
import * as std from 'std';
import * as os from 'os';

const [, programPath, replyDir] = scriptArgs;
const pending = new Map();
let next = 1;
function call(ns, tool, args) {
  const id = next++;
  std.out.puts('C' + JSON.stringify([id, ns, tool, args]) + '\n');
  std.out.flush();
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
const input = new Uint8Array(64);
let line = '';
os.setReadHandler(0, () => {
  const n = os.read(0, input.buffer, 0, input.length);
  if (n <= 0) { os.setReadHandler(0, null); return; }
  line += String.fromCharCode.apply(null, input.subarray(0, n));
  for (let at; (at = line.indexOf('\n')) >= 0;) {
    const id = Number(line.slice(0, at));
    line = line.slice(at + 1);
    const p = pending.get(id);
    pending.delete(id);
    const text = std.loadFile(replyDir + '/' + id);
    if (text[0] === '!') p.reject(Error(text.slice(1)));
    else p.resolve(text);
  }
});
globalThis.console = { log() {}, info() {}, warn() {}, error() {}, debug() {} };
for (const ns of JSON.parse(std.getenv('WS_NAMESPACES'))) {
  globalThis[ns] = new Proxy({}, { get: (_, t) => async (...a) => JSON.parse(await call(ns, t, a)) });
}
const code = std.loadFile(programPath).trim().replace(/;\s*$/, '');
(0, eval)('(' + code + ')')().then(
  v => { std.out.puts('D' + JSON.stringify(v === undefined ? null : v) + '\n'); std.out.flush(); os.setReadHandler(0, null); },
  e => { std.out.puts('E' + JSON.stringify(String(e)) + '\n'); std.out.flush(); os.setReadHandler(0, null); },
);
