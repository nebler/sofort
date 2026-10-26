import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { capture, check, run, environment } from '../lib.ts';
const child = resolve(import.meta.dirname, '../.work/bin/tests/scratch-test-child');
let work = mkdtempSync(join(tmpdir(), 'jitk-scratch-test-'));
try {
  const env = environment();
  delete env.JITK_SCRATCH_REGRESSION;
  env.TMPDIR = work;
  check((await capture([child, 'exception'], { env })).returncode !== 0);
  check(readdirSync(work).length === 0, 'scratch survived exception');
} finally {
  rmSync(work, { recursive: true, force: true });
}
work = mkdtempSync(join(tmpdir(), 'jitk-scratch-test-'));
try {
  const root = join(work, 'work');
  await run([child], { env: { ...environment(), JITK_SCRATCH_REGRESSION: root } });
  check(existsSync(join(root, 'ro')) && (statSync(join(root, 'ro')).mode & 0o200) !== 0);
} finally {
  rmSync(work, { recursive: true, force: true });
}
console.log('2 scratch tests passed');
