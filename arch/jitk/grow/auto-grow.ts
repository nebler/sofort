import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { check, capture, csvDecode, csvEncode, detail, diskSpace, dump, equal, readJSON, readOr, run, SAFE_ENV, sha, load, pythonShuffle } from './lib.ts';
import { ROOT, CANONICAL, build, cleanup, copyKernel, checkHost, hostCommand, processGuest, scratch, selectHost, treeHashes } from './runtime.ts';
import { emit, generate } from './autoprofile.ts';
import { learn, normalizeAuto, type Learned } from './auto-observe.ts';
import { oracle } from './oracle.ts';
import { probe, Receipt, validateSource, type Manifest } from './loop.ts';
import { proposal, validateProposal } from './agent.ts';
import { retryTransaction, type TransactionReport, type Feedback } from './retries.ts';
import { observe, requireResult } from './observations.ts';
import { integration } from './sqlite-profile.ts';
import { FIELDS, markers, controllerHashes, textCommand } from './experiment-run.ts';

const TARGETS = ['getrandom', 'uname', 'faccessat', 'getpid', 'sched_getaffinity', 'madvise'];
interface Fixture { elf: string; resources: string; source: string; oracle: string; learned: Learned }
interface Plan { target: string; nr: number; fixtures: Fixture[]; hashes: Record<string, string> }
function arg(argv: string[], flag: string, fallback = ''): string { const i = argv.indexOf(flag); return i < 0 ? fallback : argv[i + 1]; }

async function prepare(argv: string[]): Promise<void> {
  const out = resolve(arg(argv, '--profiles')); check(!existsSync(out), 'profiles already exist'); mkdirSync(out, { recursive: true });
  const traces = [resolve(ROOT, '../../research/native-census/raw/sqlite3/full.strace'), resolve(ROOT, '../../research/native-census/raw/qsv/full.strace'), resolve(ROOT, '../../research/native-census/raw/rg/full.strace'), resolve(arg(argv, '--fresh') + '/qjs/linux-00.strace'), resolve(arg(argv, '--fresh') + '/sqlite/linux-00.strace')];
  const slots = readJSON<Record<string, string>>(join(CANONICAL, 'slots.json'));
  for (const target of TARGETS) {
    await diskSpace(); const dest = join(out, target); mkdirSync(dest);
    const nr = Number(Object.keys(slots).find((key) => slots[key] === target)); check(Number.isInteger(nr), 'slot required');
    const profile = generate(target, nr, traces); emit(profile, dest);
    const fixtures: Fixture[] = [], hashes: Record<string, string> = {};
    for (const split of ['visible', 'heldout']) {
      const d = join(dest, split); mkdirSync(d); const resources = join(d, 'resources'); mkdirSync(resources);
      copyFileSync(arg(argv, '--database'), join(resources, 'data.bin'));
      const source = join(dest, split + '.c'); const elf = await probe(target, d, source);
      const oraclePath = join(d, 'oracle'); const refs = await oracle(elf, [target], oraclePath, null, { resources, samples: 2 });
      const learned = learn(refs); dump(join(d, 'expected.json'), learned);
      fixtures.push({ elf, resources, source, oracle: oraclePath, learned });
      for (const p of [source, elf, join(resources, 'data.bin'), join(d, 'expected.json'), join(oraclePath, 'linux-summary.json')]) hashes[p] = sha(p);
    }
    dump(join(dest, 'plan.json'), { target, nr, fixtures, hashes });
    console.log('PROFILE', target, profile.visible.length, profile.heldout.length, fixtures.map((f) => f.learned.rules.filter((r) => r !== 'exact').length).join('/'));
  }
  dump(join(out, 'pins.json'), { source: controllerHashes(), kernel: treeHashes(CANONICAL), disk: await diskSpace(), oracle_image: await textCommand(['docker', 'image', 'inspect', 'jitk-oracle:08', '--format', '{{.Id}}']), traces: traces.map((p) => ({ path: p, sha256: sha(p) })), fresh_programs: 'unchanged QuickJS event loop and unchanged SQLite aggregate query', normalization: 'two independent Linux executions learn varying positive scalars and byte extents; state/repeat observations remain exact' });
}

async function one(argv: string[]): Promise<void> {
  check(argv.includes('--validate-only'), '--validate-only required'); selectHost();
  const id = arg(argv, '--run-id'), target = arg(argv, '--target'); check(/^[\w-]+$/.test(id) && TARGETS.includes(target), 'run/target');
  const plan = readJSON<Plan>(join(resolve(arg(argv, '--profiles')), target, 'plan.json'));
  for (const p of Object.keys(plan.hashes)) check(sha(p) === plan.hashes[p], 'sealed generated profile changed');
  const root = join(ROOT, 'results', id); check(!existsSync(root), 'run exists'); mkdirSync(root);
  const tmp = scratch('jitk-auto-grow-');
  const before = markers();
  try {
    const work = join(tmp, 'kernel'), copied = copyKernel(work); rmSync(join(work, 'tests'), { recursive: true, force: true });
    dump(join(root, 'source.json'), copied); dump(join(root, 'sealed.json'), plan.hashes);
    const manifest = readJSON<Manifest>(join(work, 'syscalls.manifest.json'));
    manifest.contracts = manifest.contracts.filter((c) => c.name !== target); dump(join(work, 'syscalls.manifest.json'), manifest);
    for (const command of [['git', 'init', '-q'], ['git', 'config', 'user.name', 'jitk grow'], ['git', 'config', 'user.email', 'jitk@example.invalid'], ['git', 'add', '.'], ['git', 'commit', '-qm', 'isolated automatic-profile seed']]) await run(command, { cwd: work });
    const report = await retryTransaction(target, work, join(root, 'tx-' + target), manifest, 3, async (out: string, history: Feedback[]) => {
      const r = new Receipt(out), visible = plan.fixtures[0];
      mkdirSync(join(out, 'oracle')); copyFileSync(join(visible.oracle, 'linux-00.strace'), join(out, 'oracle/linux-00.strace'));
      const value = await r.stage('headless_cli', () => proposal(target, work, out, { nr: plan.nr, name: target }, true, 'none', history, visible.source));
      const source = await r.stage('source_validation', async () => { const source = validateProposal(target, value); validateSource(target, source); return source; });
      dump(join(out, 'proposal.json'), { path: 'src/syscalls/' + target + '.rs', source });
      const handler = join(work, 'src/syscalls', target + '.rs'); writeFileSync(handler, source);
      async function verify(image: string, dest: string, fixture: Fixture): Promise<boolean> {
        const result = await processGuest(hostCommand(image), dest); checkHost(result.info, result.err);
        const observed = observe(result.raw); dump(dest + '.observations.json', observed);
        check(!result.info.timeout && observed.trace_complete, 'complete guest protocol required');
        observed.stdout_hex = normalizeAuto(observed.stdout_hex, fixture.learned.rules);
        requireResult(observed, fixture.learned.expected); return true;
      }
      const image = await r.stage('build_candidate', () => build(work, join(out, 'build'), visible.elf, [target], visible.resources));
      for (let i = 0; i < 30; i += 1) await r.stage('semantic_error_state_' + i, () => verify(image, join(out, 'vm-' + String(i).padStart(2, '0')), visible));
      const hidden = plan.fixtures[1];
      const hiddenImage = await r.stage('build_heldout_candidate', () => build(work, join(out, 'heldout-build'), hidden.elf, [target], hidden.resources));
      await r.stage('heldout_candidate', () => verify(hiddenImage, join(out, 'heldout-vm'), hidden));
      // Universal wrong-return mutations, independent of any syscall semantics.
      for (const wrong of [-38, -123]) {
        writeFileSync(handler, 'pub fn call(_: &[usize]) -> isize {' + wrong + '}');
        const mutant = await r.stage('build_mutant_' + wrong, () => build(work, join(out, 'mutant-' + wrong), hidden.elf, [target], hidden.resources));
        const result = await processGuest(hostCommand(mutant), join(out, 'mutant-vm-' + wrong)); checkHost(result.info, result.err);
        const observed = observe(result.raw); check(!result.info.timeout && observed.trace_complete, 'crash is not mutation rejection');
        let rejected = false;
        try { observed.stdout_hex = normalizeAuto(observed.stdout_hex, hidden.learned.rules); requireResult(observed, hidden.learned.expected); } catch { rejected = true; }
        check(rejected, 'mutation survived generated profile');
      }
      writeFileSync(handler, source); dump(join(out, 'mutations.json'), [-38, -123]);
      let app = 'no runnable unchanged integration; generated oracle differential + held-out';
      if (['getpid', 'faccessat'].includes(target)) {
        await r.stage('unchanged_sqlite', () => integration(work, join(out, 'integration'), arg(argv, '--sqlite-elf'), arg(argv, '--database'), oracle)); app = 'SQLite 10/10';
      }
      const evidence = { visible_pass: true, heldout_pass: true, mutations: [-38, -123], unchanged_integration: app, generated_profile_sha256: sha(join(resolve(arg(argv, '--profiles')), target, 'plan.json')) };
      dump(join(out, 'acceptance.json'), evidence); dump(join(root, 'accepted.json'), { source, evidence });
      return { name: target, gate: 'PASS', acceptance: evidence };
    });
    dump(join(root, 'report.json'), report);
    check(equal(treeHashes(CANONICAL), copied.hashes), 'canonical changed during transaction');
  } finally { check(equal(markers(), before), 'release marker changed'); cleanup(tmp); }
}

async function batch(argv: string[]): Promise<void> {
  check(argv.includes('--validate-only'), '--validate-only required');
  const prefix = arg(argv, '--run-id'), out = join(ROOT, 'results', prefix); mkdirSync(out, { recursive: true });
  const cells: { id: string; target: string; model: string }[] = [];
  for (const target of TARGETS) for (const model of ['gpt-6-sol', 'gpt-6.1-sol']) for (let n = 1; n <= 5; n += 1) cells.push({ id: prefix + '-' + target + '-' + (model === 'gpt-6-sol' ? 'old' : 'new') + '-' + n, target, model });
  pythonShuffle(cells, 20261026);
  const pins = { date: new Date().toISOString(), cli: await textCommand(['codex', '--version']), controller_sha256: controllerHashes(), kernel: treeHashes(CANONICAL), protected: markers(), disk_before: await diskSpace(), uptime_before: load(), vmm_sha256: sha(arg(argv, '--vmm')), oracle_image: await textCommand(['docker', 'image', 'inspect', 'jitk-oracle:08', '--format', '{{.Id}}']), seed: 20261026, n_per_cell: 5, workers: 2, cells };
  const prior = readOr<Record<string, unknown> | null>(join(out, 'pins.json'), null);
  if (prior) for (const key of ['controller_sha256', 'kernel', 'protected', 'vmm_sha256', 'oracle_image', 'cells']) check(equal(prior[key], (pins as Record<string, unknown>)[key]), 'resume pins changed: ' + key);
  if (!prior) dump(join(out, 'pins.json'), pins); let next = 0, halt = false;
  const rows: Record<string, unknown>[] = existsSync(join(out, 'E3.csv')) ? csvDecode(readFileSync(join(out, 'E3.csv'), 'utf8')) : [];
  async function worker(): Promise<void> {
    while (!halt && next < cells.length) {
      const cell = cells[next++]; const disk = await diskSpace();
      const dest = join(ROOT, 'results', cell.id), tx = join(dest, 'tx-' + cell.target);
      if (existsSync(join(tx, 'report.json')) && !existsSync(join(tx, 'paused.json')) && rows.some((r) => r.run_id === cell.id)) continue;
      if (existsSync(dest)) {
        // Preserve interrupted/quota receipts and expense, then restart this
        // unsampled cell; subscription failures are not candidate attempts.
        renameSync(dest, dest + '-paused-' + Date.now());
        for (let i = rows.length - 1; i >= 0; i -= 1) if (rows[i].run_id === cell.id) rows.splice(i, 1);
      }
      const command = [join(ROOT, 'build/auto-grow'), 'one', '--run-id', cell.id, '--validate-only', '--target', cell.target, '--profiles', arg(argv, '--profiles'), '--sqlite-elf', arg(argv, '--sqlite-elf'), '--database', arg(argv, '--database')];
      const result = await capture(command, { env: { ...SAFE_ENV, JITK_VMM_BINARY: arg(argv, '--vmm'), JITK_GROW_MODEL: cell.model }, timeout: 1800 });
      mkdirSync(dest, { recursive: true });
      writeFileSync(join(dest, 'driver.log'), Buffer.concat([result.stdout, result.stderr]));
      dump(join(dest, 'experiment.json'), { command, model: cell.model, returncode: result.returncode, disk_before: disk, disk_after: await diskSpace(), controller_sha256: pins.controller_sha256, vmm_sha256: pins.vmm_sha256, oracle_image: pins.oracle_image });
      const report = readJSON<{ accepted: boolean; attempts: Feedback[] }>(join(tx, 'report.json'));
      for (const a of report.attempts) {
        const d = join(tx, 'attempt-' + a.attempt), stages = readJSON<Record<string, { passed: boolean }>>(join(d, 'stages.json'));
        const visible = Object.keys(stages).filter((s) => s.startsWith('semantic_error_state_'));
        const source = readOr<{ source: string }>(join(d, 'agent.json'), { source: '' }).source;
        rows.push({ run_id: cell.id, date: pins.date, host: 'macOS/HVF', model: cell.model, cli: pins.cli, spec_level: 'none', target: cell.target, attempt: a.attempt, accepted: Number(a.accepted), rejecting_gate: a.accepted ? '' : a.gate, visible_pass: visible.length === 30 ? Number(visible.every((s) => stages[s].passed)) : visible.some((s) => !stages[s].passed) ? 0 : 'not_reached', heldout_pass: stages.heldout_candidate ? Number(stages.heldout_candidate.passed) : 'not_reached', mutants_rejected: readOr<unknown[]>(join(d, 'mutations.json'), []).length, integration_pass: a.accepted ? (['getpid', 'faccessat'].includes(cell.target) ? 1 : 'not_available') : 'not_reached', wall_s: a.wall_s, cli_calls: existsSync(join(d, 'agent-mode.json')) ? 1 : 0, human_minutes: 0, handler_lines: source.trimEnd().split('\n').length, human_lines: 0 });
      }
      writeFileSync(join(out, 'E3.csv'), csvEncode(rows, FIELDS));
      halt = halt || existsSync(join(tx, 'paused.json')); console.log(cell.id, report.accepted ? 'PASS' : halt ? 'PAUSED' : 'FAIL');
      check(equal(markers(), pins.protected), 'release markers changed');
    }
  }
  const workers: Promise<void>[] = []; workers.push(worker()); workers.push(worker());
  const results = await Promise.allSettled(workers);
  dump(join(out, 'summary.json'), { completed: new Set(rows.map((r) => r.run_id)).size, design: cells.length, rows: rows.length, accepted: rows.filter((r) => Number(r.accepted) === 1).length, paused: halt, disk_after: await diskSpace(), uptime_after: load(), protected_after: markers() });
  for (const result of results) if (result.status === 'rejected') throw new Error(detail(result.reason));
  check(!halt && next === 60, 'paused/incomplete: resume without reducing N');
}

async function main(argv: string[]): Promise<void> {
  if (argv[0] === 'prepare') await prepare(argv);
  else if (argv[0] === 'one') await one(argv);
  else if (argv[0] === 'batch') await batch(argv);
  else throw new Error('auto-grow prepare|one|batch; one/batch require --validate-only');
}
main(process.argv.slice(2)).catch((error: unknown) => { console.error(detail(error)); process.exitCode = 1; });
