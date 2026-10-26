import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { ASSETS, CANONICAL, probeSource } from './runtime.ts';
import { check } from './lib.ts';

export interface Cases {
  semantic: string[];
  error: string[];
  state: string[];
}
export interface Profile {
  nr: number;
  visible?: string;
  heldout?: string;
  expected: Buffer | null;
  cases: Cases;
  mutations?: Record<string, string>;
}
const SIGNAL_CASES: Cases = { semantic: ['explicit injected ENOSYS'], error: ['inaccessible pointers still ENOSYS'], state: ['query after attempted set', 'output canary unchanged'] };
const SIGNAL_MUTATIONS: Record<string, string> = { 'false-success': 'pub fn call(_: &[usize]) -> isize { 0 }', 'pointer-sensitive': 'pub fn call(a: &[usize]) -> isize { if a[1] == 1 { -14 } else { -38 } }' };
export const PROFILES: Record<string, Profile> = {
  ppoll: {
    nr: 73,
    expected: Buffer.from('ping\n ppoll OK\n'),
    cases: { semantic: ['stdin readiness', 'stdout POLLOUT'], error: ['bad pointer', 'negative timeout', 'POLLNVAL'], state: ['revents copyout', 'consume input after readiness'] },
    mutations: { 'false-success': 'pub fn call(_: &[usize]) -> isize { 0 }', 'wrong-errno': 'pub fn call(_: &[usize]) -> isize { -14 }' },
  },
  rt_sigaction: { nr: 134, expected: Buffer.from('signals:ok\n'), cases: SIGNAL_CASES, mutations: SIGNAL_MUTATIONS },
  rt_sigprocmask: { nr: 135, expected: Buffer.from('signals:ok\n'), cases: SIGNAL_CASES, mutations: SIGNAL_MUTATIONS },
  fstat: {
    nr: 80,
    expected: null,
    cases: { semantic: ['Linux-normalized metadata'], error: ['bad/closed fd', 'NULL/read-only/wrapping pointer', 'errno precedence'], state: ['pathname/reopen metadata and offset'] },
  },
  pread64: {
    nr: 67,
    expected: null,
    cases: { semantic: ['header/offset/tail bytes and short reads'], error: ['bad/closed fd', 'NULL/read-only/wrapping pointer', 'errno precedence'], state: ['seek position after success/errors and independent opens'] },
  },
};

for (const name of Object.keys(PROFILES)) {
  PROFILES[name].visible = probeSource(name);
  PROFILES[name].heldout = ['ppoll', 'fstat', 'pread64'].includes(name) ? join(ASSETS, 'heldout-probe.c') : undefined;
}

export function mutations(name: string, source: string): Record<string, string> {
  if (name !== 'fstat' && name !== 'pread64') {
    return PROFILES[name].mutations!;
  }
  source = readFileSync(join(CANONICAL, `src/syscalls/${name}.rs`), 'utf8');
  if (name === 'fstat') {
    return {
      'wrong-size': 'use crate::{fs, syscalls::copyout};\npub fn call(a: &[usize]) -> isize {\n' +
        'let f = match fs::get(a[0] as u32 as usize) { Ok(f) => f, Err(e) => return e };\n' +
        'let n = match fs::node(f.node) { Ok(n) => n, Err(e) => return e };\n' +
        'let mut st=fs::stat(Some(n)); st[48..56].copy_from_slice(&0u64.to_le_bytes());\n' +
        'match copyout(a[1], &st) { Ok(()) => 0, Err(e) => e } }',
      'false-success': 'pub fn call(_: &[usize]) -> isize { 0 }',
      'wrong-errno': source.replaceAll('Err(e) => return e', 'Err(_) => return -22'),
    };
  }
  check(source.includes('let start = a[3].min(d.len());'), 'pread mutation anchor');
  check(source.includes('Ok(()) => count as isize'), 'pread mutation anchor');
  return {
    'wrong-page': source.replaceAll('let start = a[3].min(d.len());', 'let start = 0;'),
    'moves-offset': source.replaceAll('Ok(()) => count as isize', 'Ok(()) => { f.pos += count; count as isize }'),
    'wrong-errno': source.replaceAll('return -22;', 'return -9;'),
    'false-success': 'pub fn call(_: &[usize]) -> isize { 0 }',
  };
}

export function resources(out: string, heldout = false): string {
  const root = join(out, 'resources');
  mkdirSync(root);
  const bytes = Buffer.alloc(heldout ? 10241 : 9000);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = (i * 7 + Math.floor(i / 251)) & 255;
  }
  writeFileSync(join(root, 'data.bin'), bytes);
  chmodSync(join(root, 'data.bin'), 0o444);
  chmodSync(root, 0o555);
  return root;
}
