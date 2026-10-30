async () => {
  const OWNER = 'BurntSushi';
  const REPO = 'ripgrep';

  async function findOperation(query, test) {
    const { results } = await openapi.search({ query, limit: 10 });
    const match = results.find(test);
    if (!match) throw new Error(`no operation for "${query}" among: ${results.map(r => r.operationId).join(', ')}`);
    return match;
  }
  const toPath = template => template.replaceAll('{owner}', OWNER).replaceAll('{repo}', REPO);

  const communityOp = await findOperation(
    'community health profile repository',
    r => r.method === 'GET' && r.operationId.startsWith('repos/') && r.path.endsWith('/community/profile')
  );
  // The best-ranked hit for this query is an org-level endpoint, so filter on the path.
  const releasesOp = await findOperation(
    'releases repository list',
    r => r.method === 'GET' && r.path === '/repos/{owner}/{repo}/releases'
  );

  const community = await github.request({ method: 'GET', path: toPath(communityOp.path) });
  const list = await github.request({ method: 'GET', path: toPath(releasesOp.path), query: { per_page: 3 } });
  if (community.status !== 200 || list.status !== 200) throw new Error('request failed');

  const files = community.body.files;
  const missingFiles = [];
  for (const key of ['code_of_conduct', 'contributing', 'issue_template', 'pull_request_template', 'license', 'readme']) {
    if (!files[key]) missingFiles.push(key);
  }
  return {
    healthPercentage: community.body.health_percentage,
    missingFiles,
    releases: list.body.map(({ tag_name, published_at, assets }) => ({
      tag: tag_name,
      publishedAt: published_at,
      downloads: assets.reduce((total, asset) => total + asset.download_count, 0),
    })),
  };
}
