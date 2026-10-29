import { type ChildProcess } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdtempSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { shaFile } from '../tslib/hash.ts';
import { spawnCapture, startDirect } from '../tslib/process.ts';

// Shared helpers live in ../tslib; grow keeps its gate assertion, u64-safe
// JSON, environment policy, process result shape and CSV.
export { detail, equal } from '../tslib/assert.ts';
export { shaFile as sha, digest as hashBytes } from '../tslib/hash.ts';
export { removeTree as cleanup } from '../tslib/fs.ts';
// CPython integer-seeded shuffle, for E1's exact historical seed/order.
export { pythonShuffle } from '../tslib/random.ts';
export { track } from '../tslib/process.ts';

export function check(condition: unknown, message = 'assertion failed'): asserts condition {
  if (!condition) {
    throw new GateError(message);
  }
}

export class GateError extends Error {}
// Preserve unsigned 64-bit register values through JavaScript's JSON parser.
// The marker is internal; dump restores number tokens rather than rounding them.
const INTEGER = '~grow-u64:';
export type Register = number | string;

export function parseJSON(text: string): unknown {
  let safe = '';
  let quoted = false;
  let escaped = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (quoted) {
      safe += c;
      if (escaped) {
        escaped = false;
      } else if (c === '\\') {
        escaped = true;
      } else if (c === '"') {
        quoted = false;
      }
      i += 1;
    } else if (c === '"') {
      quoted = true;
      safe += c;
      i += 1;
    } else if (c === '-' || /[0-9]/.test(c)) {
      const start = i;
      i += 1;
      while (i < text.length && /[0-9eE.+-]/.test(text[i])) {
        i += 1;
      }
      const token = text.slice(start, i);
      safe += /^-?\d{16,}$/.test(token) && !Number.isSafeInteger(Number(token))
        ? JSON.stringify(INTEGER + token)
        : token;
    } else {
      safe += c;
      i += 1;
    }
  }
  return JSON.parse(safe) as unknown;
}

export function stringify(value: unknown, indent = 2): string {
  return JSON.stringify(value, null, indent).replace(/"~grow-u64:(-?\d+)"/g, '$1');
}

export function readJSON<T>(path: string): T {
  return parseJSON(readFileSync(path, 'utf8')) as T;
}

export function dump(path: string, value: unknown): void {
  writeFileSync(path, stringify(value) + '\n');
}

export function signed(value: Register, bits = 64): number {
  const integer = typeof value === 'string' ? BigInt(value.replace(INTEGER, '')) : BigInt(value);
  return Number(BigInt.asIntN(bits, integer));
}

export function numeric(value: Register): number {
  return typeof value === 'number' ? value : Number(value.replace(INTEGER, ''));
}

export function hexBytes(hex: string): Buffer {
  check(/^(?:[0-9a-fA-F]{2})*$/.test(hex), 'invalid hex bytes');
  return Buffer.from(hex, 'hex');
}

export const IGNORED = new Set(['.git', 'target', 'target-ring', '__pycache__', 'dist', 'test-work', 'test-results', '.READY', '.R4']);
export const SAFE_ENV: Record<string, string> = {};
for (const key of ['PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'TMPDIR', 'RUSTUP_HOME', 'CARGO_HOME']) {
  const value = process.env[key];
  if (value !== undefined) {
    SAFE_ENV[key] = value;
  }
}

export function scratch(prefix = 'jitk-grow-'): string {
  return realpathSync(mkdtempSync(join(process.env.JITK_GROW_TMPDIR || tmpdir(), prefix)));
}

export function load(): string {
  return execFileSync('uptime', [], { encoding: 'utf8', timeout: 3000 }).trim();
}

export interface ProcessResult {
  stdout: Buffer;
  stderr: Buffer;
  returncode: number;
  timeout: boolean;
}

export interface ProcessOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  input?: Buffer;
  holdStdin?: boolean;
  onOutput?: (stdout: Buffer, stderr: Buffer) => boolean;
}

export function killChild(child: ChildProcess, groupSignal?: (pid: number) => void): void {
  if (child.pid === undefined) {
    return;
  }
  try {
    if (groupSignal) {
      groupSignal(-child.pid);
    } else {
      process.kill(-child.pid, 'SIGKILL');
    }
  } catch {
    child.kill('SIGKILL');
  }
}

export async function capture(command: string[], options: ProcessOptions = {}): Promise<ProcessResult> {
  const exit = await spawnCapture(command, {
    cwd: options.cwd,
    env: options.env || SAFE_ENV,
    timeout: options.timeout ?? 180,
    input: options.input,
    holdStdin: options.holdStdin,
    stdio: 'pipe',
    onOutput: options.onOutput,
    killOnStdinError: true,
  }, startDirect);
  // subprocess uses a negative signal number for a killed child.
  const status = exit.code ?? (exit.signal === 'SIGKILL' ? -9 : exit.signal === 'SIGTERM' ? -15 : -1);
  return { stdout: exit.stdout, stderr: exit.stderr, returncode: status, timeout: exit.timedOut };
}

export async function run(command: string[], options: ProcessOptions = {}): Promise<ProcessResult> {
  const result = await capture(command, options);
  if (result.timeout || result.returncode !== 0) {
    throw new Error(`${JSON.stringify(command)}: rc=${result.returncode}${result.timeout ? ' timeout' : ''}\n${Buffer.concat([result.stdout, result.stderr]).toString()}`);
  }
  return result;
}

export function treeHashes(root: string): Record<string, string> {
  const entries: string[] = [];
  function walk(directory: string): void {
    for (const name of readdirSync(directory).sort()) {
      if (IGNORED.has(name)) {
        continue;
      }
      const child = join(directory, name);
      const stat = lstatSync(child);
      check(!stat.isSymbolicLink(), 'source symlinks are not supported: ' + child);
      if (stat.isDirectory()) {
        walk(child);
      } else if (stat.isFile()) {
        entries.push(relative(root, child));
      }
    }
  }
  walk(root);
  const hashes: Record<string, string> = {};
  for (const name of entries.sort()) {
    hashes[name] = shaFile(join(root, name));
  }
  return hashes;
}

export function readOr<T>(path: string, fallback: T): T {
  return existsSync(path) ? readJSON<T>(path) : fallback;
}
export function files(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }
  const result: string[] = [];
  for (const name of readdirSync(root).sort()) {
    const path = join(root, name);
    const stat = lstatSync(path);
    check(!stat.isSymbolicLink(), 'artifact symlink: ' + path);
    if (stat.isDirectory()) {
      result.push(...files(path));
    } else if (stat.isFile()) {
      result.push(path);
    }
  }
  return result;
}
export async function diskSpace(): Promise<string> {
  const result = await run(['df', '-k', '/System/Volumes/Data']);
  const text = result.stdout.toString();
  const fields = text.trim().split('\n').slice(-1)[0].split(/\s+/);
  check(Number(fields[3]) * 1024 >= 15 * 1024 ** 3, 'STOP: less than 15 GiB free');
  return text.trim();
}

export function csvEncode(rows: Record<string, unknown>[], fields: string[]): string {
  function quote(value: unknown): string {
    const text = value === undefined || value === null ? '' : String(value);
    return /[",\r\n]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
  }
  return fields.join(',') + '\n' + rows.map((row) => fields.map((field) => quote(row[field])).join(',')).join('\n') + (rows.length ? '\n' : '');
}
export function csvDecode(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && (c === ',' || c === '\n')) {
      row.push(field.replace(/\r$/, ''));
      field = '';
      if (c === '\n') {
        rows.push(row);
        row = [];
      }
    } else {
      field += c;
    }
  }
  check(!quoted, 'unterminated CSV field');
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const header = rows.shift() || [];
  return rows.map((values) => {
    check(values.length === header.length, 'CSV column count');
    const record: Record<string, string> = {};
    for (let i = 0; i < header.length; i += 1) {
      record[header[i]] = values[i];
    }
    return record;
  });
}
