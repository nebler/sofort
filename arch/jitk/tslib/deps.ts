// Locations of the external artifacts that `make -C arch/jitk deps`
// (tools/deps.ts) builds into the persistent jitk cache, and the shared
// resolution rule for every consumer: an explicitly set environment variable
// wins; otherwise the cache path; a missing artifact is an error naming the
// make target. Pins live in ../tools/deps.json.
//
// Cache root: $JITK_CACHE, else $XDG_CACHE_HOME/jitk, else ~/.cache/jitk. It
// is outside every checkout so clones and worktrees share one copy, and
// every entry is keyed by its pin or input fingerprint so checkouts at
// different revisions never see each other's builds.
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join, resolve } from 'node:path';
import { check } from './assert.ts';
import { digest } from './hash.ts';
import { sleep } from './process.ts';

export const JITK_ROOT = resolve(import.meta.dirname, '..');
export const DEPS_TARGET = 'make -C arch/jitk deps';

export interface Pins {
  node: { version: string; url: string; tarball_sha256: Record<string, string>; darwin_signed_name: string; darwin_signed_sha256: string };
  hyperlight_js: { repository: string; commit: string };
  hyperlight_toolchain: string;
  hyperlight_targets: string[];
  vmm_toolchain: string;
}

export function pins(): Pins {
  return JSON.parse(readFileSync(join(JITK_ROOT, 'tools/deps.json'), 'utf8')) as Pins;
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

// The VMM inputs: its builder, the libkrun patch set, launcher and sandbox
// sources, the entitlements and whether the sandbox .READY gate is present.
export function vmmPatchFingerprint(): string {
  const series = readFileSync(join(JITK_ROOT, 'vmm/patches/series'), 'utf8').split('\n').filter(Boolean);
  return fingerprint(join(JITK_ROOT, 'vmm/patches'), ['series', ...series]);
}

export function vmmInputs(): string {
  const files = ['build.ts', 'hypervisor.entitlements', 'src/main.rs', 'src/confinement.rs', 'src/watchdog.rs', 'sandbox/mod.rs', 'sandbox/jitk.sb', 'tests/seccomp-probe.rs'];
  const ready = existsSync(join(JITK_ROOT, 'vmm/sandbox/.READY')) ? 'sandbox_ready' : 'stub';
  return fingerprint(join(JITK_ROOT, 'vmm'), files, [vmmPatchFingerprint(), ready, pins().vmm_toolchain, platform()]);
}

export function vmmBuildDir(): string {
  return join(cacheRoot(), 'vmm', platform() + '-' + vmmInputs().slice(0, 16));
}

// Shared patched libkrun checkout and target, one per patch set.
export function libkrunDir(): string {
  return join(cacheRoot(), 'vmm', 'libkrun-' + platform() + '-' + vmmPatchFingerprint().slice(0, 16));
}

export function nodeDir(): string {
  return join(cacheRoot(), 'node', 'v' + pins().node.version + '-' + hostPlatform());
}

export function hyperlightSourceDir(): string {
  return join(cacheRoot(), 'src', 'hyperlight-js-' + pins().hyperlight_js.commit);
}

export function hyperlightInputs(): string {
  const p = pins();
  const files = ['bench/hyperlight/Cargo.toml', 'bench/hyperlight/Cargo.lock', 'bench/hyperlight/worker.rs', 'bench/hyperlight/load_linux.rs', 'bench/hyperlight/bootstrap.js', 'bench/hyperlight/build.ts', 'vmm/hypervisor.entitlements'];
  return fingerprint(JITK_ROOT, files, [p.hyperlight_js.commit, p.hyperlight_toolchain, hostPlatform()]);
}

export function hyperlightDir(): string {
  return join(cacheRoot(), 'hyperlight', hostPlatform() + '-' + hyperlightInputs().slice(0, 16));
}

export const ARTIFACTS = ['JITK_NODE', 'JITK_NPM_CLI', 'JITK_VMM_BINARY', 'HYPERLIGHT_JS_SRC', 'HYPERLIGHT_WORKER', 'HYPERLIGHT_SNAPSHOT'];

// Hyperlight's HVF baseline exists only on macOS.
export function applicable(name: string): boolean {
  return platform() === 'darwin' || !name.startsWith('HYPERLIGHT_');
}

// The cache location of one artifact (whether or not it is built yet).
export function cachePath(name: string): string {
  if (name === 'JITK_NODE') {
    return join(nodeDir(), 'bin', platform() === 'darwin' ? pins().node.darwin_signed_name : 'node');
  }
  if (name === 'JITK_NPM_CLI') {
    return join(nodeDir(), 'lib/node_modules/npm/bin/npm-cli.js');
  }
  if (name === 'JITK_VMM_BINARY') {
    return join(vmmBuildDir(), 'jitk-vmm');
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
  throw new Error('unknown jitk artifact ' + name);
}

// Completion marker of each cache entry: written last by its builder.
export function completeMarker(name: string): string {
  if (name === 'JITK_NODE' || name === 'JITK_NPM_CLI') {
    return join(nodeDir(), 'jitk-manifest.json');
  }
  if (name === 'JITK_VMM_BINARY') {
    return join(vmmBuildDir(), 'build.json');
  }
  if (name === 'HYPERLIGHT_JS_SRC') {
    return join(hyperlightSourceDir(), '.git/jitk-manifest.json');
  }
  return join(hyperlightDir(), 'manifest.json');
}

export function cached(name: string): boolean {
  return existsSync(completeMarker(name)) && existsSync(cachePath(name));
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
    check(existsSync(explicit), name + '=' + explicit + ' does not exist; unset it to use the ' + DEPS_TARGET + ' cache');
    return explicit;
  }
  const path = cachePath(name);
  check(cached(name), name + ' is unset and ' + path + ' is not built; run `' + DEPS_TARGET + '` (cache ' + cacheRoot() + ') or set ' + name);
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
