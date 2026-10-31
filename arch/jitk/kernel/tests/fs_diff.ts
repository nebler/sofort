import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { ROOT, VM, HOST, uptime } from './measure.ts';
import { capture, check, dump, environment, files, run, sha, workspace, writable, same } from '../lib.ts';
const kernel = resolve(import.meta.dirname, '..');
const fixtures = join(kernel, 'tests/fixtures/fs');
const work = workspace('JITK_FS_WORK', 'fs');
const samples = Number(process.env.JITK_FS_SAMPLES || '30');
const names = new Map<number, string>([[25, 'fcntl'], [56, 'openat'], [57, 'close'], [61, 'getdents64'], [62, 'lseek'], [63, 'read'], [65, 'readv'], [78, 'readlinkat'], [79, 'newfstatat']]);
const tree = join(work, 'tree');
if (existsSync(tree)) {
  writable(tree);
  rmSync(tree, { recursive: true });
}
const contents: Record<string, Buffer> = {
  'skills/readme.md': Buffer.from('# Readme\nhello skills\n\tTab\n'),
  'skills/empty.txt': Buffer.alloc(0),
  'skills/sub/deep.txt': Buffer.from('deep\n'),
  'scripts/x.lua': Buffer.from('return 40+2\n'),
  'modules/mymod.lua': Buffer.from('local M={}\nfunction M.f() return "mod-ok" end\nreturn M\n'),
  'modules/pkg/init.lua': Buffer.from('return {name="pkg-init"}\n'),
  'data/big.bin': Buffer.from(Array.from({ length: 70000 }, (_, i) => (i * 7 + Math.floor(i / 251)) & 255))
};
for (const name of Object.keys(contents)) {
  const path = join(tree, name);
  mkdirSync(resolve(path, '..'), { recursive: true });
  writeFileSync(path, contents[name]);
}
function allPaths(root: string): string[] {
  const paths: string[] = [];
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    paths.push(path);
    if (lstatSync(path).isDirectory()) {
      paths.push(...allPaths(path));
    }
  }
  return paths.sort();
}
for (const path of allPaths(tree).reverse()) {
  chmodSync(path, lstatSync(path).isDirectory() ? 0o555 : 0o444);
}
chmodSync(tree, 0o555);
// The probe ELF is committed (fixtures/fs/probe.elf, with the sha256 of the
// probe.c it was built from), so Linux in CI and the guest here run the same
// bytes. JITK_FS_REBUILD_PROBE=1 rebuilds it from probe.c (Mac toolchain).
const elf = join(fixtures, 'probe.elf');
const probeSource = sha(readFileSync(join(fixtures, 'probe.c')));
if (process.env.JITK_FS_REBUILD_PROBE === '1') {
  await run(['clang', '--target=aarch64-none-elf', '-ffreestanding', '-nostdlib', '-fno-builtin', '-fno-stack-protector', '-O1', '-c', join(fixtures, 'probe.c'), '-o', join(work, 'probe.o')]);
  await run(['/opt/homebrew/bin/ld.lld', '-T', resolve(kernel, '../grow/probe.ld'), join(work, 'probe.o'), '-o', elf]);
  writeFileSync(elf + '.source-sha256', probeSource + '\n');
}
check(existsSync(elf) && readFileSync(elf + '.source-sha256', 'utf8').trim() === probeSource, 'fixtures/fs/probe.elf is missing or not built from the current probe.c; rerun with JITK_FS_REBUILD_PROBE=1');
// Linux's output for each case, recorded (tests/fixtures/fs/linux/<case>.json)
// so the gate runs where Linux must not. JITK_ORACLE (as grow/oracle-store.ts):
// live (default) runs Docker; replay reads the recording; record writes it;
// verify runs Docker and fails unless it matches. A recording counts only for
// the same payload bytes, argv and tree.
const recordings = join(fixtures, 'linux');
const mode = process.env.JITK_ORACLE ?? 'live';
check(['live', 'replay', 'record', 'verify'].includes(mode), 'JITK_ORACLE is live, replay, record or verify');
interface Recording { payload_sha256: string; argv: string[]; tree_sha256: string; stdout_hex: string; provenance: string }
function recorded(name: string, payload: string, argv: string[], tree: string): Buffer | null {
  const path = join(recordings, name + '.json');
  if (!existsSync(path)) return null;
  const r = JSON.parse(readFileSync(path, 'utf8')) as Recording;
  if (r.payload_sha256 !== sha(readFileSync(payload)) || JSON.stringify(r.argv) !== JSON.stringify(argv) || r.tree_sha256 !== tree) return null;
  return Buffer.from(r.stdout_hex, 'hex');
}
function record(name: string, payload: string, argv: string[], tree: string, stdout: Buffer, provenance: string): void {
  mkdirSync(recordings, { recursive: true });
  const r: Recording = { payload_sha256: sha(readFileSync(payload)), argv, tree_sha256: tree, stdout_hex: stdout.toString('hex'), provenance };
  writeFileSync(join(recordings, name + '.json'), JSON.stringify(r, null, 2) + '\n');
}
// Seeding without Linux: JITK_FS_SEED is an earlier fs-diff.json receipt from a
// live run. The guest's stdout is taken as Linux's only if its sha256 equals the
// receipt's linux_stdout_sha256 for that case, on the same tree.
function seeded(name: string, tree: string, guest: Buffer): boolean {
  const path = process.env.JITK_FS_SEED;
  if (!path) return false;
  const receipt = JSON.parse(readFileSync(path, 'utf8')) as { tree_sha256: string; probe: { linux_stdout_sha256: string }; lua: { linux_stdout_sha256: string }; qjs: { linux_stdout_sha256: string } };
  const row = name === 'probe' ? receipt.probe : name === 'lua' ? receipt.lua : receipt.qjs;
  return receipt.tree_sha256 === tree && row.linux_stdout_sha256 === sha(guest);
}
async function linux(payload: string, argv: string[]): Promise<Buffer> {
  const mounts: string[] = [];
  for (const name of readdirSync(tree).sort()) {
    mounts.push('-v', join(tree, name) + ':/' + name + ':ro');
  }
  // The guest process is unprivileged, like grow's oracle payload (uid 65534):
  // as root, Linux would ignore the archive's 0444 permission bits.
  const result = await capture(['docker', 'run', '--rm', '--platform', 'linux/arm64', '--network', 'none', '--user', '65534:65534', '-w', '/', '--entrypoint', 'sh', ...mounts, '-v', payload + ':/payload:ro', 'jitk-oracle:08', '-c', 'set -o pipefail; ulimit -n 64; "$@" | cat', 'sh', '/payload', ...argv.slice(1)], { timeout: 120 });
  check(result.returncode === 0 && result.stderr.length === 0, result.stderr.toString());
  return result.stdout;
}
async function image(name: string, payload: string | null, argv: string[] | null, trace = false): Promise<string> {
  const env = environment();
  for (const key of ['JITK_ELF', 'JITK_ARGV_JSON', 'JITK_SCRIPT']) {
    delete env[key];
  }
  if (payload && argv) {
    env.JITK_ELF = payload;
    env.JITK_ARGV_JSON = JSON.stringify(argv);
  }
  env.CARGO_TARGET_DIR = join(work, 'target');
  env.JITK_OUT_DIR = join(work, name);
  env.JITK_TOOLS_DIR = join(kernel, '.work/bin');
  await run(['sh', join(kernel, 'build.sh'), '--resources', tree, ...(trace ? ['--features', 'grow-trace'] : [])], { env });
  return join(work, name, 'kernel.bin');
}
interface Event { kind: string; code?: number; nr?: number }
async function jitk(img: string): Promise<{ app: Buffer; used: number[] }> {
  const result = await capture([HOST, img], { timeout: 20 });
  check(result.returncode === 0, result.stderr.toString());
  const records: Event[] = [];
  const app: Buffer[] = [];
  for (const line of result.stdout.toString().split('\n')) {
    if (line.startsWith('\x1e')) {
      records.push(JSON.parse(line.slice(1)) as Event);
    } else if (line) {
      app.push(Buffer.from(line + '\n'));
    }
  }
  check(!records.some(record => record.kind === 'missing'));
  check(records[records.length - 1].kind === 'done' && records[records.length - 1].code === 0);
  return { app: Buffer.concat(app), used: records.filter(record => record.kind === 'sys.enter').map(record => Number(record.nr)) };
}
const treeBytes = allPaths(tree).map(path => Buffer.concat([Buffer.from(relative(tree, path) + '\0'), lstatSync(path).isFile() ? readFileSync(path) : Buffer.alloc(0)]));
const result: Record<string, unknown> = { load: uptime(), samples, tree_sha256: sha(Buffer.concat(treeBytes)) };
const cases: [string, string, string[]][] = [
  ['probe', elf, ['probe']],
  ['lua', resolve(kernel, '../grow/payload/lua-static'), ['lua', '-e', readFileSync(join(fixtures, 'workload.lua'), 'utf8')]],
  ['qjs', join(kernel, 'payload/qjs'), ['qjs', '--std', '--memory-limit', '16777216', '-e', readFileSync(join(fixtures, 'workload.js'), 'utf8')]]
];
const treeSha = result.tree_sha256 as string;
// record/verify run where only Linux runs (CI): no guest side.
if (mode === 'record' || mode === 'verify') {
  for (const [name, payload, argv] of cases) {
    const expected = await linux(payload, argv);
    if (mode === 'record') record(name, payload, argv, treeSha, expected, 'recorded from Linux (jitk-oracle) ' + (process.env.GITHUB_RUN_ID ? 'in GitHub run ' + process.env.GITHUB_RUN_ID : 'live') + ' on ' + new Date().toISOString());
    else check(recorded(name, payload, argv, treeSha)?.equals(expected) === true, name + ': Linux output differs from tests/fixtures/fs/linux/' + name + '.json');
    console.log(name, mode, 'linux_stdout_sha256', sha(expected));
  }
  process.exit(0);
}
for (const [name, payload, argv] of cases) {
  let expected: Buffer;
  const img = await image('img-' + name, payload, argv, true);
  if (mode === 'replay') {
    const r = recorded(name, payload, argv, treeSha);
    if (r) expected = r;
    else {
      const guest = (await jitk(img)).app;
      check(seeded(name, treeSha, guest), name + ': no Linux recording for this payload/argv/tree (tests/fixtures/fs/linux/' + name + '.json); record it in CI with JITK_ORACLE=record');
      record(name, payload, argv, treeSha, guest, 'seeded: guest stdout sha256 equals linux_stdout_sha256 in ' + process.env.JITK_FS_SEED);
      expected = guest;
    }
  } else expected = await linux(payload, argv);
  const used = new Set<number>();
  for (let i = 0; i < samples; i += 1) {
    const got = await jitk(img);
    check(got.app.equals(expected), name + ' stdout mismatch');
    for (const nr of got.used) {
      used.add(nr);
    }
  }
  const row = { status: 'PASS', identical: samples + '/' + samples, linux_stdout_sha256: sha(expected), lines: expected.toString().split('\n').length - 1, fs_syscalls: [...used].filter(nr => names.has(nr)).map(nr => names.get(nr)!).sort(), all_syscalls: [...used].sort((a, b) => a - b) };
  result[name] = row;
  console.log(name, JSON.stringify(row));
}
const bootstrap = await image('bootstrap', null, null);
const checks: [string, unknown][] = [
  ['return std.loadFile("/skills/readme.md");', '# Readme\nhello skills\n\tTab\n'],
  ['return os.readdir("/modules")[0].sort();', ['.', '..', 'mymod.lua', 'pkg']],
  ['const e={}; return [std.open("/skills/readme.md","w",e), e.errno];', [null, 30]]
];
for (const [code, want] of checks) {
  const vm = new VM(0, bootstrap);
  try {
    await vm.ready();
    vm.run(code);
    check(same(await vm.recv(), { t: 'done', ok: want }), code);
  } finally {
    await vm.close();
  }
}
result.bootstrap = { status: 'PASS', checks: checks.length };
result.status = 'PASS';
dump(join(ROOT, 'fs-diff.json'), result);
console.log(JSON.stringify(result, null, 2));
