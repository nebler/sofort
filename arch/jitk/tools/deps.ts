// Builds the external artifacts arch/jitk's suites need into the persistent
// cache (../tslib/deps.ts has the layout and the resolution rule) from the
// pins in deps.json:
//   JITK_NODE / JITK_NPM_CLI   nodejs.org tarball, sha256-checked; on macOS
//                              bin/node-real is ad-hoc signed with the
//                              Hypervisor entitlement and its hash checked
//   JITK_ZIG                   ziglang.org tarball, sha256-checked (the static
//                              aarch64 Linux cross-linker; ../tools/zig-cc.sh)
//   HYPERLIGHT_JS_SRC          hyperlight-js fetched by full commit
//   HYPERLIGHT_WORKER/SNAPSHOT bench/hyperlight/build.ts from that source
//   JITK_SHARD_BINARY          shard `real` (Linux) or the HVF engine `hvf`
//                              (macOS, signed) from source, pinned toolchain;
//                              it also serves `watchdog` and (macOS) `console`
// JITK_SHARD_SNAPSHOT needs KVM or HVF and is built by
// `make -C arch/jitk/shard snapshot` (shard/snapshot.ts) into the same cache.
// Every entry is built in a staging directory and renamed into place after
// its manifest is written, so a present manifest means a complete entry. An
// artifact whose environment variable is set is never built (explicit wins).
//
//   deps [build]        build what is missing, then print the manifest
//   deps node           build only the Node entry (tools/npm.sh bootstrap)
//   deps status        print the manifest without building
//   deps verify        re-check every applicable entry (hashes, pins) and print
//                      one JSON row per artifact; exit 1 when any is not ok
//   deps path NAME      print NAME's selected path; exit 1 when missing
//   deps env            print `export NAME=path` for every selected artifact
//                       that exists (sh-evaluable; set values are kept)
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { platform } from 'node:os';
import { dirname, join } from 'node:path';
import { check, detail } from '../tslib/assert.ts';
import { shaFile } from '../tslib/hash.ts';
import { readJSON, dumpJSON } from '../tslib/json.ts';
import { environment } from '../tslib/process.ts';
import { run } from '../tslib/subprocess.ts';
import { ARTIFACTS, DEPS_TARGET, JITK_ROOT, applicable, cacheRoot, cached, cachePath, completeMarker, hostPlatform, hyperlightDir, hyperlightInputs, hyperlightSourceDir, nodeDir, pins, requireArtifact, shardBinaryName, shardDir, shardInputs, target, withLock, zigDir } from '../tslib/deps.ts';
import { rustToolchain } from '../tslib/rust.ts';

const mac = platform() === 'darwin';

function log(message: string): void {
  console.error('jitk deps: ' + message);
}

function explicit(name: string): boolean {
  return Boolean(process.env[name]);
}

async function text(command: string[], env: Record<string, string>): Promise<string> {
  return (await run(command, { env, timeout: 600 })).stdout.toString().trim();
}

// Builds dir's content in a sibling staging directory, renamed into place
// only after body succeeds; a failed build leaves nothing behind.
async function staged(dir: string, body: (stage: string) => Promise<void>): Promise<void> {
  const stage = dir + '.tmp-' + String(process.pid);
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(stage, { recursive: true });
  try {
    await body(stage);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dirname(dir), { recursive: true });
    renameSync(stage, dir);
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}

// --- Node -------------------------------------------------------------------

function nodeValid(): boolean {
  if (!existsSync(completeMarker('JITK_NODE'))) {
    return false;
  }
  const manifest = readJSON<Record<string, string>>(completeMarker('JITK_NODE'));
  return existsSync(cachePath('JITK_NODE')) && existsSync(cachePath('JITK_NPM_CLI')) && shaFile(cachePath('JITK_NODE')) === manifest.node_sha256;
}

async function buildNode(env: Record<string, string>): Promise<void> {
  if (nodeValid()) {
    log('node: cached ' + nodeDir());
    return;
  }
  const p = pins().node;
  const plat = hostPlatform();
  const expected = p.tarball_sha256[plat];
  check(Boolean(expected), 'deps.json pins no Node tarball for ' + plat);
  await withLock('node-' + p.version + '-' + plat, async () => {
    if (nodeValid()) {
      return;
    }
    const dir = nodeDir();
    await staged(dir, async stage => {
      const url = p.url.split('{version}').join(p.version).split('{platform}').join(plat);
      const tarball = join(stage, 'node.tar.gz');
      // tools/npm.sh's bootstrap hands over the tarball it already fetched.
      const local = process.env.JITK_NODE_TARBALL || '';
      if (local) {
        log('node: using ' + local + ' (' + url + ')');
        copyFileSync(local, tarball);
      } else {
        log('node: fetching ' + url);
        await run(['curl', '-fsSL', '--retry', '3', '-o', tarball, url], { env, timeout: 1200 });
      }
      const got = shaFile(tarball);
      check(got === expected, 'node: ' + url + ' sha256 ' + got + ' != pinned ' + expected);
      await run(['tar', '-xzf', tarball, '-C', stage, '--strip-components', '1'], { env, timeout: 600 });
      rmSync(tarball);
      const manifest: Record<string, string> = { artifact: 'node', version: p.version, platform: plat, url, tarball_sha256: got };
      if (mac) {
        // node-real carries the Hypervisor entitlement (Hyperlight's in-process
        // checks); the signing identifier derives from this file name.
        const signed = join(stage, 'bin', p.darwin_signed_name);
        renameSync(join(stage, 'bin/node'), signed);
        symlinkSync(p.darwin_signed_name, join(stage, 'bin/node'));
        const entitlements = join(JITK_ROOT, 'tools/node.entitlements');
        await run(['/usr/bin/codesign', '--force', '--sign', '-', '--entitlements', entitlements, signed], { env, timeout: 600 });
        const hash = shaFile(signed);
        check(hash === p.darwin_signed_sha256, 'node: ad-hoc signed ' + signed + ' sha256 ' + hash + ' != pinned ' + p.darwin_signed_sha256 + ' (codesign output changed? re-pin darwin_signed_sha256 in tools/deps.json after review)');
        manifest.signed = 'codesign --force --sign - --entitlements tools/node.entitlements bin/' + p.darwin_signed_name;
        manifest.entitlements_sha256 = shaFile(entitlements);
      }
      const binary = join(stage, 'bin', mac ? p.darwin_signed_name : 'node');
      manifest.node_sha256 = shaFile(binary);
      manifest.node_version = await text([binary, '--version'], env);
      manifest.npm_cli = 'lib/node_modules/npm/bin/npm-cli.js';
      manifest.npm_version = readJSON<{ version: string }>(join(stage, 'lib/node_modules/npm/package.json')).version;
      dumpJSON(join(stage, 'jitk-manifest.json'), manifest);
    });
    log('node: built ' + dir);
  });
}

// --- zig --------------------------------------------------------------------

function zigValid(): boolean {
  if (!existsSync(completeMarker('JITK_ZIG'))) {
    return false;
  }
  const manifest = readJSON<Record<string, string>>(completeMarker('JITK_ZIG'));
  return existsSync(cachePath('JITK_ZIG')) && manifest.version === pins().zig.version && shaFile(cachePath('JITK_ZIG')) === manifest.zig_sha256;
}

async function buildZig(env: Record<string, string>): Promise<void> {
  if (zigValid()) {
    log('zig: cached ' + zigDir());
    return;
  }
  const p = pins().zig;
  const plat = hostPlatform();
  const expected = p.tarball_sha256[plat];
  check(Boolean(expected) && Boolean(p.zig_platform[plat]), 'deps.json pins no zig tarball for ' + plat + '; set JITK_ZIG to a zig ' + p.version);
  await withLock('zig-' + p.version + '-' + plat, async () => {
    if (zigValid()) {
      return;
    }
    const dir = zigDir();
    await staged(dir, async stage => {
      const url = p.url.split('{version}').join(p.version).split('{zig_platform}').join(p.zig_platform[plat]);
      const tarball = join(stage, 'zig.tar.xz');
      log('zig: fetching ' + url);
      await run(['curl', '-fsSL', '--retry', '3', '-o', tarball, url], { env, timeout: 1200 });
      const got = shaFile(tarball);
      check(got === expected, 'zig: ' + url + ' sha256 ' + got + ' != pinned ' + expected);
      await run(['tar', '-xJf', tarball, '-C', stage, '--strip-components', '1'], { env, timeout: 600 });
      rmSync(tarball);
      const binary = join(stage, 'zig');
      const version = await text([binary, 'version'], env);
      check(version === p.version, 'zig: ' + binary + ' reports ' + version + ' != pinned ' + p.version);
      dumpJSON(join(stage, 'jitk-manifest.json'), { artifact: 'zig', version: p.version, platform: plat, url, tarball_sha256: got, zig_sha256: shaFile(binary) });
    });
    log('zig: built ' + dir);
  });
}

// --- hyperlight-js source ---------------------------------------------------

async function sourceValid(env: Record<string, string>): Promise<boolean> {
  const dir = hyperlightSourceDir();
  if (!existsSync(completeMarker('HYPERLIGHT_JS_SRC'))) {
    return false;
  }
  const head = await text(['git', '-C', dir, 'rev-parse', 'HEAD'], env);
  const dirty = await text(['git', '-C', dir, 'status', '--porcelain', '--untracked-files=all'], env);
  check(dirty === '', 'hyperlight-js: cached checkout ' + dir + ' has local changes; remove it and rerun ' + DEPS_TARGET);
  return head === pins().hyperlight_js.commit;
}

async function fetchSource(env: Record<string, string>): Promise<void> {
  if (await sourceValid(env)) {
    log('hyperlight-js: cached ' + hyperlightSourceDir());
    return;
  }
  const p = pins().hyperlight_js;
  await withLock('hyperlight-js-' + p.commit, async () => {
    if (await sourceValid(env)) {
      return;
    }
    const dir = hyperlightSourceDir();
    await staged(dir, async stage => {
      log('hyperlight-js: fetching ' + p.repository + ' ' + p.commit);
      await run(['git', 'init', '-q', stage], { env });
      await run(['git', '-C', stage, 'remote', 'add', 'origin', p.repository], { env });
      await run(['git', '-C', stage, 'fetch', '-q', '--depth', '1', 'origin', p.commit], { env, timeout: 1800 });
      await run(['git', '-C', stage, '-c', 'advice.detachedHead=false', 'checkout', '-q', '--detach', 'FETCH_HEAD'], { env });
      const head = await text(['git', '-C', stage, 'rev-parse', 'HEAD'], env);
      check(head === p.commit, 'hyperlight-js: fetched ' + head + ' != pinned ' + p.commit);
      const tree = await text(['git', '-C', stage, 'rev-parse', 'HEAD^{tree}'], env);
      dumpJSON(join(stage, '.git/jitk-manifest.json'), { artifact: 'hyperlight-js', repository: p.repository, commit: head, tree });
    });
    log('hyperlight-js: fetched ' + dir);
  });
}

// --- Hyperlight worker and snapshot ----------------------------------------

function hyperlightValid(): boolean {
  const marker = completeMarker('HYPERLIGHT_WORKER');
  if (!existsSync(marker)) {
    return false;
  }
  const manifest = readJSON<Record<string, string>>(marker);
  return existsSync(cachePath('HYPERLIGHT_WORKER')) && existsSync(join(cachePath('HYPERLIGHT_SNAPSHOT'), 'index.json')) && shaFile(cachePath('HYPERLIGHT_WORKER')) === manifest.worker_sha256 && manifest.inputs_sha256 === hyperlightInputs();
}

async function buildHyperlight(env: Record<string, string>): Promise<void> {
  if (hyperlightValid()) {
    log('hyperlight: cached ' + hyperlightDir());
    return;
  }
  const builder = join(JITK_ROOT, 'bench/build/hyperlight-build');
  check(existsSync(builder), 'hyperlight: ' + builder + ' missing; run `make -C arch/jitk deps` (it compiles the builder first)');
  const p = pins();
  const tools = await rustToolchain(env, p.hyperlight_toolchain, p.hyperlight_targets, ['rust-src']);
  // One lock: the Cargo target directory is shared by every input set.
  await withLock('hyperlight-' + hostPlatform(), async () => {
    if (hyperlightValid()) {
      return;
    }
    const dir = hyperlightDir();
    await staged(dir, async stage => {
      const settings: Record<string, string> = { ...env, ...tools };
      settings.RUSTUP_TOOLCHAIN = p.hyperlight_toolchain;
      settings.HYPERLIGHT_JS_SRC = hyperlightSourceDir();
      settings.HYPERLIGHT_BUILD_DIR = join(cacheRoot(), 'hyperlight', 'build-' + hostPlatform());
      settings.HYPERLIGHT_WORKER = join(stage, 'r2-worker');
      settings.HYPERLIGHT_SNAPSHOT = join(stage, 'snapshot');
      settings.HYPERLIGHT_DESCRIPTOR = join(stage, 'adapter.json');
      settings.HYPERLIGHT_FETCH = '1';
      log('hyperlight: building into ' + dir);
      await run([builder], { env: settings, inherit: true, timeout: 7200 });
      // The descriptor names the staging paths; point it at the final entry.
      const descriptor = join(stage, 'adapter.json');
      writeFileSync(descriptor, readFileSync(descriptor, 'utf8').split(stage).join(dir));
      const index = join(stage, 'snapshot/index.json');
      const manifest: Record<string, string> = {
        artifact: 'hyperlight',
        inputs_sha256: hyperlightInputs(),
        hyperlight_js_commit: p.hyperlight_js.commit,
        toolchain: p.hyperlight_toolchain,
        rustc: await text([tools.RUSTC, '--version'], settings),
        worker_sha256: shaFile(join(stage, 'r2-worker')),
        snapshot_index_sha256: shaFile(index),
        cargo_target: settings.HYPERLIGHT_BUILD_DIR
      };
      dumpJSON(join(stage, 'manifest.json'), manifest);
    });
    log('hyperlight: built ' + dir);
  });
}

// --- shard ------------------------------------------------------------------

function shardValid(): boolean {
  const marker = completeMarker('JITK_SHARD_BINARY');
  if (!existsSync(marker)) {
    return false;
  }
  const manifest = readJSON<Record<string, string>>(marker);
  return existsSync(cachePath('JITK_SHARD_BINARY')) && shaFile(cachePath('JITK_SHARD_BINARY')) === manifest.binary_sha256 && manifest.inputs_sha256 === shardInputs();
}

// shard `real` (Linux) or `hvf` (macOS, the HVF engine) from this checkout's
// sources with the pinned toolchain; the Cargo target directory is shared by
// every input set. `hvf` is ad-hoc signed with the hypervisor entitlement
// before it is hashed.
async function buildShard(env: Record<string, string>): Promise<void> {
  if (shardValid()) {
    log('shard: cached ' + shardDir());
    return;
  }
  const pin = pins().rust_toolchain;
  const tools = await rustToolchain(env, pin, [], []);
  await withLock('shard-' + hostPlatform(), async () => {
    if (shardValid()) {
      return;
    }
    const dir = shardDir();
    await staged(dir, async stage => {
      const settings: Record<string, string> = { ...env, ...tools, RUSTUP_TOOLCHAIN: pin, CARGO_TARGET_DIR: join(cacheRoot(), 'shard', 'target-' + hostPlatform()) };
      delete settings.RUSTFLAGS;
      const cwd = join(JITK_ROOT, 'shard');
      log('shard: building ' + dir);
      // The one networked step: the locked crate sources, then offline.
      await run([tools.CARGO, 'fetch', '--locked'], { cwd, env: settings, inherit: true, timeout: 1800 });
      const name = shardBinaryName();
      await run([tools.CARGO, 'build', '--release', '--locked', '--offline', '--bin', name], { cwd, env: settings, inherit: true, timeout: 3600 });
      copyFileSync(join(settings.CARGO_TARGET_DIR, 'release', name), join(stage, name));
      chmodSync(join(stage, name), 0o755);
      if (mac) {
        await run(['/usr/bin/codesign', '--force', '--sign', '-', '--entitlements', join(JITK_ROOT, 'shard/hypervisor.entitlements'), join(stage, name)], { env, timeout: 120 });
      }
      dumpJSON(join(stage, 'manifest.json'), {
        artifact: 'shard',
        binary: name,
        inputs_sha256: shardInputs(),
        toolchain: pin,
        rustc: await text([tools.RUSTC, '--version'], settings),
        binary_sha256: shaFile(join(stage, name)),
        cargo_target: settings.CARGO_TARGET_DIR
      });
    });
    log('shard: built ' + dir);
  });
}

// --- reporting ---------------------------------------------------------------

function status(): Record<string, unknown> {
  const rows: Record<string, unknown> = {};
  for (const name of ARTIFACTS) {
    if (!applicable(name)) {
      rows[name] = { applicable: false };
      continue;
    }
    const path = process.env[name] || cachePath(name);
    const row: Record<string, unknown> = { source: explicit(name) ? 'environment' : 'cache', path, present: explicit(name) ? existsSync(path) : cached(name) };
    if (row.present && existsSync(path) && statSync(path).isFile()) {
      row.sha256 = shaFile(path);
    }
    if (!explicit(name) && existsSync(completeMarker(name))) {
      row.manifest = completeMarker(name);
    }
    rows[name] = row;
  }
  return { cache: cacheRoot(), artifacts: rows };
}

// One row per applicable artifact: ok (cache entry complete and its hashes and
// pins re-checked), environment (explicit value, present), missing (never
// built, or explicit and absent), stale (built for other inputs or damaged;
// the target rebuilds it). The doctor (doctor.ts) reads these rows.
async function verify(env: Record<string, string>): Promise<Record<string, string>[]> {
  // Entries that hold two artifacts (Node/npm, worker/snapshot) are hashed once.
  let node: boolean | undefined;
  let hyperlight: boolean | undefined;
  const checks: Record<string, () => Promise<boolean>> = {
    JITK_NODE: async () => (node ??= nodeValid()),
    JITK_NPM_CLI: async () => (node ??= nodeValid()),
    JITK_ZIG: async () => zigValid(),
    HYPERLIGHT_JS_SRC: async () => sourceValid(env).catch(() => false),
    HYPERLIGHT_WORKER: async () => (hyperlight ??= hyperlightValid()),
    HYPERLIGHT_SNAPSHOT: async () => (hyperlight ??= hyperlightValid()),
    JITK_SHARD_BINARY: async () => shardValid(),
    JITK_SHARD_SNAPSHOT: async () => cached('JITK_SHARD_SNAPSHOT')
  };
  const rows: Record<string, string>[] = [];
  for (const name of ARTIFACTS) {
    if (!applicable(name)) {
      continue;
    }
    const row: Record<string, string> = { name, target: target(name) };
    if (explicit(name)) {
      row.path = process.env[name] || '';
      row.state = existsSync(row.path) || existsSync(row.path + '.identity') ? 'environment' : 'missing';
    } else {
      row.path = cachePath(name);
      row.state = (await checks[name]()) ? 'ok' : existsSync(completeMarker(name)) ? 'stale' : 'missing';
    }
    rows.push(row);
  }
  return rows;
}

function quote(value: string): string {
  return "'" + value.split("'").join("'\\''") + "'";
}

async function build(): Promise<void> {
  const env = environment();
  mkdirSync(cacheRoot(), { recursive: true });
  if (!explicit('JITK_NODE') || !explicit('JITK_NPM_CLI')) {
    await buildNode(env);
  }
  if (!explicit('JITK_ZIG')) {
    await buildZig(env);
  }
  if (applicable('JITK_SHARD_BINARY') && !explicit('JITK_SHARD_BINARY')) {
    await buildShard(env);
  }
  if (mac && (!explicit('HYPERLIGHT_JS_SRC') || !explicit('HYPERLIGHT_WORKER') || !explicit('HYPERLIGHT_SNAPSHOT'))) {
    await fetchSource(env);
    if (!explicit('HYPERLIGHT_WORKER') || !explicit('HYPERLIGHT_SNAPSHOT')) {
      await buildHyperlight(env);
    }
  }
  for (const name of ARTIFACTS) {
    // The prepared snapshot needs KVM and has its own target.
    if (applicable(name) && target(name) === DEPS_TARGET) {
      requireArtifact(name);
    }
  }
  console.log(JSON.stringify(status(), null, 2));
}

async function main(): Promise<void> {
  const command = process.argv[2] || 'build';
  if (command === 'build') {
    await build();
  } else if (command === 'node') {
    await buildNode(environment());
  } else if (command === 'status') {
    console.log(JSON.stringify(status(), null, 2));
  } else if (command === 'verify') {
    const rows = await verify(environment());
    for (const row of rows) {
      console.log(JSON.stringify(row));
    }
    process.exitCode = rows.every(row => row.state === 'ok' || row.state === 'environment') ? 0 : 1;
  } else if (command === 'path') {
    const name = process.argv[3] || '';
    check(ARTIFACTS.includes(name), 'usage: deps path ' + ARTIFACTS.join('|'));
    console.log(requireArtifact(name));
  } else if (command === 'env') {
    for (const name of ARTIFACTS) {
      if (!applicable(name)) {
        continue;
      }
      const path = process.env[name] || (cached(name) ? cachePath(name) : '');
      if (path) {
        console.log('export ' + name + '=' + quote(path));
      }
    }
  } else {
    throw new Error('usage: deps [build|node|status|verify|path NAME|env]');
  }
}

main().catch((error: unknown) => {
  console.error('jitk deps: ' + detail(error));
  process.exitCode = 1;
});
