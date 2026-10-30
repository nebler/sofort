// sofort-bench v1 driver (SPEC-V1 §4): runs adapters × tasks × scenarios and
// writes one raw JSONL line per attempt, then reduces it (reduce.ts).
//
//   eval "$(arch/jitk/tools/.work/bin/deps env)"
//   $JITK_NODE arch/jitk/bench/v1/harness/run.ts [--spec spec.json] [overrides]
//
// Overrides (each replaces the spec's field): --adapters a,b --tasks t,u
// --scenarios S1,S2 --samples N (S1) --warmups N (S1) --rates 1,2,4 (S2)
// --duration S (S2/S3) --levels 1,2,4 (S5) --per-level N (S5) --cold N (S4)
// --reps N --seed N --timeout-ms N --slo-ms N --latency-scale X --out DIR
// --hostile-fraction F --tool-server (start the replay HTTP endpoint).
//
// Scenarios:
//   S1  sequential: every (task, program) round-robin in a seeded shuffle;
//       adapters opened together and interleaved per sample in a seeded order.
//   S2  open loop: Poisson arrivals (seeded) per rate in the ramp, each attempt
//       timed from its scheduled start (no coordinated omission). A rate passes
//       with p99(e2e) <= SLO and no failures; the ramp stops after the first
//       failing rate unless S2.stopAfterFail is false. Goodput = highest pass.
//   S3  S2 at one rate with hostile programs (harness/hostile) at a fraction,
//       then canaries on the same executor: the leak canary and every task
//       program. Skipped for isolation 'none' (a memory bomb kills the harness).
//   S4  cold service: a fresh Node process per sample imports the adapter,
//       opens it and runs one task program; spawn to first correct result.
//   S5  concurrency levels: per level a fresh open with that concurrency and
//       closed-loop workers running the real tasks; peak RSS of the harness
//       process tree sampled during load. Stops after the first failing level.
import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Random, quant } from '../../lib.ts';
import type { Adapter, AttemptRow, BenchExecutor, ErrorClass, Scenario, ToolEndpoint } from './contract.ts';
import { captureEnv, processTable, treeTotals } from './env.ts';
import { Ledger, Replay, startToolServer, type ToolServer } from './replay.ts';
import { hostilePrograms, LEAK_CANARY, leakOracle, loadTask, type LoadedTask, type Program } from './task.ts';
import { reduceFile } from './reduce.ts';

const here = dirname(fileURLToPath(import.meta.url));
const v1 = resolve(here, '..');
const repo = resolve(v1, '../../../..');

export interface RunSpec {
  adapters: string[];
  tasks: string[];
  scenarios: Scenario[];
  repetitions: number;
  seed: number;
  timeoutMs: number;
  latencyScale: number;
  sloP99Ms: number;
  toolServer: boolean;
  S1: { samples: number; warmups: number; interleave: boolean };
  S2: { rates: number[]; durationS: number; warmupS: number; concurrency: number; stopAfterFail: boolean; settleMs: number };
  S3: { rate: number; durationS: number; fraction: number; programs?: string[]; concurrency: number; canaryRounds: number };
  S4: { samples: number };
  S5: { levels: number[]; perLevel: number; stopAfterFail: boolean };
  out?: string;
}
export const DEFAULT_SPEC: RunSpec = {
  adapters: ['node-vm-fixture'],
  tasks: ['harness/fixtures/example'],
  scenarios: ['S1'],
  repetitions: 1,
  seed: 1,
  timeoutMs: 10_000,
  latencyScale: 1,
  sloP99Ms: 1000,
  toolServer: false,
  S1: { samples: 200, warmups: 20, interleave: true },
  S2: { rates: [2, 5, 10, 20, 50], durationS: 10, warmupS: 1, concurrency: 8, stopAfterFail: true, settleMs: 500 },
  S3: { rate: 10, durationS: 20, fraction: 0.01, concurrency: 8, canaryRounds: 2 },
  S4: { samples: 5 },
  S5: { levels: [1, 2, 4, 8, 16, 32, 64], perLevel: 4, stopAfterFail: true },
};

const nowMs = () => performance.timeOrigin + performance.now();
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, Math.max(0, ms)));

// ---------- resolution ----------
/** An adapter by name: adapters/<name>.ts, else the longest adapters/<prefix>.ts
 *  (then harness/fixtures/) whose module exports an adapter of that name.
 *  'path/file.ts#name' or 'path/file.ts' (relative to bench/v1) also work. */
export async function resolveAdapter(ref: string): Promise<Adapter> {
  const pick = async (file: string, name?: string): Promise<Adapter | undefined> => {
    const mod = await import(pathToFileURL(file).href);
    const list: Adapter[] = [mod.default].flat().filter(Boolean);
    return name ? list.find(a => a.name === name) : list[0];
  };
  if (ref.includes('.ts')) {
    const [file, name] = ref.split('#');
    const a = await pick(resolve(v1, file!), name);
    if (!a) throw Error(`adapter ${ref}: not exported`);
    return a;
  }
  const parts = ref.split('-');
  for (const dir of [join(v1, 'adapters'), join(here, 'fixtures')])
    for (let n = parts.length; n > 0; n--) {
      const file = join(dir, parts.slice(0, n).join('-') + '.ts');
      if (!existsSync(file)) continue;
      const a = await pick(file, ref);
      if (a) return a;
    }
  throw Error(`adapter ${ref}: no adapters/<prefix>.ts exports it`);
}
/** A task by id (bench/v1/tasks/<id>) or path (relative to bench/v1). */
export function taskDir(ref: string): string {
  const byId = join(v1, 'tasks', ref);
  return existsSync(join(byId, 'task.json')) ? byId : resolve(v1, ref);
}

// ---------- one attempt ----------
interface Opened { adapter: Adapter; ex: BenchExecutor; exclusive: boolean }
interface Item { task: LoadedTask; replay: Replay; program: Program; oracle: (r: unknown) => { ok: boolean; reason: string }; hostile: boolean }
interface Meta { scenario: Scenario; cell: string; warmup: boolean; seq: number; intendedStartMs?: number }

export function classifyError(text: string): ErrorClass {
  if (/replay: no recorded response/.test(text)) return 'unmatched';
  if (/timed? ?out|deadline|timeout/i.test(text)) return 'timeout';
  if (/out of memory|heap|allocation fail|memory limit|OOM/i.test(text)) return 'oom';
  if (/overloaded|queue (is )?full/i.test(text)) return 'overloaded';
  if (/SyntaxError|not supported|unsupported/i.test(text)) return 'unsupported';
  return 'guest';
}

class Context {
  rows: object[] = [];
  readonly spec: RunSpec;
  readonly runId: string;
  readonly rawPath: string;
  readonly server?: ToolServer;
  constructor(spec: RunSpec, runId: string, rawPath: string, server?: ToolServer) {
    this.spec = spec; this.runId = runId; this.rawPath = rawPath; this.server = server;
  }
  emit(row: object) { this.rows.push(row); }
  flush() {
    if (!this.rows.length) return;
    appendFileSync(this.rawPath, this.rows.map(r => JSON.stringify(r)).join('\n') + '\n');
    this.rows = [];
  }

  async attempt(o: Opened, item: Item, meta: Meta, rep: number, measureCpu: boolean): Promise<AttemptRow> {
    const ledger = new Ledger();
    const providers = item.replay.providers(ledger);
    const forbidden0 = this.server?.forbidden ?? 0;
    const cpu0 = measureCpu ? process.cpuUsage() : undefined;
    const actualStartMs = nowMs();
    const intendedStartMs = meta.intendedStartMs ?? actualStartMs;
    let result: unknown, error: string | undefined, errorClass: ErrorClass | undefined;
    const guardMs = this.spec.timeoutMs * 2 + 5000;
    let guard: ReturnType<typeof setTimeout> | undefined;
    try {
      const r = await Promise.race([
        o.ex.execute(item.program.code, providers),
        new Promise<never>((_, reject) => { guard = setTimeout(() => reject(Error(`adapter did not return within ${guardMs} ms`)), guardMs); }),
      ]);
      result = r.result; error = r.error;
      if (error !== undefined) errorClass = r.errorClass ?? classifyError(error);
    } catch (e) {
      error = 'harness: ' + (e instanceof Error ? e.message : String(e)); errorClass = 'harness';
    } finally { clearTimeout(guard); }
    const endMs = nowMs();
    const cpu = cpu0 ? process.cpuUsage(cpu0) : undefined;
    const toolMs = ledger.toolMs;
    let ok = false, reason: string;
    if (ledger.unmatched > 0) {
      errorClass = 'unmatched'; reason = 'unmatched tool calls: ' + ledger.unmatchedKeys.join('; ');
    } else if (error !== undefined) {
      reason = error;
    } else {
      try {
        const v = item.oracle(result === undefined ? undefined : JSON.parse(JSON.stringify(result)));
        ok = v.ok; reason = v.reason;
        if (!ok) errorClass = 'oracle';
      } catch (e) { reason = 'oracle threw: ' + String(e); errorClass = 'oracle'; }
    }
    const forbidden = (this.server?.forbidden ?? 0) - forbidden0;
    const row: AttemptRow = {
      kind: 'attempt', run: this.runId, rep, adapter: o.adapter.name, task: item.task.spec.id, program: item.program.name,
      scenario: meta.scenario, cell: meta.cell, warmup: meta.warmup, hostile: item.hostile, seq: meta.seq,
      intendedStartMs, actualStartMs, endMs,
      e2eMs: endMs - intendedStartMs, serviceMs: endMs - actualStartMs,
      toolMs, toolSumMs: ledger.toolSumMs, overheadMs: endMs - actualStartMs - toolMs,
      toolCalls: ledger.calls, toolBytes: ledger.bytes, unmatched: ledger.unmatched, fallbacks: ledger.fallbacks, forbidden,
      ok, reason: reason.slice(0, 500), errorClass: ok ? undefined : errorClass,
      cpu: cpu ? { harnessUs: cpu.user + cpu.system } : undefined,
      load1: os.loadavg()[0]!,
    };
    this.emit(row);
    return row;
  }
}

// ---------- CPU / memory for a cell ----------
interface CellProbe { wall0: number; harness0: NodeJS.CpuUsage; children0?: number; roots?: number[] }
function probeStart(o: Opened): CellProbe {
  const roots = o.ex.pids?.() ?? (o.exclusive ? childRoots() : undefined);
  return { wall0: nowMs(), harness0: process.cpuUsage(), roots, children0: roots ? treeTotals(roots).cpuMs : undefined };
}
function childRoots(): number[] {
  const table = processTable();
  return [...table.values()].filter(p => p.ppid === process.pid).map(p => p.pid);
}
function probeEnd(p: CellProbe) {
  const harness = process.cpuUsage(p.harness0);
  const end = p.roots ? treeTotals(p.roots) : undefined;
  return {
    wallMs: nowMs() - p.wall0,
    cpuMs: { harness: (harness.user + harness.system) / 1000, children: end && p.children0 !== undefined ? end.cpuMs - p.children0 : null },
    rssKiB: { harness: Math.round(process.memoryUsage().rss / 1024), children: end ? end.rssKiB : null },
  };
}

// ---------- helpers ----------
function poisson(rng: InstanceType<typeof Random>, rate: number, durationS: number): number[] {
  const out: number[] = [];
  for (let t = 0; ;) {
    t += -Math.log(1 - rng.random()) / rate * 1000;
    if (t >= durationS * 1000) return out;
    out.push(t);
  }
}
function shuffle<T>(rng: InstanceType<typeof Random>, a: T[]): T[] {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) { const j = rng.randrange(i + 1); [x[i], x[j]] = [x[j]!, x[i]!]; }
  return x;
}
function passes(rows: AttemptRow[], slo: number): { n: number; failures: number; p99: number | null; pass: boolean } {
  const live = rows.filter(r => !r.warmup && !r.hostile);
  const failures = live.filter(r => !r.ok).length;
  const p99 = live.length ? quant(live.map(r => r.e2eMs), 0.99) : null;
  return { n: live.length, failures, p99, pass: live.length > 0 && failures === 0 && p99 !== null && p99 <= slo };
}

// ---------- scenarios ----------
class Driver {
  items: Item[] = [];
  readonly ctx: Context;
  readonly adapters: Adapter[];
  constructor(ctx: Context, adapters: Adapter[], tasks: LoadedTask[]) {
    this.ctx = ctx; this.adapters = adapters;
    for (const task of tasks) {
      const replay = new Replay(task.spec, task.responses, ctx.spec.latencyScale);
      for (const program of task.programs) this.items.push({ task, replay, program, oracle: task.oracle, hostile: false });
    }
  }
  get spec() { return this.ctx.spec; }

  /** Opens an adapter; a failure is an 'open-failed' row and undefined. */
  async open(adapter: Adapter, scenario: Scenario, rep: number, concurrency: number, exclusive: boolean): Promise<Opened | undefined> {
    const t0 = nowMs();
    let ex: BenchExecutor;
    try { ex = await adapter.open({ concurrency, timeoutMs: this.spec.timeoutMs, toolEndpoint: this.ctx.server }); } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      console.error(`open ${adapter.name} (${scenario}, concurrency ${concurrency}) failed: ${error}`);
      this.ctx.emit({ kind: 'open-failed', run: this.ctx.runId, rep, adapter: adapter.name, scenario, concurrency, ms: nowMs() - t0, error });
      return undefined;
    }
    this.ctx.emit({ kind: 'open', run: this.ctx.runId, rep, adapter: adapter.name, scenario, concurrency, openMs: nowMs() - t0, provenance: adapter.provenance(), load1: os.loadavg()[0] });
    return { adapter, ex, exclusive };
  }
  cellRow(o: Opened, rep: number, scenario: Scenario, cell: string, attempts: number, probe: CellProbe, extra: object = {}) {
    this.ctx.emit({ kind: 'cell', run: this.ctx.runId, rep, adapter: o.adapter.name, scenario, cell, attempts, ...probeEnd(probe), load1: os.loadavg()[0], ...extra });
  }

  async S1(rep: number, rng: InstanceType<typeof Random>) {
    const { samples, warmups, interleave } = this.spec.S1;
    const order = shuffle(rng, this.items);
    const groups = interleave ? [this.adapters] : this.adapters.map(a => [a]);
    for (const group of groups) {
      const opened: Opened[] = [];
      try {
        for (const a of group) { const o = await this.open(a, 'S1', rep, 1, group.length === 1); if (o) opened.push(o); }
        const probes = new Map(opened.map(o => [o, probeStart(o)]));
        const harnessCpu = new Map(opened.map(o => [o, 0]));
        for (let i = 0; i < warmups + samples; i++) {
          const item = order[i % order.length]!;
          for (const o of shuffle(rng, opened)) {
            const row = await this.ctx.attempt(o, item, { scenario: 'S1', cell: 'seq', warmup: i < warmups, seq: i }, rep, true);
            if (i >= warmups) harnessCpu.set(o, harnessCpu.get(o)! + (row.cpu?.harnessUs ?? 0));
          }
          if (i === warmups - 1) for (const o of opened) probes.set(o, probeStart(o));
          if (i % 50 === 49) this.ctx.flush();
        }
        for (const o of opened) {
          const p = probes.get(o)!;
          this.cellRow(o, rep, 'S1', 'seq', samples, p, { attemptHarnessCpuMs: harnessCpu.get(o)! / 1000 });
        }
      } finally {
        for (const o of opened) await o.ex.close().catch(e => this.ctx.emit({ kind: 'error', adapter: o.adapter.name, where: 'close', error: String(e) }));
        this.ctx.flush();
      }
    }
  }

  /** Open-loop arrivals at `rate` for `durationS`; returns the cell's rows. */
  async openLoop(o: Opened, rep: number, rng: InstanceType<typeof Random>, scenario: Scenario, cell: string, rate: number, durationS: number, warmupS: number,
    pickItem: () => Item): Promise<AttemptRow[]> {
    const offsets = poisson(rng, rate, durationS);
    const picks = offsets.map(() => pickItem());
    const probe = probeStart(o);
    const t0 = nowMs() + 20;
    const pending: Promise<AttemptRow>[] = [];
    for (let i = 0; i < offsets.length; i++) {
      const intended = t0 + offsets[i]!;
      const wait = intended - nowMs();
      if (wait > 0) await sleep(wait);
      pending.push(this.ctx.attempt(o, picks[i]!, { scenario, cell, warmup: offsets[i]! < warmupS * 1000, seq: i, intendedStartMs: intended }, rep, false));
    }
    const rows = await Promise.all(pending);
    const verdict = passes(rows, this.spec.sloP99Ms);
    this.cellRow(o, rep, scenario, cell, rows.length, probe, { rate, durationS, scheduled: offsets.length, sloP99Ms: this.spec.sloP99Ms, ...verdict });
    this.ctx.flush();
    return rows;
  }

  async S2(rep: number, rng: InstanceType<typeof Random>) {
    const c = this.spec.S2;
    for (const adapter of shuffle(rng, this.adapters)) {
      const o = await this.open(adapter, 'S2', rep, c.concurrency, true);
      if (!o) continue;
      try {
        for (let i = 0; i < Math.min(10, this.items.length * 2); i++)
          await this.ctx.attempt(o, this.items[i % this.items.length]!, { scenario: 'S2', cell: 'prime', warmup: true, seq: i }, rep, false);
        for (const rate of c.rates) {
          const rows = await this.openLoop(o, rep, rng, 'S2', `rate=${rate}`, rate, c.durationS, c.warmupS, () => this.items[rng.randrange(this.items.length)]!);
          await sleep(c.settleMs);
          if (c.stopAfterFail && !passes(rows, this.spec.sloP99Ms).pass) break;
        }
      } finally { await o.ex.close().catch(() => {}); this.ctx.flush(); }
    }
  }

  async S3(rep: number, rng: InstanceType<typeof Random>) {
    const c = this.spec.S3;
    const hostile = hostilePrograms(c.programs);
    if (!hostile.length) throw Error('S3: no hostile programs');
    for (const adapter of shuffle(rng, this.adapters)) {
      if (adapter.isolation === 'none') {
        this.ctx.emit({ kind: 'skipped', run: this.ctx.runId, rep, adapter: adapter.name, scenario: 'S3', reason: 'isolation none: hostile programs would take down the harness' });
        continue;
      }
      const o = await this.open(adapter, 'S3', rep, c.concurrency, true);
      if (!o) continue;
      try {
        let h = 0;
        const pick = (): Item => {
          if (rng.random() < c.fraction) {
            const base = this.items[rng.randrange(this.items.length)]!;
            const program = hostile[h++ % hostile.length]!;
            return { ...base, program, hostile: true, oracle: () => ({ ok: true, reason: 'contained' }) };
          }
          return this.items[rng.randrange(this.items.length)]!;
        };
        await this.openLoop(o, rep, rng, 'S3', `rate=${c.rate},hostile=${c.fraction}`, c.rate, c.durationS, 0, pick);
        // Every hostile program once more, back to back, each followed by canaries.
        let seq = 0;
        for (const program of hostile) {
          const base = this.items[0]!;
          await this.ctx.attempt(o, { ...base, program, hostile: true, oracle: () => ({ ok: true, reason: 'contained' }) }, { scenario: 'S3', cell: 'hostile', warmup: false, seq: seq++ }, rep, false);
          await this.canaries(o, rep, c.canaryRounds, program.name);
        }
      } finally { await o.ex.close().catch(() => {}); this.ctx.flush(); }
    }
  }
  async canaries(o: Opened, rep: number, rounds: number, after: string) {
    const leak: Item = { ...this.items[0]!, program: LEAK_CANARY, oracle: leakOracle, hostile: false };
    let seq = 0;
    for (let r = 0; r < rounds; r++)
      for (const item of [leak, ...this.items])
        await this.ctx.attempt(o, item, { scenario: 'S3', cell: `canary after ${after}`, warmup: false, seq: seq++ }, rep, false);
  }

  async S4(rep: number, rng: InstanceType<typeof Random>) {
    for (const adapter of shuffle(rng, this.adapters)) {
      for (let i = 0; i < this.spec.S4.samples; i++) {
        const item = this.items[i % this.items.length]!;
        const row = await coldSample(adapter.name, item, this.spec, i);
        this.ctx.emit({ ...row, run: this.ctx.runId, rep });
      }
      this.ctx.flush();
    }
  }

  async S5(rep: number, rng: InstanceType<typeof Random>) {
    const c = this.spec.S5;
    for (const adapter of shuffle(rng, this.adapters)) {
      for (const level of c.levels) {
        const o = await this.open(adapter, 'S5', rep, level, true);
        if (!o) break;
        let failed = false;
        try {
          await sleep(200);
          const idle = treeTotals([process.pid]);
          let peak = idle.rssKiB, samples = 0;
          const sampler = setInterval(() => { const t = treeTotals([process.pid]); peak = Math.max(peak, t.rssKiB); samples++; }, 250);
          const probe = probeStart(o);
          const per = Math.max(1, c.perLevel);
          let seq = 0;
          const rows: AttemptRow[] = [];
          const t0 = nowMs();
          await Promise.all(Array.from({ length: level }, async (_, w) => {
            for (let k = 0; k < per; k++) {
              const item = this.items[(w * per + k) % this.items.length]!;
              rows.push(await this.ctx.attempt(o, item, { scenario: 'S5', cell: `conc=${level}`, warmup: false, seq: seq++ }, rep, false));
            }
          }));
          const wallMs = nowMs() - t0;
          clearInterval(sampler);
          peak = Math.max(peak, treeTotals([process.pid]).rssKiB);
          const failures = rows.filter(r => !r.ok).length;
          failed = failures > 0;
          this.cellRow(o, rep, 'S5', `conc=${level}`, rows.length, probe, {
            level, failures, throughputPerS: rows.length / (wallMs / 1000), idleTreeRssKiB: idle.rssKiB, peakTreeRssKiB: peak, rssSamples: samples,
          });
        } finally { await o.ex.close().catch(() => {}); this.ctx.flush(); }
        if (failed && c.stopAfterFail) break;
      }
    }
  }
}

// ---------- S4: cold child ----------
async function coldSample(adapterName: string, item: Item, spec: RunSpec, seq: number): Promise<Partial<AttemptRow>> {
  const programIndex = item.task.programs.indexOf(item.program);
  const arg = JSON.stringify({ adapter: adapterName, task: item.task.dir, program: programIndex, timeoutMs: spec.timeoutMs, latencyScale: spec.latencyScale });
  const spawnMs = nowMs();
  const child = spawn(process.execPath, [...process.execArgv, fileURLToPath(import.meta.url), '--cold-child', arg], { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
  let out = '', err = '';
  let resultMs = 0;
  child.stdout.on('data', (b: Buffer) => { out += b; if (!resultMs && out.includes('\n')) resultMs = nowMs(); });
  child.stderr.on('data', (b: Buffer) => { err += b; if (err.length > 1e5) err = err.slice(-5e4); });
  const killer = setTimeout(() => child.kill('SIGKILL'), spec.timeoutMs * 3 + 30_000);
  const code = await new Promise<number | null>(r => child.once('close', c => r(c)));
  clearTimeout(killer);
  const exitMs = nowMs();
  let child_: any;
  try { child_ = JSON.parse(out.split('\n')[0]!); } catch { child_ = { ok: false, reason: `cold child exit ${code}: ${err.slice(-400)}`, errorClass: 'harness' }; }
  const end = resultMs || exitMs;
  return {
    kind: 'attempt', adapter: adapterName, task: item.task.spec.id, program: item.program.name, scenario: 'S4', cell: 'cold', warmup: false, hostile: false, seq,
    intendedStartMs: spawnMs, actualStartMs: spawnMs, endMs: end, e2eMs: end - spawnMs,
    serviceMs: child_.executeMs ?? end - spawnMs, toolMs: child_.toolMs ?? 0, toolSumMs: child_.toolSumMs ?? 0,
    overheadMs: (end - spawnMs) - (child_.toolMs ?? 0),
    toolCalls: child_.toolCalls ?? 0, toolBytes: child_.toolBytes ?? 0, unmatched: child_.unmatched ?? 0, fallbacks: 0, forbidden: 0,
    ok: !!child_.ok, reason: String(child_.reason ?? '').slice(0, 500), errorClass: child_.ok ? undefined : child_.errorClass ?? 'harness',
    cpu: child_.cpuUs !== undefined ? { harnessUs: child_.cpuUs } : undefined,
    load1: os.loadavg()[0]!,
    phases: { nodeStartMs: (child_.timeOriginMs ?? spawnMs) - spawnMs, ...(child_.phases ?? {}), exitMs: exitMs - spawnMs },
  };
}
async function coldChild(arg: string) {
  const a = JSON.parse(arg);
  const t = () => performance.now();
  const phases: Record<string, number> = {};
  let line: Record<string, unknown> = {};
  try {
    const adapter = await resolveAdapter(a.adapter);
    const task = await loadTask(a.task);
    phases.importMs = t();
    const ex = await adapter.open({ concurrency: 1, timeoutMs: a.timeoutMs });
    phases.openMs = t();
    const ledger = new Ledger();
    const replay = new Replay(task.spec, task.responses, a.latencyScale);
    const program = task.programs[a.program]!;
    const start = t();
    const r = await ex.execute(program.code, replay.providers(ledger));
    phases.resultMs = t();
    let ok = false, reason = r.error ?? '', errorClass: ErrorClass | undefined = r.error !== undefined ? r.errorClass ?? classifyError(r.error) : undefined;
    if (ledger.unmatched) { errorClass = 'unmatched'; reason = 'unmatched tool calls'; }
    else if (r.error === undefined) {
      const v = task.oracle(r.result === undefined ? undefined : JSON.parse(JSON.stringify(r.result)));
      ok = v.ok; reason = v.reason; if (!ok) errorClass = 'oracle';
    }
    const cpu = process.cpuUsage();
    line = { ok, reason, errorClass, executeMs: phases.resultMs - start, toolMs: ledger.toolMs, toolSumMs: ledger.toolSumMs, toolCalls: ledger.calls, toolBytes: ledger.bytes, unmatched: ledger.unmatched,
      cpuUs: cpu.user + cpu.system, timeOriginMs: performance.timeOrigin, phases };
    process.stdout.write(JSON.stringify(line) + '\n');
    await ex.close();
  } catch (e) {
    process.stdout.write(JSON.stringify({ ok: false, reason: String(e), errorClass: 'harness', timeOriginMs: performance.timeOrigin, phases }) + '\n');
  }
  process.exit(0);
}

// ---------- CLI ----------
function parseArgs(argv: string[]): RunSpec {
  const spec: RunSpec = structuredClone(DEFAULT_SPEC);
  const list = (v: string) => v.split(',').map(s => s.trim()).filter(Boolean);
  const nums = (v: string) => list(v).map(Number);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const [flag, inline] = arg.includes('=') ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)] : [arg, undefined];
    const value = () => { const v = inline ?? argv[++i]; if (v === undefined) throw Error('missing value for ' + flag); return v; };
    switch (flag) {
      case '--spec': Object.assign(spec, merge(spec, JSON.parse(readFileSync(value(), 'utf8')))); break;
      case '--adapters': spec.adapters = list(value()); break;
      case '--tasks': spec.tasks = list(value()); break;
      case '--scenarios': spec.scenarios = list(value()) as Scenario[]; break;
      case '--samples': spec.S1.samples = Number(value()); break;
      case '--warmups': spec.S1.warmups = Number(value()); break;
      case '--rates': spec.S2.rates = nums(value()); break;
      case '--duration': spec.S2.durationS = spec.S3.durationS = Number(value()); break;
      case '--levels': spec.S5.levels = nums(value()); break;
      case '--per-level': spec.S5.perLevel = Number(value()); break;
      case '--cold': spec.S4.samples = Number(value()); break;
      case '--reps': spec.repetitions = Number(value()); break;
      case '--seed': spec.seed = Number(value()); break;
      case '--timeout-ms': spec.timeoutMs = Number(value()); break;
      case '--slo-ms': spec.sloP99Ms = Number(value()); break;
      case '--latency-scale': spec.latencyScale = Number(value()); break;
      case '--hostile-fraction': spec.S3.fraction = Number(value()); break;
      case '--tool-server': spec.toolServer = true; break;
      case '--out': spec.out = value(); break;
      case '--help': case '-h':
        console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter(l => l.startsWith('//')).slice(0, 14).map(l => l.slice(3)).join('\n'));
        process.exit(0);
      default: throw Error('unknown argument ' + arg);
    }
  }
  for (const s of spec.scenarios) if (!['S1', 'S2', 'S3', 'S4', 'S5'].includes(s)) throw Error('unknown scenario ' + s);
  return spec;
}
function merge(base: any, over: any): any {
  if (!over || typeof over !== 'object' || Array.isArray(over)) return over;
  const out = { ...base };
  for (const k of Object.keys(over)) out[k] = base && typeof base[k] === 'object' && !Array.isArray(base[k]) ? merge(base[k], over[k]) : over[k];
  return out;
}

async function main(argv: string[]) {
  if (argv[0] === '--cold-child') return coldChild(argv[1]!);
  const spec = parseArgs(argv);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runId = `${stamp}-${os.hostname().split('.')[0]}`;
  const out = resolve(spec.out ?? join(v1, '.work/runs', runId));
  mkdirSync(out, { recursive: true });
  const rawPath = join(out, 'raw.jsonl');
  writeFileSync(rawPath, '');
  const server = spec.toolServer ? await startToolServer() : undefined;
  const ctx = new Context(spec, runId, rawPath, server);
  const adapters: Adapter[] = [];
  for (const ref of spec.adapters) {
    const a = await resolveAdapter(ref);
    const why = await a.available?.();
    if (why) { ctx.emit({ kind: 'skipped', run: runId, adapter: a.name, scenario: '*', reason: why }); console.error(`skip ${a.name}: ${why}`); continue; }
    adapters.push(a);
  }
  const tasks: LoadedTask[] = [];
  for (const ref of spec.tasks) {
    const t = await loadTask(taskDir(ref));
    if ((t.spec.kind ?? 'js') !== 'js') { ctx.emit({ kind: 'skipped', run: runId, task: t.spec.id, scenario: '*', reason: `kind ${t.spec.kind}: no JS programs` }); continue; }
    tasks.push(t);
  }
  ctx.emit({ kind: 'env', run: runId, ...captureEnv(repo), spec, tasks: tasks.map(t => ({ id: t.spec.id, dir: t.dir, programs: t.programs.length, responses: t.responses.length })) });
  ctx.flush();
  if (!tasks.length) throw Error('no runnable tasks');
  const driver = new Driver(ctx, adapters, tasks);
  for (const t of tasks) for (const w of new Replay(t.spec, t.responses).sizeWarnings) console.error(`warn ${t.spec.id}: ${w}`);
  for (let rep = 0; rep < spec.repetitions; rep++) {
    const rng = new Random(spec.seed * 1000 + rep);
    for (const scenario of spec.scenarios) {
      const t0 = nowMs();
      console.error(`rep ${rep} ${scenario}: ${adapters.map(a => a.name).join(', ')}`);
      await driver[scenario](rep, rng);
      ctx.flush();
      console.error(`rep ${rep} ${scenario}: ${((nowMs() - t0) / 1000).toFixed(1)} s`);
    }
  }
  await server?.close();
  ctx.emit({ kind: 'end', run: runId, ended: new Date().toISOString(), load: os.loadavg() });
  ctx.flush();
  const summary = reduceFile(rawPath);
  writeFileSync(join(out, 'summary.json'), JSON.stringify(summary.json, null, 1) + '\n');
  writeFileSync(join(out, 'summary.md'), summary.markdown);
  console.log(summary.markdown);
  console.error(`raw: ${rawPath}\nsummary: ${join(out, 'summary.md')} (${basename(out)})`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(() => process.exit(0), e => { console.error(e instanceof Error ? e.stack : e); process.exit(1); });
}
