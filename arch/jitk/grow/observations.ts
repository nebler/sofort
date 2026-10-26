import { check, detail, equal, hexBytes, parseJSON, stringify, type Register } from './lib.ts';

export interface TraceRecord {
  [key: string]: unknown;
  v: number;
  kind: string;
  seq?: number;
  nr?: number;
  pc?: number;
  args?: Register[];
  input?: string | null;
  timeout?: string | null;
  output?: string | null;
  ret?: number | null;
  code?: number;
  hex?: string;
}

export interface SyscallRecord extends TraceRecord {
  seq: number;
  nr: number;
  args: Register[];
}

export function entry(record: TraceRecord): SyscallRecord {
  check(typeof record.seq === 'number' && typeof record.nr === 'number' && Array.isArray(record.args) && record.args.length === 6, 'entry seq/nr/args');
  return record as SyscallRecord;
}

export interface Outcome {
  stdout_hex: string;
  stderr_hex: string;
  exit: number | null;
}

export interface Observations extends Outcome {
  trace_complete: boolean;
  missing: SyscallRecord[];
  registered_enosys: SyscallRecord[];
  argument_errors: SyscallRecord[];
  fatal_protocol: unknown[];
  events: SyscallRecord[];
}

export function observe(raw: Buffer): Observations {
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  const events: SyscallRecord[] = [];
  const errors: SyscallRecord[] = [];
  const enosys: SyscallRecord[] = [];
  const missing: SyscallRecord[] = [];
  const fatal: unknown[] = [];
  let pending: SyscallRecord | undefined;
  let done: number | null = null;
  // Latin-1 preserves every byte; UTF-8 decoding is restricted to JSON records.
  for (const text of raw.toString('latin1').split('\n')) {
    if (!text || /^(?:hello jitk fdt=[0-9a-f]{16}|exit=[0-9a-f]{16})$/.test(text)) {
      continue;
    }
    const line = Buffer.from(text, 'latin1');
    const at = line.indexOf(0x1e);
    if (at < 0) {
      stdout.push(Buffer.concat([line, Buffer.from('\n')]));
      continue;
    }
    stdout.push(line.subarray(0, at));
    const data = line.subarray(at + 1);
    try {
      const r = parseJSON(data.toString()) as TraceRecord;
      check(r !== null && r.v === 2, 'invalid protocol version');
      if (r.kind === 'sys.enter' || r.kind === 'missing') {
        check(pending === undefined && done === null, 'entry after entry/done');
        check(r.seq === events.length + 1 && Array.isArray(r.args) && r.args.length === 6, 'entry seq/args');
        pending = entry(r);
        if (r.kind === 'missing') {
          missing.push(pending);
        }
      } else if (r.kind === 'sys.exit') {
        check(pending && r.seq === pending.seq, 'exit without matching entry');
        check(typeof r.ret === 'number', 'missing return value');
        const event = copyRecord(pending);
        event.ret = r.ret;
        event.output = r.output ?? null;
        events.push(event);
        if (r.ret < 0) {
          errors.push(event);
        }
        if (r.ret === -38 && pending.kind === 'sys.enter') {
          enosys.push(event);
        }
        pending = undefined;
      } else if (r.kind === 'log') {
        check(typeof r.hex === 'string', 'missing log bytes');
        stderr.push(hexBytes(r.hex));
      } else if (r.kind === 'done') {
        check(pending && (pending.nr === 93 || pending.nr === 94), 'done without exit entry');
        check(r.seq === pending.seq && r.code === pending.args[0], 'done seq/code');
        check(done === null && typeof r.code === 'number', 'duplicate/missing done code');
        done = r.code;
        const event = copyRecord(pending);
        event.ret = null;
        events.push(event);
        pending = undefined;
      } else {
        fatal.push(r);
      }
    } catch (error) {
      fatal.push({ class: 'output-protocol', raw_hex: data.toString('hex'), detail: detail(error) });
    }
  }
  return { stdout_hex: Buffer.concat(stdout).toString('hex'), stderr_hex: Buffer.concat(stderr).toString('hex'), exit: done, trace_complete: done !== null && pending === undefined && fatal.length === 0, missing, registered_enosys: enosys, argument_errors: errors, fatal_protocol: fatal, events };
}

export function outcome(value: Outcome): Outcome {
  return { stdout_hex: value.stdout_hex, stderr_hex: value.stderr_hex, exit: value.exit };
}

export function requireResult(value: Observations, reference: Outcome, allowedMissing: number[] = []): void {
  check(value.trace_complete, 'fatal/incomplete output protocol');
  check(value.missing.every((r) => allowedMissing.includes(r.nr)), 'unexpected missing syscall');
  check(equal(outcome(value), outcome(reference)), "{'linux': " + outcomeDescription(reference) + ", 'jitk': " + outcomeDescription(value) + '}');
}

export function records(raw: Buffer): { records: TraceRecord[]; app: Buffer } {
  const result: TraceRecord[] = [];
  const app: Buffer[] = [];
  for (const text of raw.toString('latin1').match(/[^\n]*\n|[^\n]+$/g) || []) {
    const line = Buffer.from(text, 'latin1');
    const at = line.indexOf(0x1e);
    if (at >= 0) {
      app.push(line.subarray(0, at));
      result.push(parseJSON(line.subarray(at + 1).toString()) as TraceRecord);
    } else if (!text.startsWith('hello jitk fdt=') && !text.startsWith('exit=')) {
      app.push(line);
    }
  }
  return { records: result, app: Buffer.concat(app) };
}

function outcomeDescription(value: Outcome): string {
  return "{'stdout_hex': '" + value.stdout_hex + "', 'stderr_hex': '" + value.stderr_hex + "', 'exit': " + (value.exit === null ? 'None' : String(value.exit)) + '}';
}

function copyRecord(record: SyscallRecord): SyscallRecord {
  const copy: Record<string, unknown> = {};
  for (const key of Object.keys(record)) {
    copy[key] = record[key];
  }
  return copy as unknown as SyscallRecord;
}
