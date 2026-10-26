// Independent deadline and parent-pipe lifetime. Kill only the owned group.
const pid = Number(process.argv[2]);
const timeout = Number(process.argv[3]);
let finished = false;
function stop(deadline: boolean): void {
  if (finished) {
    return;
  }
  finished = true;
  clearTimeout(timer);
  if (deadline) {
    console.log('WATCHDOG');
  }
  try {
    process.kill(-pid, 'SIGKILL');
  } catch (error: unknown) {
    if (!(error instanceof Error) || !error.message.includes('ESRCH')) {
      throw error;
    }
  }
  process.stdin.destroy();
}
const timer = setTimeout(() => stop(true), timeout * 1000);
process.stdin.once('data', () => stop(false));
process.stdin.once('end', () => stop(false));
