import { resolve } from 'node:path';
import { run } from '../lib.ts';
for (const name of ['test_scratch', 'checks', 'clock-check', 'run-probes', 'grow_contract']) {
  await run([resolve(import.meta.dirname, '../.work/bin/tests', name)], { inherit: true });
}
