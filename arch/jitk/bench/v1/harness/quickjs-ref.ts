// Working-set reference (tasks/README.md "Working sets"): each program's
// peak of live QuickJS allocations, in requested bytes, on 64-bit Bellard
// QuickJS 2026-06-04 (the guest's QuickJS) run natively by quickjs-ref/ws.c.
// Replies cross as JSON text and are parsed inside, as in the guest; the
// guest's transport (16 KiB fragments, then a join) is not counted.
//
//   sh bench/v1/harness/quickjs-ref/build.sh
//   $JITK_NODE bench/v1/harness/quickjs-ref.ts [--out file.json] [--trace DIR] [task-id[:program-number]...]
//
// --trace DIR also writes every allocation of each program (DIR/<task>-<n>.trace).
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { Ledger, Replay } from './replay.ts';
import { type LoadedTask, loadTask } from './task.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = argv.indexOf(name);
  if (i < 0) return undefined;
  const v = argv[i + 1];
  argv.splice(i, 2);
  return v;
};
const out = flag('--out');
const traceDir = flag('--trace');
const ws = flag('--ws') ?? join(here, '../.work/quickjs-ref/ws');
const selected = argv.length ? argv : ['t1-issue-triage', 't2-ci-triage', 't3-crm-join', 't4-otel-rollup', 't5-openapi'];

export async function reference(task: LoadedTask, program: string, code: string, trace?: string) {
  const dir = mkdtempSync(join(tmpdir(), 'qjs-ref-'));
  const programPath = join(dir, 'program.js');
  writeFileSync(programPath, code);
  const replay = new Replay(task.spec, task.responses, 0);
  const ledger = new Ledger();
  const fns = new Map(replay.providers(ledger).map(p => [p.name, p.fns]));
  const child = spawn(ws, [join(here, 'quickjs-ref/harness.js'), programPath, dir], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, WS_NAMESPACES: JSON.stringify([...fns.keys()]), ...(trace ? { WS_TRACE: trace } : {}) },
  });
  let stderr = '';
  child.stderr.on('data', b => { stderr += b; });
  let result: { ok: boolean; value?: unknown; error?: string } = { ok: false, error: 'no result' };
  const done = new Promise<number>(r => child.on('close', c => r(c ?? -1)));
  for await (const line of createInterface({ input: child.stdout })) {
    if (line[0] === 'C') {
      const [id, ns, tool, args] = JSON.parse(line.slice(1)) as [number, string, string, unknown[]];
      void Promise.resolve()
        .then(() => fns.get(ns)![tool]!(...args))
        .then(v => JSON.stringify(v ?? null), e => '!' + String((e as Error)?.message ?? e))
        .then(text => { writeFileSync(join(dir, String(id)), text); child.stdin.write(id + '\n'); });
    } else if (line[0] === 'D') result = { ok: true, value: JSON.parse(line.slice(1)) };
    else if (line[0] === 'E') result = { ok: false, error: JSON.parse(line.slice(1)) as string };
  }
  child.stdin.end();
  const code_ = await done;
  rmSync(dir, { recursive: true, force: true });
  const m = /peak (\d+) floor (\d+)/.exec(stderr);
  const verdict = result.ok ? task.oracle(result.value) : { ok: false, reason: result.error };
  return {
    engine: 'quickjs-native', task: task.spec.id, program, ok: verdict.ok && !ledger.unmatched && code_ === 0,
    bytes: m ? Number(m[1]) : null, floor: m ? Number(m[2]) : null, detail: verdict.reason ?? (m ? undefined : stderr.slice(0, 300)),
  };
}

if (import.meta.main) {
  const rows = [];
  for (const sel of selected) {
    const [id, only] = sel.split(':');
    const task = await loadTask(join(here, '../tasks', id!));
    for (const [i, p] of task.programs.entries()) {
      if (only && Number(only) !== i + 1) continue;
      const row = await reference(task, p.name, p.code, traceDir ? join(traceDir, `${id}-${i + 1}.trace`) : undefined);
      console.log(JSON.stringify(row));
      rows.push(row);
    }
  }
  if (out) writeFileSync(out, JSON.stringify(rows, null, 1) + '\n');
}
