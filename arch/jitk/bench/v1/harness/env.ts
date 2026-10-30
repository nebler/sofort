// Environment capture (SPEC-V1 §7): one `env` row at the head of every raw
// file, plus process-tree CPU/RSS sampling for cell rows.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import * as os from 'node:os';

function run(argv: string[]): string {
  try {
    return execFileSync(argv[0]!, argv.slice(1), { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return ''; }
}

/** hvf (macOS arm64, Hypervisor.framework), kvm-metal or kvm-nested (Linux),
 *  overridable with SOFORT_BENCH_VIRT. Nested: counts and memory only. */
export function virtLabel(): string {
  if (process.env.SOFORT_BENCH_VIRT) return process.env.SOFORT_BENCH_VIRT;
  if (process.platform === 'darwin') return process.arch === 'arm64' ? 'hvf' : 'darwin-' + process.arch;
  if (process.platform !== 'linux') return process.platform;
  if (!existsSync('/dev/kvm')) return 'linux-no-kvm';
  const detected = run(['systemd-detect-virt']);
  if (detected) return detected === 'none' ? 'kvm-metal' : 'kvm-nested';
  const cpuinfo = existsSync('/proc/cpuinfo') ? readFileSync('/proc/cpuinfo', 'utf8') : '';
  if (/\bhypervisor\b/.test(cpuinfo)) return 'kvm-nested';
  const vendor = existsSync('/sys/devices/virtual/dmi/id/sys_vendor') ? readFileSync('/sys/devices/virtual/dmi/id/sys_vendor', 'utf8').trim() : '';
  return /QEMU|KVM|Parallels|VMware|Apple Virtualization/i.test(vendor) ? 'kvm-nested' : 'kvm-metal';
}

export function gitState(cwd: string): { sha: string; dirty: boolean } {
  const sha = run(['git', '-C', cwd, 'rev-parse', 'HEAD']) || 'unknown';
  const dirty = run(['git', '-C', cwd, 'status', '--porcelain', '--untracked-files=no']) !== '';
  return { sha, dirty };
}

export function captureEnv(repo: string): Record<string, unknown> {
  const cpus = os.cpus();
  return {
    host: os.hostname(),
    os: `${os.type()} ${os.release()}`,
    osVersion: process.platform === 'darwin' ? run(['sw_vers', '-productVersion']) : (existsSync('/etc/os-release') ? (readFileSync('/etc/os-release', 'utf8').match(/^PRETTY_NAME="?([^"\n]*)/m)?.[1] ?? '') : ''),
    kernel: run(['uname', '-v']),
    arch: process.arch,
    cpu: cpus[0]?.model ?? 'unknown',
    cpus: cpus.length,
    memoryBytes: os.totalmem(),
    hwModel: process.platform === 'darwin' ? run(['sysctl', '-n', 'hw.model']) : '',
    load: os.loadavg(),
    node: process.version,
    nodePath: process.execPath,
    git: gitState(repo),
    virt: virtLabel(),
    started: new Date().toISOString(),
  };
}

export interface ProcSample { pid: number; ppid: number; cpuMs: number; rssKiB: number }
/** One `ps` snapshot of every process (cumulative CPU time and RSS). macOS
 *  `ps` time has 10 ms resolution; exited processes' CPU is not seen. */
export function processTable(): Map<number, ProcSample> {
  const text = run(['ps', '-A', '-o', 'pid=,ppid=,rss=,time=']);
  const table = new Map<number, ProcSample>();
  for (const line of text.split('\n')) {
    const m = line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(\S+)$/);
    if (!m) continue;
    table.set(Number(m[1]), { pid: Number(m[1]), ppid: Number(m[2]), rssKiB: Number(m[3]), cpuMs: parseCpuTime(m[4]!) });
  }
  return table;
}
/** [[dd-]hh:]mm:ss[.cc] → ms */
export function parseCpuTime(t: string): number {
  let days = 0;
  const d = t.indexOf('-');
  if (d >= 0) { days = Number(t.slice(0, d)); t = t.slice(d + 1); }
  const parts = t.split(':').map(Number);
  let s = 0;
  for (const p of parts) s = s * 60 + p;
  return (days * 86400 + s) * 1000;
}
/** The pids and all their descendants. */
export function subtree(table: Map<number, ProcSample>, roots: number[]): ProcSample[] {
  const children = new Map<number, number[]>();
  for (const p of table.values()) (children.get(p.ppid) ?? children.set(p.ppid, []).get(p.ppid)!).push(p.pid);
  const out: ProcSample[] = [];
  const seen = new Set<number>();
  const stack = [...roots];
  while (stack.length) {
    const pid = stack.pop()!;
    if (seen.has(pid)) continue;
    seen.add(pid);
    const p = table.get(pid);
    if (p) out.push(p);
    stack.push(...(children.get(pid) ?? []));
  }
  return out;
}
export function treeTotals(roots: number[]): { cpuMs: number; rssKiB: number; processes: number } {
  const procs = subtree(processTable(), roots);
  return { cpuMs: procs.reduce((s, p) => s + p.cpuMs, 0), rssKiB: procs.reduce((s, p) => s + p.rssKiB, 0), processes: procs.length };
}
