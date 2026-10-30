// T3 oracle: re-parses the recorded meeting doc's next steps, resolves them
// against crm.json with its own joins, and checks the answer plus the writes
// it claims (the recorded Task, Opportunity and Meeting_Note__c calls whose
// ids the answer returns).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATE = '2026-10-29';

type Rec = Record<string, any>;
interface Want {
  account: string;
  accountId: string;
  owner: string;
  ownerId: string;
  opportunityId: string;
  subject: string;
  dueDate: string;
}

let state: { doc: Rec; items: Want[]; creates: Rec[]; updates: Rec[] } | undefined;

function load() {
  if (state) return state;
  const org = JSON.parse(readFileSync(join(HERE, 'crm.json'), 'utf8')) as Record<string, Rec[]>;
  let doc: Rec | undefined;
  const creates: Rec[] = [];
  const updates: Rec[] = [];
  for (const line of readFileSync(join(HERE, 'responses.jsonl'), 'utf8').split('\n')) {
    if (!line) continue;
    const call = JSON.parse(line);
    if (call.error !== undefined) continue;
    if (
      call.tool === 'getDocument' &&
      call.response.name.includes(DATE) &&
      call.response.name.endsWith('Notes by Gemini')
    ) {
      doc = call.response;
    } else if (call.tool === 'createRecord') {
      creates.push({ ...call.args[0], id: call.response.id });
    } else if (call.tool === 'updateRecord') {
      updates.push(call.args[0]);
    }
  }
  if (!doc) throw new Error('the meeting doc is not in the recording');
  const lines = (doc.content as string).split('\n');
  const items: Want[] = [];
  for (let i = lines.indexOf('Suggested next steps') + 1; i < lines.length && lines[i] !== ''; i++) {
    const line = lines[i];
    const close = line.indexOf('] ', 6);
    const account = line.slice(7, close);
    const colon = line.indexOf(': ', close);
    const owner = line.slice(close + 2, colon);
    const dueAt = line.lastIndexOf(' Due ');
    const subject = line.slice(colon + 2, dueAt).replace(/\.$/, '');
    const dueDate = line.slice(dueAt + 5).replace(/\.$/, '');
    if (account === 'Internal') continue;
    const accounts = org.Account.filter(a => a.Name === account);
    const users = org.User.filter(u => u.Name === owner && u.IsActive === true);
    if (accounts.length !== 1 || users.length !== 1) throw new Error('fixture: ambiguous ' + line);
    const opps = org.Opportunity.filter(o => o.AccountId === accounts[0].Id && o.IsClosed === false);
    if (opps.length !== 1) throw new Error('fixture: not one open opportunity for ' + account);
    items.push({
      account,
      accountId: accounts[0].Id,
      owner,
      ownerId: users[0].Id,
      opportunityId: opps[0].Id,
      subject,
      dueDate,
    });
  }
  state = { doc, items, creates, updates };
  return state;
}

export function check(result: unknown): { ok: boolean; reason: string } {
  const { doc, items, creates, updates } = load();
  const got = result as { meetingNoteId?: unknown; items?: Rec[] };
  if (!got || typeof got !== 'object' || !Array.isArray(got.items)) return { ok: false, reason: 'no items list' };
  if (JSON.stringify(result).length > 16384)
    return { ok: false, reason: 'the answer carries the transcript (or is too large)' };
  if (got.items.length !== items.length)
    return { ok: false, reason: `expected ${items.length} items, got ${got.items.length}` };
  for (let i = 0; i < items.length; i++) {
    const want = items[i];
    const have = got.items[i];
    for (const field of Object.keys(want) as (keyof Want)[]) {
      if (have?.[field] !== want[field]) {
        return {
          ok: false,
          reason: `items[${i}].${field} ${JSON.stringify(have?.[field])} != ${JSON.stringify(want[field])}`,
        };
      }
    }
    const task = creates.find(c => c.sobject === 'Task' && c.id === have.taskId);
    const r = task?.record ?? {};
    if (
      !task ||
      r.WhatId !== want.opportunityId ||
      r.OwnerId !== want.ownerId ||
      r.Subject !== want.subject ||
      r.ActivityDate !== want.dueDate ||
      r.Status !== 'Not Started' ||
      r.Priority !== 'Normal'
    ) {
      return {
        ok: false,
        reason: `items[${i}].taskId ${have.taskId} is not a recorded Task create with the right fields`,
      };
    }
    if (
      !updates.some(
        u => u.sobject === 'Opportunity' && u.id === want.opportunityId && u.record?.NextStep === want.subject,
      )
    ) {
      return { ok: false, reason: `no recorded NextStep update for ${want.opportunityId}` };
    }
  }
  const note = creates.find(c => c.sobject === 'Meeting_Note__c' && c.id === got.meetingNoteId);
  if (
    !note ||
    note.record.Transcript__c !== doc.content ||
    note.record.Name !== doc.name ||
    note.record.Meeting_Date__c !== DATE
  ) {
    return { ok: false, reason: 'meetingNoteId is not a recorded Meeting_Note__c create with the full doc' };
  }
  return { ok: true, reason: `${items.length} tasks and the meeting note match` };
}

export default check;
