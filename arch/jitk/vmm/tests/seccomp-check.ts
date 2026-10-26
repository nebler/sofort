import { capture, check } from '../lib.ts';
const result = await capture(['/work/seccomp-probe', '/work/images/parking.bin'], { timeout: 30 });
console.log('SECCOMP-PROBE ' + result.returncode + ' ' + result.stderr.toString());
check(result.returncode === -31 && result.stderr.toString().includes('SECCOMP-PROBE-CONFINED'));
console.log('SECCOMP-PASS');
