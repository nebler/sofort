// The one synthetic part of T2: a runner-image rollout (ubuntu-24.04
// 20261028.371.1) whose git lacks the https remote helper, so actions/checkout
// fails in every GitHub-hosted Ubuntu job that checks out code. It is applied to
// the three SEEDED repositories as one extra, newest workflow run, cloned from
// the repository's real latest completed run. Everything else in T2 is real.
// README.md lists each synthetic field.

export const ROLLOUT_START = '2026-10-29T06:00:00Z';
export const IMAGE_VERSION = '20261028.371.1';
const IMAGE_TAG = '20261028.371';
const GIT_VERSION = 'git version 2.56.1';
export const SEEDED = ['eslint/eslint', 'neovim/neovim', 'cli/cli'];

// Fixed id offsets: synthetic runs and jobs get ids a few hours of GitHub id
// growth above the run/job they were cloned from.
const RUN_ID_OFFSET = 31_000_000;
const CHECK_SUITE_OFFSET = 52_000_000;
const JOB_ID_OFFSET = 93_000_000;

type Json = Record<string, any>;

const DEPENDABOT = {
  login: 'dependabot[bot]',
  id: 49699333,
  node_id: 'MDM6Qm90NDk2OTkzMzM=',
  avatar_url: 'https://avatars.githubusercontent.com/in/29110?v=4',
  gravatar_id: '',
  url: 'https://api.github.com/users/dependabot%5Bbot%5D',
  html_url: 'https://github.com/apps/dependabot',
  followers_url: 'https://api.github.com/users/dependabot%5Bbot%5D/followers',
  following_url: 'https://api.github.com/users/dependabot%5Bbot%5D/following{/other_user}',
  gists_url: 'https://api.github.com/users/dependabot%5Bbot%5D/gists{/gist_id}',
  starred_url: 'https://api.github.com/users/dependabot%5Bbot%5D/starred{/owner}{/repo}',
  subscriptions_url: 'https://api.github.com/users/dependabot%5Bbot%5D/subscriptions',
  organizations_url: 'https://api.github.com/users/dependabot%5Bbot%5D/orgs',
  repos_url: 'https://api.github.com/users/dependabot%5Bbot%5D/repos',
  events_url: 'https://api.github.com/users/dependabot%5Bbot%5D/events{/privacy}',
  received_events_url: 'https://api.github.com/users/dependabot%5Bbot%5D/received_events',
  type: 'Bot',
  user_view_type: 'public',
  site_admin: false,
};

function iso(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// Deterministic fake commit sha from a label.
async function fakeSha(label: string): Promise<string> {
  const { createHash } = await import('node:crypto');
  return createHash('sha1')
    .update('sofort-bench-t2:' + label)
    .digest('hex');
}

export interface Seed {
  repo: string;
  baseRun: Json; // the real latest completed run (success)
  run: Json; // the synthetic run
  shiftMs: number; // synthetic time minus base time
}

// The synthetic run starts halfway between the end of the real latest run and
// SEED_CLOCK, just before the capture (2026-10-30 20:20-20:21 UTC).
const SEED_CLOCK = Date.parse('2026-10-30T20:20:00Z');
export async function seedRun(repo: string, baseRun: Json): Promise<Seed> {
  if (baseRun.conclusion !== 'success') throw new Error(repo + ': latest completed run is not a success');
  const baseStart = Date.parse(baseRun.run_started_at);
  const startMs = Math.floor((Date.parse(baseRun.updated_at) + SEED_CLOCK) / 2 / 1000) * 1000;
  const shiftMs = startMs - baseStart;
  const id = baseRun.id + RUN_ID_OFFSET;
  const suite = baseRun.check_suite_id + CHECK_SUITE_OFFSET;
  const sha = await fakeSha(repo + ':head');
  const tree = await fakeSha(repo + ':tree');
  let text = JSON.stringify(baseRun);
  text = text.split(String(baseRun.id)).join(String(id));
  text = text.split(String(baseRun.check_suite_id)).join(String(suite));
  text = text.split(baseRun.head_sha).join(sha);
  const run = JSON.parse(text);
  const title = 'build(deps-dev): bump the dev-dependencies group with 2 updates';
  run.run_number = baseRun.run_number + 1;
  run.run_attempt = 1;
  run.event = 'push';
  run.display_title = title;
  run.status = 'completed';
  run.conclusion = 'failure';
  run.pull_requests = [];
  run.previous_attempt_url = null;
  run.created_at = iso(startMs);
  run.run_started_at = iso(startMs);
  run.updated_at = iso(startMs + 74_000);
  run.actor = DEPENDABOT;
  run.triggering_actor = DEPENDABOT;
  run.head_commit = {
    id: sha,
    tree_id: tree,
    message: title,
    timestamp: iso(startMs - 41_000),
    author: { name: 'dependabot[bot]', email: '49699333+dependabot[bot]@users.noreply.github.com' },
    committer: { name: 'GitHub', email: 'noreply@github.com' },
  };
  return { repo, baseRun, run, shiftMs };
}

function isCheckout(step: Json): boolean {
  return /checkout|check out/i.test(step.name);
}

// The rollout is the x64 ubuntu-24.04 image (ubuntu-latest); arm64 and
// self-hosted runners keep their real results.
export function hostedUbuntu(job: Json): boolean {
  return job.labels.some((label: string) => label === 'ubuntu-latest' || label === 'ubuntu-24.04');
}

// Jobs of the synthetic run, cloned from the base run's real jobs. Hosted
// Ubuntu jobs that check out code fail at checkout; hosted Ubuntu jobs that
// do not (they consume another job's artifact) are skipped; other jobs keep
// their real result with shifted times.
export function seedJobs(seed: Seed, baseJobs: Json[]): Json[] {
  return baseJobs.map(base => {
    const id = base.id + JOB_ID_OFFSET;
    let text = JSON.stringify(base);
    text = text.split(String(base.id)).join(String(id));
    text = text.split(String(seed.baseRun.id)).join(String(seed.run.id));
    text = text.split(seed.baseRun.head_sha).join(seed.run.head_sha);
    const job = JSON.parse(text);
    const shift = (t: string | null) => (t ? iso(Date.parse(t) + seed.shiftMs) : t);
    job.created_at = shift(base.created_at);
    job.started_at = shift(base.started_at);
    job.completed_at = shift(base.completed_at);
    job.run_attempt = 1;
    for (const step of job.steps) {
      step.started_at = shift(step.started_at);
      step.completed_at = shift(step.completed_at);
    }
    if (!hostedUbuntu(base)) return job;
    const checkoutIndex = job.steps.findIndex(isCheckout);
    if (checkoutIndex < 0 || checkoutIndex > 2) {
      job.conclusion = 'skipped';
      job.started_at = job.created_at;
      job.completed_at = job.created_at;
      job.steps = [];
      job.runner_id = 0;
      job.runner_name = '';
      job.runner_group_id = 0;
      job.runner_group_name = '';
      return job;
    }
    const start = Date.parse(job.started_at);
    const failedAt = start + 38_000 + (id % 7) * 1000;
    const end = failedAt + 2_000;
    job.status = 'completed';
    job.conclusion = 'failure';
    job.completed_at = iso(end);
    job.steps = job.steps.map((step: Json, index: number) => {
      const out = { ...step, status: 'completed' };
      if (index < checkoutIndex) return { ...out, conclusion: 'success' };
      if (index === checkoutIndex) {
        return { ...out, conclusion: 'failure', started_at: iso(start + 2_000), completed_at: iso(failedAt) };
      }
      const post = /^Post .*checkout|^Complete job$/i.test(step.name);
      return {
        ...out,
        conclusion: post ? 'success' : 'skipped',
        started_at: iso(post ? failedAt : end),
        completed_at: iso(post ? end : end),
      };
    });
    return job;
  });
}

// A log for a failed synthetic job, built from a real log of a hosted Ubuntu
// job in the base run: its setup and checkout lines up to the fetch command
// (image version and git version replaced, times shifted), three failed fetch
// attempts the way actions/checkout retries, then the real log's post-job
// cleanup lines of actions/checkout.
export function seedLog(seed: Seed, templateLog: string, job: Json): string {
  const lines = templateLog
    .replace(/^\uFEFF/, '')
    .split(seed.baseRun.head_sha)
    .join(seed.run.head_sha)
    .split(/\r?\n/);
  const stamp = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z) (.*)$/;
  const fetchIndex = lines.findIndex(line => /\[command\]\/usr\/bin\/git .* fetch /.test(line));
  // Post steps run in reverse order, so the last one is checkout's: the only
  // post step of a job that failed at checkout.
  const postIndex = lines.findLastIndex(line => / Post job cleanup\.$/.test(line));
  if (fetchIndex < 0 || postIndex < 0) throw new Error(seed.repo + ': template log lacks fetch or cleanup lines');
  const t0 = Date.parse(job.started_at);
  const templateStart = Date.parse((stamp.exec(lines[0]) ?? [])[1] ?? '');
  const head = lines.slice(0, fetchIndex + 1).map(line => {
    const m = stamp.exec(line);
    if (!m) return line;
    let body = m[2];
    body = body.replace(/^Version: \d{8}\.\d+\.\d+$/, 'Version: ' + IMAGE_VERSION);
    body = body.replace(/ubuntu24\/\d{8}\.\d+\//, 'ubuntu24/' + IMAGE_TAG + '/');
    body = body.replace(/ubuntu24%2F\d{8}\.\d+$/, 'ubuntu24%2F' + IMAGE_TAG);
    body = body.replace(/^git version .*$/, GIT_VERSION);
    body = body.replace(/^Complete job name: .*$/, 'Complete job name: ' + job.name);
    return stampAt(t0 + (Date.parse(m[1]) - templateStart), m[1], body);
  });
  const fetch = (stamp.exec(lines[fetchIndex]) ?? [])[2] ?? '';
  const failure: string[] = [];
  let t = t0 + (Date.parse((stamp.exec(lines[fetchIndex]) ?? [])[1]) - templateStart);
  const waits = [11 + (job.id % 9), 14 + (job.id % 7)];
  const after = (ms: number, body: string) => {
    t += ms;
    failure.push(stampAt(t, '', body));
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) after(3, fetch);
    after(180 + (job.id % 50), "fatal: unable to find remote helper for 'https'");
    if (attempt < 2) {
      after(2, "The process '/usr/bin/git' failed with exit code 128");
      after(1, `Waiting ${waits[attempt]} seconds before trying again`);
      t += waits[attempt] * 1000;
    }
  }
  after(2, "##[error]The process '/usr/bin/git' failed with exit code 128");
  const postStart = Date.parse((stamp.exec(lines[postIndex]) ?? [])[1]);
  const tail = lines
    .slice(postIndex)
    .filter(line => line.length > 0)
    .map(line => {
      const m = stamp.exec(line);
      if (!m) return line;
      return stampAt(t + 400 + (Date.parse(m[1]) - postStart), m[1], m[2].replace(/^git version .*$/, GIT_VERSION));
    });
  return '\uFEFF' + [...head, ...failure, ...tail].join('\n') + '\n';
}

// ISO timestamp with the 7-digit fraction GitHub logs use; the sub-ms digits
// are kept from the template line when there is one.
function stampAt(ms: number, template: string, body: string): string {
  const base = new Date(Math.round(ms)).toISOString().slice(0, 23);
  const extra = /\.\d{3}(\d{4})Z$/.exec(template)?.[1] ?? String(Math.round(ms * 7919) % 10000).padStart(4, '0');
  return base + extra + 'Z ' + body;
}
