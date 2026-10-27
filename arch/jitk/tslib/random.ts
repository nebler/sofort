import { check } from './assert.ts';

// CPython random.Random(integer seed): MT19937 seeded with init_by_array over
// the seed's 32-bit words, getrandbits rejection sampling, Fisher-Yates
// shuffle and randbytes. Keep init_by_array's uint32 overflow at every step;
// seeded fixtures, orders and bootstrap statistics depend on exact output.
export class PythonRandom {
  private state: number[] = [];
  private index = 624;
  constructor(seed: number) {
    let value = BigInt(Math.abs(seed));
    const key: number[] = [];
    do {
      key.push(Number(value & 0xffffffffn));
      value >>= 32n;
    } while (value !== 0n);
    this.state[0] = 19650218;
    for (let i = 1; i < 624; i += 1) {
      this.state[i] = (Math.imul(1812433253, this.state[i - 1] ^ (this.state[i - 1] >>> 30)) + i) >>> 0;
    }
    let i = 1;
    let j = 0;
    for (let k = Math.max(624, key.length); k > 0; k -= 1) {
      this.state[i] = ((this.state[i] ^ Math.imul(this.state[i - 1] ^ (this.state[i - 1] >>> 30), 1664525)) + key[j] + j) >>> 0;
      i += 1;
      j += 1;
      if (i >= 624) {
        this.state[0] = this.state[623];
        i = 1;
      }
      if (j >= key.length) {
        j = 0;
      }
    }
    for (let k = 623; k > 0; k -= 1) {
      this.state[i] = ((this.state[i] ^ Math.imul(this.state[i - 1] ^ (this.state[i - 1] >>> 30), 1566083941)) - i) >>> 0;
      i += 1;
      if (i >= 624) {
        this.state[0] = this.state[623];
        i = 1;
      }
    }
    this.state[0] = 0x80000000;
  }
  // getrandbits(32)
  uint32(): number {
    if (this.index >= 624) {
      for (let i = 0; i < 624; i += 1) {
        const y = ((this.state[i] & 0x80000000) | (this.state[(i + 1) % 624] & 0x7fffffff)) >>> 0;
        this.state[i] = (this.state[(i + 397) % 624] ^ (y >>> 1) ^ ((y & 1) ? 0x9908b0df : 0)) >>> 0;
      }
      this.index = 0;
    }
    let y = this.state[this.index];
    this.index += 1;
    y ^= y >>> 11;
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= y >>> 18;
    return y >>> 0;
  }
  random(): number {
    return ((this.uint32() >>> 5) * 67108864 + (this.uint32() >>> 6)) / 9007199254740992;
  }
  randrange(n: number): number {
    check(Number.isSafeInteger(n) && n > 0, 'invalid random bound');
    const bits = Math.floor(Math.log2(n)) + 1;
    check(bits <= 32, 'random bound exceeds 32 bits');
    let value = this.uint32() >>> (32 - bits);
    while (value >= n) {
      value = this.uint32() >>> (32 - bits);
    }
    return value;
  }
  shuffle<T>(values: T[]): void {
    for (let i = values.length - 1; i > 0; i -= 1) {
      const j = this.randrange(i + 1);
      const previous = values[i];
      values[i] = values[j];
      values[j] = previous;
    }
  }
  // randbytes(length): getrandbits(8 * length) as little-endian 32-bit words,
  // the last word's high bytes for a partial tail.
  bytes(length: number): Buffer {
    const bytes = Buffer.alloc(length);
    for (let i = 0; i < length; i += 4) {
      const size = Math.min(4, length - i);
      let word = this.uint32();
      if (size < 4) {
        word >>>= (4 - size) * 8;
      }
      for (let k = 0; k < size; k += 1) {
        bytes[i + k] = (word >>> (k * 8)) & 255;
      }
    }
    return bytes;
  }
}

// random.Random(seed).shuffle(items)
export function pythonShuffle<T>(items: T[], seed: number): void {
  new PythonRandom(seed).shuffle(items);
}
