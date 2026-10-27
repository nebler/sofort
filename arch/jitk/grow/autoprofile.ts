import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { check, dump, sha } from './lib.ts';
import { splitArgs } from './normalize.ts';

export interface Shape { kind: string; text: string; value: string }
export interface TraceCall { args: Shape[]; raw: string; trace: string }
export interface AutoCase { id: string; category: string; args: string[]; declarations: string; observe: string; closed: boolean }
export interface Generated { name: string; nr: number; traces: Record<string, string>; calls: TraceCall[]; visible: AutoCase[]; heldout: AutoCase[]; policy: string }
const SYMBOLS: Record<string, string> = { AT_FDCWD: '-100', F_OK: '0', R_OK: '4', W_OK: '2', X_OK: '1', GRND_NONBLOCK: '1', GRND_RANDOM: '2', GRND_INSECURE: '4', MADV_NORMAL: '0', MADV_RANDOM: '1', MADV_SEQUENTIAL: '2', MADV_WILLNEED: '3', MADV_DONTNEED: '4', MADV_FREE: '8', PROT_NONE: '0', PROT_READ: '1', PROT_WRITE: '2', PROT_EXEC: '4', MAP_SHARED: '1', MAP_PRIVATE: '2', MAP_FIXED: '16', MAP_ANONYMOUS: '32', MAP_NORESERVE: '16384', MAP_POPULATE: '32768', MAP_STACK: '131072', RUSAGE_SELF: '0', RUSAGE_CHILDREN: '-1', PRIO_PROCESS: '0', AT_REMOVEDIR: '512', O_RDONLY: '0', O_CLOEXEC: '524288', O_DIRECTORY: '16384' };

// ABI layouts are transport metadata. No errno, successful result, stat field
// values, or target-specific behavioral assertions are supplied here.
const PRELUDE = `typedef unsigned long U;
static long sys(long n,long a,long b,long c,long d,long e,long f) {
 register long x8 __asm__("x8")=n,x0 __asm__("x0")=a,x1 __asm__("x1")=b,x2 __asm__("x2")=c,x3 __asm__("x3")=d,x4 __asm__("x4")=e,x5 __asm__("x5")=f;
 __asm__ volatile("svc #0":"+r"(x0):"r"(x8),"r"(x1),"r"(x2),"r"(x3),"r"(x4),"r"(x5):"memory");return x0;
}
// Pointer arguments get separate 64 KiB mappings, each followed by an unmapped
// 64 KiB hole: oversized kernel writes fault instead of corrupting the probe.
static unsigned char *memory[6], saved[6][4096], first[6][4096];
static const char ro[]="trace derived readonly memory";
static char output[262144]; static unsigned used;
static void text(const char*s){while(*s)output[used++]=*s++;}
static void number(long n){char b[24];unsigned i=0;U v=n<0?-(U)n:(U)n;if(n<0)output[used++]='-';do{b[i++]='0'+v%10;}while((v/=10));while(i)output[used++]=b[--i];}
static void result(const char*s,long n){text(s);text("=");number(n);text("\\n");}
static void bytes(const unsigned char*p,unsigned n){for(unsigned i=0;i<n;i++){output[used++]="0123456789abcdef"[p[i]>>4];output[used++]="0123456789abcdef"[p[i]&15];}text("\\n");}
struct poll_item { int fd; short events,revents; };
struct time_pair { long sec,ns; };
static struct time_pair immediate;
`;

export function shape(text: string): Shape {
  if (SYMBOLS[text]) return { kind: 'scalar', text, value: SYMBOLS[text] };
  if (text.includes('|') && text.split('|').every((part) => SYMBOLS[part] !== undefined || /^(?:\d+|0x[\da-f]+)$/.test(part))) {
    return { kind: 'scalar', text, value: String(text.split('|').reduce((sum, part) => sum + Number(SYMBOLS[part] ?? part), 0)) };
  }
  if (text.startsWith('AT_FDCWD<')) return { kind: 'fd', text, value: '-100' };
  if (/^-?\d+</.test(text)) return { kind: 'fd', text, value: text.split('<')[0] };
  if (text.startsWith('[{fd=')) return { kind: 'fd-array', text, value: '' };
  if (/^\[(?:\d+\s*)*\]$/.test(text)) return { kind: 'opaque-output', text, value: '' };
  if (text.startsWith('{tv_sec=')) return { kind: 'time-pair', text, value: '' };
  if (text.startsWith('{')) return { kind: 'opaque-output', text, value: '' };
  if (text.startsWith('"')) return { kind: 'bytes', text, value: '' };
  if (text === 'NULL') return { kind: 'null', text, value: '0' };
  if (/^-?(?:\d+|0x[\da-f]+)$/.test(text)) return { kind: 'scalar', text, value: text };
  return { kind: 'unsupported', text, value: '' };
}

export function collectCalls(name: string, traces: string[]): TraceCall[] {
  const calls: TraceCall[] = [];
  const seen = new Set<string>();
  for (const path of traces) {
    for (const raw of readFileSync(path, 'utf8').split('\n')) {
      const m = /^\s*(?:\d+\s+)?(\w+)\((.*)\)\s+=\s+(-?\d+)/.exec(raw);
      if (!m || m[1] !== name) continue;
      const args = splitArgs(m[2]).map((arg) => shape(arg));
      // Infer C-string input from decoded path strings, not syscall names.
      for (const arg of args) if (arg.kind === 'bytes' && Number(m[3]) <= 0 && arg.text !== '""') {
        const decoded = arg.text.replace(/\\x([\da-fA-F]{2})/g, (_m: string, h: string) => String.fromCharCode(parseInt(h, 16)));
        if (decoded.includes('/') || decoded.startsWith('"file:')) { arg.kind = 'path'; arg.value = decoded; }
      }
      // Rebind addresses inside or within 1 MiB of an earlier mmap result (an
      // address hint next to an existing region, say) to the probe's own fresh
      // mapping, keeping the signed offset. Absolute oracle addresses would
      // otherwise pin one process's layout.
      const prefix = readFileSync(path, 'utf8').slice(0, readFileSync(path, 'utf8').indexOf(raw));
      for (let i = 0; i < args.length; i += 1) if (args[i].kind === 'scalar' && /^0x[\da-f]+$/.test(args[i].value) && Number(args[i].value) > 0x100000) {
        const address = Number(args[i].value);
        for (const region of prefix.matchAll(/mmap\([^,]+,\s*(\d+),[^\n]+\)\s+=\s+(0x[\da-f]+)/g)) {
          if (address >= Number(region[2]) - 0x100000 && address < Number(region[2]) + Number(region[1]) + 0x100000) { args[i].kind = 'mapped'; args[i].value = String(address - Number(region[2])); }
        }
      }
      if (args.some((arg) => arg.kind === 'unsupported')) continue;
      const key = args.map((arg) => arg.kind + ':' + (arg.kind === 'scalar' ? arg.value : arg.kind === 'fd-array' ? arg.text.replace(/<[^>]*>/g, '') : '')).join('|');
      if (!seen.has(key)) { seen.add(key); calls.push({ args, raw, trace: path }); }
    }
  }
  return calls;
}

function base(call: TraceCall, id: string): AutoCase {
  const args: string[] = [], declarations: string[] = [], observations: string[] = [];
  // Outputs that depend on no descriptor or path are compared byte for byte
  // (varying words are learned from Linux). Descriptor/path outputs describe the
  // oracle's filesystem, which jitk's read-only archive replaces by design, so
  // they keep the write/no-write observation.
  const independent = !call.args.some((arg) => ['fd', 'path', 'fd-array'].includes(arg.kind));
  for (let i = 0; i < call.args.length; i += 1) {
    const arg = call.args[i];
    if (arg.kind === 'fd') args.push(Number(arg.value) >= 3 ? 'fd' : arg.value);
    else if (arg.kind === 'scalar' || arg.kind === 'null') args.push(arg.value);
    else if (arg.kind === 'mapped') args.push('(mapping+' + arg.value + ')');
    else if (arg.kind === 'path') args.push('(long)' + arg.value);
    else if (arg.kind === 'time-pair') args.push('(long)&immediate');
    else if (arg.kind === 'fd-array') {
      const items: string[] = [];
      for (const match of arg.text.matchAll(/\{fd=(-?\d+)(?:<[^>]*>)?(?:, events=([^,}]+))?[^}]*\}/g)) {
        const events = (match[2] || '0').replaceAll('POLLIN', '1').replaceAll('POLLOUT', '4').replaceAll('POLLPRI', '2');
        check(/^[\dxa-fA-F|]+$/.test(events), 'unsupported poll event symbol');
        items.push('{' + match[1] + ',' + events + ',0}');
      }
      check(items.length > 0 && items.length <= 16, 'bounded observed array required');
      declarations.push('struct poll_item array' + i + '[16]={' + items.join(',') + '};');
      args.push('(long)array' + i);
      observations.push('bytes((unsigned char*)array' + i + ',' + items.length * 8 + ');');
    } else {
      args.push('(long)memory[' + i + ']');
      // first[] holds the call's effect over fill 0xa7 and memory[] that of an
      // identical call over fill 0x5c. A written byte equal to one fill differs
      // from the other, so "touched" has no single-sentinel blind spot.
      const written = 'first[' + i + '][j]!=0xa7||memory[' + i + '][j]!=0x5c';
      if (arg.kind === 'bytes') observations.push('if(r>0){unsigned n=r<64?r:64;unsigned changed=0;for(unsigned j=0;j<n;j++)changed|=' + written + ';result("touched",changed!=0);bytes(first[' + i + '],n);}');
      else observations.push('unsigned extent' + i + '=0;for(unsigned j=0;j<4096;j++)if(' + written + ')extent' + i + '=j+1;result("touched' + i + '",extent' + i + '!=0);' + (independent ? 'bytes(first[' + i + '],extent' + i + ');' : ''));
    }
  }
  // NULL timeout shapes are made finite whenever a decoded time-pair shape
  // identifies that argument elsewhere in the corpus (applied in generate).
  return { id, category: 'semantic', args, declarations: declarations.join('\n'), observe: observations.join('\n'), closed: false };
}

function clone(c: AutoCase, id: string, category: string): AutoCase {
  return { id, category, args: [...c.args], declarations: c.declarations, observe: c.observe, closed: c.closed };
}

export function generate(name: string, nr: number, traces: string[]): Generated {
  const calls = collectCalls(name, traces);
  check(calls.length > 0, 'no supported real-program argument shapes for ' + name);
  const cases: AutoCase[] = [];
  const timed = new Set<number>();
  for (const call of calls) for (let i = 0; i < call.args.length; i += 1) if (call.args[i].kind === 'time-pair') timed.add(i);
  for (let k = 0; k < Math.min(calls.length, 8); k += 1) {
    const call = calls[k], b = base(call, 'seed-' + k);
    for (const i of timed) if (b.args[i] === '0') b.args[i] = '(long)&immediate';
    cases.push(b);
    for (let i = 0; i < call.args.length; i += 1) {
      const arg = call.args[i];
      let values: string[] = [];
      if (['bytes', 'opaque-output', 'fd-array'].includes(arg.kind)) values = ['0', '1', '(long)ro', '-16L'];
      if (arg.kind === 'scalar') {
        const n = Number(arg.value);
        // Bounded local numeric neighbourhood plus signed/zero boundaries.
        // Large byte counts remain bounded by a 65536-byte backing allocation.
        if (Number.isSafeInteger(n) && Math.abs(n) <= 8192) values = ['0', '-1', String(Math.max(0, n - 1)), String(n + 1)];
      }
      if (arg.kind === 'fd') values = ['-1', '2147483647', '0', '1', '2'];
      if (arg.kind === 'path') values = ['0', '1', '(long)"/data.bin"', '(long)"/"', '(long)"data.bin"', '(long)"/autoprofile-missing"'];
      for (let v = 0; v < values.length; v += 1) {
        const c = clone(b, b.id + '-arg-' + i + '-' + v, values[v] === '0' || values[v] === '-1' || arg.kind === 'fd' || arg.kind.includes('output') || arg.kind === 'bytes' || arg.kind === 'fd-array' ? 'error' : 'semantic');
        c.args[i] = values[v];
        // Invalid pointers must not be dereferenced by the observation code.
        if (['bytes', 'opaque-output', 'fd-array'].includes(arg.kind)) c.observe = '';
        cases.push(c);
      }
    }
    const repeat = clone(b, b.id + '-repeat', 'state'); cases.push(repeat);
    if (!call.args.length) cases.push(clone(b, b.id + '-fresh-context', 'state'));
    if (b.args.includes('fd')) { const closed = clone(b, b.id + '-closed', 'state'); closed.closed = true; cases.push(closed); }
  }
  const visible: AutoCase[] = [], heldout: AutoCase[] = [];
  for (let i = 0; i < cases.length; i += 1) (i % 3 === 2 ? heldout : visible).push(cases[i]);
  const hashes: Record<string, string> = {}; for (const path of traces) hashes[path] = sha(path);
  return { name, nr, traces: hashes, calls, visible, heldout, policy: 'trace-shapes-v1: observed seeds (max 8); local scalar boundaries; invalid output addresses; descriptor lifecycle; seek-position observation; two-fill write detection; descriptor-independent outputs compared byte-wise over their written extent; descriptor/path outputs by write/no-write and repeat equality; all expected values learned from Linux, no human spec text' };
}

export function source(profile: Generated, cases: AutoCase[]): string {
  let code = PRELUDE + '\nvoid _start(void){\n';
  for (const c of cases) {
    const args = [...c.args]; while (args.length < 6) args.push('0');
    const invoke = 'sys(' + profile.nr + ',' + args.join(',') + ')';
    code += '{long buffers=sys(222,0,786432,3,34,-1,0);for(unsigned i=0;i<6;i++){memory[i]=(unsigned char*)buffers+i*131072;sys(215,buffers+i*131072+65536,65536,0,0,0,0);}\n';
    code += 'long fd=sys(56,-100,(long)"/data.bin",0,0,0,0);long mapping=sys(222,0,1048576,3,34,-1,0);\n' + c.declarations + '\n';
    code += 'for(unsigned i=0;i<6;i++)for(unsigned j=0;j<65536;j++)memory[i][j]=0xa7;\n';
    if (c.closed) code += 'sys(57,fd,0,0,0,0,0);\n';
    code += 'text("' + c.id + '\\n");long r=' + invoke + ';result("return",r);\n';
    if (c.observe.includes('first[')) code += 'for(unsigned i=0;i<6;i++)for(unsigned j=0;j<4096;j++)first[i][j]=memory[i][j];for(unsigned i=0;i<6;i++)for(unsigned j=0;j<65536;j++)memory[i][j]=0x5c;long r1=' + invoke + ';result("second-return",r1);\n';
    code += c.observe + '\n';
    if (c.args.includes('fd') && !c.closed) code += 'result("position",sys(62,fd,0,1,0,0,0));\n';
    if (c.category === 'state' && !c.closed) {
      code += 'for(unsigned i=0;i<6;i++)for(unsigned j=0;j<4096;j++)saved[i][j]=memory[i][j];long r2=' + invoke + ';result("repeat-return",r2);unsigned same=1;for(unsigned i=0;i<6;i++)for(unsigned j=0;j<4096;j++)same&=saved[i][j]==memory[i][j];result("repeat-memory",same);\n';
    }
    code += 'sys(57,fd,0,0,0,0,0);sys(215,mapping,1048576,0,0,0,0);for(unsigned i=0;i<6;i++)sys(215,(long)memory[i],65536,0,0,0,0);}\n';
  }
  return code + 'sys(64,1,(long)output,used,0,0,0);sys(94,0,0,0,0,0,0);}\n';
}

export function emit(profile: Generated, out: string): void {
  dump(join(out, 'profile.json'), profile);
  writeFileSync(join(out, 'visible.c'), source(profile, profile.visible));
  writeFileSync(join(out, 'heldout.c'), source(profile, profile.heldout));
}
