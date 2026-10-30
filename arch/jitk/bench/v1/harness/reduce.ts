// Reducer: raw.jsonl → summary.json + summary.md (SPEC-V1 §5, §7).
//
//   $JITK_NODE bench/v1/harness/reduce.ts RUN_DIR|raw.jsonl          write summary.{json,md}
//   $JITK_NODE bench/v1/harness/reduce.ts RUN_DIR|raw.jsonl --verify re-derive and diff
//
// Every attempt row stays in the denominator: failures (any errorClass,
// including unmatched tool calls and wrong answers) count against
// correctness, and latency percentiles are over all non-warmup attempts,
// failed ones included (a timeout is a slow attempt, not a missing one).
// Warmups and hostile attempts are excluded from latency and correctness and
// reported separately. Percentiles: linear interpolation (bench/lib.ts quant);
// p50/p99 95% CIs by the seeded bootstrap of bench/lib.ts stats() (2000
// replicas), so --verify reproduces them exactly. Samples taken with load1 >= 6
// (bench/gate.ts's threshold) are counted per row as contended.
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { quant, stats } from '../../lib.ts';
import { fit } from '../../../tslib/stats.ts';
import type { AttemptRow } from './contract.ts';

const LOAD_GATE = 6;
const r3 = (x: number | null | undefined) => (x === null || x === undefined || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000);

interface Dist { n: number; p50: number | null; p95: number | null; p99: number | null; p50ci: (number | null)[]; p99ci: (number | null)[]; max: number | null }
function dist(xs: number[], boot = true): Dist {
  if (!xs.length) return { n: 0, p50: null, p95: null, p99: null, p50ci: [], p99ci: [], max: null };
  const s = boot ? stats(xs) : undefined;
  return {
    n: xs.length, p50: r3(quant(xs, 0.5)), p95: r3(quant(xs, 0.95)), p99: r3(quant(xs, 0.99)),
    p50ci: s ? s.p50.ci95.map(r3) : [], p99ci: s ? s.p99.ci95.map(r3) : [], max: r3(Math.max(...xs)),
  };
}
function group<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) { const k = key(r); (m.get(k) ?? m.set(k, []).get(k)!).push(r); }
  return m;
}
function failures(rows: AttemptRow[]) {
  const byClass: Record<string, number> = {};
  const examples: Record<string, string> = {};
  for (const r of rows) if (!r.ok) { const c = r.errorClass ?? 'unknown'; byClass[c] = (byClass[c] ?? 0) + 1; examples[c] ??= r.reason.slice(0, 160); }
  return { byClass, examples };
}
function attemptSummary(rows: AttemptRow[]) {
  const ok = rows.filter(r => r.ok).length;
  return {
    n: rows.length, ok, correctRate: r3(rows.length ? ok / rows.length : null),
    e2eMs: dist(rows.map(r => r.e2eMs)),
    serviceMs: dist(rows.map(r => r.serviceMs), false),
    overheadMs: dist(rows.map(r => r.overheadMs), false),
    toolMs: dist(rows.map(r => r.toolMs), false),
    toolCallsPerTask: r3(rows.reduce((s, r) => s + r.toolCalls, 0) / Math.max(1, rows.length)),
    toolBytesPerTask: r3(rows.reduce((s, r) => s + r.toolBytes, 0) / Math.max(1, rows.length)),
    harnessCpuMsPerTask: rows.every(r => r.cpu) && rows.length ? r3(rows.reduce((s, r) => s + r.cpu!.harnessUs, 0) / rows.length / 1000) : null,
    unmatched: rows.reduce((s, r) => s + r.unmatched, 0),
    forbidden: rows.reduce((s, r) => s + (r.forbidden ?? 0), 0),
    contended: rows.filter(r => r.load1 >= LOAD_GATE).length,
    load1p50: r3(quant(rows.map(r => r.load1), 0.5)),
    failures: failures(rows),
  };
}

export function reduceRows(all: any[]): { json: any; markdown: string } {
  const env = all.find(r => r.kind === 'env') ?? {};
  const attempts = all.filter(r => r.kind === 'attempt') as AttemptRow[];
  const cells = all.filter(r => r.kind === 'cell');
  const measured = attempts.filter(r => !r.warmup && !r.hostile);
  const cellCpu = (adapter: string, scenario: string, cell: string) => {
    const cs = cells.filter(c => c.adapter === adapter && c.scenario === scenario && c.cell === cell);
    if (!cs.length) return null;
    const n = cs.reduce((s, c) => s + c.attempts, 0);
    const harness = cs.reduce((s, c) => s + (c.attemptHarnessCpuMs ?? c.cpuMs.harness), 0);
    const children = cs.every(c => c.cpuMs.children !== null) ? cs.reduce((s, c) => s + c.cpuMs.children, 0) : null;
    return { cpuMsPerTask: r3((harness + (children ?? 0)) / Math.max(1, n)), harnessCpuMsPerTask: r3(harness / Math.max(1, n)), childCpuMsPerTask: children === null ? null : r3(children / Math.max(1, n)) };
  };

  // S1 and S4: per adapter × task (and all tasks).
  const perTask: any[] = [];
  for (const scenario of ['S1', 'S4']) {
    const rows = measured.filter(r => r.scenario === scenario);
    for (const [k, rs] of group(rows, r => `${r.adapter}\t${r.task}`)) {
      const [adapter, task] = k.split('\t');
      perTask.push({ scenario, adapter, task, ...attemptSummary(rs) });
    }
    for (const [adapter, rs] of group(rows, r => r.adapter)) {
      const cell = rs[0]!.cell;
      perTask.push({ scenario, adapter, task: '*', ...attemptSummary(rs), cpu: cellCpu(adapter, scenario, cell),
        ...(scenario === 'S4' ? { phasesP50: phaseMedians(rs) } : {}) });
    }
  }
  perTask.sort((a, b) => a.scenario.localeCompare(b.scenario) || a.adapter.localeCompare(b.adapter) || a.task.localeCompare(b.task));

  // S2: per adapter × rate; goodput = highest passing rate.
  const slo = env.spec?.sloP99Ms ?? null;
  const s2: any[] = [];
  const goodput: Record<string, any> = {};
  for (const [k, rs] of group(measured.filter(r => r.scenario === 'S2' && r.cell.startsWith('rate=')), r => `${r.adapter}\t${r.cell}`)) {
    const [adapter, cell] = k.split('\t');
    const rate = Number(cell!.slice(5));
    const s = attemptSummary(rs);
    const pass = s.n > 0 && s.ok === s.n && s.e2eMs.p99 !== null && slo !== null && s.e2eMs.p99 <= slo;
    const c = cells.find(x => x.adapter === adapter && x.scenario === 'S2' && x.cell === cell);
    s2.push({ adapter, rate, achievedPerS: c ? r3(c.attempts / (c.wallMs / 1000)) : null, pass, ...s, cpu: cellCpu(adapter!, 'S2', cell!) });
  }
  s2.sort((a, b) => a.adapter.localeCompare(b.adapter) || a.rate - b.rate);
  for (const [adapter, rs] of group(s2, r => r.adapter)) {
    const passing = rs.filter(r => r.pass).map(r => r.rate);
    goodput[adapter] = { sloP99Ms: slo, goodputPerS: passing.length ? Math.max(...passing) : 0, rates: rs.map(r => ({ rate: r.rate, pass: r.pass })) };
  }

  // S3: victims, hostile containment, canaries, forbidden invocations.
  const s3: any[] = [];
  for (const [adapter, rs] of group(attempts.filter(r => r.scenario === 'S3'), r => r.adapter)) {
    const victims = rs.filter(r => !r.hostile && !r.cell.startsWith('canary'));
    const hostile = rs.filter(r => r.hostile);
    const canary = rs.filter(r => r.cell.startsWith('canary'));
    const s2Same = s2.find(x => x.adapter === adapter && x.rate === env.spec?.S3?.rate);
    s3.push({
      adapter, victims: attemptSummary(victims), victimP99BaselineS2: s2Same?.e2eMs.p99 ?? null,
      hostile: { n: hostile.length, contained: hostile.filter(r => r.errorClass !== 'harness').length, byProgram: Object.fromEntries([...group(hostile, r => r.program)].map(([p, x]) => [p, { n: x.length, errorClasses: failures(x).byClass, maxServiceMs: r3(Math.max(...x.map(y => y.serviceMs))) }])) },
      canaries: { n: canary.length, failed: canary.filter(r => !r.ok).length, failures: failures(canary) },
      forbidden: rs.reduce((s, r) => s + (r.forbidden ?? 0), 0),
    });
  }

  // S5: per adapter × level; memory slope over passing levels.
  const s5: any[] = [];
  const density: Record<string, any> = {};
  for (const [adapter, cs] of group(cells.filter(c => c.scenario === 'S5'), c => c.adapter)) {
    const levels = cs.map(c => {
      const rs = measured.filter(r => r.adapter === adapter && r.scenario === 'S5' && r.cell === c.cell);
      const s = attemptSummary(rs);
      return { adapter, level: c.level, n: s.n, ok: s.ok, correctRate: s.correctRate, e2eMs: s.e2eMs, throughputPerS: r3(c.throughputPerS), idleTreeRssKiB: c.idleTreeRssKiB, peakTreeRssKiB: c.peakTreeRssKiB, failures: s.failures };
    }).sort((a, b) => a.level - b.level);
    s5.push(...levels);
    const good = levels.filter(l => l.n > 0 && l.ok === l.n);
    const maxLevel = good.length ? Math.max(...good.map(l => l.level)) : 0;
    let slope: any = null;
    if (good.length >= 2) {
      const f = fit(good.map(l => l.level), good.map(l => l.peakTreeRssKiB * 1024));
      slope = { bytesPerTask: Math.round(f.bytes_per_vm), fixedBytes: Math.round(f.fixed_bytes), r2: r3(f.r2), tasksPerGiB: f.bytes_per_vm > 0 ? Math.floor((1 << 30) / f.bytes_per_vm) : null };
    }
    density[adapter] = { maxCorrectLevel: maxLevel, memory: slope };
  }

  const warmups = attempts.filter(r => r.warmup).length;
  const skipped = [...all.filter(r => r.kind === 'skipped'),
    ...all.filter(r => r.kind === 'open-failed').map(r => ({ adapter: r.adapter, scenario: `${r.scenario} concurrency ${r.concurrency}`, reason: 'open failed: ' + r.error }))];
  const opens = all.filter(r => r.kind === 'open').map(o => ({ adapter: o.adapter, scenario: o.scenario, concurrency: o.concurrency, openMs: r3(o.openMs), provenance: o.provenance }));
  const json = {
    run: env.run, env: { host: env.host, os: env.os, osVersion: env.osVersion, cpu: env.cpu, cpus: env.cpus, node: env.node, git: env.git, virt: env.virt, load: env.load, started: env.started },
    spec: env.spec, totals: { attempts: attempts.length, warmups, measured: measured.length, failed: measured.filter(r => !r.ok).length, hostile: attempts.filter(r => r.hostile).length },
    S1S4: perTask, S2: s2, goodput, S3: s3, S5: s5, density, opens, skipped,
  };
  return { json, markdown: markdown(json) };
}

function phaseMedians(rs: AttemptRow[]) {
  const keys = new Set(rs.flatMap(r => Object.keys(r.phases ?? {})));
  return Object.fromEntries([...keys].map(k => [k, r3(quant(rs.map(r => r.phases?.[k] ?? NaN).filter(Number.isFinite), 0.5))]));
}

const f = (x: number | null | undefined, d = 2) => (x === null || x === undefined ? '–' : x.toFixed(d));
const pct = (x: number | null) => (x === null ? '–' : (x * 100).toFixed(1) + '%');
const ci = (v: (number | null)[]) => (v.length === 2 ? ` [${f(v[0])}, ${f(v[1])}]` : '');
function failText(fl: { byClass: Record<string, number> }) {
  const e = Object.entries(fl.byClass);
  return e.length ? e.map(([c, n]) => `${c} ${n}`).join(', ') : '';
}
function markdown(j: any): string {
  const out: string[] = [];
  const e = j.env;
  out.push(`# sofort-bench v1 run ${j.run}`, '');
  out.push(`${e.host} · ${e.os} ${e.osVersion ?? ''} · ${e.cpu} ×${e.cpus} · virt \`${e.virt}\` · Node ${e.node} · git ${String(e.git?.sha).slice(0, 10)}${e.git?.dirty ? ' (dirty)' : ''} · load at start ${(e.load ?? []).map((x: number) => x.toFixed(2)).join(' ')}`, '');
  out.push(`Attempts ${j.totals.attempts} (measured ${j.totals.measured}, failed ${j.totals.failed}, warmups ${j.totals.warmups}, hostile ${j.totals.hostile}). Latencies in ms; p99 with bootstrap 95% CI. "contended" = samples with load1 ≥ ${LOAD_GATE}.`, '');
  const s1 = j.S1S4.filter((r: any) => r.scenario === 'S1');
  if (s1.length) {
    out.push('## S1 sequential', '', '| adapter | task | n | correct | e2e p50 | e2e p95 | e2e p99 [95% CI] | overhead p50 | overhead p99 | tool p50 | CPU ms/task | contended | failures |', '|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|---|');
    for (const r of s1) out.push(`| ${r.adapter} | ${r.task} | ${r.n} | ${pct(r.correctRate)} | ${f(r.e2eMs.p50)} | ${f(r.e2eMs.p95)} | ${f(r.e2eMs.p99)}${ci(r.e2eMs.p99ci)} | ${f(r.overheadMs.p50)} | ${f(r.overheadMs.p99)} | ${f(r.toolMs.p50)} | ${r.cpu ? f(r.cpu.cpuMsPerTask, 3) + (r.cpu.childCpuMsPerTask === null ? '*' : '') : f(r.harnessCpuMsPerTask, 3) + '†'} | ${r.contended} | ${failText(r.failures)} |`);
    out.push('', 'CPU ms/task: harness process per attempt plus the adapter\'s child processes over the cell (ps, 10 ms resolution); * children not attributable (no pids()); † harness only. Harness CPU includes tool replay and is common to every adapter.', '');
  }
  if (j.S2.length) {
    out.push(`## S2 open loop (SLO p99 ≤ ${j.goodput[Object.keys(j.goodput)[0]!]?.sloP99Ms} ms, no failures)`, '', '| adapter | rate/s | achieved/s | n | correct | e2e p50 | e2e p99 [95% CI] | overhead p99 | CPU ms/task | contended | pass | failures |', '|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|:-:|---|');
    for (const r of j.S2) out.push(`| ${r.adapter} | ${r.rate} | ${f(r.achievedPerS)} | ${r.n} | ${pct(r.correctRate)} | ${f(r.e2eMs.p50)} | ${f(r.e2eMs.p99)}${ci(r.e2eMs.p99ci)} | ${f(r.overheadMs.p99)} | ${f(r.cpu?.cpuMsPerTask, 3)} | ${r.contended} | ${r.pass ? 'yes' : 'no'} | ${failText(r.failures)} |`);
    out.push('', '**Goodput** (highest passing rate): ' + Object.entries(j.goodput).map(([a, g]: [string, any]) => `${a} ${g.goodputPerS}/s`).join(' · '), '');
  }
  if (j.S3.length) {
    out.push('## S3 hostile mix', '', '| adapter | victims n | victim correct | victim p99 | S2 p99 same rate | hostile n | contained | canaries | canary failures | forbidden |', '|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|');
    for (const r of j.S3) out.push(`| ${r.adapter} | ${r.victims.n} | ${pct(r.victims.correctRate)} | ${f(r.victims.e2eMs.p99)} | ${f(r.victimP99BaselineS2)} | ${r.hostile.n} | ${r.hostile.contained} | ${r.canaries.n} | ${r.canaries.failed} | ${r.forbidden} |`);
    out.push('');
  }
  const s4 = j.S1S4.filter((r: any) => r.scenario === 'S4' && r.task === '*');
  if (s4.length) {
    out.push('## S4 cold service (process spawn → first correct result)', '', '| adapter | n | correct | p50 | max | phases p50 (ms from child start) |', '|---|--:|--:|--:|--:|---|');
    for (const r of s4) out.push(`| ${r.adapter} | ${r.n} | ${pct(r.correctRate)} | ${f(r.e2eMs.p50)} | ${f(r.e2eMs.max)} | ${Object.entries(r.phasesP50 ?? {}).map(([k, v]) => `${k} ${f(v as number, 1)}`).join(', ')} |`);
    out.push('');
  }
  if (j.S5.length) {
    out.push('## S5 concurrency', '', '| adapter | level | n | correct | e2e p50 | e2e p99 | tasks/s | idle tree RSS MiB | peak tree RSS MiB | failures |', '|---|--:|--:|--:|--:|--:|--:|--:|--:|---|');
    for (const r of j.S5) out.push(`| ${r.adapter} | ${r.level} | ${r.n} | ${pct(r.correctRate)} | ${f(r.e2eMs.p50)} | ${f(r.e2eMs.p99)} | ${f(r.throughputPerS, 1)} | ${f(r.idleTreeRssKiB / 1024, 1)} | ${f(r.peakTreeRssKiB / 1024, 1)} | ${failText(r.failures)} |`);
    out.push('', '**Density**: ' + Object.entries(j.density).map(([a, d]: [string, any]) => `${a}: max correct level ${d.maxCorrectLevel}` + (d.memory ? `, ${f(d.memory.bytesPerTask / 1048576, 2)} MiB/task (r² ${d.memory.r2}), ~${d.memory.tasksPerGiB} per GiB` : '')).join(' · '), '');
  }
  if (j.skipped.length) {
    out.push('## Skipped', '');
    for (const s of j.skipped) out.push(`- ${s.adapter ?? s.task} (${s.scenario}): ${s.reason}`);
    out.push('');
  }
  out.push('## Adapters', '');
  const seen = new Set<string>();
  for (const o of j.opens) {
    if (seen.has(o.adapter)) continue;
    seen.add(o.adapter);
    out.push(`- **${o.adapter}**: ` + Object.entries(o.provenance ?? {}).map(([k, v]) => `${k}=${String(v).length > 70 ? String(v).slice(0, 16) + '…' : v}`).join(', '));
  }
  return out.join('\n') + '\n';
}

export function readRaw(path: string): any[] {
  return readFileSync(path, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
}
export function reduceFile(path: string) { return reduceRows(readRaw(path)); }

function main(argv: string[]) {
  const target = argv.find(a => !a.startsWith('--'));
  if (!target) { console.error('usage: reduce.ts RUN_DIR|raw.jsonl [--verify]'); process.exit(2); }
  const dir = statSync(target).isDirectory() ? target : join(target, '..');
  const raw = statSync(target).isDirectory() ? join(target, 'raw.jsonl') : target;
  const s = reduceFile(raw);
  const jsonText = JSON.stringify(s.json, null, 1) + '\n';
  if (argv.includes('--verify')) {
    let bad = 0;
    for (const [name, text] of [['summary.json', jsonText], ['summary.md', s.markdown]] as const) {
      const path = join(dir, name);
      const old = existsSync(path) ? readFileSync(path, 'utf8') : '';
      if (old === text) { console.log(`verify ${name}: identical`); continue; }
      bad++;
      const a = old.split('\n'), b = text.split('\n');
      console.log(`verify ${name}: DIFFERS`);
      for (let i = 0, shown = 0; i < Math.max(a.length, b.length) && shown < 20; i++)
        if (a[i] !== b[i]) { shown++; console.log(`  line ${i + 1}\n  - ${a[i] ?? ''}\n  + ${b[i] ?? ''}`); }
    }
    process.exit(bad ? 1 : 0);
  }
  writeFileSync(join(dir, 'summary.json'), jsonText);
  writeFileSync(join(dir, 'summary.md'), s.markdown);
  console.log(s.markdown);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv.slice(2));
