import { check, now } from './lib.ts';

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
  check(result >= 0, 'poll failed');
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
}
export function wait(pid: number, nonblocking = false): Reap | null {
  const result = Buffer.alloc(24);
  const waited = nativeWait(pid, nonblocking ? 1 : 0, result);
  check(waited >= 0, 'wait4 failed for ' + pid);
  return waited === 0 ? null : { status: result.readDoubleLE(0), user_ms: result.readDoubleLE(8), system_ms: result.readDoubleLE(16) };
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
