// Re-records T1 from api.github.com: runs the five programs against live
// GitHub REST endpoints (record mode, one recording per distinct call),
// replaces email addresses, and writes responses.jsonl(.gz) plus capture.json.
//
//   node bench/v1/tasks/t1-issue-triage/capture.ts      (needs `gh auth login`)
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getJson, query, requests, scrub } from '../lib/github.ts';
import { Recorder, writeResponses } from '../lib/record.ts';
import { readTask, TASKS } from '../lib/tasks.ts';

const id = 't1-issue-triage';
const task = readTask(id);
const capturedAt = new Date().toISOString();

const recorder = new Recorder({
  github: {
    listIssues: args => getJson(`/repos/${args.owner}/${args.repo}/issues` + query(args, ['owner', 'repo'])),
    getIssue: args => getJson(`/repos/${args.owner}/${args.repo}/issues/${args.issue_number}`),
    listIssueComments: args =>
      getJson(
        `/repos/${args.owner}/${args.repo}/issues/${args.issue_number}/comments` +
          query(args, ['owner', 'repo', 'issue_number']),
      ),
  },
});

await recorder.runAll(id, task);
const calls = recorder.lines().map(call => ({ ...call, response: scrub(call.response) }));
const size = writeResponses(id, calls);
writeFileSync(
  join(TASKS, id, 'capture.json'),
  JSON.stringify(
    { capturedAt, api: 'https://api.github.com', apiVersion: '2022-11-28', requests, calls: calls.length, ...size },
    null,
    2,
  ) + '\n',
);
console.log(id, 'captured', calls.length, 'calls,', requests, 'requests,', size.bytes, 'bytes');
