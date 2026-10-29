import { existsSync, lstatSync, readFileSync, realpathSync, statSync, unlinkSync } from 'node:fs';
import { isAbsolute, join, resolve, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { check, output, capture, environment } from './lib.ts';
import { cacheDefaults, requireArtifact } from '../tslib/deps.ts';
import { guard } from '../tslib/evidence.ts';

export const ROOT = resolve(import.meta.dirname, '..');

export function gitSnapshot(root: string): string[] {
  return [
    ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', '.'],
    ['diff', '--binary', '--', '.'],
    ['diff', '--cached', '--binary', '--', '.']
  ].map(args => output(['git', '-C', root, ...args]));
}

// JITK_NODE when set, else the pinned Node from `make -C arch/jitk deps`.
function nodeBinary(): string {
  const node = requireArtifact('JITK_NODE');
  check(isAbsolute(node) && existsSync(node) && statSync(node).isFile(), 'jitk: JITK_NODE must be a verified absolute Node >=24 executable (or unset for the deps cache); see executor/README.md');
  return node;
}

export async function delegate(subtree: string, action: string, root = ROOT): Promise<number> {
  const flags = (process.env.MAKEFLAGS || '').split(/\s+/);
  if (flags.some(flag => flag === '--just-print' || (!flag.startsWith('-') && !flag.includes('=') && flag.includes('n')) || (flag.startsWith('-') && !flag.startsWith('--') && flag.includes('n')))) {
    console.log(`jitk: dry-run delegation ${subtree}/${action}`);
    return 0;
  }
  const directory = join(root, subtree);
  const readme = join(directory, 'README.md');
  check(existsSync(directory) && statSync(directory).isDirectory() && existsSync(readme) && statSync(readme).isFile(), `jitk: ${subtree} is incomplete: missing ${readme}; owner must supply documented ${action} entrypoint`);
  const prerequisites = new Map<string, string[]>([
    ['executor/demo', ['executor', 'executor/policy']],
    ['grow/grow', ['kernel']],
    ['grow/demo', ['grow']],
    ['bench/bench', ['kernel', 'executor', 'executor/policy', 'bench/hyperlight']]
  ]);
  const missing = (prerequisites.get(subtree + '/' + action) || []).map(part => join(root, part, '.READY')).filter(path => !existsSync(path) || !statSync(path).isFile());
  check(missing.length === 0, `jitk: ${subtree}/${action} needs canonical ready inputs: ${missing.join(', ')}; see ${readme}`);
  let commands: string[][];
  if (subtree === 'executor/policy' && action === 'test') {
    commands = ['policy-test.mjs', 'policy-hostile.mjs'].map(script => [nodeBinary(), join(directory, script)]);
  } else if (subtree === 'bench/hyperlight' && action === 'test') {
    commands = [[nodeBinary(), '--experimental-transform-types', join(directory, 'adapter-test.ts')]];
  } else if (subtree === 'executor' && action === 'dependencies') {
    const modules = join(directory, 'node_modules');
    let linked = false;
    try {
      linked = lstatSync(modules).isSymbolicLink();
    } catch {}
    if (linked && existsSync(modules)) {
      console.log('jitk: existing development dependency link retained; clean copies use a local locked install');
      return 0;
    }
    if (linked) {
      unlinkSync(modules);
    }
    const node = nodeBinary();
    // The npm bundled with the pinned Node (same install), unless overridden.
    const npm = realpathSync(requireArtifact('JITK_NPM_CLI'));
    check(extname(npm) === '.js' && lstatSync(npm).isFile(), 'jitk: locked dependency install needs JITK_NPM_CLI pointing to npm-cli.js (or unset for the deps cache); see executor/README.md');
    commands = [[node, npm, 'ci', '--ignore-scripts', '--no-audit', '--no-fund', '--cache', process.env.JITK_NPM_CACHE || join(tmpdir(), 'jitk-npm-cache')]];
  } else if (existsSync(join(directory, 'Makefile'))) {
    commands = [[process.env.MAKE || 'make', '-C', directory, action]];
  } else if (existsSync(join(directory, action + '.sh'))) {
    const script = join(directory, action + '.sh');
    const shell = readFileSync(script, 'utf8').split('\n')[0].includes('bash') ? '/bin/bash' : '/bin/sh';
    commands = [[shell, script]];
  } else {
    throw new Error(`jitk: no ${action} entrypoint in ${subtree}; see ${readme}; expected Makefile target '${action}' or ${action}.sh`);
  }
  console.log(`jitk: delegating ${subtree}/${action} (see ${readme})`);
  // Unset artifact variables default to the deps cache for every subtree;
  // explicit values are kept.
  const env = { ...environment(), ...cacheDefaults() };
  if (subtree === 'protocol' && env.JITK_NODE) {
    env.NODE = env.JITK_NODE;
  }
  if (subtree === 'kernel' && env.JITK_KERNEL_CARGO_TARGET_DIR) {
    env.CARGO_TARGET_DIR = env.JITK_KERNEL_CARGO_TARGET_DIR;
  }
  const guarded = action.startsWith('test');
  // Bulk evidence lives in the store (evidence/README.md at the repo root):
  // refuse to test a tree that tracks new evidence above 64 KiB.
  const oversized = guarded ? guard(output(['git', '-C', root, 'rev-parse', '--show-toplevel']).trim()) : [];
  if (oversized.length) {
    console.error(`jitk: ${subtree}/${action} refused: tracked evidence above 64 KiB belongs in the evidence store (evidence/README.md; tools/.work/bin/evidence export, then remove), or in "kept" of evidence/manifest.json when a build/test reads it:`);
    console.error(oversized.join('\n'));
    return 1;
  }
  const before = guarded ? gitSnapshot(root) : [];
  let status = 0;
  for (const command of commands) {
    status = (await capture(command, { cwd: directory, env, inherit: true })).returncode;
    if (status !== 0) {
      break;
    }
  }
  if (guarded) {
    const after = gitSnapshot(root);
    if (before.some((item, i) => item !== after[i])) {
      console.error(`jitk: ${subtree}/${action} changed Git state under ${root}; put test output in .work/ and record evidence explicitly`);
      console.error(after[0].replaceAll('\0', '\n'));
      return status || 1;
    }
  }
  return status;
}
