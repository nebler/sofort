import { mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { run } from '../lib.ts';
const root = join(import.meta.dirname, 'fixtures');
const out = process.env.JITK_TEST_IMAGES || '/tmp/jitk-01/r3/images';
mkdirSync(out, { recursive: true });
await run(['clang', '--target=aarch64-none-elf', '-c', join(root, 'start.S'), '-o', join(out, 'start.o')], { inherit: true });
async function compile(name: string, source: string, flags: string[], linker: string): Promise<void> {
  await run(['clang', '--target=aarch64-none-elf', ...flags, '-c', join(root, source), '-o', join(out, name + '.o')], { inherit: true });
  const objects = source.endsWith('.c') ? [join(out, 'start.o'), join(out, name + '.o')] : [join(out, name + '.o')];
  await run(['ld.lld', '-T', join(root, linker), ...objects, '--oformat=binary', '-o', join(out, name + '.bin')], { inherit: true });
}
const options = ['-O2', '-mstrict-align', '-mgeneral-regs-only', '-ffreestanding', '-fno-builtin', '-nostdlib'];
for (const name of ['first', 'parking', 'byteecho']) {
  const flags = name === 'first' ? [] : name === 'parking' ? ['-DPARK'] : ['-DPARK', '-DCLI_BUF_ECHO'];
  await compile(name, 'parking-guest.c', [...flags, ...options], 'probe.ld');
}
for (let mode = 1; mode < 10; mode += 1) {
  await compile('console-abuse-' + mode, 'console-abuse.c', ['-DMODE=' + mode, ...options], 'probe.ld');
}
for (const name of readdirSync(root).filter(name => name.endsWith('.S') && name !== 'start.S')) {
  await compile(name.slice(0, -2), name, [], 'link.ld');
}
console.log(out);
