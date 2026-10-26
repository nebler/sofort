import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { platform, release } from 'node:os';
import { check, capture, csvEncode, detail, diskSpace, dump, equal, files, load, pythonShuffle, readJSON, readOr, run, SAFE_ENV, sha } from './lib.ts';
import { ROOT, ASSETS } from './runtime.ts';
import { type Feedback } from './retries.ts';

export const FIELDS = 'run_id,date,host,model,cli,spec_level,target,attempt,accepted,rejecting_gate,visible_pass,heldout_pass,mutants_rejected,integration_pass,wall_s,cli_calls,human_minutes,handler_lines,human_lines'.split(',');
export const MODELS: Record<string, string> = { old: 'gpt-6-sol', new: 'gpt-6.1-sol' };
export type Cell = [string, string, string, string, number];
export interface Metadata {
  date: string;
  host: string;
  cli: string;
  source_commit: string;
  controller_sha256: Record<string, string>;
  models: Record<string, string>;
  protected_before: Record<string, string>;
  oracle_image: string;
  vmm_sha256: string;
  design: Cell[];
  n_per_cell: number;
  paused?: boolean;
  [key: string]: unknown;
}
export interface AttemptReport {
  name?: string;
  gate?: string;
  accepted?: boolean;
  acceptance_at_1?: boolean;
  acceptance_at_3?: boolean;
  cli_calls?: number;
  seconds?: number;
  attempts?: Feedback[];
  acceptance?: { mutations: unknown[]; heldout_pass?: boolean; visible_pass?: boolean };
}
export interface Experiment {
  date?: string;
  wall_s: number;
  returncode: number;
  paused: boolean;
  accepted: boolean;
  command: string[];
  protected_after: Record<string, string>;
  controller_sha256: Record<string, string>;
  [key: string]: unknown;
}
export function markers(): Record<string, string> {
  return { '.READY': sha(join(ASSETS, '.READY')), 'release.json': sha(join(ASSETS, 'release.json')) };
}
export function controllerHashes(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const path of readdirSync(ROOT).filter((name) => name.endsWith('.ts')).map((name) => join(ROOT, name))) {
    result[basename(path)] = sha(path);
  }
  return result;
}
export function design(phase: string, n: number, prefix = 'e1-' + phase + '-v2-20261026'): Cell[] {
  const cells: Cell[] = [];
  for (const target of ['ppoll', 'fstat', 'pread64']) {
    for (const spec of ['full', 'terse', 'none']) {
      for (const model of ['old', 'new']) {
        for (let rep = 1; rep <= n; rep += 1) {
          cells.push([`${prefix}-${target}-${spec}-${model}-${String(rep).padStart(2, '0')}`, target, spec, model, rep]);
        }
      }
    }
  }
  pythonShuffle(cells, 20261026);
  return cells;
}
export function attemptRows(cell: Cell, metadata: Metadata): Record<string, unknown>[] {
  const [runId, target, spec, model] = cell;
  const tx = join(ROOT, 'results', runId, 'tx-' + target);
  const report = readOr<AttemptReport>(join(tx, 'report.json'), {});
  return (report.attempts || []).map((item) => {
    const dest = join(tx, 'attempt-' + item.attempt);
    const stages = readOr<Record<string, { passed: boolean }>>(join(dest, 'stages.json'), {});
    const visible = Object.keys(stages).filter((name) => name.startsWith('semantic_error_state_'));
    const value = readOr<{ source?: string }>(join(dest, 'proposal.json'), {});
    return { run_id: runId, date: metadata.date, host: metadata.host, model: metadata.models[model], cli: metadata.cli, spec_level: spec, target, attempt: item.attempt, accepted: Number(item.accepted), rejecting_gate: item.accepted ? '' : item.gate, visible_pass: Number(visible.length === 30 && visible.every((name) => stages[name].passed)), heldout_pass: Number(stages.heldout_candidate?.passed || false), mutants_rejected: readOr<unknown[]>(join(dest, 'mutations.json'), []).length, integration_pass: Number(item.accepted), wall_s: item.wall_s, cli_calls: Number(readOr<{ mode?: string }>(join(dest, 'agent-mode.json'), {}).mode === 'live'), human_minutes: 0, handler_lines: value.source ? value.source.trimEnd().split('\n').length : '', human_lines: 0 };
  });
}
export async function textCommand(command: string[]): Promise<string> {
  return (await run(command, { cwd: ROOT })).stdout.toString().trim();
}
export interface RunOptions {
  phase: string;
  workers: number;
  prefix: string;
  vmm: string;
  sqlite: string;
  database: string;
}
async function runCell(cell: Cell, metadata: Metadata, options: RunOptions): Promise<Experiment> {
  const [runId, target, spec, model, rep] = cell;
  const out = join(ROOT, 'results', runId);
  const path = join(out, 'experiment.json');
  if (existsSync(path)) {
    return readJSON<Experiment>(path);
  }
  check(!existsSync(out), 'interrupted run has no experiment receipt; retain it and use a fresh prefix: ' + runId);
  const disk = await diskSpace();
  const command = [join(ROOT, 'build/grow'), '--run-id', runId, '--validate-only', '--live', '--target', target, '--spec', spec, '--attempts', '3', '--samples', '30'];
  if (target !== 'ppoll') {
    command.push('--sqlite-elf', options.sqlite, '--database', options.database);
  }
  const started = performance.now();
  const result = await capture(command, { env: { ...SAFE_ENV, JITK_VMM_BINARY: options.vmm, JITK_GROW_MODEL: metadata.models[model], JITK_GROW_CLI: process.env.JITK_GROW_CLI || 'codex', CODEX_HOME: process.env.CODEX_HOME || join(process.env.HOME || '', '.codex') }, timeout: 2400 });
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'driver.log'), Buffer.concat([result.stdout, result.stderr]));
  const paused = files(out).some((path) => path.endsWith('/paused.json'));
  const accepted = readOr<AttemptReport>(join(out, 'tx-' + target, 'report.json'), {}).accepted || false;
  const receipt: Experiment = { date: new Date().toISOString(), command, disk_before: disk, model: metadata.models[model], replicate: rep, source_commit: metadata.source_commit, controller_sha256: metadata.controller_sha256, wall_s: (performance.now() - started) / 1000, returncode: result.returncode, paused, accepted, protected_after: markers(), disk_after: await diskSpace(), uptime_after: load() };
  check(equal(receipt.protected_after, metadata.protected_before), 'protected markers changed');
  dump(path, receipt);
  console.log(runId, accepted ? 'PASS' : paused ? 'PAUSED' : 'FAIL');
  return receipt;
}
export async function runE1(options: RunOptions): Promise<void> {
  check(['pilot', 'main'].includes(options.phase), 'phase must be pilot or main');
  check(Number.isInteger(options.workers) && options.workers > 0, 'positive worker count');
  const n = options.phase === 'pilot' ? 2 : 10;
  const out = join(ROOT, 'results', options.prefix + '-experiment');
  mkdirSync(out, { recursive: true });
  const path = join(out, 'E1' + (options.phase === 'pilot' ? '-pilot' : ''));
  const cells = design(options.phase, n, options.prefix);
  const metadata: Metadata = { date: new Date().toISOString(), host: platform() + ' ' + release(), cli: await textCommand(['codex', '--version']), models: MODELS, source_commit: await textCommand(['git', 'rev-parse', 'HEAD']), controller_sha256: controllerHashes(), oracle_image: await textCommand(['docker', 'image', 'inspect', 'jitk-oracle:08', '--format', '{{.Id}}']), vmm_sha256: sha(options.vmm), sqlite_sha256: sha(options.sqlite), database_sha256: sha(options.database), disk_before: await diskSpace(), uptime_before: load(), protected_before: markers(), n_per_cell: n, workers: options.workers, seed: 20261026, phase: options.phase, design: cells, accounting: 'No interactive human coding during sampling. Prior profile/spec/API work is not measured; implementation-agent work is separate.' };
  const existing = readOr<Metadata | null>(path + '.json', null);
  if (existing) {
    for (const key of ['source_commit', 'controller_sha256', 'vmm_sha256', 'sqlite_sha256', 'database_sha256', 'oracle_image', 'protected_before', 'design', 'models']) {
      check(equal(existing[key], metadata[key]), 'resume pins changed: ' + key);
    }
    metadata.date = existing.date;
  }
  dump(path + '.json', metadata);
  const completed: Record<string, Experiment> = {};
  let next = 0;
  let halt = false;
  async function worker(): Promise<void> {
    while (!halt && next < cells.length) {
      const cell = cells[next++];
      const result = await runCell(cell, metadata, options);
      completed[cell[0]] = result;
      halt = halt || result.paused || existsSync(join(ROOT, 'experiments/STOP-E1'));
      const rows = cells.filter((cell) => Object.hasOwn(completed, cell[0])).flatMap((cell) => attemptRows(cell, metadata));
      writeFileSync(path + '.csv', csvEncode(rows, FIELDS));
    }
  }
  const workers: Promise<void>[] = [];
  for (let i = 0; i < options.workers; i += 1) {
    workers.push(worker());
  }
  const results = await Promise.allSettled(workers);
  metadata.completed = Object.keys(completed).length;
  metadata.accepted = Object.values(completed).filter((item) => item.accepted).length;
  metadata.paused = halt;
  metadata.disk_after = await diskSpace();
  dump(path + '.json', metadata);
  for (const result of results) {
    if (result.status === 'rejected') {
      throw new Error(detail(result.reason));
    }
  }
}
export async function runE0(options: RunOptions): Promise<void> {
  const out = join(ROOT, 'results', options.prefix + '-experiment');
  check(!existsSync(out), 'E0 output exists');
  mkdirSync(out, { recursive: true });
  const protectedBefore = markers();
  const environment = { date: new Date().toISOString(), host: platform() + ' ' + release(), model: 'gpt-6.1-sol', cli: await textCommand(['codex', '--version']), oracle_image: await textCommand(['docker', 'image', 'inspect', 'jitk-oracle:08', '--format', '{{.Id}}']), vmm_sha256: sha(options.vmm), git_head: await textCommand(['git', 'rev-parse', 'HEAD']), protected_before: protectedBefore, disk_before: await diskSpace() };
  dump(join(out, 'E0-environment.json'), environment);
  const rows: Record<string, unknown>[] = [];
  for (let index = 1; index <= 5; index += 1) {
    await diskSpace();
    const runId = options.prefix + '-' + String(index).padStart(2, '0');
    const runOut = join(ROOT, 'results', runId);
    const command = [join(ROOT, 'build/grow'), '--run-id', runId, '--validate-only', '--live', '--attempts', '1'];
    const start = performance.now();
    const result = await capture(command, { env: { ...SAFE_ENV, JITK_VMM_BINARY: options.vmm, JITK_GROW_MODEL: environment.model }, timeout: 2400 });
    const wall = (performance.now() - start) / 1000;
    mkdirSync(runOut, { recursive: true });
    writeFileSync(join(runOut, 'driver.log'), Buffer.concat([result.stdout, result.stderr]));
    dump(join(runOut, 'experiment.json'), { ...environment, command, returncode: result.returncode, wall_s: wall, protected_after: markers() });
    for (const target of ['ppoll', 'rt_sigaction', 'rt_sigprocmask']) {
      const tx = join(runOut, 'tx-' + target);
      const report = readOr<AttemptReport>(join(tx, 'report.json'), {});
      const attempt = join(tx, 'attempt-1');
      const stages = readOr<Record<string, { passed: boolean }>>(join(attempt, 'stages.json'), {});
      const proposal = readOr<{ source?: string }>(join(attempt, 'proposal.json'), {});
      const labels = Object.keys(stages);
      rows.push({ run_id: runId, date: environment.date, host: environment.host, model: environment.model, cli: environment.cli, spec_level: 'full', target, attempt: 1, accepted: Number(report.accepted || false), rejecting_gate: report.accepted ? '' : labels.length ? labels[labels.length - 1] : 'not_reached', visible_pass: Number(report.accepted || false), heldout_pass: Number(stages.heldout_candidate?.passed || false), mutants_rejected: report.acceptance?.mutations.length || 0, integration_pass: Number(report.accepted || false), wall_s: report.seconds ?? (existsSync(tx) ? wall : ''), cli_calls: report.cli_calls || 0, human_minutes: 'not_measured', handler_lines: proposal.source?.trimEnd().split('\n').length || '', human_lines: 0 });
    }
    writeFileSync(join(out, 'E0.csv'), csvEncode(rows, FIELDS));
    check(equal(markers(), protectedBefore), 'protected markers changed');
    if (files(runOut).some((path) => path.endsWith('/paused.json'))) {
      break;
    }
  }
  await diskSpace();
}
