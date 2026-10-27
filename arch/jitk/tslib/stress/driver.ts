// Watchdog driver for stress/child-wait (SCRIPTC-HANG.md). Runs the subject
// repeatedly under optional CPU load; a run whose progress file stops moving
// for --stall seconds is a hang. The hang is classified from `ps` (subject
// alive, a zombie child), optionally sampled, then killed. The driver itself
// spawns through ../process.ts, so its own waits are bounded.
import { spawn } from 'node:child_process';
import { cpus } from 'node:os';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { killGroup, spawnCapture, startDirect, track } from '../process.ts';

function option(name: string, fallback: string): string {
  const index = process.argv.indexOf('--' + name);
  return index < 0 ? fallback : String(process.argv[index + 1]);
}
function sleep(milliseconds: number): Promise<void> {
  return new Promise<void>(done => setTimeout(done, milliseconds));
}

const subject = resolve(option('subject', ''));
const modes = option('modes', 'raw').split(',');
const runs = Number(option('runs', '10'));
const count = Number(option('count', '500'));
const concurrencies = option('concurrency', '1,8').split(',').map(Number);
const load = Number(option('load', String(cpus().length)));
const stall = Number(option('stall', '5'));
const out = resolve(option('out', '.work/stress.json'));
const samples = option('samples', '');
const program = option('program', '/usr/bin/true');
// Extra subject flags, space separated (e.g. '--detached 1 --env 1').
const extra = option('extra', '').split(' ').filter(s => s.length > 0);
// Child program arguments, comma separated (may contain spaces).
const programArgs = option('args', '');

interface Hang {
  mode: string;
  concurrency: number;
  run: number;
  completed: number;
  zombie: boolean;
  stat: string;
  sample: string;
}
interface Cell {
  mode: string;
  concurrency: number;
  runs: number;
  spawns: number;
  hangs: number;
  zombieHangs: number;
  seconds: number;
  // batches slower than 20 ms, 200 ms, 900 ms, and the slowest (ms)
  slow20: number;
  slow200: number;
  slow900: number;
  worstMs: number;
}

// "done slow20 slow200 slow900 worst-ms" from the subject.
function progressOf(path: string): number[] {
  const text = existsSync(path) ? readFileSync(path, "utf8").trim() : "";
  return text ? text.split(" ").map(Number) : [0, 0, 0, 0, 0];
}
function account(cell: Cell, fields: number[]): void {
  cell.slow20 += fields[1];
  cell.slow200 += fields[2];
  cell.slow900 += fields[3];
  cell.worstMs = Math.max(cell.worstMs, fields[4]);
}

// Subject state and its zombie children, from one ps listing.
async function inspect(pid: number): Promise<{ stat: string; zombie: boolean }> {
  const listing = await spawnCapture(['/bin/ps', '-ax', '-o', 'pid=,ppid=,stat='], { stdio: 'pipe', timeout: 30 }, startDirect);
  let stat = '';
  let zombie = false;
  for (const line of listing.stdout.toString().split('\n')) {
    const fields = line.trim().split(/\s+/);
    if (fields.length < 3) {
      continue;
    }
    if (Number(fields[0]) === pid) {
      stat = fields[2];
    }
    if (Number(fields[1]) === pid && fields[2].startsWith('Z')) {
      zombie = true;
    }
  }
  return { stat, zombie };
}

async function once(mode: string, concurrency: number, run: number, cell: Cell, hangs: Hang[]): Promise<void> {
  const progress = join(resolve('.work'), 'progress-' + process.pid);
  rmSync(progress, { force: true });
  const argv = ['--mode', mode, '--count', String(count), '--concurrency', String(concurrency), '--progress', progress, '--program', program, ...(programArgs ? ['--args', programArgs] : []), ...extra];
  const child = spawn(subject, argv, { detached: true, stdio: 'inherit' });
  let closed = false;
  child.on('close', () => { closed = true; });
  track(child, 3600);
  const started = performance.now();
  let last = 0;
  let fields = [0, 0, 0, 0, 0];
  let moved = performance.now();
  let hung = false;
  while (!closed) {
    await sleep(100);
    fields = progressOf(progress);
    if (fields[0] !== last) {
      last = fields[0];
      moved = performance.now();
    } else if (!closed && performance.now() - moved > stall * 1000) {
      hung = true;
      break;
    }
  }
  if (hung) {
    const pid = Number(child.pid);
    const state = await inspect(pid);
    let samplePath = '';
    if (samples && state.zombie && hangs.filter(h => h.mode === mode).length < 2) {
      mkdirSync(samples, { recursive: true });
      samplePath = join(samples, mode + '-c' + concurrency + '-r' + run + '.sample.txt');
      await spawnCapture(['/usr/bin/sample', String(pid), '1', '-file', samplePath], { stdio: 'pipe', timeout: 60 }, startDirect);
    }
    killGroup(child);
    while (!closed) {
      await sleep(10);
    }
    hangs.push({ mode, concurrency, run, completed: last, zombie: state.zombie, stat: state.stat, sample: samplePath });
    cell.hangs += 1;
    cell.zombieHangs += state.zombie ? 1 : 0;
    cell.spawns += last;
    account(cell, fields);
    process.stderr.write('HANG ' + mode + ' c=' + concurrency + ' run=' + run + ' after ' + last + ' zombie=' + state.zombie + ' stat=' + state.stat + '\n');
  } else {
    fields = progressOf(progress);
    const completed = fields[0];
    if (completed !== count) {
      throw new Error('subject failed: mode ' + mode + ' completed ' + completed);
    }
    cell.spawns += completed;
    account(cell, fields);
    cell.seconds += (performance.now() - started) / 1000;
  }
  cell.runs += 1;
  rmSync(progress, { force: true });
}

async function main(): Promise<void> {
  if (!existsSync(subject)) {
    throw new Error('missing --subject');
  }
  mkdirSync(resolve('.work'), { recursive: true });
  const loaders = [];
  for (let i = 0; i < load; i += 1) {
    const child = spawn('/usr/bin/yes', [], { detached: true, stdio: 'ignore' });
    track(child, 7200);
    loaders.push(child);
  }
  const cells: Cell[] = [];
  const hangs: Hang[] = [];
  const started = new Date().toISOString();
  try {
    for (const mode of modes) {
      for (const concurrency of concurrencies) {
        const cell: Cell = { mode, concurrency, runs: 0, spawns: 0, hangs: 0, zombieHangs: 0, seconds: 0, slow20: 0, slow200: 0, slow900: 0, worstMs: 0 };
        cells.push(cell);
        for (let run = 0; run < runs; run += 1) {
          await once(mode, concurrency, run, cell, hangs);
        }
        process.stderr.write(mode + ' c=' + concurrency + ': ' + cell.hangs + ' hangs / ' + cell.runs + " runs, " + cell.spawns + " spawns, slow>900ms " + cell.slow900 + ", slow>200ms " + cell.slow200 + ", slow>20ms " + cell.slow20 + ", worst " + cell.worstMs + " ms\n");
      }
    }
  } finally {
    for (const child of loaders) {
      killGroup(child);
    }
  }
  const report = { started, finished: new Date().toISOString(), program, count, runs, load, stall, cells, hangs };
  writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(cells));
}

await main();
