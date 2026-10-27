import { check } from './lib.ts';

// Shared-tree oracle traces: the launcher prelude (open, chroot, chdir, privilege
// drop) ends with the payload's execveat. It is split off so the trace describes
// the payload alone; no successful execveat is a launcher failure, never a
// payload result.
export function splitLauncher(text: string): { launcher: string; payload: string } {
  const lines = text.split('\n');
  const at = lines.findIndex((line) => /^\s*(?:\d+\s+)?execveat\(.*\)\s+=\s+0\s*$/.test(line));
  check(at >= 0, 'shared-tree launcher did not execute the payload');
  return { launcher: lines.slice(0, at + 1).join('\n') + '\n', payload: lines.slice(at + 1).join('\n') };
}
