// Replays every task under plain Node and checks each program against its
// oracle. JS programs run as AsyncFunctions with one global per provider
// namespace; each tool call is looked up by its canonical key in
// responses.jsonl, and a call without a recording fails the program. SQL
// programs (kind 'sql') run read-only against the task's SQLite file.
// Exits non-zero on any failure.
//
//   node bench/v1/tasks/materialize.ts && node bench/v1/tasks/check.ts [--sizes] [--print] [task-id...]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';
import { callKey, type RecordedCall, readResponses, readTask, runProgram, TASKS, taskIds } from './lib/tasks.ts';

type Verdict = { ok: boolean; reason?: string };
type Oracle = (result: unknown) => Verdict;

interface Stats {
  calls: number;
  bytes: number;
  maxReply: number;
  argBytes: number;
  maxRoundTrip: number;
  toolMs: number;
}

function replay(recorded: RecordedCall[], stats: Stats, unmatched: string[], used: Set<string>) {
  const byKey = new Map(recorded.map(call => [callKey(call.namespace, call.tool, call.args), call]));
  const namespaces: Record<string, Record<string, (input: unknown) => Promise<unknown>>> = {};
  for (const call of recorded) namespaces[call.namespace] ??= {};
  return new Proxy(namespaces, {
    get(_target, namespace: string) {
      return new Proxy(
        {},
        {
          get(_, tool: string) {
            return async (...args: unknown[]) => {
              const key = callKey(namespace, tool, JSON.parse(JSON.stringify(args)));
              const call = byKey.get(key);
              if (!call) {
                unmatched.push(key.slice(0, 300));
                throw new Error('no recorded response for ' + key.slice(0, 300));
              }
              used.add(key);
              const argBytes = Buffer.byteLength(JSON.stringify(args));
              stats.calls++;
              stats.bytes += call.bytes;
              stats.argBytes += argBytes;
              stats.maxReply = Math.max(stats.maxReply, call.bytes);
              stats.maxRoundTrip = Math.max(stats.maxRoundTrip, call.bytes + argBytes);
              stats.toolMs += call.latencyMs;
              if (call.error !== undefined) throw new Error(call.error);
              return structuredClone(call.response);
            };
          },
        },
      );
    },
    has: (target, namespace) => namespace in target,
  });
}

// Oracle self-test: mutate each leaf of a passing result (numbers +1, strings
// suffixed, booleans flipped, one array element dropped) and count how many
// mutants the oracle rejects. Accepted mutants are listed; a few are expected
// where the oracle tolerates rounding or extra text.
function leaves(value: unknown, path: (string | number)[] = [], out: (string | number)[][] = []) {
  if (Array.isArray(value)) {
    if (value.length) out.push([...path, '#drop']);
    value.forEach((item, i) => leaves(item, [...path, i], out));
  } else if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) leaves(item, [...path, key], out);
  } else {
    out.push(path);
  }
  return out;
}

function mutate(value: unknown, path: (string | number)[]): unknown {
  const copy = structuredClone(value);
  if (path.length === 0) return typeof copy === 'number' ? copy + 1 : null;
  let node = copy as Record<string | number, unknown>;
  for (const key of path.slice(0, -2)) node = node[key] as Record<string | number, unknown>;
  const last = path[path.length - 1];
  if (last === '#drop') {
    const parent = path.length > 1 ? (node[path[path.length - 2]] as unknown[]) : (copy as unknown[]);
    parent.pop();
    return copy;
  }
  if (path.length > 1) node = node[path[path.length - 2]] as Record<string | number, unknown>;
  const leaf = node[last];
  node[last] =
    typeof leaf === 'number' ? leaf + 1 : typeof leaf === 'string' ? leaf + 'x' : typeof leaf === 'boolean' ? !leaf : 0;
  return copy;
}

function selftest(oracle: Oracle, result: unknown): string {
  if (oracle(null).ok) return 'oracle accepts null!';
  const paths = leaves(result);
  const accepted = paths.filter(path => oracle(mutate(result, path)).ok).map(path => path.join('.'));
  return (
    `mutants rejected ${paths.length - accepted.length}/${paths.length}` +
    (accepted.length ? ` (accepted: ${accepted.slice(0, 6).join(', ')})` : '')
  );
}

async function checkJs(id: string, oracle: Oracle): Promise<boolean> {
  const task = readTask(id);
  const recorded = readResponses(id);
  const used = new Set<string>();
  const sizes: Record<string, Record<string, number>> = {};
  let ok = true;
  for (const program of task.programs) {
    const code = readFileSync(join(TASKS, id, program), 'utf8');
    const stats: Stats = { calls: 0, bytes: 0, maxReply: 0, argBytes: 0, maxRoundTrip: 0, toolMs: 0 };
    const unmatched: string[] = [];
    const proxy = replay(recorded, stats, unmatched, used);
    const namespaces = Object.fromEntries(
      task.providers.map(p => [p.name, (proxy as Record<string, unknown>)[p.name]]),
    );
    let verdict: Verdict;
    try {
      const result = JSON.parse(JSON.stringify((await runProgram(code, namespaces)) ?? null));
      if (printResults) console.log(JSON.stringify(result).slice(0, 4000));
      verdict = unmatched.length ? { ok: false, reason: 'unrecorded call: ' + unmatched[0] } : oracle(result);
      if (verdict.ok && program === task.programs[0]) console.log(`selftest ${id}: ${selftest(oracle, result)}`);
    } catch (error) {
      verdict = { ok: false, reason: 'threw: ' + (error instanceof Error ? error.message : String(error)) };
    }
    ok &&= verdict.ok;
    sizes[program] = {
      calls: stats.calls,
      responseBytes: stats.bytes,
      argBytes: stats.argBytes,
      maxReplyBytes: stats.maxReply,
      maxRoundTripBytes: stats.maxRoundTrip,
      toolMsSum: Math.round(stats.toolMs),
    };
    console.log(
      `${verdict.ok ? 'PASS' : 'FAIL'} ${id}/${program} calls=${stats.calls} bytes=${stats.bytes} argBytes=${stats.argBytes} maxReply=${stats.maxReply} toolMsSum=${Math.round(stats.toolMs)} ${verdict.reason ?? ''}`,
    );
  }
  if (writeSizes) {
    const raw = JSON.parse(readFileSync(join(TASKS, id, 'task.json'), 'utf8'));
    raw.sizes = {
      recordings: recorded.length,
      recordedResponseBytes: recorded.reduce((sum, call) => sum + call.bytes, 0),
      perProgram: sizes,
    };
    writeFileSync(join(TASKS, id, 'task.json'), JSON.stringify(raw, null, 2) + '\n');
  }
  const unused = recorded.length - used.size;
  if (unused) console.log(`note ${id}: ${unused} of ${recorded.length} recordings unused by any program`);
  return ok;
}

async function checkSql(id: string, oracle: Oracle): Promise<boolean> {
  const task = readTask(id);
  const db = new DatabaseSync(join(TASKS, id, task.database ?? 'db.sqlite'), { readOnly: true });
  let ok = true;
  try {
    const query = (task as { query?: string }).query;
    for (const program of query ? [...task.programs, query] : task.programs) {
      let verdict: Verdict;
      try {
        const rows = JSON.parse(JSON.stringify(db.prepare(readFileSync(join(TASKS, id, program), 'utf8')).all()));
        verdict = oracle(rows);
        if (verdict.ok && program === task.programs[0]) console.log(`selftest ${id}: ${selftest(oracle, rows)}`);
      } catch (error) {
        verdict = { ok: false, reason: 'threw: ' + (error instanceof Error ? error.message : String(error)) };
      }
      ok &&= verdict.ok;
      console.log(`${verdict.ok ? 'PASS' : 'FAIL'} ${id}/${program} ${verdict.reason ?? ''}`);
    }
  } finally {
    db.close();
  }
  return ok;
}

// --sizes writes the per-program call counts and byte totals into task.json.
const writeSizes = process.argv.includes('--sizes');
// --print shows each program's result (first 4000 characters).
const printResults = process.argv.includes('--print');
const args = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
const ids = args.length ? args : taskIds();
let failed = 0;
for (const id of ids) {
  const task = readTask(id);
  const module = await import(pathToFileURL(join(TASKS, id, task.oracle)).href);
  const oracle = (module.check ?? module.default) as Oracle;
  const ok = task.kind === 'sql' ? await checkSql(id, oracle) : await checkJs(id, oracle);
  if (!ok) failed++;
}
if (failed) {
  console.log(failed + ' task(s) failed');
  process.exit(1);
}
console.log('all programs pass their oracles');
