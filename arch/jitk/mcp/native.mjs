// Persistent Linux arm64 ring worker. No native executable runs on the host.
import {spawn} from 'node:child_process';

const MAX_INPUT = 4 * 1024 * 1024, MAX_OUTPUT = 1024 * 1024;
const failure = (code, message) => ({error: {code, message}});
export function encodeRun({tool, args = [], files = {}}) {
  if (typeof tool !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(tool)) throw Error('invalid tool profile');
  if (!Array.isArray(args) || args.length > 31 || args.some(a => typeof a !== 'string' || a.includes('\0') || !a.isWellFormed()))
    throw Error('args must contain at most 31 scalar strings without NUL');
  if (!files || typeof files !== 'object' || Array.isArray(files) || Object.keys(files).length > 64) throw Error('files must contain at most 64 paths');
  const parts = [Buffer.from('JNR7')];
  const u16 = n => { const b = Buffer.alloc(2); b.writeUInt16LE(n); parts.push(b); };
  const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32LE(n); parts.push(b); };
  const text = s => { const b = Buffer.from(s); u16(b.length); parts.push(b); };
  if ([tool, ...args].reduce((n, a) => n + Buffer.byteLength(a) + 1, 0) > 8192) throw Error('argv exceeds 8192 bytes');
  text(tool); u16(args.length + 1); for (const a of [tool, ...args]) text(a);
  u16(Object.keys(files).length);
  let bytes = 0;
  for (const [path, value] of Object.entries(files)) {
    const components = path.split('/');
    if (!path.isWellFormed() || path.includes('\0') || Buffer.byteLength(path) > 1024 || components.length > 16 ||
        components.some(c => !c || c === '.' || c === '..' || Buffer.byteLength(c) > 255)) throw Error('invalid relative input path');
    if (typeof value !== 'string' || value.length > Math.ceil(MAX_INPUT / 3) * 4) throw Error('file contents must be canonical base64');
    const data = Buffer.from(value, 'base64');
    if (data.toString('base64') !== value) throw Error('file contents must be canonical base64');
    bytes += data.length;
    if (bytes > MAX_INPUT) throw Error('input files exceed 4 MiB');
    text(path); u32(data.length); parts.push(data);
  }
  const size = parts.reduce((n, p) => n + p.length, 0);
  if (size > MAX_INPUT + 16384) throw Error('native request exceeds wire budget');
  const head = Buffer.alloc(4); head.writeUInt32LE(size);
  return Buffer.concat([head, ...parts], size + 4);
}

export function createNativeRunner(config, timeoutMs) {
  const unavailable = process.platform !== 'linux' || process.arch !== 'arm64' || !config;
  if (unavailable) return {
    async run() { return failure('UNSUPPORTED', 'Native byte-stream tools require the Linux arm64 KVM ring backend and configured prepared profiles; macOS v1 uses libkrun for execute.'); },
    async close() {},
  };
  const profiles = Object.entries(config.profiles ?? {});
  if (!config.binary || profiles.length < 1 || profiles.length > 16 || profiles.some(([p, b]) => !/^[A-Za-z0-9_-]{1,64}$/.test(p) || typeof b !== 'string'))
    throw Error('native config requires binary and 1..16 tool: snapshot-base profiles');
  const child = spawn(config.binary, ['native-worker', ...profiles.map(([name, base]) => `${name}=${base}`)], {stdio: ['pipe', 'pipe', 'pipe']});
  child.stderr.resume(); // No guest stream travels on worker stderr.
  let active, dead = false, closing;
  const complete = value => {
    if (!active) return;
    clearTimeout(active.timer); active.signal?.removeEventListener('abort', active.abort);
    const resolve = active.resolve; active = undefined; resolve(value);
  };
  const stop = (code, message) => { dead = true; child.kill('SIGKILL'); complete(failure(code, message)); };
  child.once('error', () => { dead = true; complete(failure('SANDBOX', 'Native worker could not start')); });
  child.once('exit', () => { dead = true; complete(failure('SANDBOX', 'Native worker exited before completion')); });
  child.stdin.on('error', () => stop('SANDBOX', 'Native worker IPC closed'));
  child.stdout.on('data', data => {
    if (!active || active.bytes.length + data.length > MAX_OUTPUT + 24) return stop('SANDBOX', 'Native response budget');
    active.bytes = Buffer.concat([active.bytes, data]);
    const b = active.bytes;
    if (b.length < 4) return;
    const n = b.readUInt32LE(0);
    if (n < 20 || n > MAX_OUTPUT + 20 || b.length > n + 4) return stop('SANDBOX', 'Invalid native response length');
    if (b.length !== n + 4) return;
    const status = b.readUInt32LE(4), exitCode = b.readUInt32LE(8), out = b.readUInt32LE(12), err = b.readUInt32LE(16), limited = b.readUInt32LE(20);
    if (status === 1 && n <= 532) return complete(failure('SANDBOX', b.subarray(24).toString('utf8')));
    if (status !== 0 || exitCode > 255 || limited > 1 || out + err !== n - 20) return stop('SANDBOX', 'Invalid native completion');
    complete({stdout: {encoding: 'base64', data: b.subarray(24, 24 + out).toString('base64')},
      stderr: {encoding: 'base64', data: b.subarray(24 + out).toString('base64')}, exitCode, outputLimited: limited === 1});
  });
  return {
    async run(input, signal) {
      if (dead) return failure('SANDBOX', 'Native worker is stopped; restart the MCP server');
      if (signal?.aborted) return failure('CANCELLED', 'Native run cancelled');
      if (active) return failure('LIMIT', 'Native worker is busy');
      if (!Object.hasOwn(config.profiles, input?.tool)) return failure('UNSUPPORTED', 'Unknown prepared native tool profile');
      let request;
      try { request = encodeRun(input); } catch (e) { return failure('LIMIT', e.message); }
      return new Promise(resolve => {
        const abort = () => stop('CANCELLED', 'Native run cancelled; worker stopped');
        const timer = setTimeout(() => stop('TIMEOUT', 'Native deadline expired; worker stopped'), timeoutMs);
        active = {resolve, signal, abort, timer, bytes: Buffer.alloc(0)};
        signal?.addEventListener('abort', abort, {once: true});
        if (signal?.aborted) return abort();
        child.stdin.write(request);
      });
    },
    close() { return closing ??= new Promise(resolve => { if (dead) return resolve(); child.once('exit', resolve); stop('CANCELLED', 'MCP server closed'); }); },
  };
}
