async () => {
  const MEETING_DATE = '2026-10-29';
  const { files } = await drive.searchFiles({ query: 'Weekly pipeline review' });
  const target = files.find(f => f.name.includes(MEETING_DATE) && f.name.includes('Gemini'));
  const doc = await drive.getDocument({ fileId: target.id });

  const text = doc.content;
  const from = text.indexOf('Suggested next steps');
  const to = text.indexOf('\nTranscript\n', from);
  const block = text.slice(from, to === -1 ? undefined : to);
  const re = /^- \[ \] \[(.+)\] (.+?): (.+)\. Due (\d{4}-\d{2}-\d{2})\.$/gm;
  const steps = [];
  for (const m of block.matchAll(re)) {
    if (m[1] === 'Internal') continue;
    steps.push({ account: m[1], owner: m[2], subject: m[3], dueDate: m[4] });
  }

  // Batch the lookups: one query per object.
  const lit = v => "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  const accountNames = [...new Set(steps.map(s => s.account))];
  const ownerNames = [...new Set(steps.map(s => s.owner))];
  const [accounts, users] = await Promise.all([
    salesforce.query({ q: `SELECT Id, Name FROM Account WHERE Name IN (${accountNames.map(lit).join(', ')})` }),
    salesforce.query({ q: `SELECT Id, Name FROM User WHERE IsActive = true AND Name IN (${ownerNames.map(lit).join(', ')})` }),
  ]);
  const accountByName = new Map(accounts.records.map(r => [r.Name, r.Id]));
  const userByName = new Map(users.records.map(r => [r.Name, r.Id]));

  const accountIds = [...accountByName.values()];
  const opps = await salesforce.query({
    q: `SELECT Id, AccountId, Name, StageName FROM Opportunity WHERE IsClosed = false AND AccountId IN (${accountIds.map(lit).join(', ')})`,
  });
  const oppByAccount = new Map();
  for (const o of opps.records) {
    if (oppByAccount.has(o.AccountId)) throw new Error('more than one open opportunity on ' + o.AccountId);
    oppByAccount.set(o.AccountId, o.Id);
  }

  const items = [];
  for (const s of steps) {
    const accountId = accountByName.get(s.account);
    const ownerId = userByName.get(s.owner);
    const opportunityId = oppByAccount.get(accountId);
    if (!accountId || !ownerId || !opportunityId) throw new Error('could not resolve ' + JSON.stringify(s));
    const created = await salesforce.createRecord({
      sobject: 'Task',
      record: { WhatId: opportunityId, OwnerId: ownerId, Subject: s.subject, ActivityDate: s.dueDate, Status: 'Not Started', Priority: 'Normal' },
    });
    if (!created.success) throw new Error('task create failed: ' + JSON.stringify(created.errors));
    items.push({ account: s.account, accountId, owner: s.owner, ownerId, opportunityId, subject: s.subject, dueDate: s.dueDate, taskId: created.id });
  }
  await Promise.all(
    items.map(i => salesforce.updateRecord({ sobject: 'Opportunity', id: i.opportunityId, record: { NextStep: i.subject } }))
  );

  const note = await salesforce.createRecord({
    sobject: 'Meeting_Note__c',
    record: { Name: doc.name, Meeting_Date__c: MEETING_DATE, Transcript__c: doc.content },
  });
  return { meetingNoteId: note.id, items };
}
