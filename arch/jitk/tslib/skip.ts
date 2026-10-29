// A check that cannot run here: allowed only when NAME is listed in
// JITK_ALLOW_SKIP (comma- or space-separated), so an unexpected skip fails
// the suite instead of passing silently. Prints the reason and returns when
// allowed; throws otherwise. The shell twin is ../tools/skip.sh.
export function allowedSkips(): string[] {
  return (process.env.JITK_ALLOW_SKIP || '').split(/[\s,]+/).filter(name => name !== '');
}

export function skipOrFail(name: string, reason: string): void {
  if (!allowedSkips().includes(name)) {
    throw new Error('FAIL ' + name + ' skipped: ' + reason + '; set JITK_ALLOW_SKIP=' + name + ' to allow it');
  }
  console.log('SKIP ' + name + ': ' + reason + ' (allowed by JITK_ALLOW_SKIP)');
}
