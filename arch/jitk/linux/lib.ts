import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { canonical } from "../tslib/fs.ts";
import { digest } from "../tslib/hash.ts";
import { dumpJSON } from "../tslib/json.ts";

// Shared helpers live in ../tslib; the root, tool entrypoint and record
// accessors are linux's.
export { check } from "../tslib/assert.ts";
export { digest } from "../tslib/hash.ts";
export { jsonLines as lines } from "../tslib/json.ts";
export { canonical } from "../tslib/fs.ts";
export { mean, median, fit } from "../tslib/stats.ts";
export { env, locked, sleep, status, kill, capture, run, saveResult, StreamProcess } from "../tslib/stream-process.ts";
export type { Options, Result } from "../tslib/stream-process.ts";

export const ROOT = canonical(
  process.env.JITK_LINUX_ROOT || import.meta.dirname,
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
  return [resolve(dirname(String(process.execPath)), "linux-tools"), name];
}

export type ObjectValue = Record<string, unknown>;
export function object(value: unknown): ObjectValue {
  return value as ObjectValue;
}
export function array(value: unknown): ObjectValue[] {
  return value as ObjectValue[];
}
export function num(row: ObjectValue, key: string): number {
  return Number(row[key]);
}
export function str(row: ObjectValue, key: string): string {
  return String(row[key]);
}
export function nested(row: ObjectValue, key: string): ObjectValue {
  return object(row[key]);
}
export function items(row: ObjectValue, key: string): ObjectValue[] {
  return array(row[key]);
}
