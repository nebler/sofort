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

  // Gather everything up front: latest runs and the jobs of the latest run for every repo,
  // so we can look across all of them.
  const data = await Promise.all(
    repos.map(async ([slug, workflow_id, branch]) => {
      const [owner, repo] = slug.split('/');
      const { workflow_runs: runs } = await github.listWorkflowRuns({
        owner, repo, workflow_id, branch, status: 'completed', per_page: 2,
      });
      let jobs = [];
      if (runs[0]) {
        const settled = await Promise.allSettled([
          github.listJobsForRun({ owner, repo, run_id: runs[0].id, filter: 'all', per_page: 100 }),
        ]);
        if (settled[0].status === 'fulfilled') {
          jobs = settled[0].value.jobs;
          // Fetch remaining pages if any.
          let page = 2;
          while (jobs.length < settled[0].value.total_count) {
            const more = await github.listJobsForRun({ owner, repo, run_id: runs[0].id, filter: 'all', per_page: 100, page });
            if (!more.jobs.length) break;
            jobs = jobs.concat(more.jobs);
            page++;
          }
        }
      }
      return { slug, owner, repo, runs, jobs };
    })
  );

  const regressed = data.filter(
    d => d.runs.length >= 2 && d.runs[0].conclusion === 'failure' && d.runs[1].conclusion === 'success' && d.runs[0].created_at >= ROLLOUT
  );

  // Full default-size log tails for every failed job.
  for (const d of regressed) {
    d.failed = d.jobs.filter(j => j.conclusion === 'failure');
    d.logs = await Promise.all(d.failed.map(j => github.getJobLogs({ owner: d.owner, repo: d.repo, job_id: j.id })));
  }

  const normalize = line => line.replace(/^\uFEFF/, '').replace(/^\d{4}-\d\d-\d\dT\S+Z /, '').replace(/^##\[error\]/, '').trim();
  const perRepo = new Map();
  for (const d of regressed) {
    const lines = new Set();
    for (const log of d.logs) {
      for (const l of log.content.split('\n')) {
        const n = normalize(l);
        if (!n || /^Process completed with exit code/.test(n)) continue;
        if (/fatal|error|failed/i.test(n)) lines.add(n);
      }
    }
    perRepo.set(d.slug, lines);
  }

  const tally = new Map();
  for (const lines of perRepo.values()) for (const l of lines) tally.set(l, (tally.get(l) || 0) + 1);
  const top = [...tally].sort((a, b) => b[1] - a[1])[0];
  const sharedError = top && top[1] > 1 ? top[0] : null;

  const affected = regressed.filter(d => sharedError && perRepo.get(d.slug).has(sharedError));
  return {
    affected: affected.map(d => ({ repo: d.slug, runId: d.runs[0].id, failedJobIds: d.failed.map(j => j.id) })),
    sharedError,
    unrelated: regressed.filter(d => !affected.includes(d)).map(d => d.slug),
  };
}
