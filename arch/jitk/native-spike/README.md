# Native product spike

All probes use scriptc **0.4.5** from this directory. Hyperlight and the Linux
shard N-API addon are excluded. Source copies and generated executables are
local to this directory; canonical product sources are never written.

Raw diagnostics, binaries and benchmark samples belong in ignored `.work/`.
See [REPORT.md](REPORT.md) for results and reproduction commands. This is a
negative feasibility result, not a native implementation or a performance claim.

Harnesses (`*.mjs`) run on an explicit Node >=24. Application/test entries are
compiled with the pinned native compiler. `prepare.mjs` copies canonical sources,
`bundle.mjs` reproduces the esbuild route, and `experiments.mjs` creates the
limited import/type-isolation variants and the fake-suite executable entry.
`local-suite.mjs node` runs the Node functional control; `compile` builds the ten
entries individually. `probe.mjs` records compilation and `smoke.mjs` separately
records execution. Neither treats a successfully emitted binary as a passed test.
