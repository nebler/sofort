import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, lstatSync } from 'node:fs';
import { join } from 'node:path';

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

export function argument(name: string, fallback = ''): string {
  const index = process.argv.indexOf('--' + name);
  return index < 0 ? fallback : String(process.argv[index + 1]);
}
export function sleep(milliseconds: number): Promise<void> {
  return new Promise<void>(resolve => setTimeout(resolve, milliseconds));
}
export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2;
}

export class Session {
  child: ReturnType<typeof spawn>;
  stderr = '';
  private buffer = '';
  private lines: string[] = [];
  private ended = false;
  private closed: Promise<void>;
  constructor(command: string[]) {
    this.child = spawn(command[0], command.slice(1), { stdio: ['pipe', 'pipe', 'pipe'] });
    this.child.stdout!.on('data', (data: Buffer) => {
      this.buffer += data.toString();
      let end = this.buffer.indexOf('\n');
      while (end >= 0) {
        this.lines.push(this.buffer.slice(0, end));
        this.buffer = this.buffer.slice(end + 1);
        end = this.buffer.indexOf('\n');
      }
    });
    this.child.stderr!.on('data', (data: Buffer) => { this.stderr += data.toString(); });
    this.child.stdin!.on('error', () => {});
    this.closed = new Promise<void>(resolve => {
      this.child.on('error', () => { this.ended = true; });
      this.child.on('close', () => { this.ended = true; resolve(); });
    });
  }
  async line(timeout = 30): Promise<string> {
    const end = performance.now() + timeout * 1000;
    while (this.lines.length === 0) {
      check(!this.ended && performance.now() < end, 'session EOF/timeout: ' + this.stderr);
      await sleep(1);
    }
    return this.lines.shift()!;
  }
  send(frame: unknown): void {
    this.child.stdin!.write(JSON.stringify(frame) + '\n');
  }
  async close(): Promise<void> {
    if (!this.ended) {
      this.child.kill('SIGKILL');
    }
    await this.closed;
    this.child.stdin!.destroy();
  }
}

export function fixed3(value: number): string {
  const rounded = Math.round(value * 1000);
  return String(Math.floor(rounded / 1000)) + '.' + String(rounded % 1000).padStart(3, '0');
}
