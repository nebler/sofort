# scriptc 0.4.5 VMM findings

See ../docs/SCRIPTC-GAPS.md for generic process/env helpers. No Python fallback.

- toFixed on a number read through a numeric array index can refuse SC2012 while
  the same method on report object fields compiles. Repro:
  `const a=[.01]; console.log(a[Math.floor(a.length/2)].toFixed(3));`.
  Workaround: the local fixed3 helper explicitly rounds and pads three decimals.
- POSIX child CPU accounting is provided through supported FFI and a small C
  getrusage wrapper; the controller and verdicts remain typed TypeScript.
- Static musl tools use the exact pinned runtime pack, Zig 0.16.0 and the same
  explicit zig-cc linker-driver wrapper as the oracle port.
