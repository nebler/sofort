import { mkdirSync, mkdtempSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { dump, readJSON, hashJSON, sha, check } from './lib.ts';
import { type Frame } from './controller.ts';
import { analyze as hyperlight } from './hyperlight/analysis.ts';
import { analyze, analyzeCPU } from './ledger/analysis.ts';

const HERE = import.meta.dirname;
const fixture = readJSON<Frame>(join(HERE, 'parity-fixture.json'));
const directory = mkdtempSync(join(HERE, 'build/analysis-'));
const hl = fixture.analysis.hyperlight;
const source = join(HERE, hl.input);
check(sha(source) === hl.sha256, 'Hyperlight input changed');
copyFileSync(source, join(directory, 'raw.json'));
hyperlight(directory, false);
for (const name of Object.keys(hl.outputs)) {
  check(hashJSON(readJSON<unknown>(join(directory, name))) === hl.outputs[name], 'Hyperlight parity: ' + name);
}
const cpu = fixture.analysis.cpu;
const cpuSource = join(HERE, cpu.input);
check(sha(cpuSource) === cpu.sha256, 'CPU input changed');
check(hashJSON(analyzeCPU(cpuSource, join(directory, 'cpu-summary.json'), false)) === cpu.digest, 'CPU analysis parity');
console.log('PASS Hyperlight 10000-resample comparisons, summaries, marginal memory; ledger CPU summaries');
// --memory (make test-memory): the recorded ledger memory collection, kept
// outside the repository; JITK_LEDGER_INPUTS names its directory.
if (process.argv.includes('--memory')) {
  const memoryRoot = process.env.JITK_LEDGER_INPUTS || '';
  check(memoryRoot !== '', 'set JITK_LEDGER_INPUTS to the preserved ledger collection directory');
  const memory = fixture.analysis.memory;
  for (const entry of memory.sources) {
    check(sha(join(memoryRoot, entry.path)) === entry.sha256, 'memory input changed: ' + entry.path);
  }
  const main = readJSON<Frame>(join(memoryRoot, 'memory-raw.json'));
  const extra = readJSON<Frame>(join(memoryRoot, 'memory-n60-raw.json'));
  const cells = (main.cells as Frame[]).concat(extra.cells as Frame[]);
  const input = join(directory, 'memory-combined.json');
  dump(input, { cells });
  check(hashJSON(analyze(input, join(directory, 'memory-summary.json'), false)) === memory.digest, 'memory OLS parity');
  console.log('PASS recorded ledger memory totals, bracket deltas, and OLS fits');
}
