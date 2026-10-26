import { mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { workspace } from '../lib.ts';
const root = workspace('JITK_SCRATCH_REGRESSION', 'regression');
mkdirSync(join(root, 'ro'));
if (process.argv[2] === 'exception') {
  writeFileSync(join(root, 'ro/file'), 'data');
  chmodSync(join(root, 'ro/file'), 0o444);
}
chmodSync(join(root, 'ro'), 0o555);
if (process.argv[2] === 'exception') {
  throw new Error('intentional');
}
