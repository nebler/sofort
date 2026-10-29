import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { workspace, environment, run, capture, check, dump, sha } from '../lib.ts';
import { ROOT as evidence, HOST, uptime } from './measure.ts';
import { pack } from '../packer.ts';
import { pins } from '../../tslib/deps.ts';
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
  "unknown-syscall": "mov x8,#511\nsvc #0\ncmn x0,#38\nb.ne fail",
  // EL0 starts as after Linux execve: no kernel register, SIMD/FP or TLS value.
  "entry-registers": [
    ...Array.from({ length: 30 }, (_, i) => 'orr x0,x0,x' + (i + 1)),
    'cbnz x0,fail',
    ...Array.from({ length: 31 }, (_, i) => 'orr v0.16b,v0.16b,v' + (i + 1) + '.16b'),
    'mov x1,v0.d[0]\nmov x2,v0.d[1]\norr x1,x1,x2\ncbnz x1,fail',
    'mrs x1,fpcr\ncbnz x1,fail\nmrs x1,fpsr\ncbnz x1,fail\nmrs x1,tpidr_el0\ncbnz x1,fail'
  ].join('\n'),
  // fd 2 is checked like fd 1: EFAULT, EINVAL past 1 MiB, every writev iovec.
  "stderr-bad-pointer": "mov x0,#2\nmov x1,#0x80000000\nmov x2,#16\nmov x8,#64\nsvc #0\ncmn x0,#14\nb.ne fail",
  "stderr-huge-length": "mov x0,#2\nmov x1,#0x400000\nmov x2,#1\nlsl x2,x2,#63\nmov x8,#64\nsvc #0\ncmn x0,#22\nb.ne fail",
  "writev-stderr-bad": "sub sp,sp,#16\nmov x1,#0x80000000\nmov x2,#16\nstp x1,x2,[sp]\nmov x0,#2\nmov x1,sp\nmov x2,#1\nmov x8,#66\nsvc #0\ncmn x0,#14\nb.ne fail",
  // Empty vectors read no iovec; fd and clockid are 32-bit as on Linux.
  "empty-iovec": "mov x0,#1\nmov x1,#0\nmov x2,#0\nmov x8,#66\nsvc #0\ncbnz x0,fail\nmov x0,#0\nmov x1,#0\nmov x2,#0\nmov x8,#65\nsvc #0\ncbnz x0,fail",
  "abi-int-truncation": "mov x0,#1\nmovk x0,#1,lsl #32\nmov x1,#0\nmov x2,#0\nmov x8,#64\nsvc #0\ncbnz x0,fail\nsub sp,sp,#16\nmov x0,#1\nmovk x0,#1,lsl #32\nmov x1,sp\nmov x8,#113\nsvc #0\ncbnz x0,fail",
  // brk: shrinking unmaps; growing again maps zero pages, not the old heap.
  "brk-regrow-zero": "mov x0,#0\nmov x8,#214\nsvc #0\nmov x19,x0\nadd x0,x19,#8192\nmov x8,#214\nsvc #0\nmov x1,#-1\nstr x1,[x19]\nstr x1,[x19,#4096]\nmov x0,x19\nmov x8,#214\nsvc #0\nadd x0,x19,#8192\nmov x8,#214\nsvc #0\nldr x1,[x19]\ncbnz x1,fail\nldr x1,[x19,#4096]\ncbnz x1,fail",
  "brk-shrink-unmaps": "mov x0,#0\nmov x8,#214\nsvc #0\nmov x19,x0\nadd x0,x19,#4096\nmov x8,#214\nsvc #0\nmov x0,x19\nmov x8,#214\nsvc #0\nldr x1,[x19]",
  // An open archive descriptor polls as a regular file (POLLIN|POLLOUT), not POLLNVAL.
  "poll-archive-fd": "b 1f\npath: .asciz \"/\"\n.balign 4\n1:\nmov x0,#-100\nadr x1,path\nmov x2,#0x4000\nmov x3,#0\nmov x8,#56\nsvc #0\ncmp x0,#3\nb.ne fail\nsub sp,sp,#32\nmov w1,#3\nstr w1,[sp]\nmov w1,#5\nstrh w1,[sp,#4]\nstrh wzr,[sp,#6]\nstp xzr,xzr,[sp,#16]\nmov x0,sp\nmov x1,#1\nadd x2,sp,#16\nmov x3,#0\nmov x4,#8\nmov x8,#73\nsvc #0\ncmp x0,#1\nb.ne fail\nldrh w1,[sp,#6]\ncmp w1,#5\nb.ne fail"
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
  pan: 'esr=000000009600000f',
  'entry-registers': 'exit=0000000000000000',
  'stderr-bad-pointer': 'exit=0000000000000000',
  'stderr-huge-length': 'exit=0000000000000000',
  'writev-stderr-bad': 'exit=0000000000000000',
  'empty-iovec': 'exit=0000000000000000',
  'abi-int-truncation': 'exit=0000000000000000',
  'brk-regrow-zero': 'exit=0000000000000000',
  'brk-shrink-unmaps': 'esr=0000000092000007',
  'poll-archive-fd': 'exit=0000000000000000'
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
  await run(['cargo', '+' + pins().rust_toolchain, 'build', '--manifest-path', join(root, 'Cargo.toml'), '--release', '--target', 'aarch64-unknown-none', '--features', 'probe'], { env });
  const image = join(work, 'probe-kernel.bin');
  await run(['/opt/homebrew/opt/llvm@22/bin/llvm-objcopy', '-O', 'binary', join(work, 'target/aarch64-unknown-none/release/jitk-02'), image]);
  const result = await capture([HOST, image], { timeout: 5 });
  const row = { returncode: result.returncode, output: result.stdout.toString(), stderr: result.stderr.toString(), image_sha256: sha(readFileSync(image)), load: uptime(), status: result.returncode === 0 && result.stdout.toString().includes(expected[name]) ? 'PASS' : 'FAIL' };
  results[name] = row;
  check(row.status === 'PASS', JSON.stringify(row));
  console.log(name, JSON.stringify(row));
}
writeFileSync(join(evidence, 'probe-results.json'), JSON.stringify(results, null, 2));
