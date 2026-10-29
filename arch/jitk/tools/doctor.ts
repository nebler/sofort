// `make -C arch/jitk doctor`: one pass over what `make deps build test` needs
// on this host. Each item prints one line: ok, warn (optional, or built by a
// make target) or FAIL (a hard requirement), with the exact fix command.
// Exits 1 only on FAIL. The checks run concurrently with short timeouts; the
// slowest is `deps verify` (re-hashes the cache entries, ~2 s).
//   hard:  curl/git/tar/xz; rustup with the pinned toolchains, targets and
//          components; macOS: Xcode clang, ld.lld, llvm-objcopy; Linux: cc,
//          clang, ld.lld, llvm-objcopy
//   soft:  the evidence store (evidence/manifest.json); clippy/rustfmt (abi test, kernel make check/fmt); the deps cache (`make deps`, which `make build` runs anyway); Docker
//          (GrowOS oracle runs); macOS: the Linux dev
//          VM (JITK_NESTED_SSH) and its /dev/kvm; Linux: /dev/kvm access
import { accessSync, constants, existsSync, statSync } from 'node:fs';
import { platform } from 'node:os';
import { dirname, join } from 'node:path';
import { detail } from '../tslib/assert.ts';
import { DEPS_TARGET, JITK_ROOT, cacheRoot, cargoPath, hostPlatform, pins } from '../tslib/deps.ts';
import { readManifest, repoRoot, storeRoot, verifyStore } from '../tslib/evidence.ts';
import { environment } from '../tslib/process.ts';
import { capture, output } from '../tslib/subprocess.ts';

const mac = platform() === 'darwin';
const env = { ...environment(), PATH: cargoPath(process.env.PATH || '/usr/bin:/bin') };

interface Item {
  level: 'ok' | 'warn' | 'FAIL';
  name: string;
  detail: string;
  fix?: string;
}

function ok(name: string, text: string): Item {
  return { level: 'ok', name, detail: text };
}

function problem(level: 'warn' | 'FAIL', name: string, text: string, fix: string): Item {
  return { level, name, detail: text, fix };
}

function which(tool: string): string {
  for (const dir of env.PATH.split(':')) {
    const path = join(dir || '.', tool);
    try {
      accessSync(path, constants.X_OK);
      if (statSync(path).isFile()) {
        return path;
      }
    } catch {}
  }
  return '';
}

// stdout of a command, or '' when it is missing, fails or times out.
async function probe(command: string[], timeout: number): Promise<string> {
  try {
    const result = await capture(command, { env, timeout });
    return result.returncode === 0 && !result.timeout ? result.stdout.toString().trim() : '';
  } catch {
    return '';
  }
}

function basics(): Item[] {
  const missing = ['curl', 'git', 'tar', 'xz'].filter(tool => !which(tool));
  if (missing.length === 0) {
    return [ok('base tools', 'curl, git, tar, xz')];
  }
  const fix = mac ? 'brew install ' + missing.join(' ') : 'sudo apt-get install -y ' + missing.map(t => (t === 'xz' ? 'xz-utils' : t)).join(' ');
  return [problem('FAIL', 'base tools', 'missing ' + missing.join(', '), fix)];
}

// One toolchain with the targets and components the build needs from it.
async function toolchain(name: string, why: string, targets: string[], components: string[], level: 'warn' | 'FAIL' = 'FAIL', suffix = ''): Promise<Item> {
  const label = 'rust ' + name + suffix;
  const listed = await probe(['rustup', 'component', 'list', '--installed', '--toolchain', name], 20);
  if (!listed) {
    const install = 'rustup toolchain install ' + name + ' --profile minimal' + components.map(c => ' --component ' + c).join('') + targets.map(t => ' --target ' + t).join('');
    return problem(level, label, 'not installed (' + why + ')', install);
  }
  const lines = listed.split('\n').map(line => line.trim());
  const has = (piece: string): boolean => lines.some(line => line === piece || line.startsWith(piece + '-'));
  const absentTargets = targets.filter(t => !has('rust-std-' + t));
  const absentComponents = components.filter(c => !has(c));
  if (absentTargets.length === 0 && absentComponents.length === 0) {
    return ok(label, [...targets, ...components].join(', ') || 'installed');
  }
  const fixes: string[] = [];
  if (absentTargets.length > 0) {
    fixes.push('rustup target add --toolchain ' + name + ' ' + absentTargets.join(' '));
  }
  if (absentComponents.length > 0) {
    fixes.push('rustup component add --toolchain ' + name + ' ' + absentComponents.join(' '));
  }
  return problem(level, label, 'lacks ' + [...absentTargets, ...absentComponents].join(', ') + ' (' + why + ')', fixes.join(' && '));
}

async function rust(): Promise<Item[]> {
  if (!which('rustup')) {
    return [problem('FAIL', 'rustup', 'not found on PATH or in ~/.cargo/bin', "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain none")];
  }
  const p = pins();
  const checks = [
    // The kernel (aarch64-unknown-none) everywhere.
    toolchain(p.rust_toolchain, 'tools/deps.json rust_toolchain', ['aarch64-unknown-none'], [])
  ];
  if (mac) {
    checks.push(toolchain(p.hyperlight_toolchain, 'Hyperlight baseline, make deps', p.hyperlight_targets, ['rust-src']));
  }
  // libFuzzer with ASan needs nightly: `make -C shard fuzz-smoke` (make test, make ci).
  checks.push(toolchain(p.fuzz_toolchain, 'shard fuzz-smoke', [], []));
  // clippy and rustfmt: `make -C abi test` (part of `make test` and `make ci`),
  // the kernel's `make check` and `make fmt`.
  checks.push(toolchain(p.rust_toolchain, 'abi test, kernel make check/fmt', [], ['clippy', 'rustfmt'], 'warn', ' lint'));
  return [ok('rustup', which('rustup')), ...(await Promise.all(checks))];
}

function native(): Item[] {
  const items: Item[] = [];
  if (mac) {
    // /usr/bin/clang is a shim that prompts for an install when the tools are absent.
    let developer = '';
    try {
      developer = output(['xcode-select', '-p']).trim();
    } catch {}
    items.push(developer && which('clang') ? ok('clang', which('clang') + ' (' + developer + ')') : problem('FAIL', 'clang', 'no Xcode command line tools', 'xcode-select --install'));
    // Several kernel/grow tests run /opt/homebrew/bin/ld.lld by absolute path.
    const lld = '/opt/homebrew/bin/ld.lld';
    items.push(existsSync(lld) ? ok('ld.lld', lld) : problem('FAIL', 'ld.lld', lld + ' missing (kernel/grow probes, shard native checks)', 'brew install lld'));
    // kernel/build.sh's default objcopy (OBJCOPY overrides it).
    const objcopy = process.env.OBJCOPY || '/opt/homebrew/opt/llvm@22/bin/llvm-objcopy';
    items.push(existsSync(objcopy) || which(objcopy) ? ok('llvm-objcopy', objcopy) : problem('FAIL', 'llvm-objcopy', objcopy + ' missing (kernel image)', 'brew install llvm@22'));
    return items;
  }
  // Linux: system cc (shard abi.c, the IPC bridge), clang/ld.lld (shard
  // native checks), llvm-objcopy (the ring kernel for shard snapshot).
  const objcopy = process.env.OBJCOPY || 'llvm-objcopy';
  const missing = ['cc', 'clang', 'ld.lld', objcopy, 'flock'].filter(tool => !which(tool) && !existsSync(tool));
  if (missing.length === 0) {
    return [ok('native tools', 'cc, clang, ld.lld, ' + objcopy + ', flock')];
  }
  const packages: Record<string, string> = { cc: 'build-essential', clang: 'clang', 'ld.lld': 'lld', 'llvm-objcopy': 'llvm', flock: 'util-linux' };
  return [problem('FAIL', 'native tools', 'missing ' + missing.join(', '), 'sudo apt-get install -y ' + missing.map(t => packages[t] || t).join(' '))];
}

async function docker(): Promise<Item> {
  const why = 'only needed for GrowOS (jitk-oracle:08) oracle runs';
  if (!mac) {
    return which('docker') ? ok('docker', 'not needed on a Linux host') : ok('docker', 'absent; not needed on a Linux host');
  }
  if (!which('docker')) {
    return problem('warn', 'docker', 'not installed; ' + why, 'brew install --cask docker');
  }
  const version = await probe(['docker', 'info', '--format', '{{.ServerVersion}}'], 4);
  return version ? ok('docker', 'engine ' + version) : problem('warn', 'docker', 'engine not reachable; ' + why, 'open -a Docker');
}

async function cache(): Promise<Item[]> {
  const deps = join(JITK_ROOT, 'tools/.work/bin/deps');
  let text = '';
  try {
    text = (await capture([deps, 'verify'], { env, timeout: 60 })).stdout.toString();
  } catch (error) {
    return [problem('warn', 'deps cache', 'deps verify failed: ' + detail(error), DEPS_TARGET)];
  }
  const rows = text.split('\n').filter(Boolean).map(line => JSON.parse(line) as Record<string, string>);
  const items: Item[] = [];
  // Unbuilt or stale entries, grouped by the make target that (re)builds them;
  // the prepared shard snapshot needs KVM and is not part of `make deps`.
  const pending: Record<string, string[]> = {};
  let good = 0;
  for (const row of rows) {
    if (row.state === 'ok' || row.state === 'environment') {
      good += 1;
    } else if (row.state === 'missing' && process.env[row.name]) {
      items.push(problem('FAIL', row.name, row.name + '=' + row.path + ' does not exist', 'unset ' + row.name));
    } else {
      (pending[row.target] ??= []).push(row.name + (row.state === 'stale' ? ' (stale)' : ''));
    }
  }
  const summary = String(good) + '/' + String(rows.length) + ' verified for ' + hostPlatform() + ' in ' + cacheRoot();
  const targets = Object.keys(pending);
  if (targets.length === 0) {
    items.unshift(ok('deps cache', summary));
  }
  for (const target of targets) {
    items.unshift(problem('warn', 'deps cache', summary + '; not built: ' + pending[target].join(', '), target));
  }
  return items;
}

// The Linux dev VM the shard/KVM suites (test-linux, parity-ssh) drive over ssh.
async function devVm(): Promise<Item> {
  let ssh = process.env.JITK_NESTED_SSH || '';
  if (!ssh) {
    let common = '';
    try {
      common = output(['git', '-C', JITK_ROOT, 'rev-parse', '--path-format=absolute', '--git-common-dir']).trim();
    } catch {}
    ssh = common ? join(dirname(common), 'kvm-dev/ssh.sh') : '';
  }
  const why = 'only for the shard/KVM suites (make -C executor parity-ssh)';
  if (!ssh || !existsSync(ssh)) {
    return problem('warn', 'linux dev VM', 'no ssh wrapper at ' + (ssh || 'kvm-dev/ssh.sh') + '; ' + why, 'export JITK_NESTED_SSH=/path/to/kvm-dev/ssh.sh');
  }
  const answer = await probe([ssh, 'if [ -c /dev/kvm ]; then if [ -r /dev/kvm ] && [ -w /dev/kvm ]; then echo rw; else echo denied; fi; else echo none; fi'], 4);
  if (!answer) {
    const start = join(dirname(ssh), 'start.sh');
    return problem('warn', 'linux dev VM', ssh + ' not reachable within 4 s; ' + why, existsSync(start) ? 'sh ' + start : 'start the VM behind ' + ssh);
  }
  if (answer === 'rw') {
    return ok('linux dev VM', ssh + ' (/dev/kvm rw)');
  }
  return problem('warn', 'linux dev VM', answer === 'none' ? 'reachable but has no /dev/kvm (nested virtualization off)' : 'reachable but /dev/kvm is not accessible to its user', answer === 'none' ? 'enable nested KVM for the VM' : ssh + " 'sudo usermod -aG kvm $USER'");
}

function localKvm(): Item {
  try {
    accessSync('/dev/kvm', constants.R_OK | constants.W_OK);
    return ok('kvm', '/dev/kvm rw');
  } catch {
    const fix = existsSync('/dev/kvm') ? 'sudo usermod -aG kvm "$USER" (then log in again)' : 'enable KVM (nested virtualization) for this host';
    return problem('warn', 'kvm', '/dev/kvm ' + (existsSync('/dev/kvm') ? 'not accessible' : 'missing') + '; the shard snapshot and KVM tests need it', fix);
  }
}

// The evidence store behind evidence/manifest.json (R10 W0.1). Optional:
// only reading moved raw evidence needs it.
function evidenceStore(): Item {
  try {
    const manifest = readManifest(repoRoot(JITK_ROOT));
    if (!manifest) {
      return ok('evidence store', 'no evidence/manifest.json');
    }
    const problems = verifyStore(manifest);
    if (problems.length === 0) {
      return ok('evidence store', String(manifest.files.length) + ' manifest entries verified in ' + storeRoot());
    }
    const state = existsSync(storeRoot()) ? String(problems.length) + ' of ' + String(manifest.files.length) + ' manifest entries missing or wrong in ' + storeRoot() : storeRoot() + ' missing';
    return problem('warn', 'evidence store', state + ' (only reading moved raw evidence needs it)', 'arch/jitk/tools/.work/bin/evidence fetch <path> (falls back to git), or copy the store from another host');
  } catch (error) {
    return problem('warn', 'evidence store', 'check failed: ' + detail(error), 'arch/jitk/tools/.work/bin/evidence verify');
  }
}

async function main(): Promise<void> {
  const started = Date.now();
  const one = async (item: Promise<Item>): Promise<Item[]> => [await item];
  const tasks: Promise<Item[]>[] = [rust(), cache(), one(docker()), mac ? one(devVm()) : one(Promise.resolve(localKvm()))];
  const local = [...basics(), ...native(), evidenceStore()];
  const items: Item[] = [];
  for (const item of local) {
    items.push(item);
  }
  for (const group of await Promise.all(tasks)) {
    for (const item of group) {
      items.push(item);
    }
  }
  console.log('jitk doctor: ' + hostPlatform() + ', cache ' + cacheRoot());
  for (const item of items) {
    console.log(item.level.padEnd(4) + '  ' + item.name + ': ' + item.detail + (item.fix ? '; fix: ' + item.fix : ''));
  }
  const failed = items.filter(item => item.level === 'FAIL').length;
  const warned = items.filter(item => item.level === 'warn').length;
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log('jitk doctor: ' + (failed ? String(failed) + ' hard requirement(s) missing' : 'hard requirements present') + ', ' + String(warned) + ' warning(s) (' + seconds + ' s)');
  process.exitCode = failed ? 1 : 0;
}

main().catch((error: unknown) => {
  console.error('jitk doctor: ' + detail(error));
  process.exitCode = 1;
});
