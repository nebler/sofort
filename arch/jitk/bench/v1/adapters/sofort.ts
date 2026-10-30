// Sofort (SPEC-V1 §2): MicroVMExecutor + SandboxPool on selectBackend()'s
// ring engine, from executor/build (make -C arch/jitk/executor build). One
// adapter per engine and memory class (shard/README.md "Limits"):
//   sofort-hvf-{2m,4m,8m,16m}  macOS arm64, Hypervisor.framework engine
//   sofort-kvm-{2m,4m,8m,16m}  Linux arm64, KVM shard
// The class picks JITK_SHARD_CLASS and a snapshot of that class:
// JITK_SHARD_SNAPSHOT_GLUE_<N>M when set, else JITK_SHARD_SNAPSHOT
// if it is that class, else `deps env` with JITK_SHARD_CLASS set (JITK_DEPS,
// default arch/jitk/tools/.work/bin/deps).
//
// Pool: maxLive = engine slots = max(concurrency, 1) (HVF: JITK_HVF_SLOTS;
// KVM: JITK_SHARD_SLOTS, at most 64). Warm parking is off on Linux (warm 0:
// every acquire takes a reset slot; there is no parked VM to wake) and on the
// Mac unless a parking-gate receipt matches this engine and snapshot, as
// MCP's default does (selectBackend().gate). Policy: allow every declared
// tool (the bench measures the executor, not the policy's denials).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Adapter, BenchExecutor, BenchResult, ErrorClass, OpenOptions, ResolvedProvider } from '../harness/contract.ts';

// The parts of executor/build this adapter uses (executor.ts, pool.ts,
// select-backend.ts); typed here so bench/v1's typecheck stays off executor sources.
type Policy = () => 'allow';
interface RunResult { result: unknown; error?: string; logs?: string[]; errorCode?: string }
interface Backend { close?(): Promise<void>; ready?: Promise<void> }
interface ExecutorModule {
  SandboxPool: new (backend: Backend, warm: number, maxLive: number, options?: { parkingGate?: unknown }) => { warm(): Promise<void>; close(): Promise<void> };
  MicroVMExecutor: new (pool: unknown, policy: Policy, timeout: number) => {
    execute(code: string, providers: ResolvedProvider[] | Record<string, (...a: unknown[]) => Promise<unknown>>): Promise<RunResult>;
  };
}
interface SelectModule { selectBackend(): { backend: Backend; gate?: { evidence: string }; selection: string } }
const build = new URL('../../../executor/build/', import.meta.url);
const jitk = fileURLToPath(new URL('../../../', import.meta.url));

function sha256(path: string): string {
  return existsSync(path) ? createHash('sha256').update(readFileSync(path)).digest('hex') : 'missing';
}

function snapshotFor(cls: string): string {
  const explicit = process.env['JITK_SHARD_SNAPSHOT_' + cls.toUpperCase().replace('-', '_')];
  if (explicit) return explicit;
  const current = process.env.JITK_SHARD_SNAPSHOT;
  if (current && current.includes(`-${cls}-`)) return current;
  const deps = process.env.JITK_DEPS ?? jitk + 'tools/.work/bin/deps';
  // An explicit JITK_SHARD_SNAPSHOT wins in `deps env`; ask for the class's default.
  const { JITK_SHARD_SNAPSHOT: _, ...rest } = process.env;
  const env = execFileSync(deps, ['env'], { encoding: 'utf8', env: { ...rest, JITK_SHARD_CLASS: cls } });
  const m = env.match(/^export JITK_SHARD_SNAPSHOT='([^']+)'$/m);
  if (!m) throw Error(`no ${cls} snapshot from ${deps} env (make -C arch/jitk/shard snapshot JITK_SHARD_CLASS=${cls})`);
  return m[1]!;
}

function classify(r: { error?: string; errorCode?: string }): ErrorClass | undefined {
  if (r.error === undefined) return undefined;
  switch (r.errorCode) {
    case 'TIMEOUT': return 'timeout';
    case 'LIMIT': return /out of memory|heap|memory/i.test(r.error) ? 'oom' : /overloaded|admission queue/i.test(r.error) ? 'overloaded' : 'limit';
    case 'SANDBOX': return 'sandbox';
    case 'POLICY': return 'limit';
    case 'GUEST_ERROR': return 'guest';
    default: return /overloaded/i.test(r.error) ? 'overloaded' : 'sandbox';
  }
}

const CLASSES = ['glue-2m', 'glue-4m', 'glue-8m', 'glue-16m'] as const;
function sofort(engine: 'hvf' | 'shard', cls: (typeof CLASSES)[number]): Adapter {
  const name = `sofort-${engine === 'hvf' ? 'hvf' : 'kvm'}-${cls.replace('glue-', '')}`;
  let provenance: Record<string, string> = { engine, memoryClass: cls };
  return {
    name,
    isolation: 'microvm',
    where: 'local',
    available() {
      if (engine === 'hvf' && !(process.platform === 'darwin' && process.arch === 'arm64')) return 'needs macOS arm64';
      if (engine === 'shard' && process.platform !== 'linux') return 'needs Linux with KVM';
      if (!existsSync(fileURLToPath(new URL('executor.js', build)))) return 'executor not built (make -C arch/jitk/executor build)';
      if (!process.env.JITK_SHARD_BINARY && engine === 'hvf') return 'JITK_SHARD_BINARY unset (eval "$(arch/jitk/tools/.work/bin/deps env)")';
      return undefined;
    },
    async open(opts: OpenOptions): Promise<BenchExecutor> {
      if (opts.memoryClass && opts.memoryClass !== cls) throw Error(`${name} is ${cls}, not ${opts.memoryClass}`);
      const { MicroVMExecutor, SandboxPool } = (await import(new URL('executor.js', build).href)) as ExecutorModule;
      const { selectBackend } = (await import(new URL('select-backend.js', build).href)) as SelectModule;
      const slots = Math.min(64, Math.max(1, opts.concurrency));
      const snapshot = snapshotFor(cls);
      // selectBackend() reads its configuration from the environment.
      const set: Record<string, string> = {
        JITK_BACKEND: engine, JITK_SHARD_CLASS: cls, JITK_SHARD_SNAPSHOT: snapshot,
        [engine === 'hvf' ? 'JITK_HVF_SLOTS' : 'JITK_SHARD_SLOTS']: String(slots),
      };
      const saved = Object.fromEntries(Object.keys(set).map(k => [k, process.env[k]]));
      Object.assign(process.env, set);
      let selected: ReturnType<SelectModule['selectBackend']>;
      try { selected = selectBackend(); } finally {
        for (const [k, v] of Object.entries(saved)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
      }
      const backend = selected.backend;
      const warm = engine === 'hvf' && selected.gate ? Math.min(2, slots) : 0;
      const pool = warm ? new SandboxPool(backend, warm, slots, { parkingGate: selected.gate }) : new SandboxPool(backend, 0, slots);
      const ex = new MicroVMExecutor(pool, () => 'allow', opts.timeoutMs);
      await backend.ready;
      await pool.warm();
      const binary = process.env.JITK_SHARD_BINARY ?? '';
      provenance = {
        engine, memoryClass: cls, selection: selected.selection, slots: String(slots), warm: String(warm),
        parkingGate: selected.gate?.evidence ?? 'none',
        engineBinary: binary, engineSha256: sha256(binary),
        snapshot, snapshotIdentitySha256: sha256(snapshot + '.identity'),
        executorBuildSha256: sha256(fileURLToPath(new URL('executor.js', build))),
        node: process.version,
      };
      const pids = (): number[] => {
        const b = backend as unknown as { child?: { pid?: number }; processes?: { child?: { pid?: number } }[] };
        return [b.child?.pid, ...(b.processes ?? []).map(p => p.child?.pid)].filter((p): p is number => typeof p === 'number');
      };
      return {
        async execute(code, providersOrFns): Promise<BenchResult> {
          const r = await ex.execute(code, providersOrFns);
          return { ...r, errorClass: classify(r) };
        },
        pids,
        async close() { await pool.close(); await backend.close?.(); },
      };
    },
    provenance: () => provenance,
  };
}

const adapters: Adapter[] = (['hvf', 'shard'] as const).flatMap(engine => CLASSES.map(cls => sofort(engine, cls)));
export default adapters;
