import { readJSON, dump, median, sum } from '../lib.ts';
import { type Frame } from '../controller.ts';

// statistics.mean sums binary floats exactly before the final division.
// Preserve that behavior, including cancellation, using an integer superaccumulator.
export function mean(values: number[]): number {
  const buffer = Buffer.alloc(8);
  let total = 0n;
  for (const value of values) {
    buffer.writeDoubleLE(value, 0);
    const bits = buffer.readBigUInt64LE(0);
    const exponent = Number((bits >> 52n) & 2047n);
    const fraction = bits & 0xfffffffffffffn;
    let term = exponent === 0 ? fraction : (fraction | 0x10000000000000n) << BigInt(exponent - 1);
    if (bits >> 63n) {
      term = -term;
    }
    total += term;
  }
  if (total === 0n) {
    return 0;
  }
  // Divide while still exact, then round to nearest, ties to even at 53 bits.
  const negative = total < 0n;
  let numerator = negative ? -total : total;
  const denominator = BigInt(values.length);
  let shift = Math.max(0, numerator.toString(2).length - denominator.toString(2).length - 53);
  let divisor = denominator << BigInt(shift);
  let quotient = numerator / divisor;
  if (quotient >= 0x20000000000000n) {
    shift += 1;
    divisor <<= 1n;
    quotient = numerator / divisor;
  }
  const remainder = numerator % divisor;
  if (remainder * 2n > divisor || (remainder * 2n === divisor && (quotient & 1n) !== 0n)) {
    quotient += 1n;
  }
  const result = Number(quotient) * Math.pow(2, shift - 1074);
  return negative ? -result : result;
}
export function fit(points: number[][]): Frame {
  const xm = mean(points.map(p => p[0]));
  const ym = mean(points.map(p => p[1]));
  const numerator = sum(points.map(point => (point[0] - xm) * (point[1] - ym)));
  const denominator = sum(points.map(point => (point[0] - xm) ** 2));
  const slope = numerator / denominator;
  const intercept = ym - slope * xm;
  return { slope, intercept, max_residual: Math.max(...points.map(p => Math.abs(p[1] - (slope * p[0] + intercept)))) };
}
export function analyze(input: string, output: string, verbose = true): Frame {
  const data = readJSON<Frame>(input);
  const summaryRows: Frame[] = [];
  const summary: Frame = { fits: {}, rows: summaryRows };
  for (const cell of data.cells) {
    if (cell.status !== 'ok') {
      continue;
    }
    for (const phase of Object.keys(cell.phases)) {
      const p = cell.phases[phase];
      const sums: Frame = {};
      const ledgers: Frame = {};
      const deltas: Frame = {};
      for (const key of ['footprint', 'rss', 'wired', 'footprint_peak']) {
        let total = 0;
        for (const r of p.processes) {
          total += r[key] || 0;
        }
        sums[key] = total;
      }
      for (const key of ['internal', 'internal_compressed', 'external', 'page_table', 'tkm_private', 'tkm_shared', 'phys_footprint', 'alternate_accounting', 'purgeable_nonvolatile']) {
        let total = 0;
        for (const r of p.processes) {
          total += (r.ledger || {})[key] || 0;
        }
        ledgers[key] = total;
      }
      const vm = (s: Frame, k: string): number => ((s.vm_pages || {})[k] || 0) * (s.page_size || 1);
      for (const key of ['Pages wired down', 'Pages occupied by compressor', 'Anonymous pages', 'File-backed pages', 'Pages free', 'Pages active', 'Pages inactive', 'Pages stored in compressor']) {
        deltas[key] = vm(p.system, key) - (vm(cell.before, key) + vm(cell.after, key)) / 2;
      }
      summaryRows.push({ repeat: cell.repeat, variant: cell.variant, n: cell.n, phase, sums, ledgers, system_deltas: deltas });
    }
  }
  const variants = [...new Set<string>((summary.rows as Frame[]).map(r => String(r.variant)))].sort();
  for (const variant of variants) {
    for (const phase of ['ready', 'one_tool_wait']) {
      const rows = (summary.rows as Frame[]).filter(r => r.variant === variant && r.phase === phase);
      if (new Set<number>(rows.map(r => Number(r.n))).size < 2) {
        continue;
      }
      const fits: Frame = {};
      for (const group of ['sums', 'ledgers', 'system_deltas']) {
        for (const key of Object.keys(rows[0][group])) {
          fits[group + '/' + key] = fit(rows.map(r => [Number(r.n), Number(r[group][key])]));
        }
      }
      summary.fits[variant + '/' + phase] = fits;
    }
  }
  dump(output, summary);
  if (verbose) {
    console.log(JSON.stringify(summary.fits, null, 2));
  }
  return summary;
}
function delta(a: Frame | null | undefined, b: Frame | null | undefined): Frame | null {
  if (!a || !b || !['user_ms', 'system_ms'].every(k => k in a && k in b)) {
    return null;
  }
  return { user_ms: a.user_ms - b.user_ms, system_ms: a.system_ms - b.system_ms };
}
export function analyzeCPU(input: string, output: string, verbose = true): Frame {
  const data = readJSON<Frame>(input);
  const groups = new Map<string, Frame[]>();
  for (const row of data.samples) {
    const key = [row.kind, row.mode, row.case].join('/');
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    const before = row.mode === 'parked' ? row.vmm_before_run : row.vmm_ready;
    const phases: Frame = { vmm_boot: row.vmm_ready, vmm_execute: delta(row.vmm_done, before), vmm_teardown: delta(row.vmm_total, row.vmm_done), vmm_lifecycle: row.vmm_total, watchdog_run: delta(row.watchdog_after, row.watchdog_before) };
    if (row.kind === 'raw') {
      phases.node_boot = delta(row.ready.node, row.node_start.node);
      phases.node_execute = delta(row.done.node, row.before_run.node);
      phases.node_teardown = delta(row.reaped.node, row.done.node);
      phases.node_lifecycle = delta(row.reaped.node, row.node_start.node);
    } else {
      const boot = delta(row.ready.node, row.boot_start.node);
      let execute = delta(row.resolved.node, row.before_run.node);
      if (row.mode === 'cold') {
        execute = delta(execute, boot);
      }
      phases.node_boot = boot;
      phases.node_execute = execute;
      phases.node_teardown = delta(row.after_close.node, row.resolved.node);
      phases.node_lifecycle = delta(row.after_close.node, row.prepare_start.node);
    }
    for (const key of Object.keys(phases)) {
      if (phases[key] !== null) {
        phases[key].total_ms = phases[key].user_ms + phases[key].system_ms;
      }
    }
    phases.service_lifecycle = null;
    if (phases.watchdog_run) {
      const total: Frame = {};
      for (const key of ['user_ms', 'system_ms', 'total_ms']) {
        total[key] = ['vmm_lifecycle', 'node_lifecycle', 'watchdog_run'].reduce((sum, p) => sum + phases[p][key], 0);
      }
      phases.service_lifecycle = total;
    }
    groups.get(key)!.push(phases);
  }
  const result: Frame = {};
  for (const [key, rows] of groups) {
    result[key] = {};
    for (const phase of Object.keys(rows[0])) {
      const values = rows.map(r => r[phase] as Frame | null).filter(v => v !== null) as Frame[];
      if (!values.length) {
        continue;
      }
      const entry: Frame = { n: values.length };
      for (const metric of ['user_ms', 'system_ms', 'total_ms']) {
        const xs = values.map(v => Number(v[metric]));
        entry[metric] = { p50: median(xs), mean: mean(xs), min: Math.min(...xs), max: Math.max(...xs) };
      }
      result[key][phase] = entry;
    }
  }
  dump(output, result);
  if (verbose) {
    console.log(JSON.stringify(result, null, 2));
  }
  return result;
}
