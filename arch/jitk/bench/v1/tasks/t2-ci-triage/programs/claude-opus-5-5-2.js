async () => {
  const rolloutStart = Date.parse('2026-10-29T06:00:00Z');
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

  // Fetch the two latest completed runs of every repo in parallel.
  const latestRuns = await Promise.all(
    repos.map(async ([full, workflow_id, branch]) => {
      const [owner, repo] = full.split('/');
      const { workflow_runs } = await github.listWorkflowRuns({
        owner,
        repo,
        workflow_id,
        branch,
        status: 'completed',
        per_page: 2,
      });
      return { full, owner, repo, runs: workflow_runs };
    })
  );

  const regressed = latestRuns.filter(
    ({ runs }) =>
      runs.length === 2 &&
      runs[0].conclusion === 'failure' &&
      runs[1].conclusion === 'success' &&
      Date.parse(runs[0].created_at) >= rolloutStart
  );

  async function allJobs(owner, repo, run_id) {
    const out = [];
    let page = 1;
    while (true) {
      const { total_count, jobs } = await github.listJobsForRun({ owner, repo, run_id, per_page: 100, page });
      out.push(...jobs);
      if (out.length >= total_count || jobs.length === 0) return out;
      page++;
    }
  }

  const details = await Promise.all(
    regressed.map(async r => {
      const run = r.runs[0];
      const failedJobs = (await allJobs(r.owner, r.repo, run.id)).filter(j => j.conclusion === 'failure');
      const logs = await Promise.all(
        failedJobs.map(j => github.getJobLogs({ owner: r.owner, repo: r.repo, job_id: j.id }))
      );
      const errorLines = new Set();
      for (const log of logs) {
        for (const raw of log.content.split('\n')) {
          const line = raw
            .replace(/^\uFEFF/, '')
            .replace(/^\S+Z /, '')
            .replace('##[error]', '')
            .trim();
          if (!line || /exit code 1\.?$/.test(line) && /Process completed/.test(line)) continue;
          if (/\b(error|fatal|failed)\b/i.test(line)) errorLines.add(line);
        }
      }
      return { repo: r.full, runId: run.id, failedJobIds: failedJobs.map(j => j.id), errorLines };
    })
  );

  const repoCount = new Map();
  for (const d of details) {
    for (const line of d.errorLines) repoCount.set(line, (repoCount.get(line) ?? 0) + 1);
  }
  const ranked = [...repoCount.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]);
  const sharedError = ranked.length ? ranked[0][0] : null;

  const affected = details.filter(d => sharedError && d.errorLines.has(sharedError));
  const unrelated = details.filter(d => !affected.includes(d)).map(d => d.repo);

  return {
    affected: affected.map(({ repo, runId, failedJobIds }) => ({ repo, runId, failedJobIds })),
    sharedError,
    unrelated,
  };
}
