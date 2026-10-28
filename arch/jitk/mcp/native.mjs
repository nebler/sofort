// MCP `run`: native jobs on the executor's native Engine (executor/native-backend.ts,
// the persistent Linux arm64 ring worker). No native executable runs on the host.
const build = new URL('../executor/build/', import.meta.url);
const failure = (code, message) => ({error: {code, message}});
const base64 = bytes => ({encoding: 'base64', data: Buffer.from(bytes).toString('base64')});

/** MCP input -> NativeJob: canonical base64 file contents become bytes. */
export function nativeJob({tool, args = [], files = {}}, limits) {
  if (!files || typeof files !== 'object' || Array.isArray(files) || Object.keys(files).length > limits.files)
    throw Error(`files must contain at most ${limits.files} paths`);
  const decoded = Object.create(null);
  for (const [path, value] of Object.entries(files)) {
    if (typeof value !== 'string' || value.length > Math.ceil(limits.inputBytes / 3) * 4) throw Error('file contents must be canonical base64');
    const data = Buffer.from(value, 'base64');
    if (data.toString('base64') !== value) throw Error('file contents must be canonical base64');
    decoded[path] = data;
  }
  return {kind: 'native', profile: tool, args, files: decoded};
}

export async function createNativeRunner(config, timeoutMs) {
  const {NativeBackend, NativeExecutor, NATIVE_LIMITS, SandboxPool} = await import(new URL('executor.js', build).href);
  if (process.platform !== 'linux' || process.arch !== 'arm64' || !config) return {
    limits: NATIVE_LIMITS,
    async run() { return failure('UNSUPPORTED', 'Native byte-stream tools require the Linux arm64 KVM ring backend and configured prepared profiles; macOS v1 uses libkrun for execute.'); },
    async close() {},
  };
  const engine = new NativeBackend({binary: config.binary, profiles: config.profiles});
  // One worker, one session: concurrent runs wait in the pool's FIFO queue.
  const pool = new SandboxPool(engine, 0, engine.limits.sessions);
  const executor = new NativeExecutor(pool, timeoutMs);
  return {
    limits: engine.limits.native,
    async run(input, signal) {
      let job;
      try { job = nativeJob(input, engine.limits.native); } catch (e) { return failure('LIMIT', e.message); }
      const r = await executor.run(job, {signal});
      if ('error' in r) return r;
      return {stdout: base64(r.stdout), stderr: base64(r.stderr), exitCode: r.exitCode, outputLimited: r.outputLimited};
    },
    close: () => pool.close(),
  };
}
