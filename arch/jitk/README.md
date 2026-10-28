# jitk integrated prototype

A single-use microVM executor for submitted JavaScript, plus a development loop
that grows the restricted Linux syscall surface used by static guest programs.
See [architecture](docs/ARCHITECTURE.md), [evidence and claims](docs/CLAIMS.md),
[kill criteria](docs/KILL-CRITERIA.md), and the live
[final integration report](../10-minimalist-critic/R4.md).

From this directory:

```sh
make deps           # pinned Node/npm, VMM, Hyperlight source/worker/snapshot → jitk cache
make build          # kernel → VMM → protocol generated JS → executor
make test           # every root suite plus sandbox, policy, Hyperlight adapter
make bench          # canonical load-aware area-06 harness
make demo           # executor result → deleted syscall regrowth → Lua
make linux-nested   # area-05 nested-KVM functional suite
make loc            # reproducible owned-source line inventory
```

## Clean clone

From a fresh clone (or after a reboot cleared `/tmp`), with no `JITK_*` or
`HYPERLIGHT_*` variables set:

```sh
make -C arch/jitk build test   # build and test depend on deps; it runs first
```

`make deps` (also the first step of `build`, `test`, `bench` and `demo`)
builds what is missing into the jitk cache and prints a manifest; a second
run only verifies hashes. `make deps-status` prints the selection without
building.

| variable | cache entry | how it is made |
| --- | --- | --- |
| `JITK_NODE`, `JITK_NPM_CLI` | `node/v24.22.1-{darwin,linux}-arm64/` | nodejs.org tarball, sha256 pinned in [`tools/deps.json`](tools/deps.json); macOS: `bin/node-real` ad-hoc signed with [`tools/node.entitlements`](tools/node.entitlements) (Hypervisor), signed hash pinned; npm is the tarball's `npm-cli.js` |
| `HYPERLIGHT_JS_SRC` (macOS) | `src/hyperlight-js-<commit>/` | `git fetch --depth 1` of the pinned commit |
| `JITK_VMM_BINARY` (macOS) | `vmm/darwin-<inputs>/jitk-vmm` | [`vmm/build.ts`](vmm/build.ts); libkrun shared in `vmm/libkrun-darwin-<patches>/` |
| `HYPERLIGHT_WORKER`, `HYPERLIGHT_SNAPSHOT` (macOS) | `hyperlight/darwin-arm64-<inputs>/` | [`bench/hyperlight/build.ts`](bench/hyperlight/build.ts) from that source; `cargo fetch --locked`, then offline build |
| `JITK_SHARD_BINARY` (Linux) | `shard/linux-arm64-<inputs>/real` | shard `real` from this checkout, pinned toolchain; `cargo fetch --locked`, then offline build |
| `JITK_SHARD_SNAPSHOT` (Linux) | `shard-snapshot/linux-arm64-glue-2m-<key>/helpers` | `make -C arch/jitk/shard snapshot` (needs KVM; not part of `deps`); key = ring kernel + helper hash, see [`shard/README.md`](shard/README.md) |

The cache root is `$JITK_CACHE`, else `$XDG_CACHE_HOME/jitk`, else
`~/.cache/jitk`. It sits outside every checkout, so all clones and worktrees
share one copy and nothing needs ignoring. Entries are keyed by pin or by a
hash of their inputs (VMM: builder, patches, launcher and sandbox sources,
`.READY` state; Hyperlight: adapter crate, lockfile, builder, source commit,
toolchain; shard: its sources and the Rust pin), so checkouts at different revisions never share a stale build.
Each entry is built in a staging directory, renamed into place after its
manifest is written, and built under a lock in `locks/`. Expect about 1.8 GB,
mostly the Hyperlight Cargo target and the libkrun checkout.

Resolution is shared by every consumer ([`tslib/deps.ts`](tslib/deps.ts);
Makefiles use [`tools/deps.mk`](tools/deps.mk), shell uses `tools/.work/bin/deps env`):
an explicitly set variable always wins and is never rebuilt; otherwise the
cache path; a missing artifact is an error naming `make -C arch/jitk deps`,
never a skip. The delegate passes the selected values to every subtree.

Preinstalled prerequisites (not installed by `deps`): macOS arm64 with Xcode
command-line tools (`clang`, `codesign`, `strip`), `git`, `curl`, `make`,
rustup with the `rust_toolchain` pin from `tools/deps.json` (`1.95.0`, the one
Rust pin; make reads it as `$(CARGO_PIN)`, shell through
`tools/rust-toolchain.sh`) and `nightly-2026-10-20` (`rustup toolchain install nightly-2026-10-20
--profile minimal --component rust-src --target aarch64-unknown-none`). The
one-time scriptc install in `tools/` uses a PATH npm when there is one,
otherwise [`tools/npm.sh`](tools/npm.sh) bootstraps the pinned Node into the
cache. LLVM
`ld.lld` on `PATH` for the VMM test guests, zig 0.16 (`ZIG`, see
`tools/pin.mk`), and network access for Node, crates and Git sources on first
use. `make test`'s `linux` suite still needs the kvm-dev VM and Docker; see
[`linux/README.md`](linux/README.md).

On Linux arm64 (kvm-dev) `make deps` builds Node and the shard binary, and the
shard suites run from a clean clone with no variables set; see
[`shard/README.md`](shard/README.md) "Clean clone on Linux arm64".

MCP clients reach jitk through [`mcp/`](mcp/README.md): one `execute` tool that runs
code-mode JS in a parked single-use VM, plus file-backed skill/doc resources.

The TypeScript tooling in every subtree is compiled by the one scriptc 0.4.5
pin in [`tools/`](tools/package.json) (`tools/pin.mk`, `tools/scriptc.mk`) and
shares [`tslib/`](tslib/) for process, JSON, hashing, file and seeded random
helpers. Every child it spawns runs under the lost child-exit wakeup
workaround described in [SCRIPTC-HANG.md](SCRIPTC-HANG.md).

Prerequisites and platform restrictions belong to each subtree's README.
The top level delegates commands; apart from the `deps` cache it does not
install tools or implement a second build, VM launcher, benchmark, or grow controller. Missing subtrees or
entrypoints fail with their path and required owner action. A `.READY` file is
an owner's coordination signal, not independent proof of a gate.

Owner entrypoints are a subtree `Makefile` target or a same-named shell script:
`kernel/{build,test}`, `vmm/{build,test}`, `executor/{build,test,demo}`, `mcp/{build,test,bench}`,
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
silently lag its canonical TS source. `JITK_NODE` defaults to the pinned
cache Node; an override must be a verified absolute Node >=24 executable.
Build also delegates the executor README's `npm ci --ignore-scripts` prerequisite
to install locked dependencies locally when needed; the copied dangling cache
link is removed. A valid development symlink is retained. `JITK_NPM_CLI`
defaults to the `npm-cli.js` bundled with the cache Node (override with an
absolute path); it runs under the selected Node executable. npm cache defaults to `jitk-npm-cache` in the system temp directory
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
to that directory's `jitk-vmm` when isolating a verification run (by default
both select the cache entry). Set `JITK_KERNEL_CARGO_TARGET_DIR` for the
kernel's build cache. Hyperlight inputs default to the cache (see Clean clone);
nested Linux prerequisites use their documented explicit environment variables; the
integration receipt records and hashes the isolated inputs actually used.
