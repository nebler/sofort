// Offline hostile peer. Positional I/O on the inherited memfd observes the same
// shared pages as the host mapping; this fixture never serves real executions.
import { readSync, writeSync } from 'node:fs';
import { basename } from 'node:path';
import { check } from '../lib.ts';
const CAP = 64;
const RECORD = 16416;
const REGION = CAP * RECORD;
const mode = basename(process.argv[3]);
let produced = 0;
function read(at: number, size: number): Buffer {
  const bytes = Buffer.alloc(size);
  check(readSync(3, bytes, 0, size, at) === size, 'short memfd read');
  return bytes;
}
function store(at: number, bytes: Buffer): void {
  check(writeSync(3, bytes, 0, bytes.length, at) === bytes.length, 'short memfd write');
}
function scalar(at: number, value: bigint): void {
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64LE(value);
  store(at, bytes);
}
function notify(): void {
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64LE(1n);
  writeSync(5, bytes);
}
function send(kind: number, slot = 0, generation = 0n, identity = 0, payload = Buffer.alloc(0), length = payload.length, reserved = 0n): void {
  const record = Buffer.alloc(32 + payload.length);
  record.writeUInt32LE(kind, 0);
  record.writeUInt32LE(slot, 4);
  record.writeBigUInt64LE(generation, 8);
  record.writeUInt32LE(identity, 16);
  record.writeUInt32LE(length, 20);
  record.writeBigUInt64LE(reserved, 24);
  payload.copy(record, 32);
  store(4096 + REGION + produced % CAP * RECORD, record);
  produced += 1;
  scalar(192, BigInt(produced));
  notify();
}
function sleep(ms: number): Promise<void> {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}
if (mode === 'no-ready') {
  await sleep(5000);
  process.exit(0);
}
send(20);
if (mode === 'backpressure') {
  let consumed = 0;
  while (true) {
    const current = Number(read(64, 8).readBigUInt64LE());
    while (consumed < current) {
      const record = read(4096 + consumed % CAP * RECORD, 32);
      const kind = record.readUInt32LE(0);
      const slot = record.readUInt32LE(4);
      const generation = record.readBigUInt64LE(8);
      consumed += 1;
      if (kind === 1) {
        send(22, slot, generation, 0, Buffer.alloc(32));
        send(17, slot, generation, 0, Buffer.from('{"ok":1}'));
      } else if (kind === 3) {
        send(19, slot, generation);
      } else {
        throw new Error(String(kind));
      }
    }
    await sleep(1);
  }
}
while (read(64, 8).readBigUInt64LE() === 0n) {
  await sleep(1);
}
const admission = read(4096, 32);
const slot = admission.readUInt32LE(4);
const generation = admission.readBigUInt64LE(8);
scalar(128, 1n);
const call = Buffer.from('["call","tools","echo",[]]');
if (mode === 'producer') {
  scalar(192, 0xffffffffffffffffn);
  notify();
} else if (mode === 'consumer') {
  scalar(128, 0xffffffffffffffffn);
  send(16, slot, generation, 1, Buffer.from('["log","log","x"]'));
} else if (mode === 'length') {
  send(16, slot, generation, 1, Buffer.alloc(0), 0xffffffff);
} else if (mode === 'reserved') {
  send(16, slot, generation, 1, Buffer.alloc(0), 0, 1n);
} else if (mode === 'slot') {
  send(16, 64, generation, 1, call);
} else if (mode === 'generation') {
  send(16, slot, generation + 1n, 1, call);
} else if (mode === 'kind') {
  send(1, slot, generation);
} else if (mode === 'identity') {
  send(16, slot, generation, 2, call);
} else if (mode === 'duplicate') {
  send(16, slot, generation, 1, call);
  send(16, slot, generation, 1, call);
} else if (mode === 'json') {
  send(16, slot, generation, 1, Buffer.from('["call","tools","echo",[{"a":1,"a":2}]]'));
} else if (mode === 'nonascii') {
  send(16, slot, generation, 1, Buffer.concat([Buffer.from('["call","tools","echo",["'), Buffer.from([0xe1]), Buffer.from('"]]')]));
} else if (mode === 'completion') {
  send(17, slot, generation, 0, Buffer.from('{"ok":1}'));
} else if (mode === 'stats') {
  const stats = Buffer.alloc(32);
  stats.writeBigUInt64LE(0xffffffffffffffffn, 24);
  send(22, slot, generation, 0, stats);
} else {
  throw new Error(mode);
}
await sleep(5000);
