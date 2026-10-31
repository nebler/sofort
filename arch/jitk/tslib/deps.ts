// Locations of the external artifacts that `make -C arch/jitk deps`
// (tools/deps.ts) builds into the persistent jitk cache, and the shared
// resolution rule for every consumer: an explicitly set environment variable
// wins; otherwise the cache path; a missing artifact is an error naming the
// make target (`make -C arch/jitk/shard snapshot` for the prepared shard
// snapshot, `make -C arch/jitk deps` for the rest). Pins live in
// ../tools/deps.json; its rust_toolchain is the one Rust pin.
//
// Cache root: $JITK_CACHE, else $XDG_CACHE_HOME/jitk, else ~/.cache/jitk. It
// is outside every checkout so clones and worktrees share one copy, and
// every entry is keyed by its pin or input fingerprint so checkouts at
// different revisions never see each other's builds.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { check } from './assert.ts';
import { digest } from './hash.ts';
import { sleep } from './process.ts';

export const JITK_ROOT = resolve(import.meta.dirname, '..');
export const DEPS_TARGET = 'make -C arch/jitk deps';
export const SNAPSHOT_TARGET = 'make -C arch/jitk/shard snapshot';

export interface Pins {
  node: { version: string; url: string; tarball_sha256: Record<string, string>; darwin_signed_name: string; darwin_signed_sha256: string };
  zig: { version: string; url: string; zig_platform: Record<string, string>; tarball_sha256: Record<string, string> };
  biome: { version: string; url: string; binary_sha256: Record<string, string> };
  hyperlight_js: { repository: string; commit: string };
  hyperlight_toolchain: string;
  hyperlight_targets: string[];
  rust_toolchain: string;
  fuzz_toolchain: string;
}

// root: the arch/jitk directory whose tools/deps.json to read (default: this
// checkout).
export function pins(root = JITK_ROOT): Pins {
  return JSON.parse(readFileSync(join(root, 'tools/deps.json'), 'utf8')) as Pins;
}

export function cacheRoot(): string {
  const explicit = process.env.JITK_CACHE || '';
  if (explicit) {
    return resolve(explicit);
  }
  const xdg = process.env.XDG_CACHE_HOME || '';
  return resolve(xdg ? xdg : join(process.env.HOME || homedir(), '.cache'), 'jitk');
}

// node's platform-arch spelling as used by nodejs.org tarballs.
export function hostPlatform(): string {
  return (platform() === 'darwin' ? 'darwin' : 'linux') + '-' + (process.arch === 'arm64' ? 'arm64' : process.arch);
}

// sha256 over (relative path, NUL, length, NUL, bytes) of each file, in the
// given order; a missing file contributes its path and the marker '-'.
export function fingerprint(root: string, paths: string[], extra: string[] = []): string {
  const parts: Buffer[] = [];
  for (const path of paths) {
    const absolute = join(root, path);
    const data = existsSync(absolute) ? readFileSync(absolute) : Buffer.from('-');
    parts.push(Buffer.from(path + '\0' + String(data.length) + '\0'), data);
  }
  for (const item of extra) {
    parts.push(Buffer.from('extra\0' + item + '\0'));
  }
  return digest(Buffer.concat(parts));
}


// Every file under root/dir (relative to root, sorted); for fingerprints of
// whole source trees.
export function tree(root: string, dir: string): string[] {
  const result: string[] = [];
  const absolute = join(root, dir);
  if (!existsSync(absolute)) {
    return result;
  }
  for (const name of readdirSync(absolute).sort()) {
    if (name.startsWith('.')) {
      continue;
    }
    const path = dir + '/' + name;
    if (statSync(join(root, path)).isDirectory()) {
      result.push(...tree(root, path));
    } else {
      result.push(path);
    }
  }
  return result;
}

// PATH with rustup's bin directory appended: kvm-dev's non-login ssh shell
// lacks it.
export function cargoPath(path: string): string {
  return path + ':' + join(process.env.CARGO_HOME || join(process.env.HOME || homedir(), '.cargo'), 'bin');
}

// The production shard binary, built from source with the pinned toolchain:
// shard `real` on Linux (KVM), shard `hvf` on macOS (the HVF engine, signed
// with the hypervisor entitlement; its Seatbelt profile is
// shard/src/hvf/jitk.sb). Both also serve `process-watchdog` (the process backends'
// deadline watchdog); `hvf console` runs the console kernel profile.
export function shardInputs(): string {
  const files = ['shard/Cargo.toml', 'shard/Cargo.lock', 'shard/build.rs', 'shard/abi-gen.ts', ...tree(JITK_ROOT, 'shard/src'), ...tree(JITK_ROOT, 'shard/fixtures'), ...tree(JITK_ROOT, 'shard/guest'), 'shard/hypervisor.entitlements'];
  return fingerprint(JITK_ROOT, files, [pins().rust_toolchain, hostPlatform()]);
}
// The shard binary's name on this host.
export function shardBinaryName(): string {
  return platform() === 'darwin' ? 'hvf' : 'real';
}

export function shardDir(): string {
  return join(cacheRoot(), 'shard', hostPlatform() + '-' + shardInputs().slice(0, 16));
}

// Prepared helper snapshots (`make -C arch/jitk/shard snapshot`, shard/snapshot.ts).
// The entry directory is content-addressed: <class>-sha256(ring kernel image
// sha256, helper identity sha256). The ring kernel is only known after a
// build, so consumers find the entry through an index file keyed by the
// fingerprint of every snapshot input (kernel and helper sources, toolchain,
// class); the snapshot step rebuilds and re-verifies on an index miss.
export const SNAPSHOT_CLASSES = ['glue-2m', 'glue-4m', 'glue-8m', 'glue-16m'];

// The class JITK_SHARD_SNAPSHOT defaults to: JITK_SHARD_CLASS (the executor's
// selection, executor/select-backend.ts shardClass), else the default class
// (executor/shard-backend.ts DEFAULT_SHARD_CLASS).
export const DEFAULT_SHARD_CLASS = 'glue-16m';
export function shardClass(): string {
  const cls = process.env.JITK_SHARD_CLASS || DEFAULT_SHARD_CLASS;
  check(SNAPSHOT_CLASSES.includes(cls), 'unsupported JITK_SHARD_CLASS ' + cls + ' (one of ' + SNAPSHOT_CLASSES.join(', ') + ')');
  return cls;
}

export function snapshotInputs(cls: string): string {
  const kernel = ['Cargo.toml', 'Cargo.lock', 'build.rs', 'slots.json', 'prepare.ts', 'packer.ts', 'generate.ts', 'build-args.ts', 'lib.ts', 'native.c', 'native-ffi.json', 'ring-bootstrap.js', 'payload/qjs-ring'].map(name => 'kernel/' + name);
  const helpers = ['executor/codec.mjs', 'executor/shard-helpers.js', 'executor/prepared-helpers.mjs', 'executor/abi.ts', 'shard/snapshot.ts', 'protocol/bootstrap.js', 'abi/src/lib.rs'];
  const files = [...kernel, ...tree(JITK_ROOT, 'kernel/src'), ...helpers, ...tree(JITK_ROOT, 'tslib').filter(path => /^tslib\/[^/]+\.ts$/.test(path))];
  return fingerprint(JITK_ROOT, files, [pins().rust_toolchain, cls, hostPlatform()]);
}

export function snapshotRoot(): string {
  return join(cacheRoot(), 'shard-snapshot');
}

export function snapshotIndex(cls: string): string {
  return join(snapshotRoot(), 'index', hostPlatform() + '-' + cls + '-' + snapshotInputs(cls).slice(0, 16) + '.json');
}

export function snapshotKey(cls: string, kernelSha256: string, helperSha256: string): string {
  return hostPlatform() + '-' + cls + '-' + digest(Buffer.from(kernelSha256 + '\0' + helperSha256)).slice(0, 16);
}

// The snapshot base (dir/helpers, without extension) the index names, or a
// placeholder under the index name when it is not built yet.
export function snapshotBase(cls: string): string {
  const index = snapshotIndex(cls);
  if (existsSync(index)) {
    const entry = JSON.parse(readFileSync(index, 'utf8')) as { key: string };
    return join(snapshotRoot(), entry.key, 'helpers');
  }
  return join(snapshotRoot(), 'unbuilt-' + basename(index, '.json'), 'helpers');
}

export function nodeDir(): string {
  return join(cacheRoot(), 'node', 'v' + pins().node.version + '-' + hostPlatform());
}

// The ziglang.org release tree (zig plus its lib/), the cross-linker for the
// static aarch64 Linux scriptc builds and the `zig cc` C cross-builds.
export function zigDir(): string {
  return join(cacheRoot(), 'zig', pins().zig.version + '-' + hostPlatform());
}

// The zig to run: $ZIG (the Makefiles' variable) wins, then JITK_ZIG's usual
// resolution (explicit value, else the cache entry, else an error naming
// `make -C arch/jitk deps`). ../tools/zig-cc.sh is the shell twin.
export function zigPath(): string {
  return process.env.ZIG || requireArtifact('JITK_ZIG');
}

// The Biome release binary: the TS/JS formatter and linter (biome.json,
// `make -C arch/jitk fmt` and `lint`).
export function biomeDir(): string {
  return join(cacheRoot(), 'biome', pins().biome.version + '-' + hostPlatform());
}

export function hyperlightSourceDir(): string {
  return join(cacheRoot(), 'src', 'hyperlight-js-' + pins().hyperlight_js.commit);
}

export function hyperlightInputs(): string {
  const p = pins();
  const files = ['bench/hyperlight/Cargo.toml', 'bench/hyperlight/Cargo.lock', 'bench/hyperlight/worker.rs', 'bench/hyperlight/load_linux.rs', 'bench/hyperlight/bootstrap.js', 'bench/hyperlight/build.ts', 'shard/hypervisor.entitlements'];
  return fingerprint(JITK_ROOT, files, [p.hyperlight_js.commit, p.hyperlight_toolchain, hostPlatform()]);
}

export function hyperlightDir(): string {
  return join(cacheRoot(), 'hyperlight', hostPlatform() + '-' + hyperlightInputs().slice(0, 16));
}

export const ARTIFACTS = ['JITK_NODE', 'JITK_NPM_CLI', 'JITK_ZIG', 'JITK_BIOME', 'HYPERLIGHT_JS_SRC', 'HYPERLIGHT_WORKER', 'HYPERLIGHT_SNAPSHOT', 'JITK_SHARD_BINARY', 'JITK_SHARD_SNAPSHOT'];

// Hyperlight's HVF baseline is a macOS artifact. The shard binary and its
// prepared snapshot exist on both hosts (KVM `real` on Linux, the HVF engine
// `hvf` on macOS).
export function applicable(name: string): boolean {
  if (name.startsWith('HYPERLIGHT_')) {
    return platform() === 'darwin';
  }
  return true;
}

// The make target that builds each artifact.
export function target(name: string): string {
  return name === 'JITK_SHARD_SNAPSHOT' ? SNAPSHOT_TARGET : DEPS_TARGET;
}

// A snapshot is a base path (BASE.mem, .regs, .layout, .identity).
function present(name: string, path: string): boolean {
  return existsSync(name === 'JITK_SHARD_SNAPSHOT' ? path + '.identity' : path);
}

// The cache location of one artifact (whether or not it is built yet).
export function cachePath(name: string): string {
  if (name === 'JITK_NODE') {
    return join(nodeDir(), 'bin', platform() === 'darwin' ? pins().node.darwin_signed_name : 'node');
  }
  if (name === 'JITK_NPM_CLI') {
    return join(nodeDir(), 'lib/node_modules/npm/bin/npm-cli.js');
  }
  if (name === 'JITK_ZIG') {
    return join(zigDir(), 'zig');
  }
  if (name === 'JITK_BIOME') {
    return join(biomeDir(), 'biome');
  }
  if (name === 'HYPERLIGHT_JS_SRC') {
    return hyperlightSourceDir();
  }
  if (name === 'HYPERLIGHT_WORKER') {
    return join(hyperlightDir(), 'r2-worker');
  }
  if (name === 'HYPERLIGHT_SNAPSHOT') {
    return join(hyperlightDir(), 'snapshot');
  }
  if (name === 'JITK_SHARD_BINARY') {
    return join(shardDir(), shardBinaryName());
  }
  if (name === 'JITK_SHARD_SNAPSHOT') {
    return snapshotBase(shardClass());
  }
  throw new Error('unknown jitk artifact ' + name);
}

// Completion marker of each cache entry: written last by its builder.
export function completeMarker(name: string): string {
  if (name === 'JITK_NODE' || name === 'JITK_NPM_CLI') {
    return join(nodeDir(), 'jitk-manifest.json');
  }
  if (name === 'JITK_ZIG') {
    return join(zigDir(), 'jitk-manifest.json');
  }
  if (name === 'JITK_BIOME') {
    return join(biomeDir(), 'jitk-manifest.json');
  }
  if (name === 'HYPERLIGHT_JS_SRC') {
    return join(hyperlightSourceDir(), '.git/jitk-manifest.json');
  }
  if (name === 'JITK_SHARD_BINARY') {
    return join(shardDir(), 'manifest.json');
  }
  if (name === 'JITK_SHARD_SNAPSHOT') {
    return join(dirname(snapshotBase(shardClass())), 'manifest.json');
  }
  return join(hyperlightDir(), 'manifest.json');
}

export function cached(name: string): boolean {
  return existsSync(completeMarker(name)) && present(name, cachePath(name));
}

// Explicit environment value, else the cache path (unchecked).
export function artifactPath(name: string): string {
  const explicit = process.env[name] || '';
  return explicit ? explicit : cachePath(name);
}

// Explicit environment value, else the built cache artifact; anything
// missing throws with the variable, the path and the make target.
export function requireArtifact(name: string): string {
  const explicit = process.env[name] || '';
  if (explicit) {
    check(present(name, explicit), name + '=' + explicit + ' does not exist; unset it to use the ' + target(name) + ' cache');
    return explicit;
  }
  const path = cachePath(name);
  check(cached(name), name + ' is unset and ' + path + ' is not built; run `' + target(name) + '` (cache ' + cacheRoot() + ') or set ' + name);
  return path;
}

// Values for the unset variables whose cache artifact exists; used by the
// delegate so every delegated subtree sees the same selection.
export function cacheDefaults(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const name of ARTIFACTS) {
    if (!process.env[name] && applicable(name) && cached(name)) {
      result[name] = cachePath(name);
    }
  }
  return result;
}

// A directory lock (mkdir is atomic) around one cache entry's build so two
// checkouts sharing the cache never build the same entry concurrently. A
// lock whose owner pid is gone, or older than staleSeconds, is taken over.
export async function withLock<T>(name: string, body: () => Promise<T>, staleSeconds = 4 * 3600): Promise<T> {
  const locks = join(cacheRoot(), 'locks');
  mkdirSync(locks, { recursive: true });
  const lock = join(locks, name + '.lock');
  let announced = false;
  for (;;) {
    try {
      mkdirSync(lock);
      writeFileSync(join(lock, 'pid'), String(process.pid) + '\n');
      break;
    } catch (error) {
      if ((error as { code?: string }).code !== 'EEXIST') {
        throw error;
      }
    }
    let owner = 0;
    try {
      owner = Number(readFileSync(join(lock, 'pid'), 'utf8').trim());
    } catch {}
    let alive = owner > 0;
    if (alive) {
      try {
        process.kill(owner, 0);
      } catch (error) {
        alive = (error as { code?: string }).code === 'EPERM';
      }
    }
    let age = 0;
    try {
      age = (Date.now() - statSync(lock).mtimeMs) / 1000;
    } catch {}
    if ((!alive && age > 5) || age > staleSeconds) {
      rmSync(lock, { recursive: true, force: true });
      continue;
    }
    if (!announced) {
      console.error('jitk deps: waiting for ' + lock + ' (pid ' + String(owner) + ')');
      announced = true;
    }
    await sleep(1000);
  }
  try {
    return await body();
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}
