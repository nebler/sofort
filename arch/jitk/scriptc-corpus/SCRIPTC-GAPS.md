# scriptc findings from this port

No upstream issues have been filed.

## Native tooling: union-typed RegExp match cannot seed Set (SC2020)

Compiler: npm scriptc 0.4.5, macOS arm64. Minimal repro:

```ts
const text = 'SC2020 SC2020';
console.log(Array.from(new Set(text.match(/SC\d{4}/g) || []))));
```

The compiler refuses `new Set(values)` with SC2020 even though the expression
always yields a string array. The equivalent empty `Set<string>()` followed by
`add()` compiles. The census controller uses that workaround. This is a compiler
refusal in the tooling, separate from corpus runtime compatibility.

## Lost child-exit wakeup

The upstream notes describe native tools hanging in `scr_children_wait`/kevent
with a zombie child. Every controller spawn has a deadline. On macOS a timed-out
child is sampled into `.work/samples/<pid>.txt` before the process group is killed
and reaped. A timeout alone is not labeled this specific bug: the stack sample
must establish the kevent/zombie condition.

Corpus-specific build/refusal/output findings will be summarized after the full
pinned corpus run, with environmental and nondeterministic cases separated.
