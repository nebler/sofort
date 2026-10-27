// Filesystem-write profile of one Linux strace (census driver format: -f -qq -v
// -s 4096, symbolic flags). Used by `census writes` to size a writable scratch
// tree for jitk; it measures, it does not grade.
export interface WriteProfile {
  // Successful calls, by syscall name (openat counted only with O_CREAT).
  calls: Record<string, number>;
  // Failed calls of the same set, by name:errno.
  errors: Record<string, number>;
  dirs: number; files: number; removed: number; renamed: number;
  // Paths of created/removed/renamed entries, by location class.
  where: { cwd: number; tmp: number; other: number };
  // Bytes written through descriptors returned by openat (files, not stdio/pipes).
  bytes: number;
  // Most file descriptors from openat open at the same time.
  peakOpen: number;
  // Other filesystem calls the run issued (any result), by name.
  related: Record<string, number>;
}
export const MUTATING = ['mkdirat', 'unlinkat', 'renameat', 'renameat2', 'linkat', 'symlinkat', 'ftruncate', 'truncate', 'fallocate', 'fchmod', 'fchmodat', 'fchown', 'fchownat', 'utimensat', 'pwrite64', 'pwritev', 'pwritev2'];
export const RELATED = ['openat', 'newfstatat', 'fstat', 'statx', 'faccessat', 'faccessat2', 'getdents64', 'readlinkat', 'getcwd', 'chdir', 'fchdir', 'statfs', 'fstatfs', 'fsync', 'fdatasync', 'flock', 'lseek', 'fcntl'];

function place(path: string, cwd: string): 'cwd' | 'tmp' | 'other' {
  if (!path.startsWith('/') || path === cwd || path.startsWith(cwd + '/')) return 'cwd';
  return path === '/tmp' || path.startsWith('/tmp/') ? 'tmp' : 'other';
}
function bump(map: Record<string, number>, key: string, by = 1): void { map[key] = (map[key] || 0) + by; }

export function writeProfile(text: string, cwd: string): WriteProfile {
  const p: WriteProfile = { calls: {}, errors: {}, dirs: 0, files: 0, removed: 0, renamed: 0, where: { cwd: 0, tmp: 0, other: 0 }, bytes: 0, peakOpen: 0, related: {} };
  const open = new Set<string>();
  for (const line of text.split('\n')) {
    const m = /^\s*(?:(\d+)\s+)?([a-z_0-9]+)\((.*)\)\s+=\s+(-?\d+|0x[\da-f]+|\?)(?:\s+(E[A-Z0-9]+))?/.exec(line);
    if (!m) continue;
    const pid = m[1] || '0', name = m[2], args = m[3], ret = m[4], errno = m[5];
    const ok = !errno && ret !== '?' && !ret.startsWith('-');
    const paths = Array.from(args.matchAll(/"((?:[^"\\]|\\.)*)"/g)).map((x) => x[1]);
    if (RELATED.includes(name)) bump(p.related, name);
    const create = name === 'openat' && /\bO_CREAT\b/.test(args);
    if (!MUTATING.includes(name) && !create) {
      if (name === 'openat' && ok) { open.add(pid + ':' + ret); p.peakOpen = Math.max(p.peakOpen, open.size); }
      if (name === 'close') open.delete(pid + ':' + args.trim());
      if ((name === 'write' || name === 'writev') && ok && open.has(pid + ':' + args.split(',')[0].trim())) p.bytes += Number(ret);
      continue;
    }
    if (!ok) { bump(p.errors, name + ':' + (errno || ret)); continue; }
    bump(p.calls, create ? 'openat(O_CREAT)' : name);
    if (create) { open.add(pid + ':' + ret); p.peakOpen = Math.max(p.peakOpen, open.size); p.files += 1; }
    if (name === 'mkdirat') p.dirs += 1;
    if (name === 'unlinkat') p.removed += 1;
    if (name === 'renameat' || name === 'renameat2') p.renamed += 1;
    if (name === 'pwrite64' || name === 'pwritev' || name === 'pwritev2') p.bytes += Number(ret);
    if (paths.length) p.where[place(paths[0], cwd)] += 1;
  }
  return p;
}
