// Runs the executor's Linux shard check on the kvm-dev VM: ships this tree's
// sources (no evidence directories, nothing over 1 MiB) and runs
// ipc/shard-host.sh there, which takes Node, the shard binary and the
// prepared snapshots from the remote jitk cache (`make deps`, `make -C shard
// snapshot`). JITK_SSH_TARGET=test-linux runs `make test-linux` (the parity
// corpus, executor/parity/README.md) instead and copies its report back to
// .work/parity/linux-arm64.json. Settings: JITK_NESTED_SSH (the ssh.sh wrapper),
// JITK_SHARD_REMOTE_ROOT (scratch root, relative to the remote home unless
// absolute; default jitk-ssh), JITK_SHARD_BENCH=1, JITK_SHARD_OUTPUT.
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { capture, check, dump, environment, output, run, sha } from '../lib.ts';
const executor = resolve(import.meta.dirname, '..');
const root = resolve(executor, '../../..');
const common = output(['git', '-C', root, 'rev-parse', '--path-format=absolute', '--git-common-dir']).trim();
const ssh = process.env.JITK_NESTED_SSH || join(dirname(common), 'kvm-dev/ssh.sh');
check(existsSync(ssh) && statSync(ssh).isFile(), 'set JITK_NESTED_SSH to the existing kvm-dev ssh.sh wrapper');
const identity = sha(Buffer.from(root)).slice(0, 12);
const remoteRoot = process.env.JITK_SHARD_REMOTE_ROOT || 'jitk-ssh';
check(/^[A-Za-z0-9_./-]+$/.test(remoteRoot) && !remoteRoot.split('/').includes('..'), 'JITK_SHARD_REMOTE_ROOT must be a plain path without ..');
const remote = remoteRoot + '/test-' + identity;
const extensions = new Set(['.rs', '.c', '.h', '.S', '.ld', '.ts', '.mjs', '.js', '.json', '.toml', '.lock', '.sh', '.mk', '.db', '.entitlements', '.sb', '.in', '.patch', '.diff', '.md']);
const named = new Set(['.npmrc', 'Makefile', 'series', 'qjs-ring', '.READY']);
const ignored = new Set(['target', 'node_modules', 'build', 'dist', '.work', '.scriptc', 'results', 'test-results', 'out']);
function sources(directory: string): string[] {
  const paths: string[] = [];
  for (const name of readdirSync(directory).sort()) {
    if (ignored.has(name) || name.startsWith('._')) {
      continue;
    }
    const path = join(directory, name);
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) {
      continue;
    }
    if (stat.isDirectory()) {
      // raw-* evidence directories stay local (vmm/patches/raw-*.diff ships).
      if (name.startsWith('raw')) {
        continue;
      }
      paths.push(...sources(path));
    } else if (stat.isFile() && stat.size <= 1048576 && (extensions.has(extname(path)) || named.has(name))) {
      paths.push(path);
    }
  }
  return paths;
}
const files: string[] = [join(root, 'arch/jitk/Makefile')];
// abi: the crate the shard and kernel build from; vmm: the libkrun builder (`make deps`).
for (const part of ['tools', 'tslib', 'docs', 'abi', 'kernel', 'vmm', 'shard', 'executor', 'protocol', 'bench/hyperlight', 'mcp']) {
  files.push(...sources(join(root, 'arch/jitk', part)).sort());
}
// The parity corpus imports the benchmark workloads.
files.push(join(root, 'arch/jitk/bench/cases.json'));
const target = process.env.JITK_SSH_TARGET || 'shard';
check(target === 'shard' || target === 'test-linux', 'JITK_SSH_TARGET must be shard or test-linux');
// The hostile peer is cross-compiled locally; remote builds need no zig.
await run(['make', '-C', executor, '.work/bin/fixtures/shard-peer']);
files.push(join(executor, '.work/bin/fixtures/shard-peer'));
const transfer = join(executor, '.work/ipc-transfer');
mkdirSync(transfer, { recursive: true });
const list = join(transfer, 'files');
const archive = join(transfer, 'sources.tar');
writeFileSync(list, files.map(path => relative(root, path)).join('\n') + '\n');
await run(['tar', '-cf', archive, '--no-recursion', '-C', root, '-T', list], { env: { ...environment(), COPYFILE_DISABLE: '1' } });
function quote(value: string): string {
  return "'" + value.replaceAll("'", "'\\''") + "'";
}
await run([ssh, 'mkdir -p ' + quote(remote) + ' && cd ' + quote(remote) + ' && tar xf -'], { input: readFileSync(archive), timeout: 60 });
const benchmark = process.env.JITK_SHARD_BENCH === '1';
const lockWait = benchmark ? 1800 : 600;
const report = remote + '/arch/jitk/executor/.work/parity/linux-arm64.json';
const commands = target === 'test-linux' ? `set -eu
JITK_BENCH_LOCK=\${JITK_BENCH_LOCK:-/home/dev/bench.lock} JITK_SHARD_LOCK_WAIT=${lockWait} make -C ${quote(remote)}/arch/jitk test-linux
` : `set -eu
JITK_SHARD_BENCH=${benchmark ? '1' : '0'} JITK_SHARD_LOCK_WAIT=${lockWait} sh ${quote(remote)}/arch/jitk/executor/ipc/shard-host.sh
`;
const sourceHashes: Record<string, string> = {};
for (const source of files) {
  sourceHashes[relative(root, source)] = sha(readFileSync(source));
}
const receipt = { backend: 'ssh', remote, source_sha256: sourceHashes, command: commands, started_unix: Date.now() / 1000, benchmark, vm_lifecycle_changes: false };
const destination = process.env.JITK_SHARD_OUTPUT || join(executor, process.env.JITK_RECORD === '1' ? 'raw-r7-ipc' : '.work/ipc-ssh');
mkdirSync(destination, { recursive: true });
dump(join(destination, 'ssh-command.json'), receipt);
console.log(`jitk: shard suite via ${ssh}; scratch=${remote}; lock wait <=${lockWait}s`);
// A cold remote cache builds Node, the shard and both snapshots first.
const result = await capture([ssh, commands], { timeout: lockWait + 3600 });
const log = result.combined.toString();
writeFileSync(join(destination, 'ssh-test.log'), log);
if (benchmark && result.returncode === 0) {
  const measurements: string[] = [];
  for (const line of log.split('\n')) {
    try {
      const value = JSON.parse(line) as { event?: string };
      if (['environment', 'summary', 'sample', 'deadlines'].includes(value.event || '')) {
        measurements.push(line);
      }
    } catch {}
  }
  writeFileSync(join(destination, 'bench-final.jsonl'), measurements.join('\n') + '\n');
}
console.log(log.slice(-8000));
// The parity report exists once the corpus ran, even if a later shard test failed.
if (target === 'test-linux') {
  const fetched = await capture([ssh, 'cat ' + quote(report)], { timeout: 60 });
  if (fetched.returncode === 0) {
    const local = join(executor, '.work/parity/linux-arm64.json');
    mkdirSync(dirname(local), { recursive: true });
    writeFileSync(local, fetched.stdout);
    console.log('jitk: parity report ' + local);
  }
}
process.exitCode = result.returncode;
