async () => {
  const rollout = new Date('2026-10-29T06:00:00Z').getTime();
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

  // Small concurrency pool.
  async function pool(items, limit, fn) {
    const out = new Array(items.length);
    let next = 0;
    const workers = Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    });
    await Promise.all(workers);
    return out;
  }

  async function investigate([slug, workflow, branch]) {
    const [owner, repo] = slug.split('/');
    const runs = (await github.listWorkflowRuns({ owner, repo, workflow_id: workflow, branch, status: 'completed', per_page: 2 })).workflow_runs;
    if (runs.length < 2) return null;
    const [latest, before] = runs;
    if (latest.conclusion !== 'failure' || before.conclusion !== 'success') return null;
    if (new Date(latest.created_at).getTime() < rollout) return null;

    // Jobs, default page size of 30.
    let jobs = [];
    for (let page = 1; ; page++) {
      const r = await github.listJobsForRun({ owner, repo, run_id: latest.id, page });
      jobs = jobs.concat(r.jobs);
      if (r.jobs.length < 30) break;
    }
    const failed = jobs.filter(j => j.conclusion === 'failure');

    const lines = new Set();
    for (const job of failed) {
      const { content } = await github.getJobLogs({ owner, repo, job_id: job.id, tail_lines: 300 });
      for (let line of content.split('\n')) {
        line = line.replace(/^\uFEFF/, '');
        const sp = line.indexOf(' ');
        if (/^\d{4}-/.test(line) && sp > 0) line = line.slice(sp + 1);
        line = line.replace(/^##\[error\]/, '').trim();
        if (line.startsWith('Process completed with exit code')) continue;
        if (/(error|fatal|failed)/i.test(line)) lines.add(line);
      }
    }
    return { slug, runId: latest.id, failedJobIds: failed.map(j => j.id), lines };
  }

  const found = (await pool(repos, 4, investigate)).filter(Boolean);

  // Lines common to more than one failing repo.
  const by = new Map();
  for (const f of found) for (const l of f.lines) by.set(l, [...(by.get(l) || []), f.slug]);
  let sharedError = null;
  let sharedRepos = [];
  for (const [line, slugs] of by) {
    if (slugs.length >= 2 && slugs.length > sharedRepos.length) {
      sharedError = line;
      sharedRepos = slugs;
    }
  }

  return {
    affected: found.filter(f => sharedRepos.includes(f.slug)).map(f => ({ repo: f.slug, runId: f.runId, failedJobIds: f.failedJobIds })),
    sharedError,
    unrelated: found.filter(f => !sharedRepos.includes(f.slug)).map(f => f.slug),
  };
}
