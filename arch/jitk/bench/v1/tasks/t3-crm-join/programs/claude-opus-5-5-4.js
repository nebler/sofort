async () => {
  // Grab every pipeline review doc so we can pick the right one by content.
  const { files } = await drive.searchFiles({ query: 'pipeline review' });
  const docs = await Promise.all(files.map(f => drive.getDocument({ fileId: f.id })));
  const doc = docs.find(d => d.content.startsWith('Weekly pipeline review – 2026-10-29') && d.content.includes('Transcript'));

  // Load the CRM reference data once and join locally.
  const [accounts, users, opportunities] = await Promise.all([
    salesforce.query({ q: 'SELECT Id, Name, Industry, Type, BillingCountry, OwnerId FROM Account' }),
    salesforce.query({ q: 'SELECT Id, Name, Email, IsActive, Title FROM User' }),
    salesforce.query({
      q: 'SELECT Id, Name, AccountId, StageName, IsClosed, Amount, CloseDate, NextStep, OwnerId FROM Opportunity',
    }),
  ]);

  const nextSteps = [];
  let inSection = false;
  for (const line of doc.content.split('\n')) {
    if (line === 'Suggested next steps') {
      inSection = true;
      continue;
    }
    if (inSection && !line.startsWith('- [')) break;
    if (!inSection) continue;
    const m = line.match(/^- \[ \] \[(.*?)\] (.*?): (.*) Due (\S+)\.$/);
    if (!m || m[1] === 'Internal') continue;
    nextSteps.push({ account: m[1], owner: m[2], subject: m[3].replace(/\.$/, ''), dueDate: m[4] });
  }

  const items = [];
  for (const step of nextSteps) {
    const account = accounts.records.find(a => a.Name === step.account);
    const owner = users.records.find(u => u.Name === step.owner && u.IsActive);
    const opportunity = opportunities.records.find(o => o.AccountId === account.Id && !o.IsClosed);
    // Double-check the opportunity before writing to it.
    const fresh = await salesforce.getRecord({ sobject: 'Opportunity', id: opportunity.Id });
    if (fresh.IsClosed) throw new Error('opportunity closed in the meantime: ' + fresh.Id);
    const task = await salesforce.createRecord({
      sobject: 'Task',
      record: {
        WhatId: opportunity.Id,
        OwnerId: owner.Id,
        Subject: step.subject,
        ActivityDate: step.dueDate,
        Status: 'Not Started',
        Priority: 'Normal',
      },
    });
    await salesforce.updateRecord({ sobject: 'Opportunity', id: opportunity.Id, record: { NextStep: step.subject } });
    items.push({
      account: step.account,
      accountId: account.Id,
      owner: step.owner,
      ownerId: owner.Id,
      opportunityId: opportunity.Id,
      subject: step.subject,
      dueDate: step.dueDate,
      taskId: task.id,
    });
  }

  const note = await salesforce.createRecord({
    sobject: 'Meeting_Note__c',
    record: { Name: doc.name, Meeting_Date__c: '2026-10-29', Transcript__c: doc.content },
  });
  return { meetingNoteId: note.id, items };
}
