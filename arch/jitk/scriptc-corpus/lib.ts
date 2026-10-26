import { spawn, execFileSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, lstatSync, chmodSync, existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export function check(condition: unknown, message = 'assertion failed'): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function sha(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

export function readJSON<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function json(value: unknown, indent = 2): string {
  return JSON.stringify(value, null, indent).replace(/[\u007f-\uffff]/g, (c: string) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

export function dump(path: string, value: unknown): void {
  writeFileSync(path, json(value) + '\n');
}

export function output(command: string[], cwd?: string): string {
  return execFileSync(command[0], command.slice(1), { cwd: cwd || process.cwd(), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

export function files(root: string): string[] {
  const result: string[] = [];
  for (const name of readdirSync(root).sort()) {
    const path = join(root, name);
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) {
      continue;
    }
    if (stat.isDirectory()) {
      result.push(...files(path));
    } else if (stat.isFile()) {
      result.push(path);
    }
  }
  return result;
}

export interface Result {
  stdout: Buffer;
  stderr: Buffer;
  returncode: number;
  timeout: boolean;
}
export interface Options {
  cwd?: string;
  env?: Record<string, string>;
  input?: Buffer;
  timeout?: number;
  inherit?: boolean;
  holdStdin?: boolean;
}

export async function capture(command: string[], options: Options = {}): Promise<Result> {
  return await new Promise<Result>((resolve, reject) => {
    const childEnv: Record<string, string> = {};
    const sourceEnv = options.env || environment();
    for (const key of Object.keys(sourceEnv)) {
      childEnv[key] = String(sourceEnv[key]);
    }
    const childArgs = ['-i'];
    for (const key of Object.keys(childEnv)) {
      childArgs.push(key + '=' + childEnv[key]);
    }
    childArgs.push(...command);
    const child = options.inherit
      ? spawn('/usr/bin/env', childArgs, { cwd: options.cwd || process.cwd(), detached: true, stdio: 'inherit' })
      : spawn('/usr/bin/env', childArgs, { cwd: options.cwd || process.cwd(), detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let timedOut = false;
    let failure: Error | undefined;
    const timer = setTimeout(() => {
      timedOut = true;
      if (process.platform === 'darwin' && child.pid !== undefined) {
        try {
          mkdirSync('.work/samples', { recursive: true });
          execFileSync('sample', [String(child.pid), '1', '1', '-file', '.work/samples/' + child.pid + '.txt'], { timeout: 3000, stdio: 'ignore' });
          writeFileSync('.work/samples/' + child.pid + '.command.json', JSON.stringify(command));
        } catch { /* A child may exit between deadline and sample. */ }
      }
      try {
        process.kill(-child.pid!, 'SIGKILL');
      } catch {
        child.kill('SIGKILL');
      }
    }, (options.timeout ?? 1800) * 1000);
    if (!options.inherit) {
      child.stdout!.on('data', (data: Buffer) => stdout.push(data));
      child.stderr!.on('data', (data: Buffer) => stderr.push(data));
      child.stdin!.on('error', (error: Error) => {
        if (!error.message.includes('EPIPE')) {
          failure = error;
        }
      });
      if (options.input) {
        child.stdin!.write(options.input);
      }
      if (!options.holdStdin) {
        child.stdin!.end();
      }
    }
    child.on('error', (error: Error) => { failure = error; });
    child.on('close', (code: number | null, signal: string | null) => {
      clearTimeout(timer);
      if (failure) {
        reject(failure);
      } else {
        resolve({ stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr), returncode: code ?? (signal === 'SIGKILL' ? -9 : signal === 'SIGSYS' ? -31 : -1), timeout: timedOut });
      }
    });
  });
}

export async function run(command: string[], options: Options = {}): Promise<Result> {
  const result = await capture(command, options);
  check(!result.timeout && result.returncode === 0, JSON.stringify(command) + ': ' + result.returncode + '\n' + result.stderr.toString());
  return result;
}

export function sleep(milliseconds: number): Promise<void> {
  return new Promise<void>(resolve => setTimeout(resolve, milliseconds));
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

export function environment(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of Object.keys(process.env)) {
    const value = process.env[key];
    if (value !== undefined) {
      env[key] = value;
    }
  }
  return env;
}

export function writable(root: string): void {
  if (!existsSync(root) || lstatSync(root).isSymbolicLink()) {
    return;
  }
  const stat = lstatSync(root);
  chmodSync(root, stat.mode | 0o700);
  if (stat.isDirectory()) {
    for (const name of readdirSync(root)) {
      writable(join(root, name));
    }
  }
}
export function workspace(variable: string, name: string): string {
  const override = process.env[variable];
  const requested = override ? resolve(override) : mkdtempSync(join(tmpdir(), 'jitk-' + name + '-'));
  mkdirSync(requested, { recursive: true });
  const root = realpathSync(requested);
  const cleanup = (): void => {
    if (existsSync(root)) {
      writable(root);
      if (!override) {
        rmSync(root, { recursive: true, force: true });
      }
    }
  };
  process.on('exit', cleanup);
  process.on('SIGTERM', () => process.exit(143));
  process.on('SIGINT', () => process.exit(130));
  return root;
}

export function same(a: unknown, b: unknown): boolean {
  return isDeepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
}

export function copyTree(source: string, target: string, ignored: Set<string>): void {
  mkdirSync(target, { recursive: true });
  for (const name of readdirSync(source)) {
    if (ignored.has(name)) {
      continue;
    }
    const from = join(source, name);
    const to = join(target, name);
    const stat = lstatSync(from);
    if (stat.isDirectory()) {
      copyTree(from, to, ignored);
    } else if (!stat.isSymbolicLink()) {
      writeFileSync(to, readFileSync(from));
      chmodSync(to, stat.mode);
    }
  }
}

// CPython Random(integer).randbytes: MT19937 seeded with init_by_array,
// getrandbits in little-endian 32-bit words. Resource fixture bytes stay exact.
export class PythonRandom {
  private state = new Uint32Array(624);
  private index = 624;
  constructor(seed: number) {
    this.state[0] = 19650218;
    for (let i = 1; i < 624; i += 1) {
      const old = this.state[i - 1];
      this.state[i] = (Math.imul(old ^ (old >>> 30), 1812433253) + i) >>> 0;
    }
    let i = 1;
    for (let k = 0; k < 624; k += 1) {
      const old = this.state[i - 1];
      this.state[i] = ((this.state[i] ^ Math.imul(old ^ (old >>> 30), 1664525)) + seed) >>> 0;
      i += 1;
      if (i >= 624) {
        this.state[0] = this.state[623];
        i = 1;
      }
    }
    for (let k = 0; k < 623; k += 1) {
      const old = this.state[i - 1];
      this.state[i] = ((this.state[i] ^ Math.imul(old ^ (old >>> 30), 1566083941)) - i) >>> 0;
      i += 1;
      if (i >= 624) {
        this.state[0] = this.state[623];
        i = 1;
      }
    }
    this.state[0] = 0x80000000;
  }
  private word(): number {
    if (this.index >= 624) {
      for (let i = 0; i < 624; i += 1) {
        const value = (this.state[i] & 0x80000000) | (this.state[(i + 1) % 624] & 0x7fffffff);
        this.state[i] = this.state[(i + 397) % 624] ^ (value >>> 1) ^ ((value & 1) ? 0x9908b0df : 0);
      }
      this.index = 0;
    }
    let value = this.state[this.index++];
    value ^= value >>> 11;
    value ^= (value << 7) & 0x9d2c5680;
    value ^= (value << 15) & 0xefc60000;
    value ^= value >>> 18;
    return value >>> 0;
  }
  bytes(length: number): Buffer {
    const bytes = Buffer.alloc(length);
    for (let i = 0; i < length; i += 4) {
      const size = Math.min(4, length - i);
      let word = this.word();
      if (size < 4) {
        word >>>= (4 - size) * 8;
      }
      for (let k = 0; k < size; k += 1) {
        bytes[i + k] = (word >>> (k * 8)) & 255;
      }
    }
    return bytes;
  }
}
