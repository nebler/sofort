import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { check, csvDecode, dump, equal, files, hashBytes, readJSON, readOr, run, sha, treeHashes } from './lib.ts';
import { CANONICAL, ROOT, ASSETS } from './runtime.ts';
import { type Feedback } from './retries.ts';
import { type AttemptReport, type Cell, type Experiment, type Metadata } from './experiment-run.ts';

export interface Transaction {
  run_id: string;
  target: string;
  spec: string;
  model: string;
  accepted: boolean;
  at1: boolean;
  calls: number;
  seconds: number;
  attempts: Feedback[];
  paused: boolean;
}
export function phase(metaPath: string): Transaction[] {
  const metadata = readJSON<Metadata>(metaPath);
  const transactions: Transaction[] = [];
  for (const cell of metadata.design) {
    const [runId, target, spec, model] = cell;
    const out = join(ROOT, 'results', runId);
    const tx = readOr<AttemptReport | null>(join(out, 'tx-' + target, 'report.json'), null);
    const run = readOr<Experiment | null>(join(out, 'experiment.json'), null);
    if (tx && run) {
      transactions.push({ run_id: runId, target, spec, model, accepted: tx.accepted || false, at1: tx.acceptance_at_1 || false, calls: tx.cli_calls || 0, seconds: run.wall_s, attempts: tx.attempts || [], paused: run.paused });
    }
  }
  return transactions;
}
export function category(gate: string, diagnostic: string): string {
  if (gate === 'build_candidate') {
    if (diagnostic.includes('start of generic arguments')) {
      return 'Rust cast/comparison syntax';
    }
    return ['unresolved import', 'cannot find module', 'cannot find `fs`', 'cannot find function'].some((text) => diagnostic.includes(text)) ? 'Rust module/helper import' : 'Other Rust build error';
  }
  if (gate === 'headless_cli') {
    if (diagnostic.includes('max_output_tokens')) {
      return 'CLI response output-token limit';
    }
    return /timed out|timeout/.test(diagnostic) ? 'CLI timeout' : 'Other CLI response/transport error';
  }
  if (diagnostic.includes('fatal/incomplete')) {
    return 'Guest fatal/incomplete output protocol';
  }
  if (gate.startsWith('heldout') || gate.startsWith('semantic_error_state')) {
    // Read only the two outcome hex strings, accepting Python repr and JSON.
    const matches = [...diagnostic.matchAll(/["']stdout_hex["']\s*:\s*["']([0-9a-f]*)["']/g)];
    if (matches.length >= 2) {
      const linux = Buffer.from(matches[0][1], 'hex').toString().split('\n');
      const guest = Buffer.from(matches[1][1], 'hex').toString().split('\n');
      const differences = linux.filter((line, index) => index < guest.length && line !== guest[index]).map((line) => line.split('=')[0]);
      if (differences.some((line) => line.includes('fd-truncation'))) {
        return 'Held-out fd argument narrowing';
      }
      if (differences.some((line) => /readonly-time|count-boundary/.test(line))) {
        return 'Held-out validation/errno precedence';
      }
      if (differences.some((line) => line.startsWith('error.'))) {
        return 'Visible errno/pointer/count behavior';
      }
      if (differences.some((line) => line.includes('position') || line.startsWith('state.'))) {
        return 'Read/seek state behavior';
      }
    }
    return gate.startsWith('heldout') ? 'Held-out differential mismatch' : 'Visible differential mismatch';
  }
  return gate;
}
export function failureAnalysis(metaPaths: string[], output: string): void {
  const result: Record<string, unknown> = {};
  for (const metaPath of metaPaths) {
    const meta = readJSON<Metadata>(metaPath);
    const counts: Record<string, number> = {};
    const failures: unknown[] = [];
    for (const cell of meta.design) {
      for (const path of files(join(ROOT, 'results', cell[0])).filter((path) => path.endsWith('/rejection.json'))) {
        const value = readJSON<{ attempt: number; gate: string; detail: string }>(path);
        const label = category(value.gate, value.detail);
        counts[label] = (counts[label] || 0) + 1;
        failures.push({ run_id: cell[0], attempt: value.attempt, gate: value.gate, category: label });
      }
    }
    result[basename(metaPath).includes('pilot') ? 'pilot' : 'main'] = { counts, failures };
  }
  dump(output, result);
}
export async function sealReceipts(metaPath: string, artifacts: boolean): Promise<void> {
  const meta = readJSON<Metadata>(metaPath);
  const repo = (await run(['git', 'rev-parse', '--show-toplevel'])).stdout.toString().trim();
  const sourceNames = ['heldout-probe.c', 'profiles.ts', 'sqlite-profile.ts', 'sqlite-corpus.json', 'host-tests.ts', 'fs-probe.c', 'probe.ld', 'oracle-profile.ts', 'lib.ts'];
  const sources: Record<string, string> = {};
  const sourcePaths = sourceNames.map((name) => join(ROOT, name));
  sourcePaths.push(join(CANONICAL, 'tests/test_fs.py'));
  for (const source of sourcePaths) {
    const path = relative(repo, source);
    sources[path] = hashBytes((await run(['git', 'show', meta.source_commit + ':' + path])).stdout);
    check(sha(join(repo, path)) === sources[path], 'trusted source changed: ' + path);
  }
  for (const cell of meta.design) {
    const out = join(ROOT, 'results', cell[0]);
    if (!existsSync(join(out, 'experiment.json'))) {
      continue;
    }
    const paths = files(out);
    for (const path of paths.filter((path) => path.endsWith('/heldout/sealed.json'))) {
      const value = readJSON<{ source_sha256: string }>(path);
      check(value.source_sha256 === sources[relative(repo, join(ROOT, 'heldout-probe.c'))], 'held-out source changed');
    }
    const images = [...new Set(paths.filter((path) => path.endsWith('/oracle-image.json')).map((path) => readJSON<{ Id: string }>(path).Id))].sort();
    check(equal(images, [meta.oracle_image]), 'oracle image changed');
    dump(join(out, 'sealed-inputs.json'), { recorded_at: new Date().toISOString(), method: 'postprocessed from pinned source_commit Git blobs; verified against unchanged input files and held-out receipts', source_commit: meta.source_commit, trusted_sources_sha256: sources, oracle_images: images });
    if (artifacts) {
      const inventory: Record<string, { sha256: string; bytes: number }> = {};
      for (const path of files(out).filter((path) => basename(path) !== 'artifacts.json')) {
        inventory[relative(out, path)] = { sha256: sha(path), bytes: statSync(path).size };
      }
      dump(join(out, 'artifacts.json'), inventory);
    }
  }
}
export function verifyReceipts(metaPath: string, complete: boolean): { transactions: number; attempts: number } {
  const meta = readJSON<Metadata>(metaPath);
  const cells = meta.design;
  const counts: Record<string, number> = {};
  for (const cell of cells) {
    const key = cell.slice(1, 4).join('/');
    counts[key] = (counts[key] || 0) + 1;
  }
  check(Object.keys(counts).length === 18 && Object.values(counts).every((n) => n === meta.n_per_cell), 'invalid E1 denominators');
  check(new Set(cells.map((cell) => cell[0])).size === cells.length, 'duplicate run ID');
  const rows = existsSync(metaPath.replace(/\.json$/, '.csv')) ? csvDecode(readFileSync(metaPath.replace(/\.json$/, '.csv'), 'utf8')) : [];
  check(equal(Object.fromEntries(Object.keys(meta.protected_before).map((key) => [key, sha(join(ASSETS, key))])), meta.protected_before), 'protected markers changed');
  const canonical = treeHashes(CANONICAL);
  let transactions = 0;
  let expected = 0;
  for (const cell of cells) {
    const [runId, target, spec, model] = cell;
    const out = join(ROOT, 'results', runId);
    if (!existsSync(join(out, 'experiment.json'))) {
      continue;
    }
    transactions += 1;
    check(equal(readJSON<{ files: Record<string, string> }>(join(out, 'source.json')).files, canonical), 'canonical source pin mismatch');
    const tx = join(out, 'tx-' + target);
    const report = readJSON<AttemptReport>(join(tx, 'report.json'));
    const attempts = report.attempts || [];
    check(attempts.length >= 1 && attempts.length <= 3, 'attempt budget');
    check(report.accepted === attempts.some((item) => item.accepted), 'acceptance mismatch');
    check(report.acceptance_at_1 === attempts[0].accepted && report.acceptance_at_3 === report.accepted, 'acceptance-at-k mismatch');
    const run = readJSON<Experiment>(join(out, 'experiment.json'));
    const finalReport = readOr<{ host_sha256?: string }>(join(out, 'report.json'), {});
    if (report.accepted) {
      check(finalReport.host_sha256 === meta.vmm_sha256, 'VMM pin mismatch');
    }
    for (const path of files(out).filter((path) => path.endsWith('/oracle-image.json'))) {
      check(readJSON<{ Id: string }>(path).Id === meta.oracle_image, 'oracle image pin mismatch');
    }
    if (report.accepted) {
      check(run.returncode === 0 && readJSON<{ gate: string }>(join(out, 'report.json')).gate === 'PASS', 'final immutable-source/VMM gate failed');
    }
    check(run.command.includes('--validate-only'), 'non-validate-only run');
    check(equal(run.controller_sha256, meta.controller_sha256) && equal(run.protected_after, meta.protected_before), 'run pins changed');
    const actual = rows.filter((row) => row.run_id === runId);
    expected += attempts.length;
    check(actual.length === attempts.length, 'CSV attempt count');
    for (let i = 0; i < attempts.length; i += 1) {
      const item = attempts[i];
      const row = actual[i];
      check(Number(row.attempt) === item.attempt && Boolean(Number(row.accepted)) === item.accepted, 'CSV decision mismatch');
      const dest = join(tx, 'attempt-' + item.attempt);
      const prompt = join(dest, 'agent-prompt.txt');
      if (existsSync(prompt)) {
        const text = readFileSync(prompt, 'utf8');
        check(!text.includes(readFileSync(join(ROOT, 'heldout-probe.c'), 'utf8')), 'held-out source leaked');
        check(!['poll.sixteen', 'stat.unaligned', 'pread.fd-truncation'].some((marker) => text.includes(marker)), 'held-out marker leaked');
        const mode = readJSON<{ prompt_sha256: string; model: string; spec_level: string; transport: string }>(join(dest, 'agent-mode.json'));
        check(mode.prompt_sha256 === sha(prompt) && mode.model === meta.models[model] && mode.spec_level === spec && mode.transport === 'codex', 'proposal pins mismatch');
      }
      if (item.accepted) {
        check(row.visible_pass === '1' && row.heldout_pass === '1' && row.integration_pass === '1', 'accepted CSV gates');
        const accepted = readJSON<{ visible_pass: boolean; heldout_pass: boolean; mutations: { reasons: Record<string, string> }[] }>(join(dest, 'acceptance.json'));
        check(accepted.visible_pass && accepted.heldout_pass && accepted.mutations.length >= 2, 'accepted gates missing');
        check(accepted.mutations.every((m) => equal(Object.keys(m.reasons).sort(), ['heldout', 'visible'])), 'mutants must fail both probes');
      }
    }
  }
  check(rows.length === expected, 'CSV has extra/missing attempts');
  check(!complete || transactions === cells.length && !meta.paused, 'E1 incomplete');
  return { transactions, attempts: expected };
}
export function summarize(metaPaths: string[], output: string): void {
  const result: Record<string, Transaction[]> = {};
  const e0: Record<string, string>[] = [];
  for (const path of metaPaths) {
    if (basename(path) === 'E0-environment.json') {
      e0.push(...csvDecode(readFileSync(join(dirname(path), 'E0.csv'), 'utf8')));
    } else {
      result[basename(path).includes('pilot') ? 'pilot' : 'main'] = phase(path);
    }
  }
  const saved: Record<string, unknown> = {};
  for (const key of Object.keys(result)) {
    saved[key] = result[key];
  }
  if (e0.length) {
    saved.e0 = e0;
  }
  dump(output, saved);
  const parts = ['# Grow experiment summary', 'Functional results only. Transaction wall times include CLI latency; no VM performance claim is made.'];
  if (e0.length) {
    parts.push('| E0 run | Target | Accepted | Rejecting gate | CLI calls | Wall s |\n|---|---|---:|---|---:|---:|');
    for (const row of e0) {
      parts.push(`| ${row.run_id} | ${row.target} | ${row.accepted} | ${row.rejecting_gate} | ${row.cli_calls} | ${row.wall_s} |`);
    }
    parts.push('E0 human preparation time was not measured. Failed and not-reached targets remain in the table.');
  }
  for (const key of Object.keys(result)) {
    const transactions = result[key];
    parts.push(`${key}: ${transactions.length} completed, ${transactions.filter((tx) => tx.accepted).length} accepted.`);
    parts.push('| Model | Target | Spec | N | Accepted @1 | Accepted @3 | CLI calls | Wall s |\n|---|---|---|---:|---:|---:|---:|---:|');
    for (const model of ['old', 'new']) {
      for (const target of ['ppoll', 'fstat', 'pread64']) {
        for (const spec of ['full', 'terse', 'none']) {
          const rows = transactions.filter((tx) => tx.model === model && tx.target === target && tx.spec === spec);
          parts.push(`| ${model} | ${target} | ${spec} | ${rows.length} | ${rows.filter((r) => r.at1).length} | ${rows.filter((r) => r.accepted).length} | ${rows.reduce((n, r) => n + r.calls, 0)} | ${rows.reduce((n, r) => n + r.seconds, 0).toFixed(1)} |`);
        }
      }
    }
    parts.push('| Model | Spec (targets pooled) | N | Accepted @1 | Accepted @3 |\n|---|---|---:|---:|---:|');
    for (const model of ['old', 'new']) {
      for (const spec of ['full', 'terse', 'none']) {
        const rows = transactions.filter((tx) => tx.model === model && tx.spec === spec);
        parts.push(`| ${model} | ${spec} | ${rows.length} | ${rows.filter((tx) => tx.at1).length} | ${rows.filter((tx) => tx.accepted).length} |`);
      }
    }
    const gates: Record<string, number> = {};
    const finals: Record<string, number> = {};
    const usage: Record<string, number> = {};
    let metered = 0;
    for (const tx of transactions) {
      for (const attempt of tx.attempts.filter((a) => !a.accepted)) {
        gates[attempt.gate] = (gates[attempt.gate] || 0) + 1;
      }
      if (!tx.accepted && tx.attempts.length) {
        const gate = tx.attempts[tx.attempts.length - 1].gate;
        finals[gate] = (finals[gate] || 0) + 1;
      }
      for (const path of files(join(ROOT, 'results', tx.run_id)).filter((p) => p.endsWith('/agent-usage.json'))) {
        for (const entry of readJSON<(Record<string, number> | null)[]>(path)) {
          if (entry) {
            metered += 1;
            for (const name of Object.keys(entry)) {
              if (typeof entry[name] === 'number') {
                usage[name] = (usage[name] || 0) + entry[name];
              }
            }
          }
        }
      }
    }
    parts.push('Rejecting attempts: ' + JSON.stringify(gates) + '. Final failures: ' + JSON.stringify(finals) + '.');
    parts.push(`CLI usage (${metered} metered calls): ${JSON.stringify(usage)}. Cached/reasoning fields are subsets. No subscription balance or dollar cost is inferred.`);
  }
  const main = result.main || [];
  if (main.length === 180 && main.every((tx) => !tx.paused)) {
    const old = main.filter((tx) => tx.model === 'old' && tx.accepted).length;
    const newer = main.filter((tx) => tx.model === 'new' && tx.accepted).length;
    const terse = main.filter((tx) => tx.model === 'new' && tx.spec === 'terse');
    const terseAccepted = terse.filter((tx) => tx.accepted).length;
    const oldTerse = main.filter((tx) => tx.model === 'old' && tx.spec === 'terse' && tx.accepted).length;
    parts.push(`Terse-only new ${terseAccepted}/${terse.length}; old ${oldTerse}/30. Strictly higher at terse only: ${terseAccepted > oldTerse ? 'PASS' : 'FAIL'}.`);
    const passed = terseAccepted * 2 >= terse.length && newer > old;
    parts.push(`E1 all-spec pooled predicate: ${passed ? 'PASS' : 'NOT MET'}. New ${newer}/90; old ${old}/90. E2/E3 are untested; no statistically resolved amplifier claim follows.`);
  } else {
    parts.push('E1 incomplete; no decision-table outcome established.');
  }
  parts.push('No interactive human coding during sampling. Prior profile/spec/API preparation and implementation-agent authoring are separate, unmeasured work.');
  writeFileSync(output.replace(/\.json$/, '.md'), parts.join('\n\n').replace(/(\|)\n\n(?=\|)/g, '$1\n') + '\n');
}
export function renderSummary(input: string, output: string): void {
  const data = readJSON<Record<string, Transaction[]>>(input);
  check(data.pilot?.length === 36 && data.main?.length === 180, 'refuse incomplete measurements');
  const rows: string[] = [];
  for (const model of ['old', 'new']) {
    for (const spec of ['full', 'terse', 'none']) {
      const values: string[] = [];
      for (const phase of ['pilot', 'main']) {
        const txs = data[phase].filter((tx) => tx.model === model && tx.spec === spec);
        const n = phase === 'pilot' ? 6 : 30;
        check(txs.length === n, 'incomplete cell');
        values.push(`<td>${txs.filter((tx) => tx.at1).length}/${n}</td><td>${txs.filter((tx) => tx.accepted).length}/${n}</td>`);
      }
      rows.push(`<tr><th>${model === 'old' ? 'gpt-6-sol' : 'gpt-6.1-sol'}</th><td>${spec}</td>${values.join('')}</tr>`);
    }
  }
  writeFileSync(output, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:14px system-ui;margin:24px;line-height:1.5}table{border-collapse:collapse;font-variant-numeric:tabular-nums}td,th{padding:10px 16px;border-bottom:1px solid #bbb;text-align:right}th:first-child{text-align:left}</style></head><body><p>Functional acceptance. Pilot and main are separate samples; all attempts remain in the denominator.</p><table><thead><tr><th>Model</th><th>Spec</th><th>Pilot @1</th><th>Pilot @3</th><th>Main @1</th><th>Main @3</th></tr></thead><tbody>' + rows.join('') + '</tbody></table><p>Substantial human-written helpers and probes; no general Linux ABI equivalence or performance claim.</p></body></html>');
}
