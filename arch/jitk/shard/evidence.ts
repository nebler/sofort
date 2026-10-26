import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { check, dump, fit, mean, median, read } from './lib.ts';
export type ObjectValue = Record<string, unknown>;
export interface Fit {
  bytes_per_vm: number;
  fixed_bytes: number;
  r2: number;
}
export function object(value: unknown): ObjectValue {
  return value as ObjectValue;
}
export function array(value: unknown): ObjectValue[] {
  return value as ObjectValue[];
}
export function num(row: ObjectValue, key: string): number {
  return Number(row[key]);
}
export function str(row: ObjectValue, key: string): string {
  return String(row[key]);
}
export function nested(row: ObjectValue, key: string): ObjectValue {
  return object(row[key]);
}
export function items(row: ObjectValue, key: string): ObjectValue[] {
  return array(row[key]);
}
export function load(path: string): ObjectValue {
  const bytes = !existsSync(path) && existsSync(path + '.gz') ? gunzipSync(readFileSync(path + '.gz')) : readFileSync(path);
  return JSON.parse(bytes.toString()) as ObjectValue;
}
export function events(path: string): ObjectValue[] {
  return read(path).trim().split('\n').map((s) => JSON.parse(s) as ObjectValue);
}
export function numbers(row: ObjectValue, key: string): number[] {
  return row[key] as number[];
}
export function valueAt(row: ObjectValue, path: string[]): number {
  let current = row;
  for (let i = 0; i < path.length - 1; i++) {
    current = nested(current, path[i]);
  }
  return num(current, path[path.length - 1]);
}
export function med(row: ObjectValue, path: string[]): number {
  return median(items(row, 'samples').map((s) => valueAt(s, path)));
}
export function regression(rows: ObjectValue[], path: string[]): Fit {
  return fit(rows.map((r) => num(r, 'n')), rows.map((r) => med(r, path) * (path[0] === 'smaps_rollup_kib' ? 1024 : 1))) as Fit;
}
export function quantiles(values: number[], maximum = true): ObjectValue {
  const sorted = values.slice().sort((a, b) => a - b);
  check(sorted.length > 0, 'nonempty distribution');
  const result: ObjectValue = { n: sorted.length, p50_ns: sorted[Math.ceil(.5 * sorted.length) - 1], p99_ns: sorted[Math.ceil(.99 * sorted.length) - 1] };
  result[maximum ? 'max_ns' : 'mean_ns'] = maximum ? sorted[sorted.length - 1] : mean(sorted);
  return result;
}
export function ledgerRows(root: string, name: string, rep: number): ObjectValue[] {
  return [1, 16, 64, 256].map((n) => load(join(root, 'ledger-' + rep + '-' + name + '-' + n + '.json')));
}
function curvesFor(root: string, name: string, fields: Record<string, string[]>, peak: boolean): Record<string, Fit>[] {
  const curves: Record<string, Fit>[] = [];
  for (const rep of [0, 1]) {
    const rows = ledgerRows(root, name, rep);
    const curve: Record<string, Fit> = {};
    for (const key of Object.keys(fields)) {
      curve[key] = regression(rows, fields[key]);
    }
    if (peak) {
      curve.peak = fit(rows.map((r) => num(r, 'n')), rows.map((r) => num(r, 'memory_peak'))) as Fit;
    }
    curves.push(curve);
  }
  return curves;
}
const COMMON_FIELDS: Record<string, string[]> = {
  current: ['memory_current'], anon: ['memory_stat', 'anon'], file: ['memory_stat', 'file'], kernel: ['memory_stat', 'kernel'],
  sock: ['memory_stat', 'sock'], pss: ['smaps_rollup_kib', 'Pss'], private_dirty: ['smaps_rollup_kib', 'Private_Dirty'],
};
function ledger(root: string, name: string, r7: boolean): ObjectValue {
  const fields: Record<string, string[]> = {};
  for (const key of Object.keys(COMMON_FIELDS)) {
    fields[key] = COMMON_FIELDS[key];
  }
  if (!r7) {
    fields.rss = ['smaps_rollup_kib', 'Rss'];
  }
  const curves = curvesFor(root, name, fields, r7);
  const cells: ObjectValue[] = [];
  for (const rep of [0, 1]) {
    for (const row of ledgerRows(root, name, rep)) {
      const samples = items(row, 'samples');
      const residual: ObjectValue[] = [];
      for (const sample of samples) {
        const stat = nested(sample, 'memory_stat');
        const total = num(sample, 'memory_current');
        const accounted = ['anon', 'file', 'kernel', 'sock'].reduce((sum, key) => sum + Number(stat[key] || 0), 0);
        residual.push({ bytes: total - accounted, percent: 100 * (total - accounted) / total });
      }
      const cell: ObjectValue = {
        n: num(row, 'n'), rep, memory_current: med(row, ['memory_current']), idle_cpu_usec: row.idle_cpu_usec, residual,
        loadavg: samples.map((s) => str(s, 'loadavg').trim()),
        threads: samples.map((s) => Number(str(s, 'status').split('Threads:\t')[1].split('\n')[0])),
      };
      if (r7) {
        cell.memory_peak = row.memory_peak;
      }
      cells.push(cell);
    }
  }
  const slopes = curves.map((c) => c.current.bytes_per_vm);
  const components: Record<string, number> = {};
  for (const key of Object.keys(curves[0])) {
    components[key] = mean(curves.map((c) => c[key].bytes_per_vm));
  }
  const result: ObjectValue = {
    marginal_mib_per_vm: mean(slopes) / 2 ** 20, slope_range_bytes: [Math.min(...slopes), Math.max(...slopes)],
    fixed_mib: mean(curves.map((c) => c.current.fixed_bytes)) / 2 ** 20, components_bytes: components, curves, cells,
  };
  if (r7) {
    result.peak_mib_per_vm = mean(curves.map((c) => c.peak.bytes_per_vm)) / 2 ** 20;
  }
  return result;
}
export function analyzeR6(root: string): void {
  const ledgers: Record<string, ObjectValue> = {};
  for (const name of ['ready', 'return2', 'one_tool', 'promise10', 'json64k']) {
    ledgers[name] = ledger(root, name, false);
  }
  const bench: Record<string, ObjectValue> = {};
  for (const name of ['return2', 'one_tool', 'promise10', 'json64k', 'canary']) {
    const rows = events(join(root, name === 'canary' ? 'canary-10000.jsonl' : 'bench-' + name + '.jsonl'));
    const samples = rows.filter((r) => r.event === 'sample');
    const metrics: Record<string, ObjectValue> = {};
    for (const key of ['reset_ns', 'run_ns', 'cpu_ns', 'wait_to_finish_ns', 'owner_reply_ns']) {
      metrics[key] = quantiles(samples.map((r) => num(r, key)), false);
    }
    bench[name] = { summary: rows.find((r) => r.event === 'summary'), environment: rows[0], metrics, resets_including_mmio_drain: true, nearest_rank_percentiles: true };
  }
  dump(join(root, 'summary-r6.json'), { ledger: ledgers, bench });
  const summary: Record<string, ObjectValue> = {};
  for (const name of Object.keys(ledgers)) {
    const row = ledgers[name];
    summary[name] = { mib_per_vm: row.marginal_mib_per_vm, range_bytes: row.slope_range_bytes, fixed_mib: row.fixed_mib };
  }
  console.log(JSON.stringify(summary, null, 2));
  for (const name of Object.keys(bench)) {
    console.log(name + ' ' + JSON.stringify(bench[name].metrics));
  }
}
export function analyzeNative(root: string): void {
  function summarize(path: string, name: string): ObjectValue {
    const fields: Record<string, string[]> = { current: ['memory_current'] };
    for (const k of ['anon', 'file', 'kernel', 'pagetables', 'kernel_stack', 'slab']) {
      fields[k] = ['memory_stat', k];
    }
    for (const k of ['Pss', 'Private_Dirty']) {
      fields[k] = ['smaps_rollup_kib', k];
    }
    const curves = curvesFor(path, name, fields, false);
    const cells: ObjectValue[] = [];
    const residual: number[] = [];
    for (const rep of [0, 1]) {
      for (const row of ledgerRows(path, name, rep)) {
        cells.push({ n: row.n, rep, bytes: med(row, ['memory_current']), idle_cpu_usec: row.idle_cpu_usec });
        for (const s of items(row, 'samples')) {
          const stat = nested(s, 'memory_stat');
          residual.push((num(s, 'memory_current') - ['anon', 'file', 'kernel', 'sock'].reduce((sum, k) => sum + Number(stat[k] || 0), 0)) / num(s, 'memory_current') * 100);
        }
      }
    }
    const components: Record<string, number> = {};
    for (const key of Object.keys(curves[0])) {
      components[key] = mean(curves.map((c) => c[key].bytes_per_vm));
    }
    return { marginal_mib: components.current / 2 ** 20, components_bytes: components, curves, cells, max_abs_residual_percent: Math.max(...residual.map((n) => Math.abs(n))) };
  }
  const names = readdirSync(root).filter((n) => n.startsWith('ledger-0-') && n.endsWith('-1.json')).map((n) => n.slice('ledger-0-'.length, -'-1.json'.length)).sort();
  const tools: Record<string, ObjectValue> = {};
  for (const name of names) {
    tools[name] = summarize(root, name);
  }
  const out: ObjectValue = { tools };
  if (names.includes('native_lua')) {
    out.final = tools.native_lua;
  }
  if (existsSync(join(root, 'ledger-before'))) {
    out.before_cache_fix = summarize(join(root, 'ledger-before'), 'native_lua');
  }
  dump(join(root, 'memory-summary.json'), out);
  console.log(JSON.stringify(out, null, 2));
}
export function analyzeRng(root: string): void {
  const baselines: Record<string, number> = { return2: .484038, one_tool: .503431, promise10: .548644 };
  const ledgers: Record<string, ObjectValue> = {};
  for (const name of Object.keys(baselines)) {
    const curves: ObjectValue[] = [];
    for (const rep of [0, 1]) {
      const rows = ledgerRows(root, name, rep);
      curves.push({ current: regression(rows, ['memory_current']), private_dirty: regression(rows, ['smaps_rollup_kib', 'Private_Dirty']), kernel: regression(rows, ['memory_stat', 'kernel']), loadavg: rows.flatMap((r) => items(r, 'samples').map((s) => s.loadavg)) });
    }
    const slopes = curves.map((c) => num(nested(c, 'current'), 'bytes_per_vm'));
    const mib = mean(slopes) / 2 ** 20;
    ledgers[name] = { mib_per_vm: mib, delta_r6_mib: mib - baselines[name], slopes_bytes: slopes, curves };
  }
  const path = join(root, 'canary-10000.jsonl');
  const data = existsSync(path) ? read(path) : readdirSync(root).filter((n) => n.startsWith('canary-10000.part-') && n.endsWith('.jsonl.gz')).sort().map((n) => gunzipSync(readFileSync(join(root, n))).toString()).join('');
  const rows = data.trim().split('\n').map((s) => JSON.parse(s) as ObjectValue);
  const resets = rows.filter((r) => r.event === 'sample').map((r) => num(r, 'reset_ns')).sort((a, b) => a - b);
  const p50 = resets[Math.ceil(.5 * resets.length) - 1] / 1e6;
  const p99 = resets[Math.ceil(.99 * resets.length) - 1] / 1e6;
  const reset = { n: resets.length, p50_ms: p50, p99_ms: p99, delta_r6_p50_ms: p50 - 2.603, delta_r6_p99_ms: p99 - 3.440 };
  dump(join(root, 'summary-r7-rng.json'), { ledger: ledgers, canary_reset: reset, environment: rows[0], canary_summary: rows.find((r) => r.event === 'summary') });
  const output: Record<string, ObjectValue> = {};
  for (const name of Object.keys(ledgers)) {
    const r = ledgers[name];
    output[name] = { mib_per_vm: r.mib_per_vm, delta_r6_mib: r.delta_r6_mib, slopes_bytes: r.slopes_bytes };
  }
  console.log(JSON.stringify(output, null, 2));
  console.log(JSON.stringify(reset, null, 2));
}
function integrationLedger(path: string, name: string): ObjectValue {
  const curves: Record<string, Fit>[] = [];
  for (const rep of [0, 1]) {
    const cells = ledgerRows(path, name, rep);
    check(cells.every((c) => num(c, 'idle_cpu_usec') === 0), 'idle CPU must be zero');
    const fields: Record<string, string[]> = { current: ['memory_current'], anon: ['memory_stat', 'anon'], file: ['memory_stat', 'file'], kernel: ['memory_stat', 'kernel'], private_dirty: ['smaps_rollup_kib', 'Private_Dirty'] };
    const curve: Record<string, Fit> = {};
    for (const key of Object.keys(fields)) {
      curve[key] = regression(cells, fields[key]);
    }
    curve.peak = fit(cells.map((r) => num(r, 'n')), cells.map((r) => num(r, 'memory_peak'))) as Fit;
    curves.push(curve);
  }
  const means: Record<string, number> = {};
  for (const key of Object.keys(curves[0])) {
    means[key] = mean(curves.map((c) => c[key].bytes_per_vm)) / 2 ** 20;
  }
  return { curves, mean_mib: means };
}
function validateHostile(rows: ObjectValue[], name: string, indexed: boolean): ObjectValue[] {
  const samples = rows.filter((r) => r.event === 'contained');
  check(samples.length === 100, '100 contained runs required');
  for (let i = 0; i < samples.length; i++) {
    const row = samples[i];
    if (indexed) {
      check(num(row, 'i') === i, 'contained run index');
    }
    if (name === 'arena_attack') {
      check(row.error === 'memory_bound: write outside class arena at 0x80000000', 'arena containment error');
    } else {
      check(JSON.stringify(row.result) === '{"err":{"name":"InternalError","message":"out of memory"}}', 'OOM containment');
    }
  }
  return samples;
}
export function analyzeIntegrate(root: string): void {
  const native: Record<string, ObjectValue> = {};
  const dirty: Record<string, ObjectValue> = {};
  const hostile: Record<string, number> = {};
  for (const name of ['jq-musl', 'sqlite3', 'busybox', 'zstd', 'lua', 'micropython']) {
    native[name] = integrationLedger(join(root, 'raw-native-ledger'), name);
  }
  for (const cls of ['glue-2m', 'glue-4m']) {
    dirty[cls] = integrationLedger(join(root, cls === 'glue-2m' ? 'raw-shard' : 'raw-classes/glue-4m'), 'attack_hold');
    for (const fixture of cls === 'glue-2m' ? ['bomb', 'arena_attack', 'json64k'] : ['bomb', 'arena_attack']) {
      const path = cls === 'glue-2m' ? join(root, 'raw-shard/hostile-' + fixture + '.jsonl') : join(root, 'raw-classes/hostile-' + cls + '-' + fixture + '.jsonl');
      hostile[cls + '/' + fixture] = validateHostile(events(path), fixture, false).length;
    }
  }
  const out = { native, dirty_classes: dirty, hostile_counts: hostile };
  dump(join(root, 'raw/integration-summary.json'), out);
  console.log(JSON.stringify(out, null, 2));
}
export function analyzeShard(root: string): void {
  const ledgers: Record<string, ObjectValue> = {};
  for (const name of ['ready', 'return2', 'one_tool', 'promise10', 'json64k', 'bomb', 'attack_hold']) {
    ledgers[name] = ledger(root, name, true);
  }
  const bench: Record<string, ObjectValue> = {};
  for (const name of ['return2', 'one_tool', 'promise10', 'canary']) {
    const rows = events(join(root, 'bench-' + name + '.jsonl'));
    const samples = rows.filter((r) => r.event === 'sample');
    const metrics: Record<string, ObjectValue> = {};
    for (const key of ['reset_ns', 'run_ns', 'owner_reply_ns', 'wait_to_finish_ns']) {
      metrics[key] = quantiles(samples.map((r) => num(r, key)));
    }
    bench[name] = { n: samples.length, metrics, cpu_mean_ns: mean(samples.map((r) => num(r, 'cpu_ns'))), environment: rows[0], summary: rows[rows.length - 1] };
  }
  const hostile: Record<string, ObjectValue> = {};
  for (const name of ['bomb', 'arena_attack', 'json64k']) {
    const rows = events(join(root, 'hostile-' + name + '.jsonl'));
    const samples = validateHostile(rows, name, true);
    hostile[name] = { n: samples.length, outcome: samples[0], environment: rows[0] };
  }
  const stressRows = events(join(root, 'stress-10000.jsonl'));
  const stress = stressRows[stressRows.length - 1];
  check(num(stress, 'runs') === 10000 && num(stress, 'canary_leaks') === 0 && num(stress, 'cross_talk') === 0 && num(stress, 'fresh_entropy') === num(stress, 'runs'), 'stress receipt');
  const batches: Record<string, ObjectValue> = {};
  for (const key of ['batch_ns', 'max_run_ns']) {
    batches[key] = quantiles(stressRows.filter((r) => r.event === 'stress_batch').map((r) => num(r, key)));
  }
  const wait = load(join(root, 'wait-1024.json'));
  const waitEvents = items(wait, 'events');
  check(num(wait, 'n') === 1024 && num(waitEvents[waitEvents.length - 1], 'lost') === 0, 'wait receipts');
  check(num(waitEvents[0], 'owners') === 4 && (wait.task_ids as string[]).length === 5 && str(wait, 'watchdog_status').includes('Threads:\t1\n'), 'wait owners and watchdog');
  const deadlines: Record<string, ObjectValue> = {};
  for (const n of [1, 16, 64]) {
    const paths = readdirSync(root).filter((p) => p.startsWith('deadlines-' + n + '-') && p.endsWith('.jsonl')).sort();
    check(paths.length === 5, 'five deadline batches');
    let samples: ObjectValue[] = [];
    const environments: ObjectValue[] = [];
    for (const path of paths) {
      const rows = events(join(root, path));
      const batch = rows.filter((r) => r.event === 'deadline');
      check(batch.length === n && num(rows[rows.length - 1], 'reused_cleanly') === n, 'deadline reuse');
      samples = samples.concat(batch);
      environments.push(rows[0]);
    }
    deadlines[String(n)] = { batches: paths.length, environments, stop_latency_ns: quantiles(samples.map((r) => num(r, 'stop_latency_ns'))), reset_error_latency_ns: quantiles(samples.map((r) => num(r, 'reset_error_latency_ns'))) };
  }
  const staggered: number[] = [];
  for (const path of readdirSync(root).filter((p) => p.startsWith('staggered-') && p.endsWith('.jsonl')).sort()) {
    const rows = events(join(root, path));
    check(Boolean(rows[rows.length - 1].unrelated_spins_survived_early_expiry), 'staggered expiry');
    for (const r of rows.filter((r) => r.event === 'staggered_deadline')) {
      staggered.push(num(r, 'reset_error_latency_ns'));
    }
  }
  check(staggered.length === 40, '40 staggered deadlines');
  const escalation = load(join(root, 'escalation.json'));
  check(num(escalation, 'returncode') === -9, 'escalation SIGKILL');
  const cleanup = load(join(root, 'ledger-cleanup.json'));
  check((cleanup.remaining_cgroups as string[]).length === 0 && Object.values(nested(cleanup, 'memory_events')).every((v) => Number(v) === 0), 'ledger cleanup');
  const ready = load(join(root, 'ledger-2-ready-1024.json'));
  check(num(ready, 'n') === 1024 && num(ready, 'idle_cpu_usec') === 0, '1024 READY idle');
  dump(join(root, 'summary-r7-shard.json'), { ledger: ledgers, bench, hostile, stress, wait, stress_batches: batches, deadlines, staggered: quantiles(staggered), escalation, ready_1024_current_bytes: med(ready, ['memory_current']), ledger_cleanup: cleanup });
  const output: Record<string, ObjectValue> = {};
  for (const name of Object.keys(ledgers)) {
    const row = ledgers[name];
    output[name] = { marginal_mib_per_vm: row.marginal_mib_per_vm, peak_mib_per_vm: row.peak_mib_per_vm, slope_range_bytes: row.slope_range_bytes, fixed_mib: row.fixed_mib };
  }
  console.log(JSON.stringify(output, null, 2));
  console.log(JSON.stringify(deadlines, null, 2));
}
