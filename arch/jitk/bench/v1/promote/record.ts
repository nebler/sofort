// Records one first-tier run per task program: the calls it made, with their
// replies, and its result. In production QuickJS would write these as it
// runs; here plain Node stands in, replaying the task's responses.jsonl the
// way tasks/check.ts does.
//
//   node bench/v1/promote/record.ts [task-id...]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import {
  callKey,
  type RecordedCall,
  readResponses,
  readTask,
  runProgram,
  sha256,
  TASKS,
  taskIds,
} from '../tasks/lib/tasks.ts';
import { type Recording, WORK } from './lib.ts';

const wanted = process.argv.slice(2);
for (const id of taskIds().filter(id => !wanted.length || wanted.includes(id))) {
  const task = readTask(id);
  if (task.kind === 'sql') continue;
  const byKey = new Map(readResponses(id).map(call => [callKey(call.namespace, call.tool, call.args), call]));
  for (const program of task.programs) {
    const code = readFileSync(join(TASKS, id, program), 'utf8');
    const calls = new Map<string, RecordedCall>();
    const keys: string[] = [];
    const namespaces = Object.fromEntries(
      task.providers.map(p => [
        p.name,
        Object.fromEntries(
          Object.keys(p.tools).map(tool => [
            tool,
            async (...args: unknown[]) => {
              const key = callKey(p.name, tool, JSON.parse(JSON.stringify(args)));
              keys.push(key);
              const call = byKey.get(key);
              if (!call) throw new Error('unrecorded call: ' + key.slice(0, 200));
              calls.set(key, call);
              if (call.error !== undefined) throw new Error(call.error);
              return JSON.parse(JSON.stringify(call.response));
            },
          ]),
        ),
      ]),
    );
    const result = JSON.stringify((await runProgram(code, namespaces)) ?? null);
    const recording: Recording = {
      task: id,
      program: basename(program),
      source: sha256(code),
      tier: `node ${process.version}`,
      calls: [...calls.values()],
      keys,
      result,
    };
    const dir = join(WORK, 'recordings', id);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, basename(program, '.js') + '.1.json');
    writeFileSync(file, JSON.stringify(recording));
    console.log(`${id}/${basename(program)}: ${keys.length} calls, result ${result.length} B`);
  }
}
