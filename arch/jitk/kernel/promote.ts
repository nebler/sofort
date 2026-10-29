// Promotes a built default image to kernel/.READY. It rebuilds the image from
// these sources (byte identity), runs every readiness gate against it, and only
// if all pass writes dist/kernel-<sha>.{bin,json}, dist/manifest.json and .READY.
// promote [IMAGE [MANIFEST]]; defaults dist/kernel.bin and .work/dist/kernel-<sha>.json.
// JITK_VMM_BINARY (or the deps cache) is the test host; JITK_SQLITE_ELF overrides
// the census sqlite3-static (grow checks its pinned hash).
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { capture, check, dump, environment, files, readJSON, sha, writable } from './lib.ts';
import { cacheRoot, requireArtifact } from '../tslib/deps.ts';

interface Manifest { sha256: string; bytes: number; ram_mib: number; verification_sha256: string }
interface Quant { n: number; p50: number }
interface Status { status: string }
const root = import.meta.dirname;
const tests = join(root, '.work/bin/tests');
const grow = resolve(root, '../grow');
const image = resolve(process.argv[2] || join(root, 'dist/kernel.bin'));
const bytes = readFileSync(image);
const hash = sha(bytes);
const short = hash.slice(0, 8);
const manifestPath = resolve(process.argv[3] || join(root, '.work/dist/kernel-' + hash + '.json'));
const manifest = readJSON<Manifest>(manifestPath);
check(manifest.sha256 === hash && manifest.bytes === bytes.length, 'refusing: image ' + image + ' is ' + hash + ' (' + bytes.length + ' B) but ' + manifestPath + ' names ' + manifest.sha256 + ' (' + manifest.bytes + ' B)');
check(manifest.verification_sha256 === sha(readFileSync(join(root, 'syscalls.manifest.json'))), 'refusing: manifest verification_sha256 is not the current syscalls.manifest.json');
const vmm = requireArtifact('JITK_VMM_BINARY');
const sqlite = process.env.JITK_SQLITE_ELF || join(cacheRoot(), 'native-census/005073a6c1c0e71c22ad8b752f1ffb6c35c8d913fe91f5795038c7d52cf639ff');
const database = resolve(root, '../shard/harness/census-demo.db');
check(existsSync(sqlite), 'refusing: no sqlite3-static at ' + sqlite + ' (set JITK_SQLITE_ELF)');
const out = join(root, '.work/promote', hash);
writable(out);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// The source-built gates (isolation, grow_contract, fs_differential, grow_r7)
// test these sources: the rebuild and the unchanged inventory tie them to the image.
const ignored = new Set(['.work', '.scriptc', 'node_modules', 'dist', 'target', 'target-ring', 'test-work', 'test-results', '__pycache__', '.READY', '.R4']);
function inventory(): string {
  const rows = files(root).map(path => relative(root, path)).filter(rel => !rel.split('/').some(part => ignored.has(part))).sort();
  return sha(Buffer.from(rows.map(rel => rel + ' ' + sha(readFileSync(join(root, rel)))).join('\n')));
}
const sources = inventory();
const env = environment();
for (const key of ['JITK_ELF', 'JITK_ARGV_JSON', 'JITK_SCRIPT', 'JITK_RESOURCES', 'JITK_OUT_DIR', 'CARGO_TARGET_DIR', 'JITK_FS_WORK', 'JITK_GROW_CONTRACT_WORK', 'JITK_PROBE_WORK', 'JITK_TOOLS_DIR', 'JITK_RECORD', 'JITK_TEST_HOST', 'JITK_FS_SAMPLES']) {
  delete env[key];
}
env.JITK_VMM_BINARY = vmm;
env.JITK_TEST_KERNEL = image;
env.JITK_KERNEL_IMAGE = image;
env.JITK_TEST_OUTPUT = out;

// Runs one command (timing-sensitive ones under the Mac bench lock), logs it, returns stdout.
async function step(name: string, command: string[], timed = false, timeout = 3600, extra: Record<string, string> = {}): Promise<string> {
  const argv = timed ? ['lockf', '-k', '/tmp/sofort-bench.lock', ...command] : command;
  console.log('[' + new Date().toISOString() + '] ' + name + ': ' + argv.join(' '));
  const result = await capture(argv, { env: { ...env, ...extra }, timeout });
  writeFileSync(join(out, name + '.log'), result.combined);
  check(!result.timeout && result.returncode === 0, name + ' exited ' + result.returncode + (result.timeout ? ' (timeout)' : '') + '; log ' + join(out, name + '.log') + '\n' + result.combined.toString().slice(-1500));
  return result.stdout.toString();
}
const gates: Record<string, string> = {};
const failures: string[] = [];
async function gate(name: string, body: () => Promise<string>): Promise<void> {
  try {
    gates[name] = await body();
    console.log('  ' + name + ' PASS: ' + gates[name]);
  } catch (error: unknown) {
    failures.push(name + ': ' + (error instanceof Error ? error.message : String(error)));
    console.log('  ' + name + ' FAIL: ' + failures[failures.length - 1]);
  }
}
function receipt<T>(name: string): T {
  return readJSON<T>(join(out, name));
}
// grow writes its receipts (some 0555/0444) under the tracked grow/results;
// move them here, pass or fail, minus the built kernel images.
function adopt(id: string, name: string): void {
  const source = join(grow, 'results', id);
  if (!existsSync(source)) {
    return;
  }
  writable(source);
  renameSync(source, join(out, name));
  const prune = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        prune(path);
      } else if (entry === 'kernel.bin') {
        rmSync(path);
      }
    }
  };
  prune(join(out, name));
}

await gate('rebuild', async () => {
  await step('rebuild', ['sh', join(root, 'build.sh')], false, 3600, { JITK_OUT_DIR: join(out, 'rebuild') });
  const rebuilt = sha(readFileSync(join(out, 'rebuild/kernel.bin')));
  check(rebuilt === hash, 'sources build ' + rebuilt + ', not ' + hash);
  rmSync(join(out, 'rebuild'), { recursive: true });
  return 'sources rebuild ' + short;
});
await gate('packer', async () => {
  const n = /^(\d+) packer\/archive tests passed$/m.exec(await step('packer', [join(tests, 'test_packer')]));
  check(n, 'no pass line');
  return n[1] + '/' + n[1];
});
await gate('clocks', async () => {
  await step('clocks', [join(tests, 'clock-check')], true);
  const r = receipt<{ status: string; n: number; worst_abs_error_bound_ms: number }>('clock-check.json');
  check(r.status === 'PASS' && r.n === 30 && r.worst_abs_error_bound_ms < 1, JSON.stringify(r));
  return '30/30; origin error <1ms (worst bound ' + r.worst_abs_error_bound_ms.toFixed(3) + ' ms)';
});
await gate('G1', async () => {
  await step('G1', [join(tests, 'measure'), 'park', '0'], true);
  const r = receipt<{ status: string; exchanges: number; idle_core_percent: number; error?: string }>('parking-0.json');
  check(r.status === 'PASS' && r.exchanges === 1000 && r.idle_core_percent < 2, JSON.stringify({ status: r.status, exchanges: r.exchanges, idle: r.idle_core_percent, error: r.error }));
  return r.idle_core_percent.toFixed(6) + '% idle core; ' + r.exchanges + '/1000 exchanges on ' + short + ' image';
});
await gate('G2', async () => {
  await step('G2', [join(tests, 'measure'), 'integration'], true);
  const r = receipt<{ status: string; promise64_us: Quant }>('integration.json');
  check(r.status === 'PASS' && r.promise64_us.n === 30, JSON.stringify(r.promise64_us));
  return '30 x 64 reversed replies; ' + short + ' image';
});
await gate('isolation', async () => {
  await step('isolation', [join(tests, 'run-probes')]);
  const r = receipt<Record<string, unknown>>('probe-results.json');
  const rows = Object.keys(r).filter(key => key !== 'load');
  const passed = rows.filter(key => (r[key] as Status).status === 'PASS');
  check(rows.length >= 11 && passed.length === rows.length, JSON.stringify(rows.filter(key => !passed.includes(key))));
  return passed.length + '/' + rows.length + ' (incl. fs-alias-write, fs-user-read)';
});
await gate('grow_contract', async () => {
  await step('grow_contract', [join(tests, 'grow_contract')]);
  const r = receipt<{ status: string; ioctl: Status & { exit_slot: number }; ppoll: Status & { exit_slot: number }; registered_enosys: Status; deleted_ioctl: Status }>('grow-contract.json');
  const cases = [r.ioctl, r.ppoll, r.registered_enosys, r.deleted_ioctl];
  check(r.status === 'PASS' && cases.every(row => row.status === 'PASS') && r.ioctl.exit_slot === 93 && r.ppoll.exit_slot === 94, JSON.stringify(r));
  return cases.length + '/' + cases.length + '; both exit slots exercised';
});
await gate('fs_differential', async () => {
  await step('fs_diff', [join(tests, 'fs_diff')]);
  type Row = Status & { identical: string };
  const r = receipt<{ status: string; probe: Row; lua: Row; qjs: Row; bootstrap: Status & { checks: number } }>('fs-diff.json');
  check(r.status === 'PASS' && [r.probe, r.lua, r.qjs].every(row => row.status === 'PASS' && row.identical === '30/30') && r.bootstrap.status === 'PASS' && r.bootstrap.checks === 3, JSON.stringify(r));
  const fs = await step('test_fs', [join(tests, 'test_fs')]);
  check(/test walk_and_corrupt \.\.\. ok/.test(fs) && /test result: ok\./.test(fs), 'no corruption pass line');
  return 'probe/Lua/QuickJS 30/30 byte-identical vs Linux ro bind mount; bootstrap 3/3; test_fs corruption PASS';
});
await gate('grow_r7', async () => {
  const id = 'promote-' + hash.slice(0, 12);
  for (const run of [id, id + '-sqlite']) {
    writable(join(grow, 'results', run));
    rmSync(join(grow, 'results', run), { recursive: true, force: true });
  }
  const inputs = ['--sqlite-elf', sqlite, '--database', database];
  try {
    await step('grow_r7', [join(grow, 'build/grow'), '--run-id', id, '--validate-only', '--target', 'fstat', '--target', 'pread64', '--samples', '30', ...inputs], false, 14400);
    await step('sqlite_checks', [join(grow, 'build/sqlite-checks'), '--run-id', id + '-sqlite', '--validate-only', ...inputs]);
  } finally {
    adopt(id, 'grow-r7');
    adopt(id + '-sqlite', 'grow-sqlite-checks');
  }
  check(receipt<Status>('grow-sqlite-checks/report.json').status === 'PASS', 'sqlite-checks status');
  const report = receipt<{ gate: string; transactions: { name: string; gate: string; attempts: unknown[]; acceptance: { n: number; pass: number; mutations: { rejected: boolean }[] } }[] }>('grow-r7/report.json');
  check(report.gate === 'PASS' && report.transactions.map(tx => tx.name).join() === 'fstat,pread64', JSON.stringify(report.transactions.map(tx => [tx.name, tx.gate])));
  let mutants = 0;
  let corpus = 0;
  const parts: string[] = [];
  for (const tx of report.transactions) {
    check(tx.gate === 'PASS' && tx.acceptance.n === 30 && tx.acceptance.pass === 30 && tx.acceptance.mutations.every(m => m.rejected), tx.name + ' ' + JSON.stringify(tx.acceptance));
    mutants += tx.acceptance.mutations.length;
    const app = receipt<{ status: string; cases: Status[] }>('grow-r7/tx-' + tx.name + '/attempt-' + tx.attempts.length + '/integration/report.json');
    check(app.status === 'PASS' && app.cases.length > 0 && app.cases.every(c => c.status === 'PASS'), tx.name + ' SQLite corpus');
    corpus += app.cases.length;
    parts.push(tx.name + ' ' + tx.acceptance.pass + '/' + tx.acceptance.n);
  }
  return parts.join(' + ') + ' fresh VMs; mutants ' + mutants + '/' + mutants + ' rejected; SQLite corpus ' + corpus + '/' + corpus + ' exact; sqlite-checks PASS';
});
if (inventory() !== sources) {
  failures.push('sources: kernel sources changed while the gates ran');
}
if (sha(readFileSync(image)) !== hash) {
  failures.push('image: ' + image + ' changed while the gates ran');
}
if (failures.length) {
  console.error('REFUSED: .READY not written; failing gates:\n' + failures.map(line => '  ' + line).join('\n'));
  process.exit(1);
}

// guest_loc/build_rs_loc as in every earlier .READY: physical lines (wc -l) of
// src/**/*.rs and of build.rs.
const lines = (path: string): number => (readFileSync(path, 'utf8').match(/\n/g) || []).length;
const guestLoc = files(join(root, 'src')).filter(path => path.endsWith('.rs')).reduce((sum, path) => sum + lines(path), 0);
const dist = join(root, 'dist');
const previous = readJSON<{ image: string; sha256: string; previous_image?: string }>(join(root, '.READY'));
mkdirSync(dist, { recursive: true });
copyFileSync(image, join(dist, 'kernel-' + hash + '.bin'));
copyFileSync(manifestPath, join(dist, 'kernel-' + hash + '.json'));
copyFileSync(manifestPath, join(dist, 'manifest.json'));
const ready: Record<string, string> = {};
for (const name of ['G1', 'G2', 'isolation', 'packer', 'grow_contract', 'clocks', 'fs_differential', 'grow_r7']) {
  ready[name] = gates[name];
}
const marker = {
  image: 'dist/kernel-' + hash + '.bin',
  manifest: 'dist/kernel-' + hash + '.json',
  sha256: hash,
  bytes: bytes.length,
  ram_mib: manifest.ram_mib,
  created_utc: statSync(image).mtime.toISOString(),
  guest_loc: guestLoc,
  build_rs_loc: lines(join(root, 'build.rs')),
  gates: ready,
  test_host: 'integrated VMM v2 (JITK_VMM_BINARY)',
  test_host_sha256: sha(readFileSync(vmm)),
  note: 'Promoted by kernel/promote.ts: every gate run on this image (timing gates under the Mac bench lock); ' + gates.rebuild + ' byte-identically and the source-built gates (isolation, grow_contract, fs_differential, grow_r7) used that unchanged source tree (inventory ' + sources.slice(0, 16) + '). guest_loc/build_rs_loc are physical lines (wc -l) of src/**/*.rs and build.rs. Receipts: kernel/.work/promote/' + hash + '/.',
  // Re-promoting the same image keeps the image it replaced.
  previous_image: previous.sha256 === hash && previous.previous_image ? previous.previous_image : previous.image,
  verification_manifest: 'syscalls.manifest.json',
  verification_sha256: manifest.verification_sha256
};
const pending = join(root, '.READY.tmp');
dump(pending, marker);
renameSync(pending, join(root, '.READY'));
console.log(JSON.stringify(marker, null, 2));
