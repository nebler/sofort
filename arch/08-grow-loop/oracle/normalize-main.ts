import { readFileSync } from 'node:fs';
import { normalize } from './normalize.ts';

for (const event of normalize(readFileSync(process.argv[2], 'utf8'))) {
  console.log(JSON.stringify(event));
}
