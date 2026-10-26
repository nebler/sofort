import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { platform } from 'node:os';
import { check, dump, environment, output, run, sha } from './lib.ts';
const root = process.env.JITK_VMM_ROOT || import.meta.dirname;
const revision = 'a1d8616765da03980f3be1bb8714bfdd3842f33c';
const mac = platform() === 'darwin';
const out = process.env.JITK_VMM_BUILD || '/tmp/jitk-01/r3/' + platform();
const lib = join(out, 'libkrun');
const env = environment();
env.RUSTUP_TOOLCHAIN = '1.95.0';
env.CARGO_PROFILE_RELEASE_PANIC = 'abort';
async function command(args: string[]): Promise<void> {
  await run(args, { env, inherit: true });
}
mkdirSync(out, { recursive: true });
if (!existsSync(join(lib, '.git'))) {
  await command(['git', 'clone', '--no-checkout', process.env.LIBKRUN_SOURCE || 'https://github.com/containers/libkrun.git', lib]);
}
const patches = readFileSync(join(root, 'patches/series'), 'utf8').split('\n').filter(Boolean).map(name => join(root, 'patches', name));
const fingerprint = sha(Buffer.concat(patches.map(path => readFileSync(path))));
const stamp = join(out, 'patch-set.sha256');
if (!existsSync(stamp) || readFileSync(stamp, 'utf8').trim() !== fingerprint) {
  await command(['git', '-C', lib, 'reset', '--hard', revision]);
  await command(['git', '-C', lib, 'clean', '-fd', '--', 'src', 'Makefile']);
  for (const patch of patches) {
    await command(['git', '-C', lib, 'apply', '--check', patch]);
    await command(['git', '-C', lib, 'apply', patch]);
  }
  writeFileSync(stamp, fingerprint + '\n');
}
check(output(['git', '-C', lib, 'rev-parse', 'HEAD']).trim() === revision);
await command(['make', '-C', lib, 'FFI=0', 'target/release/' + (mac ? 'libkrun.2.0.0.dylib' : 'libkrun.so.2.0.0')]);
const deps = join(lib, 'target/release/deps');
const args = ['rustc', '--edition=2024', '-O', '-C', 'lto=fat', '-C', 'panic=abort', join(root, 'src/main.rs'), '--extern', 'krun=' + join(deps, 'libkrun.rlib'), '-L', 'dependency=' + deps, '-o', join(out, 'jitk-vmm')];
for (const [crate, prefix] of [['libc', 'liblibc-'], ['utils', 'libkrun_utils-']]) {
  const matches = readdirSync(deps).filter(name => name.startsWith(prefix) && name.endsWith('.rlib'));
  check(matches.length === 1, crate + ': expected one rlib');
  args.push('--extern', crate + '=' + join(deps, matches[0]));
}
const ready = existsSync(join(root, 'sandbox/.READY'));
if (ready) {
  args.push('--cfg', 'sandbox_ready');
}
await command(args);
if (!mac && ready) {
  await command(args.map(arg => arg === join(root, 'src/main.rs') ? join(root, 'tests/seccomp-probe.rs') : arg === join(out, 'jitk-vmm') ? join(out, 'seccomp-probe') : arg));
}
if (mac) {
  await command(['strip', '-x', join(out, 'jitk-vmm')]);
  await command(['codesign', '--force', '--sign', '-', '--entitlements', join(root, 'hypervisor.entitlements'), join(out, 'jitk-vmm')]);
} else {
  await command(['strip', join(out, 'jitk-vmm')]);
}
const patchHashes: Record<string, string> = {};
for (const path of patches) {
  patchHashes[path.split('/').pop()!] = sha(readFileSync(path));
}
const rustc = (await run(['rustc', '--version'], { env })).stdout.toString().trim();
const metadata = { revision, patches_sha256: patchHashes, panic: 'abort', features: [], sandbox_ready: ready, binary: join(out, 'jitk-vmm'), binary_sha256: sha(readFileSync(join(out, 'jitk-vmm'))), rustc };
dump(join(out, 'build.json'), metadata);
console.log(JSON.stringify(metadata, null, 2));
