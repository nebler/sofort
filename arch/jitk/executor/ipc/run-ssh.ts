import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { capture, check, dump, environment, output, run, sha } from '../lib.ts';
const executor = resolve(import.meta.dirname, '..');
const root = resolve(executor, '../../..');
const common = output(['git', '-C', root, 'rev-parse', '--path-format=absolute', '--git-common-dir']).trim();
const ssh = process.env.JITK_NESTED_SSH || join(dirname(common), 'kvm-dev/ssh.sh');
check(existsSync(ssh) && statSync(ssh).isFile(), 'set JITK_NESTED_SSH to the existing kvm-dev ssh.sh wrapper');
const identity = sha(Buffer.from(root)).slice(0, 12);
const remoteRoot = process.env.JITK_SHARD_REMOTE_ROOT || '/home/dev/r7-ipc';
check(/^\/home\/dev\/r[0-9]+-[A-Za-z0-9_-]+$/.test(remoteRoot), 'remote scratch root must be /home/dev/r<round>-<agent>');
const remote = remoteRoot + '/test-' + identity;
const node = process.env.JITK_SHARD_REMOTE_NODE || '/home/dev/r7-ipc/node/node-v24.13.0-linux-arm64/bin/node';
const snapshot = process.env.JITK_SHARD_REMOTE_SNAPSHOT || '/home/dev/r7-ipc/prepared';
check(node.startsWith('/home/dev/r7-ipc/') && snapshot.startsWith(remoteRoot + '/'), 'remote Node must be inside /home/dev/r7-ipc/ and snapshot inside remote scratch root');
const extensions = new Set(['.rs', '.c', '.h', '.S', '.ts', '.mjs', '.js', '.json', '.toml', '.lock', '.sh', '.py']);
const ignored = new Set(['target', 'node_modules', 'build', 'dist', '__pycache__', '.work', '.scriptc']);
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
    } else if (stat.isFile() && stat.size <= 1048576 && (extensions.has(extname(path)) || name === '.npmrc')) {
      paths.push(path);
    }
  }
  return paths;
}
const files: string[] = [];
for (const part of ['arch/jitk/shard', 'arch/jitk/executor', 'arch/jitk/protocol', 'arch/jitk/bench/hyperlight', 'arch/jitk/mcp']) {
  files.push(...sources(join(root, part)).sort());
}
files.push(join(root, 'arch/jitk/kernel/ring-bootstrap.js'));
// The hostile peer is cross-compiled locally; remote builds need no Python or compiler.
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
await run([ssh, 'mkdir -p ' + quote(remote) + ' && cd ' + quote(remote) + ' && tar xf -'], { input: readFileSync(archive), timeout: 30 });
const nodeRoot = dirname(dirname(node));
const benchmark = process.env.JITK_SHARD_BENCH === '1';
const lockWait = benchmark ? 1800 : 600;
let suite = '"$JITK_NODE" build/shard-check.js';
if (benchmark) {
  suite += ' && "$JITK_NODE" build/shard-bench.js';
}
const commands = `set -eu
cd ${quote(remote)}/arch/jitk/shard
PATH=/home/dev/.cargo/bin:$PATH cargo +stable test --offline --bin real
PATH=/home/dev/.cargo/bin:$PATH cargo +stable build --release --offline --bin real
cd ../executor
${quote(node)} ${quote(nodeRoot)}/lib/node_modules/npm/bin/npm-cli.js ci --ignore-scripts --no-audit --no-fund --cache ${quote(remote)}/npm-cache
export JITK_NODE=${quote(node)}
export JITK_SHARD_BINARY=${quote(remote)}/arch/jitk/shard/target/release/real
export JITK_SHARD_SNAPSHOT=${quote(snapshot)}
sh run.sh build
flock -w ${lockWait} /home/dev/bench.lock sh -c ${quote(suite)}
`;
const sourceHashes: Record<string, string> = {};
for (const source of files) {
  sourceHashes[relative(root, source)] = sha(readFileSync(source));
}
const receipt = { backend: 'ssh', remote, node, snapshot, source_sha256: sourceHashes, command: commands, started_unix: Date.now() / 1000, benchmark, vm_lifecycle_changes: false };
const destination = process.env.JITK_SHARD_OUTPUT || join(executor, process.env.JITK_RECORD === '1' ? 'raw-r7-ipc' : '.work/ipc-ssh');
mkdirSync(destination, { recursive: true });
dump(join(destination, 'ssh-command.json'), receipt);
console.log(`jitk: shard suite via ${ssh}; scratch=${remote}; lock wait <=${lockWait}s`);
const result = await capture([ssh, commands], { timeout: lockWait + 300 });
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
