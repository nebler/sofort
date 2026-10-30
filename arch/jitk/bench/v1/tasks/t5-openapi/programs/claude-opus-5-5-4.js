async () => {
  // Look at the whole catalog of repository operations, then read the full
  // definitions of every plausible candidate before deciding.
  const catalog = await openapi.listOperations({});
  const candidates = catalog.operations.filter(
    o => o.method === 'GET' && /\{owner\}\/\{repo\}\/(community|releases)/.test(o.path)
  );
  const details = await Promise.all(candidates.map(c => openapi.getOperation({ operationId: c.operationId })));
  const searchBoth = await Promise.all([
    openapi.search({ query: 'community profile', limit: 50 }),
    openapi.search({ query: 'releases', limit: 50 }),
  ]);
  console.log('candidates', candidates.length, 'search hits', searchBoth.map(s => s.total).join('/'));

  const communityOp = details.find(d => d.path.endsWith('/community/profile'));
  const listOp = details.find(d => d.path.endsWith('/releases') && d.parameters.some(p => p.name === 'per_page'));

  const fill = p => p.replace('{owner}', 'BurntSushi').replace('{repo}', 'ripgrep');
  const profile = await github.request({ method: 'GET', path: fill(communityOp.path) });
  const releases = await github.request({ method: 'GET', path: fill(listOp.path), query: { per_page: 3 } });

  const wanted = ['code_of_conduct', 'contributing', 'issue_template', 'pull_request_template', 'license', 'readme'];
  return {
    healthPercentage: profile.body.health_percentage,
    missingFiles: wanted.filter(w => !profile.body.files[w]),
    releases: releases.body.map(r => ({
      tag: r.tag_name,
      publishedAt: r.published_at,
      downloads: r.assets.reduce((n, a) => n + (a.download_count || 0), 0),
    })),
  };
}
