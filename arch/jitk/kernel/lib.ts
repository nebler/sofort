// Shared helpers live in ../tslib; the clock/usage FFI bridge is kernel's.
export { check, same } from '../tslib/assert.ts';
export { digest as sha } from '../tslib/hash.ts';
export { readJSON, asciiJSON as json, dumpASCII as dump } from '../tslib/json.ts';
export { files, writable, workspace, copyTree } from '../tslib/fs.ts';
export { environment, sleep, track } from '../tslib/process.ts';
export { capture, run, output } from '../tslib/subprocess.ts';
export type { Result, Options } from '../tslib/subprocess.ts';
// CPython Random(integer).randbytes for exact resource fixture bytes.
export { PythonRandom } from '../tslib/random.ts';

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
