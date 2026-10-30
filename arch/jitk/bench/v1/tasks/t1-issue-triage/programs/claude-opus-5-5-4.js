async () => {
  const owner = 'cli';
  const repo = 'cli';
  const cutoff = '2026-09-30T00:00:00Z';

  let page = 1;
  const open = [];
  for (;;) {
    const batch = await github.listIssues({ owner, repo, state: 'open', labels: 'gh-extension', per_page: 100, page });
    open.push(...batch);
    if (batch.length < 100) break;
    page += 1;
  }
  const candidates = open.filter(i => !i.pull_request && i.created_at < cutoff);

  // Pull full details and every comment for every candidate, so the ranking and
  // last-activity numbers come from the freshest data.
  const detailed = await Promise.all(
    candidates.map(async c => {
      const [issue, comments] = await Promise.all([
        github.getIssue({ owner, repo, issue_number: c.number }),
        github.listIssueComments({ owner, repo, issue_number: c.number, per_page: 100 }),
      ]);
      return { issue, comments };
    })
  );

  detailed.sort(
    (a, b) => b.issue.comments - a.issue.comments || a.issue.created_at.localeCompare(b.issue.created_at)
  );

  return {
    cutoff,
    totalMatching: detailed.length,
    issues: detailed.slice(0, 20).map(({ issue, comments }) => {
      const sorted = [...comments].sort((x, y) => x.created_at.localeCompare(y.created_at));
      const last = sorted.at(-1);
      return {
        number: issue.number,
        title: issue.title,
        comments: issue.comments,
        lastCommentAt: last ? last.created_at : null,
        lastCommenter: last ? last.user.login : null,
      };
    }),
  };
}
