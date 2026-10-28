# Hyperlight baseline (owner 09)

Benchmark-only adapter; the product backend remains jitk. `backend.ts` uses
`executor/build/backend.js` for its lifecycle, canonical protocol dispatcher and
independent per-run watchdog. Build the executor before enabling adapter tests.
`bootstrap.js` is glue for Hyperlight's synchronous host bridge. Panic=abort.

## External inputs and build

Set `HYPERLIGHT_JS_SRC` to a Hyperlight JS checkout at commit
`8d208af8ac3ca53f2069c9ef0ca6a45d89e032d7` (repository:
https://github.com/hyperlight-dev/hyperlight-js). Its `src/hyperlight-js` and
`src/hyperlight-js-common` crates are external inputs; nothing is downloaded by
this adapter. The lockfile pins Hyperlight host 0.18.0. This HVF baseline needs
macOS/arm64, the source checkout's build prerequisites and cached Cargo crates.

Set `CARGO` and `RUSTC` to verified absolute executables from Rust nightly
2026-10-20, and make the checkout's required LLVM tools available. Never select
an unverified PATH launcher. `make build` compiles `build.ts` with the bench
package's pinned scriptc 0.4.5, then runs the native `../build/hyperlight-build`.
It stages the adapter crate beside a
symlink to `HYPERLIGHT_JS_SRC`, builds offline/locked, signs with canonical
`../../shard/hypervisor.entitlements`, then creates a tenant-free snapshot.

`HYPERLIGHT_BUILD_DIR` defaults to this directory's `build/`; output overrides
`HYPERLIGHT_WORKER` and `HYPERLIGHT_SNAPSHOT` select the worker and snapshot.
Choose a fresh snapshot destination when rebuilding. The build generates
`adapter.json` with the selected absolute paths for consumers. The shipped
unbuilt descriptor uses paths relative to its own directory.

`make -C ../.. deps` does all of the above into the jitk cache
(`../../README.md#clean-clone`): it fetches the pinned commit, runs this
builder with `HYPERLIGHT_FETCH=1` (`cargo fetch --locked` for the adapter
crate and the checkout's workspace before the offline build) and
`HYPERLIGHT_DESCRIPTOR` (the generated descriptor stays beside the cache
outputs instead of rewriting the tracked `adapter.json`). Unset
`HYPERLIGHT_JS_SRC`, `HYPERLIGHT_WORKER`, `HYPERLIGHT_SNAPSHOT` and `JITK_NODE`
select those cache entries (`HYPERLIGHT_BUILD_DIR`, when set, still selects
its own outputs). `make test` runs the adapter's checks with TypeScript
transformation enabled; missing or invalid inputs fail with setup
instructions naming `make -C arch/jitk deps`, and the test must pass all 13
checks. The only skip is on non-macOS hosts (HVF only). Existing built
artifacts can be supplied with the worker and snapshot overrides above.

## Benchmark

`/usr/bin/lockf -k /tmp/sofort-bench.lock ../build/hyperlight-bench 30 --output PATH` imports `../controller.ts` for load gates,
workers, result validation, aggregate watchdog and reports. It adds strict
prespawned Hyperlight and the exact Date.now 50 ms case. `Suite.sample` and
`memory_sample` remain reusable. Gate defaults: load1 <6, budget 0.1 s/sample;
timeouts are recorded as contention. This round makes no new timing claim.

Jitk uses `../../vmm/build/jitk-vmm` and `../../kernel/dist/kernel.bin`, or
`JITK_VMM_BINARY` and `JITK_KERNEL_IMAGE` (or owner 06's `JITK_IMAGE`). It uses the canonical `--image` CLI,
32 MiB, a profile compiled for the selected image directory and host sandbox
acknowledgement. Executor READY selects the integrated executor; otherwise the
same canonical artifacts run through the raw channel. There is no R2 fallback.

Cold begins before process spawn; parked begins before RUN after READY +5 ms.
Each strict unit is consumed once, killed and reaped. Refill/snapshot restore
stay outside parked latency. Logical clones share a hardware VM and include
clone creation in request latency. Memory uses macOS process footprint/RSS at
READY, excluding HVF kernel allocations. See `INTEGRATION.md` and the historical
`results/` receipts for measured selections and their load limits.

The benchmark and analysis controllers are compiled with `make -C .. build`; see
[the canonical harness](../README.md#typescript-implementation) for entrypoints
and parity evidence. Run collection under `/usr/bin/lockf -k /tmp/sofort-bench.lock`.
