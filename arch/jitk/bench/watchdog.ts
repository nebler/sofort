import { now } from './lib.ts';
import { poll, read } from './native.ts';
import { kill } from './processes.ts';

const owned = new Map<number, number>();
let buffer = '';
try {
  while (true) {
    const current = now();
    for (const [pid, deadline] of owned) {
      if (deadline <= current) {
        kill(pid);
        owned.delete(pid);
      }
    }
    const timeout = Math.max(0, Math.min(1, Math.min(...Array.from(owned.values()), current + 1) - current));
    if (!poll(0, -1, timeout)) {
      continue;
    }
    const data = read(0);
    if (!data.length) {
      break;
    }
    buffer += data.toString();
    while (buffer.includes('\n')) {
      const end = buffer.indexOf('\n');
      const line = buffer.slice(0, end);
      buffer = buffer.slice(end + 1);
      if (line.startsWith('+')) {
        const parts = line.slice(1).split(/\s+/).map(Number);
        owned.set(parts[0], now() + parts[1]);
      } else if (line.startsWith('-')) {
        owned.delete(Number(line.slice(1)));
      }
    }
  }
} finally {
  for (const pid of owned.keys()) {
    kill(pid);
  }
}
