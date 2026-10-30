async () => {
  const SINCE = new Date('2026-10-29T06:00:00Z');
  const REPOS = [
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

  const stripTimestamp = s => s.replace(/^\uFEFF?\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z\s*/, '');
  const isGeneric = s => /^##\[error\]Process completed with exit code \d+\.?$/.test(s);
  const looksLikeError = s => /(^##\[error\])|(\bfatal:)|(\berror\b)|(\bfailed\b)/i.test(s);

  const candidates = [];
  // Process in batches of 6 repos to keep concurrency reasonable.
  for (let i = 0; i < REPOS.length; i += 6) {
    const batch = REPOS.slice(i, i + 6);
    const results = await Promise.all(
      batch.map(([slug, workflow_id, branch]) => {
        const [owner, repo] = slug.split('/');
        return github
          .listWorkflowRuns({ owner, repo, workflow_id, branch, status: 'completed', per_page: 2 })
          .then(r => ({ slug, owner, repo, runs: r.workflow_runs }));
      })
    );
    for (const r of results) {
      const [cur, prev] = r.runs;
      if (cur && prev && cur.conclusion === 'failure' && prev.conclusion === 'success' && new Date(cur.created_at) >= SINCE) {
        candidates.push({ ...r, run: cur });
      }
    }
  }

  for (const c of candidates) {
    const jobs = [];
    let page = 1;
    let total = Infinity;
    while (jobs.length < total) {
      const r = await github.listJobsForRun({ owner: c.owner, repo: c.repo, run_id: c.run.id, filter: 'latest', per_page: 100, page: page++ });
      total = r.total_count;
      if (!r.jobs.length) break;
      jobs.push(...r.jobs);
    }
    c.failed = jobs.filter(j => j.conclusion === 'failure');
    // Two failed jobs per repo are enough to see the error.
    const sample = c.failed.slice(0, 2);
    const tails = await Promise.all(
      sample.map(j => github.getJobLogs({ owner: c.owner, repo: c.repo, job_id: j.id, tail_lines: 100 }))
    );
    c.errors = new Set();
    for (const t of tails) {
      for (const line of t.content.split('\n').map(stripTimestamp)) {
        if (looksLikeError(line) && !isGeneric(line)) c.errors.add(line.replace(/^##\[error\]/, '').trim());
      }
    }
  }

  // Lines that appear in at least two repos; pick the most common, then the most specific (longest).
  const seenIn = {};
  for (const c of candidates) for (const e of c.errors) (seenIn[e] ||= new Set()).add(c.slug);
  const shared = Object.entries(seenIn)
    .filter(([, s]) => s.size >= 2)
    .sort((a, b) => b[1].size - a[1].size || b[0].length - a[0].length);
  const sharedError = shared.length ? shared[0][0] : null;
  const affectedSlugs = sharedError ? seenIn[sharedError] : new Set();

  return {
    affected: candidates
      .filter(c => affectedSlugs.has(c.slug))
      .map(c => ({ repo: c.slug, runId: c.run.id, failedJobIds: c.failed.map(j => j.id) })),
    sharedError,
    unrelated: candidates.filter(c => !affectedSlugs.has(c.slug)).map(c => c.slug),
  };
}
