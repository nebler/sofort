import { spawn } from 'node:child_process';
import { appendFileSync, closeSync, mkdirSync, openSync, readFileSync, readSync, rmdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { check, dump } from '../lib.ts';
const root = process.env.JITK_HELPERS_ROOT || '/home/dev/r8-helpers';
const phase = process.env.PHASE;
check(phase, 'PHASE required');
const out = join(root, 'raw', phase);
mkdirSync(out, { recursive: true });
const cgroot = process.env.JITK_HELPERS_CGROUP_ROOT || '/sys/fs/cgroup/r8-helpers';
mkdirSync(cgroot, { recursive: true });
writeFileSync(join(cgroot, 'cgroup.subtree_control'), '+memory +cpu');
const node = process.env.JITK_NODE || '/home/dev/r7-ipc/node/node-v24.13.0-linux-arm64/bin/node';
const base = process.env.JITK_SHARD_SNAPSHOT;
check(base, 'JITK_SHARD_SNAPSHOT required');
function sleep(ms: number): Promise<void> {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}
function warm(path: string): void {
  const fd = openSync(path, 'r');
  try {
    const bytes = Buffer.alloc(65536);
    while (readSync(fd, bytes, 0, bytes.length, null) > 0) {}
  } finally {
    closeSync(fd);
  }
}
for (let rep = 0; rep < 2; rep += 1) {
  for (const n of [1, 16, 32, 64]) {
    for (const ext of ['mem', 'regs', 'layout']) {
      warm(base + '.' + ext);
    }
    const cg = join(cgroot, phase + '-' + rep + '-' + n);
    mkdirSync(cg);
    const err = join(out, rep + '-' + n + '.stderr');
    writeFileSync(err, '');
    const command = ['-c', 'echo $$ > "$1/cgroup.procs"; shift; exec "$@"', 'spawn', cg, node, join(root, 'arch/jitk/executor/ipc/measure-helpers.mjs'), 'hold', String(n)];
    const child = spawn('sh', command, { detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const events: unknown[] = [];
    const lines: string[] = [];
    let buffer = '';
    let ended = false;
    child.stdout!.on('data', (bytes: Buffer) => {
      buffer += bytes.toString();
      let index = buffer.indexOf('\n');
      while (index >= 0) {
        lines.push(buffer.slice(0, index));
        buffer = buffer.slice(index + 1);
        index = buffer.indexOf('\n');
      }
    });
    child.stderr!.on('data', (bytes: Buffer) => appendFileSync(err, bytes));
    const closed = new Promise<void>(resolve => child.on('close', () => { ended = true; resolve(); }));
    try {
      while (true) {
        const deadline = performance.now() + 120000;
        while (!lines.length) {
          check(!ended, 'holder failed ' + child.exitCode);
          check(performance.now() < deadline, 'no holder progress');
          await sleep(5);
        }
        const event = JSON.parse(lines.shift()!) as { event: string };
        events.push(event);
        if (event.event === 'held') {
          break;
        }
      }
      await sleep(1000);
      const samples: { memory_current: number; memory_stat: string; smaps: Record<string, string>; load: string }[] = [];
      for (let i = 0; i < 3; i += 1) {
        const pids = readFileSync(join(cg, 'cgroup.procs'), 'utf8').trim().split(/\s+/).filter(Boolean);
        const smaps: Record<string, string> = {};
        for (const pid of pids) {
          smaps[pid] = readFileSync('/proc/' + pid + '/smaps_rollup', 'utf8');
        }
        samples.push({ memory_current: Number(readFileSync(join(cg, 'memory.current'), 'utf8')), memory_stat: readFileSync(join(cg, 'memory.stat'), 'utf8'), smaps, load: readFileSync('/proc/loadavg', 'utf8') });
        await sleep(200);
      }
      dump(join(out, rep + '-' + n + '.json'), { phase, n, rep, events, samples, memory_peak: Number(readFileSync(join(cg, 'memory.peak'), 'utf8')) });
      console.log(JSON.stringify({ phase, rep, n, current: samples[1].memory_current }));
    } finally {
      child.kill('SIGTERM');
      const timer = setTimeout(() => {
        try {
          process.kill(-child.pid!, 'SIGKILL');
        } catch {}
      }, 15000);
      await closed;
      clearTimeout(timer);
      rmdirSync(cg);
    }
  }
}
rmdirSync(cgroot);
