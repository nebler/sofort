import { spawn, type ChildProcess } from 'node:child_process';

// scriptc 0.4.5 can lose a child's exit wakeup on macOS and then sleep in
// kevent until the next timer deadline (forever without one) while the child
// is a zombie. A short repeating timer bounds that sleep while any tracked
// child runs, so the next reap sweep settles the child. See ../SCRIPTC-HANG.md.
export const KEEPALIVE_MS = 50;

let running = 0;
let keepalive: ReturnType<typeof setInterval> | undefined;

function hold(): void {
  running += 1;
  if (keepalive === undefined) {
    keepalive = setInterval(() => {}, KEEPALIVE_MS);
  }
}

function release(): void {
  running -= 1;
  if (running === 0 && keepalive !== undefined) {
    clearInterval(keepalive);
    keepalive = undefined;
  }
}

export function trackedChildren(): number {
  return running;
}

// The signals the tools send (process.kill wants a signal name, not a string).
export type Signal = 'SIGKILL' | 'SIGTERM' | 'SIGINT';

export function killGroup(child: ChildProcess, signal: Signal = 'SIGKILL'): void {
  if (child.pid === undefined) {
    return;
  }
  try {
    process.kill(-child.pid, signal);
  } catch {
    child.kill(signal);
  }
}

// Every spawn goes through here: the keepalive holds until close, and an
// overall deadline (seconds) kills the child's process group. onTimeout runs
// first and may replace the kill (it must kill the child itself then).
export function track(child: ChildProcess, timeout: number, onTimeout?: (child: ChildProcess) => void): ChildProcess {
  hold();
  let open = true;
  const timer = setTimeout(() => {
    if (onTimeout) {
      onTimeout(child);
    } else {
      killGroup(child);
    }
  }, timeout * 1000);
  const settle = (): void => {
    if (open) {
      open = false;
      clearTimeout(timer);
      release();
    }
  };
  child.on('close', settle);
  // A failed spawn has no pid; its close may never come.
  child.on('error', () => {
    if (child.pid === undefined) {
      settle();
    }
  });
  return child;
}

export interface Exit {
  stdout: Buffer;
  stderr: Buffer;
  combined: Buffer;
  code: number | null;
  signal: string | null;
  timedOut: boolean;
}

// stdio shapes: 'pipe' (all three piped), 'inherit', 'ignore-stdin' (stdin
// /dev/null, stdout/stderr piped).
export type Stdio = 'pipe' | 'inherit' | 'ignore-stdin';
// Starts a child in its own process group. scriptc wants literal stdio
// options, so each shape is its own spawn call (SC2020).
export type Starter = (command: string[], cwd: string, env: Record<string, string>, stdio: Stdio) => ChildProcess;

// The exact environment as `/usr/bin/env -i KEY=value... command`. A program
// whose callers build env from spreads cannot pass it as spawn's env option
// (SC2020, docs/SCRIPTC-GAPS.md); env execs the target. No 'ignore-stdin'.
export function startEnvArgv(command: string[], cwd: string, env: Record<string, string>, stdio: Stdio): ChildProcess {
  const argv = ['-i'];
  for (const key of Object.keys(env)) {
    argv.push(key + '=' + String(env[key]));
  }
  argv.push(...command);
  return stdio === 'inherit'
    ? spawn('/usr/bin/env', argv, { cwd, detached: true, stdio: 'inherit' })
    : spawn('/usr/bin/env', argv, { cwd, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
}

// spawn's own env option. Only referenced by programs whose env values are
// plain string records; scriptc checks just the starter a program uses.
export function startDirect(command: string[], cwd: string, env: Record<string, string>, stdio: Stdio): ChildProcess {
  if (stdio === 'inherit') {
    return spawn(command[0], command.slice(1), { cwd, env, detached: true, stdio: 'inherit' });
  }
  if (stdio === 'ignore-stdin') {
    return spawn(command[0], command.slice(1), { cwd, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  }
  return spawn(command[0], command.slice(1), { cwd, env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
}

export interface SpawnOptions {
  cwd?: string;
  // Exact child environment; the caller's environment when absent.
  env?: Record<string, string>;
  stdio: Stdio;
  input?: Buffer;
  holdStdin?: boolean;
  // Overall deadline in seconds; the process group is killed at expiry.
  timeout: number;
  // Also write captured stdout/stderr through to this process.
  tee?: boolean;
  // Return true to stop the child early (process-group SIGKILL).
  onOutput?: (stdout: Buffer) => boolean;
  // Runs at the deadline, before the group kill.
  onTimeout?: (pid: number) => void;
  // Kill the child on a stdin error other than EPIPE (the error rejects
  // either way).
  killOnStdinError?: boolean;
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

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Runs command to completion and captures its output; every child goes
// through track(), so the lost-wakeup keepalive and the deadline apply.
export async function spawnCapture(command: string[], options: SpawnOptions, start: Starter): Promise<Exit> {
  return await new Promise<Exit>((resolveExit, reject) => {
    const env = options.env || environment();
    const piped = options.stdio !== 'inherit';
    const stdin = options.stdio === 'pipe';
    const child = start(command, options.cwd || process.cwd(), env, options.stdio);
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const combined: Buffer[] = [];
    let timedOut = false;
    let stopped = false;
    let failure: Error | undefined;
    track(child, options.timeout, (target: ChildProcess) => {
      timedOut = true;
      if (options.onTimeout && target.pid !== undefined) {
        options.onTimeout(target.pid);
      }
      killGroup(target);
    });
    if (piped) {
      child.stdout!.on('data', (chunk: Buffer) => {
        stdout.push(chunk);
        combined.push(chunk);
        if (options.tee) {
          process.stdout.write(chunk);
        }
        if (options.onOutput && !stopped) {
          try {
            if (options.onOutput(Buffer.concat(stdout))) {
              stopped = true;
              killGroup(child);
            }
          } catch (error) {
            failure = new Error(message(error));
            killGroup(child);
          }
        }
      });
      child.stderr!.on('data', (chunk: Buffer) => {
        stderr.push(chunk);
        combined.push(chunk);
        if (options.tee) {
          process.stderr.write(chunk);
        }
      });
    }
    if (stdin) {
      child.stdin!.on('error', (error: Error) => {
        // A completed child can close stdin before the write is flushed.
        if (!message(error).includes('EPIPE')) {
          failure = error;
          if (options.killOnStdinError) {
            killGroup(child);
          }
        }
      });
    }
    child.on('error', (error: Error) => {
      failure = error;
      // A spawn that failed has no pid and may never close.
      if (child.pid === undefined) {
        reject(error);
      }
    });
    child.on('close', (code: number | null, signal: string | null) => {
      if (stdin) {
        child.stdin!.destroy();
      }
      if (failure) {
        reject(failure);
      } else {
        resolveExit({ stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr), combined: Buffer.concat(combined), code, signal, timedOut });
      }
    });
    if (stdin) {
      if (options.input && options.input.length > 0) {
        child.stdin!.write(options.input);
      }
      if (!options.holdStdin) {
        child.stdin!.end();
      }
    }
  });
}

export function sleep(milliseconds: number): Promise<void> {
  return new Promise<void>(resolve => setTimeout(resolve, milliseconds));
}
