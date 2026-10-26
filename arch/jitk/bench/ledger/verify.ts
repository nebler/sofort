import { join, resolve } from 'node:path';
import { existsSync, statSync } from 'node:fs';
import { check, readJSON, dump, sha, command } from '../lib.ts';
import { files, type Frame } from '../controller.ts';

const HERE = process.env.JITK_LEDGER_DIR || import.meta.dirname;
const load = (file: string): Frame => readJSON<Frame>(join(HERE, file));
const main = load('memory-raw.json');
const extra = load('memory-n60-raw.json');
const cpu = load('cpu-raw.json');
check(main.cells.length === 60 && main.end);
check(extra.cells.length === 12 && extra.component_files.length === 12);
const cells = main.cells.concat(extra.cells) as Frame[];
const good = cells.filter(c => c.status === 'ok');
const bad = cells.filter(c => c.status === 'error');
check(good.length === 48 && bad.length === 24);
check(bad.every(c => [64, 256].includes(c.n)));
check(bad.every(c => (c.cleanup as Frame[]).filter(x => x.status === -9).length === 61));
const residuals: number[] = [];
let counters = 0;
for (const cell of good) {
  check(cell.cleanup.length === cell.n);
  for (const phase of Object.keys(cell.phases)) {
    const p = cell.phases[phase];
    check(p.processes.length === cell.n);
    for (const r of p.processes) {
      const t = r.ledger;
      const expected = t.internal - t.alternate_accounting + t.internal_compressed - t.alternate_accounting_compressed + t.iokit_mapped + t.purgeable_nonvolatile + t.purgeable_nonvolatile_compress + t.page_table;
      residuals.push(expected - r.footprint);
      counters += 1;
    }
    for (const key of Object.keys(p.diagnostics)) {
      const q = p.diagnostics[key];
      for (const name of ['vmmap-summary', 'vmmap', 'footprint', 'footprint-object']) {
        if (name in q) {
          check(q[name].status === 0 && existsSync(join(HERE, q[name].path)));
        }
      }
    }
    if (p.batch_footprint) {
      check(p.batch_footprint.status === 0);
    }
  }
}
const residual = Math.max(...residuals.map(Math.abs));
check(residual === 0);
check(cpu.samples.length === 240 && cpu.end);
check(new Set<number>((cpu.samples as Frame[]).map(r => Number(r.pid))).size === 240);
for (const kind of ['raw', 'executor']) {
  for (const mode of ['cold', 'parked']) {
    for (const caseName of ['return2', 'one_tool']) {
      check((cpu.samples as Frame[]).filter(r => r.kind === kind && r.mode === mode && r.case === caseName).length === 30);
    }
  }
}
const hvf = load('hvf-control-raw.json');
check(hvf.end && hvf.repeats.length === 3);
check((hvf.repeats as Frame[]).every(r => r.status === 'ok' && r.stages.length === 7));
check((load('controls-raw.json').repeats as Frame[]).every(r => r.status === 'ok'));
check((load('inline-raw.json').cells as Frame[]).every(c => c.status === 'ok'));
const selection = load('artifacts/selection.json');
for (const key of ['vmm', 'image', 'image-0', 'image-1', 'image-8']) {
  check(sha(selection[key].path) === selection[key].sha256);
}
const ps = command(['ps', '-axo', 'command=']).split('\n');
const owned = ps.filter(s => s.startsWith(join(HERE, 'artifacts/jitk-vmm')) || s.startsWith(join(HERE, 'artifacts/hvf-control')));
check(owned.length === 0, JSON.stringify(owned));
const result = { status: 'PASS', memory_cells_success: good.length, expected_capacity_failures: bad.length, failure_ready_vms: 61, per_process_counter_snapshots: counters, max_footprint_ledger_formula_error_bytes: residual, validated_cpu_samples: 240, hvf_control_repeats: 3, owned_workers_remaining: owned, scope_bytes: files(HERE).map(p => statSync(p).size).reduce((a, b) => a + b, 0) };
dump(join(HERE, 'verification.json'), result);
console.log(JSON.stringify(result, null, 2));
