import { existsSync, mkdirSync, readdirSync, rmdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { check, dump, env, median, read, sleep, StreamProcess, type Json } from './lib.ts';

interface Event {
  event: string;
  pid: number;
  threads: number;
  lost: number;
  deadline_ns: number;
  [key: string]: unknown;
}

function numbers(path: string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const line of read(path).trim().split('\n')) {
    const fields = line.split(/\s+/);
    const value = Number(fields[1]);
    if (Number.isFinite(value)) {
      result[fields[0].replace(/:$/, '')] = value;
    }
  }
  return result;
}
function sample(cg: string, pid: number): Json {
  return {
    memory_current: Number(read(join(cg, 'memory.current'))), memory_stat: numbers(join(cg, 'memory.stat')),
    cpu_stat: numbers(join(cg, 'cpu.stat')), smaps_rollup_kib: numbers('/proc/' + pid + '/smaps_rollup'),
    status: read('/proc/' + pid + '/status'), meminfo: read('/proc/meminfo'),
    loadavg: read('/proc/loadavg'), uptime: read('/proc/uptime'),
    slabinfo: read('/proc/slabinfo').split('\n').filter((line) => line.toLowerCase().includes('kvm')).join('\n'),
    snapshot_smaps: read('/proc/' + pid + '/smaps').split('\n').filter((line) => line.includes('.mem')).join('\n'),
    fds: readdirSync('/proc/' + pid + '/fd').length,
  };
}
export async function ledger(native: boolean): Promise<void> {
  const root = process.env.JITK_LEDGER_ROOT || (native ? '/home/dev/r7-bytes' : '/home/dev/r6-shard');
  const cg = process.env.JITK_LEDGER_CGROUP || (native ? '/sys/fs/cgroup/r7-bytes' : '/sys/fs/cgroup/r6-shard');
  const snapshot = resolve(root, process.env.JITK_LEDGER_SNAPSHOT || (native ? 'images/lua-r7' : 'final-r6'));
  const tools = (process.env.JITK_LEDGER_NATIVE_TOOLS || '').split(/\s+/).filter((s) => s.length > 0);
  const fixtures = tools.length ? tools : (process.env.JITK_LEDGER_FIXTURES || (native ? 'native_lua' : 'ready return2 one_tool promise10 json64k')).split(/\s+/);
  const out = process.env.JITK_LEDGER_OUTPUT || join(root, 'raw');
  mkdirSync(out, { recursive: true });
  mkdirSync(cg, { recursive: true });
  writeFileSync(join(cg, 'memory.max'), '3758096384');
  writeFileSync(join(cg, 'memory.swap.max'), '0');
  writeFileSync(join(cg, 'cgroup.subtree_control'), '+memory +cpu');
  async function cell(name: string, n: number, rep: number): Promise<void> {
    const base = tools.length ? join(root, 'images', name + '-r7') : snapshot;
    if (native) {
      // Read the shared files before entering the measured child cgroup.
      for (const ext of ['mem', 'regs', 'layout']) {
        read(base + '.' + ext);
      }
    }
    const batch = join(cg, 'batch-' + rep + '-' + name + '-' + n);
    mkdirSync(batch);
    const stem = join(out, 'ledger-' + rep + '-' + name + '-' + n);
    const request = join(root, tools.length ? 'ledger-' + name + '.request' : 'ledger.request');
    const args = native ? ['native-hold', base, request, String(n), '3600'] : ['hold', snapshot, name, String(n), '3600'];
    const p = new StreamProcess([join(root, 'spawn-cg'), batch, join(root, 'arch/jitk/shard/target/release/real'), ...args], { cwd: root, env: env({ GLIBC_TUNABLES: 'glibc.malloc.hugetlb=0' }) });
    const events: Event[] = [];
    let pid = 0;
    const start = performance.now();
    try {
      while (true) {
        const row = JSON.parse(await p.line(native ? 180 : Number(process.env.JITK_LEDGER_PROGRESS_TIMEOUT || 600))) as Event;
        events.push(row);
        if (row.event === 'environment') {
          pid = Number(row.pid);
        }
        if (row.event === 'held') {
          break;
        }
      }
      check(read('/proc/' + pid + '/status').includes('Threads:\t' + (native ? 1 : events[0].threads) + '\n'), 'holder threads');
      await sleep(3);
      const samples: Record<string, unknown>[] = [];
      for (let i = 0; i < 3; i++) {
        samples.push(sample(batch, pid));
        await sleep(.2);
      }
      const before = numbers(join(batch, 'cpu.stat')).usage_usec;
      await sleep(1);
      const idle = numbers(join(batch, 'cpu.stat')).usage_usec - before;
      dump(stem + '.json', { fixture: name, n, rep, events, samples, idle_cpu_usec: idle, memory_peak: Number(read(join(batch, 'memory.peak'))), elapsed_s: (performance.now() - start) / 1000, cgroup: batch, enclosing_memory_current: Number(read(join(cg, 'memory.current'))) });
      console.log(JSON.stringify({ event: 'cell', fixture: name, n, rep, memory_current: median(samples.map((s) => Number(s.memory_current))), idle_cpu_usec: idle }));
    } finally {
      if (pid) {
        try {
          process.kill(pid, 'SIGTERM');
        } catch {}
      }
      try {
        await p.wait(15);
      } finally {
        await p.cleanup();
        writeFileSync(stem + '.stderr', Buffer.concat(p.stderr));
        for (let i = 0; i < 50; i++) {
          try {
            rmdirSync(batch);
            break;
          } catch {
            await sleep(.1);
          }
        }
      }
    }
  }
  for (let rep = 0; rep < 2; rep++) {
    for (const name of fixtures) {
      for (const n of (process.env.JITK_LEDGER_COUNTS || '1,16,64,256').split(',').map((s) => Number(s))) {
        await cell(name, n, rep);
      }
    }
  }
  if (fixtures.includes('ready')) {
    await cell('ready', 1024, 2);
  }
  dump(join(out, 'ledger-cleanup.json'), { memory_events: numbers(join(cg, 'memory.events')), remaining_cgroups: readdirSync(cg).filter((name) => statSync(join(cg, name)).isDirectory()), loadavg: read('/proc/loadavg') }, false);
}
export async function waitObserver(args: string[]): Promise<void> {
  const root = args[0];
  const binary = resolve(root, args[1]);
  const n = Number(args[2]);
  const snapshot = resolve(root, args[3] || 'arena');
  const raw = process.env.JITK_R7_OUTPUT || join(root, 'raw');
  mkdirSync(raw, { recursive: true });
  const p = new StreamProcess([binary, 'hold', snapshot, 'wait', String(n), '3']);
  const rows: Event[] = [];
  let pid = 0;
  try {
    while (true) {
      const row = JSON.parse(await p.line(120)) as Event;
      rows.push(row);
      if (row.event === 'environment') {
        pid = Number(row.pid);
      }
      if (row.event === 'held') {
        break;
      }
    }
    const status = read('/proc/' + pid + '/status');
    const taskIds = readdirSync('/proc/' + pid + '/task').sort();
    const children = new Set<string>();
    for (const tid of taskIds) {
      for (const child of read('/proc/' + pid + '/task/' + tid + '/children').trim().split(/\s+/)) {
        if (child) {
          children.add(child);
        }
      }
    }
    check(children.size === 1, 'one watchdog required');
    const watchdog = Array.from(children)[0];
    const cmdline = read('/proc/' + watchdog + '/cmdline').split('\0').filter((s) => s.length > 0);
    const watchdogStatus = read('/proc/' + watchdog + '/status');
    check(cmdline[1] === 'watchdog' && watchdogStatus.includes('Threads:\t1\n'), 'watchdog identity');
    const before = read('/proc/' + pid + '/stat');
    await sleep(1);
    const after = read('/proc/' + pid + '/stat');
    const smaps = read('/proc/' + pid + '/smaps_rollup');
    check(await p.wait(120) === 0, 'holder exit');
    for (const line of p.queue) {
      rows.push(JSON.parse(line));
    }
    function ticks(s: string): number {
      const fields = s.slice(s.lastIndexOf(')') + 2).split(/\s+/);
      return Number(fields[11]) + Number(fields[12]);
    }
    check(Number(status.split('Threads:\t')[1].split('\n')[0]) === rows[0].threads, 'stable owner threads');
    check(rows[rows.length - 1].event === 'released' && rows[rows.length - 1].lost === 0, 'no lost releases');
    console.log(JSON.stringify({ n, events: rows, status, task_ids: taskIds, watchdog_pid: Number(watchdog), watchdog_status: watchdogStatus, watchdog_cmdline: cmdline, stat_before: before, stat_after: after, idle_cpu_ticks: ticks(after) - ticks(before), smaps_rollup: smaps, loadavg: read('/proc/loadavg'), uptime: read('/proc/uptime') }));
  } finally {
    await p.cleanup();
    writeFileSync(join(raw, 'wait-' + n + '.stderr'), Buffer.concat(p.stderr));
  }
}
export async function escalation(args: string[]): Promise<void> {
  const root = args[0];
  const raw = process.env.JITK_R7_OUTPUT || join(root, 'raw');
  mkdirSync(raw, { recursive: true });
  const p = new StreamProcess([resolve(root, args[1]), 'deadlines', resolve(root, args[2] || 'arena'), 'spin', '8']);
  const rows: Event[] = [];
  let pid = 0;
  try {
    let row: Event;
    while (true) {
      row = JSON.parse(await p.line(10));
      rows.push(row);
      if (row.event === 'environment') {
        pid = Number(row.pid);
      }
      if (row.event === 'deadline_armed') {
        break;
      }
    }
    process.kill(pid, 'SIGSTOP');
    const stopped = Number(process.hrtime.bigint());
    const code = await p.wait(10);
    const reaped = Number(process.hrtime.bigint());
    const stderr = Buffer.concat(p.stderr).toString();
    check(code === -9 && stderr.includes('watchdog escalation:'), 'watchdog must SIGKILL stopped owner');
    console.log(JSON.stringify({ event: 'escalation', returncode: code, pid, deadline_ns: row.deadline_ns, sigstop_at_ns: stopped, reaped_at_ns: reaped, deadline_to_reap_ns: reaped - Number(row.deadline_ns), grace_ms: 100, events: rows, stderr, loadavg: read('/proc/loadavg'), uptime: read('/proc/uptime') }));
  } finally {
    await p.cleanup();
    writeFileSync(join(raw, 'escalation.stderr'), Buffer.concat(p.stderr));
  }
}
