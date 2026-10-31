// Recorded Linux oracle runs, so checks that compare against Linux can run
// where Linux must not (the Mac). A run is keyed by everything it reads: the
// payload's bytes, its oracle-config.json and the bytes of the trees
// bind-mounted into it. `JITK_ORACLE`:
//
//   live    (default) run Linux in Docker, as before
//   replay  answer from the store; a miss fails and leaves the run's inputs in
//           grow/.work/oracle-pending/<key>/ for CI to record
//   record  run Linux, then store the run (CI, where Docker is allowed)
//   verify  run Linux and fail unless its outcomes equal the stored ones (CI)
//
// Two stores. Visible runs live in grow/oracle-golden/ (in git). Runs whose
// output path has a `heldout` component are sealed: they live outside the
// repository (JITK_ORACLE_SEALED, default ~/.sofort/oracle-sealed), so growth
// agents reading the tree never see held-out answers.
import { chmodSync, copyFileSync, cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { check, dump, hashBytes, readJSON } from './lib.ts';
import { ROOT } from './runtime.ts';

export type OracleMode = 'live' | 'replay' | 'record' | 'verify';
export const GOLDEN = join(ROOT, 'oracle-golden');
export const PENDING = join(ROOT, '.work', 'oracle-pending');

export function oracleMode(): OracleMode {
  const mode = process.env.JITK_ORACLE ?? 'live';
  check(['live', 'replay', 'record', 'verify'].includes(mode), 'JITK_ORACLE is live, replay, record or verify');
  return mode as OracleMode;
}

export function sealedStore(): string {
  return resolve(process.env.JITK_ORACLE_SEALED ?? join(homedir(), '.sofort', 'oracle-sealed'));
}

export function isSealed(out: string): boolean {
  return resolve(out).split('/').includes('heldout');
}

export function storeFor(out: string): string {
  return isSealed(out) ? sealedStore() : GOLDEN;
}

// Every regular file under `dir`, top-level symlinks resolved the way the
// oracle bind-mounts them: path, mode bits and bytes.
export function mountHash(dir: string | undefined, modes = true): string | null {
  if (dir === undefined) return null;
  const rows: string[] = [];
  const walk = (path: string, rel: string): void => {
    const stat = statSync(path);
    if (stat.isDirectory()) {
      rows.push('d ' + rel + (modes ? ' ' + (stat.mode & 0o777).toString(8) : ''));
      for (const name of readdirSync(path).sort()) walk(join(path, name), rel ? rel + '/' + name : name);
    } else if (stat.isFile()) {
      rows.push('f ' + rel + (modes ? ' ' + (stat.mode & 0o777).toString(8) : '') + ' ' + hashBytes(readFileSync(path)));
    }
  };
  for (const name of readdirSync(dir).sort()) walk(realpathSync(join(dir, name)), name);
  return hashBytes(Buffer.from(rows.join('\n')));
}

// Git keeps only the executable bit, so the mounts' modes are stored beside
// them and restored before a recording is rerun (they are part of the key:
// fstat reports them).
export function mountModes(dir: string): Record<string, string> {
  const modes: Record<string, string> = {};
  const walk = (path: string, rel: string): void => {
    for (const name of readdirSync(path).sort()) {
      const child = join(path, name);
      const r = rel ? rel + '/' + name : name;
      modes[r] = (statSync(child).mode & 0o777).toString(8);
      if (statSync(child).isDirectory()) walk(child, r);
    }
  };
  walk(dir, '');
  return modes;
}

export function restoreModes(dir: string, modes: Record<string, string>): void {
  // Deepest first, so a read-only directory doesn't block its children.
  for (const rel of Object.keys(modes).sort((a, b) => b.split('/').length - a.split('/').length)) {
    chmodSync(join(dir, rel), parseInt(modes[rel]!, 8));
  }
}

export interface OracleInputs {
  payload_sha256: string;
  config: unknown; // oracle-config.json as written for the run
  mounts_sha256: string | null; // resources bind mounts
  tree_sha256: string | null; // shared tree (also in config)
}

export function oracleKey(inputs: OracleInputs): string {
  return hashBytes(Buffer.from(JSON.stringify(inputs)));
}

// The files a Linux run leaves in its output directory (written by the driver
// in the container, and by oracle()).
export function outputFiles(out: string): string[] {
  return readdirSync(out)
    .filter(name => name !== 'tree' && name !== 'oracle-config.json' && name !== 'tree.json' && lstatSync(join(out, name)).isFile())
    .sort();
}

export interface Recorded {
  key: string;
  inputs: OracleInputs;
  files: string[];
  provenance: string;
}

export function lookup(out: string, key: string): string | null {
  const dir = join(storeFor(out), key);
  return existsSync(join(dir, 'recorded.json')) ? dir : null;
}

// Payloads are kept by sha256 beside the store, so CI can rerun the call.
// Payloads over 1 MiB stay out of git (CI fetches them by sha256).
export const PAYLOAD_LIMIT = 1 << 20;
export function payloadPath(storeRoot: string, sha: string): string {
  return join(storeRoot, 'payloads', sha);
}

// Stores the Linux run in `from` (default: the run's own output directory),
// with its payload and mounts.
export function store(out: string, key: string, inputs: OracleInputs, provenance: string, payload: string, mounts: string | undefined, from = out): string {
  const root = storeFor(out);
  const dir = join(root, key);
  mkdirSync(dir, { recursive: true });
  if (statSync(payload).size <= PAYLOAD_LIMIT && !existsSync(payloadPath(root, inputs.payload_sha256))) {
    mkdirSync(join(root, 'payloads'), { recursive: true });
    copyFileSync(payload, payloadPath(root, inputs.payload_sha256));
  }
  if (mounts && !existsSync(join(dir, 'mounts'))) {
    cpSync(mounts, join(dir, 'mounts'), { recursive: true, dereference: true });
    dump(join(dir, 'mounts.modes.json'), mountModes(join(dir, 'mounts')));
  }
  const names = outputFiles(from);
  check(names.includes('linux-summary.json'), 'oracle run left no linux-summary.json: ' + from);
  for (const name of names) copyFileSync(join(from, name), join(dir, name));
  dump(join(dir, 'recorded.json'), { key, inputs, files: names, provenance } satisfies Recorded);
  return dir;
}

export function replay(dir: string, out: string): void {
  const recorded = readJSON<Recorded>(join(dir, 'recorded.json'));
  for (const name of recorded.files) copyFileSync(join(dir, name), join(out, name));
}

// A miss: keep what CI needs to record the run (payload, config, mounts).
export function pending(out: string, key: string, inputs: OracleInputs, payload: string, mounts: string | undefined): string {
  const dir = join(PENDING, key);
  mkdirSync(dir, { recursive: true });
  copyFileSync(payload, join(dir, 'payload'));
  copyFileSync(join(out, 'oracle-config.json'), join(dir, 'oracle-config.json'));
  if (mounts) cpSync(mounts, join(dir, 'mounts'), { recursive: true, dereference: true });
  dump(join(dir, 'inputs.json'), { key, inputs, sealed: isSealed(out), out: relative(ROOT, resolve(out)) });
  return dir;
}

// What `verify` compares: the outcome fields, not timings (`seconds`).
const OUTCOME = ['returncode', 'exit', 'stdout_hex', 'stderr_hex', 'injected_count'];
export function outcomes(dir: string): string {
  const rows = readJSON<Record<string, unknown>[]>(join(dir, 'linux-summary.json'));
  return JSON.stringify(rows.map(row => OUTCOME.map(k => [k, row[k] ?? null])));
}

// Seeding from earlier receipts of real Linux runs (JITK_ORACLE_SEED: a
// colon-separated list of receipt directories, e.g. a kernel promotion's
// .work/promote/<hash>/). A receipt run counts only if all of its inputs are
// proven equal to this call's:
// - oracle-config.json is identical;
// - the payload: an *.elf beside the run with the same bytes, or a
//   binary_sha256 recorded in a report.json beside it or one level up;
// - the mounts: a resources/ beside it or one level up hashing the same, or
//   none on both sides. Modes are not compared: archiving a receipt makes its
//   files writable. A mode that mattered would show as a guest/Linux mismatch,
//   so a seed can fail a gate but not pass one it shouldn't.
// The receipt must be of the same sealing (held-out or not) as the call.
function oracleDirs(root: string): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (!lstatSync(path).isDirectory()) continue;
      if (existsSync(join(path, 'oracle-config.json')) && existsSync(join(path, 'linux-summary.json'))) found.push(path);
      walk(path);
    }
  };
  walk(root);
  return found;
}

function payloadShas(run: string): Set<string> {
  const shas = new Set<string>();
  for (const dir of [dirname(run), dirname(dirname(run))]) {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (name.endsWith('.elf') && lstatSync(path).isFile() && dir === dirname(run)) shas.add(hashBytes(readFileSync(path)));
      if (name === 'report.json') {
        const report = readJSON<{ binary_sha256?: unknown }>(path);
        if (typeof report.binary_sha256 === 'string') shas.add(report.binary_sha256);
      }
    }
  }
  return shas;
}

function mountShas(run: string): Set<string> {
  // content only (see above)
  const shas = new Set<string>();
  for (const dir of [dirname(run), dirname(dirname(run))]) {
    const mounts = join(dir, 'resources');
    if (existsSync(mounts) && lstatSync(mounts).isDirectory()) shas.add(mountHash(mounts, false)!);
  }
  return shas;
}

export function seed(out: string, key: string, inputs: OracleInputs, payload: string, mounts: string | undefined): string | null {
  const content = mountHash(mounts, false);
  const roots = (process.env.JITK_ORACLE_SEED ?? '').split(':').filter(Boolean);
  const config = JSON.stringify(inputs.config);
  for (const root of roots) {
    for (const run of oracleDirs(resolve(root))) {
      if (isSealed(run) !== isSealed(out)) continue;
      if (JSON.stringify(readJSON<unknown>(join(run, 'oracle-config.json'))) !== config) continue;
      if (!payloadShas(run).has(inputs.payload_sha256)) continue;
      const found = mountShas(run);
      if (content !== null && !found.has(content)) continue;
      return store(out, key, inputs, 'seeded from a recorded Linux run in ' + run + ' (config, payload and mounts proven equal)', payload, mounts, run);
    }
  }
  return null;
}
