import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import * as subprocess from '../tslib/subprocess.ts';
import type { Options, Result } from '../tslib/subprocess.ts';

// Shared helpers live in ../tslib; timeout sampling and the clock/usage FFI
// bridge are scriptc-corpus's.
export { check, same } from '../tslib/assert.ts';
export { digest as sha } from '../tslib/hash.ts';
export { readJSON, asciiJSON as json, dumpASCII as dump } from '../tslib/json.ts';
export { files, writable, workspace, copyTree } from '../tslib/fs.ts';
export { environment, sleep } from '../tslib/process.ts';
export { output } from '../tslib/subprocess.ts';
export type { Result, Options } from '../tslib/subprocess.ts';
export { PythonRandom } from '../tslib/random.ts';

// A timed-out child is sampled before its process group is killed, so a stall
// can be told apart from the lost child-exit wakeup (SCRIPTC-GAPS.md).
function sample(command: string[]): (pid: number) => void {
  return (pid: number): void => {
    if (process.platform !== 'darwin') {
      return;
    }
    try {
      mkdirSync('.work/samples', { recursive: true });
      execFileSync('sample', [String(pid), '1', '1', '-file', '.work/samples/' + pid + '.txt'], { timeout: 3000, stdio: 'ignore' });
      writeFileSync('.work/samples/' + pid + '.command.json', JSON.stringify(command));
    } catch { /* A child may exit between deadline and sample. */ }
  };
}

export async function capture(command: string[], options: Options = {}): Promise<Result> {
  return await subprocess.capture(command, options, sample(command));
}

export async function run(command: string[], options: Options = {}): Promise<Result> {
  return await subprocess.run(command, options, sample(command));
}

declare function nativeRealtimeMs(): number;
declare function nativeCounterMs(): number;
declare function nativeUsage(pid: number, field: number): number;
export function realtimeMs(): number {
  return nativeRealtimeMs();
}
export function counterMs(): number {
  return nativeCounterMs();
}
export function usage(pid: number): { rss: number; footprint: number } | null {
  const rss = nativeUsage(pid, 0);
  return rss < 0 ? null : { rss, footprint: nativeUsage(pid, 1) };
}
