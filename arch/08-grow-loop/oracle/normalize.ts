import { check } from './lib.ts';

export function splitArgs(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (escaped) {
        escaped = false;
      } else if (c === '\\') {
        escaped = true;
      } else if (c === '"') {
        quoted = false;
      }
    } else if (c === '"') {
      quoted = true;
    } else if ('([{'.includes(c)) {
      depth += 1;
    } else if (')]}'.includes(c)) {
      depth -= 1;
    } else if (c === ',' && depth === 0) {
      out.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  if (text) {
    out.push(text.slice(start).trim());
  }
  return out;
}

const NR: Record<string, number> = { ioctl: 29, getcwd: 17, openat: 56, close: 57, lseek: 62, read: 63, write: 64, readv: 65, writev: 66, readlinkat: 78, exit_group: 94, set_tid_address: 96, clock_gettime: 113, gettimeofday: 169, brk: 214, munmap: 215, mremap: 216, execve: 221, mmap: 222, mprotect: 226, madvise: 233, getrandom: 278, fstat: 80, newfstatat: 79, rt_sigaction: 134, rt_sigprocmask: 135, prlimit64: 261, futex: 98, getpid: 172, sysinfo: 179, faccessat: 48 };
const POINTERS: Record<string, number[]> = { brk: [0], mmap: [0], munmap: [0], mremap: [0], set_tid_address: [0], ioctl: [2], readlinkat: [2], mprotect: [0], madvise: [0] };
interface Region {
  base: number;
  length: number;
  label: string;
}
interface NormalEvent {
  v: number;
  seq: number;
  tid: string;
  nr: number;
  name: string;
  args: string[];
  ret: number | string | null;
  errno: string | null;
}

export function normalize(raw: string, requireExit = false): NormalEvent[] {
  const events: NormalEvent[] = [];
  const addresses = new Map<string, string>();
  const regions: Region[] = [];
  let heap: number | undefined;
  function addr(text: string): string {
    if (['NULL', '0', '0x0'].includes(text)) {
      return 'NULL';
    }
    const value = Number(text);
    for (let i = regions.length - 1; i >= 0; i -= 1) {
      const region = regions[i];
      if (region.base <= value && value < region.base + region.length) {
        return region.label + '+' + String(value - region.base);
      }
    }
    const known = addresses.get(text);
    if (known !== undefined) {
      return known;
    }
    const label = 'P' + addresses.size;
    addresses.set(text, label);
    return label;
  }
  for (let line of raw.split(/\r?\n/)) {
    line = line.replace(/^\d+\s+/, '');
    if (!line || line.startsWith('+++ exited with ')) {
      continue;
    }
    const match = /^(\w+)\((.*)\)\s+=\s+(.*)$/.exec(line);
    check(match, 'unparsed line: ' + line);
    const name = match[1];
    const argText = match[2];
    const r = match[3];
    check(!argText.replace(/"(?:\\.|[^"\\])*"/g, '').includes('...'), 'truncated trace: ' + line);
    const args = splitArgs(argText);
    const original = [...args];
    if (name === 'brk' && heap === undefined && !r.startsWith('-1')) {
      heap = Number(r.split(' ')[0]);
    }
    if (name === 'brk' && !['NULL', '0'].includes(args[0])) {
      args[0] = 'HEAP+' + String(Number(args[0]) - heap!);
    }
    check(!['clone', 'clone3', 'fork', 'vfork'].includes(name), 'single-thread contract violated');
    if (name === 'execve') {
      args[2] = args[2].replace(/0x[0-9a-f]+/g, 'ENV');
    }
    for (const i of POINTERS[name] || []) {
      if (i < args.length && /^(?:0x[0-9a-f]+|NULL)$/.test(args[i])) {
        args[i] = addr(args[i]);
      }
    }
    let errno: string | null = null;
    let result: number | string | null;
    if (r.startsWith('-1 ')) {
      errno = r.split(/\s+/)[1];
      result = -1;
    } else if (r.startsWith('?')) {
      result = null;
    } else {
      const scalar = r.split(' ')[0];
      if (name === 'brk') {
        result = 'HEAP+' + String(Number(scalar) - heap!);
      } else if (name === 'mmap' || name === 'mremap') {
        result = 'M' + regions.length + '+0';
        regions.push({ base: Number(scalar), length: Number(original[name === 'mmap' ? 1 : 2]), label: result.slice(0, -2) });
      } else if (name === 'set_tid_address') {
        result = 'T0';
      } else {
        result = Number(scalar);
        check(Number.isFinite(result), 'invalid scalar');
      }
    }
    check(NR[name] !== undefined, 'unknown syscall: ' + name);
    events.push({ v: 1, seq: events.length, tid: 'T0', nr: NR[name], name, args, ret: result, errno });
  }
  check(!requireExit || (events.length > 0 && events[events.length - 1].name === 'exit_group'), 'missing terminal exit_group event');
  return events;
}
