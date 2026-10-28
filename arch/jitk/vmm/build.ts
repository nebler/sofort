import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { platform } from 'node:os';
import { check, dump, environment, output, readJSON, run, sha } from './lib.ts';
import { libkrunDir, pins, vmmBuildDir, vmmInputs, withLock } from '../tslib/deps.ts';
// JITK_VMM_ROOT: the vmm tree to build. A scriptc binary's import.meta.dirname
// is the checkout it was compiled in, so the Linux builder that the Mac ships
// to kvm-dev (linux/nested/build.ts) names the shipped copy here.
const root = resolve(process.env.JITK_VMM_ROOT || import.meta.dirname);
// The arch/jitk tree around root; its tools/deps.json carries the Rust pin.
const jitk = resolve(root, '..');
const revision = 'a1d8616765da03980f3be1bb8714bfdd3842f33c';
const mac = platform() === 'darwin';
// Default: the jitk cache entry keyed by root's VMM inputs, with the patched
// libkrun shared per patch set (../tslib/deps.ts). An explicit
// JITK_VMM_BUILD keeps its own libkrun/ unless JITK_VMM_LIBKRUN names one.
const explicitOut = process.env.JITK_VMM_BUILD || '';
const out = resolve(explicitOut || vmmBuildDir(jitk));
const lib = resolve(process.env.JITK_VMM_LIBKRUN || (explicitOut ? join(out, 'libkrun') : libkrunDir(jitk)));
if (process.argv.includes('--print-binary')) {
  console.log(join(out, 'jitk-vmm'));
  process.exit(0);
}
const env = environment();
env.RUSTUP_TOOLCHAIN = pins(jitk).rust_toolchain;
env.CARGO_PROFILE_RELEASE_PANIC = 'abort';
async function command(args: string[]): Promise<void> {
  await run(args, { env, inherit: true });
}
const inputs = vmmInputs(jitk);
function upToDate(): boolean {
  const recorded = join(out, 'build.json');
  if (!inputs || !existsSync(recorded) || !existsSync(join(out, 'jitk-vmm'))) {
    return false;
  }
  const previous = readJSON<Record<string, unknown>>(recorded);
  return previous.inputs_sha256 === inputs && previous.binary_sha256 === sha(readFileSync(join(out, 'jitk-vmm')));
}
function isLink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}
async function build(): Promise<void> {
  if (upToDate()) {
    console.log('jitk-vmm: up to date ' + join(out, 'jitk-vmm') + ' (inputs ' + inputs + ')');
    return;
  }
  mkdirSync(out, { recursive: true });
  const local = join(out, 'libkrun');
  if (lib !== local) {
    // Link the shared checkout as out/libkrun so lint, relink and the sandbox
    // unit tests find its rlibs at the documented place.
    const present = existsSync(local) || isLink(local);
    check(!present || isLink(local), local + ' exists and is not a link to ' + lib);
    if (!present || readlinkSync(local) !== lib) {
      rmSync(local, { force: true });
      symlinkSync(lib, local, 'dir');
    }
  }
  if (!existsSync(join(lib, '.git'))) {
    mkdirSync(resolve(lib, '..'), { recursive: true });
    await command(['git', 'clone', '--no-checkout', process.env.LIBKRUN_SOURCE || 'https://github.com/containers/libkrun.git', lib]);
  }
  const patches = readFileSync(join(root, 'patches/series'), 'utf8').split('\n').filter(Boolean).map(name => join(root, 'patches', name));
  const fingerprint = sha(Buffer.concat(patches.map(path => readFileSync(path))));
  // Beside the checkout it describes, so a shared libkrun is patched once.
  const stamp = lib === local ? join(out, 'patch-set.sha256') : join(lib, '.git', 'jitk-patch-set.sha256');
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
  // The remap keeps the checkout path out of the binary (panic locations), so
  // equal inputs give an identical jitk-vmm in every checkout.
  const args = ['rustc', '--edition=2024', '-O', '-C', 'lto=fat', '-C', 'panic=abort', '--remap-path-prefix=' + resolve(root) + '=arch/jitk/vmm', join(root, 'src/main.rs'), '--extern', 'krun=' + join(deps, 'libkrun.rlib'), '-L', 'dependency=' + deps, '-o', join(out, 'jitk-vmm')];
  for (const [crate, prefix] of [['libc', 'liblibc-'], ['utils', 'libkrun_utils-']]) {
    const matches = readdirSync(deps).filter(name => name.startsWith(prefix) && name.endsWith('.rlib'));
    check(matches.length === 1, crate + ': expected one rlib');
    args.push('--extern', crate + '=' + join(deps, matches[0]));
  }
  const ready = existsSync(join(root, 'sandbox/.READY'));
  if (ready) {
    args.push('--cfg', 'sandbox_ready');
  }
  // build.json is the completion marker; never leave a stale one beside a new binary.
  rmSync(join(out, 'build.json'), { force: true });
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
  const metadata = { revision, patches_sha256: patchHashes, panic: 'abort', features: [], sandbox_ready: ready, binary: join(out, 'jitk-vmm'), binary_sha256: sha(readFileSync(join(out, 'jitk-vmm'))), rustc, inputs_sha256: inputs, libkrun: lib };
  dump(join(out, 'build.json'), metadata);
  console.log(JSON.stringify(metadata, null, 2));
}
await withLock('vmm-' + basename(lib), build);
