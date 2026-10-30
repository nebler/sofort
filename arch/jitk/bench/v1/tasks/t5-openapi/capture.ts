// Re-records T5: serves the pinned OpenAPI spec through spec.ts and executes
// github.request against the live API, running the five programs in record
// mode; writes responses.jsonl(.gz) and capture.json. Spec tool latency is a
// 40 ms median network round trip (seeded by call key) plus the measured
// search time; request latency is the real request's.
//
//   node bench/v1/tasks/t5-openapi/capture.ts      (needs `gh auth login`)
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getJson, scrub, window } from '../lib/github.ts';
import { Recorder, Timed, writeResponses } from '../lib/record.ts';
import { latencyFor } from '../lib/synthetic.ts';
import { callKey, readTask, TASKS } from '../lib/tasks.ts';
import { getOperation, listOperations, loadSpec, SPEC, search } from './spec.ts';

const id = 't5-openapi';
const spec = loadSpec();
type Args = Record<string, any>;

function local(tool: string, args: Args, work: () => unknown) {
  const started = performance.now();
  const reply = work();
  const computeMs = performance.now() - started;
  return new Timed(reply, latencyFor(callKey('openapi', tool, [args]), 40, computeMs));
}

const recorder = new Recorder({
  openapi: {
    search: async args => local('search', args, () => search(spec, String(args.query), args.limit ?? 10)),
    listOperations: async args => local('listOperations', args, () => listOperations(spec, args.tag)),
    getOperation: async args => local('getOperation', args, () => getOperation(spec, String(args.operationId))),
  },
  github: {
    async request(args: Args) {
      if (args.method !== 'GET') throw new Error('only GET is allowed');
      if (!/^\/[^?#]*$/.test(args.path) || /[{}]/.test(args.path))
        throw new Error('path must be a filled-in path without a query string');
      const query = new URLSearchParams(Object.entries(args.query ?? {}).map(([k, v]) => [k, String(v)])).toString();
      const real = await getJson(args.path + (query ? '?' + query : ''));
      return new Timed({ status: 200, body: scrub(real.value) }, real.ms);
    },
  },
});

await recorder.runAll(id, readTask(id));
const calls = recorder.lines();
const size = writeResponses(id, calls);
writeFileSync(
  join(TASKS, id, 'capture.json'),
  JSON.stringify(
    {
      capturedFrom: window.first,
      capturedTo: window.last,
      api: 'https://api.github.com',
      spec: SPEC.commit,
      githubRequests: window.paths.size,
      calls: calls.length,
      ...size,
    },
    null,
    2,
  ) + '\n',
);
console.log(id, 'captured', calls.length, 'calls,', window.paths.size, 'GitHub requests,', size.bytes, 'bytes');
