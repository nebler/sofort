// Shared by check.ts, materialize.ts, gen-types.ts and the capture scripts:
// the task.json shape, the replay key, and the recorded-call line. Matches
// bench/v1/harness/contract.ts (TaskSpec, RecordedCall); extra fields here
// (title, prompt, sizes, outputDescription, kind, database) are ignored by
// the harness driver.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TASKS = dirname(dirname(fileURLToPath(import.meta.url)));

export interface ToolSpec {
  description: string;
  inputSchema: unknown;
  outputDescription?: string;
}

export interface TaskSpec {
  id: string;
  name: string;
  title: string;
  description: string;
  prompt: string;
  kind?: 'js' | 'sql';
  database?: string;
  providers: { name: string; tools: Record<string, ToolSpec> }[];
  responses: string;
  oracle: string;
  programs: string[];
  sizes: Record<string, number | string>;
  source: Record<string, string>;
}

export interface RecordedCall {
  namespace: string;
  tool: string;
  args: unknown[];
  response?: unknown;
  error?: string;
  latencyMs: number;
  bytes: number;
}

// Recursive sorted-key JSON; undefined object members are dropped, as
// JSON.stringify drops them. The harness replay uses the same key.
export function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return '[' + value.map(item => (item === undefined ? 'null' : canonical(item))).join(',') + ']';
  }
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value as object)
      .filter(key => (value as Record<string, unknown>)[key] !== undefined)
      .sort();
    return (
      '{' +
      keys.map(key => JSON.stringify(key) + ':' + canonical((value as Record<string, unknown>)[key])).join(',') +
      '}'
    );
  }
  return JSON.stringify(value);
}

export function callKey(namespace: string, tool: string, args: unknown[]): string {
  return namespace + '.' + tool + ' ' + canonical(args);
}

export function sha256(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

export function taskIds(): string[] {
  return readdirSync(TASKS)
    .filter(name => /^t\d+-/.test(name) && statSync(join(TASKS, name)).isDirectory())
    .sort();
}

export function readTask(id: string): TaskSpec {
  return JSON.parse(readFileSync(join(TASKS, id, 'task.json'), 'utf8')) as TaskSpec;
}

export function readResponses(id: string): RecordedCall[] {
  const text = readFileSync(join(TASKS, id, 'responses.jsonl'), 'utf8');
  return text
    .split('\n')
    .filter(line => line.length > 0)
    .map(line => JSON.parse(line) as RecordedCall);
}

export function bytesOf(response: unknown): number {
  return Buffer.byteLength(JSON.stringify(response) ?? 'null');
}

// Runs a program file (an `async () => {...}` expression) with one global per
// provider namespace, the way codemode exposes them.
export async function runProgram(code: string, namespaces: Record<string, unknown>): Promise<unknown> {
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (
    ...args: string[]
  ) => (...values: unknown[]) => Promise<unknown>;
  const names = Object.keys(namespaces);
  const body = 'return await (' + code.trim().replace(/;$/, '') + ')();';
  return await new AsyncFunction(...names, body)(...names.map(name => namespaces[name]));
}
