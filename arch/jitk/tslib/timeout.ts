// timeout SECONDS COMMAND [ARGS...]: run COMMAND with inherited stdio in its
// own process group; at the deadline kill the group and exit 124 (coreutils
// convention). Otherwise exit with COMMAND's status, 128+n for signal n.
import { constants } from 'node:os';
import { spawnCapture, startDirect } from './process.ts';

const seconds = Number(process.argv[2]);
const command = process.argv.slice(3);
if (!(seconds > 0) || command.length === 0) {
  console.error('usage: timeout SECONDS COMMAND [ARGS...]');
  process.exit(125);
}
const exit = await spawnCapture(command, { stdio: 'inherit', timeout: seconds }, startDirect);
if (exit.timedOut) {
  console.error('timeout: ' + command.join(' ') + ': killed after ' + seconds + ' s');
  process.exit(124);
}
const signals = constants.signals as Record<string, number>;
process.exit(exit.code ?? 128 + (signals[exit.signal || 'SIGKILL'] || 9));
