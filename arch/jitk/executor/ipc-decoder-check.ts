// Property checks of Node's decoder of shard IPC under seeded random and
// mutated input, with no engine: the stream framing (shard-ipc.ts PipeChannel,
// Assembler, message) and the per-generation decoder (shard-backend.ts
// ShardSession.receive). The properties:
// 1. Framing: any messages, split anywhere, arrive whole and in order.
// 2. Hostile streams: any bytes decode to bounded messages or fail the
//    channel once, through its `failed` callback with a 'shard IPC' error;
//    nothing throws out of the socket handler and the input buffer stays
//    bounded.
// 3. Tenant content: a CALL, LOG or DONE whose envelope the shard got right
//    never fails the shard connection, whatever its payload; it becomes an
//    event or a failure of that generation only.
// JITK_IPC_CHECK_SEED and JITK_IPC_CHECK_CASES vary the run; a failure names
// its seed and case.
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import type { Duplex } from 'node:stream';
import { ShardSession, type ShardHost } from './shard-backend.js';
import { IPC, PipeChannel, records, type Message } from './shard-ipc.js';

const SEED = Number(process.env.JITK_IPC_CHECK_SEED ?? 0x1bc);
const CASES = Number(process.env.JITK_IPC_CHECK_CASES ?? 1000);

/** mulberry32: a small seeded generator. */
function generator(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
  const int = (n: number) => Math.floor(next() * n);
  return {
    int,
    pick: <T>(xs: readonly T[]): T => xs[int(xs.length)],
    bytes: (n: number) => {
      const b = Buffer.allocUnsafe(n);
      for (let i = 0; i < n; i++) b[i] = int(256);
      return b;
    },
  };
}
type Random = ReturnType<typeof generator>;

/** Each case runs on its own generator, so a failure replays alone. */
function cases(name: string, body: (r: Random, i: number) => void | Promise<void>): Promise<number> {
  return (async () => {
    for (let i = 0; i < CASES; i++) {
      try {
        await body(generator(SEED * 1_000_003 + i), i);
      } catch (e) {
        throw Error(`${name}: seed ${SEED} case ${i}: ${(e as Error).stack}`);
      }
    }
    return CASES;
  })();
}

/** The socket side PipeChannel uses; 'data' is delivered synchronously. */
class Socket extends EventEmitter {
  destroy() {}
  write() {
    return true;
  }
}
function channel() {
  const socket = new Socket(),
    received: Message[] = [],
    failures: Error[] = [];
  const ch = new PipeChannel(
    socket as unknown as Duplex,
    m => received.push(m),
    e => failures.push(e),
  );
  /** The unparsed input bytes PipeChannel holds (a private field). */
  const pending = () => (ch as unknown as { size: number }).size;
  return { socket, received, failures, pending };
}
/** `stream` in random pieces, at most `max` bytes each. */
function pieces(r: Random, stream: Buffer, max: number): Buffer[] {
  const out: Buffer[] = [];
  for (let at = 0; at < stream.length; ) {
    const n = 1 + r.int(max);
    out.push(stream.subarray(at, at + n));
    at += n;
  }
  return out;
}
function message(r: Random): Message {
  const lengths = [0, 1 + r.int(64), IPC.payload - 1, IPC.payload, IPC.payload + 1, 2 * IPC.payload + r.int(64)];
  return {
    kind: r.pick([IPC.call, IPC.done, IPC.error, IPC.stats, IPC.log, IPC.released, r.int(2 ** 32)]),
    slot: r.int(IPC.slots),
    generation: BigInt(r.int(2 ** 31)) << BigInt(r.int(31)),
    id: r.int(2 ** 32),
    bytes: r.bytes(r.pick(lengths)),
  };
}

async function framing(): Promise<number> {
  return cases('framing', r => {
    const sent = Array.from({ length: 1 + r.int(4) }, () => message(r));
    const { socket, received, failures } = channel();
    for (const b of pieces(r, Buffer.concat(sent.flatMap(records)), r.pick([1, 7, IPC.headerBytes, 4096, 65536])))
      socket.emit('data', b);
    assert.deepEqual(failures, []);
    assert.deepEqual(received, sent);
  });
}

/** One way a hostile or broken shard can damage a valid stream. */
function mutate(r: Random, b: Buffer): Buffer {
  const out = Buffer.from(b);
  switch (r.int(5)) {
    case 0:
      for (let n = 1 + r.int(8); n > 0 && out.length; n--) out[r.int(out.length)] = r.int(256);
      return out;
    case 1: {
      // a header word: kind, slot, id, length, flags, reserved
      const at = 32 * r.int(Math.max(1, Math.floor(out.length / 32))) + r.pick([0, 4, 16, 20, 24, 28]);
      if (at + 4 <= out.length)
        out.writeUInt32LE(r.pick([0, 1, 2, IPC.payload, IPC.payload + 1, 0xffffffff, r.int(2 ** 32)]), at);
      return out;
    }
    case 2:
      return out.subarray(0, r.int(out.length + 1));
    case 3: {
      const at = r.int(out.length + 1);
      return Buffer.concat([out.subarray(0, at), r.bytes(1 + r.int(64)), out.subarray(at)]);
    }
    default:
      return r.bytes(r.int(4 * IPC.headerBytes + IPC.payload));
  }
}

async function hostileStreams(): Promise<number> {
  return cases('hostile streams', r => {
    const stream = mutate(r, Buffer.concat(Array.from({ length: 1 + r.int(3) }, () => message(r)).flatMap(records)));
    const { socket, received, failures, pending } = channel();
    const max = r.pick([1, 13, IPC.headerBytes, 65536]);
    for (const b of pieces(r, stream, max)) {
      const [before, failed] = [received.length, failures.length > 0];
      socket.emit('data', b);
      if (failed) assert.equal(received.length, before, 'nothing is delivered after a failure');
      // At most an incomplete record (header and payload) plus one read.
      assert.ok(pending() <= IPC.headerBytes + IPC.payload + max, `input buffer ${pending()}`);
    }
    assert.ok(failures.length <= 1, 'the channel fails once');
    for (const e of failures) assert.match(e.message, /^shard IPC /);
    for (const m of received) {
      assert.ok(m.bytes.length <= IPC.messageBytes && m.slot < 2 ** 32 && m.id < 2 ** 32 && m.generation < 2n ** 64n);
    }
  });
}

// Resolved from the bundle in executor/build/.
type Row = [kind: 'call' | 'done' | 'log', name: string, outcome: string, payload: string];
const corpus = (
  JSON.parse(readFileSync(new URL('../../abi/guest-payloads.json', import.meta.url), 'utf8')) as { cases: Row[] }
).cases;
/** JSON-shaped damage: tokens a parser must survive. */
const TOKENS = [
  '[',
  ']',
  '{',
  '}',
  '"',
  '\\',
  '\\u',
  '\\ud800',
  '1e999',
  '-0',
  '0x1',
  'null',
  ',',
  ':',
  '__proto__',
  'constructor',
  '[[[[[[[[',
  '"x":',
  ' ',
];
function payload(r: Random, base: string): Buffer {
  let s = base;
  for (let n = r.int(4); n > 0; n--) {
    const at = r.int(s.length + 1);
    switch (r.int(4)) {
      case 0:
        s = s.slice(0, at) + r.pick(TOKENS) + s.slice(at);
        break;
      case 1:
        s = s.slice(0, at) + s.slice(at + 1 + r.int(8));
        break;
      case 2:
        s = s.slice(0, at) + String.fromCharCode(r.int(256)) + s.slice(at + 1);
        break;
      default:
        s = s.slice(0, at) + s.slice(at, at + 1 + r.int(32)).repeat(1 + r.int(64)) + s.slice(at);
    }
  }
  return Buffer.from(s, 'latin1');
}
class Host implements ShardHost {
  fault?: Error;
  now() {
    return 1n;
  }
  send() {
    return Promise.resolve();
  }
  released() {}
  metrics() {}
  fatal(e: Error) {
    this.fault ??= e;
  }
}

async function tenantContent(): Promise<number> {
  return cases('tenant content', async r => {
    const [kind, name, , base] = r.pick(corpus);
    const host = new Host(),
      s = new ShardSession(host, 0, 1n);
    await s.armDeadline(Date.now() + 60000);
    await s.start({ kind: 'js', source: 'async()=>1', tools: { ns: ['fn'] }, prelude: '' });
    const bytes = payload(r, base);
    const deliver = (kind: number, id: number, b: Buffer) => s.receive({ kind, slot: 0, generation: 1n, id, bytes: b });
    try {
      if (kind === 'call') deliver(IPC.call, 1, bytes);
      else if (kind === 'log') deliver(IPC.log, 0, bytes);
      else {
        deliver(IPC.stats, 0, Buffer.alloc(IPC.statsFixedBytes));
        deliver(IPC.done, 0, bytes);
      }
    } catch (e) {
      assert.fail(`${name}: ${bytes.toString('latin1').slice(0, 200)}: tenant content failed the shard: ${e}`);
    }
    const ev = await s.next();
    const expected = kind === 'call' ? 'call' : kind === 'log' ? 'log' : 'done';
    if (ev.kind === 'fail') assert.equal(ev.cause, 'guest', name);
    else assert.equal(ev.kind, expected, name);
    assert.equal(host.fault, undefined, name);
  });
}

/** A peer that writes one byte at a time costs one join per record, not one per byte. */
function trickle(): number {
  const { socket, received } = channel();
  const sent: Message = { kind: IPC.call, slot: 0, generation: 1n, id: 1, bytes: Buffer.alloc(3 * IPC.payload, 0x31) };
  const stream = Buffer.concat(records(sent)),
    concat = Buffer.concat;
  let joins = 0;
  Buffer.concat = ((list: readonly Uint8Array[], n?: number) => {
    joins++;
    return concat(list, n);
  }) as typeof Buffer.concat;
  try {
    for (let i = 0; i < stream.length; i++) socket.emit('data', stream.subarray(i, i + 1));
  } finally {
    Buffer.concat = concat;
  }
  assert.deepEqual(received, [sent]);
  // Per record: its header, then its payload; the Assembler joins the message once.
  assert.ok(joins <= 2 * records(sent).length + 1, `${joins} joins`);
  return 1;
}

export async function ipcDecoderChecks(): Promise<number> {
  return trickle() + (await framing()) + (await hostileStreams()) + (await tenantContent());
}
if (process.argv[1]?.endsWith('ipc-decoder-check.js'))
  console.log(JSON.stringify({ suite: 'ipc-decoder', seed: SEED, checks: await ipcDecoderChecks(), status: 'PASS' }));
