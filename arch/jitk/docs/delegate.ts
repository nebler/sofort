import { delegate } from './dispatch.ts';

try {
  if (process.argv.length !== 4) {
    throw new Error('usage: delegate SUBTREE ACTION');
  }
  process.exitCode = await delegate(process.argv[2], process.argv[3]);
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
