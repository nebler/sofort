async () => {
  const owner = 'cli', repo = 'cli';
  const cutoff = '2026-09-30T00:00:00Z';
  const cutoffMs = Date.parse(cutoff);

  const issues = [];
  let page = 1;
  while (true) {
    const res = await github.listIssues({ owner, repo, labels: 'gh-extension', state: 'open', per_page: 100, page });
    if (!Array.isArray(res) || res.length === 0) break;
    issues.push(...res);
    if (res.length < 100) break;
    page++;
  }

  const old = issues.filter(i => !('pull_request' in i) && Date.parse(i.created_at) < cutoffMs);
  old.sort((a, b) => {
    if (b.comments !== a.comments) return b.comments - a.comments;
    return Date.parse(a.created_at) - Date.parse(b.created_at);
  });
  const top = old.slice(0, 20);

  // Fan out: fetch comments for all top issues in parallel.
  const commentLists = await Promise.all(
    top.map(i =>
      i.comments === 0
        ? Promise.resolve([])
        : github.listIssueComments({ owner, repo, issue_number: i.number, per_page: 100 })
    )
  );

  return {
    cutoff,
    totalMatching: old.length,
    issues: top.map((i, idx) => {
      const comments = commentLists[idx];
      let last = null;
      for (const c of comments) {
        if (!last || Date.parse(c.created_at) > Date.parse(last.created_at)) last = c;
      }
      return {
        number: i.number,
        title: i.title,
        comments: i.comments,
        lastCommentAt: last ? last.created_at : null,
        lastCommenter: last ? last.user.login : null,
      };
    }),
  };
}
