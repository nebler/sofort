// `evidence` (built to tools/.work/bin/evidence): bulk evidence out of git.
//   plan [--list]          what the rule (evidence/README.md) would move/keep
//   export [--commit REV]  copy every file the rule moves into the store,
//                          verify, and merge it into evidence/manifest.json
//   verify                 every manifest entry in the store with its sha256
//   fetch [--to DIR] PATH|GLOB...  restore files (in place, or below DIR) from
//                          the store, or from git at the
//                          recorded commit when the store lacks them (also
//                          fills the store); sha256-checked either way
//   remove                 git rm manifest entries still tracked, only after
//                          the store copy and the working file both verify
//   check                  the guard: tracked evidence > 64 KiB not in the
//                          manifest's "kept" list (exit 1)
// Store: ${SOFORT_EVIDENCE:-$HOME/sofort-local-evidence}/cas/sha256/<aa>/<sha256>.
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import type { Entry, Manifest } from '../tslib/evidence.ts';
import { MANIFEST, casPath, classify, git, gitBlob, guard, readManifest, repoRoot, sha256, storeGet, storePut, storeRoot, verifyStore, writeManifest } from '../tslib/evidence.ts';

const ROOT = repoRoot(process.cwd());
const STORE_TEXT = '${SOFORT_EVIDENCE:-$HOME/sofort-local-evidence}/cas/sha256/<aa>/<sha256>';

function mib(bytes: number): string {
  return (bytes / 1048576).toFixed(1) + ' MiB';
}

function load(): Manifest {
  return readManifest(ROOT) || { schema: 1, store: STORE_TEXT, rule: 'evidence/README.md', files: [], kept: [] };
}

function plan(list: boolean): number {
  const decisions = classify(ROOT);
  const moved = decisions.filter(d => d.move);
  const kept = decisions.filter(d => !d.move);
  const reasons = new Map<string, number>();
  for (const d of kept) {
    const key = d.reason.split(':')[0];
    reasons.set(key, (reasons.get(key) || 0) + 1);
  }
  console.log('move ' + moved.length + ' files, ' + mib(moved.reduce((s, d) => s + d.file.bytes, 0)));
  console.log('keep ' + kept.length + ' evidence files, ' + mib(kept.reduce((s, d) => s + d.file.bytes, 0)));
  for (const [reason, count] of reasons) {
    console.log('  ' + count + '  ' + reason);
  }
  if (list) {
    for (const d of decisions) {
      console.log((d.move ? 'move ' : 'keep ') + d.file.bytes + ' ' + d.file.path + ' # ' + d.reason);
    }
  }
  return 0;
}

// The manifest records the commit a file can be restored from, so the commit
// must hold exactly the bytes being exported.
function exportStore(commit: string): number {
  const revision = git(ROOT, ['rev-parse', '--verify', commit + '^{commit}']).trim();
  const atCommit = new Map<string, string>();
  for (const record of git(ROOT, ['ls-tree', '-r', '-z', revision]).split('\0')) {
    const tab = record.indexOf('\t');
    if (tab > 0) {
      atCommit.set(record.slice(tab + 1), record.slice(0, tab).split(' ')[2]);
    }
  }
  const dirty = new Set(git(ROOT, ['diff', '--name-only', '-z']).split('\0').filter(Boolean));
  const decisions = classify(ROOT);
  const manifest = load();
  const files = new Map<string, Entry>(manifest.files.map(entry => [entry.path, entry]));
  const kept = new Map(manifest.kept.map(entry => [entry.path, entry]));
  let failures = 0;
  let added = 0;
  for (const d of decisions) {
    if (!d.move) {
      if (d.file.bytes > 64 * 1024) {
        kept.set(d.file.path, { path: d.file.path, bytes: d.file.bytes, reason: d.reason });
      }
      continue;
    }
    if (atCommit.get(d.file.path) !== d.file.blob || dirty.has(d.file.path)) {
      console.error('evidence: ' + d.file.path + ' differs from ' + revision + '; commit it first or pass --commit');
      failures += 1;
      continue;
    }
    const data = readFileSync(join(ROOT, d.file.path));
    if (sha256(data) !== d.sha256 || !storePut(d.sha256, data)) {
      console.error('evidence: store copy of ' + d.file.path + ' failed verification (' + casPath(d.sha256) + ')');
      failures += 1;
      continue;
    }
    const entry: Entry = { path: d.file.path, sha256: d.sha256, bytes: d.file.bytes, commit: revision };
    if (d.file.mode === '100755') {
      entry.mode = '100755';
    }
    files.set(d.file.path, entry);
    added += 1;
  }
  manifest.files = [...files.values()];
  manifest.kept = [...kept.values()].filter(entry => !files.has(entry.path));
  writeManifest(ROOT, manifest);
  console.log('evidence: exported ' + added + ' files to ' + storeRoot() + '; manifest ' + manifest.files.length + ' entries, ' + manifest.kept.length + ' kept');
  return failures ? 1 : 0;
}

function verify(): number {
  const manifest = readManifest(ROOT);
  if (!manifest) {
    console.error('evidence: no ' + MANIFEST);
    return 1;
  }
  const problems = verifyStore(manifest);
  for (const p of problems.slice(0, 20)) {
    console.error('evidence: ' + p.path + ': ' + p.problem);
  }
  const bytes = manifest.files.reduce((s, e) => s + e.bytes, 0);
  if (problems.length) {
    console.error('evidence: ' + problems.length + ' of ' + manifest.files.length + ' entries not verified in ' + storeRoot() + '; restore with `evidence fetch <path>` (falls back to git) or copy the store');
    return 1;
  }
  console.log('evidence: ' + manifest.files.length + ' entries (' + mib(bytes) + ') verified in ' + storeRoot());
  return 0;
}

function globPattern(glob: string): RegExp {
  let source = '';
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      source += '.*';
      i += 1;
      if (glob[i + 1] === '/') {
        i += 1;
        source += '/?';
      }
    } else if (c === '*') {
      source += '[^/]*';
    } else if (c === '?') {
      source += '[^/]';
    } else {
      source += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp('^' + source + '(/.*)?$');
}

// Arguments are repo-relative or relative to the current directory; a
// directory selects everything below it.
function select(manifest: Manifest, args: string[]): Entry[] {
  const patterns: RegExp[] = [];
  for (const arg of args) {
    patterns.push(globPattern(arg.replace(/\/+$/, '')));
    const local = relative(ROOT, resolve(process.cwd(), arg)).replace(/\/+$/, '');
    if (!local.startsWith('..')) {
      patterns.push(globPattern(local));
    }
  }
  return manifest.files.filter(entry => patterns.some(p => p.test(entry.path)));
}

// Restored evidence is untracked; list it in the repository's info/exclude so
// it stays out of `git status` and the delegate's git-state guard.
function ignore(paths: string[]): void {
  const exclude = resolve(ROOT, git(ROOT, ['rev-parse', '--git-path', 'info/exclude']).trim());
  const text = existsSync(exclude) ? readFileSync(exclude, 'utf8') : '';
  const listed = new Set(text.split('\n'));
  const fresh = paths.map(path => '/' + path).filter(line => !listed.has(line));
  if (fresh.length) {
    mkdirSync(dirname(exclude), { recursive: true });
    const header = listed.has('# evidence fetch (evidence/README.md)') ? '' : '# evidence fetch (evidence/README.md)\n';
    writeFileSync(exclude, text + (text && !text.endsWith('\n') ? '\n' : '') + header + fresh.join('\n') + '\n');
  }
}

function fetch(argv: string[]): number {
  const at = argv.indexOf('--to');
  const destination = at >= 0 ? resolve(argv[at + 1]) : ROOT;
  const args = at >= 0 ? [...argv.slice(0, at), ...argv.slice(at + 2)] : argv;
  const manifest = readManifest(ROOT);
  if (!manifest || args.length === 0) {
    console.error(manifest ? 'usage: evidence fetch [--to DIR] PATH|GLOB...' : 'evidence: no ' + MANIFEST);
    return 1;
  }
  const entries = select(manifest, args);
  if (entries.length === 0) {
    console.error('evidence: nothing in ' + MANIFEST + ' matches ' + args.join(' '));
    return 1;
  }
  let fromStore = 0;
  let fromGit = 0;
  let present = 0;
  let failures = 0;
  for (const entry of entries) {
    const target = join(destination, entry.path);
    if (existsSync(target) && sha256(readFileSync(target)) === entry.sha256) {
      present += 1;
      continue;
    }
    let data = storeGet(entry.sha256);
    if (data) {
      fromStore += 1;
    } else {
      try {
        data = gitBlob(ROOT, entry.commit, entry.path);
      } catch {
        data = null;
      }
      if (!data || sha256(data) !== entry.sha256) {
        console.error('evidence: ' + entry.path + ' is neither in ' + storeRoot() + ' nor at ' + entry.commit + ' (fetch that commit, e.g. git fetch origin tag evidence-in-tree-2026-10-28)');
        failures += 1;
        continue;
      }
      storePut(entry.sha256, data);
      fromGit += 1;
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, data);
    chmodSync(target, entry.mode === '100755' ? 0o755 : 0o644);
  }
  if (destination === ROOT) {
    ignore(entries.map(entry => entry.path));
  }
  console.log('evidence: ' + entries.length + ' matched: ' + fromStore + ' from store, ' + fromGit + ' from git, ' + present + ' already present' + (failures ? ', ' + failures + ' FAILED' : ''));
  return failures ? 1 : 0;
}

function remove(): number {
  const manifest = readManifest(ROOT);
  if (!manifest) {
    console.error('evidence: no ' + MANIFEST);
    return 1;
  }
  const trackedPaths = new Set(git(ROOT, ['ls-files', '-z']).split('\0'));
  const doomed = manifest.files.filter(entry => trackedPaths.has(entry.path));
  const bad = doomed.filter(entry => !storeGet(entry.sha256) || sha256(readFileSync(join(ROOT, entry.path))) !== entry.sha256);
  if (bad.length) {
    for (const entry of bad.slice(0, 20)) {
      console.error('evidence: refusing to remove ' + entry.path + ': store copy or working file does not match ' + entry.sha256);
    }
    console.error('evidence: nothing removed (' + bad.length + ' unverified)');
    return 1;
  }
  for (let i = 0; i < doomed.length; i += 200) {
    git(ROOT, ['rm', '-q', '--', ...doomed.slice(i, i + 200).map(entry => entry.path)]);
  }
  console.log('evidence: removed ' + doomed.length + ' verified files from the tree');
  return 0;
}

function checkGuard(): number {
  const offenders = guard(ROOT);
  for (const line of offenders) {
    console.error('evidence: tracked evidence above 64 KiB: ' + line);
  }
  if (offenders.length) {
    console.error('evidence: move it to the store (`evidence export` then `evidence remove`) or, if a build/test reads it, add it to "kept" in ' + MANIFEST + ' with the reason; see evidence/README.md');
    return 1;
  }
  return 0;
}

function main(argv: string[]): number {
  const [command, ...rest] = argv;
  if (command === 'plan') {
    return plan(rest.includes('--list'));
  }
  if (command === 'export') {
    const at = rest.indexOf('--commit');
    return exportStore(at >= 0 ? rest[at + 1] : 'HEAD');
  }
  if (command === 'verify') {
    return verify();
  }
  if (command === 'fetch') {
    return fetch(rest);
  }
  if (command === 'remove') {
    return remove();
  }
  if (command === 'check') {
    return checkGuard();
  }
  console.error('usage: evidence plan [--list] | export [--commit REV] | verify | fetch PATH|GLOB... | remove | check');
  return 2;
}

process.exitCode = main(process.argv.slice(2));
