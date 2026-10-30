// Re-records T2: runs the five programs against live GitHub Actions REST
// endpoints through the synthetic overlay in seed.ts (record mode, one
// recording per distinct call), replaces email addresses, and writes
// responses.jsonl(.gz), capture.json and seeded.json (the ids of everything
// synthetic).
//
//   node bench/v1/tasks/t2-ci-triage/capture.ts      (needs `gh auth login`)
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchTimed, getJson, query, requests, scrub, window } from '../lib/github.ts';
import { Recorder, Timed, writeResponses } from '../lib/record.ts';
import { readTask, TASKS } from '../lib/tasks.ts';
import { hostedUbuntu, IMAGE_VERSION, ROLLOUT_START, SEEDED, type Seed, seedJobs, seedLog, seedRun } from './seed.ts';

const id = 't2-ci-triage';
const task = readTask(id);

type Json = Record<string, any>;
type Args = Record<string, any>;

// Real full logs, fetched once per job; tails are cut from them.
const logs = new Map<number, Promise<{ text: string; ms: number; status: number }>>();
function fullLog(repo: string, jobId: number) {
  let entry = logs.get(jobId);
  if (!entry) {
    entry = fetchTimed(`/repos/${repo}/actions/jobs/${jobId}/logs`);
    logs.set(jobId, entry);
  }
  return entry;
}

// Seeds, keyed by repo; built on the first runs-list call for a seeded repo
// from the real latest completed run.
const seeds = new Map<string, Promise<Seed>>();
const seededJobs = new Map<number, { seed: Seed; jobs: Promise<{ jobs: Json[]; ms: number }> }>();
const seededLogs = new Map<number, { seed: Seed; job: Json }>();
const templates = new Map<string, Promise<{ text: string; ms: number }>>();

async function realJobs(repo: string, runId: number): Promise<{ jobs: Json[]; ms: number }> {
  const jobs: Json[] = [];
  let ms = 0;
  for (let page = 1; ; page++) {
    const r = await getJson(`/repos/${repo}/actions/runs/${runId}/jobs?per_page=100&page=${page}`);
    ms += r.ms;
    const body = r.value as Json;
    jobs.push(...body.jobs);
    if (jobs.length >= body.total_count || body.jobs.length === 0) break;
  }
  return { jobs, ms };
}

function seedFor(repo: string): Promise<Seed> {
  let seed = seeds.get(repo);
  if (!seed) {
    seed = (async () => {
      const [owner, name] = repo.split('/');
      const workflow = workflows.get(repo)!;
      const latest = (
        await getJson(
          `/repos/${owner}/${name}/actions/workflows/${workflow.file}/runs?branch=${workflow.branch}&status=completed&per_page=1`,
        )
      ).value;
      const made = await seedRun(repo, latest.workflow_runs[0]);
      const base = realJobs(repo, made.baseRun.id);
      const jobs = base.then(({ jobs, ms }) => ({ jobs: seedJobs(made, jobs), ms }));
      seededJobs.set(made.run.id, { seed: made, jobs });
      for (const job of (await jobs).jobs) seededLogs.set(job.id, { seed: made, job });
      // The log template: a real log of a hosted Ubuntu job that checks out code.
      const baseJobs = (await base).jobs;
      const templateJob = baseJobs.find(
        job =>
          job.conclusion === 'success' &&
          hostedUbuntu(job) &&
          job.steps.slice(0, 3).some((s: Json) => /checkout|check out/i.test(s.name)),
      );
      if (!templateJob) throw new Error(repo + ': no template job');
      templates.set(repo, fullLog(repo, templateJob.id));
      return made;
    })();
    seeds.set(repo, seed);
  }
  return seed;
}

const workflows = new Map<string, { file: string; branch: string }>([
  ['cli/cli', { file: 'go.yml', branch: 'trunk' }],
  ['eslint/eslint', { file: 'ci.yml', branch: 'main' }],
  ['neovim/neovim', { file: 'test.yml', branch: 'master' }],
]);

function tail(text: string, n: number) {
  const lines = text.replace(/\n$/, '').split('\n');
  const kept = lines.slice(Math.max(0, lines.length - n));
  return { total_lines: lines.length, returned_lines: kept.length, content: kept.join('\n') };
}

const recorder = new Recorder({
  github: {
    async listWorkflowRuns(args: Args) {
      const repo = `${args.owner}/${args.repo}`;
      const path =
        `/repos/${args.owner}/${args.repo}/actions/workflows/${args.workflow_id}/runs` +
        query(args, ['owner', 'repo', 'workflow_id']);
      const real = await getJson(path);
      if (!SEEDED.includes(repo)) return new Timed(real.value, real.ms);
      const seed = await seedFor(repo);
      const body = real.value as Json;
      if (body.workflow_runs[0]?.id !== seed.baseRun.id) throw new Error(repo + ': latest run changed during capture');
      const perPage = args.per_page ?? 30;
      const runs = [seed.run, ...body.workflow_runs].slice(0, perPage);
      return new Timed({ total_count: body.total_count + 1, workflow_runs: runs }, real.ms);
    },
    async listJobsForRun(args: Args) {
      const synthetic = seededJobs.get(args.run_id);
      const perPage = args.per_page ?? 30;
      const page = args.page ?? 1;
      if (synthetic) {
        const { jobs, ms } = await synthetic.jobs;
        return new Timed(
          { total_count: jobs.length, jobs: jobs.slice((page - 1) * perPage, page * perPage) },
          Math.round(ms / Math.ceil(jobs.length / 100)),
        );
      }
      const real = await getJson(
        `/repos/${args.owner}/${args.repo}/actions/runs/${args.run_id}/jobs` + query(args, ['owner', 'repo', 'run_id']),
      );
      return new Timed(real.value, real.ms);
    },
    async getJobLogs(args: Args) {
      const repo = `${args.owner}/${args.repo}`;
      const lines = args.tail_lines ?? 500;
      const synthetic = seededLogs.get(args.job_id);
      if (synthetic) {
        if (synthetic.job.conclusion !== 'failure') throw new Error('synthetic logs exist only for failed jobs');
        const template = await templates.get(repo)!;
        const text = seedLog(synthetic.seed, template.text, synthetic.job);
        return new Timed({ job_id: args.job_id, ...tail(text, lines) }, template.ms);
      }
      const log = await fullLog(repo, args.job_id);
      if (log.status !== 200)
        throw new Error(`GitHub ${log.status} for job ${args.job_id} logs: ${log.text.slice(0, 200)}`);
      return new Timed({ job_id: args.job_id, ...tail(log.text, lines) }, log.ms);
    },
  },
});

await recorder.runAll(id, task);
const calls = recorder.lines().map(call => ({ ...call, response: scrub(call.response) }));
const size = writeResponses(id, calls);

const seeded = [];
for (const [repo, seed] of seeds) {
  const made = await seed;
  const jobs = (await seededJobs.get(made.run.id)!.jobs).jobs;
  seeded.push({
    repo,
    baseRunId: made.baseRun.id,
    runId: made.run.id,
    headSha: made.run.head_sha,
    shiftMs: made.shiftMs,
    jobs: jobs.map(job => ({ id: job.id, baseId: job.id - 93_000_000, name: job.name, conclusion: job.conclusion })),
  });
}
writeFileSync(
  join(TASKS, id, 'seeded.json'),
  JSON.stringify({ rolloutStart: ROLLOUT_START, imageVersion: IMAGE_VERSION, seeded }, null, 2) + '\n',
);
writeFileSync(
  join(TASKS, id, 'capture.json'),
  JSON.stringify(
    {
      capturedFrom: window.first,
      capturedTo: window.last,
      api: 'https://api.github.com',
      apiVersion: '2022-11-28',
      githubRequests: window.paths.size,
      uncachedRequests: requests,
      calls: calls.length,
      ...size,
    },
    null,
    2,
  ) + '\n',
);
console.log(id, 'captured', calls.length, 'calls,', requests, 'requests,', size.bytes, 'bytes');
