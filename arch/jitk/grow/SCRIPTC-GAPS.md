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

The original successful spike is archived in Git history; its process/JSON/
filesystem checks now run in canonical `test.ts`. Current results are summarized
in `evidence/native-build.json`. Initial path comparison failed under both Node and scriptc
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

## E1/cutover findings (0.4.5)

No blocking gap remains. These are compiler/runtime restrictions encountered
while porting E1 and rebuilding after the canonical-directory move. No upstream
report was filed.

Optional `cwd` explicitly passed as undefined compiled but failed at runtime with
`TypeError: undefined is not representable in the target union`:

```ts
import { spawn } from 'node:child_process';
const cwd: string | undefined = undefined;
spawn('/bin/pwd', [], { cwd });
```

`capture` supplies `options.cwd || process.cwd()` instead.

Deleting a fixed-layout field through a dynamic record raises
`Cannot delete property 'version' of #<Object>`:

```ts
const value = { version: 0 };
const record = value as Record<string, unknown>;
delete record.version;
```

Retry rollback overwrites original fixed fields and deletes only added overflow
keys. The native retry regression test exercises mutation and restoration.

Mutating a nested heterogeneous tuple triggered SC9001
`recordSet receiver: expected record, got union`:

```ts
const cells: [string, number][] = [['first', 1]];
cells[0][0] = 'second';
```

The fixture replaces the complete tuple. Production seeded design is tested
against every cell/order in both historical Python metadata files.

A nested async function with defaulted captured arguments was rejected with
SC1090 (`functions with optional or defaulted parameters as values ...`):

```ts
async function outer(): Promise<void> {
  const reference = 'visible';
  async function verify(expected = reference): Promise<string> {
    return expected;
  }
  await verify();
}
```

The verifier uses explicit required reference/adapter arguments, including null
for the hidden adapter. Hidden tests cannot accidentally inherit the visible
adapter through default parameters.

A corpus-loop record spread was inferred as optional after the directory move
and rejected with SC1090, even following a controller assertion:

```ts
const cases = JSON.parse('[{"name":"x","sql":"select 1"}]') as { name: string; sql: string }[];
for (const item of cases) {
  const row = { ...item, status: 'PASS' };
  console.log(row);
}
```

Explicit `name: item.name, sql: item.sql` fields avoid that lowering restriction.

For Linux cross-linking, put Zig's directory on PATH and let scriptc select
`zig cc`. Setting `SCRIPTC_LINKER` to the bare zig executable caused
`error: unknown command: -target`; that variable selects a compiler-driver
replacement, not an arbitrary Zig executable path. The Makefile's target and
matching runtime pack produce a verified static aarch64 musl ELF, executed in
the unchanged Alpine oracle image.
