// Writes T4's responses.jsonl: builds the seeded dataset (dataset.ts), serves
// it through a mock OTLP query API, runs the five programs in record mode and
// gives each reply a deterministic latency. Run again after adding programs;
// materialize.ts runs it.
//
//   node bench/v1/tasks/t4-otel-rollup/generate.ts
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Recorder, Timed, toJsonl } from '../lib/record.ts';
import { latencyFor } from '../lib/synthetic.ts';
import { bytesOf, callKey, readTask, sha256, TASKS } from '../lib/tasks.ts';
import { buildRows, type Row, toOtlp } from './dataset.ts';

const id = 't4-otel-rollup';
const { rows, services } = buildRows();
type Args = Record<string, any>;

function page(args: Args): { resourceMetrics: unknown[]; nextPageToken?: string } {
  if (args.metric !== 'http.server.request.duration') throw new Error(`unknown metric: ${args.metric}`);
  const start = Date.parse(args.startTime);
  const end = Date.parse(args.endTime);
  if (Number.isNaN(start) || Number.isNaN(end)) throw new Error('startTime and endTime must be RFC 3339 timestamps');
  const size = args.pageSize ?? 500;
  if (!Number.isInteger(size) || size < 1 || size > 2000) throw new Error('pageSize must be between 1 and 2000');
  // The token binds the query and the offset, like a real cursor.
  const query = sha256(JSON.stringify([args.metric, args.startTime, args.endTime, args.serviceName ?? ''])).slice(
    0,
    16,
  );
  let offset = 0;
  if (args.pageToken) {
    const token = JSON.parse(Buffer.from(args.pageToken, 'base64url').toString());
    if (token.q !== query) throw new Error('pageToken does not belong to this query');
    offset = token.o;
  }
  const selected: Row[] = rows.filter(
    row => row.endMs > start && row.endMs <= end && (!args.serviceName || row.service === args.serviceName),
  );
  const slice = selected.slice(offset, offset + size);
  const next = offset + size < selected.length;
  return {
    resourceMetrics: toOtlp(slice),
    ...(next
      ? { nextPageToken: Buffer.from(JSON.stringify({ q: query, o: offset + size })).toString('base64url') }
      : {}),
  };
}

const recorder = new Recorder({
  metrics: {
    async listServices() {
      const reply = { services };
      return new Timed(reply, latencyFor('metrics.listServices', 60));
    },
    async queryRange(args: Args) {
      const reply = page(args);
      // A metrics backend: ~90 ms to scan plus ~350 ms per MB to encode and send.
      return new Timed(reply, latencyFor(callKey('metrics', 'queryRange', [args]), 90, (bytesOf(reply) / 1e6) * 350));
    },
  },
});
await recorder.runAll(id, readTask(id));
const calls = recorder.lines();
for (const call of calls) call.bytes = call.error ? 0 : bytesOf(call.response);
writeFileSync(join(TASKS, id, 'responses.jsonl'), toJsonl(calls));
console.error(id, 'generated', calls.length, 'calls');
