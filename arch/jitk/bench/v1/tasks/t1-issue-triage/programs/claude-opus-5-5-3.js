async () => {
  const OWNER = 'cli';
  const REPO = 'cli';
  const CUTOFF = '2026-09-30T00:00:00Z';

  // Let the API sort by comment count; we still need every page to filter by creation date.
  const found = [];
  for (let page = 1; page <= 20; page++) {
    const items = await github.listIssues({
      owner: OWNER,
      repo: REPO,
      state: 'open',
      labels: 'gh-extension',
      sort: 'comments',
      direction: 'desc',
      per_page: 50,
      page,
    });
    for (const it of items) {
      if (it.pull_request) continue;
      if (new Date(it.created_at) >= new Date(CUTOFF)) continue;
      found.push(it);
    }
    if (items.length < 50) break;
  }

  found.sort((a, b) => b.comments - a.comments || new Date(a.created_at) - new Date(b.created_at));

  // Comments come back oldest first, 30 per page by default; walk to the last page.
  async function lastComment(issueNumber) {
    let last = null;
    for (let page = 1; ; page++) {
      const batch = await github.listIssueComments({ owner: OWNER, repo: REPO, issue_number: issueNumber, page });
      if (batch.length) last = batch[batch.length - 1];
      if (batch.length < 30) break;
    }
    return last;
  }

  const result = [];
  for (const issue of found.slice(0, 20)) {
    const last = issue.comments ? await lastComment(issue.number) : null;
    result.push({
      number: issue.number,
      title: issue.title,
      comments: issue.comments,
      lastCommentAt: last?.created_at ?? null,
      lastCommenter: last?.user?.login ?? null,
    });
  }
  return { cutoff: CUTOFF, totalMatching: found.length, issues: result };
}
