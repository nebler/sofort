import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { check, sha } from './lib.ts';

export const BASE = 0x400000;
// brk heap floor: small images keep HEAP = 0x680000 and mmap at HEAP + 1.5 MiB.
export const LIMIT = 0x680000;
export const STACK = 0x1e00000;
// PT_LOAD admission bound: any placement in the user window that still leaves the
// 1.5 MiB brk heap and a 4 MiB mmap arena below STACK (prepare re-checks with the
// archive). A higher image base (scriptc/Zig link at 0x1000000) pads the flat
// payload with unmapped zero pages below it; heap and mmap stay above the image.
export const IMAGE_END = STACK - 0x180000 - 0x400000;
interface Node {
  name: Buffer;
  parent: number;
  path: string | null;
  first: number;
  count: number;
}
export interface Metadata {
  source_sha256: string;
  flat_bytes: number;
  flat_sha256: string;
  physical_base: string;
  segments: number[][];
  entry: number;
  phdr: number;
  phnum: number;
  resources?: { dir: string | null; sha256: string; bytes: number; entries: number; va: string; heap: string };
}

export function archive(root: string | null): { bytes: Buffer; count: number } {
  const nodes: Node[] = [{ name: Buffer.alloc(0), parent: 0, path: null, first: 0, count: 0 }];
  const dirs: { path: string | null; index: number }[] = [{ path: root, index: 0 }];
  for (let i = 0; i < dirs.length; i += 1) {
    const directory = dirs[i];
    const names = directory.path ? readdirSync(directory.path).sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b))) : [];
    nodes[directory.index].first = nodes.length;
    nodes[directory.index].count = names.length;
    for (const name of names) {
      const full = join(directory.path!, name);
      const stat = lstatSync(full);
      const raw = Buffer.from(name);
      check((stat.isDirectory() || stat.isFile()) && raw.length <= 255, 'unsupported resource (symlink/special/name): ' + full);
      nodes.push({ name: raw, parent: directory.index, path: stat.isDirectory() ? null : full, first: 0, count: 0 });
      if (stat.isDirectory()) {
        dirs.push({ path: full, index: nodes.length - 1 });
      }
    }
  }
  check(nodes.length <= 65536, 'more than 65536 resource entries');
  const namesOffset = 16 + 24 * nodes.length;
  const dataOffset = namesOffset + nodes.reduce((sum, node) => sum + node.name.length, 0);
  const table = Buffer.alloc(16 + 24 * nodes.length);
  table.write('JITKFS01', 0);
  table.writeUInt32LE(nodes.length, 8);
  const names: Buffer[] = [];
  const body: Buffer[] = [];
  let nameSize = 0;
  let bodySize = 0;
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    const content = node.path === null ? Buffer.alloc(0) : readFileSync(node.path);
    const row = [namesOffset + nameSize, node.name.length, node.parent, node.path === null ? 1 : 0, node.path === null ? node.first : dataOffset + bodySize, node.path === null ? node.count : content.length];
    for (let field = 0; field < row.length; field += 1) {
      table.writeUInt32LE(row[field], 16 + 24 * i + 4 * field);
    }
    names.push(node.name);
    nameSize += node.name.length;
    body.push(content);
    bodySize += content.length;
  }
  return { bytes: Buffer.concat([table, ...names, ...body]), count: nodes.length };
}

function u64(bytes: Buffer, offset: number): number {
  const value = bytes.readBigUInt64LE(offset);
  check(value <= BigInt(Number.MAX_SAFE_INTEGER), 'segment outside payload arena');
  return Number(value);
}
function page(value: number): number {
  return Math.ceil(value / 4096) * 4096;
}
export function pack(bytes: Buffer): { flat: Buffer; meta: Metadata } {
  check(bytes.length >= 64 && bytes.subarray(0, 7).equals(Buffer.from([127, 69, 76, 70, 2, 1, 1])), 'ELF64 little-endian required');
  check(bytes.readUInt16LE(16) === 2 && bytes.readUInt16LE(18) === 183, 'static ET_EXEC AArch64 required');
  const entry = u64(bytes, 24);
  const ph = u64(bytes, 32);
  const num = bytes.readUInt16LE(56);
  check(bytes.readUInt16LE(54) === 56 && num > 0 && num <= 16 && ph + num * 56 <= bytes.length, 'invalid program headers');
  const segments: number[][] = [];
  const loads: number[][] = [];
  for (let i = 0; i < num; i += 1) {
    const p = ph + i * 56;
    const type = bytes.readUInt32LE(p);
    check(type !== 2 && type !== 3, 'dynamic ELF/interpreter forbidden');
    if (type !== 1) {
      continue;
    }
    const flags = bytes.readUInt32LE(p + 4);
    const offset = u64(bytes, p + 8);
    const va = u64(bytes, p + 16);
    const fs = u64(bytes, p + 32);
    const ms = u64(bytes, p + 40);
    const align = bytes.readBigUInt64LE(p + 48);
    check((flags & 3) !== 3, 'W+X segment forbidden');
    check(BASE <= va && va <= va + ms && va + ms <= IMAGE_END && fs <= ms && offset + fs <= bytes.length, 'segment outside payload arena');
    check(align === 0n || align === 1n || ((align & (align - 1n)) === 0n && BigInt(va - offset) % align === 0n), 'invalid segment alignment');
    if (ms === 0) {
      continue;
    }
    const lo = Math.floor(va / 4096) * 4096;
    const hi = page(va + ms);
    check(!segments.some(segment => lo < page(segment[1]) && hi > Math.floor(segment[0] / 4096) * 4096), 'PT_LOAD segments share a page');
    segments.push([va, va + ms, flags]);
    loads.push([offset, va, fs]);
  }
  check(segments.length > 0 && segments.some(segment => segment[0] <= entry && entry < segment[1] && (segment[2] & 1) !== 0), 'entry must be in executable segment');
  const header = loads.find(load => load[0] <= ph && ph + num * 56 <= load[0] + load[2]);
  check(header, 'program header table must be loaded');
  const flat = Buffer.alloc(page(Math.max(...segments.map(segment => segment[1])) - BASE));
  for (const load of loads) {
    bytes.copy(flat, load[1] - BASE, load[0], load[0] + load[2]);
  }
  const meta: Metadata = { source_sha256: sha(bytes), flat_bytes: flat.length, flat_sha256: sha(flat), physical_base: '0x80080000', segments, entry, phdr: header[1] + ph - header[0], phnum: num };
  return { flat, meta };
}
