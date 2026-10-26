import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pack, archive } from '../packer.ts';
import { check } from '../lib.ts';

function elf(second = 0x401000, flags = 6): Buffer {
  const bytes = Buffer.alloc(8192);
  Buffer.from([127, 69, 76, 70, 2, 1, 1]).copy(bytes);
  bytes.writeUInt16LE(2, 16);
  bytes.writeUInt16LE(183, 18);
  bytes.writeUInt32LE(1, 20);
  bytes.writeBigUInt64LE(0x400100n, 24);
  bytes.writeBigUInt64LE(64n, 32);
  bytes.writeUInt16LE(64, 52);
  bytes.writeUInt16LE(56, 54);
  bytes.writeUInt16LE(2, 56);
  function segment(at: number, f: number, offset: number, va: number, fs: number, ms: number): void {
    bytes.writeUInt32LE(1, at);
    bytes.writeUInt32LE(f, at + 4);
    for (const [index, value] of [offset, va, 0, fs, ms, 1].entries()) {
      bytes.writeBigUInt64LE(BigInt(value), at + 8 + index * 8);
    }
  }
  segment(64, 5, 0, 0x400000, 512, 512);
  segment(120, flags, 4096, second, 32, 64);
  bytes.fill(88, 4096, 4128);
  return bytes;
}
function rejects(bytes: Buffer, message: string): void {
  let rejected = false;
  try {
    pack(bytes);
  } catch (error: unknown) {
    check(error instanceof Error && error.message.includes(message));
    rejected = true;
  }
  check(rejected);
}
rejects(elf(0x400800), 'share a page');
rejects(elf(0x401000, 7), 'W+X');
const normal = pack(elf());
check(normal.flat.subarray(4096, 4128).equals(Buffer.alloc(32, 88)));
check(normal.flat.subarray(4128, 4160).equals(Buffer.alloc(32)));
check(normal.meta.phdr === 0x400040);
const noHeader = elf();
noHeader.writeBigUInt64LE(256n, 72);
rejects(noHeader, 'header table');
const real = pack(readFileSync(resolve(import.meta.dirname, '../payload/qjs')));
check(real.flat.length > 2000000 && real.meta.physical_base === '0x80080000');
const temporary = mkdtempSync(join(tmpdir(), 'jitk-packer-'));
try {
  mkdirSync(join(temporary, 'b/c'), { recursive: true });
  writeFileSync(join(temporary, 'a.txt'), 'hi');
  writeFileSync(join(temporary, 'b/c/z'), '');
  const fs = archive(temporary);
  check(fs.count === 5 && fs.bytes.subarray(0, 8).toString() === 'JITKFS01');
  const row = (i: number): number[] => Array.from({ length: 6 }, (_, k) => fs.bytes.readUInt32LE(16 + i * 24 + k * 4));
  const name = (i: number): string => fs.bytes.subarray(row(i)[0], row(i)[0] + row(i)[1]).toString();
  check(JSON.stringify(row(0).slice(3)) === '[1,1,2]' && name(1) === 'a.txt' && name(2) === 'b');
  check(fs.bytes.subarray(row(1)[4], row(1)[4] + row(1)[5]).toString() === 'hi');
  check(row(3)[2] === 2 && row(4)[2] === 3);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
const empty = archive(null);
const expected = Buffer.alloc(40);
expected.write('JITKFS01');
[1, 0, 40, 0, 0, 1, 1, 0].forEach((value, i) => expected.writeUInt32LE(value, 8 + i * 4));
check(empty.count === 1 && empty.bytes.equals(expected));
const links = mkdtempSync(join(tmpdir(), 'jitk-link-'));
try {
  symlinkSync('/etc/passwd', join(links, 'link'));
  let rejected = false;
  try {
    archive(links);
  } catch (error: unknown) {
    rejected = error instanceof Error && error.message.includes('symlink');
  }
  check(rejected);
} finally {
  rmSync(links, { recursive: true, force: true });
}
console.log('7 packer/archive tests passed');
