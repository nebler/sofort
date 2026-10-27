import { detail } from '../../tslib/assert.ts';
import { analyze } from './analyze.ts';
import { ledger } from './ledger.ts';

async function main(): Promise<void> {
  const name = process.argv[2];
  const args = process.argv.slice(3);
  if (name === 'ledger') {
    await ledger(args);
  } else if (name === 'analyze') {
    analyze(args);
  } else {
    throw new Error('usage: linux-memory ledger PLAN OUT WORKDIR [FAMILIES] | analyze CELLS.jsonl [SUMMARY.json]');
  }
}
main().catch((error: unknown) => {
  console.error(detail(error));
  process.exitCode = 1;
});
