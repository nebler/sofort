import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { readJSON, dump, median, fixed } from '../lib.ts';
import { type Frame } from '../controller.ts';
import { analyze, analyzeCPU } from './analysis.ts';

const HERE = process.env.JITK_LEDGER_DIR || import.meta.dirname;
const main = readJSON<Frame>(join(HERE, 'memory-raw.json'));
const extra = readJSON<Frame>(join(HERE, 'memory-n60-raw.json'));
const merged: Frame = {};
Object.assign(merged, main);
merged.cells = main.cells.concat(extra.cells);
merged.component_files = ['memory-raw.json', 'memory-n60-raw.json'];
dump(join(HERE, 'memory-combined.json'), merged);
const summary = analyze(join(HERE, 'memory-combined.json'), join(HERE, 'summary.json'));
const cpu = analyzeCPU(join(HERE, 'cpu-raw.json'), join(HERE, 'cpu-summary.json'));
const lines: string[] = [];
const write = (s = ''): void => { lines.push(s); };
function table(headers: string[], rows: string[][]): void {
  write('| ' + headers.join(' | ') + ' |');
  write('| ' + headers.map(() => '---').join(' | ') + ' |');
  for (const row of rows) {
    write('| ' + row.join(' | ') + ' |');
  }
  write();
}
const M = 1048576;
const rows = summary.rows as Frame[];
write('Memory totals, median over three independent cells; MiB. Footprint includes logical compressed memory.');
write();
const memoryRows: string[][] = [];
for (const variant of ['current', '0', '1', '8']) {
  for (const n of [1, 16, 60]) {
    if (!rows.some(r => r.variant === variant && r.n === n)) {
      continue;
    }
    const cells = [variant, String(n)];
    for (const phase of ['ready', 'one_tool_wait']) {
      for (const [group, key] of [['sums', 'footprint'], ['sums', 'rss'], ['ledgers', 'internal_compressed']]) {
        cells.push(fixed(median(rows.filter(r => r.variant === variant && r.n === n && r.phase === phase).map(r => Number(r[group][key]) / M)), 3));
      }
    }
    memoryRows.push(cells);
  }
}
table(['image', 'N', 'READY footprint sum', 'READY RSS sum', 'READY compressed sum', 'tool-wait footprint sum', 'tool-wait RSS sum', 'tool-wait compressed sum'], memoryRows);
write('OLS total = intercept + N × marginal, across N=0/1/16/60 and all repeats; MiB.');
write();
const fits: string[][] = [];
for (const key of Object.keys(summary.fits)) {
  const f = summary.fits[key];
  const row = [key];
  for (const [q, metric] of [['sums/footprint', 'slope'], ['sums/footprint', 'intercept'], ['sums/rss', 'slope'], ['ledgers/page_table', 'slope'], ['ledgers/tkm_private', 'slope']]) {
    row.push(fixed(Number(f[q][metric]) / M, 5));
  }
  fits.push(row);
}
table(['image/state', 'footprint marginal', 'footprint intercept', 'RSS marginal', 'page-table marginal', 'tkm_private marginal (overlaps)'], fits);
write('System bracket deltas at N=60, per VM: median [min,max] over three cells; MiB.');
write();
const deltas: string[][] = [];
for (const variant of ['current', '0', '1', '8']) {
  for (const phase of ['ready', 'one_tool_wait']) {
    const row = [variant + '/' + phase];
    for (const key of ['Pages wired down', 'Pages occupied by compressor', 'Anonymous pages', 'File-backed pages']) {
      const values = rows.filter(r => r.variant === variant && r.n === 60 && r.phase === phase).map(r => Number(r.system_deltas[key]) / M / 60);
      row.push(`${fixed(median(values), 3)} [${fixed(Math.min(...values), 3)},${fixed(Math.max(...values), 3)}]`);
    }
    deltas.push(row);
  }
}
table(['image/state', 'wired', 'compressor physical', 'anonymous resident', 'file-backed resident'], deltas);
write('CPU medians, CPU-ms user / sys (total); each row n=30 unless a phase boundary was unavailable.');
write();
function cp(v: Frame): string {
  return `${fixed(Number(v.user_ms.p50), 3)} / ${fixed(Number(v.system_ms.p50), 3)} (${fixed(Number(v.total_ms.p50), 3)}; n=${v.n})`;
}
const cpuRows: string[][] = [];
for (const key of Object.keys(cpu)) {
  const row = [key];
  for (const phase of ['vmm_boot', 'vmm_execute', 'vmm_teardown', 'vmm_lifecycle', 'node_execute', 'node_lifecycle', 'watchdog_run']) {
    row.push(phase in cpu[key] ? cp(cpu[key][phase]) : 'unavailable');
  }
  cpuRows.push(row);
}
table(['path/mode/case', 'VMM boot', 'VMM execute', 'VMM teardown', 'VMM lifecycle', 'Node execute', 'Node lifecycle', 'watchdog per run'], cpuRows);
writeFileSync(join(HERE, 'TABLES.md'), lines.join('\n') + '\n');
