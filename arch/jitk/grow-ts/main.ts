import { detail } from './io.ts';
import { main } from './loop.ts';

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(detail(error));
  process.exitCode = 1;
});
