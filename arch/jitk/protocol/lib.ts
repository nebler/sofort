import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

// Shared helpers live in ../tslib; receipt placement is protocol's.
export { check } from '../tslib/assert.ts';
export { digest as sha } from '../tslib/hash.ts';
export { readJSON, asciiJSON as json, dumpASCII as dump } from '../tslib/json.ts';
export { files } from '../tslib/fs.ts';
export { environment } from '../tslib/process.ts';
export { capture, run, output } from '../tslib/subprocess.ts';
export type { Result, Options } from '../tslib/subprocess.ts';

export function receiptPath(name: string): string {
  const path = join(import.meta.dirname, process.env.JITK_RECORD === '1' ? '' : '.work', name);
  mkdirSync(dirname(path), { recursive: true });
  return path;
}
