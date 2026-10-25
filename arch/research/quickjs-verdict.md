# QuickJS for jitk: verdict (2026-10-24)

Raw numbers: `quickjs-verdict.json` (same dir). Build/bench dir: `/tmp/jitk-qjs-bench`.

## Verdict

**Keep the QuickJS family, and keep Bellard over quickjs-ng. Confidence: about 85% that QuickJS is right for this workload, about 65% that Bellard beats ng for it.** Two things need correcting, though. "QuickJS is fast" is not supportable. It is a slow-but-small interpreter that is fast enough for glue code. And the pinned 2026-06-04 release is 4.5 months behind Bellard's git (see Security).

## 1. Measurements (native, Apple M4 Pro, engines built from source)

Method: separate processes, n=20 per cell (startup n=30), sequential. Each process ran 8 in-script reps (numeric: 3). "Warm" is the median of reps 2..N, reported as median / p90 across processes. Check values match across all engines.

**Load caveat:** the host was not quiet. A Virtualization.framework VM sat at about 76% CPU, and load1 ranged 4.7 to 14 (per-config values are in the JSON). Treat ratios as indicative. Absolute ms are noisy, though p90/median spread is under 5% for most cells.

Builds, all upstream defaults:
- Bellard 2026-06-04: `make qjs`, clang -O2 -g.
- ng v0.17.0: cmake Release, -O3.
- Hermes: git 393a539, interpreter only.
- Node v24.22.1: default and `--jitless`.
- JSC: macOS system `jsc` with `JSC_useJIT=0`.

QuickJS runs used a C harness with `JS_SetMemoryLimit` of 16 MiB, the same as jitk.

### Time, ms (warm median / p90)

| Benchmark | Bellard | ng | Hermes* | JSC no-JIT | Node --jitless | Node JIT |
|---|---|---|---|---|---|---|
| Process start to `-e 1` (wall) | 5.3 / 5.7 | 5.2 / 5.5 | 9.8 / 10.5 | 8.6 / 9.2 | 34.4 / 35.8 | 34.7 / 36.5 |
| Runtime+context create, in-process (µs) | 47 / 52 | 58 / 63 | n/a | n/a | n/a | n/a |
| 1 MiB JSON, one string value (jitk's `json1m` case) | 6.3 / 6.4 | 5.0 / 5.1 | 1.4 | 0.34 | 1.2 | 1.2 |
| 1 MiB JSON, 7000 objects (parse+stringify) | 21.2 / 21.3 | 24.2 / 24.5 | 8.6 | 4.3 | 6.6 | 6.5 |
| map/filter/reduce, 10k objects | 4.2 / 4.3 | 4.9 / 5.1 | 3.2 | 3.1 | 2.2 | 0.92 |
| string build, regex, split, 1 MB | 32.0 / 32.2 | 51.5 / 51.9 | 45.2 | 25.6 | 14.8 | 9.5 |
| 1000 awaited resolved promises | 0.44 / 0.46 | 0.40 / 0.40 | 0.43 | 0.10 | 0.11 | 0.11 |
| CPU kernel (fib(27) + 5M-iteration int loop) | 140 / 144 | 162 / 206 | 239 | 141 | 128 | 46 (first rep 11) |

*Hermes uses the 1 ms `Date.now` clock, so its sub-5 ms cells are mean-of-reps and coarse.

- The Bellard-vs-ng gaps are mostly 15% to 60% and in Bellard's favor, but ng wins the one-string JSON case by 20% (see the JSON findings). The 3.6x gap on the numeric kernel (Bellard vs Node JIT) understates the worst case, because V8's first rep was 11 ms.
- The first numeric attempt used global-scope `var` and a float `%`, which penalized the JITs. I fixed it with an IIFE and `Math.imul`. The v1 raw data is at `/tmp/jitk-qjs-bench/res/raw-v1-global-scope.json` and is not used.

### Memory

| Metric | Bellard | ng | Hermes | JSC no-JIT | Node |
|---|---|---|---|---|---|
| Peak RSS, `-e 1` (MiB) | 2.1 | 2.2 | 9.8 | 6.3 | 42.5 |
| Peak RSS, 1 MiB structured JSON, 8 reps (MiB) | 18.9 | 22.9 | 42.2 | 37.4 | 79.5 |
| Peak RSS, string benchmark (MiB) | 12.0 | 22.2 | 45.4 | 56.0 | 154 |
| Fresh runtime+context: heap used / malloc (KiB) | 65 / 151 | 84 / 90 | n/a | n/a | n/a |
| Min `--memory-limit` that passes, one parse+stringify of structured 1 MiB JSON | **8 MiB** | 9 MiB | n/a | n/a | n/a |
| Same, 8 reps in a loop | 16 MiB | 16 MiB | n/a | n/a | n/a |

- QuickJS has the lowest memory of every engine tested, 2x to 10x lower than the others. This is its real strength.
- **Heap expansion is large.** About 1 MiB of structured JSON needs about 7 to 8 MiB of JS heap to parse and re-stringify once, including the source string. Bellard's own doc says 64-bit JSValues are 128-bit ("memory usage is less critical"). Under jitk's 16 MiB cap you can hold roughly two copies of 1 MiB of structured JSON, not tens of MiB. The 8-rep loop only fits at exactly 16 MiB.
- Cycle GC pauses and refcount leaks were not measured. Single-use VMs largely neutralize them, because the VM is discarded.
- The doc says: "Reference counting ... A separate cycle removal pass is done when the allocated memory becomes too large."

## 2. Findings that complicate our story

1. **Our JSON benchmark is a memcpy-class case.** `json1m` in `jitk/bench/cases.json` is `{"x":"xxxx...1 MiB"}`, a single string. It says nothing about structured JSON. On realistic structured JSON, Bellard is 21 ms natively, 3.2x slower than Node and 5x slower than JSC without JIT. Hermes is 2.5x faster, and this gap is not about JIT (Node `--jitless` matches Node JIT). QuickJS's JSON parser is simply slower. 21 ms is still negligible against an LLM turn or a tool RTT. But "4.5 ms vs 8.1 ms" must not be generalized.
2. **The Hyperlight comparison is Bellard vs quickjs-ng.** hyperlight-js 0.4.0 uses `rquickjs 0.12`. Our own `jitk/bench/hyperlight/Cargo.lock` pins rquickjs-sys 0.12.2. I inspected that crate's source, and it vendors **quickjs-ng 0.15.1** (`QJS_VERSION_MINOR 15`, `PATCH 1`). So "Hyperlight's JS also uses QuickJS" is true only loosely. It is not Bellard's engine.
3. **Bellard beats ng here**, contrary to the usual "ng is faster/newer" assumption. Across the cells it is 1.1x to 1.6x faster on string, map/filter, structured JSON and the numeric kernel, and about 1.2x slower on single-string JSON. A third-party nightly agrees (ahaoboy/js-engine-benchmark, macOS arm64: quickjs 1971, quickjs-ng 1672, hermes 1790, v8 64629). Bellard's 2026-06-04 changelog claims "micro optimizations (30% faster on bench-v8)" and "custom malloc for small blocks (11% faster)". I did not verify those claims, and the custom malloc may behave differently on musl.
4. **10.7 MiB footprint attribution is not verifiable.**
   - `jitk/bench/RESULTS*.md` say parked footprint "excludes HVF kernel allocations", so guest RAM may not be counted at all.
   - What I can show: the guest image is 2.79 MiB (manifest `bytes: 2924544`). The shipped static qjs is 2.39 MiB. Natively, the bootstrap `qjs --std` peaks at 1.38 MiB footprint (vs 1.15 MiB for `-e 1`), and a fresh QuickJS heap is under 0.2 MiB.
   - So QuickJS's own heap is at most a few percent of 10.7 MiB. The remainder (about 7 MiB, VMM process plus image copy) is consistent with the claim, but I did not measure it. Hyperlight's parked footprint is 1.8 MiB vs our 10.7 MiB, and that gap is not QuickJS's doing.
5. **Not verified: the shipped binary matches the tarball.** The tarball sha256 (below) is not tied to `kernel/payload/qjs` (sha `ea2367e9...`, musl aarch64, stripped), and no reproducible build exists here.

## 3. Published criticisms vs evidence

| Claim | Evidence | Status |
|---|---|---|
| Much slower than V8 JIT | Measured 2x to 5x steady state, up to 13x on first-rep numeric. Third-party: V8 about 30x higher score on bench-v8. | **True.** Fact, not opinion. |
| Slower than other interpreters | Roughly equal to JSC no-JIT and V8 `--jitless`. Slower on JSON and strings than JSC. Faster than Hermes on numeric and strings. | Mixed |
| Memory hungry | Lowest RSS of all tested. But heap expansion on structured JSON is about 7x, and 128-bit JSValues. | **Mostly false vs other engines, true in absolute terms.** |
| Refcount+cycle GC pauses/leaks | Documented design (Bellard doc 4.3.5). Not measured. CVE-2025-69653/69654 are asserts in `JS_FreeRuntime` and GC with `qjs -m` and low memory limits. | Unverified for our use |
| Script evaluation slow for big scripts | Android/Huawei test cited in an OpenQuickJS commit message (not independently verified). | Anecdote |

Sources, performance:
- Bellard doc: https://bellard.org/quickjs/quickjs.html ("less than 300 microseconds" runtime life cycle, 210 KiB hello world). Our measured create cost is 47 µs, consistent with that.
- https://bellard.org/quickjs/bench.html returned 404.
- https://github.com/ahaoboy/js-engine-benchmark (hardware unspecified)
- https://boajs.dev/benchmarks (no numbers retrievable)

## 4. Security track record

- **Bellard CVEs (NVD keyword search "quickjs", 29 hits, includes ng and njs).** Real UAFs and type confusions with attacker-controlled code exist:
  - Oct 2025 batch of 7 (CVE-2025-62490 through 62496, CVSS up to 8.8), which are UAF, type confusion and integer overflow; filed via Google issue tracker.
  - CVE-2025-12745 (`js_array_buffer_slice` over-read, fixed by a commit).
  - CVE-2025-69653/69654 (DoS, `qjs -m`).
  - CVE-2026-88378 (heap OOB write in `JS_ReadFunctionTag`). It is reachable only through untrusted bytecode. The maintainer replied "Works as designed: the bytecode is not verified", and the issue closed about 7 weeks after it was opened.
  - We load source, not bytecode, so the bytecode class does not apply.
- **OSS-Fuzz:** QuickJS is enrolled (`google/oss-fuzz/projects/quickjs`: asan/msan, afl/honggfuzz/libfuzzer). I could not verify how many CVEs came from it.
- **quickjs-ng:** has more CVEs (2024-13903, 2025-46687/88, 2026-0821/0822/1144/1145/3979, 2026-37630 RCE in `js_mapped_arguments_mark`, 0.12.1). Release notes show heavy memory-safety fixing: v0.16.0 lists many UAFs and double frees, and v0.13.0 fixes a regex OOB read. That means fast patching and also a high bug rate in the newer code. SECURITY.md covers bytecode only: "We no longer accept private security reports nor issue CVEs."
- **Cadence:**

  | | Bellard | ng |
  |---|---|---|
  | Tagged releases | 2025-04-26, 2025-09-13, 2026-06-04 (earlier gap: 2021-03 to 2023-12) | 10 releases from 2026-02-10 to 2026-09-18 (v0.17.0 latest) |
  | Fixes between releases | git: 193 commits since 2025-09-13 | in releases |

  - Bellard's fixes land in git well before releases. For example, the 2025-12-11 commits fixed CVE-2025-69653/69654 in a release cycle whose tag was dated 2025-09-13.
  - Since our 2026-06-04 pin, git has 67 commits, including "fixed memory leak in Atomics.store", BigInt `AsUintN`, `ArrayBuffer.resize`, and regexp unicode-set fixes. I did not assess which are exploitable.
  - Git HEAD also added "experimental AI coded Temporal and Intl" on 2026-10-10 (commit 97f64ef), which we should not take wholesale.
- **Neither project claims to be a hostile-JS sandbox.** jitk's VM boundary is the right layer, and the engine is not the trust boundary.

## 5. Who uses it (verified from primary sources)

| User | Verified? | Source |
|---|---|---|
| Shopify Javy (QuickJS compiled to Wasm) | Yes. Shopify measured about 3x slower than Rust-Wasm and stated plans to bring SpiderMonkey to Wasm for "significant performance improvements compared to QuickJS". | https://shopify.engineering/javascript-in-webassembly-for-shopify-functions |
| Figma plugins (QuickJS to Wasm) | Yes. "somewhat slower for certain plugins, but intrinsically more secure". | https://www.figma.com/blog/an-update-on-plugin-security/ |
| Hyperlight-js | Yes, but it is quickjs-ng 0.15.1 via rquickjs (see Finding 2). | https://github.com/hyperlight-dev/hyperlight-js; local crate `rquickjs-sys-0.12.2` |
| Cloudflare | **No evidence found.** workerd is V8. Only third-party QuickJS-in-Wasm adapters run on Workers. | do not claim |

Alternatives, with the reasons found:
- V8 and SpiderMonkey need a JIT, which Wasm cannot do (Shopify). V8 here costs 42 MiB RSS and 35 ms startup, so it cannot fit a 32 MiB guest.
- Hermes: 9.8 MiB RSS at startup (5x QuickJS) and 1.9x the start time. It needs C++ and is slower on numeric, strings and map/filter, but 2.5x to 4x faster at JSON. Porting costs are unknown.
- Duktape, JerryScript, Boa: much lower scores in the ahaoboy table (Duktape 889, Boa 232, JerryScript 384, vs QuickJS 1971 on macOS arm64).

## 6. Where the verdict flips

- **Large JSON or heap.** More than 2 MiB of live structured JSON overflows the 16 MiB cap, and raising the cap would break the 32 MiB guest. This is the first limit users will hit.
- **CPU-heavy user code** (loops over more than 100k to 1M items): 3x to 13x slower than V8. Budget with the watchdog.
- **JSON-dominated workloads:** consider Hermes or JSC-class engines.
- **Long-lived VMs:** cycle-GC behavior is unmeasured.
- **Security:** if fix lag becomes the concern, bump the pin to a reviewed git commit that predates Temporal/Intl, or move to ng. ng's higher bug rate cuts the other way.

## 7. Statements we can make publicly (verified here)

1. The pinned tarball `quickjs-2026-06-04.tar.xz` has sha256 `b376e839b322978313d929fd20663b11ba58b75df5a46c126dd19ea2fa70ad2a`. This matches the pin in `04-executor-ts/setup-qjs.sh`. Bellard publishes no checksum, so this proves consistency only, not authenticity.
2. On an Apple M4 Pro, `qjs -e 1` takes about 5.3 ms start to exit, versus about 35 ms for Node. A QuickJS runtime+context takes about 47 µs to create. Peak RSS for a trivial script is about 2 MiB, versus 42 MiB for Node.
3. QuickJS used 2x to 10x less memory than Hermes, JSC, and Node in our benchmarks, and is 2x to 5x slower than V8 on steady-state glue code (about 13x on first-run numeric). It is roughly on par with V8 `--jitless` and JSC without JIT, except for JSON and strings, where those are faster.
4. 1 MiB of structured JSON needs about 8 MiB of JS heap to parse and re-stringify once.
5. Bellard 2026-06-04 outperformed quickjs-ng 0.17.0 on 4 of 6 benchmarks here (not on single-string JSON or the 1000-promise loop), with lower RSS.

**Do not claim:** "QuickJS is fast" without qualifiers; QuickJS is "secure" or hardened; test262 pass rates (I could not retrieve numbers; Bellard says "nearly 100%" in its own docs, ng says it runs the full suite per change); that Hyperlight uses the same engine; that 10.7 MiB is "mostly VMM"; that Cloudflare uses QuickJS; or the Next Token podcast as a speed endorsement.
