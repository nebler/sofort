# scriptc 0.4.5 findings

macOS arm64, npm-pinned 0.4.5. Nothing filed upstream. All eleven Python files
were ported; no Python fallback is needed. Native FFI uses the supported
manifest API documented at https://scriptc.dev/docs/ffi, with fixed signatures
and borrowed byte buffers. The C bridge contains OS calls, not benchmark policy.

## Index-signature class fields (SC1090)

```ts
interface Frame { [key: string]: any }
class Worker {
  frames: Frame[] = [];
}
```

`'Frame[]'-typed class fields are not supported yet`. A single `Frame` field is
also refused. Store buffered JSON lines as `string[]` in Worker, parse when
consumed, and use a fixed-layout `JitkConfig` in the Hyperlight Suite.

## Nested dynamic array push (runtime conversion refusal)

```ts
interface Frame { [key: string]: any }
const result: Frame = { orders: [] as Frame[] };
result.orders.push({ seed: 0, order: [1, 3, 2] });
```

Observed `Uncaught TypeError: expected number at $[0], got object` in the replay
driver. Keep a locally typed array, store its reference in the JSON object, and
push through that local variable. Applied to every controller's sample,
admission, cleanup and stage arrays; the real smoke verifies persistence.

## Iterator spread in numeric calls (runtime)

```ts
const deadlines = new Map<number, number>([[1, 2]]);
console.log(Math.min(...deadlines.values()));
```

Observed `expected array at $, got Array Iterator`. Use
`Math.min(...Array.from(deadlines.values()))`. Deadline and EOF watchdog tests
exercise this path, including detached descendants.

## Number formatting (SC2012 and semantic difference)

```ts
function values(): number[] { return [15.3125]; }
console.log(values()[0].toFixed(3));
```

Some numeric receiver expressions are refused with SC2012. A `Number(...)`
conversion can avoid the refusal, but JavaScript toFixed rounds exact ties
away from zero while Python's fixed format rounds ties to even. `lib.fixed`
formats the exact binary significand with integer arithmetic and ties-to-even;
it restores every published table cell on the parity inputs.

## Intl timezone (SC2020)

```ts
console.log(Intl.DateTimeFormat().resolvedOptions().timeZone);
```

`ResolvedDateTimeFormatOptions.timeZone` has no lowering. Machine metadata uses
`/bin/date +%Z`; it records `runtime: scriptc 0.4.5` rather than a Python version.

## Typed reduction of dynamic record arrays (SC1090)

```ts
interface Frame { [key: string]: any }
const p: Frame = JSON.parse('{"processes":[{"rss":1}]}');
console.log((p.processes as Frame[]).reduce((s, r) => s + r.rss, 0));
```

The collector's reductions were refused. Explicit typed loops preserve order
and values. Python 3.15's compensated float sum and exact statistics.mean are
implemented explicitly where its OLS and CPU analysis use them.
