// MCP `run`: native jobs on the executor's native Engine (executor/native-backend.ts,
// the persistent ring worker: shard `real native-worker` on Linux arm64 KVM,
// `hvf native-worker` on macOS arm64 HVF). No native executable runs on the host.
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
  if (!['linux', 'darwin'].includes(process.platform) || process.arch !== 'arm64' || !config) return {
    limits: NATIVE_LIMITS,
    async run() { return failure('UNSUPPORTED', 'Native byte-stream tools require the arm64 ring worker (Linux KVM `real`, macOS HVF `hvf`) and configured prepared profiles.'); },
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
