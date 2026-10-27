// Reduces ledger cells.jsonl to per-family slopes: one least-squares fit of
// metric = fixed + N x slope per repetition, then the mean slope with a 95%
// Student-t interval across repetitions (repetitions are independent sweeps).
import { readFileSync, writeFileSync } from 'node:fs';
import { check } from '../../tslib/assert.ts';
import { fit, mean, median } from '../../tslib/stats.ts';

interface Cell {
  family: string;
  fixture: string;
  n: number;
  rep: number;
  ok: boolean;
  memory_current_median: number;
  memory_peak: number;
  idle_cpu_usec: number;
  held_s: number;
  samples: Record<string, unknown>[];
}
interface Fit {
  slope: Record<string, number>;
  fixed: Record<string, number>;
  min_r2: number;
  per_rep: number[];
}
interface Row {
  key: string;
  counts: number[];
  reps: number;
  points: number;
  slopes: Record<string, Fit>;
  current_per_vm_at_max: Record<string, number>;
  held_s_at_max: Record<string, number>;
  max_idle_cpu_usec: number;
}
interface Point {
  n: number;
  rep: number;
  metrics: Record<string, number>;
}
// Two-sided 95% Student-t quantiles by degrees of freedom.
const T95: number[] = [0, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262];
const METRICS: string[] = ['current', 'peak', 'kernel', 'anon', 'file', 'pss', 'private_dirty', 'pagetables', 'sec_pagetables', 'slab', 'kernel_stack', 'percpu'];

function stat(s: Record<string, unknown>, key: string): number {
  const m = s.memory_stat as Record<string, number>;
  return Number(m[key] || 0);
}
function smaps(s: Record<string, unknown>, key: string): number {
  const m = s.smaps_total_kib as Record<string, number>;
  return Number(m[key] || 0) * 1024;
}
function metrics(c: Cell): Record<string, number> {
  const pick = (f: (s: Record<string, unknown>) => number): number => median(c.samples.map(f));
  return {
    current: c.memory_current_median,
    peak: c.memory_peak,
    kernel: pick((s) => stat(s, 'kernel')),
    anon: pick((s) => stat(s, 'anon')),
    file: pick((s) => stat(s, 'file')),
    pagetables: pick((s) => stat(s, 'pagetables')),
    sec_pagetables: pick((s) => stat(s, 'sec_pagetables')),
    slab: pick((s) => stat(s, 'slab')),
    kernel_stack: pick((s) => stat(s, 'kernel_stack')),
    percpu: pick((s) => stat(s, 'percpu')),
    pss: pick((s) => smaps(s, 'Pss')),
    private_dirty: pick((s) => smaps(s, 'Private_Dirty')),
    anon_huge: pick((s) => smaps(s, 'AnonHugePages')),
  };
}
function interval(values: number[]): Record<string, number> {
  const m = mean(values);
  const r = values.length;
  let ss = 0;
  for (const v of values) {
    ss += (v - m) ** 2;
  }
  const sd = r > 1 ? Math.sqrt(ss / (r - 1)) : 0;
  const t = r - 1 < T95.length ? T95[r - 1] : 1.96;
  const half = r > 1 ? (t * sd) / Math.sqrt(r) : 0;
  return { mean: m, sd, lo: m - half, hi: m + half, min: Math.min(...values), max: Math.max(...values), reps: r };
}

export function analyze(args: string[]): void {
  const cells: Cell[] = [];
  for (const line of readFileSync(args[0], 'utf8').split('\n')) {
    if (line.trim().length > 0) {
      cells.push(JSON.parse(line) as Cell);
    }
  }
  const failed = cells.filter((c) => !c.ok);
  const groups: Record<string, Point[]> = {};
  const order: string[] = [];
  for (const c of cells) {
    if (!c.ok) {
      continue;
    }
    const key = c.family + '/' + c.fixture;
    if (!(key in groups)) {
      groups[key] = [];
      order.push(key);
    }
    groups[key].push({ n: c.n, rep: c.rep, metrics: metrics(c) });
  }
  const rows: Row[] = [];
  for (const key of order) {
    const points = groups[key];
    const reps: number[] = [];
    for (const p of points) {
      if (!reps.includes(p.rep)) {
        reps.push(p.rep);
      }
    }
    const counts: number[] = [];
    for (const p of points) {
      if (!counts.includes(p.n)) {
        counts.push(p.n);
      }
    }
    counts.sort((a, b) => a - b);
    const slopes: Record<string, Fit> = {};
    for (const metric of METRICS) {
      const perRep: number[] = [];
      const fixed: number[] = [];
      const r2: number[] = [];
      for (const rep of reps) {
        const mine = points.filter((p) => p.rep === rep);
        if (mine.length < 2) {
          continue;
        }
        const f = fit(mine.map((p) => p.n), mine.map((p) => p.metrics[metric])) as Record<string, number>;
        perRep.push(Number(f.bytes_per_vm));
        fixed.push(Number(f.fixed_bytes));
        r2.push(Number(f.r2));
      }
      check(perRep.length > 0, 'no fit for ' + key + ' ' + metric);
      slopes[metric] = { slope: interval(perRep), fixed: interval(fixed), min_r2: Math.min(...r2), per_rep: perRep };
    }
    const top = counts[counts.length - 1];
    const atTop = points.filter((p) => p.n === top).map((p) => p.metrics.current / top);
    const held = cells.filter((c) => c.ok && c.family + '/' + c.fixture === key && c.n === top).map((c) => c.held_s);
    const idle = cells.filter((c) => c.ok && c.family + '/' + c.fixture === key).map((c) => c.idle_cpu_usec);
    rows.push({ key, counts, reps: reps.length, points: points.length, slopes, current_per_vm_at_max: interval(atTop), held_s_at_max: interval(held), max_idle_cpu_usec: Math.max(...idle) });
  }
  const summary = { cells: cells.length, failed: failed.map((c) => ({ family: c.family, fixture: c.fixture, n: c.n, rep: c.rep })), rows };
  if (args.length > 1) {
    writeFileSync(args[1], JSON.stringify(summary, null, 1) + '\n');
  }
  const kib = (v: number): string => (v / 1024).toFixed(1);
  const mib = (v: number): string => (v / 1048576).toFixed(3);
  console.log('| family/fixture | N | reps | current slope MiB/VM [95% CI] | fixed MiB | kernel KiB/VM | anon KiB/VM | PSS KiB/VM | private dirty KiB/VM | peak slope MiB/VM | current/N at max MiB | min R2 |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const row of rows) {
    const s = row.slopes;
    const top = row.current_per_vm_at_max;
    console.log('| ' + row.key + ' | ' + row.counts.join('/') + ' | ' + row.reps + ' | ' + mib(s.current.slope.mean) + ' [' + mib(s.current.slope.lo) + ', ' + mib(s.current.slope.hi) + '] | ' + mib(s.current.fixed.mean) + ' | ' + kib(s.kernel.slope.mean) + ' | ' + kib(s.anon.slope.mean) + ' | ' + kib(s.pss.slope.mean) + ' | ' + kib(s.private_dirty.slope.mean) + ' | ' + mib(s.peak.slope.mean) + ' | ' + mib(top.mean) + ' | ' + s.current.min_r2.toFixed(5) + ' |');
  }
  if (failed.length > 0) {
    console.log('failed cells: ' + failed.length);
  }
}
