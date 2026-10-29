# jitk

A single-use microVM executor for submitted JavaScript: every run gets its own
hardware VM, restored from a snapshot and reset afterwards, and tool calls
leave the VM only through trusted, policy-checked host code. Alongside it,
GrowOS, a development loop that grows the restricted Linux syscall surface
static guest programs need.

- [Architecture](docs/ARCHITECTURE.md): how a run works, the components, the
  engines and their trust boundaries.
- [Cross-subtree contracts](CONTRACTS.md), [`.READY` markers](docs/READY.md),
  [measurement reports](docs/results/README.md).
- Raw run evidence lives outside git: `tools/.work/bin/evidence fetch PATH`
  restores any file listed in [the manifest](../../evidence/README.md).
- The round-4 [claims](docs/CLAIMS.md) and [kill criteria](docs/KILL-CRITERIA.md)
  are frozen records of that review, not the current state.

## First steps

From the repository root, on a new host:

```sh
make -C arch/jitk doctor
```

It checks rustup and the pinned toolchains and targets, the native tools
(Xcode `clang`, `ld.lld`, `llvm-objcopy`; on Linux `cc`, `clang`, `lld`,
`llvm`), the deps cache for this platform, Docker (only for GrowOS oracle
runs), on the Mac the Linux dev VM (`JITK_NESTED_SSH`, default
`kvm-dev/ssh.sh`) and its `/dev/kvm`, and on Linux local `/dev/kvm`. Every
problem is one line ending in the exact fix command. It exits non-zero only
when a hard requirement is missing (`warn` lines are optional or are built by
`make deps`, which `make build` runs anyway), in about 2 s
([`tools/doctor.ts`](tools/doctor.ts)).

From this directory:

```sh
make doctor         # host check (above)
make deps           # pinned Node/npm, zig, the shard engine, Hyperlight → jitk cache
make build          # kernel → protocol generated JS → executor → MCP → grow
make test           # layering lint, docs checks, then every suite (macOS: with the HVF engine)
make bench          # canonical load-aware benchmark harness
make demo           # executor demo, then a GrowOS deletion/regrowth transaction and its Lua boots
make loc            # reproducible owned-source line inventory
make ci             # every Linux arm64 check (below)
```

`make -C executor parity-ssh` runs the Linux KVM suites on the kvm-dev VM
from the Mac.

## Engines

The executor and the MCP server run on the ring engine ([`shard/`](shard/README.md)),
selected by [`executor/select-backend.ts`](executor/select-backend.ts) from
`JITK_SHARD_BINARY` and `JITK_SHARD_SNAPSHOT`:

- macOS arm64: the HVF engine (`hvf ipc`, `JITK_BACKEND=hvf`), the
  development engine;
- Linux arm64: the KVM shard (`real ipc`, `JITK_BACKEND=shard`).

The console kernel profile (`kernel/build.sh`, virtio console, protocol v1 on
stdio) is booted only through the HVF engine's console runner `hvf console`,
by GrowOS, `scriptc-corpus`, the kernel suite and the protocol VM tests.

MCP clients reach jitk through [`mcp/`](mcp/README.md): an `execute` tool that
runs code-mode JS in a parked single-use VM, a `run` tool for whole static
programs from prepared native profiles, and file-backed resources.

## Clean clone and the deps cache

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
| `JITK_ZIG` | `zig/0.16.0-{darwin,linux}-arm64/zig` | ziglang.org tarball, sha256 pinned in `tools/deps.json`; the static aarch64 Linux cross-linker ([`tools/zig-cc.sh`](tools/zig-cc.sh)) and `zig cc` for C cross-builds. Makefiles read it as `$(ZIG)` ([`tools/pin.mk`](tools/pin.mk)); an explicit `ZIG` or `JITK_ZIG` wins |
| `HYPERLIGHT_JS_SRC` (macOS) | `src/hyperlight-js-<commit>/` | `git fetch --depth 1` of the pinned commit |
| `HYPERLIGHT_WORKER`, `HYPERLIGHT_SNAPSHOT` (macOS) | `hyperlight/darwin-arm64-<inputs>/` | [`bench/hyperlight/build.ts`](bench/hyperlight/build.ts) from that source; `cargo fetch --locked`, then offline build |
| `JITK_SHARD_BINARY` | `shard/{linux,darwin}-arm64-<inputs>/{real,hvf}` | the shard binary from this checkout, pinned toolchain; `cargo fetch --locked`, then offline build. Linux: `real` (KVM); macOS: the HVF engine `hvf`, ad-hoc signed with [`shard/hypervisor.entitlements`](shard/hypervisor.entitlements). Both also serve `process-watchdog` (the process backends' deadline watchdog); `hvf console` boots the console kernel profile |
| `JITK_SHARD_SNAPSHOT` | `shard-snapshot/{linux,darwin}-arm64-glue-2m-<key>/helpers` | `make -C arch/jitk/shard snapshot` (prepared by `JITK_SHARD_BINARY`; not part of `deps`); key = ring kernel + helper hash, see [`shard/README.md`](shard/README.md) |

The cache root is `$JITK_CACHE`, else `$XDG_CACHE_HOME/jitk`, else
`~/.cache/jitk`. It sits outside every checkout, so all clones and worktrees
share one copy and nothing needs ignoring. Entries are keyed by pin or by a
hash of their inputs (Hyperlight: adapter crate, lockfile, builder, source
commit, toolchain; shard: its sources and the Rust pin), so checkouts at
different revisions never share a stale build. Each entry is built in a
staging directory, renamed into place after its manifest is written, and built
under a lock in `locks/`. Expect about 1.3 GB, mostly the Hyperlight Cargo
target and the prepared shard snapshots.

Resolution is shared by every consumer ([`tslib/deps.ts`](tslib/deps.ts);
Makefiles use [`tools/deps.mk`](tools/deps.mk), shell uses
`tools/.work/bin/deps env`): an explicitly set variable always wins and is
never rebuilt; otherwise the cache path; a missing artifact is an error naming
`make -C arch/jitk deps`, never a skip. The delegate passes the selected values
to every subtree. Set `JITK_SHARD_BINARY` and `JITK_SHARD_SNAPSHOT` to isolate
a verification run's engine, `JITK_KERNEL_CARGO_TARGET_DIR` for the kernel's
build cache. The executor records the engine and snapshot it actually used in
`executor/.work/integration-selection.json`.

Preinstalled prerequisites (not installed by `deps`): macOS arm64 with Xcode
command-line tools (`clang`, `codesign`, `strip`), `git`, `curl`, `make`,
rustup with the `rust_toolchain` pin from `tools/deps.json` (`1.95.0`, the one
Rust pin; make reads it as `$(CARGO_PIN)`, shell through
`tools/rust-toolchain.sh`) and `nightly-2026-10-20` (`rustup toolchain install
nightly-2026-10-20 --profile minimal --component rust-src --target
aarch64-unknown-none`), LLVM `ld.lld` (Homebrew) for the kernel and grow
probes, and network access for Node, zig, crates and Git sources on first use.
The one-time scriptc install in `tools/` uses a PATH npm when there is one,
otherwise [`tools/npm.sh`](tools/npm.sh) bootstraps the pinned Node into the
cache. `make doctor` checks all of these. The Linux KVM suites need the
kvm-dev VM; Docker is only needed by grow's `jitk-oracle:08` oracle runs.

On Linux arm64 (kvm-dev) `make deps` builds Node, zig and the shard binary,
and the shard suites run from a clean clone with no variables set; see
[`shard/README.md`](shard/README.md) "Clean clone on Linux arm64".

## CI

`make ci` ([`tools/ci.sh`](tools/ci.sh)) is the single entrypoint for a clean
Linux arm64 host. It runs `doctor` and `deps` (a failure stops the run), then
the layering lint, `abi test`, the kernel build, a check that the built image
has `kernel/.READY`'s hash (Linux builds the Mac's bytes; see
[`kernel/ARCH.md`](kernel/ARCH.md) "Image identity"), the kernel host checks,
`docs test`, shard `make test`, protocol, the executor checks that need no
engine, policy, the MCP build and native test, tslib, bench, grow and every
scriptc build. With a usable `/dev/kvm` it also runs `shard snapshot`,
`shard test-kvm`, `executor/ipc/shard-host.sh`, the executor checks on the
shard (`verify`, `wrapper-conformance`, `api-check`, `policy-check`) and
`mcp test`, all under `$JITK_BENCH_LOCK`, plus `make test-linux`. It ends by
checking that the git checkout is still clean. Every skipped part prints its
reason, and the run exits 1 if any step failed. The kernel regression and
fs_diff suites (the console kernel on `hvf console`, Homebrew `ld.lld`),
Hyperlight and HVF stay in the Mac's `make test`. `JITK_CI_KVM=0` skips the
KVM part and `JITK_CI_KVM=1` requires it.

[`.github/workflows/jitk-ci.yml`](../../.github/workflows/jitk-ci.yml) runs it
on GitHub's `ubuntu-24.04-arm` runner (2 vCPU, 8 GB) for pushes to `main`,
pull requests and manual dispatch, only for changes under `arch/jitk/` or to
the workflow. It installs only what `doctor` asks for and caches the jitk deps
cache, npm cache and cargo registry, keyed by `tools/deps.json` and the
lockfiles. GitHub's arm64 runners expose no `/dev/kvm`, so the KVM part is
skipped there; it runs on kvm-dev (`make -C arch/jitk ci`) or on a
self-hosted KVM runner with `JITK_CI_KVM=1`.

## How the top level works

The top level delegates commands ([`docs/delegate.ts`](docs/delegate.ts),
[`docs/dispatch.ts`](docs/dispatch.ts)); apart from the `deps` cache it does
not install tools or implement a second build, VM launcher, benchmark or grow
controller. Owner entrypoints are a subtree `Makefile` target or a same-named
shell script: `kernel/{build,test}`, `executor/{build,test,demo}`,
`mcp/{build,test,bench}`, `protocol/{build,test}`, `grow/{test,grow,demo}`
and `bench/{test,bench}`. Missing subtrees or entrypoints fail with their
path. `demo` and `bench` require the `.READY` markers listed in
[docs/READY.md](docs/READY.md); a marker is a coordination signal, not proof.
Before every `test*` action the delegate runs the evidence guard
(`evidence check`) and afterwards checks that the git state is unchanged.

`make test` first runs the layering lint ([`tools/layering.ts`](tools/layering.ts)):
guest code references only guest code, the Rust engine (`shard/src`) only
engine or guest code, and the import closure of the product entry points (MCP
server, executor, policy, protocol dispatcher) contains no bench, grow, docs,
tools or tslib file, no evidence path and no `.READY` name.

Protocol build always precedes executor build, so generated decoder JS cannot
lag its TS source. `JITK_NODE` defaults to the pinned cache Node; an override
must be a verified absolute Node >=24 executable. `JITK_NPM_CLI` defaults to
the `npm-cli.js` bundled with the cache Node and runs under the selected Node.
Build runs the executor's `npm ci --ignore-scripts` to install locked
dependencies locally when needed (a valid development `node_modules` symlink
is kept). The npm cache defaults to `jitk-npm-cache` in the system temp
directory (`JITK_NPM_CACHE` overrides); no global packages or toolchains are
installed.

The TypeScript tooling in every subtree is compiled by the one scriptc 0.4.5
pin in [`tools/`](tools/package.json) (`tools/pin.mk`, `tools/scriptc.mk`) and
shares [`tslib/`](tslib/) for process, JSON, hashing, file and seeded random
helpers. Every child it spawns runs under the lost child-exit wakeup
workaround described in [SCRIPTC-HANG.md](SCRIPTC-HANG.md).

No production performance, broad Linux compatibility or complete containment
claim follows from this prototype; [`../PRODUCT-GAPS.md`](../PRODUCT-GAPS.md)
lists what a product would still need.
