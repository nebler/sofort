# scriptc 0.4.5 executor findings

See ../docs/SCRIPTC-GAPS.md for process/env workarounds. No Python fallback.

The hostile fixture does not need a new mmap binding: positional I/O on the
inherited memfd observes/updates the same shared pages. Buffer BigInt encoding
preserves 64-bit generations and deliberately overflowing queue fields.
Static Linux musl compilation and 13 queue-byte comparisons were verified in
the unchanged existing oracle container. No image rebuild/retag/pull/prune.
