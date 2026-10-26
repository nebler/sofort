import { accessSync, chmodSync, constants, copyFileSync, existsSync, lstatSync, mkdirSync, realpathSync, statSync, symlinkSync, unlinkSync, utimesSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { capture, check, detail, dump, readJSON } from '../lib.ts';

// Resolve existing parents too, matching Path.resolve for fresh output paths.
function canonical(path: string): string {
  const absolute = resolve(path);
  if (existsSync(absolute)) {
    return realpathSync(absolute);
  }
  const parent = dirname(absolute);
  return parent === absolute ? absolute : join(canonical(parent), basename(absolute));
}

function copy(source: string, destination: string): void {
  copyFileSync(source, destination);
  const stat = statSync(source);
  chmodSync(destination, stat.mode);
  utimesSync(destination, stat.atime, stat.mtime);
}

async function command(argv: string[], env: Record<string, string>, timeout = 1800): Promise<void> {
  const result = await capture(argv, { env, timeout });
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  check(!result.timedOut && result.status === 0, argv.join(' ') + ': ' + (result.timedOut ? 'timeout' : 'exit ' + result.status));
}

async function main(): Promise<void> {
  const root = import.meta.dirname;
  check(Boolean(process.env.HYPERLIGHT_JS_SRC), 'Set HYPERLIGHT_JS_SRC to the pinned Hyperlight JS checkout (see README.md)');
  const src = canonical(String(process.env.HYPERLIGHT_JS_SRC));
  check(existsSync(join(src, 'src/hyperlight-js/Cargo.toml')), 'HYPERLIGHT_JS_SRC must contain src/hyperlight-js/Cargo.toml');
  const env: Record<string, string> = {};
  for (const key of Object.keys(process.env)) {
    const value = process.env[key];
    if (value !== undefined) {
      env[key] = value;
    }
  }
  for (const name of ['CARGO', 'RUSTC']) {
    const tool = env[name] || '';
    check(isAbsolute(tool), 'Set ' + name + ' to a verified absolute executable');
    accessSync(tool, constants.X_OK);
  }
  const build = canonical(env.HYPERLIGHT_BUILD_DIR || join(root, 'build'));
  const crate = join(build, 'crate');
  mkdirSync(crate, { recursive: true });
  for (const name of ['Cargo.toml', 'Cargo.lock', 'worker.rs', 'load_linux.rs', 'bootstrap.js']) {
    copy(join(root, name), join(crate, name));
  }
  const link = join(crate, 'hyperlight-js');
  // lstat also finds dangling symlinks; an existing real directory must fail.
  try {
    if (lstatSync(link).isSymbolicLink()) {
      unlinkSync(link);
    }
  } catch (error) {
    if ((error as { code?: string }).code !== 'ENOENT') {
      throw error;
    }
  }
  symlinkSync(src, link, 'dir');
  const worker = canonical(env.HYPERLIGHT_WORKER || join(build, 'target/release/r2-worker'));
  const snapshot = canonical(env.HYPERLIGHT_SNAPSHOT || join(build, 'snapshot'));
  env.CARGO_TARGET_DIR = join(build, 'target');
  await command([env.CARGO, 'build', '--offline', '--locked', '--release', '--manifest-path', join(crate, 'Cargo.toml')], env);
  const built = join(build, 'target/release/r2-worker');
  if (worker !== built) {
    mkdirSync(dirname(worker), { recursive: true });
    copy(built, worker);
  }
  await command(['/usr/bin/codesign', '--force', '--sign', '-', '--entitlements', join(root, '../../vmm/hypervisor.entitlements'), worker], env);
  mkdirSync(dirname(snapshot), { recursive: true });
  check(!existsSync(snapshot), 'Snapshot output already exists; choose a fresh HYPERLIGHT_SNAPSHOT');
  await command([worker, 'save', snapshot], env, 30);
  const descriptor = readJSON<Record<string, unknown>>(join(root, 'adapter.json'));
  descriptor.strict_argv = [worker, 'strict', snapshot];
  descriptor.clone_argv = [worker, 'clone', snapshot];
  descriptor.files = ['worker.rs', 'bootstrap.js', 'Cargo.lock'].map(name => join(root, name)).concat([worker, join(snapshot, 'index.json')]);
  dump(join(root, 'adapter.json'), descriptor);
}

main().catch((error: unknown) => {
  console.error(detail(error));
  process.exitCode = 1;
});
