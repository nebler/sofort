// Canonical jitk guest leg shared by the corpus runner and the clone-fallback
// probe: unchanged kernel copy, canonical release profile, grow-trace observer.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { capture, run, environment, sha, check, type Result } from './lib.ts';
import { pack } from '../kernel/packer.ts';
import { observe } from '../grow/observations.ts';
import { guestStdout } from './guest-output.ts';
import { requireArtifact } from '../tslib/deps.ts';

export interface Stream { stdout: string; stderr: string; exit: number | null; timeout: boolean }
export interface Guest {
  stream: Stream; complete: boolean; missing: string[]; errors: string[]; trace: string;
  fault: string | null; abort: boolean; control: boolean; fatal: number; hostExit: number; raw: Buffer;
  // Error results in occurrence order (each kept at its last occurrence).
  errorOrder: string[];
}
const ROOT = resolve(import.meta.dirname);
const WORK = join(ROOT, '.work');
const ZIG = process.env.ZIG || '/Users/noah/.local/share/zig-0.16.0/zig';
const compiler = join(ROOT, 'node_modules/.bin/scriptc');
// Packed payload GPA offset inside kernel.bin (link.ld: 0x80080000 - 0x80000000).
const PACKED_OFFSET = 0x80000;
const toolsReady = new Map<string, Promise<void>>();
// One Cargo build per target directory at a time (build.sh runs objcopy outside its lock).
const building = new Set<string>();
let names: Record<string, string> | undefined;
let errnos: Record<string, number> | undefined;

function header(path: string, pattern: RegExp): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of readFileSync(join(dirname(ZIG), 'lib/libc/include', path), 'utf8').split('\n')) {
    const match = pattern.exec(line);
    if (match) result[match[1]] = match[2];
  }
  return result;
}
export function syscallName(nr: number): string {
  if (!names) {
    names = {};
    const byName = header('aarch64-linux-musl/bits/syscall.h', /^#define __NR_(\w+)\s+(\d+)\s*$/);
    for (const name of Object.keys(byName)) names[byName[name]] = name;
  }
  return names[String(nr)] || 'nr:' + nr;
}
export function errno(name: string): number {
  if (!errnos) {
    errnos = {};
    const byName = header('generic-musl/bits/errno.h', /^#define (E[A-Z0-9]+)\s+(\d+)\s*$/);
    for (const key of Object.keys(byName)) errnos[key] = Number(byName[key]);
    errnos.ENOTSUP = errnos.EOPNOTSUPP;
    errnos.EWOULDBLOCK = errnos.EAGAIN;
  }
  return errnos[name] ?? -1;
}
export function stream(out: Buffer, err: Buffer, code: number | null, timeout = false): Stream {
  return { stdout: sha(out), stderr: sha(err), exit: code, timeout };
}
export function identical(a: Stream, b: Stream): boolean {
  return !a.timeout && !b.timeout && a.stdout === b.stdout && a.stderr === b.stderr && a.exit === b.exit;
}
async function kernelTools(kernel: string, tools: string): Promise<void> {
  if (!toolsReady.has(tools)) toolsReady.set(tools, (async () => {
    mkdirSync(tools, { recursive: true });
    for (const tool of ['prepare', 'build-args', 'artifact']) {
      await run([compiler, 'build', join(kernel, tool + '.ts'), '-o', join(tools, tool)], { timeout: 45 });
    }
  })());
  await toolsReady.get(tools);
}
// Rust incremental compilation does not track the `.incbin` payload inside
// global_asm!, so an incremental cache silently keeps the FIRST payload. The
// canonical non-incremental profile is used, and every image is checked.
export function embedded(kernel: Buffer, flat: Buffer): boolean {
  return kernel.length >= PACKED_OFFSET + flat.length && kernel.subarray(PACKED_OFFSET, PACKED_OFFSET + flat.length).equals(flat);
}
// Throws only for infrastructure failure. A packer refusal must be checked by
// the caller first; it is a loader result, not a guest result. Concurrent
// processes must use distinct target directories: build.sh runs objcopy
// outside Cargo's lock, and a foreign relink would trip the embedding check.
export async function guest(elf: string, dir: string, timeout = 10, target = 'target', kernel = join(WORK, 'kernel')): Promise<Guest | { buildError: string }> {
  // Build tools are keyed by the kernel tree's TypeScript (prepare/packer may differ).
  const tools = kernel === join(WORK, 'kernel') ? join(WORK, 'kernel-tools') : join(WORK, 'kernel-tools-' + sha(Buffer.from(readdirSync(kernel).filter(f => f.endsWith('.ts')).sort().map(f => f + ':' + sha(readFileSync(join(kernel, f)))).join('\n'))).slice(0, 16));
  await kernelTools(kernel, tools);
  const out = join(dir, 'image');
  const buildEnv = environment();
  buildEnv.JITK_TOOLS_DIR = tools;
  buildEnv.CARGO_TARGET_DIR = join(WORK, target);
  buildEnv.JITK_OUT_DIR = out;
  buildEnv.JITK_ELF = elf;
  buildEnv.JITK_ARGV_JSON = JSON.stringify([elf]);
  for (const key of Object.keys(buildEnv)) if (key.startsWith('CARGO_PROFILE_') || key === 'CARGO_INCREMENTAL') delete buildEnv[key];
  while (building.has(target)) await new Promise<void>(r => setTimeout(r, 10));
  building.add(target);
  let result: Result;
  try { result = await capture(['sh', join(kernel, 'build.sh'), '--features', 'qjs,grow-trace'], { env: buildEnv, timeout: 120 }); }
  finally { building.delete(target); }
  writeFileSync(join(dir, 'kernel-build.log'), Buffer.concat([result.stdout, result.stderr]));
  if (result.returncode !== 0 || result.timeout || !existsSync(join(out, 'kernel.bin'))) return { buildError: result.timeout ? 'timeout' : 'rc=' + result.returncode };
  check(embedded(readFileSync(join(out, 'kernel.bin')), pack(readFileSync(elf)).flat), 'stale-payload-embedding: kernel.bin does not contain this ELF');
  const vmm = requireArtifact('JITK_VMM_BINARY');
  const vm = await capture([vmm, '--image', join(out, 'kernel.bin')], { timeout });
  const observed = observe(vm.stdout);
  const text = vm.stdout.toString('latin1');
  const fault = /\x1eFAULT (esr=[0-9a-f]+ far=[0-9a-f]+ pc=[0-9a-f]+)/.exec(text);
  const missing = new Set<string>();
  const errors = new Set<string>();
  for (const event of observed.missing) missing.add(syscallName(event.nr));
  const order: string[] = [];
  for (const event of observed.argument_errors) {
    const key = syscallName(event.nr) + ':' + event.ret;
    errors.add(key);
    if (order.includes(key)) order.splice(order.indexOf(key), 1);
    order.push(key);
  }
  return {
    stream: stream(guestStdout(vm.stdout), Buffer.from(observed.stderr_hex, 'hex'), observed.exit, vm.timeout),
    complete: observed.trace_complete, missing: Array.from(missing).sort(), errors: Array.from(errors).sort(),
    trace: sha(vm.stdout), fault: fault ? fault[1] : null,
    // musl abort(): SIGABRT via tkill, which is ENOSYS here, then a_crash().
    abort: observed.missing.some(e => e.nr === 130 && e.args[1] === 6),
    // EL0 stdout outside printable ASCII + LF terminates the guest (PROTOCOL-v1).
    control: text.includes('\x1efatal control byte'), errorOrder: order,
    fatal: observed.fatal_protocol.length, hostExit: vm.returncode, raw: vm.stdout,
  };
}
