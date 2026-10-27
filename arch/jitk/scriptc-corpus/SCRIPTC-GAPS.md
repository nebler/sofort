# scriptc findings from this port

No upstream issues have been filed.

## Native tooling: union-typed RegExp match cannot seed Set (SC2020)

Compiler: npm scriptc 0.4.5, macOS arm64. Minimal repro:

```ts
const text = 'SC2020 SC2020';
console.log(Array.from(new Set(text.match(/SC\d{4}/g) || [])));
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

## Corpus: Linux (scriptc ELF) versus Node 24

Full pinned run (RESULTS.md): 4127 compiled; 4070 match, 39 mismatch, 4 Linux
timeouts, 14 Node reference errors. Visible cases were triaged; the 16
held-out non-matching programs are not named. Each case is below, classified
as compiler, libc or environment.

### Compiler: static method returning a hoisted `var` before its assignment

Reproduces natively on macOS arm64 as well as on Linux/musl (corpus
`5111-var-hoisting-closures-classes.ts`):

```ts
class Reader {
  static peek() {
    return name;
  }
}
console.log(typeof Reader.peek()); // Node: undefined
var name = "n";
console.log(Reader.peek());        // Node: n
```

The scriptc binary exits 1 with `Uncaught TypeError: undefined is not
representable in the target union (a value narrowed or asserted past it still
held it)`. Arrow functions, instance methods and getters reading the same
early `var` match Node in that program; the static-method path does not.

### Compiler/runtime: execa 5 child-process mixin

Corpus `6610-npm-execa-child-mixin/main.ts` fails natively on macOS too (with
`node` on PATH) with `Uncaught TypeError: Object.defineProperty called on
non-object`. Node prints the expected mixin descriptors. The program
installs then/catch/finally on a ChildProcess through `Reflect.defineProperty`;
no minimal repro yet.

### libc or environment (not compiler findings)

| Visible programs | Cause |
| --- | --- |
| 5963–5966, 6230, 6231, 8020, 8025, 8026, date-zone-intervals | The Alpine oracle has no `/usr/share/zoneinfo`. Named zones keep their names but resolve to UTC offsets, so local-time output differs. jitk has no tzdata either. |
| 1521, 1655, 2941, 5747, fs-native-realpath, node24-fs-timestamps-symlinks, 2893–2897, 1523, 1360 (timeout) | The children spawn `node`, which the payload image lacks (`spawnSync node ENOENT`), or depend on process-group/session behavior that differs between the images. |
| 1540-os-userinfo | uid 65534's passwd home: `/` in Alpine, `/nonexistent` in Debian. |
| 5632, 5648 | glibc returns 127.0.0.1 twice for `localhost` with `all: true`; musl returns it once. |
| 5970-net-connect-host-name | musl resolves `LOCALHOST` via DNS (EAI_AGAIN without network). Native macOS scriptc resolves it like Node. |
| 5543-fs-promises-typed | A failed mkdtemp error message carries the template: musl restores `XXXXXX`, glibc leaves the random suffix. |
| reference-error rows | Node itself fails the declared exit (e.g. CJS named-export cases that scriptc supports beyond Node) or depends on the network or a writable source tree. |

Compiler refusals (9 programs; SC9001 ×7, SC1090, SC3004) and 2 build errors
are listed by code in RESULTS.md.
