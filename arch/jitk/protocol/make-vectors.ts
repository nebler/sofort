import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { check, json } from './lib.ts';

type Frame = Record<string, unknown>;
type Step = Record<string, unknown>;
interface Case {
  name: string;
  steps: Step[];
  expected: string;
  state?: string;
}
const root = process.env.JITK_VECTOR_ROOT || import.meta.dirname;
const ready = { t: 'ready', v: 1 };
const run = { t: 'run', code: 'return 1', ns: { api: ['echo', 'fail'] } };
const call = { t: 'call', id: 1, ns: 'api', fn: 'echo', args: [] as unknown[] };
function g(value: unknown): Step {
  return { dir: 'guest', wire: json(value, 0) + '\n' };
}
function h(value: unknown): Step {
  return { dir: 'host', frame: value };
}
function raw(value: string): Step {
  return { dir: 'guest', wire: value + '\n' };
}
function changed(key: string, value: unknown): Frame {
  const frame: Frame = {};
  for (const name of Object.keys(call)) {
    frame[name] = (call as Frame)[name];
  }
  frame[key] = value;
  return frame;
}
const setup = [g(ready), h(run)];
const cases: Case[] = [];
function add(name: string, steps: Step[], expected = 'ACCEPT', state?: string): void {
  const item: Case = { name, steps, expected };
  if (state) {
    item.state = state;
  }
  cases.push(item);
}
add('ready', [g(ready)], 'ACCEPT', 'parked');
add('empty final', [...setup, g({ t: 'done', ok: null }), { eof: true }], 'ACCEPT', 'done');
add('variadic unicode and out-of-order', [...setup, g(changed('args', [1, 'é😀', { x: false }])), g(changed('id', 2)), h({ t: 'ret', id: 2, ok: false }), h({ t: 'ret', id: 1, err: { code: 'DENIED', message: 'no' } }), g({ t: 'log', level: 'info', msg: 'hello\nworld' }), g({ t: 'done', ok: true })], 'ACCEPT', 'done');
add('error final cancels pending', [...setup, g(call), g({ t: 'done', err: { name: 'Error', message: 'x' } })], 'ACCEPT', 'done');
add('kernel text', [raw('\x1eENOSYS nr=123'), g(ready), h(run), g({ t: 'done', ok: 0 }), raw('\x1eexit=0'), { eof: true }], 'ACCEPT', 'done');
add('spaces', [...setup, raw(' { "t" : "done", "ok" : null } ')], 'ACCEPT', 'done');
let nested: unknown = 0;
for (let i = 0; i < 30; i += 1) {
  nested = [nested];
}
add('depth32', [...setup, g(changed('args', [nested]))]);
add('depth33', [...setup, g(changed('args', [[nested]]))], 'DEPTH');
const rawCases: string[][] = [
  [
    "old hello",
    "{\"t\":\"hello\",\"v\":1}",
    "SCHEMA"
  ],
  [
    "version alias",
    "{\"t\":\"ready\",\"version\":1}",
    "SCHEMA"
  ],
  [
    "duplicate key",
    "{\"t\":\"done\",\"ok\":1,\"ok\":2}",
    "DUPLICATE"
  ],
  [
    "escaped duplicate",
    "{\"t\":\"done\",\"ok\":{\"x\":1,\"\\u0078\":2}}",
    "DUPLICATE"
  ],
  [
    "nested duplicate",
    "{\"t\":\"done\",\"ok\":[{\"a\":0,\"a\":1}]}",
    "DUPLICATE"
  ],
  [
    "surrogate value",
    "{\"t\":\"done\",\"ok\":\"\\ud800\"}",
    "UNICODE"
  ],
  [
    "surrogate key",
    "{\"t\":\"done\",\"ok\":{\"\\udc00\":1}}",
    "UNICODE"
  ],
  [
    "nonfinite",
    "{\"t\":\"done\",\"ok\":1e999}",
    "NUMBER"
  ],
  [
    "large number",
    "{\"t\":\"done\",\"ok\":9007199254740992}",
    "NUMBER"
  ],
  [
    "bad JSON",
    "{\"t\":\"done\",\"ok\":}",
    "JSON"
  ],
  [
    "trailing JSON",
    "{\"t\":\"done\",\"ok\":1}{}",
    "JSON"
  ],
  [
    "trailing comma",
    "{\"t\":\"done\",\"ok\":1,}",
    "JSON"
  ],
  [
    "object required",
    "[]",
    "SCHEMA"
  ],
  [
    "raw Unicode",
    "{\"t\":\"done\",\"ok\":\"\u00e9\"}",
    "ASCII"
  ],
  [
    "raw tab",
    "{\t\"t\":\"done\",\"ok\":1}",
    "ASCII"
  ],
  [
    "raw RS inside",
    "{\"t\":\"done\",\"ok\":\"\u001e\"}",
    "ASCII"
  ],
  [
    "raw DEL",
    "{\"t\":\"done\",\"ok\":\"\u007f\"}",
    "ASCII"
  ],
  [
    "both done branches",
    "{\"t\":\"done\",\"ok\":1,\"err\":{\"name\":\"Error\",\"message\":\"x\"}}",
    "SCHEMA"
  ],
  [
    "extra done field",
    "{\"t\":\"done\",\"ok\":1,\"approved\":true}",
    "SCHEMA"
  ],
  [
    "empty line",
    "",
    "FRAME_LIMIT"
  ]
];
for (const row of rawCases) {
  add(row[0], [...setup, raw(row[1])], row[2]);
}
const badCalls: [string, string, unknown, string][] = [
  ['args object', 'args', {}, 'SCHEMA'],
  ['zero id', 'id', 0, 'ID'],
  ['skipped id', 'id', 2, 'ID'],
  ['fraction id', 'id', 1.5, 'ID'],
  ['id above total', 'id', 4097, 'ID'],
  ['extra call field', 'approved', true, 'SCHEMA'],
  ['bad name', 'ns', 'a.b', 'SCHEMA']
];
for (const row of badCalls) {
  add(row[0], [...setup, g(changed(row[1], row[2]))], row[3]);
}
add('bad log level', [...setup, g({ t: 'log', level: 'fatal', msg: 'x' })], 'SCHEMA');
add('log size', [...setup, g({ t: 'log', level: 'info', msg: 'x'.repeat(4097) })], 'SCHEMA');
add('guest ret', [...setup, g({ t: 'ret', id: 1, ok: 1 })], 'SCHEMA');
add('duplicate ready', [...setup, g(ready)], 'STATE');
add('missing done value', [...setup, g({ t: 'done' })], 'SCHEMA');
add('call before run', [g(ready), g(call)], 'STATE');
add('done before ready', [g({ t: 'done', ok: 0 })], 'STATE');
add('success with pending', [...setup, g(call), g({ t: 'done', ok: 1 })], 'OUTSTANDING_DONE');
add('duplicate call id', [...setup, g(call), g(call)], 'ID');
add('unknown ret', [...setup, h({ t: 'ret', id: 1, ok: 1 })], 'ID');
add('duplicate ret', [...setup, g(call), h({ t: 'ret', id: 1, ok: 1 }), h({ t: 'ret', id: 1, ok: 1 })], 'ID');
add('second run', [...setup, h(run)], 'STATE');
add('host wrong ret error', [...setup, g(call), h({ t: 'ret', id: 1, err: { code: 'bad', message: 'x' } })], 'SCHEMA');
add('run extra', [g(ready), h({ ...run, providers: [] })], 'SCHEMA');
add('then method', [g(ready), h({ ...run, ns: { api: ['then'] } })], 'SCHEMA');
add('reserved namespace', [g(ready), h({ ...run, ns: { return: ['echo'] } })], 'SCHEMA');
add('duplicate method', [g(ready), h({ ...run, ns: { api: ['echo', 'echo'] } })], 'SCHEMA');
add('prototype data is ordinary JSON', [...setup, raw('{"t":"done","ok":{"__proto__":{"admin":true},"constructor":1}}')], 'ACCEPT', 'done');
add('done then guest', [...setup, g({ t: 'done', ok: 1 }), g({ t: 'log', level: 'info', msg: 'x' })], 'STATE');
add('EOF before ready', [{ eof: true }], 'EOF');
add('EOF parked', [g(ready), { eof: true }], 'EOF');
add('EOF partial', [...setup, { dir: 'guest', wire: '{"t":"done"' }, { eof: true }], 'EOF');
add('CRLF', [...setup, { dir: 'guest', wire: '{"t":"done","ok":0}\r\n' }], 'ASCII');
function pending(count: number, size = 0): Step[] {
  const steps: Step[] = [];
  for (let i = 1; i <= count; i += 1) {
    const frame = changed('id', i);
    if (size > 0) {
      frame.args = ['x'.repeat(size)];
    }
    steps.push(g(frame));
  }
  return steps;
}
add('64 outstanding', [...setup, ...pending(64)], 'ACCEPT', 'running');
add('65 outstanding', [...setup, ...pending(65)], 'OUTSTANDING');
add('log count', [...setup, { repeat: 1025, step: g({ t: 'log', level: 'debug', msg: '' }) }], 'LOG_LIMIT');
add('log total', [...setup, { repeat: 65, step: g({ t: 'log', level: 'debug', msg: 'x'.repeat(4096) }) }], 'LOG_LIMIT');
add('frame count', [{ repeat: 8193, step: raw('\x1ex') }], 'FRAME_COUNT');
add('kernel cap', [{ dir: 'guest', wire: '\x1e' + 'x'.repeat(4097) }], 'KERNEL_LIMIT');
add('frame cap no LF', [...setup, { dir: 'guest', wire: 'x'.repeat(1048577) }], 'FRAME_LIMIT');
add('structure', [...setup, g({ t: 'done', ok: Array(32768).fill(0) })], 'STRUCTURE');
add('inflight', [...setup, ...pending(3, 800000)], 'INFLIGHT');
add('code cap', [g(ready), h({ ...run, code: 'x'.repeat(65537) })], 'SCHEMA');
add('unicode code byte cap', [g(ready), h({ ...run, code: 'é'.repeat(32769) })], 'SCHEMA');
add('unicode log byte cap', [...setup, g({ t: 'log', level: 'info', msg: 'é'.repeat(2049) })], 'SCHEMA');
add('wire total', [{ repeat: 4095, step: raw('\x1e' + 'x'.repeat(4096)) }], 'WIRE_LIMIT');
const guestCases: Frame[] = [
  {
    "name": "fragmented run",
    "code": "return 42",
    "fragment": true,
    "ok": 42
  },
  {
    "name": "64 outstanding reverse rets",
    "code": "return await Promise.all(Array.from({length:64},(_,i)=>api.echo(i)))",
    "calls": 64,
    "reply": "reverse",
    "ok": [
      0,
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12,
      13,
      14,
      15,
      16,
      17,
      18,
      19,
      20,
      21,
      22,
      23,
      24,
      25,
      26,
      27,
      28,
      29,
      30,
      31,
      32,
      33,
      34,
      35,
      36,
      37,
      38,
      39,
      40,
      41,
      42,
      43,
      44,
      45,
      46,
      47,
      48,
      49,
      50,
      51,
      52,
      53,
      54,
      55,
      56,
      57,
      58,
      59,
      60,
      61,
      62,
      63
    ]
  },
  {
    "name": "error ret caught",
    "code": "try { await api.fail(); } catch(e) { return {code:e.code,message:e.message}; }",
    "calls": 1,
    "reply": "error",
    "ok": {
      "code": "DENIED",
      "message": "policy denied"
    }
  },
  {
    "name": "unknown ret id fatal",
    "code": "await api.echo(1); return 99",
    "calls": 1,
    "reply": "unknown",
    "fatal": true
  },
  {
    "name": "duplicate ret id fatal",
    "code": "await api.echo(1); await new Promise(()=>{});",
    "calls": 1,
    "reply": "duplicate",
    "fatal": true
  },
  {
    "name": "EOF before run",
    "input": "eof",
    "fatal": true
  },
  {
    "name": "oversized frame no LF",
    "input": "oversized",
    "fatal": true
  },
  {
    "name": "raw DEL host frame",
    "input": "DEL",
    "fatal": true
  },
  {
    "name": "Unicode log byte budget",
    "code": "for(let i=0;i<2000;i++)console.info('\u00e9\ud83d\ude00'.repeat(1000));return 7",
    "ok": 7,
    "logBudget": true
  },
  {
    "name": "Unicode scalar log clipping",
    "code": "console.info('\u00e9'.repeat(2047)+'\ud83d\ude00');console.info('\\ud800');return 8",
    "ok": 8,
    "scalarLogs": true
  }
];
const corpus = {
  format: "jitk-v1-conformance-1",
  description: "steps in order; guest wire is UTF-8 bytes (including explicit LF); host frame is an object; repeat expands step; eof calls transport EOF. ACCEPT means no violation, not application success. Stop at first error. For chunk testing subdivide guest bytes arbitrarily.",
  cases,
  guestCases,
  guestDescription: "Fresh VM per guestCase. Host sends run with api echo/fail. reverse waits for all calls then returns args[0] descending; error returns DENIED; unknown sends id 4096; duplicate sends same ret twice before completion. input overrides run. fatal requires no done and natural guest termination before watchdog. logBudget verifies decoded UTF-8 totals."
};
console.log(cases.length + ' cases');
const path = join(root, 'vectors.json');
const generated = json(corpus) + '\n';
if (process.env.JITK_RECORD === '1') {
  writeFileSync(path, generated);
} else {
  check(readFileSync(path, 'utf8') === generated, 'stale vectors.json; review and run JITK_RECORD=1 .work/bin/make-vectors');
}
console.log(guestCases.length + ' real-guest cases');
