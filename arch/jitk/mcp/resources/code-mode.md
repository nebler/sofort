# Code mode on jitk

Call the `execute` tool with `{code}`: the body of an async JavaScript function.
It runs in a fresh, single-use microVM (QuickJS on the jitk kernel) and is
destroyed afterwards. Nothing persists between calls except host tool state.

- `return` a JSON value; it comes back as `result`. `console.log` lines come back as `logs`.
- Host tools are globals named by namespace: `await math.add(1, 2)`.
- Batch independent calls with `Promise.all`; they run concurrently on the host.
- The guest has no network, filesystem, or host access; only the listed tools reach the host.

## Errors

`{error: {code, message}, logs}` with code:

| code | meaning |
|---|---|
| TIMEOUT | the deadline passed; the VM was killed |
| POLICY | a host tool call was denied (schema, taint rule, or approval required) |
| LIMIT | size, call-budget, memory, or pool-capacity limit |
| SANDBOX | the VM exited or violated the protocol |
| GUEST_ERROR | your code threw |

## Policy

Each tool declares its effects. After reading private data (`kv.get`), a
state-changing tool (`kv.set`) in the same run needs approval, which this server
does not grant: write first, or use separate `execute` calls.

```js
await kv.set('greeting', 'hi');
const [a, b] = await Promise.all([math.add(1, 2), kv.get('greeting')]);
return {a, b};
```
