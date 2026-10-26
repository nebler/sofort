import { propagate, Interrupted } from '../lib.ts';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, join, relative } from 'node:path';
import { loadavg } from 'node:os';
import { utc, now, detail, check, equal } from '../lib.ts';
import { ledgerProc, templates, timebase, sleep, wait, close } from '../native.ts';
import { Worker as CanonicalWorker, ACTIVE, type Frame } from '../controller.ts';

export const HERE = resolve(process.env.JITK_LEDGER_DIR || import.meta.dirname);
export const DARWIN = process.platform === 'darwin';
export const TEMPLATES = templates();
export const TIMEBASE = timebase();
export function command(argv: string[], timeout = 30): Frame {
  const start = now();
  try {
    // Preserve nonzero exit output; spawnSync cannot accept cwd in 0.4.5.
    const result = execFileSync(argv[0], argv.slice(1), { encoding: 'utf8', timeout: timeout * 1000, stdio: ['ignore', 'pipe', 'pipe'] });
    return { argv, status: 0, stdout: result, stderr: '', elapsed_s: now() - start };
  } catch (error) {
    propagate(error);
    const e = error as { status?: number; stdout?: Buffer; stderr?: Buffer; message?: string };
    if (typeof e.status === 'number') {
      return { argv, status: e.status, stdout: e.stdout?.toString() || '', stderr: e.stderr?.toString() || '', elapsed_s: now() - start };
    }
    return { argv, error: detail(error), elapsed_s: now() - start };
  }
}
export function host(): Frame {
  return { utc: utc(), load: loadavg(), uptime: command(['uptime']) };
}
export function proc(pid: number): Frame {
  if (DARWIN) {
    const result = ledgerProc(pid, TEMPLATES);
    result.utc = utc();
    return result;
  }
  const record: Frame = { pid, utc: utc() };
  const root = '/proc/' + pid;
  try {
    for (const file of ['status', 'smaps_rollup', 'smaps', 'stat']) {
      try {
        record[file] = readFileSync(join(root, file), 'utf8');
      } catch (error) {
    propagate(error);
        record[file + '_error'] = detail(error);
      }
    }
    const stat = String(record.stat);
    const parts = stat.slice(stat.lastIndexOf(')') + 2).split(/\s+/);
    const hz = Number(execFileSync('getconf', ['CLK_TCK'], { encoding: 'utf8' }).trim());
    record.user_ms = Number(parts[11]) * 1000 / hz;
    record.system_ms = Number(parts[12]) * 1000 / hz;
    record.smaps_totals = {};
    for (const match of String(record.smaps_rollup || '').matchAll(/^([A-Za-z_]+):\s+(\d+) kB/gm)) {
      record.smaps_totals[match[1]] = Number(match[2]) * 1024;
    }
    record.rss = record.smaps_totals.Rss ?? null;
  } catch (error) {
    propagate(error);
    record.error = detail(error);
  }
  return record;
}
export function system(): Frame {
  const start = host();
  const commands: Record<string, string[]> = DARWIN ? { vm_stat: ['/usr/bin/vm_stat'], memory_pressure: ['/usr/bin/memory_pressure', '-Q'], sysctl_vm: ['/usr/sbin/sysctl', 'vm'] } : { vm_stat: ['cat', '/proc/vmstat'], meminfo: ['cat', '/proc/meminfo'], memory_pressure: ['cat', '/proc/pressure/memory'] };
  start.commands = {};
  for (const key of Object.keys(commands)) {
    start.commands[key] = command(commands[key]);
  }
  if (DARWIN) {
    const text = String(start.commands.vm_stat.stdout || '');
    const page = /page size of (\d+)/.exec(text);
    check(page, 'vm_stat page size missing');
    start.page_size = Number(page[1]);
    start.vm_pages = {};
    for (const m of text.matchAll(/^([^:\n]+):\s+(\d+)\./gm)) {
      start.vm_pages[m[1]] = Number(m[2]);
    }
    start.sysctl = {};
    for (const m of String(start.commands.sysctl_vm.stdout || '').matchAll(/^(vm\.[^:]+): (.*)$/gm)) {
      start.sysctl[m[1]] = m[2];
    }
  }
  start.finished_utc = utc();
  return start;
}
export class Worker {
  worker: CanonicalWorker;
  pid: number;
  closed = false;
  constructor(argv: string[]) {
    this.worker = new CanonicalWorker(argv);
    this.pid = this.worker.pid;
    this.worker.strictProtocol = false;
  }
  recv(timeout = 15): Frame {
    return this.worker.recv(timeout);
  }
  ready(): void {
    this.worker.ready(DARWIN, 15);
  }
  send(frame: Frame): void {
    this.worker.send(frame);
  }
  close(): Frame | null {
    if (this.closed) {
      return null;
    }
    this.closed = true;
    // Ledger always terminates and wait4-reaps the owned process group.
    try {
      process.kill(-this.pid, 'SIGKILL');
    } catch {}
    const r = wait(this.pid);
    check(r);
    this.worker.closed = true;
    ACTIVE.delete(this.pid);
    close(this.worker.p.stdin);
    close(this.worker.p.stdout);
    close(this.worker.p.stderr);
    return { user_ms: r.user_ms, system_ms: r.system_ms, status: r.status };
  }
}
export function size(text: string): number {
  const match = /^([\d.]+)([KMGT]?)$/.exec(text);
  check(match, 'invalid vmmap size ' + text);
  return Number(match[1]) * 1024 ** (match[2] ? ' KMGT'.indexOf(match[2]) : 0);
}
export function parseVmmap(text: string): Frame {
  const rows: Frame = {};
  const zones: Frame = {};
  let inTable = false;
  let zone = false;
  for (const line of text.split('\n')) {
    if (line.startsWith('REGION TYPE') && line.includes('SIZE')) {
      inTable = true;
      continue;
    }
    if (line.startsWith('MALLOC ZONE')) {
      inTable = false;
      zone = true;
      continue;
    }
    if (inTable) {
      const m = /^(.*?)\s{2,}(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\d+)/.exec(line);
      if (m) {
        try {
          const row: Frame = {};
          for (const [i, key] of ['virtual', 'resident', 'dirty', 'swapped', 'volatile', 'nonvolatile', 'empty'].entries()) {
            row[key] = size(m[i + 2]);
          }
          rows[m[1].trim()] = row;
        } catch {}
      }
    }
    if (zone && line.startsWith('DefaultMallocZone_')) {
      const parts = line.trim().split(/\s+/);
      const row: Frame = {};
      for (const [i, key] of ['virtual', 'resident', 'dirty', 'swapped', 'allocations', 'allocated', 'fragmented'].entries()) {
        if (i + 1 < parts.length) {
          row[key] = size(parts[i + 1]);
        }
      }
      zones[parts[0]] = row;
    }
  }
  return { regions: rows, malloc_zones: zones };
}
export function diagnostics(pid: number, folder: string, full = false): Frame {
  mkdirSync(folder, { recursive: true });
  if (!DARWIN) {
    return { process: proc(pid) };
  }
  const calls: Record<string, string[]> = { 'vmmap-summary': ['vmmap', '-summary', String(pid)], footprint: ['footprint', '-p', String(pid), '-f', 'bytes', '-w'], 'footprint-object': ['footprint', '-p', String(pid), '--vmObjectDirty', '-f', 'bytes', '-w'] };
  if (full) {
    calls.vmmap = ['vmmap', '-wide', String(pid)];
  }
  const result: Frame = {};
  for (const key of Object.keys(calls)) {
    const r = command(calls[key]);
    const path = join(folder, key + '.txt');
    writeFileSync(path, (r.stdout || '') + (r.stderr || ''));
    result[key] = { path: relative(HERE, path), status: r.status ?? null, elapsed_s: r.elapsed_s };
    if (key === 'vmmap-summary') {
      result.parsed = parseVmmap(r.stdout || '');
    }
  }
  return result;
}
