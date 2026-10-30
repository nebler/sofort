async () => {
  const search = await drive.searchFiles({ query: 'pipeline review 2026-10-29', pageSize: 10 });
  const meta = search.files.find(f => /Notes by Gemini/.test(f.name)) ?? search.files[0];
  const doc = await drive.getDocument({ fileId: meta.id });

  const section = doc.content.split('Suggested next steps')[1].split('\n\n')[0];
  const parsed = section
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('- [ ]'))
    .map(l => {
      const [, account, owner, text, due] = /^- \[ \] \[([^\]]+)\] ([^:]+): (.*?)\.\s+Due (\d{4}-\d\d-\d\d)\.$/.exec(l);
      return { account, owner, subject: text, dueDate: due };
    })
    .filter(x => x.account !== 'Internal');

  const quote = s => `'${s.replace(/'/g, "\\'")}'`;

  // Resolve everything for each item in parallel.
  const items = await Promise.all(
    parsed.map(async it => {
      const [acc, usr] = await Promise.all([
        salesforce.query({ q: `SELECT Id, Name FROM Account WHERE Name = ${quote(it.account)} LIMIT 2` }),
        salesforce.query({ q: `SELECT Id, Name, IsActive FROM User WHERE Name = ${quote(it.owner)}` }),
      ]);
      const account = acc.records.find(r => r.Name === it.account);
      const owner = usr.records.find(r => r.IsActive);
      const opps = await salesforce.query({
        q: `SELECT Id, Name, IsClosed, CloseDate FROM Opportunity WHERE AccountId = ${quote(account.Id)} AND IsClosed = false ORDER BY CloseDate ASC`,
      });
      const opportunity = opps.records[0];
      const [task] = await Promise.all([
        salesforce.createRecord({
          sobject: 'Task',
          record: {
            Subject: it.subject,
            WhatId: opportunity.Id,
            OwnerId: owner.Id,
            ActivityDate: it.dueDate,
            Status: 'Not Started',
            Priority: 'Normal',
          },
        }),
        salesforce.updateRecord({ sobject: 'Opportunity', id: opportunity.Id, record: { NextStep: it.subject } }),
      ]);
      return {
        account: it.account,
        accountId: account.Id,
        owner: it.owner,
        ownerId: owner.Id,
        opportunityId: opportunity.Id,
        subject: it.subject,
        dueDate: it.dueDate,
        taskId: task.id,
      };
    })
  );

  const note = await salesforce.createRecord({
    sobject: 'Meeting_Note__c',
    record: { Name: doc.name, Meeting_Date__c: '2026-10-29', Transcript__c: doc.content },
  });
  return { meetingNoteId: note.id, items };
}
