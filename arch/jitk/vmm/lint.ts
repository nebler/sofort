import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { check, environment, run } from './lib.ts';
import { vmmBuildDir } from '../tslib/deps.ts';
const root = import.meta.dirname;
const build = process.env.JITK_VMM_BUILD || vmmBuildDir();
const deps = join(build, 'libkrun/target/release/deps');
const flags = ['--cfg', 'sandbox_ready', '-C', 'panic=abort', '-Zpanic_abort_tests', '-L', 'dependency=' + deps, '--extern', 'krun=' + join(deps, 'libkrun.rlib')];
for (const [crate, prefix] of [['libc', 'liblibc-'], ['utils', 'libkrun_utils-']]) {
  const matches = readdirSync(deps).filter(name => name.startsWith(prefix) && name.endsWith('.rlib'));
  check(matches.length === 1, 'build the pinned VMM first: expected one ' + prefix + '*.rlib in ' + deps);
  flags.push('--extern', crate + '=' + join(deps, matches[0]));
}
const env = environment();
env.RUSTC_BOOTSTRAP = '1';
env.CARGO_ENCODED_RUSTFLAGS = flags.join('\x1f');
await run(['cargo', '+1.95.0', 'clippy', '--manifest-path', join(root, 'Cargo.toml'), '--locked', '--offline', '--all-targets', '--', '-Dwarnings', '-Dclippy::undocumented_unsafe_blocks'], { env, inherit: true });
