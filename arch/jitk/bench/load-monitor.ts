import { appendFileSync, existsSync } from 'node:fs';
import { loadavg } from 'node:os';
import { sleep } from './native.ts';
import { utc } from './lib.ts';
const output = String(process.argv[2]);
while (!existsSync(output + '.stop')) {
  appendFileSync(output, JSON.stringify({ at: utc(), load: loadavg() }) + '\n');
  sleep(0.5);
}
