// Layering lint (R10 §3): `abi` <- `guest` <- `engine` <- `host` <- `research`; nothing
// points the other way, and the host runtime reads no coordination marker or
// evidence directory. An import/path scan in the style of kernel/arch-lint.ts.
//
// Layers, by path below arch/jitk:
//   abi       abi/ (the jitk-abi crate and its payload corpus), except abi/src/bin
//   guest     kernel/src, the guest bootstraps, shard/guest, shard/fixtures
//   engine    shard/src (Rust), vmm/src, vmm/sandbox/mod.rs
//   host      executor (incl. policy), protocol, mcp
//   research  everything else: bench, grow, linux, scriptc-corpus, docs, tools,
//             tslib, kernel/shard/vmm tooling and tests
//   evidence  any raw*/results/out/ledger/evidence directory
// The host *runtime* is the import closure of the product entry points
// (RUNTIME_ENTRIES); host checks and tests may use research tooling.
//
// Edges: TS/JS static and literal dynamic imports, `new URL('…', import.meta.url)`
// (resolved from the emitted file for executor/*.ts, which esbuild writes to
// executor/build/), and Rust `#[path]`, `include_str!`, `include_bytes!`.
//
// Rules:
//   abi       references only abi files
//   guest     references only guest or abi files
//   engine    references only engine, guest or abi files
//   runtime   the runtime closure contains only host or guest files
//   evidence  guest, engine and runtime files reference no evidence path
//   marker    runtime files do not name `.READY`
//   leaf      protocol/dispatcher.ts and executor/policy/policy.mjs import nothing
//             outside their own directory
// KNOWN lists today's violations with the reason each stays; a KNOWN entry that
// no longer occurs fails too, so the list only shrinks.
// `layering [--self-test] [JITK_ROOT]`.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { check } from '../tslib/assert.ts';
import { files } from '../tslib/fs.ts';

const KNOWN: [string, string][] = [
  ['evidence executor/select-backend.ts: kernel/evidence/parking-0.json',
    'parking gate read from evidence at run time (R9 N22: becomes a typed manifest field)'],
  ['marker executor/select-backend.ts: .READY',
    'backend selection reads vmm/kernel .READY markers (R9 N22)'],
];
const RUNTIME_ENTRIES = ['mcp/server.mjs', 'mcp/jitk.mjs', 'mcp/native.mjs', 'executor/executor.ts', 'executor/select-backend.ts', 'executor/policy/policy.mjs', 'protocol/dispatcher.ts'];
const LEAVES = ['protocol/dispatcher.ts', 'executor/policy/policy.mjs'];
const GUEST_FILES = ['kernel/ring-bootstrap.js', 'protocol/bootstrap.js'];
const SKIP = new Set(['.git', 'node_modules', '.work', 'target', 'build', 'dist', 'vendor', 'payload', '.scriptc']);
const EVIDENCE = /^(raw[^/]*|results|out|ledger|evidence)$/;
const EVIDENCE_IN_LITERAL = /(?:^|\/)(?:raw[-\w]*|results|out|ledger|evidence)\/[^'"`]*/;

export function layer(rel: string): string {
  const parts = rel.split('/');
  if (parts.slice(0, -1).some((part) => EVIDENCE.test(part))) return 'evidence';
  if (parts[0] === 'abi' && !rel.startsWith('abi/src/bin/')) return 'abi';
  if (rel.startsWith('kernel/src/') || rel.startsWith('shard/guest/') || rel.startsWith('shard/fixtures/') || GUEST_FILES.includes(rel)) return 'guest';
  if ((rel.startsWith('shard/src/') && rel.endsWith('.rs')) || rel.startsWith('vmm/src/') || rel === 'vmm/sandbox/mod.rs' || rel === 'vmm/sandbox/jitk.sb' || rel === 'shard/src/hvf/zygote.sb') return 'engine';
  if (parts[0] === 'executor' || parts[0] === 'protocol' || parts[0] === 'mcp') return 'host';
  return 'research';
}

// Blank comments, keeping string literals (their contents are the edges).
function uncomment(source: string, rust: boolean): string {
  let out = '';
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1];
    if (c === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') { out += ' '; i++; }
    } else if (c === '/' && next === '*') {
      i += 2; out += '  ';
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) { out += source[i] === '\n' ? '\n' : ' '; i++; }
      i += 2; out += '  ';
    } else if (c === '"' || c === '`' || (c === '\'' && !rust)) {
      const quote = c;
      out += c; i++;
      while (i < source.length && source[i] !== quote) {
        if (source[i] === '\\') { out += source[i]; i++; }
        out += source[i]; i++;
      }
      out += quote; i++;
    } else {
      out += c; i++;
    }
  }
  return out;
}

export interface Reference { spec: string; url: boolean }
export function references(name: string, source: string): Reference[] {
  const rust = name.endsWith('.rs');
  const code = uncomment(source, rust);
  const result: Reference[] = [];
  const patterns: [RegExp, boolean][] = rust
    ? [[/#\[path\s*=\s*"([^"]+)"\]/g, false], [/include_(?:str|bytes)!\(\s*"([^"]+)"\s*\)/g, false]]
    : [[/\b(?:import|export)\s[^;'"`]*?\bfrom\s*['"]([^'"]+)['"]/g, false], [/\bimport\s*['"]([^'"]+)['"]/g, false],
      [/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g, false], [/new URL\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url\s*\)/g, true]];
  for (const [pattern, url] of patterns) {
    let match = pattern.exec(code);
    while (match) {
      if (match[1].startsWith('.') || (rust && !match[1].startsWith('/'))) result.push({ spec: match[1], url });
      match = pattern.exec(code);
    }
  }
  return result;
}

// String literals (JS/TS) that name an evidence directory or a .READY marker.
export function literals(source: string): string[] {
  const result: string[] = [];
  const pattern = /'([^'\n]*)'|"([^"\n]*)"|`([^`]*)`/g;
  const code = uncomment(source, false);
  let match = pattern.exec(code);
  while (match) {
    const text = match[1] ?? match[2] ?? match[3] ?? '';
    if (EVIDENCE_IN_LITERAL.test(text)) result.push('evidence:' + text);
    if (text.includes('.READY')) result.push('marker:.READY');
    match = pattern.exec(code);
  }
  return result;
}

function isFile(path: string): boolean {
  return existsSync(path) && statSync(path).isFile();
}
// A resolved path back to its source: `.js` imports of `.ts` files, and
// executor/build/ outputs (bundles and copies, see executor/build.mjs).
function source(root: string, path: string): string | null {
  const build = join(root, 'executor/build') + '/';
  if (path.startsWith(build)) {
    const name = path.slice(build.length);
    if (name === 'ring-bootstrap.js') return join(root, 'kernel/ring-bootstrap.js');
    path = join(root, 'executor', name);
  }
  if (isFile(path)) return path;
  if (path.endsWith('.js') && isFile(path.slice(0, -3) + '.ts')) return path.slice(0, -3) + '.ts';
  return null;
}
function target(root: string, file: string, ref: Reference): string | null {
  const rel = relative(root, file);
  const emitted = ref.url && /^executor\/[^/]+\.ts$/.test(rel) ? join(root, 'executor/build', basename(file)) : file;
  return source(root, resolve(dirname(emitted), ref.spec));
}

let edgeCount = 0;
export function lint(root: string): string[] {
  const found: string[] = [];
  const edges = new Map<string, string[]>();
  const sources = new Map<string, string>();
  const walk = (dir: string): void => {
    for (const path of files(dir)) {
      const rel = relative(root, path);
      if (rel.split('/').some((part) => SKIP.has(part)) || !/\.(ts|mjs|js|rs)$/.test(rel) || rel.endsWith('.d.ts')) continue;
      if (layer(rel) === 'evidence') continue;
      const text = readFileSync(path, 'utf8');
      sources.set(rel, text);
      const out: string[] = [];
      for (const ref of references(rel, text)) {
        const to = target(root, path, ref);
        if (to) out.push(relative(root, to));
        else if (EVIDENCE_IN_LITERAL.test(ref.spec)) out.push(relative(root, resolve(dirname(path), ref.spec)));
      }
      edgeCount += out.length;
      edges.set(rel, out);
    }
  };
  walk(root);
  for (const [from, tos] of edges) {
    const kind = layer(from);
    for (const to of tos) {
      const toKind = layer(to);
      if (kind === 'abi' && toKind !== 'abi') found.push(`abi ${from} -> ${to}`);
      if (kind === 'guest' && toKind !== 'guest' && toKind !== 'abi') found.push(`guest ${from} -> ${to}`);
      if (kind === 'engine' && !['engine', 'guest', 'abi'].includes(toKind)) found.push(`${toKind === 'evidence' ? 'evidence' : 'engine'} ${from} -> ${to}`);
    }
  }
  // Runtime closure: stop at a research file (report the edge, not its subtree).
  const runtime: string[] = [];
  const queue = RUNTIME_ENTRIES.filter((entry) => edges.has(entry));
  check(queue.length === RUNTIME_ENTRIES.length, 'layering: a runtime entry point is missing: ' + RUNTIME_ENTRIES.filter((e) => !edges.has(e)).join(', '));
  while (queue.length) {
    const from = queue.shift()!;
    if (runtime.includes(from)) continue;
    runtime.push(from);
    for (const to of edges.get(from) ?? []) {
      const toKind = layer(to);
      if (toKind === 'research' || toKind === 'evidence') found.push(`${toKind === 'evidence' ? 'evidence' : 'runtime'} ${from} -> ${to}`);
      else if (edges.has(to) && !runtime.includes(to)) queue.push(to);
    }
  }
  for (const from of runtime) {
    if (from.endsWith('.rs')) continue;
    for (const hit of literals(sources.get(from) ?? '')) {
      const [rule, text] = [hit.slice(0, hit.indexOf(':')), hit.slice(hit.indexOf(':') + 1)];
      const entry = `${rule} ${from}: ${text}`;
      if (!found.includes(entry)) found.push(entry);
    }
  }
  for (const leaf of LEAVES) {
    for (const to of edges.get(leaf) ?? []) if (dirname(to) !== dirname(leaf)) found.push(`leaf ${leaf} -> ${to}`);
  }
  return found;
}

function selfTest(): void {
  check(layer('kernel/src/fs.rs') === 'guest' && layer('shard/src/owner.rs') === 'engine' && layer('executor/pool.ts') === 'host', 'self-test: layers');
  check(layer('abi/src/lib.rs') === 'abi' && layer('abi/guest-payloads.json') === 'abi' && layer('abi/src/bin/abi-gen.rs') === 'research', 'self-test: abi layer');
  check(layer('bench/run.ts') === 'research' && layer('kernel/tests/demo.ts') === 'research' && layer('shard/raw-r6/x.json') === 'evidence', 'self-test: research/evidence');
  const ts = references('a.ts', "import {x} from './x.js';\nexport * from '../y.js';\n// import z from './z.js';\nconst u = new URL('../p.mjs', import.meta.url);\nimport('./d.js');\nimport 'node:fs';");
  check(ts.map((r) => r.spec).join(' ') === './x.js ../y.js ./d.js ../p.mjs', 'self-test: ts references ' + ts.map((r) => r.spec).join(' '));
  check(ts.find((r) => r.spec === '../p.mjs')!.url, 'self-test: url reference');
  const rs = references('a.rs', '#[path = "ring.rs"]\nmod console;\nlet s = include_str!("../fixtures/a.js"); // include_str!("b")\nlet c = \'"\';');
  check(rs.map((r) => r.spec).join(' ') === 'ring.rs ../fixtures/a.js', 'self-test: rust references ' + rs.map((r) => r.spec).join(' '));
  check(literals("const a='kernel/evidence/p.json', b=dir+'.READY', c='results'; // 'raw-x/y'").join(' ') === 'evidence:kernel/evidence/p.json marker:.READY', 'self-test: literals ' + literals("const a='kernel/evidence/p.json', b=dir+'.READY', c='results';").join(' '));
}

const operand = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
const root = resolve(operand ?? join(import.meta.dirname, '..'));
if (process.argv.includes('--self-test')) selfTest();
const found = lint(root);
const known = KNOWN.map(([entry]) => entry);
const errors = found.filter((entry) => !known.includes(entry)).map((entry) => 'layering: ' + entry);
for (const entry of known) if (!found.includes(entry)) errors.push('layering: KNOWN entry no longer occurs, remove it: ' + entry);
for (const [entry, why] of KNOWN) if (found.includes(entry)) console.log(`layering: known: ${entry} (${why})`);
for (const error of errors) console.error(error);
check(errors.length === 0, errors.length + ' layering violations (tools/layering.ts)');
console.log(`layering: ${edgeCount} edges, ${known.length} known violations, no new ones`);
