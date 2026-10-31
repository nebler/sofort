// The promotion gate: build a program once with scriptc, replay its native
// binary against every recorded first-tier run, and promote it only if each
// replay makes the same calls and returns the same bytes. Anything else
// (build failure, runtime error, unrecorded call, different result) keeps the
// program on the first tier. --selftest also checks that the gate rejects a
// tampered result and a missing reply.
//
//   node bench/v1/promote/record.ts && node bench/v1/promote/gate.ts [--min-runs N] [--selftest] [task-id...]
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readTask, sha256, TASKS } from '../tasks/lib/tasks.ts';
import { nativeEntry, RESULT_MARK, type Recording, scriptc, scriptcVersion, WORK } from './lib.ts';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const minRuns = Number(args[args.indexOf('--min-runs') + 1] ?? 1) || 1;
const wanted = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--min-runs');

const SCRIPTC = scriptc();
const VERSION = scriptcVersion(SCRIPTC);

interface Replay {
  ok: boolean;
  reason?: string;
  ms: number;
}

interface Verdict {
  task: string;
  program: string;
  source: string;
  scriptc: string;
  build: 'ok' | 'cached' | 'failed';
  buildMs: number;
  runs: Replay[];
  promoted: boolean;
  reason: string;
}

// Built binaries are keyed by the entry source and the compiler version, so a
// program comes back as a cache hit and a scriptc bump rebuilds everything.
function build(entry: string): { exe?: string; status: Verdict['build']; ms: number; log?: string } {
  const key = sha256(VERSION + '\n' + entry).slice(0, 16);
  const dir = join(WORK, 'bin', key);
  const exe = join(dir, 'program');
  if (existsSync(exe)) return { exe, status: 'cached', ms: 0 };
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'entry.js'), entry);
  const start = performance.now();
  const r = spawnSync('nice', ['-n', '19', SCRIPTC, 'build', join(dir, 'entry.js'), '-o', exe], {
    cwd: dir,
    encoding: 'utf8',
  });
  const ms = Math.round(performance.now() - start);
  if (r.status !== 0) return { status: 'failed', ms, log: (r.stdout + r.stderr).slice(-2000) };
  return { exe, status: 'ok', ms };
}

function replay(exe: string, recording: Recording, scratch: string): Replay {
  mkdirSync(scratch, { recursive: true });
  const replies = join(scratch, 'replies.jsonl');
  const made = join(scratch, 'made.json');
  writeFileSync(replies, recording.calls.map(call => JSON.stringify(call)).join('\n') + '\n');
  writeFileSync(made, '[]');
  const start = performance.now();
  const r = spawnSync(exe, [replies, made], { encoding: 'utf8', maxBuffer: 1 << 28, timeout: 60_000 });
  const ms = Math.round(performance.now() - start);
  if (r.error) return { ok: false, reason: 'did not finish: ' + r.error.message, ms };
  if (r.status !== 0) return { ok: false, reason: `exit ${r.status}: ${r.stderr.trim().slice(0, 300)}`, ms };
  const at = r.stdout.lastIndexOf('\n' + RESULT_MARK);
  if (at < 0) return { ok: false, reason: 'no result line', ms };
  const result = r.stdout.slice(at + 1 + RESULT_MARK.length);
  const keys: string[] = JSON.parse(readFileSync(made, 'utf8'));
  // Calls a program starts together can be issued in a different order, so
  // the calls compare as a multiset; the result must match byte for byte.
  if (JSON.stringify([...keys].sort()) !== JSON.stringify([...recording.keys].sort())) {
    return { ok: false, reason: `different calls: ${keys.length} made, ${recording.keys.length} recorded`, ms };
  }
  if (result !== recording.result) {
    let i = 0;
    while (i < result.length && result[i] === recording.result[i]) i++;
    return { ok: false, reason: `different result at byte ${i}`, ms };
  }
  return { ok: true, ms };
}

function readRecordings(task: string): Map<string, Recording[]> {
  const dir = join(WORK, 'recordings', task);
  const byProgram = new Map<string, Recording[]>();
  if (!existsSync(dir)) return byProgram;
  for (const file of readdirSync(dir).sort()) {
    const recording: Recording = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    byProgram.set(recording.program, [...(byProgram.get(recording.program) ?? []), recording]);
  }
  return byProgram;
}

function gate(task: string, program: string, recordings: Recording[]): Verdict & { exe?: string } {
  const spec = readTask(task);
  const code = readFileSync(join(TASKS, task, 'programs', program), 'utf8');
  const source = sha256(code);
  const providers = spec.providers.map(p => ({ name: p.name, tools: Object.keys(p.tools) }));
  const b = build(nativeEntry(code, providers));
  const verdict: Verdict & { exe?: string } = {
    task,
    program,
    source,
    scriptc: VERSION,
    build: b.status,
    buildMs: b.ms,
    runs: [],
    promoted: false,
    reason: '',
    exe: b.exe,
  };
  if (!b.exe) return { ...verdict, reason: 'build failed: ' + (b.log ?? '').trim().split('\n').pop() };
  // A recording of an older version of the program can't vouch for this one.
  const current = recordings.filter(r => r.source === source);
  current.forEach((recording, i) => {
    verdict.runs.push(replay(b.exe!, recording, join(WORK, 'scratch', task, program, String(i))));
  });
  const failed = verdict.runs.find(r => !r.ok);
  if (failed) verdict.reason = failed.reason!;
  else if (current.length < minRuns) verdict.reason = `${current.length} of ${minRuns} recorded runs`;
  else {
    verdict.promoted = true;
    verdict.reason = `${current.length} replays identical`;
  }
  return verdict;
}

const tasks = readdirSync(join(WORK, 'recordings'))
  .filter(id => !wanted.length || wanted.includes(id))
  .sort();
const verdicts: Verdict[] = [];
let selftested = false;
let selftestFailed = false;
for (const task of tasks) {
  for (const [program, recordings] of readRecordings(task)) {
    const { exe, ...verdict } = gate(task, program, recordings);
    verdicts.push(verdict);
    const run = verdict.runs[0]?.ms;
    console.log(
      `${task}/${program}: ${verdict.promoted ? 'PROMOTE' : 'stay   '} build ${verdict.build} ${verdict.buildMs} ms` +
        (run === undefined ? '' : `, replay ${run} ms`) +
        ` (${verdict.reason})`,
    );
    if (flag('--selftest') && !selftested && verdict.promoted && exe) {
      selftested = true;
      const base = recordings[0];
      const tampered: [string, Recording][] = [
        ['tampered result', { ...base, result: '[' + base.result + ']' }],
        ['missing reply', { ...base, calls: base.calls.slice(1) }],
        ['extra recorded call', { ...base, keys: [...base.keys, 'x.y []'] }],
      ];
      for (const [name, recording] of tampered) {
        const r = replay(exe, recording, join(WORK, 'scratch', 'selftest', name.replace(/ /g, '-')));
        if (r.ok) selftestFailed = true;
        console.log(`  selftest ${name}: ${r.ok ? 'ACCEPTED (gate is broken)' : 'rejected, ' + r.reason}`);
      }
    }
  }
}
writeFileSync(join(WORK, 'verdicts.json'), JSON.stringify(verdicts, null, 2));
const promoted = verdicts.filter(v => v.promoted).length;
console.log(`${promoted}/${verdicts.length} promoted (scriptc ${VERSION}, min runs ${minRuns})`);
if (flag('--selftest') && (!selftested || selftestFailed)) {
  console.error(selftested ? 'selftest failed' : 'selftest did not run: nothing was promoted');
  process.exit(1);
}
