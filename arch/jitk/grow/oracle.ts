import { chmodSync, existsSync, statSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { check, dump, hashBytes, readJSON } from './lib.ts';
import { ASSETS, ROOT, capture, run } from './runtime.ts';
import { type Outcome } from './observations.ts';
import { archive, unpack } from '../kernel/packer.ts';
import { lookup, mountHash, oracleKey, oracleMode, outcomes, pending, replay, seed, store, type OracleInputs } from './oracle-store.ts';

export interface OracleOptions {
  samples?: number;
  injections?: string[];
  data?: Buffer;
  resources?: string;
  // Shared file tree: the directory jitk packs as the guest's read-only `/`.
  // The oracle materialises the packed archive, checks that it re-packs to the
  // same bytes, bind-mounts it read-only and runs the payload chrooted into it
  // with cwd `/` (oracle-root.rs). Exclusive with `resources`.
  tree?: string;
  annotate?: boolean;
  // Linux calibration with the guest's memory capacity (KiB of address space).
  memoryKib?: number;
}
export type Oracle = (elf: string, argv: string[], out: string, expected: Buffer | null, options?: OracleOptions) => Promise<Outcome[]>;
// In-container paths of the shared tree and its launcher.
export const SHARED_ROOT = '/jitk-root';
export const SHARED_TREE_MODE = 'shared-tree-v1: payload chrooted into the materialised jitk archive (ro bind mount), cwd /, uid/gid 65534';

// SHA-256 of the archive bytes jitk embeds for `dir` (prepare.ts records the same
// value as packed.resources.sha256). This is the tree identity both sides pin.
export function treeHash(dir: string | null): string {
  return hashBytes(archive(dir).bytes);
}

// Materialises the archive for `dir` at `dest` and proves the round trip.
export function shareTree(dir: string | null, dest: string): { sha256: string; entries: number; bytes: number } {
  const packed = archive(dir);
  const entries = unpack(packed.bytes, dest);
  const again = archive(dest).bytes;
  check(again.equals(packed.bytes), 'materialised tree does not re-pack to the guest archive');
  return { sha256: hashBytes(packed.bytes), entries, bytes: packed.bytes.length };
}

// The tree a built jitk image embeds (build output manifest written by artifact.ts).
export function imageTree(buildOut: string): string {
  const manifest = readJSON<{ packed?: { resources?: { sha256?: string } } }>(join(buildOut, 'manifest.json'));
  const value = manifest.packed && manifest.packed.resources ? manifest.packed.resources.sha256 : undefined;
  check(typeof value === 'string' && value.length === 64, 'image manifest lacks the packed archive hash');
  return value!;
}

// Fail closed: a guest result may only be compared with a Linux reference that
// ran on the same tree.
export function requireSameTree(buildOut: string, expected: string | undefined): void {
  check(typeof expected === 'string' && expected.length === 64, 'fixture has no shared-tree hash: refusing to compare (re-run prepare)');
  const actual = imageTree(buildOut);
  check(actual === expected, 'shared tree mismatch: guest archive ' + actual + ' != oracle tree ' + expected + '; refusing to compare');
}

export const oracle: Oracle = async (elf, argv, out, expected, options = {}) => {
  check(options.tree === undefined || options.resources === undefined, 'tree and resources are exclusive');
  const shared = options.tree !== undefined;
  out = resolve(out);
  mkdirSync(out, { recursive: true });
  let tree: { sha256: string; entries: number; bytes: number } | null = null;
  if (shared) {
    tree = shareTree(options.tree === '' ? null : resolve(options.tree!), join(out, 'tree'));
    const launcher = join(ROOT, 'build/oracle-root');
    dump(join(out, 'tree.json'), { ...tree, source: options.tree, mode: SHARED_TREE_MODE, launcher_sha256: existsSync(launcher) ? hashBytes(readFileSync(launcher)) : null });
  }
  dump(join(out, 'oracle-config.json'), { argv, expected_hex: expected === null ? null : expected.toString('hex'), stdin_hex: (options.data ?? Buffer.from('ping\n')).toString('hex'), samples: options.samples ?? 1, injections: options.injections || [], annotate: options.annotate === true, memory_kib: options.memoryKib ?? 0, root: shared ? SHARED_ROOT : null, tree_sha256: tree ? tree.sha256 : null });
  // Record/replay (oracle-store.ts): the run is keyed by everything it reads.
  const mode = oracleMode();
  const inputs: OracleInputs = {
    payload_sha256: hashBytes(readFileSync(elf)),
    config: readJSON<unknown>(join(out, 'oracle-config.json')),
    mounts_sha256: mountHash(options.resources),
    tree_sha256: tree ? tree.sha256 : null,
  };
  const key = oracleKey(inputs);
  const recorded = lookup(out, key) ?? (mode === 'replay' ? seed(out, key, inputs, elf, options.resources) : null);
  if (mode === 'replay') {
    if (!recorded) {
      const dir = pending(out, key, inputs, elf, options.resources);
      throw new Error('no recorded Linux run for this oracle call (key ' + key + '); its inputs are in ' + dir + ' for CI to record');
    }
    replay(recorded, out);
    return readJSON<Outcome[]>(join(out, 'linux-summary.json'));
  }
  check(existsSync(join(ROOT, 'build/oracle-profile')) && statSync(join(ROOT, 'build/oracle-profile')).isFile(), 'build the native oracle driver with make build');
  check(!shared || (existsSync(join(ROOT, 'build/oracle-root')) && statSync(join(ROOT, 'build/oracle-root')).isFile()), 'build the shared-tree launcher with make build');
  const info = await run(['docker', 'image', 'inspect', 'jitk-oracle:08', '--format', '{{json .}}']);
  writeFileSync(join(out, 'oracle-image.json'), info.stdout);
  // On a Linux Docker host the bind mount keeps host ownership, so the payload
  // user (65534) needs the output directory writable (Docker Desktop maps it).
  if (process.platform === 'linux') chmodSync(out, 0o777);
  const container = 'jitk-08-' + process.pid + '-' + Date.now();
  // Shared tree: the driver and strace run as container root with only the three
  // capabilities chroot and the uid/gid drop need; the payload runs as 65534.
  const identity = shared ? ['--user', '0:0', '--cap-add', 'SYS_CHROOT', '--cap-add', 'SETUID', '--cap-add', 'SETGID'] : ['--user', '65534:65534'];
  const command = ['docker', 'run', '--rm', '-i', '--name', container, '--platform', 'linux/arm64', '--network', 'none', '--read-only', '--cap-drop', 'ALL', ...identity, '--security-opt', 'no-new-privileges', '--pids-limit', '16', '--memory', '512m', '--cpus', '1', '--tmpfs', '/tmp:rw,noexec,nosuid,size=16m', '-v', `${resolve(elf)}:/payload:ro`, '-v', `${ASSETS}/oracle:/oracle:ro`, '-v', `${out}:/out:rw`];
  if (shared) {
    command.push('-v', `${join(out, 'tree')}:${SHARED_ROOT}:ro`, '-v', `${ROOT}/build/oracle-root:/oracle-root:ro`);
  }
  if (options.resources) {
    // Not over /dev: the container's own /dev (null, zero, urandom) stands in
    // for a tree's dev/ placeholders, and runc refuses a /dev/null that is not
    // a device. Both read as empty files to the payloads that use it.
    for (const child of readdirSync(options.resources).sort().filter(name => name !== 'dev')) {
      command.push('-v', `${realpathSync(join(options.resources, child))}:/${child}:ro`);
    }
  }
  command.push('-v', `${ROOT}/build/oracle-profile:/oracle-profile:ro`, '--entrypoint', '/oracle-profile', 'jitk-oracle:08');
  try {
    const result = await run(command, { timeout: 90 });
    writeFileSync(join(out, 'driver.stdout'), result.stdout);
    writeFileSync(join(out, 'driver.stderr'), result.stderr);
  } finally {
    await capture(['docker', 'rm', '-f', container], { timeout: 10 });
  }
  if (mode === 'record') store(out, key, inputs, 'recorded by oracle(): ' + (process.env.GITHUB_RUN_ID ? 'GitHub run ' + process.env.GITHUB_RUN_ID : 'live run') + ' on ' + new Date().toISOString(), elf, options.resources);
  if (mode === 'verify') {
    check(recorded !== null, 'verify: no recorded run for key ' + key);
    if (outcomes(out) !== outcomes(recorded!)) {
      const lines = (dir: string) => readJSON<{ stdout_hex: string | null; exit: number | null }[]>(join(dir, 'linux-summary.json')).map(r => 'exit=' + r.exit + '\n' + Buffer.from(r.stdout_hex ?? '', 'hex').toString());
      const [got, want] = [lines(out).join('\n').split('\n'), lines(recorded!).join('\n').split('\n')];
      const diff = want.map((w, i) => (w === got[i] ? null : '  recorded ' + JSON.stringify(w) + ' / linux ' + JSON.stringify(got[i] ?? null))).filter(Boolean);
      throw new Error('verify: Linux outcomes differ from the recorded run ' + key + ':\n' + diff.slice(0, 20).join('\n'));
    }
  }
  return readJSON<Outcome[]>(join(out, 'linux-summary.json'));
};
