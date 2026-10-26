import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { workspace, environment, run, capture, check, dump, sha } from '../lib.ts';
import { ROOT as evidence, HOST, uptime } from './measure.ts';
import { pack } from '../packer.ts';
const root = resolve(import.meta.dirname, '..');
const work = workspace('JITK_PROBE_WORK', 'probes');
mkdirSync(join(evidence, 'probes'), { recursive: true });
const cases: Record<string, string> = {
  "kernel-write": "mov x0,#0x80000000\nstr xzr,[x0]",
  "text-write": "mov x0,#0x400000\nstr xzr,[x0]",
  "heap-exec": "mov x0,#0x680000\nadd x0,x0,#4096\nmov x8,#214\nsvc #0\nmov x0,#0x680000\nbr x0",
  "privileged": "msr sctlr_el1,xzr",
  "el0-hvc": "hvc #0",
  "bad-pointer": "mov x0,#1\nmov x1,#0x80000000\nmov x2,#16\nmov x8,#64\nsvc #0\ncmn x0,#14\nb.ne fail",
  "pan": "mov x8,#12345\nsvc #0",
  "alias-write": "mov x8,#12346\nsvc #0",
  "fs-alias-write": "mov x8,#12347\nsvc #0",
  "unknown-syscall": "mov x8,#511\nsvc #0\ncmn x0,#38\nb.ne fail"
};
const fsVA = 0x400000 + pack(readFileSync(join(root, 'payload/qjs'))).flat.length;
cases['fs-user-read'] = 'ldr x0,=0x' + fsVA.toString(16) + '\nldr x1,[x0]';
const expected: Record<string, string> = {
  'alias-write': 'esr=000000009600004f',
  'fs-alias-write': 'esr=000000009600004f',
  'fs-user-read': 'esr=0000000092000007 far=' + fsVA.toString(16).padStart(16, '0'),
  'unknown-syscall': 'exit=0000000000000000',
  'kernel-write': 'far=0000000080000000',
  'text-write': 'far=0000000000400000',
  'heap-exec': 'esr=000000008200000f',
  privileged: 'esr=0000000002000000',
  'el0-hvc': 'esr=0000000002000000',
  'bad-pointer': 'exit=0000000000000000',
  pan: 'esr=000000009600000f'
};
const results: Record<string, unknown> = { load: uptime() };
for (const name of Object.keys(cases)) {
  const source = join(evidence, 'probes', name + '.S');
  writeFileSync(source, '.text\n.global _start\n_start:\n' + cases[name] + '\nmov x0,#0\nmov x8,#94\nsvc #0\nfail:\nmov x0,#1\nmov x8,#94\nsvc #0\n');
  const obj = join(work, name + '.o');
  const binary = join(work, name + '.bin');
  await run(['clang', '--target=aarch64-none-elf', '-c', source, '-o', obj]);
  await run(['/opt/homebrew/bin/ld.lld', '-Ttext=0x400000', obj, '-o', obj + '.elf']);
  await run(['/opt/homebrew/opt/llvm@22/bin/llvm-objcopy', '-O', 'binary', obj + '.elf', binary]);
  const env = environment();
  env.JITK_PROBE = binary;
  env.CARGO_TARGET_DIR = join(work, 'target');
  env.JITK_TOOLS_DIR = join(root, '.work/bin');
  delete env.RUSTFLAGS;
  await run(['cargo', '+1.95.0', 'build', '--manifest-path', join(root, 'Cargo.toml'), '--release', '--target', 'aarch64-unknown-none', '--features', 'probe'], { env });
  const image = join(work, 'probe-kernel.bin');
  await run(['/opt/homebrew/opt/llvm@22/bin/llvm-objcopy', '-O', 'binary', join(work, 'target/aarch64-unknown-none/release/jitk-02'), image]);
  const result = await capture([HOST, image], { timeout: 5 });
  const row = { returncode: result.returncode, output: result.stdout.toString(), stderr: result.stderr.toString(), image_sha256: sha(readFileSync(image)), load: uptime(), status: result.returncode === 0 && result.stdout.toString().includes(expected[name]) ? 'PASS' : 'FAIL' };
  results[name] = row;
  check(row.status === 'PASS', JSON.stringify(row));
  console.log(name, JSON.stringify(row));
}
writeFileSync(join(evidence, 'probe-results.json'), JSON.stringify(results, null, 2));
