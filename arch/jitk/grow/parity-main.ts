import { resolve } from 'node:path';
import { check, detail, run } from './lib.ts';
import { compareReceipts } from './parity.ts';
async function main(argv: string[]): Promise<void> {
  check(argv.length === 3, 'parity PYTHON_RUN NATIVE_RUN OUTPUT_JSON');
  const repo = (await run(['git', 'rev-parse', '--show-toplevel'])).stdout.toString().trim();
  check(compareReceipts(resolve(argv[0]), resolve(argv[1]), resolve(argv[2]), repo), 'receipt parity failed');
}
main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(detail(error));
  process.exitCode = 1;
});
