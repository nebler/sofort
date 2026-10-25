# Execution record (2026-10-24, macOS 26.6.1 / arm64)

All deliberate source/build/artifact writes were directed to this directory or
`/tmp/jitk-09`; `/tmp/jitk-spike` was read-only. Cargo/rustup used their existing
shared caches/toolchain storage. One copied `node` executable was actually a
Vite+ launcher: executing the copy auto-provisioned Vite+ runtime/shims under
`~/.local/share/vite-plus`, outside the requested directories, before failing
HVF. This was unintended; no safe rollback of the shared installation was
attempted. Subsequent native-addon tests used a signed copy of the actual Node
24.22.1 binary at `/tmp/jitk-09/node-real`.

## Builds

- `git clone --depth 1 https://github.com/hyperlight-dev/hyperlight.git /tmp/jitk-09/hyperlight`
  → `8a7e6b8794fea050ce287eed614088f0beb6b973`, version 0.18.0.
- `git clone --depth 1 https://github.com/hyperlight-dev/hyperlight-js.git /tmp/jitk-09/hyperlight-js`
  → `8d208af8ac3ca53f2069c9ef0ca6a45d89e032d7`, version 0.4.0.
- `RUSTUP_TOOLCHAIN=1.95.0 CARGO_INSTALL_ROOT=/tmp/jitk-09/tools cargo install cargo-hyperlight --version 0.1.14 --locked`
  → success, compile 14.76 s.
- In hyperlight clone: `RUSTUP_TOOLCHAIN=1.95.0 cargo build --release -p hyperlight-host --no-default-features --features hvf`
  → success, 75 s; rlib 7.5 MiB. Its checked-in 1.99.1 override was not used.
- In hyperlight-js: `RUSTUP_TOOLCHAIN=1.95.0 PATH=/tmp/jitk-09/tools/bin:/opt/homebrew/opt/llvm/bin:$PATH cargo build --release -p hyperlight-js --example run_handler`
  → failed guest build: `This toolchain cannot build for aarch64-hyperlight-none.`
  `error: error loading target specification: custom targets are unstable and require -Zunstable-options`.
- `RUSTUP_TOOLCHAIN=nightly ... cargo build ...` → failed because installed
  unpinned nightly is rustc **1.87.0-nightly**, but dependencies need >=1.89.
- `rustup target add aarch64-unknown-none --toolchain nightly-2026-10-20` → success.
- `RUSTUP_TOOLCHAIN=nightly-2026-10-20 PATH=/tmp/jitk-09/tools/bin:/opt/homebrew/opt/llvm/bin:$PATH CARGO_TARGET_DIR=/tmp/jitk-09/adapter-target cargo build --release --manifest-path arch/09-hyperlight-backend/Cargo.toml`
  → success, initial build 174 s; rustc 1.101.0-nightly (07e526db9 2026-10-19).
  Host Mach-O about 4 MiB, AArch64 Hyperlight guest ELF about 2.3 MiB.
- Same environment, in hyperlight-js clone: `cargo build --release -p js-host-api`
  → success, 59.27 s; `libjs_host_api.dylib` 5,043,040 bytes.
  Copied to `/tmp/jitk-09/js-host-api.node`; no npm install needed.
- Signed host executables with `codesign -f -s - --entitlements /tmp/jitk-09/hyperlight-js/dev/macos-entitlements.plist <binary>`.
  Signing a launcher rather than the process that calls HVF yielded exact error
  `VM creation failed: HVF error: 0xfae94007`; signing actual Node fixed it.
- Initial experiment used Rust module `math` with import `host:math` →
  `Error resolving module 'host:math' from './handler.js'`.
  Rust uses exact registry names; **NAPI adds `host:`**. Both corrected and run.
- A single-line script explicitly exporting handler triggered
  `duplicate exported name 'handler'`; plain `function handler` lets upstream
  add its export. Benchmark sources now avoid that issue.

## Runs

Let `B=/tmp/jitk-09/adapter-target/release/jitk-hyperlight-spike`,
`S=/tmp/jitk-09/adapter-target/release/snapshot_clone`, and this directory `D`.
Commands run from scratch root unless noted:

- `$B bench > $D/bench.jsonl` → success: 40 creations, 200 measured calls per
  kind after 10 warmups, 40 snapshot/restore mutations checked.
- `$B memory > $D/memory.jsonl` → 32 resident independently initialized sandboxes,
  then 128 alternating host calls, all return 42.
- `python3 $D/fresh.py $B > $D/fresh.jsonl` → 40 fresh processes, all return 42.
- `$B parallel 1` / `$B parallel 4` → 30 / 120 calls of a 1,000,000-iteration
  QuickJS loop: 1.348279250 s / 5.455550584 s, respectively. One trial per
  configuration; throughput **22.25 / 22.00 calls/s**. Not confidence intervals.
- `node --experimental-transform-types $D/backend-smoke.ts` →
  `{result:42,checked:4,errors:true,promises:[3,7],deadline_ms:102.934}`.
  Includes actual asynchronous host I/O delay, rejection propagation,
  Promise.all, and infinite guest killed by a 100 ms external deadline.
- `/tmp/jitk-09/node-real $D/napi-bench.cjs > $D/napi.jsonl` → native addon
  40 creations + 200 interleaved measured plain/async-host calls, all 42.
- `$S > $D/clone.jsonl` → 40 snapshot-backed logical sandbox creations and
  32 simultaneously resident clones; each clone counter returns 1 then 2,
  proving this test's mutable JS state did not cross instances.
- `$S save > $D/disk-save.json` → OCI layout 6.0 MiB, save 37.768 ms (n=1).
- `python3 $D/fresh.py $S load > $D/disk-fresh.jsonl` → 40 fresh Apple-VM
  processes load the same OCI snapshot and call the JS handler; all 42.
  Warm filesystem cache; cold-storage performance NOT measured.
- Signed `load_linux /tmp/jitk-spike/sc/qjs-static` initially hung; rerun with
  Python `subprocess.run(...,timeout=3)` → killed at 3.046973 s, after
  `loading static ELF` / `ELF load returned, entering evolve`; no JS result.
- `docker run --rm --pull=never alpine:3.22 sh -c 'uname -m; test -c /dev/kvm; echo kvm_device_present=$?'`
  → `aarch64`, `kvm_device_present=1` (test exit code 1: absent).
- `sandbox-exec -p '(version 1)(allow default)(deny network*)' $B one`
  → success, result checked 42; creation 50.678 ms (single run, not perf data).
  This verifies HVF coexists with a network-denying Seatbelt profile, not that
  the VMM is otherwise fully confined.

Summaries: `python3 $D/summarize.py $D/<bench|memory|fresh|clone|disk-fresh|napi>.jsonl`.
Raw nanoseconds and process-memory readings are retained as text artifacts here.

- Generic `bootstrap.js` run through the signed sidecar with event code
  `return await math.add(20,22)` → exact call frame `{t:"call",id:0,ns:"math",fn:"add",args:[20,22]}`, then `{t:"done",result:42}`.

Final validation: release `cargo build --locked` succeeded (50.88 s with concurrent host load); shell/Python syntax checks passed; raw sample counts and the <400-line proposal limit passed.
