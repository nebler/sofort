# scriptc 0.4.5 findings

Tested on macOS arm64 with the npm-pinned compiler (2026-10-26). Nothing filed upstream.

## Synchronous spawn cwd refusal (SC0001)

```ts
import { spawnSync } from 'node:child_process';
spawnSync('/bin/pwd', [], { cwd: '/tmp', encoding: 'utf8' });
```

Bundled declarations reject `cwd` as an unknown property. `execFileSync` accepts cwd.
Workaround: the controller uses asynchronous `spawn`, whose cwd, explicit env,
separate binary pipes, detached session, held-open stdin and group SIGKILL were
verified in the native spike. Timeouts kill the whole process group, with direct
child-kill fallback, and await `close` to reap/drain. No shell timeout utility needed.

## Union assertions (SC2020)

```ts
import assert from 'node:assert/strict';
const value: number | null = JSON.parse('7');
assert.equal(value, 7);
```

Strict assertions on union values can be refused. Use `assert.ok(value === 7)`
or the controller's boolean `check`. Does not change the gate decision.

## Promise catch parameter (SC1090; documented restriction)

```ts
Promise.resolve().catch((error: Error) => console.error(error.message));
```

Use `(error: unknown)` and narrow with `instanceof Error`.

## Bundled error type

`spawnSync(...).error?.code` is absent from the bundled `Error` declaration.
The spike reads it through an explicit structural cast. Controller process failures
are checked from the captured status/timeout and spawn error event.

## Spike

`spike/main.ts`, `spike/result.json` and `spike/build.log` contain the successful
native repro and result. Initial path comparison failed under both Node and scriptc
because macOS `/var` resolves to `/private/var`; fixed with `realpathSync` (not a
compiler gap). `fork` and library mode are unused; their documented restrictions
are irrelevant to this executable. Filesystem/crypto/JSON/argv all passed.

## Dynamic record spread (SC1090) and projection

```ts
interface RecordValue { [key: string]: unknown; kind: string }
const raw = JSON.parse('{"kind":"sys.enter","pc":4194504}') as RecordValue;
const copy = { ...raw, ret: 0 };
```

Object spread of an index-signature shape is refused (overflow keys are runtime
state). Workaround: explicitly iterate `Object.keys` into a
`Record<string, unknown>`, then set the changed members. This preserves future
raw protocol fields as well as `pc`. A plain fixed-layout interface conversion
had dropped `pc` from serialized receipts; full receipt comparison detected it.
The corrected native regression tests require both `pc` and an unknown future
field to survive. No raw register evidence is discarded in the final port.

`assert.deepEqual` of index-signature records is also refused with SC2020.
`util.isDeepStrictEqual` followed by a boolean assertion works natively.

## process.env assignment (SC1090)

```ts
process.env.TEST_CLI = process.argv[1]!;
```

Still treated as `string | undefined` by lowering despite the non-null assertion.
Use `String(process.argv[1])` after validating the argument. Encountered in the
native test fixture, not in production credential handling.
