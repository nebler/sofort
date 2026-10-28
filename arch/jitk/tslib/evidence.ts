// Evidence out of git (R10 change #3, W0.1). Bulk evidence lives in a local
// content-addressed store, ${SOFORT_EVIDENCE:-$HOME/sofort-local-evidence}/
// cas/sha256/<aa>/<sha256>; the tree keeps evidence/manifest.json (path,
// sha256, bytes, the commit that still has the file) and the human summaries.
// The keep/move rule is written down in evidence/README.md; classify() is its
// only implementation, and guard() refuses new tracked files the rule would
// move. tools/evidence.ts is the CLI.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, extname, join, normalize } from 'node:path';

export const LIMIT = 64 * 1024;
export const MANIFEST = 'evidence/manifest.json';

// Tracked files the rule covers: arch/, except research (other sessions write
// there) and the trees W0.2 deletes.
const OUTSIDE = ['arch/research/', 'arch/jitk/native/', 'arch/jitk/native-spike/', 'arch/jitk/shard/src/synthetic/'];

// A directory component that marks run output.
const EVIDENCE_DIR = /^(results?|raw|out|logs?|experiments|evidence|artifacts|frozen|pre-ready|test-results|grow-results|linux-out|raw-out)$|^raw-|-raw$|^results-|-results$|-out$|-ledger$/;
// Evidence by extension wherever it is.
const EVIDENCE_EXT = new Set(['.jsonl', '.csv', '.tsv', '.log']);
// Sources, configs and locks are not "large data" outside evidence dirs.
const SOURCE_EXT = new Set(['.ts', '.mjs', '.js', '.cjs', '.sh', '.py', '.rs', '.c', '.h', '.S', '.s', '.ld', '.mk', '.toml', '.lock', '.diff', '.patch', '.html', '.css', '.sb', '.sbpl', '.entitlements', '.yml', '.yaml', '.zig', '.lua', '.go']);

// Read by a build, test or runtime path (make build/test/doctor, shard
// snapshot/test-kvm, executor/ipc/shard-host.sh), so they stay even though the
// rule calls them evidence. Audited 2026-10-28; see evidence/README.md.
export const CONSUMED: Record<string, string> = {
  'arch/jitk/bench/raw.json': 'bench test: bench/parity.ts hashes it against parity-fixture.json',
  'arch/jitk/bench/raw-quiet-2026-10-24.json': 'bench test: bench/parity.ts hashes it against parity-fixture.json',
  'arch/jitk/bench/raw-native-watchdog-2026-10-24.json': 'bench test: bench/parity.ts hashes it against parity-fixture.json',
  'arch/jitk/bench/r4-raw.json': 'bench test: bench/parity.ts hashes it against parity-fixture.json',
  'arch/jitk/bench/hyperlight/results/raw.json': 'bench test: bench/parity.ts and bench/analysis-test.ts read it',
  'arch/jitk/bench/ledger/cpu-raw.json': 'bench test: bench/analysis-test.ts analysis.cpu.input',
  'arch/jitk/protocol/vectors.json': 'protocol test (make-vectors.ts, test.mjs) and docs/test_receipts.ts',
  'arch/jitk/grow/experiments/E1.json': 'grow test: grow/test.ts compares .design',
  'arch/jitk/grow/experiments/E1-pilot.json': 'grow test: grow/test.ts compares .design',
  'arch/jitk/grow/experiments/summary.json': 'grow test: grow/test.ts renderSummary',
  'arch/jitk/kernel/payload/qjs': 'kernel build.rs default payload; kernel, linux and grow tests',
  'arch/jitk/kernel/payload/qjs-ring': 'ring kernel build, shard snapshot fingerprint, executor/ipc',
  'arch/jitk/grow/payload/lua-static': 'kernel test fs_diff.ts and grow runtime',
  'arch/jitk/kernel/results-fs/linux-kvm-check.ts': 'compiled by kernel tools (results-fs/*.ts), run by make -C kernel linux-tools',
};

export interface Tracked {
  path: string;
  mode: string;
  blob: string;
  bytes: number;
}

export interface Entry {
  path: string;
  sha256: string;
  bytes: number;
  commit: string;
  mode?: string;
}

export interface Kept {
  path: string;
  bytes: number;
  reason: string;
}

export interface Manifest {
  schema: number;
  store: string;
  rule: string;
  files: Entry[];
  kept: Kept[];
}

export function git(root: string, args: string[]): string {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
}

// The blob at commit:path. scriptc's execFileSync returns text only, so the
// bytes go through a temporary file.
export function gitBlob(root: string, commit: string, path: string): Buffer {
  const temporary = join(tmpdir(), 'sofort-evidence-' + process.pid + '.blob');
  try {
    execFileSync('/bin/sh', ['-c', 'exec git -C "$1" cat-file blob "$2" > "$3"', 'sh', root, commit + ':' + path, temporary], { encoding: 'utf8' });
    return readFileSync(temporary);
  } finally {
    rmSync(temporary, { force: true });
  }
}

export function repoRoot(from: string): string {
  return git(from, ['rev-parse', '--show-toplevel']).trim();
}

export function sha256(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

export function storeRoot(): string {
  return join(process.env.SOFORT_EVIDENCE || join(homedir(), 'sofort-local-evidence'), 'cas', 'sha256');
}

export function casPath(hash: string): string {
  return join(storeRoot(), hash.slice(0, 2), hash);
}

// Index entries (mode, blob, path) with working-tree sizes; symlinks and
// gitlinks are left out (the rule never moves them).
export function tracked(root: string): Tracked[] {
  const result: Tracked[] = [];
  for (const record of git(root, ['ls-files', '-s', '-z']).split('\0')) {
    if (!record) {
      continue;
    }
    const tab = record.indexOf('\t');
    const [mode, blob] = record.slice(0, tab).split(' ');
    const path = record.slice(tab + 1);
    if (mode !== '100644' && mode !== '100755') {
      continue;
    }
    const full = join(root, path);
    const bytes = existsSync(full) ? lstatSync(full).size : -1;
    result.push({ path, mode, blob, bytes });
  }
  return result;
}

export function inScope(path: string): boolean {
  return path.startsWith('arch/') && !OUTSIDE.some(prefix => path.startsWith(prefix));
}

// Never moved whatever the location: summaries and provenance markers.
export function alwaysKept(path: string): string {
  const name = basename(path);
  if (/\.md$/i.test(name)) {
    return 'markdown summary';
  }
  if (name === '.READY' || name === 'release.json' || name === '.gitignore' || name === '.gitattributes') {
    return 'provenance marker (.READY/release.json are never touched)';
  }
  return '';
}

// Evidence by location, extension or size; '' when the rule does not call it
// evidence.
export function evidenceKind(path: string, bytes: number): string {
  const parts = path.split('/');
  const dir = parts.slice(0, -1).find(part => EVIDENCE_DIR.test(part));
  if (dir) {
    return 'evidence dir ' + dir + '/';
  }
  const ext = extname(path);
  if (EVIDENCE_EXT.has(ext)) {
    return ext + ' dump';
  }
  if (bytes > LIMIT && !SOURCE_EXT.has(ext) && !/(^|\/)(package-lock\.json|Makefile)$/.test(path)) {
    return 'data/binary > 64 KiB';
  }
  return '';
}

export function readManifest(root: string): Manifest | null {
  const path = join(root, MANIFEST);
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) as Manifest : null;
}

// One entry per line so diffs and grep stay usable.
export function writeManifest(root: string, manifest: Manifest): void {
  const files = manifest.files.slice().sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const kept = manifest.kept.slice().sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const lines = [
    '{',
    '  "schema": ' + manifest.schema + ',',
    '  "store": ' + JSON.stringify(manifest.store) + ',',
    '  "rule": ' + JSON.stringify(manifest.rule) + ',',
    '  "files": [',
    files.map(entry => '    ' + JSON.stringify(entry)).join(',\n'),
    '  ],',
    '  "kept": [',
    kept.map(entry => '    ' + JSON.stringify(entry)).join(',\n'),
    '  ]',
    '}',
    '',
  ];
  mkdirSync(join(root, 'evidence'), { recursive: true });
  writeFileSync(join(root, MANIFEST), lines.join('\n'));
}

// Copies data into the store (write, re-read, rename; read-only) unless an
// identical object is already there. Returns false when an existing object
// has the wrong content.
export function storePut(hash: string, data: Buffer): boolean {
  const target = casPath(hash);
  if (existsSync(target)) {
    return sha256(readFileSync(target)) === hash;
  }
  mkdirSync(dirname(target), { recursive: true });
  const temporary = target + '.tmp-' + process.pid;
  writeFileSync(temporary, data);
  if (sha256(readFileSync(temporary)) !== hash) {
    return false;
  }
  chmodSync(temporary, 0o444);
  renameSync(temporary, target);
  return true;
}

// The object's bytes when present with the right hash, else null.
export function storeGet(hash: string): Buffer | null {
  const target = casPath(hash);
  if (!existsSync(target)) {
    return null;
  }
  const data = readFileSync(target);
  return sha256(data) === hash ? data : null;
}

export interface Problem {
  path: string;
  problem: string;
}

// Every manifest entry present in the store with the right hash.
export function verifyStore(manifest: Manifest): Problem[] {
  const problems: Problem[] = [];
  const seen = new Map<string, string>();
  for (const entry of manifest.files) {
    let state = seen.get(entry.sha256);
    if (state === undefined) {
      const target = casPath(entry.sha256);
      if (!existsSync(target)) {
        state = 'missing from store';
      } else if (lstatSync(target).size !== entry.bytes) {
        state = 'wrong size in store';
      } else {
        state = sha256(readFileSync(target)) === entry.sha256 ? '' : 'wrong hash in store';
      }
      seen.set(entry.sha256, state);
    }
    if (state) {
      problems.push({ path: entry.path, problem: state });
    }
  }
  return problems;
}

// Tracked in-scope files the rule calls evidence, above 64 KiB, not markdown
// or a marker, and not listed as kept in the manifest: these must go to the
// store (`evidence export`) or be added to "kept" with a reason.
export function guard(root: string): string[] {
  const manifest = readManifest(root);
  const kept = new Set((manifest ? manifest.kept : []).map(entry => entry.path));
  return tracked(root)
    .filter(file => inScope(file.path) && file.bytes > LIMIT && !alwaysKept(file.path) && !kept.has(file.path) && !CONSUMED[file.path] && evidenceKind(file.path, file.bytes))
    .map(file => file.path + ' (' + Math.round(file.bytes / 1024) + ' KiB, ' + evidenceKind(file.path, file.bytes) + ')');
}

// Path-like tokens of the files that stay, for the "small and cited" rule:
// full tokens (./ and ../ prefixes dropped) and tokens resolved against the
// citing file's directory.
export function citations(root: string, staying: Tracked[]): Set<string> {
  const tokens = new Set<string>();
  const pattern = /[A-Za-z0-9_.@+~=,-]+(?:\/[A-Za-z0-9_.@+~=,-]+)+|[A-Za-z0-9_@+~=,-]+\.[A-Za-z0-9]+/g;
  for (const file of staying) {
    if (file.bytes <= 0 || file.bytes > 8 * 1024 * 1024 || file.path === MANIFEST) {
      continue;
    }
    const data = readFileSync(join(root, file.path));
    if (data.subarray(0, 8192).includes(0)) {
      continue;
    }
    const text = data.toString('utf8');
    const base = dirname(file.path);
    for (const match of text.matchAll(pattern)) {
      const token = match[0].replace(/[.,]+$/, '');
      tokens.add(token.replace(/^(\.\.?\/)+/, ''));
      tokens.add(normalize(join(base, token)));
    }
  }
  return tokens;
}

// Cited when a staying file names its repo path, its path relative to the
// citing file, or any suffix of it with two or more components.
export function cited(path: string, tokens: Set<string>): boolean {
  if (tokens.has(path)) {
    return true;
  }
  const parts = path.split('/');
  for (let i = 1; i <= parts.length - 2; i += 1) {
    if (tokens.has(parts.slice(i).join('/'))) {
      return true;
    }
  }
  return false;
}

// sha256 values named by any .READY or release.json in the tree.
export function readyHashes(root: string, files: Tracked[]): Set<string> {
  const hashes = new Set<string>();
  for (const file of files) {
    const name = basename(file.path);
    if (name !== '.READY' && name !== 'release.json') {
      continue;
    }
    for (const match of readFileSync(join(root, file.path), 'utf8').matchAll(/\b[0-9a-f]{64}\b/g)) {
      hashes.add(match[0]);
    }
  }
  return hashes;
}

export interface Decision {
  file: Tracked;
  sha256: string;
  move: boolean;
  reason: string;
}

// The rule (evidence/README.md). Only in-scope evidence is decided; every
// other tracked file stays without a decision.
export function classify(root: string): Decision[] {
  const files = tracked(root);
  const candidates = files.filter(file => file.bytes >= 0 && inScope(file.path) && !alwaysKept(file.path) && evidenceKind(file.path, file.bytes));
  const candidateSet = new Set(candidates.map(file => file.path));
  const tokens = citations(root, files.filter(file => !candidateSet.has(file.path)));
  const ready = readyHashes(root, files);
  return candidates.map(file => {
    const hash = sha256(readFileSync(join(root, file.path)));
    let reason = '';
    if (CONSUMED[file.path]) {
      reason = 'consumed: ' + CONSUMED[file.path];
    } else if (ready.has(hash)) {
      reason = 'hashed by a .READY/release.json';
    } else if (file.bytes <= LIMIT && cited(file.path, tokens)) {
      reason = 'small and cited by a tracked file';
    }
    return { file, sha256: hash, move: !reason, reason: reason || evidenceKind(file.path, file.bytes) };
  });
}
