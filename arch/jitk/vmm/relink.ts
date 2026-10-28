import { mkdirSync, realpathSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { platform } from 'node:os';
import { check, dump, output, run, sha } from './lib.ts';
import { pins } from '../tslib/deps.ts';
const root = import.meta.dirname;
check(process.env.JITK_VMM_BUILD, 'JITK_VMM_BUILD required');
const requested = resolve(process.env.JITK_VMM_BUILD);
mkdirSync(requested, { recursive: true });
const out = realpathSync(requested);
const deps = join(out, 'libkrun/target/release/deps');
const args = ['rustc', '+' + pins().rust_toolchain, '--edition=2024', '-O', '-C', 'lto=fat', '-C', 'panic=abort', '--cfg', 'sandbox_ready', '--extern', 'krun=' + join(deps, 'libkrun.rlib'), '-L', 'dependency=' + deps];
for (const [crate, prefix] of [['libc', 'liblibc-'], ['utils', 'libkrun_utils-']]) {
  const matches = readdirSync(deps).filter(name => name.startsWith(prefix) && name.endsWith('.rlib'));
  check(matches.length === 1, crate + ': expected one rlib');
  args.push('--extern', crate + '=' + join(deps, matches[0]));
}
const sources = [['src/main.rs', 'jitk-vmm']];
if (platform() === 'linux') {
  sources.push(['tests/seccomp-probe.rs', 'seccomp-probe']);
}
for (const [source, name] of sources) {
  await run([...args, join(root, source), '-o', join(out, name)], { inherit: true });
  if (platform() === 'darwin') {
    await run(['strip', '-x', join(out, name)], { inherit: true });
    await run(['codesign', '--force', '--sign', '-', '--entitlements', join(root, 'hypervisor.entitlements'), join(out, name)], { inherit: true });
  } else {
    await run(['strip', join(out, name)], { inherit: true });
  }
}
const patches: Record<string, string> = {};
for (const name of readdirSync(join(root, 'patches')).filter(name => name.endsWith('.diff'))) {
  patches[name] = sha(readFileSync(join(root, 'patches', name)));
}
const hashes: Record<string, string> = {};
for (const path of [...readdirSync(join(root, 'src')).filter(name => name.endsWith('.rs')).map(name => join(root, 'src', name)), join(root, 'sandbox/mod.rs')]) {
  hashes[relative(root, path)] = sha(readFileSync(path));
}
const metadata = { revision: 'a1d8616765da03980f3be1bb8714bfdd3842f33c', patches_sha256: patches, panic: 'abort', features: [], sandbox_ready: true, binary: join(out, 'jitk-vmm'), binary_sha256: sha(readFileSync(join(out, 'jitk-vmm'))), rustc: output(['rustc', '+' + pins().rust_toolchain, '--version']).trim(), relink_command: args, source_sha256: hashes };
dump(join(out, 'build.json'), metadata);
console.log(JSON.stringify(metadata, null, 2));
