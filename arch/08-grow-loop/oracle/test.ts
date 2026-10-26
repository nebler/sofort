import { isDeepStrictEqual } from 'node:util';
import { check } from './lib.ts';
import { normalize } from './normalize.ts';

function rejects(raw: string, requireExit = false): void {
  let rejected = false;
  try {
    normalize(raw, requireExit);
  } catch {
    rejected = true;
  }
  check(rejected, 'invalid trace accepted');
}

const heap = '1 brk(NULL) = 0x10000\n1 brk(0x12000) = 0x12000';
check(!isDeepStrictEqual(normalize(heap), normalize(heap.replaceAll('0x12000', '0x13000'))));
check(isDeepStrictEqual(normalize(heap), normalize(heap.replaceAll('0x10000', '0x20000').replaceAll('0x12000', '0x22000'))));
const mapping = normalize('1 mmap(NULL, 8192, 3, 34, -1, 0) = 0x10000\n1 munmap(0x11000, 4096) = 0');
check(mapping[1].args[0] === 'M0+4096');
for (const raw of ['1 read(3, "x"..., 200) = 100', '1 clone(0) = 2', '1 --- SIGSEGV ---', '1 read(3, <unfinished ...>']) {
  rejects(raw);
}
rejects('1 read(0, "", 1) = 0', true);
check(normalize('1 writev(1, [{iov_base="\\x00\\xff", iov_len=2}], 1) = 2')[0].args[1].includes('\\xff'));
const ioctl = '1 ioctl(1, 0x5413, 0x10000) = -1 ENOTTY (Not a tty)';
check(!isDeepStrictEqual(normalize(ioctl), normalize(ioctl.replace('ENOTTY', 'ENOSYS'))));
console.log('4 tests passed (same normalizer cases as test_normalize.py)');
