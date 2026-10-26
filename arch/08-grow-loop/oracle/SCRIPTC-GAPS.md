# scriptc 0.4.5 findings

## File-descriptor stdio declarations

`execFileSync('true', [], {stdio: [0, 1, 2]})` is rejected SC0001: only
`inherit | ignore | pipe` are declared. Workaround: asynchronous spawn with
inherited stdin and separate piped stdout/stderr, appended without decoding.
The 20-second timeout kills and reaps the owned process group.

## String record captured by a nested function after await

The original grow-ts normalizer's address interning used:

```ts
const addresses: Record<string, string> = {};
function addr(key: string): string {
  if (addresses[key] === undefined) addresses[key] = 'P0';
  return addresses[key];
}
```

In the full musl entrypoint, calling the normalizer after awaiting the child
fails at the first pointer with `TypeError: expected string at $, got undefined`.
The standalone normalizer (same target/input) succeeds. Changing the captured
address dictionary to `Map<string, string>` fixes the full entrypoint, with
byte-identical results. No upstream issue filed.

## Linker override

SCRIPTC_LINKER names a linker driver, so setting it to the Zig executable alone
fails `unknown command: -target`. The checked-in wrapper explicitly invokes
`zig cc`; its absolute path is required because scriptc resolves relative linker
paths against the installed CLI directory.
