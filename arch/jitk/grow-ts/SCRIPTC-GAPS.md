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
