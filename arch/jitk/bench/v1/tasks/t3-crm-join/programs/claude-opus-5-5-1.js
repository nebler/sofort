async () => {
  const { files } = await drive.searchFiles({ query: 'Weekly pipeline review 2026-10-29' });
  const file = files.find(f => f.name.includes('Notes by Gemini'));
  if (!file) throw new Error('meeting notes not found');
  const doc = await drive.getDocument({ fileId: file.id });

  // Parse the "Suggested next steps" section.
  const lines = doc.content.split('\n');
  const start = lines.indexOf('Suggested next steps');
  const steps = [];
  for (let i = start + 1; i < lines.length && lines[i].startsWith('- [ ]'); i++) {
    const m = lines[i].match(/^- \[ \] \[(.+?)\] (.+?): (.+?)\.? Due (\d{4}-\d{2}-\d{2})\.?$/);
    if (m) steps.push({ account: m[1], owner: m[2], subject: m[3].replace(/\.$/, ''), dueDate: m[4] });
  }

  const esc = s => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const items = [];
  for (const step of steps) {
    if (step.account === 'Internal') continue;
    const acc = await salesforce.query({ q: `SELECT Id, Name FROM Account WHERE Name = '${esc(step.account)}'` });
    if (acc.totalSize !== 1) throw new Error(`account lookup for ${step.account} returned ${acc.totalSize}`);
    const accountId = acc.records[0].Id;

    const user = await salesforce.query({
      q: `SELECT Id, Name FROM User WHERE Name = '${esc(step.owner)}' AND IsActive = true`,
    });
    if (user.totalSize !== 1) throw new Error(`user lookup for ${step.owner} returned ${user.totalSize}`);
    const ownerId = user.records[0].Id;

    const opp = await salesforce.query({
      q: `SELECT Id, Name, StageName FROM Opportunity WHERE AccountId = '${accountId}' AND IsClosed = false`,
    });
    if (opp.totalSize !== 1) throw new Error(`expected one open opportunity for ${step.account}`);
    const opportunityId = opp.records[0].Id;

    const task = await salesforce.createRecord({
      sobject: 'Task',
      record: {
        WhatId: opportunityId,
        OwnerId: ownerId,
        Subject: step.subject,
        ActivityDate: step.dueDate,
        Status: 'Not Started',
        Priority: 'Normal',
      },
    });
    await salesforce.updateRecord({ sobject: 'Opportunity', id: opportunityId, record: { NextStep: step.subject } });

    items.push({ account: step.account, accountId, owner: step.owner, ownerId, opportunityId, subject: step.subject, dueDate: step.dueDate, taskId: task.id });
  }

  const note = await salesforce.createRecord({
    sobject: 'Meeting_Note__c',
    record: { Name: doc.name, Meeting_Date__c: '2026-10-29', Transcript__c: doc.content },
  });

  return { meetingNoteId: note.id, items };
}
