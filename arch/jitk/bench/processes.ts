import { execFileSync } from 'node:child_process';
import { sleep } from './native.ts';

export function descendants(pid: number): Set<number> {
  const text = execFileSync('/bin/ps', ['-axo', 'pid=,ppid='], { encoding: 'utf8', timeout: 5000 });
  const edges = text.trim().split('\n').map(line => line.trim().split(/\s+/).map(Number));
  const owned = new Set<number>([pid]);
  let more = true;
  while (more) {
    more = false;
    for (const edge of edges) {
      if (owned.has(edge[1]) && !owned.has(edge[0])) {
        owned.add(edge[0]);
        more = true;
      }
    }
  }
  owned.delete(pid);
  return owned;
}
export function killDescendants(pid: number): void {
  const children = descendants(pid);
  for (const child of children) {
    try {
      process.kill(child, 'SIGKILL');
    } catch {
      // A descendant may already have exited or be protected.
    }
  }
  if (children.size) {
    sleep(0.2);
  }
}
export function kill(pid: number): void {
  killDescendants(pid);
  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // Only explicitly owned PIDs are ever signalled.
    }
  }
}
