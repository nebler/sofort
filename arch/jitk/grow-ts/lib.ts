import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { accessSync, constants, copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { loadavg, tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';

import { isDeepStrictEqual } from 'node:util';

export function check(condition: unknown, message = 'assertion failed'): asserts condition {
  if (!condition) {
    throw new GateError(message);
  }
}

export class GateError extends Error {}

export function detail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function equal(a: unknown, b: unknown): boolean {
  return isDeepStrictEqual(a, b);
}

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

export function sha(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function scratch(prefix = 'jitk-grow-'): string {
  return realpathSync(mkdtempSync(join(process.env.JITK_GROW_TMPDIR || tmpdir(), prefix)));
}

export function cleanup(path: string): void {
  // Profiles deliberately create 0555 resource directories.
  if (existsSync(path) && lstatSync(path).isDirectory()) {
    chmodSync(path, 0o700);
    for (const name of readdirSync(path)) {
      const child = join(path, name);
      if (!lstatSync(child).isSymbolicLink() && lstatSync(child).isDirectory()) {
        cleanup(child);
      }
    }
  }
  rmSync(path, { recursive: true, force: true });
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
  onOutput?: (stdout: Buffer) => boolean;
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
  return await new Promise<ProcessResult>((resolveResult, reject) => {
    const child = spawn(command[0], command.slice(1), {
      cwd: options.cwd || process.cwd(),
      env: options.env || SAFE_ENV,
      detached: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let timedOut = false;
    let failure: Error | undefined;
    let stopped = false;
    const timer = setTimeout(() => {
      timedOut = true;
      killChild(child);
    }, (options.timeout ?? 180) * 1000);
    child.stdout!.on('data', (chunk: Buffer) => {
      stdout.push(chunk);
      if (options.onOutput && !stopped) {
        try {
          if (options.onOutput(Buffer.concat(stdout))) {
            stopped = true;
            killChild(child);
          }
        } catch (error) {
          failure = new Error(detail(error));
          killChild(child);
        }
      }
    });
    child.stderr!.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.stdin!.on('error', (error: Error) => {
      // A completed guest can close stdin before an empty write is flushed.
      if (!detail(error).includes('EPIPE')) {
        failure = error;
        killChild(child);
      }
    });
    child.on('error', (error: Error) => {
      failure = error;
    });
    child.on('close', (code: number | null, signal: string | null) => {
      clearTimeout(timer);
      child.stdin!.destroy();
      if (failure) {
        reject(failure);
      } else {
        // subprocess uses a negative signal number for a killed child.
        const status = code ?? (signal === 'SIGKILL' ? -9 : signal === 'SIGTERM' ? -15 : -1);
        resolveResult({ stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr), returncode: status, timeout: timedOut });
      }
    });
    if (options.input && options.input.length > 0) {
      child.stdin!.write(options.input);
    }
    if (!options.holdStdin) {
      child.stdin!.end();
    }
  });
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
    hashes[name] = sha(join(root, name));
  }
  return hashes;
}

