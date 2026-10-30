async () => {
  // Find candidates, then confirm the operation details before calling.
  const hits = await openapi.search({ query: 'repository community health metrics', limit: 5 });
  const communityId = hits.results.find(r => r.operationId.includes('community'))?.operationId;
  const communityOp = await openapi.getOperation({ operationId: communityId });

  const relHits = await openapi.search({ query: 'latest releases list', limit: 5 });
  const listId = relHits.results.find(r => r.operationId === 'repos/list-releases')?.operationId ?? 'repos/list-releases';
  const listOp = await openapi.getOperation({ operationId: listId });
  const supportsPerPage = (listOp.parameters || []).some(p => p.name === 'per_page');

  const path = (op) => op.path.replace('{owner}', 'BurntSushi').replace('{repo}', 'ripgrep');
  const profile = await github.request({ method: 'GET', path: path(communityOp) });
  const list = await github.request({
    method: 'GET',
    path: path(listOp),
    query: supportsPerPage ? { per_page: 3 } : undefined,
  });

  const files = profile.body.files || {};
  const missingFiles = ['code_of_conduct', 'contributing', 'issue_template', 'pull_request_template', 'license', 'readme'].filter(
    key => files[key] === null || files[key] === undefined
  );
  const releases = list.body.slice(0, 3).map(r => {
    let downloads = 0;
    for (const asset of r.assets) downloads += asset.download_count;
    return { tag: r.tag_name, publishedAt: r.published_at, downloads };
  });
  return { healthPercentage: profile.body.health_percentage, missingFiles, releases };
}
