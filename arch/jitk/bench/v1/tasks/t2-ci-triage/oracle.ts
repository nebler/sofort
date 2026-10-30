// T2 oracle: recomputes the regressed repositories, their failed jobs, and the
// error lines their failed-job logs share, from every recorded runs list, job
// page and log tail. It does not use seeded.json; check.ts and README.md
// compare the result with the seed separately.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROLLOUT = Date.parse('2026-10-29T06:00:00Z');

interface Expected {
  affected: Map<string, { runId: number; failedJobIds: Set<number> }>;
  unrelated: Set<string>;
  shared: string[]; // normalized error lines common to every affected repo and no other
}

export function normalize(line: string): string {
  return line
    .replace(/^\uFEFF/, '')
    .replace(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z ?/, '')
    .replace(/^##\[error\]/, '')
    .trim();
}

function isErrorLine(line: string): boolean {
  return /\b(error|fatal|failed)\b/i.test(line) && !/^Process completed with exit code \d+\.?$/.test(line);
}

let cached: Expected | undefined;

export function expected(): Expected {
  if (cached) return cached;
  const runs = new Map<string, any[]>();
  const jobs = new Map<number, Map<number, any>>();
  const totals = new Map<number, number>();
  const logs = new Map<number, string>();
  for (const line of readFileSync(join(HERE, 'responses.jsonl'), 'utf8').split('\n')) {
    if (!line) continue;
    const call = JSON.parse(line);
    if (call.error !== undefined) continue;
    const args = call.args[0];
    if (call.tool === 'listWorkflowRuns') {
      runs.set(args.owner + '/' + args.repo, call.response.workflow_runs);
    } else if (call.tool === 'listJobsForRun') {
      const seen = jobs.get(args.run_id) ?? new Map();
      for (const job of call.response.jobs) seen.set(job.id, job);
      jobs.set(args.run_id, seen);
      totals.set(args.run_id, call.response.total_count);
    } else if (call.tool === 'getJobLogs') {
      const previous = logs.get(args.job_id);
      if (previous === undefined || call.response.content.length > previous.length) {
        logs.set(args.job_id, call.response.content);
      }
    }
  }

  const candidates = new Map<string, { runId: number; failed: number[]; lines: Set<string> }>();
  for (const [repo, list] of runs) {
    const sorted = [...list].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    const [latest, previous] = sorted;
    if (!latest || !previous) continue;
    if (latest.conclusion !== 'failure' || previous.conclusion !== 'success') continue;
    if (Date.parse(latest.created_at) < ROLLOUT) continue;
    const runJobs = jobs.get(latest.id);
    if (!runJobs || runJobs.size !== totals.get(latest.id)) throw new Error('recording lacks jobs of ' + repo);
    const failed = [...runJobs.values()].filter(job => job.conclusion === 'failure').map(job => job.id);
    const lines = new Set<string>();
    for (const id of failed) {
      for (const raw of (logs.get(id) ?? '').split('\n')) {
        const text = normalize(raw);
        if (isErrorLine(text)) lines.add(text);
      }
    }
    candidates.set(repo, { runId: latest.id, failed, lines });
  }

  // The shared cause: the error lines found in the most candidate repos (at
  // least two). The affected repos are the ones whose logs contain them.
  const reach = new Map<string, Set<string>>();
  for (const [repo, c] of candidates) {
    for (const text of c.lines) {
      const set = reach.get(text) ?? new Set<string>();
      set.add(repo);
      reach.set(text, set);
    }
  }
  const most = Math.max(0, ...[...reach.values()].map(set => set.size));
  if (most < 2) throw new Error('no shared error line');
  const shared = [...reach.entries()].filter(([, set]) => set.size === most);
  const affectedRepos = new Set(shared[0][1]);
  for (const [, set] of shared) {
    if ([...set].sort().join() !== [...affectedRepos].sort().join()) throw new Error('ambiguous shared cause');
  }
  const affected = new Map<string, { runId: number; failedJobIds: Set<number> }>();
  const unrelated = new Set<string>();
  for (const [repo, c] of candidates) {
    if (affectedRepos.has(repo)) affected.set(repo, { runId: c.runId, failedJobIds: new Set(c.failed) });
    else unrelated.add(repo);
  }
  cached = { affected, unrelated, shared: shared.map(([text]) => text) };
  return cached;
}

function sameSet<T>(a: Iterable<T>, b: Set<T>): boolean {
  const list = [...a];
  return list.length === b.size && new Set(list).size === b.size && list.every(item => b.has(item));
}

export function check(result: unknown): { ok: boolean; reason: string } {
  const want = expected();
  const got = result as { affected?: any[]; sharedError?: unknown; unrelated?: unknown };
  if (!got || typeof got !== 'object' || !Array.isArray(got.affected)) return { ok: false, reason: 'no affected list' };
  const repos = got.affected.map(item => item?.repo);
  if (!sameSet(repos, new Set(want.affected.keys()))) {
    return {
      ok: false,
      reason: 'affected ' + JSON.stringify(repos) + ' != ' + JSON.stringify([...want.affected.keys()]),
    };
  }
  for (const item of got.affected) {
    const w = want.affected.get(item.repo)!;
    if (item.runId !== w.runId) return { ok: false, reason: item.repo + ' runId ' + item.runId + ' != ' + w.runId };
    if (!Array.isArray(item.failedJobIds) || !sameSet(item.failedJobIds, w.failedJobIds)) {
      return { ok: false, reason: item.repo + ' failedJobIds differ (want ' + w.failedJobIds.size + ')' };
    }
  }
  if (!Array.isArray(got.unrelated) || !sameSet(got.unrelated, want.unrelated)) {
    return {
      ok: false,
      reason: 'unrelated ' + JSON.stringify(got.unrelated) + ' != ' + JSON.stringify([...want.unrelated]),
    };
  }
  const text = typeof got.sharedError === 'string' ? normalize(got.sharedError) : '';
  const matches = want.shared.some(
    line => text === line || (text.length >= 20 && (line.includes(text) || text.includes(line))),
  );
  if (!matches)
    return {
      ok: false,
      reason: 'sharedError ' + JSON.stringify(got.sharedError) + ' not one of ' + JSON.stringify(want.shared),
    };
  return { ok: true, reason: want.affected.size + ' affected, ' + want.unrelated.size + ' unrelated' };
}

export default check;
