async () => {
  const owner = 'BurntSushi';
  const repo = 'ripgrep';
  const fill = (path) => path.replace('{owner}', owner).replace('{repo}', repo);

  // 1. Community profile.
  const communitySearch = await openapi.search({ query: 'community profile' });
  const communityOp = communitySearch.results.find(r => r.method === 'GET' && r.path.includes('community/profile'));
  const community = await github.request({ method: 'GET', path: fill(communityOp.path) });
  const wanted = ['code_of_conduct', 'contributing', 'issue_template', 'pull_request_template', 'license', 'readme'];
  const files = community.body.files;
  const missingFiles = wanted.filter(name => !files[name]);

  // 2. Releases.
  const releaseSearch = await openapi.search({ query: 'list releases' });
  const releaseOp = releaseSearch.results.find(r => r.method === 'GET' && r.path === '/repos/{owner}/{repo}/releases');
  const releasesRes = await github.request({ method: 'GET', path: fill(releaseOp.path), query: { per_page: 3 } });
  const releases = releasesRes.body.map(rel => ({
    tag: rel.tag_name,
    publishedAt: rel.published_at,
    downloads: rel.assets.reduce((sum, a) => sum + a.download_count, 0),
  }));

  return { healthPercentage: community.body.health_percentage, missingFiles, releases };
}
