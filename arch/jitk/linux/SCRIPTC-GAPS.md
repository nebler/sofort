# scriptc 0.4.5 findings

Nothing filed upstream. All findings have local workarounds; no Python fallback.

## POSIX APIs

```ts
process.on('SIGHUP', () => {});
```

SC0001: the signal overload only accepts SIGINT/SIGTERM. `native.c` supplies a
small static FFI bridge for `signal(SIGHUP, SIG_IGN)`. The same bridge exposes
`getrusage`, `sysconf(_SC_CLK_TCK)` and the two KVM ioctls used by the Python
preflight. The suite and supervisor logic remain TypeScript. The bridge is built
by clang on Mac and zig for static arm64 Linux, using `native.ffi.json`.

## Dictionary fields in classes

```ts
class VM { frames: Record<string, unknown>[] = []; }
```

SC1090 refuses this class field. Keep wire frames as strings; parse into typed
local dictionaries. CPU phase fields use arrays with explicit element interfaces.

## Dynamic array reductions

```ts
const rows = JSON.parse('[{"n":1}]') as Record<string, unknown>[];
rows.reduce((sum, row) => sum + Number(row.n), 0);
```

SC1090/SC2020: reduce on a checked-dynamic array is not lowered. Use a typed loop.
Indexed optional Buffers also require explicit undefined narrowing before writes.

The general async process, JSON, hashing and assertion helpers are in `lib.ts`,
copied locally from the shard component rather than importing across components.
