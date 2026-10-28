// Prepared helper snapshots for the KVM shard, built into the jitk cache
// (`make -C arch/jitk/shard snapshot`; Linux arm64 with /dev/kvm). Run by the
// pinned Node (type stripping) so the helper composition is the executor's
// own module, ../executor/prepared-helpers.mjs.
//
// One snapshot per arena class (glue-2m is the executor's default; glue-4m is
// there for the class-coverage KVM tests). Each is the ring kernel with the
// executor helpers spliced in before the QuickJS checkpoint, built with the
// pinned toolchain and prepared by the shard binary (JITK_SHARD_BINARY, from
// `make -C arch/jitk deps`). Layout and keys: ../tslib/deps.ts (snapshotKey,
// snapshotIndex). An entry that exists and verifies (identity, file hashes,
// kernel image hash) is reused; anything else is rebuilt in a staging
// directory and renamed into place.
//
//   snapshot.ts [build]   build or verify every class, then print `env`
//   snapshot.ts env       print `export NAME=base` for JITK_SHARD_SNAPSHOT,
//                         JITK_SHARD_TEST_SNAPSHOT and JITK_SHARD_TEST_SNAPSHOTS
//                         (set values are kept)
import { chmodSync, copyFileSync, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { check, detail } from '../tslib/assert.ts';
import { shaFile } from '../tslib/hash.ts';
import { dumpJSON, readJSON } from '../tslib/json.ts';
import { environment } from '../tslib/process.ts';
import { run } from '../tslib/subprocess.ts';
import { JITK_ROOT, SNAPSHOT_CLASSES, SNAPSHOT_TARGET, hostPlatform, pins, requireArtifact, snapshotBase, snapshotIndex, snapshotInputs, snapshotKey, snapshotRoot, withLock } from '../tslib/deps.ts';
import { rustToolchain } from '../tslib/rust.ts';
import { bootstrapSource, helperHash, helperSource, verifyPreparedSnapshot } from '../executor/prepared-helpers.mjs';

const KERNEL = join(JITK_ROOT, 'kernel');
// Ring arena GPA; the same value as kernel/build-ring.sh and shard ARENA_OFFSET.
const ARENA = '0x81800000';

function log(message: string): void {
  console.error('jitk snapshot: ' + message);
}

function script(): string {
  const checkpoint = 'const repair=os.snapshotCheckpoint();';
  check(bootstrapSource.split(checkpoint).length === 2, 'expected one QuickJS checkpoint in kernel/ring-bootstrap.js');
  return bootstrapSource.replace(checkpoint, helperSource + '\n' + checkpoint);
}

// Builds the ring kernel image for cls into out and returns its sha256.
async function kernelImage(cls: string, out: string, env: Record<string, string>): Promise<string> {
  const pin = pins().rust_toolchain;
  const tools = await rustToolchain(env, pin, ['aarch64-unknown-none'], []);
  // build.rs runs the kernel's prepare/build-args tools; build them natively.
  await run(['make', '-s', '-C', KERNEL, '.work/bin/prepare', '.work/bin/build-args'], { env, inherit: true, timeout: 1800 });
  const settings: Record<string, string> = { ...env, ...tools, RUSTUP_TOOLCHAIN: pin };
  // This profile is the glue JS one: ambient native argv, resources or flags
  // must not change it.
  for (const name of ['JITK_ARGV_JSON', 'JITK_RESOURCES', 'JITK_ELF', 'JITK_RING_NATIVE', 'RUSTFLAGS', 'CARGO_ENCODED_RUSTFLAGS']) {
    delete settings[name];
  }
  settings.JITK_SCRIPT = script();
  settings.JITK_TOOLS_DIR = join(KERNEL, '.work/bin');
  settings.CARGO_TARGET_DIR = join(snapshotRoot(), 'kernel-target-' + hostPlatform() + '-' + cls);
  settings.RUSTFLAGS = (cls === 'glue-4m' ? '--cfg ring_glue_4m ' : '') + '-C link-arg=--defsym=__ring_arena=' + ARENA;
  check(SNAPSHOT_CLASSES.includes(cls), 'unsupported ring memory class ' + cls);
  await run([tools.CARGO, 'build', '--locked', '--offline', '--release', '--target', 'aarch64-unknown-none', '--features', 'transport-ring'], { cwd: KERNEL, env: settings, inherit: true, timeout: 3600 });
  await run([env.OBJCOPY || 'llvm-objcopy', '-O', 'binary', join(settings.CARGO_TARGET_DIR, 'aarch64-unknown-none/release/jitk-02'), out], { env, timeout: 600 });
  return shaFile(out);
}

function verified(dir: string): boolean {
  const manifest = join(dir, 'manifest.json');
  if (!existsSync(manifest)) {
    return false;
  }
  try {
    const recorded = readJSON<Record<string, string>>(manifest);
    const base = join(dir, 'helpers');
    verifyPreparedSnapshot(base);
    const identity = readJSON<Record<string, string>>(base + '.identity');
    return identity.kernelSha256 === recorded.kernel_sha256 && shaFile(base + '.bin') === recorded.kernel_sha256;
  } catch (error) {
    log(dir + ': ' + detail(error));
    return false;
  }
}

async function prepare(dir: string, image: string, cls: string, kernel: string, shard: string, env: Record<string, string>): Promise<void> {
  const stage = dir + '.tmp-' + String(process.pid);
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(stage, { recursive: true });
  try {
    const base = join(stage, 'helpers');
    copyFileSync(image, base + '.bin');
    writeFileSync(base + '.bootstrap.js', script());
    log(cls + ': preparing ' + dir);
    await run([shard, 'prepare', base + '.bin', base], { env, inherit: true, timeout: 600 });
    const files: Record<string, string> = {};
    for (const ext of ['mem', 'regs', 'layout']) {
      files[ext] = shaFile(base + '.' + ext);
    }
    const identity = { version: 1, helperSha256: helperHash, kernelSha256: kernel, files };
    writeFileSync(base + '.identity', JSON.stringify(identity, null, 2) + '\n', { flag: 'wx' });
    chmodSync(base + '.identity', 0o444);
    dumpJSON(join(stage, 'manifest.json'), {
      artifact: 'shard-snapshot',
      class: cls,
      kernel_sha256: kernel,
      helper_sha256: helperHash,
      inputs_sha256: snapshotInputs(cls),
      toolchain: pins().rust_toolchain,
      shard_binary_sha256: shaFile(shard),
      files
    });
    rmSync(dir, { recursive: true, force: true });
    renameSync(stage, dir);
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}

async function buildClass(cls: string, shard: string, env: Record<string, string>): Promise<void> {
  const index = snapshotIndex(cls);
  if (existsSync(index) && verified(dirname(snapshotBase(cls)))) {
    log(cls + ': cached ' + dirname(snapshotBase(cls)));
    return;
  }
  await withLock('shard-snapshot-' + hostPlatform() + '-' + cls, async () => {
    const image = join(snapshotRoot(), 'kernel-' + cls + '.tmp-' + String(process.pid) + '.bin');
    mkdirSync(snapshotRoot(), { recursive: true });
    try {
      const kernel = await kernelImage(cls, image, env);
      const key = snapshotKey(cls, kernel, helperHash);
      const dir = join(snapshotRoot(), key);
      if (verified(dir)) {
        log(cls + ': reusing ' + dir);
      } else {
        await prepare(dir, image, cls, kernel, shard, env);
      }
      check(verified(dir), cls + ': ' + dir + ' does not verify after preparation');
      mkdirSync(dirname(index), { recursive: true });
      const staging = index + '.tmp-' + String(process.pid);
      dumpJSON(staging, { class: cls, key, kernel_sha256: kernel, helper_sha256: helperHash });
      renameSync(staging, index);
    } finally {
      rmSync(image, { force: true });
    }
  });
}

function base(cls: string): string {
  const path = snapshotBase(cls);
  check(existsSync(path + '.identity'), 'shard snapshot ' + cls + ' is not built (' + path + '); run `' + SNAPSHOT_TARGET + '`');
  return path;
}

function quote(value: string): string {
  return "'" + value.split("'").join("'\\''") + "'";
}

function printEnv(): void {
  const helpers = process.env.JITK_SHARD_SNAPSHOT || base('glue-2m');
  const values: Record<string, string> = {
    JITK_SHARD_SNAPSHOT: helpers,
    JITK_SHARD_TEST_SNAPSHOT: process.env.JITK_SHARD_TEST_SNAPSHOT || helpers,
    JITK_SHARD_TEST_SNAPSHOTS: process.env.JITK_SHARD_TEST_SNAPSHOTS || SNAPSHOT_CLASSES.map(base).join(':')
  };
  for (const name of Object.keys(values)) {
    console.log('export ' + name + '=' + quote(values[name]));
  }
}

async function main(): Promise<void> {
  const command = process.argv[2] || 'build';
  if (command === 'build') {
    check(process.platform === 'linux', 'shard snapshots need Linux arm64 with /dev/kvm');
    const env = environment();
    const shard = requireArtifact('JITK_SHARD_BINARY');
    for (const cls of SNAPSHOT_CLASSES) {
      await buildClass(cls, shard, env);
    }
    printEnv();
  } else if (command === 'env') {
    printEnv();
  } else {
    throw new Error('usage: snapshot.ts [build|env]');
  }
}

main().catch((error: unknown) => {
  console.error('jitk snapshot: ' + detail(error));
  process.exitCode = 1;
});
