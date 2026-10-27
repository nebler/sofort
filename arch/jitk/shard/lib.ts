import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { canonical } from '../tslib/fs.ts';
import { digest } from '../tslib/hash.ts';
import { dumpJSON } from '../tslib/json.ts';

// Shared helpers live in ../tslib; the root and tool entrypoint are shard's.
export { check } from '../tslib/assert.ts';
export { digest } from '../tslib/hash.ts';
export { jsonLines as lines } from '../tslib/json.ts';
export { canonical } from '../tslib/fs.ts';
export { mean, median, fit } from '../tslib/stats.ts';
export { env, locked, sleep, status, kill, capture, run, saveResult, StreamProcess } from '../tslib/stream-process.ts';
export type { Options, Result } from '../tslib/stream-process.ts';

export const ROOT = canonical(
  process.env.JITK_NATIVE_ROOT || resolve(import.meta.dirname, "../../.."),
);
export type Json = any;
export function read(path: string): string {
  return readFileSync(path, "utf8");
}
export function json(path: string): Json {
  return JSON.parse(read(path));
}
export function dump(path: string, value: unknown, pretty = true): void {
  dumpJSON(path, value, pretty ? 2 : 0);
}
export function sha(path: string): string {
  return digest(readFileSync(path));
}
export function tool(name: string): string[] {
  return [resolve(dirname(String(process.execPath)), "shard-tools"), name];
}
