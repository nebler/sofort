import { join, resolve } from 'node:path';
import { check, readJSON, dump, quant, median, Random, fixed } from '../lib.ts';
import { type Frame } from '../controller.ts';

function distribution(values: number[]): Frame {
  return { n: values.length, median: median(values), p90: quant(values, 0.9), p99: quant(values, 0.99), min: Math.min(...values), max: Math.max(...values) };
}
function roundLabel(value: number): string {
  const rounded = Number(fixed(value, 3));
  return Number.isInteger(rounded) ? fixed(rounded, 1) : String(rounded);
}
export function paired(a: Map<number, number>, b: Map<number, number>): Frame {
  const keys = [...a.keys()].sort((x, y) => x - y);
  check(keys.length >= 30 && keys.length === b.size && keys.every(k => b.has(k)));
  const av = keys.map(k => Number(a.get(k)));
  const bv = keys.map(k => Number(b.get(k)));
  const rng = new Random(39009);
  const differences: number[] = [];
  const ratios: number[] = [];
  for (let i = 0; i < 10000; i += 1) {
    const indices = keys.map(() => rng.randrange(keys.length));
    const am = median(indices.map(k => av[k]));
    const bm = median(indices.map(k => bv[k]));
    differences.push(am - bm);
    ratios.push(am / bm);
  }
  differences.sort((x, y) => x - y);
  ratios.sort((x, y) => x - y);
  const am = median(av);
  const bm = median(bv);
  return { n: keys.length, jitk_median_ms: am, other_median_ms: bm, difference_ms: am - bm, difference_ci95_ms: [differences[249], differences[9749]], jitk_over_other: am / bm, ratio_ci95: [ratios[249], ratios[9749]], winner: differences[9749] < 0 ? 'jitk' : differences[249] > 0 ? 'other' : 'inconclusive' };
}
export function analyze(folder: string, verbose = true): void {
  const data = readJSON<Frame>(join(folder, 'raw.json'));
  const rows = data.samples as Frame[];
  check(rows.every(r => r.status === 'PASS'));
  const comparisons: Frame[] = [];
  for (const [j, h] of [['jitk-cold', 'hl-strict-cold'], ['jitk-parked', 'hl-strict-prespawned'], ['jitk-parked', 'hl-logical-clone']]) {
    const names = [...new Set<string>(rows.filter(r => r.mode === j).map(r => String(r.case)))].sort();
    for (const caseName of names) {
      const av = new Map<number, number>();
      const bv = new Map<number, number>();
      for (const r of rows.filter(r => r.case === caseName)) {
        if (r.mode === j) {
          av.set(r.block, r.latency_ms);
        }
        if (r.mode === h) {
          bv.set(r.block, r.latency_ms);
        }
      }
      const comparison: Frame = { jitk_mode: j, other_mode: h, case: caseName };
      Object.assign(comparison, paired(av, bv));
      comparisons.push(comparison);
    }
  }
  dump(join(folder, 'verdict.json'), comparisons);
  const summary: Frame[] = [];
  for (const name of [...new Set<string>(rows.map(r => String(r.name)))].sort()) {
    const a = rows.filter(r => r.name === name);
    const record: Frame = { name };
    for (const key of ['latency_ms', 'rss_mib', 'footprint_mib', 'max_pending']) {
      if (key in a[0]) {
        record[key] = distribution(a.map(r => Number(r[key])));
      }
    }
    record.load1 = distribution(a.map(r => Number(r.load_before[0])));
    record.gate_passed = a.filter(r => r.gate.passed).length;
    summary.push(record);
  }
  dump(join(folder, 'summary.json'), summary);
  const memory: Frame[] = [];
  for (const metric of ['rss_mib', 'footprint_mib']) {
    const units = new Map<number, Map<number, number>>();
    for (const n of [1, 17, 33]) {
      const values = new Map<number, number>();
      for (const r of rows.filter(r => r.name === 'memory/hl-logical/' + n)) {
        values.set(r.block, r[metric]);
      }
      units.set(n, values);
    }
    const one = units.get(1)!;
    const middle = units.get(17)!;
    const high = units.get(33)!;
    const marginal: number[] = [];
    const mid: number[] = [];
    const upper: number[] = [];
    for (const block of one.keys()) {
      marginal.push((Number(high.get(block)) - Number(one.get(block))) / 32);
      mid.push((Number(middle.get(block)) - Number(one.get(block))) / 16);
      upper.push((Number(high.get(block)) - Number(middle.get(block))) / 16);
    }
    const rng = new Random(39010);
    const bootstrap: number[] = [];
    for (let i = 0; i < 10000; i += 1) {
      // random.choices uses random() rather than _randbelow/getrandbits.
      bootstrap.push(median(marginal.map(() => marginal[Math.floor(rng.random() * marginal.length)])));
    }
    bootstrap.sort((a, b) => a - b);
    memory.push({ metric, logical1_total: distribution([...one.values()]), logical17_total: distribution([...middle.values()]), logical33_total: distribution([...high.values()]), marginal_1_to_33_mib: distribution(marginal), marginal_median_ci95_mib: [bootstrap[249], bootstrap[9749]], marginal_1_to_17_mib: distribution(mid), marginal_17_to_33_mib: distribution(upper) });
  }
  dump(join(folder, 'memory.json'), memory);
  if (verbose) {
    for (const c of comparisons) {
      console.log(c.jitk_mode, c.other_mode, c.case, c.winner, roundLabel(c.difference_ms), '[' + (c.difference_ci95_ms as number[]).map(roundLabel).join(', ') + ']');
    }
  }
}
