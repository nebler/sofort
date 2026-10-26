import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { loadavg } from 'node:os';
import { check, dump, output, sleep, run, same as isDeepStrictEqual } from '../lib.ts';

export const ROOT = resolve(process.env.JITK_TEST_OUTPUT || join(import.meta.dirname, '..', process.env.JITK_RECORD === '1' ? 'test-results' : '.work/test-results'));
mkdirSync(ROOT, { recursive: true });
export const HOST = process.env.JITK_TEST_HOST || join(import.meta.dirname, 'host.sh');
export const KERNEL = process.env.JITK_TEST_KERNEL || resolve(import.meta.dirname, '../dist/kernel.bin');
export function uptime(): string {
  return output(['uptime']).trim();
}
export function quant(values: number[]): { n: number; p50: number; p90: number; p99: number } {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  check(n > 0, 'empty quantile input');
  return { n, p50: (sorted[Math.floor((n - 1) / 2)] + sorted[Math.floor(n / 2)]) / 2, p90: sorted[Math.min(n - 1, Math.floor(n * 0.9))], p99: sorted[Math.min(n - 1, Math.floor(n * 0.99))] };
}
export async function loadGate(budget = 0.25, poll = 0.1): Promise<unknown> {
  const gate = resolve(import.meta.dirname, '../../bench/build/gate');
  const result = await run([gate, '6', String(budget), String(poll)]);
  return JSON.parse(result.stdout.toString()) as unknown;
}

export interface Frame {
  t: string;
  v?: number;
  id?: number;
  ns?: string;
  fn?: string;
  args?: unknown[];
  ok?: unknown;
  err?: unknown;
}
export class VM {
  p: ChildProcess;
  records: string[] = [];
  stderr = '';
  private buffer = '';
  private frames: string[] = [];
  private ended = false;
  private failure = '';
  private changed: (() => void) | null = null;
  private started = performance.now();
  private closed: Promise<void>;
  constructor(tick = 0, kernel = KERNEL, waitGo = false, host = HOST, hostArgs: string[] = []) {
    this.p = spawn(host, [...hostArgs, kernel, ...(waitGo ? ['--wait-go'] : [])], { env: { ...process.env, JITK_TICK_US: String(tick) }, stdio: ['pipe', 'pipe', 'pipe'] });
    this.p.stdout!.on('data', (data: Buffer) => {
      this.buffer += data.toString();
      let end = this.buffer.indexOf('\n');
      while (end >= 0) {
        const line = this.buffer.slice(0, end);
        this.buffer = this.buffer.slice(end + 1);
        if (line.startsWith('\x1e')) {
          this.records.push(line);
        } else {
          this.frames.push(line);
        }
        end = this.buffer.indexOf('\n');
      }
      this.wake();
    });
    this.p.stderr!.on('data', (data: Buffer) => { this.stderr += data.toString(); this.wake(); });
    this.p.stdin!.on('error', (error: Error) => { this.failure = error.message; this.wake(); });
    this.p.on('error', (error: Error) => { this.failure = error.message; this.wake(); });
    this.closed = new Promise<void>(resolveClose => {
      this.p.on('close', () => { this.ended = true; this.wake(); resolveClose(); });
    });
  }
  private wake(): void {
    if (this.changed) {
      this.changed();
    }
  }
  send(frame: unknown): void {
    const wire = JSON.stringify(frame).replace(/[\u007f-\uffff]/g, (c: string) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
    this.p.stdin!.write(wire + '\n');
  }
  async recv(timeout = 3): Promise<Frame> {
    const end = performance.now() + timeout * 1000;
    while (this.frames.length === 0) {
      check(!this.ended && !this.failure, JSON.stringify({ exit: this.p.exitCode, records: this.records, stderr: this.stderr, partial: this.buffer, error: this.failure }));
      check(performance.now() < end, 'VM receive timeout: ' + this.stderr);
      await new Promise<void>(resolveWait => {
        const timer = setTimeout(() => { this.changed = null; resolveWait(); }, Math.max(1, end - performance.now()));
        this.changed = () => { clearTimeout(timer); this.changed = null; resolveWait(); };
      });
    }
    return JSON.parse(this.frames.shift()!) as Frame;
  }
  async ready(): Promise<number> {
    const frame = await this.recv(10);
    check(isDeepStrictEqual(frame, { t: 'ready', v: 1 }), JSON.stringify(frame));
    return performance.now() - this.started;
  }
  run(code: string, ns: Record<string, string[]> = { test: ['echo'] }): void {
    this.send({ t: 'run', code, ns });
  }
  async close(): Promise<void> {
    if (!this.ended) {
      this.p.kill('SIGKILL');
    }
    await this.closed;
    this.p.stdin!.destroy();
  }
}
export function cpu(pid: number): number {
  const value = output(['ps', '-p', String(pid), '-o', 'time=']).trim().split(':');
  return Number(value[0]) * 60 + Number(value[1]);
}
export async function park(tick: number, count = 1000, idle = 10, kernel = KERNEL): Promise<Record<string, unknown>> {
  const vm = new VM(tick, kernel);
  const result: Record<string, unknown> = { gate: await loadGate(), tick_us: tick, load: uptime() };
  const rtt: number[] = [];
  let i = -1;
  try {
    result.ready_ms = await vm.ready();
    const c0 = cpu(vm.p.pid!);
    let start = performance.now();
    await sleep(idle * 1000);
    const elapsed = (performance.now() - start) / 1000;
    const used = cpu(vm.p.pid!) - c0;
    result.idle_seconds = elapsed;
    result.idle_cpu_seconds = used;
    result.idle_core_percent = used / elapsed * 100;
    vm.run(`for(let i=0;i<${count};i++) await test.echo(i); return "ok";`);
    start = performance.now();
    for (i = 0; i < count; i += 1) {
      const frame = await vm.recv();
      check(frame.t === 'call' && frame.id === i + 1 && isDeepStrictEqual(frame.args, [i]), JSON.stringify(frame));
      rtt.push((performance.now() - start) * 1000);
      if (i % 100 === 0) {
        await sleep(3);
      }
      start = performance.now();
      vm.send({ t: 'ret', id: frame.id, ok: i });
    }
    check(isDeepStrictEqual(await vm.recv(), { t: 'done', ok: 'ok' }));
    result.exchanges = count;
    result.rtt_us = quant(rtt);
    result.records = vm.records;
    result.status = 'PASS';
  } catch (error: unknown) {
    result.status = 'FAIL';
    result.error = error instanceof Error ? error.message : String(error);
    result.exchanges = i;
    result.rtt_us = rtt.length ? quant(rtt) : null;
  } finally {
    await vm.close();
  }
  return result;
}
export async function integration(n = 30): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = { load: uptime() };
  const boot: number[] = [];
  const warm: number[] = [];
  const batch: number[] = [];
  const calls: number[] = [];
  const sampleLoad: unknown[] = [];
  for (let i = 0; i < n; i += 1) {
    sampleLoad.push({ gate: await loadGate(), uptime: uptime() });
    let vm = new VM();
    try {
      boot.push(await vm.ready());
      await sleep(5);
      const start = performance.now();
      vm.run('return await test.echo(1);');
      const call = await vm.recv();
      check(call.t === 'call');
      vm.send({ t: 'ret', id: call.id, ok: 2 });
      check(isDeepStrictEqual(await vm.recv(), { t: 'done', ok: 2 }));
      warm.push((performance.now() - start) * 1000);
    } finally {
      await vm.close();
    }
    vm = new VM();
    try {
      await vm.ready();
      await sleep(5);
      const start = performance.now();
      vm.run('return await Promise.all(Array.from({length:64},(_,i)=>test.echo(i)));');
      const pending: Frame[] = [];
      for (let j = 0; j < 64; j += 1) {
        const frame = await vm.recv();
        check(frame.t === 'call' && frame.id === j + 1 && isDeepStrictEqual(frame.args, [j]));
        pending.push(frame);
      }
      const emitted = performance.now();
      for (const frame of pending.reverse()) {
        vm.send({ t: 'ret', id: frame.id, ok: frame.args![0] });
      }
      check(isDeepStrictEqual(await vm.recv(), { t: 'done', ok: Array.from({ length: 64 }, (_, k) => k) }));
      batch.push((performance.now() - start) * 1000);
      calls.push((emitted - start) * 1000);
    } finally {
      await vm.close();
    }
  }
  result.sample_load = sampleLoad;
  result.ready_ms = quant(boot);
  result.parked_one_call_us = quant(warm);
  result.promise64_us = quant(batch);
  result.emit64_us = quant(calls);
  result.throughput_calls_s = quant(batch.map(t => 64000000 / t));
  result.status = 'PASS';
  return result;
}

const executable = process.argv[1].split('/').pop();
if (executable === 'measure' || executable === 'measure.ts') {
  const parking = (process.argv[2] || 'park') === 'park';
  const result = parking ? await park(Number(process.argv[3])) : await integration();
  dump(join(ROOT, parking ? 'parking-' + process.argv[3] + '.json' : 'integration.json'), result);
  console.log(JSON.stringify(result, null, 2));
}
