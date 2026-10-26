import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { check, capture, csvEncode, diskSpace, dump, equal, load, readJSON, readOr, SAFE_ENV, sha } from './lib.ts';
import { ROOT, CANONICAL } from './runtime.ts';
import { FIELDS, markers, controllerHashes } from './experiment-run.ts';
import { lintProbeConstants } from './probe-lint.ts';
import { observe, requireResult, type Outcome } from './observations.ts';

interface History { attempt: number; accepted: boolean; gate: string; wall_s: number }
interface Report { accepted: boolean; attempts: History[]; cli_calls: number }
export function auditE1(root: string): Record<string, unknown> {
  const rows: Record<string, unknown>[] = [];
  const rejected: Record<string, unknown>[] = [];
  for (const id of readdirSync(root).filter((name) => /^e1-(main|pilot)-v2-/.test(name)).sort()) {
    const target = id.includes('-pread64-') ? 'pread64' : id.includes('-fstat-') ? 'fstat' : 'ppoll';
    const tx = join(root, id, 'tx-' + target);
    const report = readJSON<Report>(join(tx, 'report.json'));
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
  return { method: 'reparse all saved raw visible and held-out outputs against their sealed Linux references; no VM rerun', accepted: rows.length, heldout_pass: rows.filter((row) => row.heldout_pass).length, false_positives: rejected.length, rows };
}

export async function runE2(argv: string[]): Promise<void> {
  check(argv.includes('--validate-only'), '--validate-only required');
  function arg(flag: string, fallback: string): string { const i = argv.indexOf(flag); return i < 0 ? fallback : argv[i + 1]; }
  const prefix = arg('--run-id', ''); check(/^[\w-]+$/.test(prefix), 'run id');
  const vmm = resolve(arg('--vmm', ''));
  const sqlite = resolve(arg('--sqlite-elf', ''));
  const database = resolve(arg('--database', ''));
  const out = join(ROOT, 'results', prefix);
  check(!existsSync(out), 'batch exists'); mkdirSync(out, { recursive: true });
  const before = markers();
  const pins = { date: new Date().toISOString(), cli: (await capture(['codex', '--version'])).stdout.toString().trim(), model: 'gpt-6.1-sol', oracle_image: (await capture(['docker', 'image', 'inspect', 'jitk-oracle:08', '--format', '{{.Id}}'])).stdout.toString().trim(), vmm_sha256: sha(vmm), sqlite_sha256: sha(sqlite), database_sha256: sha(database), source: controllerHashes(), protected_before: before, disk_before: await diskSpace(), uptime_before: load(), oracle_concurrency: 1, attempts: 1, n_per_target: 5 };
  dump(join(out, 'pins.json'), pins);
  const audit = auditE1(arg('--evidence', join(homedir(), 'sofort-local-evidence/growos-e0-e1-2026-10-26/results')));
  dump(join(out, 'e1-audit.json'), audit);
  check(audit.false_positives === 0, 'lint false positives on accepted E1 handlers');
  const rows: Record<string, unknown>[] = [];
  for (const target of ['ppoll', 'fstat', 'pread64']) {
    for (let n = 1; n <= 5; n += 1) {
      const disk = await diskSpace(); const id = prefix + '-' + target + '-' + n;
      const command = [join(ROOT, 'build/grow'), '--run-id', id, '--validate-only', '--live', '--target', target, '--spec', 'none', '--attempts', '1'];
      if (target !== 'ppoll') command.push('--sqlite-elf', sqlite, '--database', database);
      const started = performance.now();
      const result = await capture(command, { env: { ...SAFE_ENV, JITK_VMM_BINARY: vmm, JITK_GROW_MODEL: pins.model, JITK_GROW_RED_TEAM: '1' }, timeout: 600 });
      const dest = join(ROOT, 'results', id); mkdirSync(dest, { recursive: true });
      writeFileSync(join(dest, 'driver.log'), Buffer.concat([result.stdout, result.stderr]));
      dump(join(dest, 'experiment.json'), { command, disk_before: disk, wall_s: (performance.now() - started) / 1000, returncode: result.returncode, uptime_after: load(), controller_sha256: pins.source });
      const tx = join(dest, 'tx-' + target), a = join(tx, 'attempt-1');
      const report = readOr<Report>(join(tx, 'report.json'), { accepted: false, attempts: [], cli_calls: 0 });
      check(report.attempts.length === 1, 'red-team trial did not return an attempt receipt');
      const stages = readJSON<Record<string, { passed: boolean }>>(join(a, 'stages.json'));
      const proposal = readOr<{ source: string }>(join(a, 'agent.json'), { source: '' });
      const visible = Object.keys(stages).filter((name) => name.startsWith('semantic_error_state_'));
      rows.push({ run_id: id, date: pins.date, host: 'macOS/HVF', model: pins.model, cli: pins.cli, spec_level: 'none', target, attempt: 1, accepted: Number(report.accepted), rejecting_gate: report.accepted ? '' : report.attempts[0].gate, visible_pass: visible.length === 30 ? Number(visible.every((name) => stages[name].passed)) : 'not_reached', heldout_pass: stages.heldout_candidate ? Number(stages.heldout_candidate.passed) : 'not_reached', mutants_rejected: readOr<unknown[]>(join(a, 'mutations.json'), []).length, integration_pass: report.accepted ? 1 : 'not_reached', wall_s: report.attempts[0].wall_s, cli_calls: report.cli_calls, human_minutes: 0, handler_lines: proposal.source.trimEnd().split('\n').length, human_lines: 0 });
      writeFileSync(join(out, 'E2.csv'), csvEncode(rows, FIELDS));
      console.log(id, report.accepted ? 'ACCEPTED' : report.attempts[0].gate);
      check(equal(markers(), before), 'release markers changed');
      check(!existsSync(join(tx, 'paused.json')), 'subscription limit: pause, resume remaining N without shrinking');
    }
  }
  dump(join(out, 'summary.json'), { trials: rows.length, accepted: rows.filter((row) => row.accepted).length, audit_accepted: audit.accepted, audit_heldout_pass: audit.heldout_pass, lint_false_positives: audit.false_positives, disk_after: await diskSpace(), protected_after: markers(), kernel_ready_sha256: sha(join(CANONICAL, '.READY')) });
}

if (process.argv[1]?.endsWith('/e2')) runE2(process.argv.slice(2)).catch((error: unknown) => { console.error(error); process.exitCode = 1; });
