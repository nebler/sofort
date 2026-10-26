import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { accessSync, constants, copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { loadavg, tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { check, detail, dump, equal } from './io.ts';

export const ROOT = resolve(import.meta.dirname);
export const ASSETS = resolve(ROOT, '../grow');
export const CANONICAL = resolve(ROOT, '../kernel');
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
      cwd: options.cwd || ROOT,
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

let canonicalGate = false;
export function selectGate(): void {
  canonicalGate = existsSync(resolve(ROOT, '../bench/.READY'));
}

export async function processGuest(command: string[], destination: string, data = Buffer.from('ping\n'), timeout = 10): Promise<{ info: GuestInfo; raw: Buffer; err: Buffer }> {
  const values = loadavg();
  const passed = values[0] < 6;
  const gate = canonicalGate
    ? { threshold: 6, budget_s: 0, wait_s: 0, passed, timed_out: !passed, observations: [{ elapsed_s: 0, load: values }] }
    : { threshold: 6, budget_s: 0, passed, load: values };
  const before = load();
  const started = performance.now();
  const result = await capture(command, { input: data, holdStdin: true, timeout });
  writeFileSync(destination + '.stdout', result.stdout);
  writeFileSync(destination + '.stderr', result.stderr);
  const info: GuestInfo = { load_gate: gate, seconds: (performance.now() - started) / 1000, returncode: result.returncode, timeout: result.timeout, uptime_before: before, uptime_after: load() };
  dump(destination + '.json', info);
  return { info, raw: result.stdout, err: result.stderr };
}

export interface GuestInfo {
  returncode: number;
  timeout: boolean;
  seconds: number;
  load_gate: unknown;
  uptime_before: string;
  uptime_after: string;
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

function copyTree(source: string, destination: string): void {
  mkdirSync(destination);
  for (const name of readdirSync(source).sort()) {
    if (IGNORED.has(name)) {
      continue;
    }
    const from = join(source, name);
    const to = join(destination, name);
    const stat = lstatSync(from);
    check(!stat.isSymbolicLink(), 'source symlinks are not supported: ' + from);
    if (stat.isDirectory()) {
      copyTree(from, to);
    } else if (stat.isFile()) {
      copyFileSync(from, to);
      chmodSync(to, stat.mode & 0o777);
    }
  }
}

export function copyKernel(destination: string): { source: string; hashes: Record<string, string> } {
  check(existsSync(join(CANONICAL, '.READY')), 'canonical kernel/.READY is required');
  const hashes = treeHashes(CANONICAL);
  copyTree(CANONICAL, destination);
  check(equal(treeHashes(CANONICAL), hashes), 'source changed while copying; retry from a stable READY tree');
  return { source: CANONICAL, hashes };
}

export function probeSource(name: string): string {
  if (name === 'fstat' || name === 'pread64') {
    return join(ASSETS, 'fs-probe.c');
  }
  return name === 'ppoll' ? join(CANONICAL, 'tests/fixtures/grow/ppoll.S') : join(ASSETS, name + '.S');
}

export async function build(work: string, out: string, elf: string, argv: string[], resources?: string): Promise<string> {
  work = realpathSync(work);
  out = resolve(out);
  mkdirSync(out, { recursive: true });
  const canonical = realpathSync(CANONICAL);
  check(work !== canonical && !work.startsWith(canonical + sep), 'cannot build canonical source');
  check(existsSync(join(work, 'build.sh')), 'canonical kernel build.sh is required');
  const env: Record<string, string> = { ...SAFE_ENV, JITK_OUT_DIR: out, CARGO_TARGET_DIR: join(dirname(work), 'target'), JITK_ELF: elf, JITK_ARGV_JSON: JSON.stringify(argv) };
  if (resources !== undefined) {
    env.JITK_RESOURCES = resources;
  }
  let result: ProcessResult;
  try {
    result = await run(['sh', join(work, 'build.sh'), '--features', 'qjs,grow-trace'], { cwd: work, env });
  } catch (error) {
    writeFileSync(join(out, 'build.log'), detail(error));
    dump(join(out, 'failure.json'), { class: 'loader-or-build-failure', detail: detail(error) });
    throw error;
  }
  writeFileSync(join(out, 'build.log'), Buffer.concat([result.stdout, result.stderr]));
  check(existsSync(join(out, 'kernel.bin')), 'build did not produce kernel.bin');
  return join(out, 'kernel.bin');
}

let selectedHost: string | undefined;
export function selectHost(): void {
  const value = process.env.JITK_VMM_BINARY;
  check(value, 'Set JITK_VMM_BINARY to the built canonical v2 jitk-vmm executable');
  selectedHost = realpathSync(value);
  accessSync(selectedHost, constants.X_OK);
}

export function host(): string {
  if (selectedHost === undefined) {
    selectHost();
  }
  return selectedHost!;
}

export function hostCommand(image: string): string[] {
  return [host(), '--image', resolve(image)];
}

export function checkHost(info: GuestInfo, stderr: Buffer): void {
  check(info.returncode === 0, JSON.stringify(info) + ' ' + stderr.toString());
  check(stderr.equals(Buffer.from('{"sandbox":"ok"}\n')), 'missing/unexpected host-only sandbox ack: ' + stderr.toString());
}

export function distribution(samples: number[]): { n: number; unit: string; median: number; p90: number; p99: number; samples: number[] } {
  const sorted = [...samples].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return { n: sorted.length, unit: 'ms', median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2, p90: sorted[Math.ceil(0.9 * sorted.length) - 1], p99: sorted[Math.ceil(0.99 * sorted.length) - 1], samples };
}
