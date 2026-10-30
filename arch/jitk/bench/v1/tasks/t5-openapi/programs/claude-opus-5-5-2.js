async () => {
  const [community, releases] = await Promise.all([
    openapi.search({ query: 'get community profile metrics', limit: 5 }),
    openapi.search({ query: 'list releases for a repository', limit: 5 }),
  ]);
  const pick = (res, re) => res.results.find(r => r.method === 'GET' && re.test(r.path));
  const communityOp = pick(community, /\/community\/profile$/);
  const releasesOp = pick(releases, /^\/repos\/\{owner\}\/\{repo\}\/releases$/);
  if (!communityOp || !releasesOp) throw new Error('endpoint not found in the spec');

  const params = { owner: 'BurntSushi', repo: 'ripgrep' };
  const expand = p => p.replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(params[k]));

  const [profile, rels] = await Promise.all([
    github.request({ method: 'GET', path: expand(communityOp.path) }),
    github.request({ method: 'GET', path: expand(releasesOp.path), query: { per_page: 3 } }),
  ]);

  const checked = ['code_of_conduct', 'contributing', 'issue_template', 'pull_request_template', 'license', 'readme'];
  return {
    healthPercentage: profile.body.health_percentage,
    missingFiles: checked.filter(f => profile.body.files[f] == null),
    releases: rels.body.map(r => ({
      tag: r.tag_name,
      publishedAt: r.published_at,
      downloads: r.assets.map(a => a.download_count).reduce((a, b) => a + b, 0),
    })),
  };
}
