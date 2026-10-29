// GrowOS Phase 2: grow the syscalls scriptc corpus programs need, behind
// generated sealed profiles plus visible and held-out corpus integration.
//   traces   compile visible corpus programs that use each target and record
//            annotated Linux traces (shape seeds only; never shown to a proposer)
//   prepare  autoprofile + two separate-container Linux calibrations per split
//   one      one transaction (codex, spec none, <=3 attempts), --validate-only
//   batch    targets in order; each accepted handler joins later transactions
// Accepted handlers accumulate in <batch>/accepted/<name>.rs. Nothing here
// installs, promotes or writes release markers.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { check, capture, csvEncode, detail, diskSpace, dump, equal, files, readJSON, readOr, run, SAFE_ENV, sha } from './lib.ts';
import { ROOT, CANONICAL, build, slotNumber, cleanup, copyKernel, checkHost, hostCommand, processGuest, scratch, selectHost, treeHashes } from './runtime.ts';
import { emit, generate } from './autoprofile.ts';
import { learn, normalizeAuto, varyingIdentities, type Learned } from './auto-observe.ts';
import { oracle, requireSameTree, SHARED_TREE_MODE, type Oracle } from './oracle.ts';
import { removeUnpacked } from '../kernel/packer.ts';
import { probe, Receipt, validateSource, type Manifest } from './loop.ts';
import { proposal, validateProposal } from './agent.ts';
import { retryTransaction, type Feedback } from './retries.ts';
import { observe, requireResult, type Outcome } from './observations.ts';
import { integration } from './sqlite-profile.ts';
import { markers, controllerHashes, textCommand } from './experiment-run.ts';
import { zigPath } from '../tslib/deps.ts';

const CORPUS_ROOT = resolve(ROOT, '../scriptc-corpus');
const CORPUS_WORK = join(CORPUS_ROOT, '.work');
const CENSUS = join(CORPUS_WORK, 'bin/census');
const MODEL = 'gpt-6.1-sol';
// Order matters: later transactions build on earlier accepted handlers.
export const TARGETS = ['mmap', 'getrandom', 'uname', 'getpid', 'faccessat', 'sysinfo', 'getrusage', 'getpriority', 'getppid', 'nanosleep', 'statfs', 'unlinkat', 'mkdirat', 'chdir'];
const SEED_PROGRAMS = 3;
// jitk guest RAM (vmm --mem 32); Linux calibrations get the same address-space limit.
const GUEST_KIB = 32 * 1024;
// Targets seeded from scriptc corpus traces only.
const SCRIPTC_ONLY = ['mmap'];
const CALIBRATION_GAP_MS = 6000;
const FIELDS = 'run_id,date,model,cli,spec_level,target,attempt,accepted,rejecting_gate,visible_pass,heldout_pass,mutants_rejected,sqlite_pass,corpus_visible,corpus_visible_new_pass,corpus_visible_regressions,corpus_heldout,corpus_heldout_new_pass,corpus_heldout_regressions,wall_s,cli_calls,handler_lines,human_lines'.split(',');
// tree: SHA-256 of the archive jitk embeds for `resources`; the Linux calibrations
// ran chrooted into that same tree (oracle.ts shared tree). Compared before every
// guest result is graded.
interface Fixture { elf: string; resources: string; source: string; oracle: string; learned: Learned; tree: string }
interface Plan { target: string; nr: number; fixtures: Fixture[]; hashes: Record<string, string>; oracle_fs?: string }
interface CorpusRow { name: string; jitk: string; tier: string }
function arg(argv: string[], flag: string, fallback = ''): string { const i = argv.indexOf(flag); return i < 0 ? fallback : argv[i + 1]; }

// scriptc child-wait stall: the child exits but its close event only arrives when
// capture's kill timer fires (rc=0 plus timeout). That is infrastructure, never a
// gate decision, so the oracle step is retried once and the stall is recorded.
const robustOracle: Oracle = async (elf, argv, out, expected, options) => {
  try { return await oracle(elf, argv, out, expected, options); }
  catch (error) {
    if (!/rc=0 timeout/.test(detail(error))) throw error;
    writeFileSync(out + '.child-wait-stall.txt', detail(error).slice(0, 2000));
    removeUnpacked(out);
    return await oracle(elf, argv, out, expected, options);
  }
};

// Visible programs only: census.csv excludes held-out names by construction.
export function seedPrograms(csv: string, target: string, count = SEED_PROGRAMS): string[] {
  const rows = csv.trim().split('\n').slice(1).map((line) => line.slice(1, -1).split('","'));
  // census.csv columns: program,tier,build,diagnostic,node,stock_loader,jitk,cause,linux_missing,...
  const usable = rows.filter((r) => r[2] === 'compiled' && r[4] === 'match');
  const chosen = target === 'mmap'
    ? usable.filter((r) => r[1] === 'T1' && r[7] === 'divergent:mmap:-22')
    : usable.filter((r) => r[8].split(';').includes(target));
  return chosen.map((r) => r[0]).sort().slice(0, count);
}

async function compileProgram(name: string, elf: string): Promise<void> {
  const zig = zigPath();
  const env: Record<string, string> = { ...SAFE_ENV, PATH: dirname(zig) + ':' + (process.env.PATH || '/usr/bin:/bin'), HOME: process.env.HOME || '/tmp',
    SCRIPTC_TARGET: 'aarch64-linux-musl', SCRIPTC_RUNTIME_PACK: join(ROOT, '../tools/node_modules/@scriptc/runtime-linux-arm64-musl'),
    SCRIPTC_LINKER: join(CORPUS_ROOT, 'zig-link.sh'), SCRIPTC_CACHE_DIR: join(CORPUS_WORK, 'cache'), ZIG: zig };
  const source = join(CORPUS_WORK, 'source');
  const result = await capture([join(ROOT, '../tools/node_modules/.bin/scriptc'), 'build', join(source, 'tests/corpus', name), '-o', elf], { cwd: source, env, timeout: 60 });
  check(result.returncode === 0 && existsSync(elf), 'corpus compile failed: ' + name + ' ' + result.stderr.toString().slice(0, 400));
}

async function traces(argv: string[]): Promise<void> {
  const out = resolve(arg(argv, '--out')); mkdirSync(out, { recursive: true });
  const csv = readFileSync(join(CORPUS_ROOT, 'census.csv'), 'utf8');
  const targets = arg(argv, '--targets') ? arg(argv, '--targets').split(',') : TARGETS;
  const index: Record<string, string[]> = readOr(join(out, 'index.json'), {});
  for (const target of targets) {
    await diskSpace();
    const names = seedPrograms(csv, target);
    index[target] = [];
    for (let i = 0; i < names.length; i += 1) {
      const dest = join(out, target, String(i));
      if (!existsSync(join(dest, 'oracle/linux-00.strace'))) {
        mkdirSync(dest, { recursive: true });
        await compileProgram(names[i], join(dest, 'program'));
        // A corpus program may fail without its fixtures; only its syscall shapes are used.
        try { await robustOracle(join(dest, 'program'), [names[i]], join(dest, 'oracle'), null, { annotate: true, data: Buffer.alloc(0) }); }
        catch (error) { writeFileSync(join(dest, 'oracle-error.txt'), detail(error)); }
        rmSync(join(dest, 'program'), { force: true });
      }
      if (existsSync(join(dest, 'oracle/linux-00.strace'))) index[target].push(join(dest, 'oracle/linux-00.strace'));
    }
    dump(join(out, 'index.json'), index);
    console.log('TRACES', target, names.length, index[target].length);
  }
}

async function prepare(argv: string[]): Promise<void> {
  const out = resolve(arg(argv, '--profiles')); mkdirSync(out, { recursive: true });
  const index = readJSON<Record<string, string[]>>(join(resolve(arg(argv, '--traces')), 'index.json'));
  const fresh = resolve(arg(argv, '--fresh'));
  const common = [resolve(ROOT, '../../research/native-census/raw/sqlite3/full.strace'), resolve(ROOT, '../../research/native-census/raw/qsv/full.strace'), resolve(ROOT, '../../research/native-census/raw/rg/full.strace'), join(fresh, 'qjs/linux-00.strace'), join(fresh, 'sqlite/linux-00.strace')];
  const targets = arg(argv, '--targets') ? arg(argv, '--targets').split(',') : TARGETS;
  for (const target of targets) {
    const dest = join(out, target);
    if (existsSync(join(dest, 'plan.json'))) continue;
    await diskSpace(); removeUnpacked(dest); mkdirSync(dest);
    const nr = Number(slotNumber(target)); check(Number.isInteger(nr), 'slot required: ' + target);
    // mmap is seeded from scriptc traces only: the native-census traces add Rust
    // std MAP_FIXED guard pages at absolute addresses of another process.
    const sources = [...(index[target] || []), ...(SCRIPTC_ONLY.includes(target) ? [] : common)];
    let profile;
    try { profile = generate(target, nr, sources); }
    catch (error) { dump(join(dest, 'unsupported.json'), { target, reason: detail(error) }); console.log('PROFILE', target, 'UNSUPPORTED', detail(error)); continue; }
    emit(profile, dest);
    const fixtures: Fixture[] = [], hashes: Record<string, string> = {}, runs: Outcome[][] = [];
    for (const split of ['visible', 'heldout']) {
      const d = join(dest, split); mkdirSync(d); const resources = join(d, 'resources'); mkdirSync(resources);
      // Tree-variant audit (--heldout-tree variant): the held-out split runs on a
      // different archive, where data.bin is a directory holding the database and
      // an empty directory sits beside it. Expected values are still learned from
      // Linux on that tree; a handler that special-cases the visible tree's names
      // fails there. Default: both splits use { data.bin }.
      if (split === 'heldout' && arg(argv, '--heldout-tree') === 'variant') {
        mkdirSync(join(resources, 'data.bin')); mkdirSync(join(resources, 'empty'));
        copyFileSync(arg(argv, '--database'), join(resources, 'data.bin', 'data.bin'));
      } else copyFileSync(arg(argv, '--database'), join(resources, 'data.bin'));
      const source = join(dest, split + '.c'); const elf = await probe(target, d, source);
      // Two calibrations in two containers, so container identity (hostname,
      // pid numbering) shows up as variation instead of a pinned constant.
      const oraclePath = join(d, 'oracle');
      // Linux runs with the guest's capacity (32 MiB of address space), so a
      // reservation the guest cannot back fails on both sides, and on the guest's
      // file tree: chrooted into the materialised archive of `resources`.
      const a = await robustOracle(elf, [target], oraclePath, null, { tree: resources, memoryKib: GUEST_KIB });
      // Spaced calibrations: values that change slowly (uptime seconds, load averages
      // refreshed every 5 s) must show up as variation rather than be pinned.
      await new Promise<void>((done) => setTimeout(done, CALIBRATION_GAP_MS));
      const b = await robustOracle(elf, [target], join(d, 'oracle-2'), null, { tree: resources, memoryKib: GUEST_KIB });
      runs.push([a[0], b[0]]);
      const tree = readJSON<{ sha256: string }>(join(oraclePath, 'tree.json')).sha256;
      check(readJSON<{ sha256: string }>(join(d, 'oracle-2/tree.json')).sha256 === tree, 'calibrations ran on different trees');
      fixtures.push({ elf, resources, source, oracle: oraclePath, learned: learn([a[0], b[0]]), tree });
    }
    // Identity labels that varied in either split are identities in both.
    const identities = varyingIdentities(fixtures.map((f) => f.learned), runs.map((r) => r[0]));
    for (let i = 0; i < fixtures.length; i += 1) {
      const d = join(dest, i ? 'heldout' : 'visible'), f = fixtures[i];
      f.learned = learn(runs[i], identities); dump(join(d, 'expected.json'), f.learned);
      for (const p of [f.source, f.elf, ...files(f.resources), join(d, 'expected.json'), join(f.oracle, 'linux-summary.json'), join(d, 'oracle-2/linux-summary.json'), join(f.oracle, 'tree.json'), join(d, 'oracle-2/tree.json')]) hashes[p] = sha(p);
    }
    dump(join(dest, 'plan.json'), { target, nr, fixtures, hashes, oracle_fs: SHARED_TREE_MODE, heldout_tree: arg(argv, '--heldout-tree', 'same'), seeds: sources.map((p) => ({ path: p, sha256: sha(p) })) });
    console.log('PROFILE', target, profile.visible.length, profile.heldout.length, fixtures.map((f) => f.learned.rules.filter((r) => r !== 'exact').length).join('/'));
  }
  dump(join(out, 'pins.json'), { source: controllerHashes(), kernel: treeHashes(CANONICAL), disk: await diskSpace(), oracle_image: await textCommand(['docker', 'image', 'inspect', 'jitk-oracle:08', '--format', '{{.Id}}']), oracle_fs: SHARED_TREE_MODE, oracle_root_sha256: sha(join(ROOT, 'build/oracle-root')), normalization: 'two Linux executions in separate containers, address space limited to the 32 MiB guest; varying positive scalars, byte extents and 8-byte words relaxed; everything else exact' });
}

// Runs the jitk-only corpus rerun for a kernel tree and returns its rows.
// Held-out names and results stay in the corpus .work journal and receipts.
async function corpus(kernel: string, id: string, selection: string, filter: string[], limit: number, out: string): Promise<CorpusRow[]> {
  // A transaction id is fresh; leftovers come only from an interrupted transaction.
  for (const stale of [id + '.jsonl', id + '-manifest.json', id + '-summary.json', id + '-disk-before.txt', 'kernel-' + id]) rmSync(join(CORPUS_WORK, stale), { recursive: true, force: true });
  const command = [CENSUS, 'rerun', '--from', 'full', '--id', id, '--kernel', kernel, '--selection', selection, '--workers', '2', '--targets', 'target-phase2', '--limit', String(limit), ...filter];
  const result = await capture(command, { cwd: CORPUS_ROOT, env: { ...SAFE_ENV, HOME: process.env.HOME || '/tmp', PATH: process.env.PATH || '/usr/bin:/bin', ZIG: zigPath(), JITK_SHARD_BINARY: process.env.JITK_SHARD_BINARY || '' }, timeout: 3600 });
  writeFileSync(out + '.log', Buffer.concat([result.stdout, result.stderr]));
  check(result.returncode === 0, 'corpus rerun failed: ' + id);
  // No program of this split uses the target: the rerun selects nothing and writes no journal.
  const path = join(CORPUS_WORK, id + '.jsonl');
  const rows = !existsSync(path) ? [] : readFileSync(path, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line) as CorpusRow);
  for (const extra of ['kernel-' + id]) rmSync(join(CORPUS_WORK, extra), { recursive: true, force: true });
  rmSync(join(CORPUS_WORK, 'findings-' + id), { recursive: true, force: true });
  return rows;
}
export function compareCorpus(base: CorpusRow[], candidate: CorpusRow[]): { total: number; newPass: number; regressions: string[]; passBefore: number; passAfter: number } {
  const before = new Map(base.map((r) => [r.name, r.jitk]));
  const regressions = candidate.filter((r) => before.get(r.name) === 'pass' && r.jitk !== 'pass').map((r) => r.name);
  return { total: candidate.length, newPass: candidate.filter((r) => before.get(r.name) !== 'pass' && r.jitk === 'pass').length, regressions, passBefore: base.filter((r) => r.jitk === 'pass').length, passAfter: candidate.filter((r) => r.jitk === 'pass').length };
}
function corpusFilter(target: string, selection: string): { filter: string[]; limit: number } {
  // Every program maps memory; mmap uses the first programs by name instead.
  if (target === 'mmap') return { filter: [], limit: selection === 'visible' ? 150 : 60 };
  return { filter: ['--uses', target], limit: selection === 'visible' ? 150 : 60 };
}

async function one(argv: string[]): Promise<void> {
  check(argv.includes('--validate-only'), '--validate-only required'); selectHost();
  const id = arg(argv, '--run-id'), target = arg(argv, '--target'); check(/^[\w-]+$/.test(id) && TARGETS.includes(target), 'run/target');
  const accepted = resolve(arg(argv, '--accepted')); mkdirSync(accepted, { recursive: true });
  const plan = readJSON<Plan>(join(resolve(arg(argv, '--profiles')), target, 'plan.json'));
  for (const p of Object.keys(plan.hashes)) check(sha(p) === plan.hashes[p], 'sealed generated profile changed');
  check(plan.oracle_fs === SHARED_TREE_MODE && plan.fixtures.every((f) => typeof f.tree === 'string'), 'profile was not calibrated on the shared tree: refusing to compare');
  // An empty held-out split would make the sealed gate vacuous: fail closed.
  const generated = readJSON<{ heldout: unknown[] }>(join(resolve(arg(argv, '--profiles')), target, 'profile.json'));
  check(generated.heldout.length > 0, 'generated profile has no held-out case: ' + target);
  const root = join(ROOT, 'results', id); check(!existsSync(root), 'run exists'); mkdirSync(root);
  const tmp = scratch('jitk-phase2-');
  const before = markers();
  try {
    const work = join(tmp, 'kernel'), copied = copyKernel(work); rmSync(join(work, 'tests'), { recursive: true, force: true });
    const overlay: Record<string, string> = {};
    for (const file of readdirSync(accepted).filter((f) => f.endsWith('.rs')).sort()) {
      copyFileSync(join(accepted, file), join(work, 'src/syscalls', file)); overlay[file] = sha(join(accepted, file));
    }
    dump(join(root, 'source.json'), { ...copied, overlay }); dump(join(root, 'sealed.json'), plan.hashes);
    const manifest = readJSON<Manifest>(join(work, 'syscalls.manifest.json'));
    manifest.contracts = manifest.contracts.filter((c) => c.name !== target); dump(join(work, 'syscalls.manifest.json'), manifest);
    // Baseline corpus results: the same tree before the target is (re)grown.
    const baseline: Record<string, CorpusRow[]> = {};
    for (const selection of ['visible', 'heldout']) {
      const f = corpusFilter(target, selection);
      baseline[selection] = await corpus(work, id + '-base-' + selection, selection, f.filter, f.limit, join(root, 'corpus-base-' + selection));
    }
    dump(join(root, 'corpus-baseline.json'), { visible: compareCorpus(baseline.visible, baseline.visible), heldout_programs: baseline.heldout.length });
    const handler = join(work, 'src/syscalls', target + '.rs');
    const replaced = existsSync(handler) ? readFileSync(handler, 'utf8') : null;
    rmSync(handler, { force: true });
    dump(join(root, 'replaced.json'), { target, existed: replaced !== null, sha256: replaced === null ? null : sha(join(CANONICAL, 'src/syscalls', target + '.rs')) });
    for (const command of [['git', 'init', '-q'], ['git', 'config', 'user.name', 'jitk grow'], ['git', 'config', 'user.email', 'jitk@example.invalid'], ['git', 'add', '.'], ['git', 'commit', '-qm', 'isolated phase2 seed']]) await run(command, { cwd: work });
    const report = await retryTransaction(target, work, join(root, 'tx-' + target), manifest, 3, async (out: string, history: Feedback[]) => {
      const r = new Receipt(out), visible = plan.fixtures[0], hidden = plan.fixtures[1];
      mkdirSync(join(out, 'oracle')); copyFileSync(join(visible.oracle, 'linux-00.strace'), join(out, 'oracle/linux-00.strace'));
      const value = await r.stage('headless_cli', () => proposal(target, work, out, { nr: plan.nr, name: target }, true, 'none', history, visible.source));
      const source = await r.stage('source_validation', async () => { const s = validateProposal(target, value); validateSource(target, s); return s; });
      dump(join(out, 'proposal.json'), { path: 'src/syscalls/' + target + '.rs', source });
      writeFileSync(handler, source);
      async function verify(image: string, dest: string, fixture: Fixture): Promise<boolean> {
        requireSameTree(dirname(image), fixture.tree);
        const result = await processGuest(hostCommand(image), dest); checkHost(result.info, result.err);
        const observed = observe(result.raw); dump(dest + '.observations.json', observed);
        check(!result.info.timeout && observed.trace_complete, 'complete guest protocol required');
        observed.stdout_hex = normalizeAuto(observed.stdout_hex, fixture.learned.rules);
        requireResult(observed, fixture.learned.expected); return true;
      }
      const image = await r.stage('build_candidate', () => build(work, join(out, 'build'), visible.elf, [target], visible.resources));
      for (let i = 0; i < 30; i += 1) await r.stage('semantic_error_state_' + i, () => verify(image, join(out, 'vm-' + String(i).padStart(2, '0')), visible));
      const hiddenImage = await r.stage('build_heldout_candidate', () => build(work, join(out, 'heldout-build'), hidden.elf, [target], hidden.resources));
      await r.stage('heldout_candidate', () => verify(hiddenImage, join(out, 'heldout-vm'), hidden));
      for (const wrong of [-38, -123]) {
        writeFileSync(handler, 'pub fn call(_: &[usize]) -> isize {' + wrong + '}');
        const mutant = await r.stage('build_mutant_' + wrong, () => build(work, join(out, 'mutant-' + wrong), hidden.elf, [target], hidden.resources));
        requireSameTree(dirname(mutant), hidden.tree);
        const result = await processGuest(hostCommand(mutant), join(out, 'mutant-vm-' + wrong)); checkHost(result.info, result.err);
        const observed = observe(result.raw); check(!result.info.timeout && observed.trace_complete, 'crash is not mutation rejection');
        let rejected = false;
        try { observed.stdout_hex = normalizeAuto(observed.stdout_hex, hidden.learned.rules); requireResult(observed, hidden.learned.expected); } catch { rejected = true; }
        check(rejected, 'mutation survived generated profile');
      }
      writeFileSync(handler, source); dump(join(out, 'mutations.json'), [-38, -123]);
      await r.stage('unchanged_sqlite', () => integration(work, join(out, 'integration'), arg(argv, '--sqlite-elf'), arg(argv, '--database'), robustOracle));
      const results: Record<string, ReturnType<typeof compareCorpus>> = {};
      for (const selection of ['visible', 'heldout']) {
        const label = selection === 'visible' ? 'integration_corpus_visible' : 'unchanged_corpus_heldout';
        await r.stage(label, async () => {
          const f = corpusFilter(target, selection);
          const rows = await corpus(work, id + '-' + out.split('-').pop() + '-' + selection, selection, f.filter, f.limit, join(out, 'corpus-' + selection));
          results[selection] = compareCorpus(baseline[selection], rows);
          dump(join(out, 'corpus-' + selection + '.json'), selection === 'visible' ? results[selection] : { total: results[selection].total, newPass: results[selection].newPass, regressions: results[selection].regressions.length });
          check(results[selection].regressions.length === 0, 'corpus regression');
          return true;
        });
      }
      const evidence = { visible_pass: true, heldout_pass: true, mutations: [-38, -123], sqlite: '10/10', corpus_visible: results.visible, corpus_heldout: { total: results.heldout.total, newPass: results.heldout.newPass, regressions: 0 }, generated_profile_sha256: sha(join(resolve(arg(argv, '--profiles')), target, 'plan.json')) };
      dump(join(out, 'acceptance.json'), evidence); dump(join(root, 'accepted.json'), { source, evidence });
      return { name: target, gate: 'PASS', acceptance: evidence };
    });
    dump(join(root, 'report.json'), report);
    if (report.accepted) writeFileSync(join(accepted, target + '.rs'), readJSON<{ source: string }>(join(root, 'accepted.json')).source);
    check(equal(treeHashes(CANONICAL), copied.hashes), 'canonical changed during transaction');
  } finally { check(equal(markers(), before), 'release marker changed'); cleanup(tmp); }
}

// The grown kernel: a copy of the canonical tree plus every accepted handler.
// It is a separate artifact; the canonical tree and release markers are untouched.
async function assemble(argv: string[]): Promise<void> {
  const accepted = resolve(arg(argv, '--accepted')), out = resolve(arg(argv, '--out'));
  check(!existsSync(out), 'grown kernel output exists');
  const before = markers(), copied = copyKernel(out);
  const handlers: Record<string, { sha256: string; lines: number; replaced: string | null }> = {};
  const manifest = readJSON<Manifest>(join(out, 'syscalls.manifest.json'));
  for (const file of readdirSync(accepted).filter((f) => f.endsWith('.rs')).sort()) {
    const name = file.slice(0, -3), dest = join(out, 'src/syscalls', file);
    check(TARGETS.includes(name), 'unexpected accepted handler: ' + file);
    handlers[name] = { sha256: sha(join(accepted, file)), lines: readFileSync(join(accepted, file), 'utf8').trimEnd().split('\n').length, replaced: existsSync(dest) ? sha(dest) : null };
    copyFileSync(join(accepted, file), dest);
    manifest.contracts = manifest.contracts.filter((c) => c.name !== name);
  }
  dump(join(out, 'syscalls.manifest.json'), manifest);
  dump(join(out, 'GROWN.json'), { canonical: copied.hashes, handlers, note: 'phase-2 grown kernel: canonical tree plus accepted handlers; not a release' });
  check(equal(markers(), before), 'release marker changed');
  console.log(JSON.stringify(handlers));
}

// Model-free check of recorded or reference handlers against a sealed profile:
// --handler FILE (repeatable) is installed as the target and graded on both splits.
async function replay(argv: string[]): Promise<void> {
  selectHost();
  const target = arg(argv, '--target'), out = resolve(arg(argv, '--out')); check(TARGETS.includes(target), 'target'); mkdirSync(out, { recursive: true });
  const plan = readJSON<Plan>(join(resolve(arg(argv, '--profiles')), target, 'plan.json'));
  for (const p of Object.keys(plan.hashes)) check(sha(p) === plan.hashes[p], 'sealed generated profile changed');
  const handlers = argv.flatMap((value, i) => argv[i - 1] === '--handler' ? [resolve(value)] : []);
  const grades: Record<string, unknown>[] = [];
  const tmp = scratch('jitk-phase2-replay-');
  try {
    const work = join(tmp, 'kernel'); copyKernel(work);
    const manifest = readJSON<Manifest>(join(work, 'syscalls.manifest.json'));
    manifest.contracts = manifest.contracts.filter((c) => c.name !== target); dump(join(work, 'syscalls.manifest.json'), manifest);
    for (let h = 0; h < handlers.length; h += 1) {
      writeFileSync(join(work, 'src/syscalls', target + '.rs'), readFileSync(handlers[h]));
      const decisions: string[] = [], reasons: string[] = [];
      for (let i = 0; i < plan.fixtures.length; i += 1) {
        const f = plan.fixtures[i], dest = join(out, h + '-' + (i ? 'heldout' : 'visible'));
        try {
          const image = await build(work, dest, f.elf, [target], f.resources);
          requireSameTree(dest, f.tree);
          const result = await processGuest(hostCommand(image), dest + '-vm'); checkHost(result.info, result.err);
          const observed = observe(result.raw); check(!result.info.timeout && observed.trace_complete, 'incomplete guest protocol');
          observed.stdout_hex = normalizeAuto(observed.stdout_hex, f.learned.rules);
          requireResult(observed, f.learned.expected); decisions.push('PASS'); reasons.push('');
        } catch (error) { decisions.push('REJECT'); reasons.push(detail(error).slice(0, 300)); writeFileSync(dest + '-difference.txt', detail(error)); }
      }
      grades.push({ handler: handlers[h], sha256: sha(handlers[h]), visible: decisions[0], heldout: decisions[1], reasons });
      console.log(target, handlers[h].split('/').slice(-2).join('/'), decisions.join('/'));
    }
  } finally { cleanup(tmp); }
  dump(join(out, 'grades.json'), grades);
}

// One CSV row per attempt of a finished transaction.
export function attemptRows(id: string, target: string, tx: string, date: string, cli: string): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  const report = readJSON<{ accepted: boolean; attempts: Feedback[] }>(join(tx, 'report.json'));
  for (const a of report.attempts) {
    const d = join(tx, 'attempt-' + a.attempt), stages = readOr<Record<string, { passed: boolean }>>(join(d, 'stages.json'), {});
    const visible = Object.keys(stages).filter((s) => s.startsWith('semantic_error_state_'));
    const source = readOr<{ source: string }>(join(d, 'agent.json'), { source: '' }).source;
    const cv = readOr<{ total?: number; newPass?: number; regressions?: unknown[] }>(join(d, 'corpus-visible.json'), {});
    const ch = readOr<{ total?: number; newPass?: number; regressions?: number }>(join(d, 'corpus-heldout.json'), {});
    rows.push({ run_id: id, date, model: MODEL, cli, spec_level: 'none', target, attempt: a.attempt, accepted: Number(a.accepted), rejecting_gate: a.accepted ? '' : a.gate,
      visible_pass: visible.length === 30 ? Number(visible.every((s) => stages[s].passed)) : visible.some((s) => !stages[s].passed) ? 0 : 'not_reached',
      heldout_pass: stages.heldout_candidate ? Number(stages.heldout_candidate.passed) : 'not_reached', mutants_rejected: readOr<unknown[]>(join(d, 'mutations.json'), []).length,
      sqlite_pass: stages.unchanged_sqlite ? Number(stages.unchanged_sqlite.passed) : 'not_reached',
      corpus_visible: cv.total ?? '', corpus_visible_new_pass: cv.newPass ?? '', corpus_visible_regressions: cv.regressions ? cv.regressions.length : '',
      corpus_heldout: ch.total ?? '', corpus_heldout_new_pass: ch.newPass ?? '', corpus_heldout_regressions: ch.regressions ?? '',
      wall_s: a.wall_s, cli_calls: existsSync(join(d, 'agent-mode.json')) ? 1 : 0, handler_lines: source ? source.trimEnd().split('\n').length : 0, human_lines: 0 });
  }
  return rows;
}

async function batch(argv: string[]): Promise<void> {
  check(argv.includes('--validate-only'), '--validate-only required');
  const prefix = arg(argv, '--run-id'), out = join(ROOT, 'results', prefix); mkdirSync(out, { recursive: true });
  const accepted = join(out, 'accepted'); mkdirSync(accepted, { recursive: true });
  const targets = arg(argv, '--targets') ? arg(argv, '--targets').split(',') : TARGETS;
  // Tree identity per target and split: the archive both sides were pinned to.
  const trees: Record<string, string[]> = {};
  for (const target of targets) {
    const plan = readJSON<Plan>(join(resolve(arg(argv, '--profiles')), target, 'plan.json'));
    trees[target] = plan.fixtures.map((f) => f.tree || '');
  }
  const pins = { date: new Date().toISOString(), cli: await textCommand(['codex', '--version']), model: MODEL, controller_sha256: controllerHashes(), kernel: treeHashes(CANONICAL), protected: markers(), disk_before: await diskSpace(), vmm_sha256: sha(arg(argv, '--vmm')), oracle_image: await textCommand(['docker', 'image', 'inspect', 'jitk-oracle:08', '--format', '{{.Id}}']), n_per_target: 1, attempts: 3, spec: 'none', targets, oracle_fs: SHARED_TREE_MODE, oracle_root_sha256: sha(join(ROOT, 'build/oracle-root')), trees };
  const prior = readOr<Record<string, unknown> | null>(join(out, 'pins.json'), null);
  // Gate inputs must not change across a resume. A controller change (batch
  // bookkeeping fixes) is recorded as an amendment with its hashes.
  if (prior) for (const key of ['kernel', 'protected', 'vmm_sha256', 'oracle_image', 'model', 'oracle_fs', 'oracle_root_sha256', 'trees']) check(equal(prior[key], (pins as Record<string, unknown>)[key]), 'resume pins changed: ' + key);
  if (prior && !equal(prior.controller_sha256, pins.controller_sha256)) {
    // An untyped [] fallback is number[] under scriptc; keep this array explicitly typed.
    const amendments: Record<string, unknown>[] = [];
    if (Array.isArray(prior.amendments)) for (const item of prior.amendments as Record<string, unknown>[]) amendments.push(item);
    amendments.push({ date: pins.date, controller_sha256: pins.controller_sha256, note: arg(argv, '--amendment', 'controller changed between resumes') });
    prior.amendments = amendments; prior.controller_sha256 = pins.controller_sha256; dump(join(out, 'pins.json'), prior);
  }
  if (!prior) dump(join(out, 'pins.json'), pins);
  const rows = readOr<Record<string, unknown>[]>(join(out, 'rows.json'), []);
  for (const target of targets) {
    const id = prefix + '-' + target, dest = join(ROOT, 'results', id), tx = join(dest, 'tx-' + target);
    // A finished transaction is adopted (rows recorded once), never re-run.
    if (existsSync(join(tx, 'report.json')) && !existsSync(join(tx, 'paused.json'))) {
      if (!rows.some((r) => r.run_id === id)) { for (const row of attemptRows(id, target, tx, pins.date, pins.cli)) rows.push(row); dump(join(out, 'rows.json'), rows); }
      continue;
    }
    if (existsSync(dest)) rmSync(dest + '-interrupted', { recursive: true, force: true });
    if (existsSync(dest)) { await run(['mv', dest, dest + '-interrupted-' + Date.now()]); for (let i = rows.length - 1; i >= 0; i -= 1) if (rows[i].run_id === id) rows.splice(i, 1); }
    const disk = await diskSpace();
    const command = [join(ROOT, 'build/phase2'), 'one', '--run-id', id, '--validate-only', '--target', target, '--profiles', arg(argv, '--profiles'), '--accepted', accepted, '--sqlite-elf', arg(argv, '--sqlite-elf'), '--database', arg(argv, '--database')];
    const result = await capture(command, { env: { ...SAFE_ENV, HOME: process.env.HOME || '/tmp', PATH: process.env.PATH || '/usr/bin:/bin', JITK_SHARD_BINARY: arg(argv, '--vmm'), JITK_GROW_MODEL: MODEL }, timeout: 7200 });
    mkdirSync(dest, { recursive: true });
    writeFileSync(join(dest, 'driver.log'), Buffer.concat([result.stdout, result.stderr]));
    dump(join(dest, 'experiment.json'), { command, model: MODEL, returncode: result.returncode, disk_before: disk, disk_after: await diskSpace() });
    if (!existsSync(join(tx, 'report.json'))) { console.log(target, 'SETUP-FAILED', result.stderr.toString().slice(-600)); rows.push({ run_id: id, target, accepted: 0, rejecting_gate: 'setup' }); dump(join(out, 'rows.json'), rows); continue; }
    const report = readJSON<{ accepted: boolean; attempts: Feedback[] }>(join(tx, 'report.json'));
    for (const row of attemptRows(id, target, tx, pins.date, pins.cli)) rows.push(row);
    dump(join(out, 'rows.json'), rows); writeFileSync(join(out, 'PHASE2.csv'), csvEncode(rows, FIELDS));
    console.log(target, report.accepted ? 'PASS' : existsSync(join(tx, 'paused.json')) ? 'PAUSED' : 'FAIL');
    check(!existsSync(join(tx, 'paused.json')), 'paused on rate limit: resume the batch later without reducing N');
    check(equal(markers(), pins.protected), 'release markers changed');
  }
  dump(join(out, 'summary.json'), { targets: targets.length, accepted: readdirSync(accepted).filter((f) => f.endsWith('.rs')).map((f) => f.slice(0, -3)), rows: rows.length, disk_after: await diskSpace(), protected_after: markers() });
}

export async function main(argv: string[]): Promise<void> {
  if (argv[0] === 'traces') await traces(argv);
  else if (argv[0] === 'prepare') await prepare(argv);
  else if (argv[0] === 'one') await one(argv);
  else if (argv[0] === 'batch') await batch(argv);
  else if (argv[0] === 'replay') await replay(argv);
  else if (argv[0] === 'assemble') await assemble(argv);
  else if (argv[0] === 'rows') console.log(JSON.stringify(attemptRows(arg(argv, '--id'), arg(argv, '--target'), resolve(arg(argv, '--tx')), '', '')));
  else throw new Error('phase2 traces|prepare|one|batch|replay|assemble; one/batch require --validate-only');
}
