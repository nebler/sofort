async () => {
  const owner = 'cli';
  const repo = 'cli';
  const cutoff = '2026-09-30T00:00:00Z';

  // Fetch all open issues with the label, page by page.
  const all = [];
  for (let page = 1; ; page++) {
    const batch = await github.listIssues({ owner, repo, state: 'open', labels: 'gh-extension', per_page: 100, page });
    all.push(...batch);
    if (batch.length < 100) break;
  }

  const matching = all
    .filter(i => !i.pull_request && i.created_at < cutoff)
    .sort((a, b) => b.comments - a.comments || a.created_at.localeCompare(b.created_at));

  const top = matching.slice(0, 20);
  const issues = [];
  for (const issue of top) {
    let lastCommentAt = null;
    let lastCommenter = null;
    if (issue.comments > 0) {
      const comments = await github.listIssueComments({ owner, repo, issue_number: issue.number, per_page: 100 });
      const last = comments[comments.length - 1];
      if (last) {
        lastCommentAt = last.created_at;
        lastCommenter = last.user?.login ?? null;
      }
    }
    issues.push({ number: issue.number, title: issue.title, comments: issue.comments, lastCommentAt, lastCommenter });
  }

  return { cutoff, totalMatching: matching.length, issues };
}
