# jitk integrated prototype

A single-use microVM executor for submitted JavaScript, plus a development loop
that grows the restricted Linux syscall surface used by static guest programs.
See [architecture](docs/ARCHITECTURE.md), [evidence and claims](docs/CLAIMS.md),
[kill criteria](docs/KILL-CRITERIA.md), and the live
[final integration report](../10-minimalist-critic/R4.md).

From this directory:

```sh
make build          # kernel → VMM → protocol generated JS → executor
make test           # every root suite plus sandbox, policy, Hyperlight adapter
make bench          # canonical load-aware area-06 harness
make demo           # executor result → deleted syscall regrowth → Lua
make linux-nested   # area-05 nested-KVM functional suite
make loc            # reproducible owned-source line inventory
```

Prerequisites and platform restrictions belong to each subtree's README.
The top level delegates commands; it does not install tools or implement a
second build, VM launcher, benchmark, or grow controller. Missing subtrees or
entrypoints fail with their path and required owner action. A `.READY` file is
an owner's coordination signal, not independent proof of a gate.

Owner entrypoints are a subtree `Makefile` target or a same-named shell script:
`kernel/{build,test}`, `vmm/{build,test}`, `executor/{build,test,demo}`,
`protocol/{build,test}`, `grow/{test,grow,demo}`, `bench/{test,bench}`, and
`linux/{test,nested}`. Adaptations to existing documented owner scripts live
only in `docs/delegate.py`. H2 is sequential and stops at the first failure.
`make test` includes the Linux README's full nested functional suite, requiring
Docker/QEMU; `make linux-nested` runs that suite alone.
Security module unit/policy tests and the baseline adapter test use their exact
README commands; they do not substitute for integrated containment H5.
Public demo/benchmark targets require canonical input markers. Marker preflight
does not bind artifact provenance: inspect the selected hashes, and see the
final integration report. R4 selection derives the root independently of its
basename and honors explicit built-artifact overrides. Build/test can run before markers. Linux nested requires ready kernel/sandbox sources and
builds its canonical Linux VMM through the owner kit.
H2 runs `grow/grow` as a new real deletion/regrowth transaction, then
`grow/demo` for its labeled receipts and live qjs/Lua boots; playback alone
does not establish fresh regrowth. See `grow/README.md` for its oracle image.
Protocol build always precedes executor build so generated decoder JS cannot
silently lag its canonical TS source. Set `JITK_NODE` to a verified absolute
Node >=24 executable.
Build also delegates the executor README's `npm ci --ignore-scripts` prerequisite
to install locked dependencies locally when needed; the copied dangling cache
link is removed. A valid development symlink is retained. `npm` must resolve to
`npm-cli.js`, or set `JITK_NPM_CLI` to its absolute path; it runs under the verified
Node executable. npm cache defaults to `jitk-npm-cache` in the system temp directory
(`JITK_NPM_CACHE` overrides); no global packages/toolchains are installed.

Clean-copy verification and exact failures are recorded outside the copied
tree in `../10-minimalist-critic/r3/`. No production performance, broad Linux
compatibility, or complete containment claim follows from this prototype.

R4 final verification: build passes in an independently renamed copy; aggregate
`make test` stops at the protocol source guard requiring Hyperlight's former
direct dispatcher import. Hyperlight now delegates to the canonical process
backend. `make demo` passes independently. The strict all-file reference scan
and the 30/30 deadline target still fail; see the final report and claims ledger.

Set `JITK_VMM_BUILD` to a private build-output directory and `JITK_VMM_BINARY`
to that directory's `jitk-vmm` when isolating a verification run. Set
`JITK_KERNEL_CARGO_TARGET_DIR` for the kernel's build cache. Hyperlight and nested
Linux prerequisites use their documented explicit environment variables; the
integration receipt records and hashes the isolated inputs actually used.
