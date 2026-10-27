import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

// Regular files below root in sorted walk order; symlinks are skipped.
export function files(root: string): string[] {
  const result: string[] = [];
  for (const name of readdirSync(root).sort()) {
    const path = join(root, name);
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) {
      continue;
    }
    if (stat.isDirectory()) {
      result.push(...files(path));
    } else if (stat.isFile()) {
      result.push(path);
    }
  }
  return result;
}

// Adds owner rwx to every entry below root (not following symlinks), so a
// tree with 0555 directories or 0444 files can be removed.
export function writable(root: string): void {
  if (!existsSync(root) || lstatSync(root).isSymbolicLink()) {
    return;
  }
  const stat = lstatSync(root);
  chmodSync(root, stat.mode | 0o700);
  if (stat.isDirectory()) {
    for (const name of readdirSync(root)) {
      writable(join(root, name));
    }
  }
}

// Removes a tree whose directories may be read-only (0555 profile resource
// directories): every directory becomes 0700 first.
export function removeTree(path: string): void {
  if (existsSync(path) && lstatSync(path).isDirectory()) {
    chmodSync(path, 0o700);
    for (const name of readdirSync(path)) {
      const child = join(path, name);
      if (!lstatSync(child).isSymbolicLink() && lstatSync(child).isDirectory()) {
        removeTree(child);
      }
    }
  }
  rmSync(path, { recursive: true, force: true });
}

// A canonical scratch directory: $variable when set (kept), otherwise a fresh
// jitk-<name>- temporary directory removed at exit.
export function workspace(variable: string, name: string): string {
  const override = process.env[variable];
  const requested = override ? resolve(override) : mkdtempSync(join(tmpdir(), 'jitk-' + name + '-'));
  mkdirSync(requested, { recursive: true });
  const root = realpathSync(requested);
  const cleanup = (): void => {
    if (existsSync(root)) {
      writable(root);
      if (!override) {
        rmSync(root, { recursive: true, force: true });
      }
    }
  };
  process.on('exit', cleanup);
  process.on('SIGTERM', () => process.exit(143));
  process.on('SIGINT', () => process.exit(130));
  return root;
}

// Copies regular files and directories (modes kept), skipping symlinks and
// any entry whose name is in ignored.
export function copyTree(source: string, target: string, ignored: Set<string>): void {
  mkdirSync(target, { recursive: true });
  for (const name of readdirSync(source)) {
    if (ignored.has(name)) {
      continue;
    }
    const from = join(source, name);
    const to = join(target, name);
    const stat = lstatSync(from);
    if (stat.isDirectory()) {
      copyTree(from, to, ignored);
    } else if (!stat.isSymbolicLink()) {
      writeFileSync(to, readFileSync(from));
      chmodSync(to, stat.mode);
    }
  }
}

// pathlib.Path.resolve semantics also resolve symlinks in existing parents.
export function canonical(path: string): string {
  const absolute = resolve(path);
  if (existsSync(absolute)) {
    return realpathSync(absolute);
  }
  const parent = dirname(absolute);
  return parent === absolute
    ? absolute
    : resolve(canonical(parent), basename(absolute));
}
