// Working sets of the task programs (tasks/README.md "Working sets"): how much
// JS heap each program needs to complete, measured three ways.
//
//   quickjs  the smallest QuickJS memory limit (JS_SetMemoryLimit, 16 KiB
//            steps) at which the program completes and its oracle passes, in
//            quickjs-emscripten (Bellard QuickJS in Wasm, from adapters/). Tool
//            replies cross as JSON text and are parsed inside, as the Sofort
//            guest does. This counts QuickJS's own allocations only (no
//            allocator overhead, no fragmentation).
//   v8       the peak of V8's used heap (sampled at every tool call, reply
//            and the end; GC before the run) over the run in this process,
//            minus the heap before it. An upper bound: V8 collects lazily.
//   sofort   the guest arena high-water of a run on the Sofort ring engine
//            (STATS heapPeakBytes: the highest mmap page QuickJS's allocator
//            mapped, plus brk, in the run), and whether the run completed,
//            on the class named by --class (JITK_SHARD_CLASS; default the
//            largest). Needs executor/build and the engine and snapshot from
//            `deps env` (JITK_SHARD_BINARY, JITK_SHARD_SNAPSHOT of that class).
//            With --memory, also the engine's memory after each program's
//            runs (released and reset, one slot): per process, RSS and on
//            macOS the footprint (dirty memory charged to it, `footprint`).
//
//   $JITK_NODE --expose-gc bench/v1/harness/working-set.ts [--engines quickjs,v8,sofort] [--class glue-16m] [--repeat 3] [--memory] [--out file.json] [task-id...]
//
// Prints one JSON line per (engine, program) and a Markdown table at the end.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getHeapStatistics } from 'node:v8';
import type { ResolvedProvider } from './contract.ts';
import { Ledger, Replay } from './replay.ts';
import { type LoadedTask, loadTask } from './task.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const tasksDir = join(here, '../tasks');
const KIB = 1024;

const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = argv.indexOf(name);
  if (i < 0) return undefined;
  const v = argv[i + 1];
  argv.splice(i, 2);
  return v;
};
const engines = (flag('--engines') ?? 'quickjs,v8').split(',');
const sofortClass = flag('--class') ?? process.env.JITK_SHARD_CLASS ?? 'glue-16m';
const repeat = Number(flag('--repeat') ?? 3);
const out = flag('--out');
const memoryAt = argv.indexOf('--memory');
const memory = memoryAt >= 0;
if (memory) argv.splice(memoryAt, 1);
const ids = argv.length ? argv : readdirSync(tasksDir).filter(d => /^t\d-/.test(d) && d !== 't6-sql-incident').sort();

type Row = { engine: string; task: string; program: string; ok: boolean; bytes: number | null; detail?: string; [k: string]: unknown };
const rows: Row[] = [];
function emit(r: Row) {
  rows.push(r);
  console.log(JSON.stringify(r));
}

// --- quickjs-emscripten: bisect the memory limit. ---
type QuickJSModule = {
  newQuickJSWASMModule(): Promise<{
    newRuntime(): {
      setMemoryLimit(n: number): void; setMaxStackSize(n: number): void; executePendingJobs(): { error?: { dispose(): void } };
      newContext(): QuickJSContext; dispose(): void; computeMemoryUsage(): { dispose(): void }; dumpMemoryUsage(): string;
    };
  }>;
};
type Handle = { dispose(): void; alive: boolean };
type QuickJSContext = {
  newFunction(name: string, fn: (...a: Handle[]) => Handle | undefined): Handle;
  newString(s: string): Handle; getString(h: Handle): string; dump(h: Handle): unknown;
  newPromise(): { handle: Handle; resolve(h?: Handle): void; reject(h?: Handle): void; dispose(): void };
  newError(m: string): Handle; setProp(o: Handle, k: string, v: Handle): void; global: Handle;
  evalCode(code: string): { error?: Handle; value?: Handle };
  getProp(o: Handle, k: string): Handle; dispose(): void;
};
const require = createRequire(join(here, '../adapters/package.json'));
// A fresh Wasm module per trial: a runtime that ran out of memory cannot be
// freed cleanly (QuickJS asserts on leaked objects and aborts the module), so
// a trial's module is dropped whole instead of disposed.
const quickjsModule = () => (require('quickjs-emscripten') as QuickJSModule).newQuickJSWASMModule();

/** One run under `limit` bytes: true if it completed and the oracle passed. */
async function quickjsRun(task: LoadedTask, code: string, limit: number): Promise<{ ok: boolean; detail?: string }> {
  const rt = (await quickjsModule()).newRuntime();
  rt.setMaxStackSize(1 << 20);
  // A context cannot be created under a small limit (the module aborts), so
  // the limit applies from the first evaluation; it counts the context too.
  const vm = rt.newContext();
  rt.setMemoryLimit(limit);
  const replay = new Replay(task.spec, task.responses, 0);
  const ledger = new Ledger();
  const fns = new Map(replay.providers(ledger).map(p => [p.name, p.fns]));
  let outstanding = 0;
  let failed: string | undefined;
  try {
    const call = vm.newFunction('__call', (nsH, toolH, argsH) => {
      const ns = vm.getString(nsH), tool = vm.getString(toolH), args = JSON.parse(vm.getString(argsH)) as unknown[];
      const d = vm.newPromise();
      outstanding++;
      Promise.resolve()
        .then(() => fns.get(ns)![tool]!(...args))
        .then(
          v => {
            if (failed) return;
            try {
              const s = vm.newString(JSON.stringify(v ?? null));
              d.resolve(s);
              s.dispose();
            } catch (e) { failed ??= String(e); }
          },
          e => {
            if (failed) return;
            try {
              const err = vm.newError(String((e as Error)?.message ?? e));
              d.reject(err);
              err.dispose();
            } catch (x) { failed ??= String(x); }
          },
        )
        .finally(() => { outstanding--; });
      return d.handle;
    });
    vm.setProp(vm.global, '__call', call);
    call.dispose();
    const names = [...fns.keys()];
    const prelude = 'globalThis.console={log(){},info(){},warn(){},error(){},debug(){}};' + names
      .map(n => `globalThis[${JSON.stringify(n)}]=new Proxy({}, {get:(_,t)=>async (...a)=>JSON.parse(await __call(${JSON.stringify(n)},t,JSON.stringify(a)))});`)
      .join('');
    const r = vm.evalCode(`${prelude}(${code.replace(/;\s*$/, '')})().then(v=>{globalThis.__done=JSON.stringify(v===undefined?null:v)},e=>{globalThis.__failed=String(e)+" "+String(e&&e.stack||"").trim()})`);
    if (r.error) { const e = vm.dump(r.error); r.error.dispose(); return { ok: false, detail: String((e as { message?: string })?.message ?? JSON.stringify(e)) }; }
    r.value!.dispose();
    for (;;) {
      const jobs = rt.executePendingJobs();
      if (jobs.error) { jobs.error.dispose(); return { ok: false, detail: 'job error' }; }
      if (failed) return { ok: false, detail: failed };
      const done = vm.getProp(vm.global, '__done'), bad = vm.getProp(vm.global, '__failed');
      const doneV = vm.dump(done), badV = vm.dump(bad);
      done.dispose(); bad.dispose();
      if (typeof badV === 'string') return { ok: false, detail: badV.split('\n')[0] };
      if (typeof doneV === 'string') {
        const v = task.oracle(JSON.parse(doneV));
        return ledger.unmatched ? { ok: false, detail: 'unmatched' } : { ok: v.ok, detail: v.reason };
      }
      if (!outstanding) await new Promise(r => setImmediate(r));
      else await new Promise(r => setTimeout(r, 0));
    }
  } catch (e) {
    return { ok: false, detail: String((e as Error)?.message ?? e) };
  } finally {
    // Late replies of a failed trial go nowhere: its module is dropped.
    failed ??= 'ended';
  }
}

async function quickjsFloor(): Promise<number> {
  // The empty runtime and context: what every limit below includes.
  const rt = (await quickjsModule()).newRuntime();
  const vm = rt.newContext();
  const usage = vm.dump(rt.computeMemoryUsage() as unknown as Handle) as Record<string, number>;
  return usage.malloc_size ?? usage.memory_used_size;
}

async function quickjsNeed(task: LoadedTask, code: string): Promise<{ bytes: Row['bytes']; detail?: string }> {
  let hi = 64 * 1024 * KIB;
  const top = await quickjsRun(task, code, hi);
  if (!top.ok) return { bytes: null, detail: top.detail };
  let lo = 0;
  while (hi - lo > 16 * KIB) {
    const mid = Math.floor((lo + hi) / 2 / (16 * KIB)) * 16 * KIB;
    if ((await quickjsRun(task, code, mid)).ok) hi = mid; else lo = mid;
  }
  return { bytes: hi };
}

// --- V8: sampled used heap. ---
const gc = (globalThis as { gc?: () => void }).gc;
async function v8Peak(task: LoadedTask, code: string): Promise<{ ok: boolean; bytes: number; detail?: string }> {
  if (!gc) throw Error('run with --expose-gc');
  const replay = new Replay(task.spec, task.responses, 0);
  const ledger = new Ledger();
  gc(); gc();
  const base = getHeapStatistics().used_heap_size;
  let peak = base;
  const sample = () => { peak = Math.max(peak, getHeapStatistics().used_heap_size); };
  const providers = replay.providers(ledger).map(p => {
    const fns: ResolvedProvider['fns'] = Object.create(null);
    for (const [k, f] of Object.entries(p.fns)) fns[k] = async (...a: unknown[]) => { sample(); const v = await f(...a); sample(); return v; };
    return { name: p.name, fns };
  });
  const names = providers.map(p => p.name);
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (...a: string[]) => (...v: unknown[]) => Promise<unknown>;
  try {
    const result = await new AsyncFunction(...names, `return await (${code.replace(/;\s*$/, '')})();`)(...providers.map(p => p.fns));
    sample();
    const v = task.oracle(JSON.parse(JSON.stringify(result ?? null)));
    return { ok: v.ok && !ledger.unmatched, bytes: peak - base, detail: v.reason };
  } catch (e) {
    return { ok: false, bytes: peak - base, detail: String(e) };
  }
}

// --- Sofort: the guest's arena high-water from STATS. ---
type Metrics = { heapPeakBytes?: number };
type ShardModule = {
  ShardBackend: new (o: { binary: string; snapshot: string; slots: number; memoryClass: string; onMetrics(m: Metrics): void }) => {
    ready: Promise<void>; limits: { js?: { arenaBytes?: number; heapBytes?: number } }; close(): Promise<void>; child: { pid?: number };
  };
};
/** The engine's process tree from `root`: RSS KiB each and, on macOS, footprint KiB. */
function engineMemory(root: number) {
  const ps = execFileSync('/bin/ps', ['-A', '-o', 'pid=,ppid=,rss=,comm='], { encoding: 'utf8' }).trim().split('\n')
    .map(l => l.trim().split(/\s+/)).map(([pid, ppid, kb, comm]) => ({ pid: Number(pid), ppid: Number(ppid), rssKiB: Number(kb), comm: comm ?? '' }));
  const tree = new Set([root]);
  for (let grew = true; grew;) { grew = false; for (const p of ps) if (tree.has(p.ppid) && !tree.has(p.pid)) { tree.add(p.pid); grew = true; } }
  const footprint = (pid: number) => {
    if (process.platform !== 'darwin') return undefined;
    try {
      const m = /Footprint: ([\d.]+) (KB|MB)/.exec(execFileSync('/usr/bin/footprint', ['-p', String(pid)], { encoding: 'utf8' }));
      return m ? Math.round(Number(m[1]) * (m[2] === 'MB' ? 1024 : 1)) : undefined;
    } catch { return undefined; }
  };
  return ps.filter(p => tree.has(p.pid)).map(p => ({ pid: p.pid, rssKiB: p.rssKiB, footprintKiB: footprint(p.pid) }));
}
type ExecutorModule = {
  SandboxPool: new (b: unknown, warm: number, max: number) => { drain(): Promise<void>; close(): Promise<void> };
  MicroVMExecutor: new (pool: unknown, policy: () => 'allow', timeout: number) => {
    execute(code: string, p: ResolvedProvider[]): Promise<{ result: unknown; error?: string }>;
  };
};
async function sofort(tasks: LoadedTask[]) {
  const build = new URL('../../../executor/build/', import.meta.url);
  const { ShardBackend } = (await import(new URL('shard-backend.js', build).href)) as ShardModule;
  const { MicroVMExecutor, SandboxPool } = (await import(new URL('executor.js', build).href)) as ExecutorModule;
  const binary = process.env.JITK_SHARD_BINARY, snapshot = process.env.JITK_SHARD_SNAPSHOT;
  if (!binary || !snapshot) throw Error('sofort: set JITK_SHARD_BINARY and JITK_SHARD_SNAPSHOT (deps env with JITK_SHARD_CLASS)');
  const metrics: Metrics[] = [];
  const backend = new ShardBackend({ binary, snapshot, slots: 1, memoryClass: sofortClass, onMetrics: m => metrics.push(m) });
  const pool = new SandboxPool(backend, 0, 1);
  const ex = new MicroVMExecutor(pool, () => 'allow', 30000);
  try {
    await backend.ready;
    const idle = await ex.execute('return 1', []);
    await pool.drain();
    const floor = metrics.at(-1)?.heapPeakBytes ?? null;
    emit({ engine: 'sofort', task: '-', program: 'return 1', ok: idle.result === 1, bytes: floor, memoryClass: sofortClass, limits: backend.limits.js,
      ...(memory ? { memory: engineMemory(backend.child.pid!) } : {}) });
    for (const task of tasks) for (const p of task.programs) {
      const peaks: number[] = [];
      let ok = true, detail: string | undefined;
      for (let i = 0; i < repeat; i++) {
        const ledger = new Ledger();
        const replay = new Replay(task.spec, task.responses, 0);
        metrics.length = 0;
        const r = await ex.execute(p.code, replay.providers(ledger));
        await pool.drain();
        const v = r.error === undefined ? task.oracle(JSON.parse(JSON.stringify(r.result ?? null))) : { ok: false, reason: r.error };
        if (!v.ok || ledger.unmatched) { ok = false; detail ??= v.reason ?? 'unmatched'; }
        const m = metrics.at(-1)?.heapPeakBytes;
        if (m !== undefined) peaks.push(m);
      }
      emit({ engine: 'sofort', task: task.spec.id, program: p.name, ok, bytes: peaks.length ? Math.max(...peaks) : null, peaks, memoryClass: sofortClass, detail,
        ...(memory ? { memory: engineMemory(backend.child.pid!) } : {}) });
    }
  } finally {
    await pool.close();
    await backend.close();
  }
}

const tasks = await Promise.all(ids.map(id => loadTask(join(tasksDir, id))));
if (engines.includes('quickjs')) {
  emit({ engine: 'quickjs', task: '-', program: 'empty context', ok: true, bytes: await quickjsFloor() });
  for (const task of tasks) for (const p of task.programs) {
    const { bytes, detail } = await quickjsNeed(task, p.code);
    emit({ engine: 'quickjs', task: task.spec.id, program: p.name, ok: bytes !== null, bytes, detail });
  }
}
if (engines.includes('v8')) {
  for (const task of tasks) for (const p of task.programs) {
    let best: { ok: boolean; bytes: number; detail?: string } | undefined;
    for (let i = 0; i < repeat; i++) {
      const r = await v8Peak(task, p.code);
      if (!best || r.bytes < best.bytes) best = r;
    }
    emit({ engine: 'v8', task: task.spec.id, program: p.name, ok: best!.ok, bytes: best!.bytes, detail: best!.detail });
  }
}
if (engines.includes('sofort')) await sofort(tasks);

const kib = (b: number | null | undefined) => (b === null || b === undefined ? 'n/a' : `${Math.round(b / KIB).toLocaleString('en-US')}`);
const keys = [...new Set(rows.filter(r => r.task !== '-').map(r => `${r.task} ${r.program}`))];
const cols = engines;
console.log(`\n| task | program | ${cols.map(c => `${c} KiB`).join(' | ')} |\n|---|---|${cols.map(() => '---:').join('|')}|`);
for (const k of keys) {
  const [task, program] = k.split(' ');
  const cell = (e: string) => { const r = rows.find(x => x.engine === e && x.task === task && x.program === program); return r ? kib(r.bytes) + (r.ok ? '' : ' ✗') : ''; };
  console.log(`| ${task} | ${program!.replace('programs/claude-opus-5-5-', '').replace('.js', '')} | ${cols.map(cell).join(' | ')} |`);
}
if (out) writeFileSync(out, JSON.stringify(rows, null, 1) + '\n');
