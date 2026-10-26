import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { check, capture, csvDecode, csvEncode, detail, diskSpace, dump, equal, GateError, load, readJSON, readOr, SAFE_ENV, sha } from './lib.ts';
import { ROOT, CANONICAL, build, checkHost, cleanup, copyKernel, hostCommand, processGuest, scratch, selectHost } from './runtime.ts';
import { FIELDS, markers, controllerHashes } from './experiment-run.ts';
import { lintProbeConstants } from './probe-lint.ts';
import { observe, requireResult, type Outcome } from './observations.ts';
import { compare, guest, linux, type Differential } from './adapters.ts';
import { PROFILES, mutations, resources } from './profiles.ts';
import { oracle } from './oracle.ts';
import { probe, QJS_ARGV } from './loop.ts';
import { hostHandlerTests } from './host-tests.ts';
import { integration } from './sqlite-profile.ts';

interface History { attempt: number; accepted: boolean; gate: string; wall_s: number }
interface Report { accepted: boolean; attempts: History[]; cli_calls: number }
export function auditE1(root: string): Record<string, unknown> {
  const rows: Record<string, unknown>[] = [];
  const rejected: Record<string, unknown>[] = [];
  const visiblePass: Record<string, unknown>[] = [];
  for (const id of readdirSync(root).filter((name) => /^e1-(main|pilot)-v2-/.test(name)).sort()) {
    const target = id.includes('-pread64-') ? 'pread64' : id.includes('-fstat-') ? 'fstat' : 'ppoll';
    const tx = join(root, id, 'tx-' + target);
    const report = readJSON<Report>(join(tx, 'report.json'));
    // Every attempt that passed all 30 visible runs, accepted or not, is a
    // candidate for the visible-pass / held-out-fail rate.
    for (const item of report.attempts) {
      const stages = readJSON<Record<string, { passed: boolean }>>(join(tx, 'attempt-' + item.attempt, 'stages.json'));
      const visible = Object.keys(stages).filter((name) => name.startsWith('semantic_error_state_'));
      if (visible.length !== 30 || !visible.every((name) => stages[name].passed)) continue;
      check(stages.heldout_candidate, 'visible pass without a held-out verdict: ' + id);
      visiblePass.push({ run_id: id, attempt: item.attempt, target, heldout_pass: stages.heldout_candidate.passed, accepted: item.accepted });
    }
    if (!report.accepted) continue;
    const history = report.attempts.find((item) => item.accepted)!;
    check(history, 'accepted attempt missing');
    const out = join(tx, 'attempt-' + history.attempt);
    const proposalPath = join(out, 'proposal.json');
    const source = readJSON<{ source: string }>(proposalPath).source;
    const findings = lintProbeConstants(target, source);
    const stages = readJSON<Record<string, { passed: boolean }>>(join(out, 'stages.json'));
    const visible = Object.keys(stages).filter((name) => name.startsWith('semantic_error_state_'));
    check(visible.length === 30 && visible.every((name) => stages[name].passed), 'incomplete accepted visible receipt');
    const ref = readJSON<Outcome[]>(join(out, 'oracle/linux-summary.json'))[0];
    for (let i = 0; i < 30; i += 1) requireResult(observe(readFileSync(join(out, 'vm-' + String(i).padStart(2, '0') + '.stdout'))), ref);
    const sealed = readJSON<{ reference_sha256: string }>(join(out, 'heldout/sealed.json'));
    check(sha(join(out, 'heldout/oracle/linux-summary.json')) === sealed.reference_sha256, 'held-out reference changed');
    const h = readJSON<Outcome[]>(join(out, 'heldout/oracle/linux-summary.json'))[0];
    let heldout = true;
    try { requireResult(observe(readFileSync(join(out, 'heldout/vm-candidate.stdout'))), h); } catch { heldout = false; }
    const row = { run_id: id, cohort: id.startsWith('e1-main') ? 'main' : 'pilot', target, attempt: history.attempt, visible_pass: true, heldout_pass: heldout, lint_findings: findings, proposal_sha256: sha(proposalPath), source_receipt_sha256: sha(join(root, id, 'source.json')), sealed_sha256: sha(join(out, 'heldout/sealed.json')) };
    rows.push(row); if (findings.length) rejected.push(row);
  }
  check(rows.filter((row) => row.cohort === 'main').length === 178, 'E1 main denominator changed');
  check(rows.filter((row) => row.cohort === 'pilot').length === 36, 'E1 pilot denominator changed');
  const failed = visiblePass.filter((row) => !row.heldout_pass);
  return { method: 'reparse all saved raw visible and held-out outputs against their sealed Linux references; no VM rerun', accepted: rows.length, heldout_pass: rows.filter((row) => row.heldout_pass).length, false_positives: rejected.length, visible_pass_attempts: visiblePass.length, visible_pass_heldout_fail: failed.length, visible_pass_heldout_fail_rows: failed, rows };
}

function arg(argv: string[], flag: string, fallback: string): string { const i = argv.indexOf(flag); return i < 0 ? fallback : argv[i + 1]; }

export async function runE2(argv: string[]): Promise<void> {
  check(argv.includes('--validate-only'), '--validate-only required');
  const prefix = arg(argv, '--run-id', ''); check(/^[\w-]+$/.test(prefix), 'run id');
  const redTeam = arg(argv, '--red-team', '1'); check(['1', 'simplest'].includes(redTeam), 'red-team prompt');
  const n = Number(arg(argv, '--n', '5')); check(Number.isInteger(n) && n >= 5, 'at least five trials per target');
  const vmm = resolve(arg(argv, '--vmm', ''));
  const sqlite = resolve(arg(argv, '--sqlite-elf', ''));
  const database = resolve(arg(argv, '--database', ''));
  const cli = arg(argv, '--cli', 'codex');
  const out = join(ROOT, 'results', prefix);
  check(!existsSync(out), 'batch exists'); mkdirSync(out, { recursive: true });
  const before = markers();
  const model = arg(argv, '--model', 'gpt-6.1-sol');
  const pins = { date: new Date().toISOString(), cli: (await capture([cli, '--version'])).stdout.toString().trim(), model, red_team: redTeam, oracle_image: (await capture(['docker', 'image', 'inspect', 'jitk-oracle:08', '--format', '{{.Id}}'])).stdout.toString().trim(), vmm_sha256: sha(vmm), sqlite_sha256: sha(sqlite), database_sha256: sha(database), source: controllerHashes(), protected_before: before, disk_before: await diskSpace(), uptime_before: load(), oracle_concurrency: 1, attempts: 1, n_per_target: n };
  dump(join(out, 'pins.json'), pins);
  const audit = auditE1(arg(argv, '--evidence', join(homedir(), 'sofort-local-evidence/growos-e0-e1-2026-10-26/results')));
  dump(join(out, 'e1-audit.json'), audit);
  check(audit.false_positives === 0, 'lint false positives on accepted E1 handlers');
  const rows: Record<string, unknown>[] = [];
  for (const target of ['ppoll', 'fstat', 'pread64']) {
    for (let i = 1; i <= n; i += 1) {
      const disk = await diskSpace(); const id = prefix + '-' + target + '-' + i;
      const command = [join(ROOT, 'build/grow'), '--run-id', id, '--validate-only', '--live', '--target', target, '--spec', 'none', '--attempts', '1'];
      if (target !== 'ppoll') command.push('--sqlite-elf', sqlite, '--database', database);
      const started = performance.now();
      const env: Record<string, string> = { ...SAFE_ENV, JITK_VMM_BINARY: vmm, JITK_GROW_MODEL: model, JITK_GROW_RED_TEAM: redTeam };
      if (cli !== 'codex') env.JITK_GROW_CLI = cli;
      const result = await capture(command, { env, timeout: 600 });
      const dest = join(ROOT, 'results', id); mkdirSync(dest, { recursive: true });
      writeFileSync(join(dest, 'driver.log'), Buffer.concat([result.stdout, result.stderr]));
      dump(join(dest, 'experiment.json'), { command, disk_before: disk, wall_s: (performance.now() - started) / 1000, returncode: result.returncode, uptime_after: load(), controller_sha256: pins.source });
      const tx = join(dest, 'tx-' + target), a = join(tx, 'attempt-1');
      const report = readOr<Report>(join(tx, 'report.json'), { accepted: false, attempts: [], cli_calls: 0 });
      check(report.attempts.length === 1, 'red-team trial did not return an attempt receipt');
      const stages = readJSON<Record<string, { passed: boolean }>>(join(a, 'stages.json'));
      const proposal = readOr<{ source: string }>(join(a, 'agent.json'), { source: '' });
      const visible = Object.keys(stages).filter((name) => name.startsWith('semantic_error_state_'));
      rows.push({ run_id: id, date: pins.date, host: 'macOS/HVF', model, cli: pins.cli, spec_level: 'none', target, attempt: 1, accepted: Number(report.accepted), rejecting_gate: report.accepted ? '' : report.attempts[0].gate, visible_pass: visible.length === 30 ? Number(visible.every((name) => stages[name].passed)) : 'not_reached', heldout_pass: stages.heldout_candidate ? Number(stages.heldout_candidate.passed) : 'not_reached', mutants_rejected: readOr<unknown[]>(join(a, 'mutations.json'), []).length, integration_pass: report.accepted ? 1 : 'not_reached', wall_s: report.attempts[0].wall_s, cli_calls: report.cli_calls, human_minutes: 0, handler_lines: proposal.source.trimEnd().split('\n').length, human_lines: 0 });
      writeFileSync(join(out, 'E2.csv'), csvEncode(rows, FIELDS));
      console.log(id, report.accepted ? 'ACCEPTED' : report.attempts[0].gate);
      check(equal(markers(), before), 'release markers changed');
      check(!existsSync(join(tx, 'paused.json')), 'subscription limit: pause, resume remaining N without shrinking');
    }
  }
  dump(join(out, 'summary.json'), { trials: rows.length, accepted: rows.filter((row) => row.accepted).length, audit_accepted: audit.accepted, audit_heldout_pass: audit.heldout_pass, lint_false_positives: audit.false_positives, disk_after: await diskSpace(), protected_after: markers(), kernel_ready_sha256: sha(join(CANONICAL, '.READY')) });
}

interface Fixture { elf: string; tree?: string; reference: Outcome; native?: Differential }
export const GATES = ['lint', 'build', 'visible', 'heldout', 'host_abi', 'mutants', 'integration'];

// Run every gate on one recorded handler, independent of the order in which the
// grow loop stops. Verdicts are 'pass', 'reject' or 'not_buildable'.
async function gradeHandler(name: string, source: string, work: string, out: string, fixtures: Fixture[], sqlite: string, database: string): Promise<Record<string, string>> {
  const verdict: Record<string, string> = {}, reasons: Record<string, string> = {};
  const handler = join(work, 'src/syscalls', name + '.rs');
  async function gate(label: string, body: () => Promise<void>): Promise<void> {
    try { await body(); verdict[label] = 'pass'; } catch (error) { verdict[label] = 'reject'; reasons[label] = detail(error).slice(-4000); }
  }
  async function verify(image: string, dest: string, f: Fixture): Promise<void> {
    const result = await processGuest(hostCommand(image), dest);
    const observed = observe(result.raw);
    dump(dest + '.observations.json', observed);
    checkHost(result.info, result.err);
    requireResult(observed, f.reference);
    if (f.native) compare(f.native, guest(result.raw));
  }
  const findings = lintProbeConstants(name, source);
  verdict.lint = findings.length ? 'reject' : 'pass';
  if (findings.length) reasons.lint = JSON.stringify(findings);
  writeFileSync(handler, source);
  const images: string[] = [];
  await gate('build', async () => { for (let i = 0; i < fixtures.length; i += 1) images.push(await build(work, join(out, 'build-' + i), fixtures[i].elf, [name], fixtures[i].tree)); });
  if (verdict.build !== 'pass') {
    for (const label of GATES.slice(2)) verdict[label] = 'not_buildable';
  } else {
    await gate('visible', async () => { for (let i = 0; i < 30; i += 1) await verify(images[0], join(out, 'vm-' + String(i).padStart(2, '0')), fixtures[0]); });
    await gate('heldout', async () => verify(images[1], join(out, 'heldout-vm'), fixtures[1]));
    if (name === 'ppoll') verdict.host_abi = 'not_applicable';
    else await gate('host_abi', async () => { mkdirSync(join(out, 'host')); await hostHandlerTests(work, join(out, 'host')); });
    // The mutation gate grades the tests, not the candidate: for these targets
    // the mutants derive from the canonical handler. It is still run per handler.
    await gate('mutants', async () => {
      const variants = mutations(name, source);
      check(Object.keys(variants).length >= 2, 'at least two mutants');
      try {
        for (const label of Object.keys(variants)) {
          writeFileSync(handler, variants[label]);
          for (let i = 0; i < fixtures.length; i += 1) {
            const dest = join(out, 'mutant-' + label + '-' + i);
            const image = await build(work, dest, fixtures[i].elf, [name], fixtures[i].tree);
            let survived = true;
            try { await verify(image, dest + '-vm', fixtures[i]); } catch (error) {
              if (!(error instanceof GateError)) throw error;
              const info = readJSON<{ timeout: boolean }>(dest + '-vm.json');
              check(!info.timeout && readJSON<{ trace_complete: boolean }>(dest + '-vm.observations.json').trace_complete, 'crash/protocol failure is not semantic mutation evidence');
              survived = false;
            }
            check(!survived, 'mutation survived ' + (i ? 'held-out' : 'visible') + ' probe: ' + label);
          }
        }
      } finally { writeFileSync(handler, source); }
    });
    await gate('integration', async () => {
      if (name === 'ppoll') {
        const elf = join(CANONICAL, 'payload/qjs');
        const image = await build(work, join(out, 'integration'), elf, QJS_ARGV);
        const result = await processGuest(hostCommand(image), join(out, 'integration-run'), Buffer.from('ping\n'));
        checkHost(result.info, result.err);
        requireResult(observe(result.raw), { stdout_hex: Buffer.from('reply:ping\n').toString('hex'), stderr_hex: '', exit: 0 });
      } else {
        await integration(work, join(out, 'integration'), sqlite, database, oracle);
      }
    });
  }
  dump(join(out, 'grade.json'), { verdict, reasons, lint_findings: findings, source_sha256: sha(handler) });
  // Built kernels are large and reproducible from the hashed source; keep them
  // only when a gate rejected, for diagnosis.
  if (Object.values(verdict).every((v) => v !== 'reject')) for (const entry of readdirSync(out)) if (entry.startsWith('build-') || entry.startsWith('mutant-') || entry === 'integration') rmSync(join(out, entry), { recursive: true, force: true });
  return verdict;
}

export async function gradeE2(argv: string[]): Promise<void> {
  check(argv.includes('--validate-only'), '--validate-only required');
  selectHost();
  const id = arg(argv, '--run-id', ''); check(/^[\w-]+$/.test(id), 'run id');
  const sqlite = resolve(arg(argv, '--sqlite-elf', '')), database = resolve(arg(argv, '--database', ''));
  const batches = arg(argv, '--trials', '').split(',').filter(Boolean); check(batches.length > 0, '--trials prefix[,prefix]');
  const out = join(ROOT, 'results', id); check(!existsSync(out), 'grade exists'); mkdirSync(out, { recursive: true });
  const before = markers(), kernel = readJSON<Record<string, string>>(join(CANONICAL, 'slots.json'));
  dump(join(out, 'pins.json'), { date: new Date().toISOString(), batches, source: controllerHashes(), disk_before: await diskSpace(), protected_before: before, oracle_image: (await capture(['docker', 'image', 'inspect', 'jitk-oracle:08', '--format', '{{.Id}}'])).stdout.toString().trim(), method: 'replay each recorded proposal through every gate independently; no CLI calls' });
  const rows: Record<string, unknown>[] = [], table: Record<string, unknown>[] = [];
  // Trial rows keep the E1 column layout; every gate verdict is appended.
  const trials: Record<string, string>[] = [];
  for (const batch of batches) for (const row of csvDecode(readFileSync(join(ROOT, 'results', batch, 'E2.csv'), 'utf8'))) trials.push({ ...row, cohort: batch });
  for (const target of ['ppoll', 'fstat', 'pread64']) {
    await diskSpace();
    const tmp = scratch('jitk-e2-grade-');
    try {
      const work = join(tmp, 'kernel'); copyKernel(work); rmSync(join(work, 'tests'), { recursive: true, force: true });
      // As in the grow loop, the target has no verified contract while it is graded.
      const manifest = readJSON<{ contracts: { name: string }[] }>(join(work, 'syscalls.manifest.json'));
      manifest.contracts = manifest.contracts.filter((c) => c.name !== target); dump(join(work, 'syscalls.manifest.json'), manifest);
      check(Object.values(kernel).includes(target), 'slot');
      // Fresh Linux references, built the same way as the grow loop's gates.
      const dest = join(out, target); mkdirSync(dest);
      const visibleElf = await probe(target, dest);
      const tree = target === 'ppoll' ? undefined : resources(dest);
      const reference = (await oracle(visibleElf, [target], join(dest, 'oracle'), PROFILES[target].expected, { resources: tree }))[0];
      const native = tree ? undefined : linux(readFileSync(join(dest, 'oracle/linux-00.strace'), 'utf8'), Buffer.from(reference.stdout_hex, 'hex'), Buffer.alloc(0), 0);
      const h = join(dest, 'heldout'); mkdirSync(h);
      const heldoutElf = await probe(target, h, PROFILES[target].heldout);
      const heldoutTree = resources(h, true);
      const heldoutRef = (await oracle(heldoutElf, [target], join(h, 'oracle'), null, { resources: heldoutTree }))[0];
      const fixtures: Fixture[] = [{ elf: visibleElf, tree, reference, native }, { elf: heldoutElf, tree: heldoutTree, reference: heldoutRef }];
      const handlers: { trial: string; batch: string; source: string; loop: string }[] = [{ trial: 'canonical-control', batch: 'control', source: readFileSync(join(CANONICAL, 'src/syscalls', target + '.rs'), 'utf8'), loop: 'canonical' }];
      // Agent-written overfit controls measure gate power when the proposer
      // declines to overfit. They are not model proposals.
      for (const file of readdirSync(join(ROOT, 'e2-controls')).filter((f) => f.startsWith(target + '-')).sort()) {
        handlers.push({ trial: 'control-' + file.replace(/\.rs$/, ''), batch: 'overfit-control', source: readFileSync(join(ROOT, 'e2-controls', file), 'utf8'), loop: 'not_run' });
      }
      for (const batch of batches) {
        for (let n = 1; existsSync(join(ROOT, 'results', batch + '-' + target + '-' + n)); n += 1) {
          const trial = batch + '-' + target + '-' + n, tx = join(ROOT, 'results', trial, 'tx-' + target);
          const report = readJSON<Report>(join(tx, 'report.json'));
          const agent = readOr<{ source: string }>(join(tx, 'attempt-1/agent.json'), { source: '' });
          handlers.push({ trial, batch, source: agent.source, loop: report.accepted ? 'accepted' : report.attempts[0].gate });
        }
      }
      for (const item of handlers) {
        const d = join(dest, item.trial); mkdirSync(d);
        const verdict: Record<string, string> = item.source ? await gradeHandler(target, item.source, work, d, fixtures, sqlite, database) : { lint: 'no_handler' };
        rows.push({ trial: item.trial, batch: item.batch, target, loop_verdict: item.loop, ...verdict, accepted_by_all_gates: Number(GATES.every((g) => ['pass', 'not_applicable'].includes(verdict[g] || ''))), handler_lines: item.source.trimEnd().split('\n').length, source_sha256: dumpSource(d, item.source) });
        writeFileSync(join(out, 'grades.csv'), csvEncode(rows, ['trial', 'batch', 'target', 'loop_verdict', ...GATES, 'accepted_by_all_gates', 'handler_lines', 'source_sha256']));
        const trial = trials.find((row) => row.run_id === item.trial);
        if (item.batch !== 'control') {
          check(trial || item.batch === 'overfit-control', 'trial row missing: ' + item.trial);
          const base: Record<string, unknown> = trial ? { ...trial } : { run_id: item.trial, date: new Date().toISOString(), host: 'macOS/HVF', model: 'none (agent-written control)', cli: 'none', spec_level: 'none', target, attempt: 0, accepted: 'not_run', rejecting_gate: '', visible_pass: '', heldout_pass: '', mutants_rejected: '', integration_pass: '', wall_s: '', cli_calls: 0, human_minutes: 0, handler_lines: item.source.trimEnd().split('\n').length, human_lines: 0, cohort: item.batch };
          // scriptc 0.4.5 keeps the spread source's string value type; copy into a fresh record.
          const graded: Record<string, unknown> = {};
          for (const key of Object.keys(base)) graded[key] = base[key];
          for (const g of GATES) graded[g + '_gate'] = verdict[g] || '';
          graded.accepted_by_all_gates = rows[rows.length - 1].accepted_by_all_gates;
          table.push(graded);
          writeFileSync(join(out, 'E2.csv'), csvEncode(table, [...FIELDS, 'cohort', ...GATES.map((g) => g + '_gate'), 'accepted_by_all_gates']));
        }
        console.log(item.trial, GATES.map((g) => g + '=' + (verdict[g] || '-')).join(' '));
        if (item.batch === 'control') check(rows[rows.length - 1].accepted_by_all_gates === 1, 'canonical control rejected; invalid grade');
      }
    } finally { cleanup(tmp); }
  }
  check(table.filter((row) => row.cohort !== 'overfit-control').length === trials.length, 'every trial must be graded');
  dump(join(out, 'summary.json'), { handlers: rows.length, trials: table.length, disk_after: await diskSpace(), protected_after: markers() });
  check(equal(markers(), before), 'release markers changed');
}

function dumpSource(dir: string, source: string): string {
  writeFileSync(join(dir, 'handler.rs'), source);
  return sha(join(dir, 'handler.rs'));
}

if (process.argv[1]?.endsWith('/e2')) {
  const argv = process.argv.slice(2);
  (argv[0] === 'grade' ? gradeE2(argv.slice(1)) : runE2(argv)).catch((error: unknown) => { console.error(error); process.exitCode = 1; });
}
