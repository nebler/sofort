import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, lstatSync, rmSync, symlinkSync, appendFileSync, chmodSync, realpathSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { capture, run, dump, readJSON, check, environment, copyTree, files, sha, type Result } from './lib.ts';
import { pack } from '../kernel/packer.ts';
import { observe } from '../grow/observations.ts';

const ROOT = resolve(import.meta.dirname);
const WORK = join(ROOT, '.work');
const SOURCE = join(WORK, 'source');
const CORPUS = join(SOURCE, 'tests/corpus');
const REV = '4ee477d11eb9a71f0a018e5f5bed171a954fc2f7';
const IMAGE = 'sha256:88f8f82bb1850e61c04fd9e47813cd054f5e18eaf6143c4cebeb3d3667818d0a';
const NODE_IMAGE = 'sha256:14078204b6bb268c107ceff6d3c43f45a888105e5c2b18b14c32b3409d93a1b0';
const ORACLE_CONTAINER = 'jitk-corpus-linux-' + process.pid;
const NODE_CONTAINER = 'jitk-corpus-node-' + process.pid;
interface Status { exit: number | null; timeout?: boolean; error?: string | null }
interface Stream { stdout: string; stderr: string; exit: number | null; timeout: boolean }
interface Row {
  name: string; held: boolean; source: string; build: string; diagnostic: string;
  elf?: string; tier: string; node?: string; linux?: Stream; syscalls: string[];
  absent: string[]; blockers: string[]; tolerated: string[]; limitations: string[]; jitk: string; loader?: string;
  trace?: string; injection?: string; injectionTrace?: string; guest?: Stream;
  stable?: boolean;
}
const env = environment();
const compiler = join(ROOT, 'node_modules/.bin/scriptc');
let index = 0;
let limit = Infinity;
let filter = '';
let selection = 'all';
let workers = 2;
let seed = '';
let heldPercent = 20;
let mode = 'census';
let rows: Row[] = [];
let slots: Record<string, string> = {};
let runId = 'full';
let JOURNAL = '';
let diskBefore = '';
let toolsReady: Promise<void> | undefined;

async function kernelTools(): Promise<void> {
  if (toolsReady) return toolsReady;
  toolsReady = (async () => {
    for (const tool of ['prepare', 'build-args', 'artifact']) {
      await run([compiler, 'build', join(WORK, 'kernel', tool + '.ts'), '-o', join(WORK, 'kernel-tools', tool)], { timeout: 45 });
    }
  })();
  await toolsReady;
}

function hash(text: string): string { return sha(Buffer.from(text)); }
function held(name: string): boolean { return parseInt(hash(seed + '\0' + name).slice(0, 8), 16) % 100 < heldPercent; }
function stream(out: Buffer, err: Buffer, code: number | null, timeout = false): Stream {
  return { stdout: sha(out), stderr: sha(err), exit: code, timeout };
}
function identical(a: Stream, b: Stream): boolean {
  return !a.timeout && !b.timeout && a.stdout === b.stdout && a.stderr === b.stderr && a.exit === b.exit;
}
async function disk(): Promise<string> {
  const value = (await run(['df', '-h', '/System/Volumes/Data'], { timeout: 5 })).stdout.toString().trim();
  const raw = (await run(['df', '-k', '/System/Volumes/Data'], { timeout: 5 })).stdout.toString().trim().split('\n');
  check(Number(raw[raw.length - 1].split(/\s+/)[3]) >= 15 * 1024 * 1024, 'STOP below 15 GiB');
  appendFileSync(join(WORK, 'disk.log'), new Date().toISOString() + '\n' + value + '\n');
  return value;
}
function entries(): string[] {
  const names: string[] = [];
  for (const name of readdirSync(CORPUS).sort()) {
    if (/\.(ts|js|mjs|cjs)$/.test(name) && lstatSync(join(CORPUS, name)).isFile()) names.push(name);
    else if (lstatSync(join(CORPUS, name)).isDirectory()) {
      for (const ext of ['ts', 'js', 'mjs', 'cjs']) if (existsSync(join(CORPUS, name, 'main.' + ext))) names.push(name + '/main.' + ext);
    }
  }
  return names.sort();
}
function inputs(name: string): string {
  const path = join(CORPUS, name);
  return /\/main\./.test(name) ? files(dirname(path)).map(f => readFileSync(f, 'utf8')).join('\n') : readFileSync(path, 'utf8');
}
function tier(text: string, calls: string[]): string {
  if (/node:(net|http|https|http2|tls|dgram)|from\s*["'](net|http|https|tls|dgram)["']|\bfetch\s*\(|WebSocket/.test(text) || calls.some(c => /^(socket|connect|bind|listen|accept|epoll|sendto|recvfrom)/.test(c))) return 'T4';
  if (/worker_threads|@scriptc\/threads|new\s+Worker\b|\brename\s*\(/.test(text) || calls.some(c => /^(execveat|fork|vfork|wait4|waitid)$/.test(c))) return 'T3';
  if (/node:fs|from\s*["']fs["']|setTimeout|setInterval|\bDate\b|performance\./.test(text) || calls.some(c => /^(nanosleep|clock_nanosleep|unlinkat|mkdirat|renameat|inotify)/.test(c))) return 'T2';
  return 'T1';
}
function traceInfo(text: string): { calls: string[]; limits: string[] } {
  const calls = new Set<string>();
  const limits = new Set<string>();
  let initialExec = true;
  for (const line of text.split('\n')) {
    const m = /^\s*(?:\d+\s+)?([a-zA-Z_][a-zA-Z_0-9]*)\(/.exec(line);
    if (!m) continue;
    const call = m[1];
    // strace launches the payload with execve; that syscall belongs to the
    // Linux launcher, not to the ELF being assessed for kernel compatibility.
    if (initialExec && call === 'execve') { initialExec = false; continue; }
    calls.add(call);
    if (call === 'ppoll') {
      if (/fd=(?:[3-9]|\d{2,})\b/.test(line)) limits.add('ppoll:fd>2');
      const n = /\],\s*(\d+),/.exec(line);
      if (n && Number(n[1]) > 16) limits.add('ppoll:nfds>16');
      if (!/, NULL, (?:8|0)\)\s*=/.test(line) && !line.includes('<unfinished ...>')) limits.add('ppoll:sigmask-or-unparsed');
    }
    if (call === 'mmap' && (/MAP_FIXED|MAP_STACK|MAP_NORESERVE|PROT_NONE|PROT_EXEC/.test(line) || !line.includes('MAP_ANONYMOUS'))) limits.add('mmap:flags/protection/address');
    if (call === 'clock_gettime' && !/clock_gettime\(CLOCK_(REALTIME|MONOTONIC),/.test(line)) limits.add('clock_gettime:clockid');
    if (call === 'rt_sigaction' || call === 'rt_sigprocmask' || call === 'mremap') limits.add(call + ':ENOSYS-stub');
  }
  return { calls: Array.from(calls).sort(), limits: Array.from(limits).sort() };
}
async function linux(elf: string, dir: string): Promise<void> {
  mkdirSync(dir, { recursive: true });
  chmodSync(dir, 0o777);
  resetCwd(dirname(dir));
  const parent = dirname(dir);
  const nodeStatus = existsSync(join(parent, 'node.json')) ? readJSON<Status>(join(parent, 'node.json')) : { exit: null, error: 'missing-reference' };
  dump(join(dir, 'config.json'), { elf, cwd: join(parent, 'cwd'), source: SOURCE, supported: [...Object.values(slots), 'exit_group'], timeout: 8,
    expectedExit: nodeStatus.exit, referenceValid: nodeStatus.exit !== null && !nodeStatus.error,
    expectedOut: existsSync(join(parent, 'node.stdout')) ? sha(readFileSync(join(parent, 'node.stdout'))) : '',
    expectedErr: existsSync(join(parent, 'node.stderr')) ? sha(readFileSync(join(parent, 'node.stderr'))) : '' });
    const result = await capture(['docker', 'exec', '-i', ORACLE_CONTAINER, '/driver', dir], { timeout: 300 });
    writeFileSync(join(dir, 'driver.stderr'), result.stderr);
    check(!result.timeout && result.returncode === 0 && existsSync(join(dir, 'status.json')), 'oracle-driver-failure ' + result.stderr.toString());
}
function resetCwd(dir: string): void {
  const cwd = join(dir, 'cwd');
  rmSync(cwd, { recursive: true, force: true });
  mkdirSync(cwd, { recursive: true });
  chmodSync(cwd, 0o777);
  symlinkSync(join(SOURCE, 'tests'), join(cwd, 'tests'));
  symlinkSync(join(SOURCE, 'node_modules'), join(cwd, 'node_modules'));
  writeFileSync(join(cwd, 'package.json'), readFileSync(join(SOURCE, 'package.json')));
}
async function guest(elf: string, dir: string, row: Row): Promise<void> {
  // Invoking the exact canonical packer for EVERY compiled ELF is deliberate:
  // a syscall shortage must never hide a loader/packer gap.
  try { pack(readFileSync(elf)); }
  catch (e) { row.jitk = 'loader-refusal'; row.loader = String(e).replace(/^Error: /, ''); return; }
  await kernelTools();
  const kernel = join(WORK, 'kernel');
  const out = join(dir, 'image');
  const buildEnv = environment();
  buildEnv.JITK_TOOLS_DIR = join(WORK, 'kernel-tools');
  buildEnv.CARGO_TARGET_DIR = join(WORK, 'target');
  buildEnv.JITK_OUT_DIR = out;
  buildEnv.JITK_ELF = elf;
  buildEnv.JITK_ARGV_JSON = JSON.stringify([elf]);
  const result = await capture(['sh', join(kernel, 'build.sh'), '--features', 'qjs,grow-trace'], { env: buildEnv, timeout: 90 });
  writeFileSync(join(dir, 'kernel-build.log'), Buffer.concat([result.stdout, result.stderr]));
  if (result.returncode !== 0 || result.timeout) { row.jitk = 'build-error'; return; }
  const vmm = process.env.JITK_VMM_BINARY || '/tmp/jitk-r8/vmm-mac/jitk-vmm';
  const vm = await capture([vmm, '--image', join(out, 'kernel.bin')], { timeout: 5 });
  writeFileSync(join(dir, 'vm.stdout'), vm.stdout);
  writeFileSync(join(dir, 'vm.stderr'), vm.stderr);
  const observed = observe(vm.stdout);
  row.guest = stream(Buffer.from(observed.stdout_hex, 'hex'), Buffer.from(observed.stderr_hex, 'hex'), observed.exit, vm.timeout);
  const missing = observed.missing.map(v => String(v.nr));
  if (observed.trace_complete && row.linux && identical(row.guest, row.linux)) row.jitk = 'pass';
  else if (missing.length > 0) row.jitk = 'missing-syscall';
  else if (!observed.trace_complete || vm.returncode !== 0) row.jitk = 'crash';
  else row.jitk = 'mismatch';
  dump(join(dir, 'vm-observation.json'), observed);
}
async function program(name: string): Promise<void> {
  const text = inputs(name);
  const row: Row = { name, held: held(name), source: hash(text), build: 'build-error', diagnostic: '',
    tier: tier(text, []), syscalls: [], absent: [], blockers: [], tolerated: [], limitations: [], jitk: 'not-run' };
  const dir = join(WORK, 'jobs', hash(name).slice(0, 16));
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  chmodSync(dir, 0o777);
  try {
    const elf = join(dir, 'program');
    const buildEnv = environment();
    buildEnv.PATH = dirname(process.env.ZIG || '/Users/noah/.local/share/zig-0.16.0/zig') + ':' + env.PATH;
    buildEnv.SCRIPTC_TARGET = 'aarch64-linux-musl';
    buildEnv.SCRIPTC_RUNTIME_PACK = join(ROOT, 'node_modules/@scriptc/runtime-linux-arm64-musl');
    // Keep compiler/cache writes local and bounded; program sources stay exact.
    buildEnv.SCRIPTC_CACHE_DIR = join(WORK, 'cache');
    const args = [compiler, 'build', join(CORPUS, name), '-o', elf];
    if (text.split('\n', 2).includes('// @optimization: speed')) args.push('--optimization', 'speed');
    const build = await capture(args, { cwd: SOURCE, env: buildEnv, timeout: 40 });
    const diagnostics = Buffer.concat([build.stdout, build.stderr]).toString();
    writeFileSync(join(dir, 'build.log'), diagnostics);
    const codes = new Set<string>();
    for (const code of diagnostics.match(/SC\d{4}/g) || []) codes.add(code);
    row.diagnostic = Array.from(codes).sort().join('+');
    if (build.timeout) row.diagnostic = 'timeout';
    if (build.returncode !== 0 || build.timeout || !existsSync(elf)) {
      if (row.diagnostic && row.diagnostic !== 'timeout') row.build = 'refused';
    } else {
      row.build = 'compiled';
      row.elf = sha(readFileSync(elf));
      try { pack(readFileSync(elf)); }
      catch (e) { row.jitk = 'loader-refusal'; row.loader = String(e).replace(/^Error: /, ''); }
      resetCwd(dir);
      // Node reference runs live, using the upstream shim and directives.
      const node = await capture(['docker', 'exec', '-i', NODE_CONTAINER, 'node', join(ROOT, 'node-reference.ts'), SOURCE, join(CORPUS, name), dir], { timeout: 20 });
      if (node.returncode !== 0 || node.timeout || !existsSync(join(dir, 'node.json'))) row.node = 'reference-error';
      await linux(elf, join(dir, 'linux'));
      const status = readJSON<Status>(join(dir, 'linux/status.json'));
      const stdout = readFileSync(join(dir, 'linux/stdout'));
      const stderr = readFileSync(join(dir, 'linux/stderr'));
      row.linux = stream(stdout, stderr, status.exit, status.timeout || false);
      const trace = readFileSync(join(dir, 'linux/trace'), 'utf8');
      row.trace = hash(trace);
      const info = traceInfo(trace);
      row.syscalls = info.calls;
      row.limitations = info.limits;
      row.absent = info.calls.filter(c => !Object.values(slots).includes(c === 'exit_group' ? 'exit' : c));
      row.tier = tier(text, info.calls);
      if (row.node !== 'reference-error') {
        const expected = readJSON<Status>(join(dir, 'node.json'));
        const nodeOut = readFileSync(join(dir, 'node.stdout'));
        const nodeErr = readFileSync(join(dir, 'node.stderr'));
        const directive = /(?:^|\n)\/\/ @exit:\s*(\d+)/.exec(text.split('\n', 2).join('\n'));
        const exit = directive ? Number(directive[1]) : 0;
        row.node = expected.error || expected.exit !== exit ? 'reference-error' :
          status.timeout ? 'linux-timeout' : status.exit === exit && stdout.equals(nodeOut) && (exit !== 0 || stderr.equals(nodeErr)) ? 'match' : 'mismatch';
        // Save all raw streams locally until this program's receipt is sealed.
      }
      if (row.node !== 'match') {
        const findings = join(WORK, 'findings', hash(name));
        mkdirSync(findings, { recursive: true });
        for (const filename of ['node.json', 'node.stdout', 'node.stderr', 'linux/stdout', 'linux/stderr']) {
          const from = join(dir, filename);
          if (existsSync(from)) writeFileSync(join(findings, filename.replace('/', '-')), readFileSync(from).subarray(0, 32768));
        }
      }
      if (row.absent.length && !row.linux.timeout && existsSync(join(dir, 'linux/repeat/status.json'))) {
        const repeated = readJSON<Status>(join(dir, 'linux/repeat/status.json'));
        row.stable = identical(row.linux, stream(readFileSync(join(dir, 'linux/repeat/stdout')), readFileSync(join(dir, 'linux/repeat/stderr')), repeated.exit, repeated.timeout || false));
      }
      for (const syscall of row.absent) {
        if (row.linux.timeout || row.node !== 'match' || row.stable === false) {
          if (syscall === 'clone') row.injection = row.linux.timeout ? 'linux-timeout' : row.node !== 'match' ? 'linux-node-mismatch' : 'baseline-unstable';
          continue;
        }
        const injectionDir = join(dir, 'linux', syscall);
        const injected = readJSON<Status>(join(injectionDir, 'status.json'));
        const injectedTrace = readFileSync(join(injectionDir, 'trace'), 'utf8');
        const outcome = !injectedTrace.includes('(INJECTED)') ? 'not-exercised' :
          identical(row.linux, stream(readFileSync(join(injectionDir, 'stdout')), readFileSync(join(injectionDir, 'stderr')), injected.exit, injected.timeout || false)) ? 'survives' : 'changes-output-or-exit';
        if (outcome === 'survives') row.tolerated.push(syscall);
        if (outcome === 'changes-output-or-exit') row.blockers.push(syscall);
        if (syscall === 'clone') { row.injection = outcome; row.injectionTrace = hash(injectedTrace); }
        appendFileSync(join(WORK, 'injections.jsonl'), JSON.stringify({ program: hash(name), syscall, outcome,
          trace: hash(injectedTrace), result: stream(readFileSync(join(injectionDir, 'stdout')), readFileSync(join(injectionDir, 'stderr')), injected.exit, injected.timeout || false) }) + '\n');
      }
      // Default census also exercises jitk. `run` resumes a census interrupted
      // before guest evaluation; it rebuilds only receipts lacking that stage.
      if (row.jitk !== 'loader-refusal') await guest(elf, dir, row);
    }
  } catch (e) {
    row.diagnostic = row.diagnostic || String(e).slice(0, 1000);
    if (row.build === 'compiled' && !row.linux) row.node = 'oracle-error';
  } finally {
    dump(join(dir, 'receipt.json'), row);
    // Retain small hashes and results, never thousands of ELFs/traces/outputs.
    mkdirSync(join(WORK, 'receipts'), { recursive: true });
    dump(join(WORK, 'receipts', hash(name) + '.json'), row);
    appendFileSync(JOURNAL, JSON.stringify(row) + '\n');
    rows.push(row);
    rmSync(dir, { recursive: true, force: true });
  }
}
function count(values: string[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const value of values) result[value] = (result[value] || 0) + 1;
  return result;
}
async function summarize(total: number): Promise<void> {
  const missing = Array.from(new Set(rows.flatMap(r => r.absent))).map(name => ({
    syscall: name, programs: rows.filter(r => r.absent.includes(name)).length,
    t1t2: rows.filter(r => (r.tier === 'T1' || r.tier === 'T2') && r.absent.includes(name)).length,
    blocks: rows.filter(r => r.blockers.includes(name)).length,
    t1t2Blocks: rows.filter(r => (r.tier === 'T1' || r.tier === 'T2') && r.blockers.includes(name)).length,
    single: rows.filter(r => r.blockers.length === 1 && r.blockers[0] === name).length,
  })).sort((a, b) => b.single - a.single || b.t1t2Blocks - a.t1t2Blocks || b.programs - a.programs || a.syscall.localeCompare(b.syscall));
  const after = await disk();
  const summary = { schema: 1, revision: REV, compiler: '0.4.5', target: 'aarch64-linux-musl', image: IMAGE,
    nodeImage: NODE_IMAGE, splitCommitment: hash(seed), run: runId, total, completed: rows.length, complete: rows.length === total, selection,
    heldout: rows.filter(r => r.held).length, stages: count(rows.map(r => r.build)),
    node: count(rows.filter(r => r.build === 'compiled').map(r => r.node || 'not-run')),
    jitk: count(rows.filter(r => r.build === 'compiled').map(r => r.jitk)),
    tiers: ['T1', 'T2', 'T3', 'T4'].map(t => ({ tier: t, programs: rows.filter(r => r.tier === t).length,
      compiled: rows.filter(r => r.tier === t && r.build === 'compiled').length,
      linuxComplete: rows.filter(r => r.tier === t && r.linux && !r.linux.timeout).length,
      nodeMatch: rows.filter(r => r.tier === t && r.node === 'match').length,
      jitkPass: rows.filter(r => r.tier === t && r.jitk === 'pass').length })),
    missing, limitations: count(rows.flatMap(r => r.limitations)),
    loader: count(rows.filter(r => r.loader).map(r => r.loader || '')),
    cloneFallback: count(rows.filter(r => r.injection).map(r => r.injection || '')),
    unstableLinux: rows.filter(r => r.stable === false).length,
    diskBefore, diskAfter: after };
  dump(join(WORK, runId + '-summary.json'), summary);
  // Public files exclude held-out identities, hashes, outputs and membership.
  if (runId === 'full') {
    dump(join(ROOT, 'summary.json'), summary);
    const csv = 'program,tier,build,diagnostic,node,jitk,missing,blockers,limitations\n' + rows.filter(r => !r.held).sort((a,b) => a.name.localeCompare(b.name)).map(r =>
      [r.name, r.tier, r.build, /^SC\d/.test(r.diagnostic) ? r.diagnostic : r.diagnostic ? 'build-or-driver-error' : '', r.node || '', r.jitk, r.absent.join(';'), r.blockers.join(';'), r.limitations.join(';')].map(c => '"' + c.replaceAll('"', '""') + '"').join(',')).join('\n') + '\n';
    check(Buffer.byteLength(csv) < 1024 * 1024, 'public CSV exceeds 1 MiB');
    writeFileSync(join(ROOT, 'census.csv'), csv);
  }
  console.log(JSON.stringify(summary));
}
async function prepare(): Promise<void> {
  mkdirSync(WORK, { recursive: true });
  const seedPath = join(WORK, 'split-seed');
  if (!seed) seed = existsSync(seedPath) ? readFileSync(seedPath, 'utf8').trim() : randomBytes(32).toString('hex');
  if (!existsSync(seedPath)) { writeFileSync(seedPath, seed); chmodSync(seedPath, 0o600); }
  if (!existsSync(join(SOURCE, 'package.json'))) {
    const repo = process.env.SCRIPTC_REPO || '/Users/noah/scriptc';
    check((await run(['git', '-C', repo, 'rev-parse', 'v0.4.5'], { timeout: 5 })).stdout.toString().trim() === REV, 'tag mismatch');
    mkdirSync(SOURCE, { recursive: true });
    await run(['git', '-C', repo, 'archive', REV, '-o', join(WORK, 'source.tar')], { timeout: 15 });
    await run(['tar', '-xf', join(WORK, 'source.tar'), '-C', SOURCE], { timeout: 15 });
    rmSync(join(WORK, 'source.tar'));
    symlinkSync(join(repo, 'node_modules'), join(SOURCE, 'node_modules'));
  }
  const image = await run(['docker', 'image', 'inspect', 'jitk-oracle:08', '--format', '{{.Id}}'], { timeout: 10 });
  check(image.stdout.toString().trim() === IMAGE, 'oracle image identity changed');
  check((await run([compiler, '--version'], { timeout: 10 })).stdout.toString().trim() === '0.4.5', 'compiler pin mismatch');
  slots = readJSON<Record<string, string>>(resolve(ROOT, '../kernel/slots.json'));
  const kernel = join(WORK, 'kernel');
  if (!existsSync(join(kernel, 'Cargo.toml'))) copyTree(resolve(ROOT, '../kernel'), kernel, new Set(['.work', 'target', 'target-ring', 'dist', 'test-work', 'test-results', 'node_modules']));
  // Native tools read canonical sources but write only to this task's .work.
  mkdirSync(join(WORK, 'kernel-tools'), { recursive: true });
}
async function main(): Promise<void> {
  mode = process.argv[2] || 'census';
  for (let i = 3; i < process.argv.length; i += 2) {
    const key = process.argv[i], value = process.argv[i + 1];
    if (key === '--limit') limit = Number(value);
    else if (key === '--filter') filter = value;
    else if (key === '--selection') selection = value;
    else if (key === '--workers') workers = Number(value);
    else if (key === '--seed') seed = value;
    else if (key === '--heldout-percent') heldPercent = Number(value);
    else if (key === '--id') runId = value;
    else throw new Error('unknown argument ' + key);
  }
  if (mode === 'test') {
    check(traceInfo('42 nanosleep({tv_sec=0}, NULL) = 0\n42 clone(a) = 1').calls.join(',') === 'clone,nanosleep', 'trace parser');
    check(traceInfo('ppoll([{fd=7, events=POLLIN}], 1, NULL, NULL, 8) = 0').limits.includes('ppoll:fd>2'), 'ppoll limits');
    check(held('x') === held('x') && tier('console.log(1)', []) === 'T1', 'split/tier');
    check(tier('setTimeout(f, 1)', []) === 'T2' && tier('new Worker(f)', []) === 'T3' && tier('fetch(url)', []) === 'T4', 'tiers');
    console.log('ok'); return;
  }
  check(mode === 'census' || mode === 'run' || mode === 'report', 'expected census/run/report/test');
  check(Number.isInteger(workers) && workers >= 1 && workers <= 2, 'at most two oracle workers (one slot reserved for grow)');
  check(['all', 'visible', 'heldout'].includes(selection), 'invalid selection');
  check(/^[a-zA-Z0-9_-]+$/.test(runId), 'unsafe run id');
  await prepare();
  diskBefore = await disk();
  const selected = entries().filter(n => (!filter || n.includes(filter)) && (selection === 'all' || held(n) === (selection === 'heldout'))).slice(0, limit);
  const manifest = { revision: REV, seedCommitment: hash(seed), heldPercent, selection,
    selected: hash(selected.join('\n')), count: selected.length, image: IMAGE, nodeImage: NODE_IMAGE,
    runner: sha(readFileSync(join(ROOT, 'census.ts'))), oracle: sha(readFileSync(join(WORK, 'bin/oracle'))),
    reference: sha(readFileSync(join(ROOT, 'node-reference.ts'))), compiler: sha(readFileSync(compiler)),
    kernel: hash(files(join(WORK, 'kernel')).map(f => f.slice(WORK.length) + ':' + sha(readFileSync(f))).join('\n')),
    sourceDependencyLock: sha(readFileSync(join(SOURCE, 'pnpm-lock.yaml'))),
    actualDependencyLock: sha(readFileSync(join(realpathSync(join(SOURCE, 'node_modules')), '..', 'pnpm-lock.yaml'))) };
  const manifestPath = join(WORK, runId + '-manifest.json');
  if (existsSync(manifestPath) && mode !== 'report') check(JSON.stringify(readJSON<unknown>(manifestPath)) === JSON.stringify(manifest), 'resume pins changed: choose a fresh --id');
  if (!existsSync(manifestPath)) dump(manifestPath, manifest);
  const diskPath = join(WORK, runId + '-disk-before.txt');
  if (existsSync(diskPath)) diskBefore = readFileSync(diskPath, 'utf8');
  else writeFileSync(diskPath, diskBefore);
  JOURNAL = join(WORK, runId + '.jsonl');
  if (existsSync(JOURNAL)) rows = readFileSync(JOURNAL, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line) as Row);
  const completed = new Set(rows.map(r => r.name));
  const todo = selected.filter(n => !completed.has(n));
  console.log('corpus=' + selected.length + ' remaining=' + todo.length + ' workers=' + workers);
  if (mode === 'report') { await summarize(selected.length); return; }
  const common = ['--platform', 'linux/arm64', '--network', 'none', '--read-only', '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges', '--pids-limit', '128', '--memory', '1g', '--cpus', '2',
    '--user', '65534:65534', '--tmpfs', '/tmp:rw,nosuid,size=128m',
    '-v', WORK + ':' + WORK + ':rw', '-v', SOURCE + ':' + SOURCE + ':ro'];
  await run(['docker', 'run', '-d', '--name', ORACLE_CONTAINER, ...common,
    '-v', join(ROOT, '.work/bin/oracle') + ':/driver:ro', '--entrypoint', '/bin/sleep', IMAGE, 'infinity'], { timeout: 15 });
  try {
  const dependencyRoot = resolve(realpathSync(join(SOURCE, 'node_modules')), '..');
  await run(['docker', 'run', '-d', '--name', NODE_CONTAINER, ...common,
    '-v', dependencyRoot + ':' + dependencyRoot + ':ro', '-v', join(ROOT, 'node-reference.ts') + ':' + join(ROOT, 'node-reference.ts') + ':ro',
    '--entrypoint', '/bin/sleep', NODE_IMAGE, 'infinity'], { timeout: 15 });
  // Kernel builds share a Cargo cache, so only one guest stage at a time is
  // needed in the rare case the unchanged upstream ELF passes the packer.
  const tasks: Promise<void>[] = [];
  for (let w = 0; w < workers; w++) tasks.push((async () => {
    while (index < todo.length) {
      const n = index++;
      await program(todo[n]);
      if (rows.length % 25 === 0) console.log('completed=' + rows.length + '/' + selected.length);
      if (rows.length % 200 === 0) { await disk(); console.log('disk guard checked'); }
    }
  })());
  await Promise.all(tasks);
  await summarize(selected.length);
  } finally {
    await capture(['docker', 'rm', '-f', ORACLE_CONTAINER, NODE_CONTAINER], { timeout: 10 });
  }
}
main().catch((e: unknown) => { console.error(String(e)); process.exitCode = 1; });
