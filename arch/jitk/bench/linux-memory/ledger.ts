// Linux same-host memory ledger: N concurrent held VMs per cell, each cell in a
// fresh cgroup v2 child entered at birth (spawn-cg, clone3 CLONE_INTO_CGROUP).
// Runs as root on the KVM host under the bench lock ($JITK_BENCH_LOCK, default
// ~/bench.lock; ../../tslib/stream-process.ts); method and commands:
// ../RESULTS-LINUX-MEMORY-2026-10-27.md.
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { check, detail } from '../../tslib/assert.ts';
import { median } from '../../tslib/stats.ts';
import { sleep, StreamProcess } from '../../tslib/stream-process.ts';

interface Family {
  name: string;
  fixtures: string[];
  // {W} work dir, {fixture}, {n} (1 when per_process).
  argv: string[];
  env: Record<string, string>;
  // Files read before each cell, outside the measured cgroup (shared images).
  warm: string[];
  per_process: boolean;
  // Override of plan.counts for this family.
  counts: number[];
}
interface Plan {
  cgroup: string;
  memory_max: number;
  counts: number[];
  reps: number;
  settle_s: number;
  families: Family[];
}
interface Holder {
  proc: StreamProcess;
  pid: number;
  events: string[];
}

function read(path: string): string {
  return readFileSync(path, 'utf8');
}
function numbers(text: string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const line of text.trim().split('\n')) {
    const fields = line.trim().split(/\s+/);
    const value = Number(fields[1]);
    if (fields.length >= 2 && Number.isFinite(value)) {
      result[fields[0].replace(/:$/, '')] = value;
    }
  }
  return result;
}
function fill(text: string, w: string, fixture: string, n: number): string {
  return text.split('{W}').join(w).split('{fixture}').join(fixture).split('{n}').join(String(n));
}
function warm(path: string): void {
  if (statSync(path).isDirectory()) {
    for (const name of readdirSync(path)) {
      warm(join(path, name));
    }
  } else {
    readFileSync(path);
  }
}
function pids(cg: string): number[] {
  return read(join(cg, 'cgroup.procs')).trim().split(/\s+/).filter((s) => s.length > 0).map((s) => Number(s));
}
function sample(cg: string): Record<string, unknown> {
  const total: Record<string, number> = {};
  const per: Record<string, unknown>[] = [];
  for (const pid of pids(cg)) {
    let rollup: Record<string, number> = {};
    let comm = '';
    try {
      rollup = numbers(read('/proc/' + pid + '/smaps_rollup'));
      comm = read('/proc/' + pid + '/comm').trim();
    } catch {
      continue;
    }
    for (const key of Object.keys(rollup)) {
      total[key] = (total[key] || 0) + rollup[key];
    }
    per.push({ pid, comm, rss_kib: rollup.Rss || 0, pss_kib: rollup.Pss || 0, private_dirty_kib: rollup.Private_Dirty || 0, anon_huge_kib: rollup.AnonHugePages || 0 });
  }
  return {
    memory_current: Number(read(join(cg, 'memory.current'))),
    memory_stat: numbers(read(join(cg, 'memory.stat'))),
    smaps_total_kib: total,
    processes: per.length <= 16 ? per : per.slice(0, 16),
    process_count: per.length,
    loadavg: read('/proc/loadavg').trim(),
    uptime: read('/proc/uptime').trim(),
    meminfo: numbers(read('/proc/meminfo')),
  };
}
async function start(argv: string[], envs: Record<string, string>, cg: string, spawnCg: string): Promise<Holder> {
  const command: string[] = [spawnCg, cg];
  for (const a of argv) {
    command.push(a);
  }
  const proc = new StreamProcess(command, { env: envs, timeout: 7200 });
  const events: string[] = [];
  let pid = 0;
  while (true) {
    const line = await proc.line(900);
    events.push(line);
    let row: Record<string, unknown> = {};
    try {
      row = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (row.event === 'environment' && pid === 0) {
      pid = Number(row.pid);
    }
    if (row.event === 'held') {
      break;
    }
  }
  check(pid > 0, 'holder did not report its pid');
  return { proc, pid, events };
}
async function stop(holders: Holder[], cg: string): Promise<string[]> {
  for (const h of holders) {
    try {
      process.kill(h.pid, 'SIGTERM');
    } catch {}
    try {
      h.proc.child.stdin!.end();
    } catch {}
  }
  const errors: string[] = [];
  for (const h of holders) {
    try {
      await h.proc.wait(30);
    } catch (error) {
      errors.push(detail(error));
    }
  }
  if (errors.length > 0 && existsSync(join(cg, 'cgroup.kill'))) {
    writeFileSync(join(cg, 'cgroup.kill'), '1');
  }
  const tails: string[] = [];
  for (const h of holders) {
    await h.proc.cleanup();
    const text = Buffer.concat(h.proc.stderr).toString();
    tails.push(text.length > 4000 ? text.slice(text.length - 4000) : text);
  }
  for (let i = 0; i < 100; i++) {
    try {
      rmdirSync(cg);
      break;
    } catch {
      await sleep(0.1);
    }
  }
  check(!existsSync(cg), 'cell cgroup was not removed: ' + cg);
  return tails;
}
async function cell(plan: Plan, family: Family, fixture: string, n: number, rep: number, w: string, spawnCg: string, out: string): Promise<void> {
  for (const path of family.warm) {
    warm(fill(path, w, fixture, n));
  }
  const cg = join(plan.cgroup, family.name + '-' + fixture + '-' + n + '-' + rep);
  mkdirSync(cg);
  const envs: Record<string, string> = { PATH: '/usr/bin:/bin' };
  for (const key of Object.keys(family.env)) {
    envs[key] = fill(family.env[key], w, fixture, n);
  }
  const argv: string[] = [];
  for (const a of family.argv) {
    argv.push(fill(a, w, fixture, family.per_process ? 1 : n));
  }
  const holders: Holder[] = [];
  const began = performance.now();
  let failure = '';
  const samples: Record<string, unknown>[] = [];
  let peak = 0;
  let idle = 0;
  let events: Record<string, number> = {};
  let heldAt = -1;
  try {
    for (let i = 0; i < (family.per_process ? n : 1); i++) {
      holders.push(await start(argv, envs, cg, spawnCg));
    }
    heldAt = (performance.now() - began) / 1000;
    await sleep(plan.settle_s);
    for (let i = 0; i < 3; i++) {
      samples.push(sample(cg));
      await sleep(0.2);
    }
    const before = numbers(read(join(cg, 'cpu.stat'))).usage_usec || 0;
    await sleep(1);
    idle = (numbers(read(join(cg, 'cpu.stat'))).usage_usec || 0) - before;
    peak = Number(read(join(cg, 'memory.peak')));
    events = numbers(read(join(cg, 'memory.events')));
  } catch (error) {
    failure = detail(error);
  }
  const tails = await stop(holders, cg);
  const measured = samples;
  const currents: number[] = measured.map((s) => Number(s.memory_current));
  const row = {
    family: family.name,
    fixture,
    n,
    rep,
    ok: failure === '' && measured.length === 3,
    failure,
    memory_current_median: currents.length ? median(currents) : -1,
    memory_peak: peak,
    memory_events: events,
    idle_cpu_usec: idle,
    held_s: heldAt,
    elapsed_s: (performance.now() - began) / 1000,
    holder_events: holders.length ? holders[0].events : [],
    samples: measured,
    stderr_tail: tails.length ? tails[0] : '',
  };
  appendFileSync(join(out, 'cells.jsonl'), JSON.stringify(row) + '\n');
  console.log(JSON.stringify({ family: family.name, fixture, n, rep, ok: row.ok, current_mib: row.memory_current_median / 1048576, held_s: heldAt, failure }));
}

export async function ledger(args: string[]): Promise<void> {
  const plan = JSON.parse(read(args[0])) as Plan;
  const out = args[1];
  const w = args[2];
  const only = args.length > 3 ? args[3].split(',') : [];
  const spawnCg = join(w, 'bin/spawn-cg');
  mkdirSync(out, { recursive: true });
  check(!existsSync(plan.cgroup), 'task cgroup already exists: ' + plan.cgroup);
  mkdirSync(plan.cgroup);
  try {
    writeFileSync(join(plan.cgroup, 'memory.max'), String(plan.memory_max));
    writeFileSync(join(plan.cgroup, 'memory.swap.max'), '0');
    writeFileSync(join(plan.cgroup, 'cgroup.subtree_control'), '+memory +cpu');
    const families = plan.families.filter((f) => only.length === 0 || only.includes(f.name));
    for (let rep = 0; rep < plan.reps; rep++) {
      const counts = plan.counts.slice();
      // Alternate the count order between repetitions; rotate families per count.
      if (rep % 2 === 1) {
        counts.reverse();
      }
      let turn = rep;
      for (const n of counts) {
        for (let k = 0; k < families.length; k++) {
          const family = families[(k + turn) % families.length];
          const allowed = family.counts.length ? family.counts : plan.counts;
          if (!allowed.includes(n)) {
            continue;
          }
          for (const fixture of family.fixtures) {
            await cell(plan, family, fixture, n, rep, w, spawnCg, out);
          }
        }
        turn += 1;
      }
    }
    writeFileSync(join(out, 'cleanup.json'), JSON.stringify({
      memory_events: numbers(read(join(plan.cgroup, 'memory.events'))),
      memory_peak: Number(read(join(plan.cgroup, 'memory.peak'))),
      remaining: readdirSync(plan.cgroup).filter((name) => statSync(join(plan.cgroup, name)).isDirectory()),
      loadavg: read('/proc/loadavg').trim(),
    }) + '\n');
  } finally {
    for (let i = 0; i < 50; i++) {
      try {
        rmdirSync(plan.cgroup);
        break;
      } catch {
        await sleep(0.1);
      }
    }
  }
  check(!existsSync(plan.cgroup), 'task cgroup was not removed');
}
