import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  realpathSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { constants } from "node:os";

export const ROOT = canonical(
  process.env.JITK_NATIVE_ROOT || resolve(import.meta.dirname, "../../.."),
);
export type Json = any;
export function check(value: boolean, message = "assertion failed"): void {
  if (!value) {
    throw new Error(message);
  }
}
export function read(path: string): string {
  return readFileSync(path, "utf8");
}
export function json(path: string): Json {
  return JSON.parse(read(path));
}
export function dump(path: string, value: unknown, pretty = true): void {
  writeFileSync(path, JSON.stringify(value, null, pretty ? 2 : 0) + "\n");
}
export function sha(path: string): string {
  return digest(readFileSync(path));
}
export function digest(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}
export function env(
  extra: Record<string, string> = {},
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of Object.keys(process.env)) {
    const value = process.env[key];
    if (value !== undefined) {
      result[key] = value;
    }
  }
  for (const key of Object.keys(extra)) {
    result[key] = extra[key];
  }
  return result;
}
export function locked(command: string[], wait?: number): string[] {
  if (process.env.JITK_BENCH_LOCK_HELD === "1") {
    return command;
  }
  return [
    "flock",
    ...(wait === undefined ? [] : ["-w", String(wait)]),
    "/home/dev/bench.lock",
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
  return -(signals[signal || "SIGKILL"] || 1);
}
export function kill(child: ChildProcess, signal = "SIGKILL"): void {
  try {
    process.kill(-Number(child.pid), signal);
  } catch {
    child.kill(signal);
  }
}
export interface Options {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  input?: Buffer;
  inherit?: boolean;
}
export interface Result {
  stdout: Buffer;
  stderr: Buffer;
  returncode: number;
}
export async function capture(
  command: string[],
  options: Options = {},
): Promise<Result> {
  return await new Promise<Result>((done, fail) => {
    const child = spawn(command[0], command.slice(1), {
      cwd: options.cwd || process.cwd(),
      env: options.env || env(),
      detached: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    let failure: Error | undefined;
    const timer = setTimeout(
      () => {
        failure = new Error("process timeout: " + command.join(" "));
        kill(child);
      },
      (options.timeout ?? 600) * 1000,
    );
    child.stdout!.on("data", (b: Buffer) => {
      out.push(b);
      if (options.inherit) {
        process.stdout.write(b);
      }
    });
    child.stderr!.on("data", (b: Buffer) => {
      err.push(b);
      if (options.inherit) {
        process.stderr.write(b);
      }
    });
    child.stdin!.on("error", (error: Error) => {
      if (!error.message.includes("EPIPE")) {
        failure = error;
        kill(child);
      }
    });
    child.on("error", (error: Error) => {
      failure = error;
    });
    child.on("close", (code: number | null, signal: string | null) => {
      clearTimeout(timer);
      if (failure) {
        fail(failure);
      } else {
        done({
          stdout: Buffer.concat(out),
          stderr: Buffer.concat(err),
          returncode: status(code, signal),
        });
      }
    });
    if (options.input) {
      child.stdin!.write(options.input);
    }
    child.stdin!.end();
  });
}
export async function run(
  command: string[],
  options: Options = {},
): Promise<Result> {
  const result = await capture(command, options);
  check(
    result.returncode === 0,
    command.join(" ") +
      ": rc=" +
      result.returncode +
      "\n" +
      result.stderr.toString(),
  );
  return result;
}
export function saveResult(result: Result, out: string, err?: string): void {
  writeFileSync(out, result.stdout);
  if (err) {
    writeFileSync(err, result.stderr);
  }
}
export function tool(name: string): string[] {
  return [resolve(dirname(String(process.execPath)), "shard-tools"), name];
}
export function lines(path: string): Json[] {
  return read(path)
    .split("\n")
    .filter((s) => s.trim().length > 0)
    .map((s) => JSON.parse(s));
}
export function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
export function median(xs: number[]): number {
  const a = xs.slice().sort((a, b) => a - b);
  const n = a.length;
  return n % 2 ? a[Math.floor(n / 2)] : (a[n / 2 - 1] + a[n / 2]) / 2;
}
export function fit(xs: number[], ys: number[]): Json {
  const mx = mean(xs);
  const my = mean(ys);
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < xs.length; i++) {
    numerator += (xs[i] - mx) * (ys[i] - my);
    denominator += (xs[i] - mx) ** 2;
  }
  const slope = numerator / denominator;
  const fixed = my - slope * mx;
  let total = 0;
  let residual = 0;
  for (let i = 0; i < xs.length; i++) {
    total += (ys[i] - my) ** 2;
    residual += (ys[i] - fixed - slope * xs[i]) ** 2;
  }
  return {
    bytes_per_vm: slope,
    fixed_bytes: fixed,
    r2: total ? 1 - residual / total : 1,
  };
}

export class StreamProcess {
  child: ChildProcess;
  stdout: Buffer[] = [];
  stderr: Buffer[] = [];
  pending = "";
  queue: string[] = [];
  ended = false;
  returncode: number | null = null;
  failure: Error | undefined;
  constructor(command: string[], options: Options = {}) {
    this.child = spawn(command[0], command.slice(1), {
      cwd: options.cwd || process.cwd(),
      env: options.env || env(),
      detached: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.child.stdout!.on("data", (chunk: Buffer) => {
      this.stdout.push(chunk);
      this.pending += chunk.toString();
      let index = this.pending.indexOf("\n");
      while (index >= 0) {
        this.queue.push(this.pending.slice(0, index));
        this.pending = this.pending.slice(index + 1);
        index = this.pending.indexOf("\n");
      }
    });
    this.child.stderr!.on("data", (chunk: Buffer) => {
      this.stderr.push(chunk);
    });
    this.child.stdin!.on("error", () => {});
    this.child.on("error", (error: Error) => {
      this.failure = error;
    });
    this.child.on("close", (code: number | null, signal: string | null) => {
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
      check(
        !this.ended,
        "child exited: " + Buffer.concat(this.stderr).toString(),
      );
      check(Date.now() < deadline, "no process progress");
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
      check(Date.now() < deadline, "process reap timeout");
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

// pathlib.Path.resolve semantics also resolve symlinks in existing parents.
export function canonical(path: string): string {
  const absolute = resolve(path);
  if (existsSync(absolute)) {
    return realpathSync(absolute);
  }
  const parent = dirname(absolute);
  return parent === absolute
    ? absolute
    : resolve(canonical(parent), basename(absolute));
}
