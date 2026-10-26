import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { accessSync, constants, copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { loadavg, tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { check, detail, dump, equal, IGNORED, SAFE_ENV, sha, capture, treeHashes, run } from './lib.ts';
export { SAFE_ENV, sha, scratch, cleanup, load, capture, run, treeHashes, killChild } from './lib.ts';
export type { ProcessOptions, ProcessResult } from './lib.ts';
import type { ProcessResult } from './lib.ts';
import { load } from './lib.ts';

export const ROOT = resolve(import.meta.dirname);
export const ASSETS = ROOT;
export const CANONICAL = resolve(ROOT, '../kernel');
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
  // Kernel's scriptc tools are trusted build inputs, outside proposer access.
  // Isolated copies have no sibling docs/ compiler package or Makefile include.
  env.JITK_TOOLS_DIR = join(ROOT, 'build/kernel-tools');
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
