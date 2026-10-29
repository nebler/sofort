import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { check, detail, dump, equal, GateError, readJSON } from './lib.ts';
import { ASSETS, CANONICAL, ROOT, build, slotNumber, capture, checkHost, cleanup, copyKernel, distribution, host, hostCommand, load, probeSource, processGuest, run, scratch, selectGate, selectHost, sha, treeHashes, SANDBOX_ACK, type GuestInfo } from './runtime.ts';
import { compare, guest, linux } from './adapters.ts';
import { hostHandlerTests } from './host-tests.ts';
import { retryTransaction, type Feedback, type TransactionReport } from './retries.ts';
import { proposal, validateProposal, type SpecLevel } from './agent.ts';
import { observe, requireResult, type Observations, type SyscallRecord } from './observations.ts';
import { PROFILES, mutations, resources, type Cases } from './profiles.ts';
import { integration, type IntegrationResult } from './sqlite-profile.ts';
import { oracle } from './oracle.ts';
import { requireNoProbeBranches } from './probe-lint.ts';

export const LUA_ARGV = ['lua', '-e', readFileSync(join(ASSETS, 'fixtures.lua'), 'utf8')];
export const QJS_ARGV = ['qjs', '--std', '-e', 'os.setReadHandler(0,()=>{const s=std.in.getline();os.setReadHandler(0,null);print("reply:"+s)})'];
const LUA_OUTPUT = Buffer.from('{"count":5,"sum":23,"max":9}\n');

interface Stage {
  passed: boolean;
  seconds: number;
  uptime_before: string;
  uptime_after: string;
}
export class Receipt {
  readonly path: string;
  readonly stages: Record<string, Stage> = {};
  readonly start = performance.now();

  constructor(path: string) {
    this.path = path;
    check(!existsSync(path), 'receipt already exists: ' + path);
    mkdirSync(path, { recursive: true });
  }

  async stage<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const before = load();
    const started = performance.now();
    let passed = false;
    try {
      const result = await fn();
      passed = true;
      return result;
    } finally {
      this.stages[label] = { passed, seconds: (performance.now() - started) / 1000, uptime_before: before, uptime_after: load() };
      dump(join(this.path, 'stages.json'), this.stages);
      console.log(label, this.stages[label].seconds.toFixed(3), 's');
    }
  }
}

export async function probe(name: string, out: string, source = probeSource(name)): Promise<string> {
  const obj = join(out, name + '.o');
  const elf = join(out, name + '.elf');
  const nr = slotNumber(name);
  check(nr !== undefined, 'missing kernel slot');
  const options = source.endsWith('.c') ? ['-ffreestanding', '-fno-builtin', '-fno-stack-protector', '-O1', '-DTARGET=' + nr] : [];
  await run(['clang', '--target=aarch64-none-elf', ...options, '-c', source, '-o', obj]);
  await run(['/opt/homebrew/bin/ld.lld', '-T', join(ASSETS, 'probe.ld'), obj, '-o', elf]);
  return elf;
}

export async function discover(image: string, dest: string, command?: string[]): Promise<SyscallRecord> {
  const started = performance.now();
  const before = load();
  let found: SyscallRecord | undefined;
  const result = await capture(command || hostCommand(image), {
    input: Buffer.from('ping\n'),
    holdStdin: true,
    timeout: 10,
    // Stop at the first missing or fatal record, but only once the launcher's
    // sandbox ack is in: the two streams are separate pipes, so a record can
    // be read before an ack written earlier, and killing then would lose it.
    onOutput: (raw, stderr) => {
      if (!stderr.includes(SANDBOX_ACK)) {
        return false;
      }
      const complete = raw.subarray(0, raw.lastIndexOf(10) + 1);
      const observed = observe(complete);
      if (observed.missing.length) {
        found = observed.missing[0];
      }
      return found !== undefined || observed.fatal_protocol.length > 0;
    },
  });
  writeFileSync(dest + '.stdout', result.stdout);
  writeFileSync(dest + '.stderr', result.stderr);
  dump(dest + '.json', { seconds: (performance.now() - started) / 1000, uptime_before: before, uptime_after: load(), missing: found ?? null, returncode: result.returncode, discovery_kill_expected: true });
  dump(dest + '.observations.json', observe(result.stdout));
  check(result.stderr.equals(SANDBOX_ACK), 'host-only sandbox ack required: ' + result.stderr.toString());
  check(found, 'no missing record in ' + dest);
  dump(dest + '.missing.json', found);
  return found;
}

export function validateSource(name: string, source: string): void {
  check([...source].length < 12000 && /^[a-z_][a-z_0-9]*$/.test(name), 'source size/handler name');
  check(!['unsafe', 'include!', 'include_str!', 'include_bytes!', 'extern ', 'std::', 'asm!', '#[path', 'mod '].some((token) => source.includes(token)), 'forbidden handler source');
  check(source.includes('pub fn call('), 'missing handler signature');
}

interface MutationRejection {
  name: string;
  rejected: boolean;
  reasons: Record<string, string>;
  source_sha256: string;
}
interface Acceptance {
  cases: Cases;
  visible_pass: boolean;
  heldout_pass: boolean | null;
  mutations: MutationRejection[];
  unchanged_integration: string;
  n: number;
  pass: number;
  repeat_counts_are_not_acceptance: boolean;
}
interface Contract {
  name: string;
  [key: string]: unknown;
}
export interface Manifest {
  version: number;
  contracts: Contract[];
  [key: string]: unknown;
}

export async function transaction(name: string, work: string, out: string, manifest: Manifest, samples: number, discovery: unknown, live = false, sqliteElf?: string, database?: string, spec: SpecLevel = 'full', attempts = 3): Promise<TransactionReport> {
  return await retryTransaction(name, work, out, manifest, live ? attempts : 1, (dest, history) => attempt(name, work, dest, manifest, samples, discovery, live, sqliteElf, database, spec, history));
}

async function attempt(name: string, work: string, out: string, manifest: Manifest, samples: number, discovery: unknown, live: boolean, sqliteElf: string | undefined, database: string | undefined, spec: SpecLevel, feedback: Feedback[]): Promise<TransactionReport> {
  const profile = PROFILES[name];
  const r = new Receipt(out);
  check(['semantic', 'error', 'state'].every((key) => profile.cases[key as keyof Cases].length > 0), 'independent cases required');
  dump(join(out, 'request.json'), discovery);
  const fixture = await r.stage('assemble_probe', () => probe(name, out));
  const tree = name === 'fstat' || name === 'pread64' ? resources(out) : undefined;
  const injections = name.startsWith('rt_sig') ? [name + ':error=ENOSYS'] : [];
  const refs = await r.stage('linux_oracle', () => oracle(fixture, [name], join(out, 'oracle'), profile.expected, { injections, resources: tree }));
  const reference = refs[0];
  const native = tree ? undefined : linux(readFileSync(join(out, 'oracle/linux-00.strace'), 'utf8'), Buffer.from(reference.stdout_hex, 'hex'), Buffer.alloc(0), 0);
  let hidden: { fixture: string; tree: string; reference: typeof reference } | undefined;
  if (profile.heldout) {
    const h = join(out, 'heldout');
    mkdirSync(h);
    check(!resolve(h).startsWith(resolve(work) + '/'), 'held-out probes must stay outside proposal repo');
    const source = profile.heldout;
    const fixture = await r.stage('assemble_heldout', () => probe(name, h, source));
    const tree = resources(h, true);
    const refs = await r.stage('heldout_linux_oracle', () => oracle(fixture, [name], join(h, 'oracle'), null, { resources: tree }));
    dump(join(h, 'sealed.json'), { source_sha256: sha(source), elf_sha256: sha(fixture), resource_sha256: treeHashes(tree), reference_sha256: sha(join(h, 'oracle/linux-summary.json')) });
    hidden = { fixture, tree, reference: refs[0] };
  }
  const value = await r.stage(live ? 'headless_cli' : 'recorded_proposal', () => proposal(name, work, out, discovery, live, spec, feedback));
  const source = await r.stage('source_validation', async () => {
    const source = validateProposal(name, value);
    validateSource(name, source);
    return source;
  });
  await r.stage('probe_constant_lint', async () => { requireNoProbeBranches(name, source); return true; });
  const handler = join(work, 'src/syscalls', name + '.rs');
  check(!existsSync(handler) && !isSymlink(handler), 'handler already exists or is a symlink');
  writeFileSync(handler, source);
  let signalLines = 0;
  for (const file of readdirSync(join(work, 'src/syscalls')).filter((file) => /^rt_sig.*\.rs$/.test(file))) {
    signalLines += readFileSync(join(work, 'src/syscalls', file), 'utf8').split(/\r?\n/).filter((line, i, lines) => i < lines.length - 1 || line.length > 0).length;
  }
  check(signalLines <= 350, 'signal handler line budget');
  dump(join(out, 'proposal.json'), { path: `src/syscalls/${name}.rs`, source, mode: live ? 'live' : 'replay' });
  const image = await r.stage('build_candidate', () => build(work, join(out, 'build'), fixture, [name], tree));
  async function verify(image: string, dest: string, expected: typeof reference, nativeExpected: typeof native | null): Promise<GuestInfo> {
    const result = await processGuest(hostCommand(image), dest);
    const observed = observe(result.raw);
    dump(dest + '.observations.json', observed);
    checkHost(result.info, result.err);
    requireResult(observed, expected);
    if (nativeExpected !== undefined && nativeExpected !== null) {
      compare(nativeExpected, guest(result.raw));
    }
    return result.info;
  }
  const times: number[] = [];
  for (let i = 0; i < samples; i += 1) {
    const info = await r.stage('semantic_error_state_' + i, () => verify(image, join(out, `vm-${String(i).padStart(2, '0')}`), reference, native));
    times.push(info.seconds * 1000);
  }
  async function verifyHidden(label: string): Promise<GuestInfo> {
    check(hidden, 'held-out fixture required');
    const h = hidden;
    const image = await r.stage('build_heldout_' + label, () => build(work, join(out, 'heldout', label), h.fixture, [name], h.tree));
    return await r.stage('heldout_' + label, () => verify(image, join(out, 'heldout', 'vm-' + label), h.reference, null));
  }
  if (hidden) {
    await verifyHidden('candidate');
  }
  if (tree) {
    const checks = await r.stage('independent_full_stat_and_state', () => hostHandlerTests(work, out));
    writeFileSync(join(out, 'host-handler-tests.log'), Buffer.concat([checks.stdout, checks.stderr]));
  }
  const rejected: MutationRejection[] = [];
  const variants = mutations(name, source);
  for (const label of Object.keys(variants)) {
    const broken = variants[label];
    check(broken !== source, 'mutation must alter source');
    try {
      writeFileSync(handler, broken);
      const mutant = await r.stage('build_mutant_' + label, () => build(work, join(out, 'mutant-' + label), fixture, [name], tree));
      const reasons: Record<string, string> = {};
      for (const gate of hidden ? ['visible', 'heldout'] : ['visible']) {
        const dest = gate === 'visible' ? join(out, 'mutation-' + label) : join(out, 'heldout', 'vm-' + label);
        try {
          if (gate === 'visible') {
            await verify(mutant, dest, reference, native);
          } else {
            await verifyHidden(label);
          }
        } catch (error) {
          if (!(error instanceof GateError)) {
            throw error;
          }
          const observed = readJSON<Observations>(dest + '.observations.json');
          const hostInfo = readJSON<GuestInfo>(dest + '.json');
          checkHost(hostInfo, readFileSync(dest + '.stderr'));
          check(!hostInfo.timeout && observed.trace_complete, 'crash/protocol failure is not semantic mutation evidence');
          reasons[gate] = detail(error);
        }
      }
      check(Object.hasOwn(reasons, 'visible'), 'mutation survived visible probe: ' + label);
      check(!hidden || Object.hasOwn(reasons, 'heldout'), 'mutation survived held-out probe: ' + label);
      rejected.push({ name: label, rejected: true, reasons, source_sha256: sha(handler) });
    } finally {
      writeFileSync(handler, source);
    }
  }
  check(rejected.length >= 2, 'at least two semantic mutant rejections required');
  dump(join(out, 'mutations.json'), rejected);
  let app: IntegrationResult;
  if (name === 'fstat' || name === 'pread64') {
    check(sqliteElf && database, 'SQLite integration inputs are required');
    app = await r.stage('unchanged_sqlite', () => integration(work, join(out, 'integration'), sqliteElf, database, oracle));
  } else {
    const elf = name === 'ppoll' ? join(CANONICAL, 'payload/qjs') : join(ASSETS, 'payload/lua-static');
    const argv = name === 'ppoll' ? QJS_ARGV : LUA_ARGV;
    const expected = name === 'ppoll' ? Buffer.from('reply:ping\n') : LUA_OUTPUT;
    const data = name === 'ppoll' ? Buffer.from('ping\n') : Buffer.alloc(0);
    await r.stage('integration_linux', () => oracle(elf, argv, join(out, 'integration-linux'), expected, { data }));
    const appImage = await r.stage('integration_build', () => build(work, join(out, 'integration'), elf, argv));
    const result = await processGuest(hostCommand(appImage), join(out, 'integration-run'), data);
    checkHost(result.info, result.err);
    const observed = observe(result.raw);
    dump(join(out, 'integration.observations.json'), observed);
    requireResult(observed, { stdout_hex: expected.toString('hex'), stderr_hex: '', exit: 0 }, name.startsWith('rt_sig') ? [134, 135] : []);
    app = { status: 'PASS', elf_sha256: sha(elf), argv };
  }
  manifest.version += 1;
  manifest.contracts = manifest.contracts.filter((contract) => contract.name !== name);
  const evidence: Acceptance = { cases: profile.cases, visible_pass: true, heldout_pass: hidden ? true : null, mutations: rejected, unchanged_integration: app.status, n: samples, pass: samples, repeat_counts_are_not_acceptance: true };
  manifest.contracts.push({ nr: profile.nr, name, source_sha256: sha(handler), status: injections.length ? 'profile-enosys' : 'restricted', oracle: 'native Linux' + (injections.length ? ' with explicit ENOSYS injection' : ''), full_linux_abi_equivalence: false, gate: evidence });
  dump(join(out, 'acceptance.json'), evidence);
  dump(join(work, 'syscalls.manifest.json'), manifest);
  await run(['git', 'add', `src/syscalls/${name}.rs`, 'syscalls.manifest.json'], { cwd: work });
  await run(['git', 'commit', '-qm', 'grow ' + name + ' after semantic, mutation and integration gates'], { cwd: work });
  const commit = (await run(['git', 'rev-parse', 'HEAD'], { cwd: work })).stdout.toString().trim();
  const report = { name, mode: live ? 'live' : 'replay', gate: 'PASS', acceptance: evidence, seconds: (performance.now() - r.start) / 1000, stages: r.stages, benchmark: distribution(times), commit };
  dump(join(out, 'report.json'), report);
  return report;
}

function isSymlink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}

export async function installationPatch(base: string, updated: string, names: string[]): Promise<string> {
  let patch = '';
  for (const name of names) {
    const old = join(base, name);
    const next = join(updated, name);
    const present = existsSync(old);
    const before = present ? readFileSync(old, 'utf8') : '';
    if (before === readFileSync(next, 'utf8')) {
      continue;
    }
    const diff = await capture(['diff', '-u', '-L', present ? 'a/' + name : '/dev/null', '-L', 'b/' + name, present ? old : '/dev/null', next]);
    check(diff.returncode === 1, 'diff failed: ' + diff.stderr.toString());
    patch += `diff --git a/${name} b/${name}\n`;
    if (!present) {
      patch += 'new file mode 100644\n';
    }
    patch += diff.stdout.toString();
  }
  return patch;
}

export interface Arguments {
  runId: string;
  samples: number;
  spec: SpecLevel;
  attempts: number;
  target: string[];
  sqliteElf?: string;
  database?: string;
  validateOnly: boolean;
  live: boolean;
}

export function parseArgs(argv: string[]): Arguments {
  const result: Arguments = { runId: '', samples: 30, spec: 'full', attempts: 3, target: [], validateOnly: false, live: false };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--validate-only') {
      result.validateOnly = true;
    } else if (flag === '--live') {
      result.live = true;
    } else if (flag === '--fast') {
      // Retained for compatibility with the Python demo; no artificial pauses.
    } else {
      check(['--run-id', '--samples', '--target', '--sqlite-elf', '--database', '--spec', '--attempts'].includes(flag), 'unknown argument: ' + flag);
      check(i + 1 < argv.length, 'missing argument: ' + flag);
      const value = argv[++i];
      if (flag === '--run-id') {
        result.runId = value;
      } else if (flag === '--samples') {
        result.samples = Number(value);
      } else if (flag === '--spec') {
        check(['full', 'terse', 'none'].includes(value), 'invalid spec');
        result.spec = value as SpecLevel;
      } else if (flag === '--attempts') {
        result.attempts = Number(value);
        check([1, 2, 3].includes(result.attempts), 'attempts must be 1..3');
      } else if (flag === '--target') {
        check(Object.hasOwn(PROFILES, value), 'unsupported target: ' + value);
        result.target.push(value);
      } else if (flag === '--sqlite-elf') {
        result.sqliteElf = resolve(value);
      } else if (flag === '--database') {
        result.database = resolve(value);
      }
    }
  }
  check(/^[a-zA-Z0-9_-]+$/.test(result.runId), '--run-id is required and must be alphanumeric, underscore or hyphen');
  check(Number.isInteger(result.samples) && result.samples >= 1, '--samples must be a positive integer');
  check(new Set(result.target).size === result.target.length, 'duplicate target');
  check(!result.target.some((name) => name === 'fstat' || name === 'pread64') || result.sqliteElf && result.database, '--sqlite-elf and --database are required for SQLite integration');
  return result;
}

export async function execute(args: Arguments, temporary: string): Promise<void> {
  const r = new Receipt(join(ROOT, 'results', args.runId));
  const out = r.path;
  const work = join(temporary, 'kernel');
  const copied = await r.stage('copy_kernel', async () => copyKernel(work));
  rmSync(join(work, 'tests'), { recursive: true, force: true });
  selectHost();
  selectGate();
  const hostHash = sha(host());
  dump(join(out, 'source.json'), { path: copied.source, files: copied.hashes });
  const targets = args.target.length ? args.target : ['ppoll', 'rt_sigaction', 'rt_sigprocmask'];
  const manifest = readJSON<Manifest>(join(work, 'syscalls.manifest.json'));
  for (const command of [['git', 'init', '-q'], ['git', 'config', 'user.name', 'jitk grow'], ['git', 'config', 'user.email', 'jitk@example.invalid'], ['git', 'add', '.'], ['git', 'commit', '-qm', 'isolated canonical source']]) {
    await run(command, { cwd: work });
  }
  const transactions: unknown[] = [];
  for (const name of targets) {
    const handler = join(work, 'src/syscalls', name + '.rs');
    if (existsSync(handler)) {
      unlinkSync(handler);
    }
    manifest.contracts = manifest.contracts.filter((contract) => contract.name !== name);
    dump(join(work, 'syscalls.manifest.json'), manifest);
    await run(['git', 'add', '-u'], { cwd: work });
    await run(['git', 'commit', '--allow-empty', '-qm', 'isolated seed without ' + name], { cwd: work });
    let request: unknown;
    if (args.target.length) {
      request = { nr: PROFILES[name].nr, name, reason: 'explicit target; registration is not acceptance' };
    } else {
      const elf = name === 'ppoll' ? join(CANONICAL, 'payload/qjs') : join(ASSETS, 'payload/lua-static');
      const argv = name === 'ppoll' ? QJS_ARGV : LUA_ARGV;
      const image = await build(work, join(out, 'before-' + name), elf, argv);
      const discovered = await discover(image, join(out, 'before-' + name));
      check(discovered.nr === PROFILES[name].nr, 'unexpected discovered target');
      request = discovered;
    }
    transactions.push(await transaction(name, work, join(out, 'tx-' + name), manifest, args.samples, request, args.live, args.sqliteElf, args.database, args.spec, args.attempts));
  }
  const names = [...targets.map((name) => `src/syscalls/${name}.rs`), 'syscalls.manifest.json'];
  writeFileSync(join(out, 'owner.patch'), await installationPatch(copied.source, work, names));
  copyFileSync(join(work, 'syscalls.manifest.json'), join(out, 'syscalls.manifest.json'));
  await run(['git', 'bundle', 'create', join(out, 'accepted.bundle'), 'HEAD'], { cwd: work });
  check(equal(treeHashes(copied.source), copied.hashes), 'canonical source changed during verification');
  check(sha(host()) === hostHash, 'VMM changed during verification');
  const controllerHashes: Record<string, string> = {};
  for (const name of ['loop.ts', 'profiles.ts', 'observations.ts']) {
    controllerHashes[name] = sha(join(ROOT, name));
  }
  const report = { gate: 'PASS', mode: args.live ? 'live' : 'replay', targets, transactions, seconds: (performance.now() - r.start) / 1000, uptime: load(), host_sha256: hostHash, canonical_unchanged: true, controller_sha256: controllerHashes };
  dump(join(out, 'report.json'), report);
  // Keep promotion behavior compatible, but all invocations in this task use validateOnly.
  if (!args.validateOnly) {
    dump(join(ROOT, 'release.json'), { run: args.runId, report: `results/${args.runId}/report.json` });
    dump(join(ROOT, '.READY'), { run: args.runId, canonical_source_files: copied.hashes, report: `results/${args.runId}/report.json` });
  }
  console.log(JSON.stringify(report, null, 2));
}

export async function main(argv: string[]): Promise<void> {
  if (argv.includes('--help')) {
    console.log('grow --run-id ID --validate-only [--live] [--target NAME ...] [--samples N] [--spec full|terse|none] [--attempts 1|2|3] [--sqlite-elf PATH --database PATH] [--fast]');
    return;
  }
  const args = parseArgs(argv);
  console.log('GROW MODE: ' + (args.live ? 'LIVE headless agent CLI' : 'REPLAY canonical handler source'));
  const temporary = scratch();
  try {
    await execute(args, temporary);
  } finally {
    cleanup(temporary);
  }
}
