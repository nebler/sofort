import { existsSync, lstatSync, readFileSync, realpathSync, unlinkSync } from 'node:fs';
import { isAbsolute, join, resolve, dirname, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { check, output, capture, environment } from './lib.ts';

export const ROOT = resolve(import.meta.dirname, '..');

export function gitSnapshot(root: string): string[] {
  return [
    ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', '.'],
    ['diff', '--binary', '--', '.'],
    ['diff', '--cached', '--binary', '--', '.']
  ].map(args => output(['git', '-C', root, ...args]));
}

function nodeBinary(): string {
  const node = process.env.JITK_NODE || '';
  check(isAbsolute(node) && existsSync(node) && lstatSync(node).isFile(), 'jitk: set JITK_NODE to a verified absolute Node >=24 executable; see executor/README.md');
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
  check(existsSync(directory) && lstatSync(directory).isDirectory() && existsSync(readme), `jitk: ${subtree} is incomplete: missing ${readme}; owner must supply documented ${action} entrypoint`);
  const prerequisites = new Map<string, string[]>([
    ['executor/demo', ['kernel', 'vmm', 'vmm/sandbox', 'executor', 'executor/policy']],
    ['grow/grow', ['kernel', 'vmm', 'vmm/sandbox']],
    ['grow/demo', ['grow']],
    ['bench/bench', ['kernel', 'vmm', 'vmm/sandbox', 'executor', 'executor/policy', 'bench/hyperlight']],
    ['linux/nested', ['kernel', 'vmm/sandbox']],
    ['linux/test', ['kernel', 'vmm/sandbox']]
  ]);
  const missing = (prerequisites.get(subtree + '/' + action) || []).map(part => join(root, part, '.READY')).filter(path => !existsSync(path));
  check(missing.length === 0, `jitk: ${subtree}/${action} needs canonical ready inputs: ${missing.join(', ')}; see ${readme}`);
  let commands: string[][];
  if (subtree === 'vmm/sandbox' && action === 'test') {
    commands = [['/bin/sh', join(directory, 'tests/run-unit.sh')]];
  } else if (subtree === 'executor/policy' && action === 'test') {
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
    const npm = realpathSync(process.env.JITK_NPM_CLI || output(['/bin/sh', '-c', 'command -v npm']).trim());
    check(extname(npm) === '.js' && lstatSync(npm).isFile(), 'jitk: locked dependency install needs absolute JITK_NODE >=24 and JITK_NPM_CLI pointing to npm-cli.js; see executor/README.md');
    commands = [[node, npm, 'ci', '--ignore-scripts', '--no-audit', '--no-fund', '--cache', process.env.JITK_NPM_CACHE || join(tmpdir(), 'jitk-npm-cache')]];
  } else if (subtree === 'linux' && ['nested', 'test'].includes(action) && existsSync(join(directory, 'run.sh'))) {
    commands = [['/bin/bash', join(directory, 'run.sh'), '--nested']];
  } else if (existsSync(join(directory, 'Makefile'))) {
    const command = [process.env.MAKE || 'make', '-C', directory, action];
    if (subtree === 'vmm' && process.env.JITK_VMM_BUILD) {
      const out = String(process.env.JITK_VMM_BUILD);
      command.push('BUILD_DIR=' + out, 'JITK_VMM=' + join(out, 'jitk-vmm'), 'PROFILE=' + join(out, 'test.sbbin'));
      if (process.env.JITK_TEST_IMAGES) {
        command.push('IMAGES=' + process.env.JITK_TEST_IMAGES);
      }
    }
    commands = [command];
  } else if (existsSync(join(directory, action + '.sh'))) {
    const script = join(directory, action + '.sh');
    const shell = readFileSync(script, 'utf8').split('\n')[0].includes('bash') ? '/bin/bash' : '/bin/sh';
    commands = [[shell, script]];
  } else {
    throw new Error(`jitk: no ${action} entrypoint in ${subtree}; see ${readme}; expected Makefile target '${action}' or ${action}.sh`);
  }
  console.log(`jitk: delegating ${subtree}/${action} (see ${readme})`);
  const env = environment();
  if (subtree === 'protocol' && env.JITK_NODE) {
    env.NODE = env.JITK_NODE;
  }
  if (subtree === 'kernel' && env.JITK_KERNEL_CARGO_TARGET_DIR) {
    env.CARGO_TARGET_DIR = env.JITK_KERNEL_CARGO_TARGET_DIR;
  }
  const guarded = action.startsWith('test');
  if (guarded && subtree === 'linux' && !env.JITK_NESTED_SSH) {
    const common = output(['git', '-C', root, 'rev-parse', '--path-format=absolute', '--git-common-dir']).trim();
    env.JITK_NESTED_SSH = join(dirname(common), 'kvm-dev/ssh.sh');
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
