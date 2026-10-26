import { check, equal, hexBytes, numeric, parseJSON, signed, stringify } from './lib.ts';
import { type Outcome, type TraceRecord, type SyscallRecord, entry } from './observations.ts';
import { splitArgs } from './normalize.ts';

const ERRNO: Record<number, string> = { 9: 'EBADF', 14: 'EFAULT', 22: 'EINVAL', 25: 'ENOTTY', 38: 'ENOSYS' };
const NAMES: Record<number, string> = { 29: 'ioctl', 63: 'read', 64: 'write', 73: 'ppoll', 134: 'rt_sigaction', 135: 'rt_sigprocmask', 94: 'exit_group' };
export interface Event {
  nr: number;
  name: string;
  ret: number | null;
  args?: unknown[];
  output?: number[][] | null;
}
export interface Differential extends Outcome {
  events: Event[];
}

function pollfds(data: string | null | undefined, n: number): number[][] | null {
  if (n === 0) {
    return [];
  }
  if (data === null || data === undefined) {
    return null;
  }
  const bytes = hexBytes(data);
  check(bytes.length === n * 8, 'pollfd byte count');
  const result: number[][] = [];
  for (let i = 0; i < n; i += 1) {
    result.push([bytes.readInt32LE(i * 8), bytes.readInt16LE(i * 8 + 4), bytes.readInt16LE(i * 8 + 6)]);
  }
  return result;
}

export function guest(raw: Buffer, allowMissing = false): Differential {
  const records: TraceRecord[] = [];
  const app: Buffer[] = [];
  for (const text of raw.toString('latin1').split('\n')) {
    const line = Buffer.from(text, 'latin1');
    const at = line.indexOf(0x1e);
    if (at >= 0) {
      app.push(line.subarray(0, at));
      const record = parseJSON(line.subarray(at + 1).toString()) as TraceRecord;
      check(record.v === 2, 'invalid protocol version');
      records.push(record);
    } else if (text && !/^(?:hello jitk fdt=[0-9a-f]{16}|exit=[0-9a-f]{16})$/.test(text)) {
      app.push(Buffer.concat([line, Buffer.from('\n')]));
    }
  }
  const events: Event[] = [];
  let pending: SyscallRecord | undefined;
  let done: number | null = null;
  for (const r of records) {
    if (r.kind === 'sys.enter' || r.kind === 'missing') {
      check(pending === undefined && done === null, 'entry after entry/done');
      check(r.seq === events.length + 1, 'entry seq');
      check(r.kind !== 'missing' || allowMissing, 'unregistered syscall');
      pending = entry(r);
    } else if (r.kind === 'sys.exit') {
      check(pending && r.seq === pending.seq, 'exit seq');
      const n = pending.nr;
      const a = pending.args;
      const ret = r.ret!;
      check(NAMES[n] !== undefined, 'unsupported ABI ' + n);
      const e: Event = { nr: n, name: NAMES[n], ret };
      if (n === 134 || n === 135) {
        e.args = [a[0], a[1] === 0 ? 'NULL' : 'PTR', a[2] === 0 ? 'NULL' : 'PTR', a[3]];
      } else if (n === 29) {
        e.args = [signed(a[0]), a[1], a[2] ? 'PTR' : 'NULL'];
        check(r.output === '4141414141414141' || r.output === null, 'ioctl output');
      } else if (n === 63 || n === 64) {
        const data = n === 64 ? pending.input : r.output;
        check(data !== null && data !== undefined || ret <= 0, 'missing/truncated buffer');
        e.args = [a[0], data ?? null, a[2]];
      } else if (n === 73) {
        const inp = pollfds(pending.input, numeric(a[1]));
        const out = pollfds(r.output, numeric(a[1]));
        let timeout: number[] | null = null;
        if (a[2] !== 0) {
          check(typeof pending.timeout === 'string', 'missing timeout');
          const bytes = hexBytes(pending.timeout);
          check(bytes.length === 16, 'timeout byte count');
          timeout = [Number(bytes.readBigInt64LE(0)), Number(bytes.readBigInt64LE(8))];
        }
        e.args = [inp, a[1], timeout, a[3] === 0 ? 'NULL' : 'MASK', a[4]];
        e.output = out;
      }
      events.push(e);
      pending = undefined;
    } else if (r.kind === 'done') {
      check(pending && pending.nr === 94 && r.seq === pending.seq, 'done seq');
      check(r.code === pending.args[0], 'done code');
      events.push({ nr: 94, name: 'exit_group', args: [r.code], ret: null });
      done = r.code!;
      pending = undefined;
    } else {
      check(false, 'unknown/fatal record ' + r.kind);
    }
  }
  check(pending === undefined && done !== null, 'incomplete guest trace');
  return { events, stdout_hex: Buffer.concat(app).toString('hex'), stderr_hex: '', exit: done };
}

function traceBytes(text: string): string {
  check(/^"(?:\\x[0-9a-f]{2})*"$/.test(text), text);
  return text.replace(/"/g, '').replace(/\\x/g, '');
}

function fds(text: string): number[][] | null {
  if (text === 'NULL' || text === '0x0') {
    return null;
  }
  if (text === '[]') {
    return [];
  }
  check(text.startsWith('[') && text.endsWith(']'), text);
  const result: number[][] = [];
  for (const part of text.match(/\{[^}]+\}/g) || []) {
    const m = /^\{fd=(-?\d+)(?:, (?:events|revents)=(0x[0-9a-f]+|0))?\}$/.exec(part);
    check(m, part);
    result.push([Number(m[1]), Number(m[2] || '0')]);
  }
  check(result.length > 0, text);
  return result;
}

export function linux(raw: string, stdout: Buffer, stderr: Buffer, code: number): Differential {
  const events: Event[] = [];
  for (let line of raw.trimEnd().split('\n')) {
    line = line.replace(/^\d+\s+/, '');
    const match = /^(\w+)\((.*)\)\s+=\s+(.*)$/.exec(line);
    check(match, line);
    const name = match[1];
    const a = splitArgs(match[2]);
    const rr = match[3];
    if (name === 'execve') {
      check(events.length === 0 && rr === '0', 'unexpected execve');
      continue;
    }
    const key = Object.keys(NAMES).find((k) => NAMES[Number(k)] === name);
    check(key !== undefined, name);
    const n = Number(key);
    let ret: number | null;
    if (rr === '?') {
      ret = null;
    } else if (rr.startsWith('-1 ')) {
      const errno = Object.keys(ERRNO).find((k) => ERRNO[Number(k)] === rr.split(/\s+/)[1]);
      check(errno !== undefined, 'unknown errno');
      ret = -Number(errno);
    } else {
      ret = Number(rr.split(' ')[0]);
      check(Number.isFinite(ret), 'invalid return');
    }
    const e: Event = { nr: n, name, ret };
    if (n === 134 || n === 135) {
      e.args = [Number(a[0]), a[1] === 'NULL' ? 'NULL' : 'PTR', a[2] === 'NULL' ? 'NULL' : 'PTR', Number(a[3])];
    } else if (n === 29) {
      e.args = [Number(a[0]), Number(a[1]), a[2] === 'NULL' ? 'NULL' : 'PTR'];
    } else if (n === 63 || n === 64) {
      e.args = [Number(a[0]), traceBytes(a[1]), Number(a[2])];
    } else if (n === 94) {
      e.args = [Number(a[0])];
    } else if (n === 73) {
      const nfds = Number(a[1]);
      const infds = fds(a[0]);
      const inp = nfds === 0 ? [] : infds === null ? null : infds.map((fd) => [fd[0], fd[1], 0]);
      let timeout: number[] | null = null;
      if (a[2] !== 'NULL') {
        const tm = /^\{tv_sec=(-?\d+), tv_nsec=(-?\d+)\}$/.exec(a[2]);
        check(tm, a[2]);
        timeout = [signed(tm[1]), signed(tm[2])];
      }
      e.args = [inp, nfds, timeout, a[3], Number(a[4])];
      const out = inp === null ? null : inp.map((fd) => [...fd]);
      if (ret !== null && ret > 0) {
        const rm = /\(\[(.*?)\]/.exec(rr);
        check(rm && out, rr);
        const ready = fds('[' + rm[1] + ']');
        check(ready, rr);
        for (const fd of ready) {
          const matches = out.filter((entry) => entry[0] === fd[0]);
          check(matches.length === 1, 'duplicate ready fd');
          matches[0][2] = fd[1];
        }
      }
      e.output = out;
    }
    events.push(e);
  }
  check(events.length > 0 && equal(events[events.length - 1], { nr: 94, name: 'exit_group', args: [code], ret: null }), 'missing terminal exit');
  return { events, stdout_hex: stdout.toString('hex'), stderr_hex: stderr.toString('hex'), exit: code };
}

export function compare(a: Differential, b: Differential): void {
  check(equal(a, b), stringify({ linux: a, guest: b }));
}
