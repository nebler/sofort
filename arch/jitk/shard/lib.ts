import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { check } from '../tslib/assert.ts';
import { canonical } from '../tslib/fs.ts';
import { digest } from '../tslib/hash.ts';
import { dumpJSON } from '../tslib/json.ts';

// Shared helpers live in ../tslib; the root and tool entrypoint are shard's.
export { check } from '../tslib/assert.ts';
export { digest } from '../tslib/hash.ts';
export { jsonLines as lines } from '../tslib/json.ts';
export { canonical } from '../tslib/fs.ts';
export { track } from '../tslib/process.ts';
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
// Cargo/rustup settings for the pinned toolchain (tools/deps.json
// rust_toolchain). Read through ROOT, so Linux tools cross-built on the Mac
// need no Mac path; rustup's bin directory is appended for ssh shells.
export function cargoEnv(): Record<string, string> {
  const pin = String(json(join(ROOT, "arch/jitk/tools/deps.json")).rust_toolchain);
  check(pin.length > 0, "tools/deps.json has no rust_toolchain");
  const home = process.env.CARGO_HOME || join(process.env.HOME || "", ".cargo");
  return { PATH: (process.env.PATH || "") + ":" + join(home, "bin"), RUSTUP_TOOLCHAIN: pin };
}
// A historical measurement's run directory (a staged checkout with its
// prepared images); there is no host default.
export function runRoot(variable: string): string {
  const value = process.env[variable] || "";
  check(value.length > 0, "set " + variable + " to the run directory");
  return resolve(value);
}
