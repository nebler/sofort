// Builds the external artifacts arch/jitk's suites need into the persistent
// cache (../tslib/deps.ts has the layout and the resolution rule) from the
// pins in deps.json:
//   JITK_NODE / JITK_NPM_CLI   nodejs.org tarball, sha256-checked; on macOS
//                              bin/node-real is ad-hoc signed with the
//                              Hypervisor entitlement and its hash checked
//   HYPERLIGHT_JS_SRC          hyperlight-js fetched by full commit
//   JITK_VMM_BINARY            vmm/build.ts (the canonical VMM builder)
//   HYPERLIGHT_WORKER/SNAPSHOT bench/hyperlight/build.ts from that source
// Every entry is built in a staging directory and renamed into place after
// its manifest is written, so a present manifest means a complete entry. An
// artifact whose environment variable is set is never built (explicit wins).
//
//   deps [build]        build what is missing, then print the manifest
//   deps status         print the manifest without building
//   deps path NAME      print NAME's selected path; exit 1 when missing
//   deps env            print `export NAME=path` for every selected artifact
//                       that exists (sh-evaluable; set values are kept)
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { platform } from 'node:os';
import { dirname, join } from 'node:path';
import { check, detail } from '../tslib/assert.ts';
import { shaFile } from '../tslib/hash.ts';
import { readJSON, dumpJSON } from '../tslib/json.ts';
import { environment } from '../tslib/process.ts';
import { capture, run } from '../tslib/subprocess.ts';
import { ARTIFACTS, DEPS_TARGET, JITK_ROOT, applicable, cacheRoot, cached, cachePath, completeMarker, hostPlatform, hyperlightDir, hyperlightInputs, hyperlightSourceDir, nodeDir, pins, requireArtifact, withLock } from '../tslib/deps.ts';

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
      log('node: fetching ' + url);
      await run(['curl', '-fsSL', '--retry', '3', '-o', tarball, url], { env, timeout: 1200 });
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

// --- VMM --------------------------------------------------------------------

async function buildVmm(env: Record<string, string>): Promise<void> {
  const builder = join(JITK_ROOT, 'vmm/.work/bin/build');
  check(existsSync(builder), 'vmm: ' + builder + ' missing; run `make -C arch/jitk deps` (it compiles the VMM builder first)');
  const settings: Record<string, string> = { ...env };
  // The cache entry, never a caller's JITK_VMM_BUILD: JITK_VMM_BINARY's default
  // must be what this step built.
  delete settings.JITK_VMM_BUILD;
  delete settings.JITK_VMM_LIBKRUN;
  await run([builder], { env: settings, inherit: true, timeout: 7200 });
  check(cached('JITK_VMM_BINARY'), 'vmm: builder finished without ' + completeMarker('JITK_VMM_BINARY'));
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

async function toolchain(env: Record<string, string>, name: string, targets: string[]): Promise<Record<string, string>> {
  const install = 'rustup toolchain install ' + name + ' --profile minimal --component rust-src' + targets.map(t => ' --target ' + t).join('');
  const listed = await capture(['rustup', 'component', 'list', '--installed', '--toolchain', name], { env, timeout: 120 });
  check(listed.returncode === 0, 'Rust toolchain ' + name + ' is not installed; prerequisite: `' + install + '`');
  const components = listed.stdout.toString().split('\n');
  for (const needed of ['rust-src', ...targets.map(t => 'rust-std-' + t)]) {
    check(components.some(line => line.trim() === needed || line.trim().startsWith(needed + '-')), 'Rust toolchain ' + name + ' lacks ' + needed + '; prerequisite: `' + install + '`');
  }
  const cargo = await text(['rustup', 'which', '--toolchain', name, 'cargo'], env);
  const rustc = await text(['rustup', 'which', '--toolchain', name, 'rustc'], env);
  return { CARGO: cargo, RUSTC: rustc };
}

async function buildHyperlight(env: Record<string, string>): Promise<void> {
  if (hyperlightValid()) {
    log('hyperlight: cached ' + hyperlightDir());
    return;
  }
  const builder = join(JITK_ROOT, 'bench/build/hyperlight-build');
  check(existsSync(builder), 'hyperlight: ' + builder + ' missing; run `make -C arch/jitk deps` (it compiles the builder first)');
  const p = pins();
  const tools = await toolchain(env, p.hyperlight_toolchain, p.hyperlight_targets);
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
    if (row.present && statSync(path).isFile()) {
      row.sha256 = shaFile(path);
    }
    if (!explicit(name) && existsSync(completeMarker(name))) {
      row.manifest = completeMarker(name);
    }
    rows[name] = row;
  }
  return { cache: cacheRoot(), artifacts: rows };
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
  if (!explicit('JITK_VMM_BINARY')) {
    await buildVmm(env);
  }
  if (mac && (!explicit('HYPERLIGHT_JS_SRC') || !explicit('HYPERLIGHT_WORKER') || !explicit('HYPERLIGHT_SNAPSHOT'))) {
    await fetchSource(env);
    if (!explicit('HYPERLIGHT_WORKER') || !explicit('HYPERLIGHT_SNAPSHOT')) {
      await buildHyperlight(env);
    }
  }
  for (const name of ARTIFACTS) {
    if (applicable(name)) {
      requireArtifact(name);
    }
  }
  console.log(JSON.stringify(status(), null, 2));
}

async function main(): Promise<void> {
  const command = process.argv[2] || 'build';
  if (command === 'build') {
    await build();
  } else if (command === 'status') {
    console.log(JSON.stringify(status(), null, 2));
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
    throw new Error('usage: deps [build|status|path NAME|env]');
  }
}

main().catch((error: unknown) => {
  console.error('jitk deps: ' + detail(error));
  process.exitCode = 1;
});
