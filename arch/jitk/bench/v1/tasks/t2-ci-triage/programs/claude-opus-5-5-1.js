async () => {
  const ROLLOUT = '2026-10-29T06:00:00Z';
  const repos = [
    ['cli/cli', 'go.yml', 'trunk'],
    ['astral-sh/uv', 'ci.yml', 'main'],
    ['astral-sh/ruff', 'ci.yaml', 'main'],
    ['vitejs/vite', 'ci.yml', 'main'],
    ['microsoft/TypeScript', 'ci.yml', 'main'],
    ['pallets/flask', 'tests.yaml', 'main'],
    ['tokio-rs/tokio', 'ci.yml', 'master'],
    ['BurntSushi/ripgrep', 'ci.yml', 'master'],
    ['sharkdp/bat', 'CICD.yml', 'master'],
    ['eslint/eslint', 'ci.yml', 'main'],
    ['honojs/hono', 'ci.yml', 'main'],
    ['withastro/astro', 'ci.yml', 'main'],
    ['sveltejs/svelte', 'ci.yml', 'main'],
    ['vuejs/core', 'ci.yml', 'main'],
    ['tailwindlabs/tailwindcss', 'ci.yml', 'main'],
    ['biomejs/biome', 'main.yml', 'main'],
    ['nushell/nushell', 'ci.yml', 'main'],
    ['neovim/neovim', 'test.yml', 'master'],
    ['pydantic/pydantic', 'ci.yml', 'main'],
    ['psf/black', 'test.yml', 'main'],
    ['caddyserver/caddy', 'ci.yml', 'master'],
    ['gohugoio/hugo', 'test.yml', 'master'],
    ['jqlang/jq', 'ci.yml', 'master'],
    ['curl/curl', 'linux.yml', 'master'],
  ];

  // 1. Find repos whose latest completed run failed right after a success.
  const failing = [];
  for (const [full, workflow, branch] of repos) {
    const [owner, repo] = full.split('/');
    const res = await github.listWorkflowRuns({ owner, repo, workflow_id: workflow, branch, status: 'completed', per_page: 2 });
    const [latest, previous] = res.workflow_runs;
    if (!latest || !previous) continue;
    if (latest.conclusion === 'failure' && previous.conclusion === 'success' && latest.created_at >= ROLLOUT) {
      failing.push({ repo: full, owner, name: repo, run: latest });
    }
  }

  // 2. Failed jobs and the error lines in their logs.
  const clean = line => line.replace(/^\uFEFF?\d{4}-\d\d-\d\dT[\d:.]+Z ?/, '').replace(/^##\[error\]/, '').trim();
  for (const f of failing) {
    const jobs = [];
    for (let page = 1; ; page++) {
      const res = await github.listJobsForRun({ owner: f.owner, repo: f.name, run_id: f.run.id, per_page: 100, page });
      jobs.push(...res.jobs);
      if (jobs.length >= res.total_count || res.jobs.length === 0) break;
    }
    f.failedJobs = jobs.filter(j => j.conclusion === 'failure');
    f.errors = new Set();
    for (const job of f.failedJobs) {
      const log = await github.getJobLogs({ owner: f.owner, repo: f.name, job_id: job.id, tail_lines: 200 });
      for (const line of log.content.split('\n')) {
        const text = clean(line);
        if (/error|fatal|failed/i.test(text) && !/Process completed with exit code/i.test(text)) f.errors.add(text);
      }
    }
  }

  // 3. The error line shared by the most repos is the common cause.
  const counts = new Map();
  for (const f of failing) for (const e of f.errors) counts.set(e, (counts.get(e) || 0) + 1);
  let sharedError = null;
  let best = 1;
  for (const [line, n] of counts) {
    if (n > best) {
      best = n;
      sharedError = line;
    }
  }

  const affected = failing.filter(f => sharedError && f.errors.has(sharedError));
  return {
    affected: affected.map(f => ({ repo: f.repo, runId: f.run.id, failedJobIds: f.failedJobs.map(j => j.id) })),
    sharedError,
    unrelated: failing.filter(f => !affected.includes(f)).map(f => f.repo),
  };
}
