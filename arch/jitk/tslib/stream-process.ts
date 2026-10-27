// Process helpers of the shard and linux tools: spawn's own env option, a
// process group per child, a deadline (default 600 s) that rejects, optional
// write-through of output, and CPython return codes (-signal number).
import { type ChildProcess, spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { constants } from 'node:os';
import { check } from './assert.ts';
import { environment, killGroup, spawnCapture, startDirect, track } from './process.ts';

// The current environment plus extra.
export function env(extra: Record<string, string> = {}): Record<string, string> {
  const result = environment();
  for (const key of Object.keys(extra)) {
    result[key] = extra[key];
  }
  return result;
}

// Serializes a KVM measurement on /home/dev/bench.lock unless the caller
// already holds it.
export function locked(command: string[], wait?: number): string[] {
  if (process.env.JITK_BENCH_LOCK_HELD === '1') {
    return command;
  }
  return [
    'flock',
    ...(wait === undefined ? [] : ['-w', String(wait)]),
    '/home/dev/bench.lock',
    ...command,
  ];
}

export function sleep(seconds: number): Promise<void> {
  return new Promise<void>((done) => setTimeout(done, seconds * 1000));
}

export function status(code: number | null, signal: string | null): number {
  if (code !== null) {
    return code;
  }
  const signals = constants.signals as Record<string, number>;
  return -(signals[signal || 'SIGKILL'] || 1);
}

export function kill(child: ChildProcess, signal = 'SIGKILL'): void {
  killGroup(child, signal);
}

export interface Options {
  cwd?: string;
  env?: Record<string, string>;
  // seconds
  timeout?: number;
  input?: Buffer;
  // write captured output through as well
  inherit?: boolean;
}
export interface Result {
  stdout: Buffer;
  stderr: Buffer;
  returncode: number;
}

export async function capture(command: string[], options: Options = {}): Promise<Result> {
  const exit = await spawnCapture(command, {
    cwd: options.cwd,
    env: options.env || env(),
    input: options.input,
    timeout: options.timeout ?? 600,
    stdio: 'pipe',
    tee: options.inherit,
    killOnStdinError: true,
  }, startDirect);
  if (exit.timedOut) {
    throw new Error('process timeout: ' + command.join(' '));
  }
  return { stdout: exit.stdout, stderr: exit.stderr, returncode: status(exit.code, exit.signal) };
}

export async function run(command: string[], options: Options = {}): Promise<Result> {
  const result = await capture(command, options);
  check(
    result.returncode === 0,
    command.join(' ') + ': rc=' + result.returncode + '\n' + result.stderr.toString(),
  );
  return result;
}

export function saveResult(result: Result, out: string, err?: string): void {
  writeFileSync(out, result.stdout);
  if (err) {
    writeFileSync(err, result.stderr);
  }
}

// A line-oriented child: stdout lines queue for line(); wait() reaps.
export class StreamProcess {
  child: ChildProcess;
  stdout: Buffer[] = [];
  stderr: Buffer[] = [];
  pending = '';
  queue: string[] = [];
  ended = false;
  returncode: number | null = null;
  failure: Error | undefined;
  // Overall lifetime bound (seconds, default one day): the group is killed
  // at expiry, so a lost exit wakeup cannot outlive it.
  constructor(command: string[], options: Options = {}) {
    this.child = spawn(command[0], command.slice(1), {
      cwd: options.cwd || process.cwd(),
      env: options.env || env(),
      detached: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    track(this.child, options.timeout ?? 86400);
    this.child.stdout!.on('data', (chunk: Buffer) => {
      this.stdout.push(chunk);
      this.pending += chunk.toString();
      let index = this.pending.indexOf('\n');
      while (index >= 0) {
        this.queue.push(this.pending.slice(0, index));
        this.pending = this.pending.slice(index + 1);
        index = this.pending.indexOf('\n');
      }
    });
    this.child.stderr!.on('data', (chunk: Buffer) => {
      this.stderr.push(chunk);
    });
    this.child.stdin!.on('error', () => {});
    this.child.on('error', (error: Error) => {
      this.failure = error;
    });
    this.child.on('close', (code: number | null, signal: string | null) => {
      this.ended = true;
      this.returncode = status(code, signal);
    });
  }
  async line(timeout: number): Promise<string> {
    const deadline = Date.now() + timeout * 1000;
    while (this.queue.length === 0) {
      if (this.failure) {
        throw this.failure;
      }
      check(!this.ended, 'child exited: ' + Buffer.concat(this.stderr).toString());
      check(Date.now() < deadline, 'no process progress');
      await sleep(0.005);
    }
    return String(this.queue.shift());
  }
  async wait(timeout: number): Promise<number> {
    const deadline = Date.now() + timeout * 1000;
    while (!this.ended) {
      if (this.failure) {
        throw this.failure;
      }
      check(Date.now() < deadline, 'process reap timeout');
      await sleep(0.005);
    }
    return Number(this.returncode);
  }
  async cleanup(): Promise<void> {
    if (!this.ended) {
      kill(this.child);
      await this.wait(5);
    }
  }
}
