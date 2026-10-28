// Runs the executor's Linux shard check on the kvm-dev VM: ships this tree's
// sources (no evidence directories, nothing over 1 MiB) and runs
// ipc/shard-host.sh there, which takes Node, the shard binary and the
// prepared snapshots from the remote jitk cache (`make deps`, `make -C shard
// snapshot`). Settings: JITK_NESTED_SSH (the ssh.sh wrapper),
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
const extensions = new Set(['.rs', '.c', '.h', '.S', '.ld', '.ts', '.mjs', '.js', '.json', '.toml', '.lock', '.sh', '.mk', '.db', '.entitlements', '.sb']);
const named = new Set(['.npmrc', 'Makefile', 'series', 'qjs-ring']);
const ignored = new Set(['target', 'node_modules', 'build', 'dist', '.work', '.scriptc', 'results', 'test-results', 'out']);
function sources(directory: string): string[] {
  const paths: string[] = [];
  for (const name of readdirSync(directory).sort()) {
    if (ignored.has(name) || name.startsWith('raw') || name.startsWith('._')) {
      continue;
    }
    const path = join(directory, name);
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) {
      continue;
    }
    if (stat.isDirectory()) {
      paths.push(...sources(path));
    } else if (stat.isFile() && stat.size <= 1048576 && (extensions.has(extname(path)) || named.has(name))) {
      paths.push(path);
    }
  }
  return paths;
}
const files: string[] = [join(root, 'arch/jitk/Makefile')];
for (const part of ['tools', 'tslib', 'docs', 'kernel', 'shard', 'executor', 'protocol', 'bench/hyperlight', 'mcp']) {
  files.push(...sources(join(root, 'arch/jitk', part)).sort());
}
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
const commands = `set -eu
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
process.exitCode = result.returncode;
