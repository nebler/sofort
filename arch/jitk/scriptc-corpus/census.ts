import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, lstatSync, rmSync, symlinkSync, appendFileSync, chmodSync, realpathSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { capture, run, dump, readJSON, check, environment, copyTree, files, sha } from './lib.ts';
import { pack } from '../kernel/packer.ts';
import { guestStdout } from './guest-output.ts';
import { guest, stream, identical, errno, embedded, type Stream } from './guest.ts';

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
interface Row {
  name: string; held: boolean; source: string; build: string; diagnostic: string;
  elf?: string; tier: string; node?: string; linux?: Stream; syscalls: string[];
  absent: string[]; blockers: string[]; tolerated: string[]; limitations: string[]; jitk: string; loader?: string;
  trace?: string; injection?: string; injectionTrace?: string; guest?: Stream;
  stable?: boolean;
  guestMissing?: string[]; guestErrors?: string[]; guestTrace?: string; crash?: string;
  stockLoader?: string; guestDivergent?: string[]; guestBlocking?: string[]; cause?: string;
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
let infrastructureFailure = false;
let layout = 'jitk';
// rerun: source journal, kernel tree and optional program filters.
let fromId = '';
let kernelArg = '';
let namesFile = '';
let uses = '';
let findingsDir = 'findings';
let targetPrefix = '';

function hash(text: string): string { return sha(Buffer.from(text)); }
function held(name: string): boolean { return parseInt(hash(seed + '\0' + name).slice(0, 8), 16) % 100 < heldPercent; }
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
function traceInfo(text: string): { calls: string[]; limits: string[]; errors: string[] } {
  const calls = new Set<string>();
  const limits = new Set<string>();
  const errors = new Set<string>();
  for (const line of text.split('\n')) {
    const e = /^\s*(?:\d+\s+)?(?:<\.\.\. )?([a-zA-Z_][a-zA-Z_0-9]*)(?:\(| resumed>).*\)\s+=\s+-1\s+(E[A-Z0-9]+)/.exec(line);
    if (e) errors.add(e[1] + ':' + -errno(e[2]));
  }
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
  return { calls: Array.from(calls).sort(), limits: Array.from(limits).sort(), errors: Array.from(errors).sort() };
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
  const container = ORACLE_CONTAINER + '-' + hash(dir).slice(0, 10);
  try {
    const result = await capture(['docker', 'run', '--rm', '--init', '-i', '--name', container,
      '--platform', 'linux/arm64', '--network', 'none', '--read-only', '--cap-drop', 'ALL',
      '--security-opt', 'no-new-privileges', '--pids-limit', '256', '--memory', '1g', '--cpus', '1',
      '--user', '65534:65534', '--tmpfs', '/tmp:rw,nosuid,size=128m',
      '-v', WORK + ':' + WORK + ':rw', '-v', SOURCE + ':' + SOURCE + ':ro',
      '-v', join(ROOT, '.work/bin/oracle') + ':/driver:ro', '--entrypoint', '/driver', IMAGE, dir], { timeout: 300 });
    writeFileSync(join(dir, 'driver.stderr'), result.stderr);
    dump(join(dir, 'driver-status.json'), { exit: result.returncode, timeout: result.timeout });
    // Injected getpid/kill/execve can make the tracee signal its own harness.
    // The already sealed baseline remains valid; missing injection legs are
    // explicitly unresolved and cannot count as causal blockers.
    check(existsSync(join(dir, 'status.json')), 'oracle-driver-failure rc=' + result.returncode + ' timeout=' + result.timeout + ' ' + result.stderr.toString());
  } finally { await capture(['docker', 'rm', '-f', container], { timeout: 10 }); }
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
// pass: byte-identical stdout/stderr/exit with a complete trace.
// missing-syscall: the guest hit a missing syscall that Linux also executed and
// that was not shown tolerated by the single-syscall ENOSYS experiment.
// Guest-only missing calls (e.g. tkill from abort) are consequences.
// crash: fault/timeout/incomplete protocol; mismatch: complete but different.
export function classify(r: { complete: boolean; same: boolean; fault: boolean; timeout: boolean },
  missing: string[], absent: string[], tolerated: string[]): { jitk: string; blocking: string[] } {
  const blocking = missing.filter(n => absent.includes(n) && !tolerated.includes(n));
  if (r.complete && r.same) return { jitk: 'pass', blocking };
  if (blocking.length) return { jitk: 'missing-syscall', blocking };
  return { jitk: r.complete && !r.fault && !r.timeout ? 'mismatch' : 'crash', blocking };
}
// Registered-syscall error results Linux never produced for the same call.
export function divergent(guestErrors: string[], linuxErrors: string[]): string[] {
  return guestErrors.filter(e => !e.endsWith(':-38') && !linuxErrors.includes(e));
}
async function jitk(elf: string, dir: string, row: Row, linuxErrors: string[], target = 'target', kernel = join(WORK, 'kernel')): Promise<void> {
  // Invoking the exact canonical packer for EVERY compiled ELF is deliberate:
  // a syscall shortage must never hide a loader/packer gap.
  try { pack(readFileSync(elf)); }
  catch (e) { row.jitk = 'loader-refusal'; row.loader = String(e).replace(/^Error: /, ''); return; }
  const g = await guest(elf, dir, 10, target, kernel);
  if ('buildError' in g) { row.jitk = 'build-error'; row.diagnostic = row.diagnostic || 'kernel ' + g.buildError; return; }
  row.guestTrace = g.trace;
  row.guestMissing = g.missing;
  row.guestErrors = g.errors;
  row.guest = g.stream;
  row.guestDivergent = divergent(g.errors, linuxErrors);
  const c = classify({ complete: g.complete, same: row.linux !== undefined && identical(g.stream, row.linux), fault: g.fault !== null, timeout: g.stream.timeout },
    g.missing, row.absent, row.tolerated);
  row.jitk = c.jitk;
  row.guestBlocking = c.blocking;
  if (row.jitk === 'crash') row.crash = g.stream.timeout ? 'timeout' : g.control ? 'stdout-control-byte' : g.abort ? 'abort' : g.fault ? 'fault' : g.fatal ? 'fatal-protocol' : 'incomplete-protocol';
  // The cause is a heuristic: the blocking missing syscall, else the transport
  // limit, else the LAST Linux-divergent error result before the failure.
  const last = g.errorOrder.filter(e => row.guestDivergent!.includes(e)).pop();
  row.cause = row.jitk === 'pass' ? '' : c.blocking.length ? 'missing:' + c.blocking.join('+') : g.control ? 'stdout-control-byte' : last ? 'divergent:' + last : row.crash || row.jitk;
  if (row.jitk !== 'pass') {
    const findings = join(WORK, findingsDir, hash(row.name));
    mkdirSync(findings, { recursive: true });
    writeFileSync(join(findings, 'vm.stdout.head'), g.raw.subarray(0, 65536));
    writeFileSync(join(findings, 'vm.stdout.tail'), g.raw.subarray(Math.max(0, g.raw.length - 65536)));
    dump(join(findings, 'vm-failure.json'), { complete: g.complete, fault: g.fault, abort: g.abort, missing: g.missing,
      errors: g.errors, divergent: row.guestDivergent, hostExit: g.hostExit, timeout: g.stream.timeout });
  }
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
    if (layout === 'jitk') buildEnv.SCRIPTC_LINKER = join(ROOT, 'zig-link.sh');
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
      if (layout === 'jitk') {
        // The unmodified scriptc/Zig link is what a user ships; record its
        // canonical packer result separately from the relinked jitk layout.
        const stockEnv = { ...buildEnv };
        delete stockEnv.SCRIPTC_LINKER;
        const stockElf = join(dir, 'program-stock');
        const stock = await capture([compiler, 'build', join(CORPUS, name), '-o', stockElf, ...args.slice(5)], { cwd: SOURCE, env: stockEnv, timeout: 40 });
        if (stock.returncode !== 0 || stock.timeout || !existsSync(stockElf)) row.stockLoader = 'build-error';
        else {
          try { pack(readFileSync(stockElf)); row.stockLoader = 'ok'; }
          catch (e) { row.stockLoader = String(e).replace(/^Error: /, ''); }
        }
        rmSync(stockElf, { force: true });
      }
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
      const linuxErrors = info.errors;
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
        if (!existsSync(join(injectionDir, 'status.json')) || !existsSync(join(injectionDir, 'trace'))) {
          row.limitations.push('probe-interrupted:' + syscall);
          if (syscall === 'clone') row.injection = 'probe-interrupted';
          continue;
        }
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
      if (row.jitk !== 'loader-refusal') await jitk(elf, dir, row, linuxErrors);
    }
  } catch (e) {
    row.diagnostic = row.diagnostic || String(e).slice(0, 1000);
    if (row.build === 'compiled' && !row.linux) row.node = 'oracle-error';
    if (/oracle-driver-failure|stale-payload-embedding/.test(String(e))) infrastructureFailure = true;
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
  const allMissing = new Set<string>();
  for (const row of rows) for (const name of [...row.absent, ...(row.guestMissing || [])]) allMissing.add(name);
  const missing = Array.from(allMissing).map(name => ({
    syscall: name, programs: rows.filter(r => r.absent.includes(name)).length,
    t1t2: rows.filter(r => (r.tier === 'T1' || r.tier === 'T2') && r.absent.includes(name)).length,
    blocks: rows.filter(r => r.blockers.includes(name)).length,
    t1t2Blocks: rows.filter(r => (r.tier === 'T1' || r.tier === 'T2') && r.blockers.includes(name)).length,
    single: rows.filter(r => r.blockers.length === 1 && r.blockers[0] === name).length,
    jitkSeen: rows.filter(r => (r.guestMissing || []).includes(name)).length,
    jitkBlocks: rows.filter(r => r.jitk === 'missing-syscall' && (r.guestBlocking || []).includes(name)).length,
    jitkT1T2Blocks: rows.filter(r => (r.tier === 'T1' || r.tier === 'T2') && r.jitk === 'missing-syscall' && (r.guestBlocking || []).includes(name)).length,
    jitkSingle: rows.filter(r => r.jitk === 'missing-syscall' && (r.guestBlocking || []).length === 1 && r.guestBlocking![0] === name).length,
  })).sort((a, b) => b.jitkSingle - a.jitkSingle || b.jitkBlocks - a.jitkBlocks || b.single - a.single || b.t1t2Blocks - a.t1t2Blocks || b.programs - a.programs || a.syscall.localeCompare(b.syscall));
  const after = await disk();
  const summary = { schema: 1, revision: REV, compiler: '0.4.5', target: 'aarch64-linux-musl', image: IMAGE,
    nodeImage: NODE_IMAGE, layout, kernelProfile: 'canonical release (lto, codegen-units=1, non-incremental)', splitCommitment: hash(seed), run: runId, total, completed: rows.length, complete: rows.length === total, selection,
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
    nodeVerifiedPass: rows.filter(r => r.node === 'match' && r.jitk === 'pass').length,
    guestErrors: count(rows.flatMap(r => r.guestErrors || [])),
    crashes: count(rows.filter(r => r.crash).map(r => r.crash || '')),
    stockLoader: count(rows.filter(r => r.stockLoader).map(r => r.stockLoader || '')),
    causes: count(rows.filter(r => r.build === 'compiled' && r.jitk !== 'pass' && r.jitk !== 'loader-refusal').map(r => r.cause || r.jitk)),
    divergent: count(rows.flatMap(r => r.guestDivergent || [])),
    covered: (() => { const c = rows.filter(r => r.build === 'compiled' && r.linux && r.absent.length === 0);
      return { programs: c.length, nodeMatch: c.filter(r => r.node === 'match').length, jitk: count(c.map(r => r.jitk)) }; })(),
    t1t2: count(rows.filter(r => r.build === 'compiled' && (r.tier === 'T1' || r.tier === 'T2')).map(r => r.jitk)),
    diskBefore, diskAfter: after };
  dump(join(WORK, runId + '-summary.json'), summary);
  // Public files exclude held-out identities, hashes, outputs and membership.
  if (runId === 'full') {
    dump(join(ROOT, 'summary.json'), summary);
    const csv = 'program,tier,build,diagnostic,node,stock_loader,jitk,cause,linux_missing,linux_blockers,jitk_missing\n' + rows.filter(r => !r.held).sort((a,b) => a.name.localeCompare(b.name)).map(r =>
      [r.name, r.tier, r.build, /^SC\d/.test(r.diagnostic) ? r.diagnostic : r.diagnostic ? 'build-or-driver-error' : '', r.node || '', r.stockLoader || '', r.jitk, r.cause || '', r.absent.join(';'), r.blockers.join(';'), (r.guestMissing || []).join(';')].map(c => '"' + c.replaceAll('"', '""') + '"').join(',')).join('\n') + '\n';
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
}
// rerun: jitk-only re-evaluation of a completed census journal against another
// kernel tree (`--kernel DIR`, copied into .work/kernel-<id>). Linux/Node
// streams, tolerated/blocker sets and tiers come from the `--from` journal.
// Every ELF is rebuilt; under the jitk layout it must hash to the census ELF,
// so the comparison stays like for like. The census trace files were pruned, so
// `cause` filters guest errors by those seen in passing programs of the source
// journal instead of by the per-program Linux error set.
function latestRows(id: string): Row[] {
  const latest = new Map<string, Row>();
  for (const line of readFileSync(join(WORK, id + '.jsonl'), 'utf8').trim().split('\n').filter(Boolean)) {
    const row = JSON.parse(line) as Row;
    latest.set(row.name, row);
  }
  return Array.from(latest.values());
}
async function rerunProgram(base: Row, target: string, kernel: string, benign: string[]): Promise<void> {
  const row: Row = { name: base.name, held: base.held, source: base.source, build: base.build, diagnostic: '', elf: base.elf,
    tier: base.tier, node: base.node, linux: base.linux, syscalls: base.syscalls, absent: base.absent, blockers: base.blockers,
    tolerated: base.tolerated, limitations: base.limitations, jitk: 'not-run', stable: base.stable, stockLoader: base.stockLoader };
  const dir = join(WORK, 'jobs', hash(runId + '\0' + base.name).slice(0, 16));
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  try {
    const text = inputs(base.name);
    check(hash(text) === base.source, 'corpus source drift: ' + base.name);
    const elf = join(dir, 'program');
    const buildEnv = environment();
    buildEnv.PATH = dirname(process.env.ZIG || '/Users/noah/.local/share/zig-0.16.0/zig') + ':' + env.PATH;
    buildEnv.SCRIPTC_TARGET = 'aarch64-linux-musl';
    buildEnv.SCRIPTC_RUNTIME_PACK = join(ROOT, 'node_modules/@scriptc/runtime-linux-arm64-musl');
    if (layout === 'jitk') buildEnv.SCRIPTC_LINKER = join(ROOT, 'zig-link.sh');
    buildEnv.SCRIPTC_CACHE_DIR = join(WORK, 'cache');
    const args = [compiler, 'build', join(CORPUS, base.name), '-o', elf];
    if (text.split('\n', 2).includes('// @optimization: speed')) args.push('--optimization', 'speed');
    const build = await capture(args, { cwd: SOURCE, env: buildEnv, timeout: 40 });
    if (build.returncode !== 0 || build.timeout || !existsSync(elf)) { row.jitk = 'build-error'; row.diagnostic = 'rebuild failed'; return; }
    if (layout === 'jitk' && sha(readFileSync(elf)) !== base.elf) { row.jitk = 'elf-drift'; row.diagnostic = 'rebuilt ELF differs from the census ELF'; return; }
    if (layout === 'stock') row.elf = sha(readFileSync(elf));
    try { pack(readFileSync(elf)); }
    catch (e) { row.jitk = 'loader-refusal'; row.loader = String(e).replace(/^Error: /, ''); return; }
    await jitk(elf, dir, row, benign, target, kernel);
  } catch (e) {
    row.diagnostic = row.diagnostic || String(e).slice(0, 1000);
    if (/stale-payload-embedding/.test(String(e))) infrastructureFailure = true;
  } finally {
    appendFileSync(JOURNAL, JSON.stringify(row) + '\n');
    rows.push(row);
    rmSync(dir, { recursive: true, force: true });
  }
}
async function rerun(): Promise<void> {
  check(/^[a-zA-Z0-9_-]+$/.test(fromId) && existsSync(join(WORK, fromId + '.jsonl')), 'rerun needs --from <completed census id>');
  check(kernelArg !== '' && existsSync(join(kernelArg, 'build.sh')), 'rerun needs --kernel <kernel tree>');
  check(Number.isInteger(workers) && workers >= 1 && workers <= 3, 'rerun uses at most three guest workers');
  check(['all', 'visible', 'heldout'].includes(selection) && (layout === 'stock' || layout === 'jitk'), 'selection/layout');
  check(/^[a-zA-Z0-9_-]+$/.test(runId) && runId !== 'full' && runId !== fromId, 'rerun needs a fresh --id');
  await prepare();
  diskBefore = await disk();
  findingsDir = 'findings-' + runId;
  const source = latestRows(fromId);
  const names = namesFile ? new Set(readFileSync(namesFile, 'utf8').split('\n').filter(Boolean)) : null;
  const selected = source.filter(r => r.build === 'compiled' && (!filter || r.name.includes(filter)) && (!names || names.has(r.name))
    && (!uses || uses.split(',').some(u => r.syscalls.includes(u))) && (selection === 'all' || held(r.name) === (selection === 'heldout')))
    .sort((a, b) => a.name.localeCompare(b.name)).slice(0, limit);
  const kernel = join(WORK, 'kernel-' + runId);
  if (!existsSync(join(kernel, 'Cargo.toml'))) copyTree(resolve(kernelArg), kernel, new Set(['.work', 'target', 'target-ring', 'dist', 'test-work', 'test-results', 'node_modules', '.git']));
  const benign = Array.from(new Set(source.filter(r => r.jitk === 'pass').flatMap(r => r.guestErrors || []))).sort();
  const manifest = { mode: 'rerun', from: fromId, fromJournal: sha(readFileSync(join(WORK, fromId + '.jsonl'))), seedCommitment: hash(seed), heldPercent,
    selection, layout, linker: layout === 'jitk' ? sha(readFileSync(join(ROOT, 'zig-link.sh'))) : 'scriptc-default',
    selected: hash(selected.map(r => r.name).join('\n')), count: selected.length, runner: sha(readFileSync(join(ROOT, 'census.ts'))),
    guest: sha(readFileSync(join(ROOT, 'guest.ts'))), compiler: sha(readFileSync(compiler)),
    kernel: hash(files(kernel).map(f => f.slice(kernel.length) + ':' + sha(readFileSync(f))).join('\n')), benign };
  const manifestPath = join(WORK, runId + '-manifest.json');
  if (existsSync(manifestPath)) check(JSON.stringify(readJSON<unknown>(manifestPath)) === JSON.stringify(manifest), 'resume pins changed: choose a fresh --id');
  else dump(manifestPath, manifest);
  JOURNAL = join(WORK, runId + '.jsonl');
  if (existsSync(JOURNAL)) rows = latestRows(runId).filter(r => r.jitk !== 'not-run');
  const completed = new Set(rows.map(r => r.name));
  const todo = selected.filter(r => !completed.has(r.name));
  console.log('rerun=' + runId + ' from=' + fromId + ' selected=' + selected.length + ' remaining=' + todo.length + ' workers=' + workers);
  for (let start = 0; start < todo.length; start += 100) {
    const batch = todo.slice(start, start + 100);
    let next = 0;
    // Distinct Cargo target dirs let the workers build images concurrently.
    const tasks: Promise<void>[] = [];
    for (let w = 0; w < workers; w++) tasks.push((async () => {
      while (next < batch.length && !infrastructureFailure) await rerunProgram(batch[next++], (targetPrefix || 'target-' + runId) + '-' + w, kernel, benign);
    })());
    const results = await Promise.allSettled(tasks);
    for (const result of results) check(result.status === 'fulfilled', 'worker failed');
    check(!infrastructureFailure, 'guest infrastructure failed; resume to retry');
    console.log('completed=' + rows.length + '/' + selected.length + ' pass=' + rows.filter(r => r.jitk === 'pass').length);
    await disk();
  }
  const before = new Map(source.map(r => [r.name, r]));
  const transitions: Record<string, number> = {};
  for (const r of rows) { const key = (before.get(r.name)?.jitk || 'absent') + '->' + r.jitk; transitions[key] = (transitions[key] || 0) + 1; }
  const tiers = ['T1', 'T2', 'T3', 'T4'].map(t => ({ tier: t, compiled: rows.filter(r => r.tier === t).length,
    before: rows.filter(r => r.tier === t && before.get(r.name)?.jitk === 'pass').length, after: rows.filter(r => r.tier === t && r.jitk === 'pass').length }));
  const summary = { schema: 1, mode: 'rerun', run: runId, from: fromId, selection, layout, total: selected.length, completed: rows.length,
    complete: rows.length === selected.length, heldout: rows.filter(r => r.held).length, jitk: count(rows.map(r => r.jitk)),
    before: count(rows.map(r => before.get(r.name)?.jitk || 'absent')), tiers, transitions,
    t1t2: { compiled: rows.filter(r => r.tier === 'T1' || r.tier === 'T2').length, before: rows.filter(r => (r.tier === 'T1' || r.tier === 'T2') && before.get(r.name)?.jitk === 'pass').length, after: rows.filter(r => (r.tier === 'T1' || r.tier === 'T2') && r.jitk === 'pass').length },
    nodeVerifiedPass: rows.filter(r => r.node === 'match' && r.jitk === 'pass').length,
    causes: count(rows.filter(r => r.jitk !== 'pass').map(r => r.cause || r.jitk)), crashes: count(rows.filter(r => r.crash).map(r => r.crash || '')),
    guestMissing: count(rows.flatMap(r => r.guestMissing || [])), loader: count(rows.filter(r => r.loader).map(r => r.loader || '')),
    benign, diskBefore, diskAfter: await disk() };
  dump(join(WORK, runId + '-summary.json'), summary);
  console.log(JSON.stringify({ run: runId, total: summary.total, completed: summary.completed, jitk: summary.jitk, tiers }));
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
    else if (key === '--layout') layout = value;
    else if (key === '--from') fromId = value;
    else if (key === '--kernel') kernelArg = value;
    else if (key === '--names') namesFile = value;
    else if (key === '--uses') uses = value;
    else if (key === '--targets') targetPrefix = value;
    else throw new Error('unknown argument ' + key);
  }
  if (mode === 'test') {
    check(guestStdout(Buffer.from('\nA\n\n')).equals(Buffer.from('\nA\n\n')), 'blank stdout lines');
    check(guestStdout(Buffer.from('tail')).equals(Buffer.from('tail')), 'unterminated stdout');
    check(guestStdout(Buffer.from('\x1e{"v":2,"kind":"sys.enter"}\n\nX\n')).equals(Buffer.from('\nX\n')), 'record stripping preserves stdout');
    check(traceInfo('42 nanosleep({tv_sec=0}, NULL) = 0\n42 clone(a) = 1').calls.join(',') === 'clone,nanosleep', 'trace parser');
    check(traceInfo('ppoll([{fd=7, events=POLLIN}], 1, NULL, NULL, 8) = 0').limits.includes('ppoll:fd>2'), 'ppoll limits');
    check(held('x') === held('x') && tier('console.log(1)', []) === 'T1', 'split/tier');
    check(tier('setTimeout(f, 1)', []) === 'T2' && tier('new Worker(f)', []) === 'T3' && tier('fetch(url)', []) === 'T4', 'tiers');
    const ok = { complete: true, same: true, fault: false, timeout: false };
    check(classify(ok, ['sched_getaffinity'], ['sched_getaffinity'], ['sched_getaffinity']).jitk === 'pass', 'classify pass');
    check(classify({ ...ok, same: false }, ['getrandom'], ['getrandom'], []).jitk === 'missing-syscall', 'classify blocker');
    check(classify({ ...ok, complete: false, same: false, fault: true }, ['tkill'], [], []).jitk === 'crash', 'guest-only missing is a consequence');
    check(classify({ ...ok, same: false }, ['madvise'], ['madvise'], ['madvise']).jitk === 'mismatch', 'tolerated missing');
    check(traceInfo('7 mmap(0x7e1000, 4096, PROT_READ, MAP_PRIVATE, -1, 0) = -1 EINVAL (Invalid argument)\n<... read resumed>"", 1) = -1 EAGAIN (x)').errors.join(',') === 'mmap:-22,read:-11', 'linux errno parser');
    check(divergent(['mmap:-22', 'mmap:-12', 'rt_sigaction:-38'], ['mmap:-12']).join(',') === 'mmap:-22', 'divergent errors');
    const flat = Buffer.from('payload-bytes');
    check(embedded(Buffer.concat([Buffer.alloc(0x80000), flat]), flat) && !embedded(Buffer.concat([Buffer.alloc(0x80000), Buffer.from('stale-payload')]), flat), 'payload embedding check');
    console.log('ok'); return;
  }
  if (mode === 'rerun') { await rerun(); return; }
  check(mode === 'census' || mode === 'run' || mode === 'report', 'expected census/run/report/rerun/test');
  check(Number.isInteger(workers) && workers >= 1 && workers <= 2, 'at most two oracle workers (one slot reserved for grow)');
  check(['all', 'visible', 'heldout'].includes(selection), 'invalid selection');
  check(layout === 'stock' || layout === 'jitk', 'invalid link layout');
  check(/^[a-zA-Z0-9_-]+$/.test(runId), 'unsafe run id');
  await prepare();
  diskBefore = await disk();
  const selected = entries().filter(n => (!filter || n.includes(filter)) && (selection === 'all' || held(n) === (selection === 'heldout'))).slice(0, limit);
  const manifest = { revision: REV, seedCommitment: hash(seed), heldPercent, selection, layout,
    linker: layout === 'jitk' ? sha(readFileSync(join(ROOT, 'zig-link.sh'))) : 'scriptc-default',
    kernelProfile: { optimization: 's', lto: false, incremental: true, codegenUnits: 16 },
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
  if (existsSync(JOURNAL)) {
    const latest = new Map<string, Row>();
    for (const line of readFileSync(JOURNAL, 'utf8').trim().split('\n').filter(Boolean)) {
      const row = JSON.parse(line) as Row;
      latest.set(row.name, row);
    }
    rows = Array.from(latest.values()).filter(r => r.node !== 'oracle-error');
  }
  const completed = new Set(rows.map(r => r.name));
  const todo = selected.filter(n => !completed.has(n));
  console.log('corpus=' + selected.length + ' remaining=' + todo.length + ' workers=' + workers);
  if (mode === 'report') { await summarize(selected.length); return; }
  const common = ['--init', '--platform', 'linux/arm64', '--network', 'none', '--read-only', '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges', '--pids-limit', '256', '--memory', '1g', '--cpus', '2',
    '--user', '65534:65534', '--tmpfs', '/tmp:rw,nosuid,size=128m',
    '-v', WORK + ':' + WORK + ':rw', '-v', SOURCE + ':' + SOURCE + ':ro'];
  for (let start = 0; start < todo.length; start += 100) {
  const batch = todo.slice(start, start + 100);
  let next = 0;
  try {
  const dependencyRoot = resolve(realpathSync(join(SOURCE, 'node_modules')), '..');
  await run(['docker', 'run', '-d', '--name', NODE_CONTAINER, ...common,
    '-v', dependencyRoot + ':' + dependencyRoot + ':ro', '-v', join(ROOT, 'node-reference.ts') + ':' + join(ROOT, 'node-reference.ts') + ':ro',
    '--entrypoint', '/bin/sleep', NODE_IMAGE, 'infinity'], { timeout: 15 });
  // Kernel builds share a Cargo cache, so only one guest stage at a time is
  // needed in the rare case the unchanged upstream ELF passes the packer.
  const tasks: Promise<void>[] = [];
  for (let w = 0; w < workers; w++) tasks.push((async () => {
    while (next < batch.length && !infrastructureFailure) {
      const n = next++;
      await program(batch[n]);
      if (rows.length % 25 === 0) console.log('completed=' + rows.length + '/' + selected.length);
    }
  })());
  const results = await Promise.allSettled(tasks);
  for (const result of results) check(result.status === 'fulfilled', 'worker failed');
  check(!infrastructureFailure, 'oracle infrastructure failed; resume to retry failed rows');
  } finally {
    await capture(['docker', 'rm', '-f', NODE_CONTAINER], { timeout: 10 });
  }
  await disk();
  console.log('disk guard checked; containers recycled');
  }
  await summarize(selected.length);
}
main().catch((e: unknown) => { console.error(String(e)); process.exitCode = 1; });
