import { check, lines, read, mean, type Json } from './lib.ts';
interface Sample {
  event: string;
  result: { ok: number | number[] };
}
interface Summary {
  [key: string]: unknown;
  fixture: string;
  n: number;
  fresh_entropy_count: number;
  math_random_distinct: number;
  libc_random_distinct: number;
}
export function checkRng(path: string): void {
  const rows = lines(path) as Sample[];
  const samples = rows.filter((r) => r.event === 'sample');
  const summaryText = read(path).split('\n').find((s) => s.length > 0 && (JSON.parse(s) as {event: string}).event === 'summary');
  if (summaryText === undefined) {
    throw new Error('missing RNG summary');
  }
  const summary = JSON.parse(summaryText) as Summary;
  const canary = summary.fixture === 'canary';
  const values = samples.map((r) => canary ? (r.result.ok as number[])[2] : Number(r.result.ok));
  const n = values.length;
  const ordered = values.slice().sort((a, b) => a - b);
  let ks = 0;
  for (let i = 0; i < n; i++) {
    ks = Math.max(ks, (i + 1) / n - ordered[i], ordered[i] - i / n);
  }
  const average = mean(values);
  const variance = mean(values.map((x) => (x - average) ** 2));
  const bins: number[] = [];
  for (let i = 0; i < 20; i++) {
    bins.push(values.filter((v) => i / 20 <= v && v < (i + 1) / 20).length);
  }
  const chi = bins.reduce((s, b) => s + (b - n / 20) ** 2 / (n / 20), 0);
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    denominator += (values[i] - average) ** 2;
    if (i + 1 < n) {
      numerator += (values[i] - average) * (values[i + 1] - average);
    }
  }
  const serial = variance ? numerator / denominator : 1;
  const distinct = new Set(values).size;
  const checks: Record<string, boolean> = {
    complete: n === summary.n, distinct: distinct === n, range: values.every((x) => x >= 0 && x < 1),
    fresh_host_entropy: summary.fresh_entropy_count === n, math_summary: summary.math_random_distinct === distinct,
  };
  if (n >= 1000) {
    checks.ks = ks < 1.95 / Math.sqrt(n);
    checks.mean = Math.abs(average - .5) < 5 / Math.sqrt(12 * n);
    checks.variance = Math.abs(variance - 1 / 12) < .01;
    checks.chi_square = chi < 60;
    checks.serial_correlation = Math.abs(serial) < 5 / Math.sqrt(n);
  }
  if (canary) {
    for (const pair of [['libc_distinct', '3'], ['saved_function_distinct', '4'], ['entropy_distinct', '1'], ['generations_distinct', '0']]) {
      checks[pair[0]] = new Set(samples.map((r) => (r.result.ok as number[])[Number(pair[1])])).size === n;
    }
    checks.libc_summary = summary.libc_random_distinct === n;
  }
  const passed = Object.values(checks).every((value) => value);
  console.log(JSON.stringify({ path, n, distinct, mean: average, variance, ks, chi_square_19df: chi, bins, serial_correlation: serial, checks, summary, passed }, null, 2));
  process.exitCode = passed ? 0 : 1;
}
