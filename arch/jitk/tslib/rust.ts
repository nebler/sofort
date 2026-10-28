// The rustup check shared by the cache builders (tools/deps.ts,
// shard/snapshot.ts). Kept out of deps.ts, which every tool imports, so that
// module stays free of subprocess code.
import { check } from './assert.ts';
import { cargoPath } from './deps.ts';
import { capture, run } from './subprocess.ts';

// The named toolchain's cargo and rustc (and PATH with rustup's bin
// directory) after checking it carries the given components and targets; a
// missing piece names the rustup command.
export async function rustToolchain(env: Record<string, string>, name: string, targets: string[], components: string[]): Promise<Record<string, string>> {
  const settings = { ...env, PATH: cargoPath(env.PATH || '') };
  const install = 'rustup toolchain install ' + name + ' --profile minimal' + components.map(c => ' --component ' + c).join('') + targets.map(t => ' --target ' + t).join('');
  const listed = await capture(['rustup', 'component', 'list', '--installed', '--toolchain', name], { env: settings, timeout: 120 });
  check(listed.returncode === 0, 'Rust toolchain ' + name + ' is not installed; prerequisite: `' + install + '`');
  const installed = listed.stdout.toString().split('\n').map(line => line.trim());
  for (const needed of [...components, ...targets.map(t => 'rust-std-' + t)]) {
    check(installed.some(line => line === needed || line.startsWith(needed + '-')), 'Rust toolchain ' + name + ' lacks ' + needed + '; prerequisite: `' + install + '`');
  }
  const which = async (tool: string): Promise<string> => (await run(['rustup', 'which', '--toolchain', name, tool], { env: settings, timeout: 120 })).stdout.toString().trim();
  return { PATH: settings.PATH, CARGO: await which('cargo'), RUSTC: await which('rustc') };
}
