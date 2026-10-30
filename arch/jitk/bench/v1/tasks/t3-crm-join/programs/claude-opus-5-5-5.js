async () => {
  const day = '2026-10-29';
  const found = await drive.searchFiles({ query: `${day} Gemini` });
  if (found.files.length !== 1) throw new Error(`expected exactly one doc, got ${found.files.length}`);
  const doc = await drive.getDocument({ fileId: found.files[0].id });

  const lines = doc.content.split(/\r?\n/);
  const idx = lines.findIndex(l => l.trim().toLowerCase() === 'suggested next steps');
  const actions = [];
  for (const raw of lines.slice(idx + 1)) {
    const line = raw.trim();
    if (!line) break;
    const m = /^- \[ \] \[(?<account>[^\]]+)\] (?<owner>[^:]+): (?<action>.+?)\. Due (?<due>\d{4}-\d{2}-\d{2})\.?$/.exec(line);
    if (!m) continue;
    const { account, owner, action, due } = m.groups;
    if (account.toLowerCase() === 'internal') continue;
    actions.push({ account, owner, subject: action, dueDate: due });
  }

  const soql = s => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  async function resolve(a) {
    // Prefix match, then pick the exact name client-side (there are similarly named accounts).
    const accRes = await salesforce.query({
      q: `SELECT Id, Name, Type FROM Account WHERE Name LIKE '${soql(a.account.split(' ').slice(0, 2).join(' '))}%'`,
    });
    const account = accRes.records.find(r => r.Name === a.account);
    if (!account) throw new Error('no account named ' + a.account);
    const userRes = await salesforce.query({
      q: `SELECT Id, Name, IsActive FROM User WHERE Name = '${soql(a.owner)}'`,
    });
    const active = userRes.records.filter(u => u.IsActive);
    if (active.length !== 1) throw new Error('ambiguous user ' + a.owner);
    const oppRes = await salesforce.query({
      q: `SELECT Id, Name, IsClosed FROM Opportunity WHERE AccountId = '${account.Id}'`,
    });
    const open = oppRes.records.filter(o => o.IsClosed === false);
    if (open.length !== 1) throw new Error('need exactly one open opportunity on ' + a.account);
    return { ...a, accountId: account.Id, ownerId: active[0].Id, opportunityId: open[0].Id };
  }

  // Three at a time.
  const resolved = [];
  for (let i = 0; i < actions.length; i += 3) {
    resolved.push(...(await Promise.all(actions.slice(i, i + 3).map(resolve))));
  }

  const items = [];
  for (const r of resolved) {
    const { id: taskId } = await salesforce.createRecord({
      sobject: 'Task',
      record: {
        WhatId: r.opportunityId,
        OwnerId: r.ownerId,
        Subject: r.subject,
        ActivityDate: r.dueDate,
        Status: 'Not Started',
        Priority: 'Normal',
      },
    });
    await salesforce.updateRecord({ sobject: 'Opportunity', id: r.opportunityId, record: { NextStep: r.subject } });
    items.push({ account: r.account, accountId: r.accountId, owner: r.owner, ownerId: r.ownerId, opportunityId: r.opportunityId, subject: r.subject, dueDate: r.dueDate, taskId });
  }

  const meetingNote = await salesforce.createRecord({
    sobject: 'Meeting_Note__c',
    record: { Name: doc.name, Meeting_Date__c: day, Transcript__c: doc.content },
  });
  return { meetingNoteId: meetingNote.id, items };
}
