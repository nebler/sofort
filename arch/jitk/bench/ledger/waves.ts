import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readJSON, dump } from '../lib.ts';
import { type Frame } from '../controller.ts';

const HERE = process.env.JITK_LEDGER_DIR || import.meta.dirname;
let all: Frame | null = null;
const cells: Frame[] = [];
const componentFiles: string[] = [];
for (let repeat = 0; repeat < 3; repeat += 1) {
  for (const variant of ['current', '0', '1', '8']) {
    const output = join(HERE, `n60-r${repeat}-${variant}.json`);
    execFileSync('/usr/bin/lockf', ['-k', '/tmp/sofort-bench.lock', join(HERE, '../build/ledger'), 'memory', '--variants', variant, '--counts', '60', '--repeats', '1', '--output', output], { stdio: 'inherit' });
    const part = readJSON<Frame>(output);
    if (!all) {
      all = {};
      Object.assign(all, part);
      all.cells = cells;
      all.component_files = componentFiles;
    }
    for (const cell of part.cells) {
      cell.repeat = repeat;
      cells.push(cell);
    }
    componentFiles.push(`n60-r${repeat}-${variant}.json`);
    all.end = part.end;
    dump(join(HERE, 'memory-n60-raw.json'), all);
  }
}
