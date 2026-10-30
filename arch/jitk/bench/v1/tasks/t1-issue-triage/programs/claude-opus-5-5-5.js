async () => {
  const owner = 'cli';
  const repo = 'cli';
  const cutoff = new Date('2026-09-30T00:00:00Z');

  // Oldest first, so we can stop paging once issues are newer than the cutoff.
  const matching = [];
  let page = 1;
  let done = false;
  while (!done) {
    const batch = await github.listIssues({
      owner,
      repo,
      state: 'open',
      labels: 'gh-extension',
      sort: 'created',
      direction: 'asc',
      per_page: 30,
      page,
    });
    for (const issue of batch) {
      if (new Date(issue.created_at) >= cutoff) {
        done = true;
        break;
      }
      if (!issue.pull_request) matching.push(issue);
    }
    if (batch.length < 30) done = true;
    page++;
  }

  const ranked = matching
    .map((issue, index) => ({ issue, index }))
    .sort((a, b) => b.issue.comments - a.issue.comments || a.index - b.index)
    .map(x => x.issue)
    .slice(0, 20);

  // Fetch comments in small parallel batches to stay friendly to rate limits.
  const out = [];
  for (let i = 0; i < ranked.length; i += 5) {
    const chunk = ranked.slice(i, i + 5);
    const lists = await Promise.all(
      chunk.map(issue =>
        issue.comments > 0
          ? github.listIssueComments({ owner, repo, issue_number: issue.number, per_page: 100 })
          : []
      )
    );
    chunk.forEach((issue, j) => {
      const last = lists[j].length ? lists[j][lists[j].length - 1] : null;
      out.push({
        number: issue.number,
        title: issue.title,
        comments: issue.comments,
        lastCommentAt: last ? last.created_at : null,
        lastCommenter: last ? last.user.login : null,
      });
    });
  }

  return { cutoff: cutoff.toISOString().replace('.000Z', 'Z'), totalMatching: matching.length, issues: out };
}
