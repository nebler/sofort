import { check, now, Interrupted } from './lib.ts';

declare function nativeInit(): void;
nativeInit();

declare function nativeSpawn(argv: string, env: string, result: Buffer): number;
declare function nativePoll(stdout: number, stderr: number, seconds: number): number;
declare function nativeRead(fd: number, bytes: Buffer): number;
declare function nativeWrite(fd: number, bytes: Buffer): number;
declare function nativeClose(fd: number): number;
declare function nativeWait(pid: number, flags: number, result: Buffer): number;
declare function nativeUsage(pid: number, version: number, result: Buffer): number;
declare function nativeChildrenCPU(): number;

export interface Child {
  pid: number;
  stdin: number;
  stdout: number;
  stderr: number;
}
export function start(argv: string[], env: Record<string, string> = { PATH: '/usr/bin:/bin' }): Child {
  check(argv.every(s => !s.includes('\0')), 'NUL in argv');
  const environment = Object.keys(env).map(k => k + '=' + env[k]);
  check(environment.every(s => !s.includes('\0')), 'NUL in environment');
  const result = Buffer.alloc(16);
  check(nativeSpawn(argv.join('\0') + '\0', environment.join('\0') + '\0', result) > 0, 'spawn failed');
  return { pid: result.readInt32LE(0), stdin: result.readInt32LE(4), stdout: result.readInt32LE(8), stderr: result.readInt32LE(12) };
}
export function poll(stdout: number, stderr: number, seconds: number): number {
  const result = nativePoll(stdout, stderr, Math.max(0, seconds));
  if (result <= -128) {
    throw new Interrupted(-result);
  }
  check(result >= 0, 'select failed');
  return result;
}
export function read(fd: number): Buffer {
  const bytes = Buffer.alloc(65536);
  const length = nativeRead(fd, bytes);
  check(length >= 0, 'pipe read failed');
  return bytes.subarray(0, length);
}
export function write(fd: number, bytes: Buffer): void {
  check(nativeWrite(fd, bytes) === bytes.length, 'pipe write failed');
}
export function close(fd: number): void {
  if (fd >= 0) {
    nativeClose(fd);
  }
}
export function sleep(seconds: number): void {
  poll(-1, -1, seconds);
}
export interface Reap {
  status: number;
  user_ms: number;
  system_ms: number;
  cpu_ms: number;
}
export function wait(pid: number, nonblocking = false): Reap | null {
  const result = Buffer.alloc(32);
  const waited = nativeWait(pid, nonblocking ? 1 : 0, result);
  check(waited >= 0, 'wait4 failed for ' + pid);
  return waited === 0 ? null : { status: result.readDoubleLE(0), user_ms: result.readDoubleLE(8), system_ms: result.readDoubleLE(16), cpu_ms: result.readDoubleLE(24) };
}
export function childrenCPU(): number {
  return nativeChildrenCPU();
}
export function usage(pid: number): Record<string, number> | null {
  const result = Buffer.alloc(512);
  if (nativeUsage(pid, 0, result) !== 0) {
    return null;
  }
  const keys = ['user_ns', 'system_ns', 'idle', 'interrupt', 'pageins', 'wired', 'rss', 'footprint'];
  const record: Record<string, number> = {};
  for (let i = 0; i < keys.length; i += 1) {
    if (['user_ns', 'system_ns', 'wired', 'rss', 'footprint'].includes(keys[i])) {
      record[keys[i]] = Number(result.readBigUInt64LE(16 + i * 8));
    }
  }
  return record;
}

declare function nativeTemplates(result: Buffer): number;
declare function nativeLedgers(pid: number, result: Buffer): number;
declare function nativeTimebase(): number;
export function timebase(): number {
  return nativeTimebase();
}
export function templates(): Record<string, string>[] {
  const bytes = Buffer.alloc(256 * 96);
  const count = nativeTemplates(bytes);
  check(count >= 0, 'read-only LEDGER_TEMPLATE_INFO errno ' + (-count));
  const result: Record<string, string>[] = [];
  for (let i = 0; i < count; i += 1) {
    const entry: Record<string, string> = {};
    for (const [j, key] of ['name', 'group', 'units'].entries()) {
      entry[key] = bytes.subarray(i * 96 + j * 32, i * 96 + (j + 1) * 32).toString().split('\0')[0];
    }
    result.push(entry);
  }
  return result;
}
export function ledgerProc(pid: number, names: Record<string, string>[]): Record<string, any> {
  const result = Buffer.alloc(512);
  const record: Record<string, any> = { pid };
  if (nativeUsage(pid, 4, result) !== 0) {
    record.error = 'proc_pid_rusage failed';
    return record;
  }
  const keys = ['user_ticks', 'system_ticks', 'idle_wakeups', 'interrupt_wakeups', 'pageins', 'wired', 'rss', 'footprint', 'start', 'exit', 'child_user', 'child_system', 'child_idle', 'child_interrupt', 'child_pageins', 'child_elapsed', 'diskread', 'diskwritten', 'qos_default', 'qos_maintenance', 'qos_background', 'qos_utility', 'qos_legacy', 'qos_initiated', 'qos_interactive', 'billed', 'serviced', 'logical_writes', 'footprint_peak', 'instructions', 'cycles'];
  for (const key of ['user_ticks', 'system_ticks', 'wired', 'rss', 'footprint', 'footprint_peak', 'pageins', 'idle_wakeups', 'interrupt_wakeups', 'instructions', 'cycles']) {
    record[key] = Number(result.readBigUInt64LE(16 + keys.indexOf(key) * 8));
  }
  record.user_ms = record.user_ticks * timebase() / 1e6;
  record.system_ms = record.system_ticks * timebase() / 1e6;
  const entries = Buffer.alloc(256 * 8);
  const count = nativeLedgers(pid, entries);
  if (count < 0) {
    record.ledger_error = 'ledger errno ' + (-count);
  } else {
    const ledger: Record<string, number> = {};
    for (let i = 0; i < count; i += 1) {
      ledger[names[i].name] = Number(entries.readBigInt64LE(i * 8));
    }
    record.ledger = ledger;
  }
  return record;
}

declare function nativePollMany(fds: Buffer, seconds: number): number;
export function pollMany(fds: number[], seconds: number): void {
  const bytes = Buffer.alloc(fds.length * 4);
  for (let i = 0; i < fds.length; i += 1) {
    bytes.writeInt32LE(fds[i], i * 4);
  }
  const result = nativePollMany(bytes, seconds);
  if (result <= -128) {
    throw new Interrupted(-result);
  }
  check(result === 0, 'select failed');
}
