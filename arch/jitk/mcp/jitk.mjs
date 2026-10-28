// jitk core for MCP: config -> warm SandboxPool + MicroVMExecutor + policy-declared
// host tools. No MCP types here, so bench.mjs can time the same path in-process.
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createNativeRunner} from './native.mjs';

const build = new URL('../executor/build/', import.meta.url);

export const defaultConfig = new URL('./jitk-mcp.json', import.meta.url).pathname;

export async function loadConfig(path = process.env.JITK_MCP_CONFIG || defaultConfig) {
  const raw = JSON.parse(readFileSync(path, 'utf8')), base = dirname(resolve(path));
  const cfg = {timeoutMs: 10000, warm: 2, maxLive: 8, providers: [], resources: './resources', ...raw};
  for (const k of ['timeoutMs', 'warm', 'maxLive'])
    if (!Number.isInteger(cfg[k]) || cfg[k] < 0) throw Error(`config ${k}: non-negative integer required`);
  const tools = Object.create(null);
  for (const p of cfg.providers) {
    const mod = (await import(pathToFileURL(resolve(base, p)).href)).default;
    for (const [ns, fns] of Object.entries(mod)) {
      if (Object.hasOwn(tools, ns)) throw Error(`config: namespace ${ns} declared twice`);
      tools[ns] = fns;
    }
  }
  if (cfg.native) {
    cfg.native = {...cfg.native, binary: resolve(base, cfg.native.binary),
      profiles: Object.fromEntries(Object.entries(cfg.native.profiles ?? {}).map(([name, path]) => [name, resolve(base, path)]))};
  }
  return {...cfg, tools, resources: resolve(base, cfg.resources)};
}

// Executor error strings -> stable codes. Order matters; the executor reports
// deadline expiry as exactly this string and caller aborts the same way.
const TIMEOUT = 'Execution aborted or timed out';
export function classify(error, cancelled) {
  if (error === TIMEOUT) return cancelled ? 'CANCELLED' : 'TIMEOUT';
  if (/policy denied|approval required/.test(error)) return 'POLICY';
  if (/limit|budget|saturated|overloaded|out of memory|stack overflow/i.test(error)) return 'LIMIT';
  if (/sandbox exited|protocol [A-Z_]+|invalid frame|unknown frame/.test(error)) return 'SANDBOX';
  return 'GUEST_ERROR';
}

export async function createJitk(cfg) {
  if (cfg.execute === false) {
    const native = createNativeRunner(cfg.native, cfg.timeoutMs);
    return {
    selection: 'execute disabled; native Linux KVM ring profiles', warmed: Promise.resolve(),
    run: async () => ({error: {code: 'UNSUPPORTED', message: 'execute backend disabled by server configuration'}, logs: []}),
    runNative: (input, signal) => native.run(input, signal), close: () => native.close(),
    };
  }
  const {MicroVMExecutor, SandboxPool} = await import(new URL('executor.js', build).href);
  const {selectBackend} = await import(new URL('select-backend.js', build).href);
  const selected = selectBackend();
  if (cfg.warm && !selected.gate) throw Error('warm pool needs G1 parking evidence (see executor/README.md) or "warm": 0');
  const native = createNativeRunner(cfg.native, cfg.timeoutMs);
  const inner = selected.backend;
  // Refill on every VM exit, not only after a run: the watchdog's lifetime bound
  // (60 s) also reaps idle parked VMs, and the next execute must still find one parked.
  // warm() is idempotent and bounded by warm/maxLive/refillConcurrency.
  const backend = {kind: inner.kind, memoryLimitMB: inner.memoryLimitMB, close: () => inner.close?.(), async park(signal, deadline) {
    const s = await inner.park(signal, deadline);
    void s.released.then(() => refill());
    return s;
  }};
  const pool = new SandboxPool(backend, cfg.warm, Math.max(cfg.maxLive, cfg.warm, 1), {parkingGate: selected.gate});
  let closing = false;  // close() aborts in-flight boots; those failures are expected
  const refill = () => pool.warm().catch(e => closing || process.stderr.write(`jitk-mcp: refill failed: ${e}\n`));
  // The 07 policy layer (security.tools) admits every call; the second-level callback adds nothing.
  const executor = new MicroVMExecutor(pool, () => 'allow', cfg.timeoutMs, {tools: cfg.tools});
  // Guest stubs need namespace/function names only; declared Tool.invoke runs instead.
  const unreachable = async () => { throw Error('declared Tool.invoke is used'); };
  const providers = Object.entries(cfg.tools ?? {}).map(([name, fns]) =>
    ({name, fns: Object.fromEntries(Object.keys(fns).map(fn => [fn, unreachable]))}));
  // One throwaway run JIT-compiles the executor path: the first client execute
  // otherwise costs ~7-10 ms instead of ~3 ms. Its VM is refilled like any other.
  const warmed = refill().then(() => executor.execute('return 0', providers)).then(() => refill());
  return {
    pool, executor, providers, selection: selected.selection, warmed,
    async run(code, signal) {
      const r = await executor.execute(code, providers, {signal});
      if (r.error === undefined) return {result: r.result ?? null, logs: r.logs};
      return {error: {code: classify(r.error, signal?.aborted === true), message: r.error}, logs: r.logs};
    },
    runNative: (input, signal) => native.run(input, signal),
    close: () => { closing = true; return Promise.all([pool.close(), native.close()]); },
  };
}

// One line per guest function, for the MCP tool description.
export const describeTools = tools => Object.entries(tools).flatMap(([ns, fns]) =>
  Object.entries(fns).map(([fn, t]) => `- ${ns}.${t.signature ?? fn + '(...)'}${t.description ? ' — ' + t.description : ''}`)).join('\n');
