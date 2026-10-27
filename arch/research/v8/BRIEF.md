# Brief: a V8/WebAssembly sibling of Sofort ("capsules") — research round, 2026-10-27

## The idea under study
Sofort today = jitk: single-use hardware-isolated microVMs (tiny no_std Rust kernel, libkrun/KVM/HVF) whose ONLY I/O is
one JSON tool channel to a trusted TypeScript host. Planned but not built for jitk: pause at a pending tool call,
save the whole computer as a ~1 MiB file, then fork / move / replay it ("computers small enough to pause, fork and ship like a file").

The V8 sibling: run agent JavaScript not directly in V8 isolates, but in **QuickJS compiled to wasm32 running inside V8**
(Node, browser tab/Worker, Cloudflare Workers/workerd, Deno/Bun). Because the whole JS engine state is one linear-memory
byte array, a computer parked on an `await`ed tool call can be snapshotted, forked, moved between browser/server/edge,
and replayed from a journal of import results. Imports are the whole ABI: tool call, clock, random, log.
Isolation is software (Wasm + V8), not hardware; jitk stays the hardware tier, one programming model across both.

## Evidence that already exists (read these)
- `arch/research/portability/02-wasm.md`: Oct 25 spike. QuickJS 2026-06-04 → wasm32; parked on a tool promise, snapshotted in
  Wasmtime, resumed in Node, Chromium, local workerd and a local Dynamic Worker; forks diverged correctly; ~100 KB gzip snapshot,
  ~0.35 MiB RSS/instance, restore copy ~0.3–0.4 ms, tool round trip ~45–140 µs, fresh pooled instance ~0.15–0.3 ms, Wizer cold
  Node 21 ms median; JSPI present in Node 24.22.1 / Chrome 137+ / Firefox 153 / Safari 27. Memory limit not trustworthy yet.
- Spike files (read-only, raw): `~/sofort-local-evidence/portability-wasm-2026-10-25/` (copy of /tmp/portability-wasm).
- `arch/research/portability/{01-usermode,03-hardware-reach,BRIEF}.md`, `demo.md` (positioning, demo ideas §9, pitch lines §10),
  `arch/FINAL.md`, `arch/jitk/bench/RESULTS-LINUX-MEMORY-2026-10-27.md` (jitk ≈ Hyperlight per VM on Linux; don't claim memory wins),
  `arch/jitk/executor/{backend,pool,executor,select-backend}.ts` (the Backend/Sandbox seam a Wasm backend would plug into).

## Rules for every agent
- Research only. Write ONLY your own report file `arch/research/v8/NN-<topic>.md` (named in your task). Do not edit other files,
  do not commit, do not push. Scratch experiments go in `/tmp/v8-research-<topic>/`; delete large scratch at the end (disk is tight, ~17 GB free).
- Use web research; cite sources with links and dates; today is 2026-10-27. Prefer primary sources (repos, docs, release notes, papers).
- Label claims: **F** fact (sourced), **M** measured by you, **I** inference, **E** estimate. Don't overclaim; never write "first" or "unhackable".
- If you run code: small, local, time-boxed. No Docker prune/restart; do not touch the kvm-dev VM.
- End with: a 5-line TL;DR, a verdict (go / go-with-changes / no-go for your angle), and the 3 things you'd do next.
