// Writes T3's responses.jsonl: builds the seeded fixture, runs the five
// programs against the mock Drive and Salesforce in record mode (one recording
// per distinct call), and gives each call a deterministic latency. Also writes
// crm.json, the org the oracle resolves names against. Run again after adding
// programs; materialize.ts runs it.
//
//   node bench/v1/tasks/t3-crm-join/generate.ts
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Recorder, Timed, toJsonl } from '../lib/record.ts';
import { latencyFor } from '../lib/synthetic.ts';
import { bytesOf, callKey, readTask, TASKS } from '../lib/tasks.ts';
import { buildFixture } from './fixture.ts';
import { mockTools } from './mock.ts';

const id = 't3-crm-join';
const fixture = buildFixture();
const tools = mockTools(fixture);

// Median latencies (ms) of the real services from a European client: Drive
// files.list, a Docs text export (plus transfer), Salesforce REST query,
// retrieve, create and update.
const MEDIAN: Record<string, (args: unknown, reply: unknown) => [number, number]> = {
  'drive.searchFiles': () => [240, 0],
  'drive.getDocument': (_, reply) => [380, (bytesOf(reply) / 1e6) * 600],
  'salesforce.query': (_, reply) => [160, ((reply as { totalSize: number }).totalSize ?? 0) * 0.8],
  'salesforce.getRecord': () => [110, 0],
  'salesforce.createRecord': args => [210, (bytesOf(args) / 1e6) * 800],
  'salesforce.updateRecord': () => [190, 0],
};

type Live = Record<string, Record<string, (args: Record<string, unknown>) => Promise<unknown>>>;
const live: Live = {};
for (const [namespace, fns] of Object.entries(tools as unknown as Live)) {
  live[namespace] = {};
  for (const [tool, fn] of Object.entries(fns)) {
    live[namespace][tool] = async args => {
      const key = callKey(namespace, tool, [args]);
      const model = MEDIAN[namespace + '.' + tool];
      const reply = await fn(args);
      const [median, extra] = model(args, reply);
      return new Timed(reply, latencyFor(key, median, extra));
    };
  }
}

const recorder = new Recorder(live);
await recorder.runAll(id, readTask(id));
const calls = recorder.lines();
for (const call of calls) {
  call.bytes = call.error ? 0 : bytesOf(call.response);
  if (call.error) call.latencyMs = latencyFor(callKey(call.namespace, call.tool, call.args), 150);
}
writeFileSync(join(TASKS, id, 'responses.jsonl'), toJsonl(calls));
writeFileSync(join(TASKS, id, 'crm.json'), JSON.stringify(fixture.org, null, 1) + '\n');
console.error(id, 'generated', calls.length, 'calls');
