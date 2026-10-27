// Python subprocess.run parity for the docs, kernel, executor, protocol, vmm
// and scriptc-corpus tools: exact child environment through /usr/bin/env -i
// (docs/SCRIPTC-GAPS.md), its own process group, a deadline (default 1800 s)
// that kills the group, and CPython-style negative return codes.
import { execFileSync } from 'node:child_process';
import { check } from './assert.ts';
import { spawnCapture, startEnvArgv } from './process.ts';

export interface Result {
  stdout: Buffer;
  stderr: Buffer;
  // stdout and stderr chunks in arrival order
  combined: Buffer;
  returncode: number;
  timeout: boolean;
}
export interface Options {
  cwd?: string;
  env?: Record<string, string>;
  input?: Buffer;
  // seconds
  timeout?: number;
  inherit?: boolean;
  holdStdin?: boolean;
}

export async function capture(command: string[], options: Options = {}, onTimeout?: (pid: number) => void): Promise<Result> {
  const exit = await spawnCapture(command, {
    cwd: options.cwd,
    env: options.env,
    stdio: options.inherit ? 'inherit' : 'pipe',
    input: options.input,
    holdStdin: options.holdStdin,
    timeout: options.timeout ?? 1800,
    onTimeout,
  }, startEnvArgv);
  const returncode = exit.code ?? (exit.signal === 'SIGKILL' ? -9 : exit.signal === 'SIGSYS' ? -31 : -1);
  return { stdout: exit.stdout, stderr: exit.stderr, combined: exit.combined, returncode, timeout: exit.timedOut };
}

export async function run(command: string[], options: Options = {}, onTimeout?: (pid: number) => void): Promise<Result> {
  const result = await capture(command, options, onTimeout);
  check(!result.timeout && result.returncode === 0, JSON.stringify(command) + ': ' + result.returncode + '\n' + result.stderr.toString());
  return result;
}

export function output(command: string[], cwd?: string): string {
  return execFileSync(command[0], command.slice(1), { cwd: cwd || process.cwd(), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}
