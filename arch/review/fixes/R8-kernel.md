# R8 kernel fixes

Agent `r8-kernel`; worktree `/Users/noah/.t3/worktrees/sofort/t3-e1a904d1`, branch
`t3/kernel-safety-fixes`. No push. Implementation scope is kernel source/build
scripts, verification metadata and `.READY`; this report is the deliverable.
No source changes under shard/executor, kernel/tests, kernel/test-work, or
kernel/bootstrap.js. Metadata refresh was explicitly authorized by the lead.

## Findings and proof

| Finding | Change / commits | Regression or verification |
|---|---|---|
| R04 / A14 | `97c9e3f`: one strict Python JSON parse produces both dispatch and manifest; reject duplicate/noncanonical numbers, invalid identifiers, wrong shapes and trailing input. | `build-checks.py Slots`: **saw fail before fixing** (minification dropped 25 arms); now pretty/minified dispatch **and manifest are byte-identical**. Replayed failure on original baseline; `dist/r8/before-slots-borrowing.log`. |
| R01 kernel | `40c926c`, `1dbae40`: `get` returns copied metadata; `with_open` lends an exclusive borrow under an atomic RAII guard. Descriptor close/alloc/dup cannot invalidate a borrow; callbacks cannot return it. Positional reads retain their real scoped borrow and never change the offset. | **Saw the old API compile two live mutable aliases before fixing**. The compile-fail test now rejects escaping a callback borrow. Runtime tests cover reentry and shared dup offsets/independent flags, both builds; original archive corruption/stat/pread tests pass. |
| R18 | `a5610af`: safe checked FDT cursor, bounded structure/string blocks and names, bounded node stack, checked ASCII decimal/hex parsing, checked header mapping before forming raw slices. | **Saw fail before fixing on kvm-dev**: `jitk.epoch_ns=:` was accepted. Now rejects it, empty/negative/overflowing decimal, corrupt offsets/lengths, unterminated names and every truncated fixture; valid configuration remains accepted. `dist/r8/before-fdt.log`, `src/fdt_checks.rs`. |
| A11 / R10 / R12 kernel | `b694504`, `2904fea`: console entries live in the same fd table; remove the repeated ring-only handler checks. Named file/directory extents and `PendingState` replace `a/b` and byte states. | Complete kernel contracts, eleven subtree suites, native fd/region probes and 82/82 native tuples. |
| R06 kernel | `2904fea`: remove the crate-wide `static_mut_refs` allowance; keep exclusive fd ownership real; document unsafe function and block contracts (EL1, masked IRQs, initialization, bounds, publication, quiescence and lifetimes). Narrow raw copy/MMU/iovec boundaries; safe dispatch emits no unsafe arms. | Both configurations pass `-D warnings -D clippy::undocumented_unsafe_blocks`. No blanket unsafe-warning allowance. |
| R09 / R14 / R19 kernel | `2904fea`: named syscall/ESR constants and kernel-local GPA/ring ABI mirror, six-register dispatcher and runtime handler args, direct checked console read from readv, copied iovecs, `div_ceil`/range/format idioms. | Both Clippy builds, full contract and integration gates; unchanged ABI/layout confirmed by native corpus and layout defense. Existing grow-candidate/host-fixture handlers retain slice entrypoints where those tests deliberately pass shorter argument lists. |
| D05 / D06 | `2904fea`: delete unused syscall and ring wait `park` wrappers; retain default wait::park and park_poll. | Both builds have zero dead-code warnings. |
| R10 / R19 / fmt | `2904fea`: format all kernel Rust, including handlers discovered through generated dispatch; add `format.py`, `check.sh`, Makefile fmt/check gates. | `cargo +1.95.0 fmt --check`, all-source rustfmt check and both strict Clippy builds pass. The only local Clippy allowances explain hardware table/queue index loops or optional generated helper imports. |

`ba75d44` adds `refresh-contracts.py`: scratch builds omit historical
verification claims, run the complete kernel contract suite, ensure sources did
not change, then refresh digests atomically. `f08348b` is the **separate generated
metadata commit**, after those suites passed. Historical semantic/mutation
receipts remain explicitly historical; the R8 amendment records current source
contract verification, not a new full Linux ABI claim. `01d7ae3` updates `.READY`.

## Images

Default image is still **2,924,584 bytes**, but its SHA-256 changed:

- Old: `75b2abe26021d9d0624b0555a64ed589d251cb7d30aa2965754974f3716d1732`.
- New: `e3d774eb844f2cca9f1ba2b28c5b732c7ebc659e01dbafb0505d0d0f1d08b1f6`.
- Ring / Mac Rust 1.95.0: `34676c507af737d12720192e590bafcb3d0fecc68792adb6c459450a1b6b60ad`.
- Ring / kvm-dev Rust 1.99.1: `4daec18c810cb28a3ae1c87b50fb91388e795b1b63d5bbdae75267e4767568ed`.

Default `.READY` names the new content-addressed image/manifest and refreshed
verification SHA. Image binaries are local build artifacts, not newly committed
large files. The 1.95.0 Linux-suite cross build reproduces the new default SHA.
Ring binaries differ by compiler; the fresh native gate rebuilds both admitted
classes and all six profiles from the changed sources. No ABI field, GPA,
record kind, syscall number, admission class or wire layout changed.

## Validation and environment

Mac: Apple M4 Pro, macOS/HVF, pinned Rust 1.95.0, Node
`/tmp/jitk-09/node-real`, existing integrated VMM and pinned Hyperlight inputs.
All VM test batches held `/tmp/sofort-bench.lock`; load is retained in receipts.
The default image passed **1,000/1,000** parking exchanges, **0.00 s** process CPU
over **10.002 s** idle, and **30 x 64** reversed replies. This is functional
parking evidence, not a performance improvement claim.

kvm-dev: existing Ubuntu arm64 nested HVF→KVM, six vCPU/9 GiB, Rust 1.99.1.
Only `/home/dev/r8-kernel/` was used for new VM files. The stock Linux runner's
SSH wrapper translates its generated `/home/dev/jitk-suite/` scratch paths into
this owned root, without modifying the runner. Native and Linux measurements
use `/home/dev/bench.lock`. All nested timings are indicative, not metal.

All **11/11 subtree suites passed**: kernel, VMM, VMM sandbox, protocol,
executor, executor policy, MCP, grow, bench, Hyperlight and Linux. MCP passed
27 checks plus 13 native framing/validation cases; Hyperlight passed all 13
checks (no skip). **Executor certification PASS**, n=50 breakdown samples,
with the new image SHA bound in its final readiness receipt.

The Linux suite passed 100 boots, 30 one-tool runs, 100 runs at each concurrency
1–8, density 1/32/64/128/256, 1,000 parking exchanges, 720 seccomp cases and
180 fault cases; **0 children remaining**. Shard: **19/19 Rust tests**, **82/82
exact native corpus tuples**, fd and relocated-region differential probes,
and mismatched-layout rejection. Both default/ring builds have **0 Clippy
warnings**, including the undocumented-unsafe-block audit.

Mac scratch tree: **383,036,094 bytes** of files before removal, plus <0.1 GiB
kernel outputs, below the 3-GiB budget. VM scratch peaked below 0.6 GiB; after
removing tree/build outputs and the before-fix executable it is **24 KiB** of
logs, below the 5-GiB budget. The Linux runner removed its completed scratch;
no VM restart, kernel change or external service was needed. Mac scratch
outputs were removed after copying receipts to `kernel/dist/r8/`.

Aggregate receipt: `kernel/dist/r8/summary.json`. Log SHA-256 values:

| Receipt | SHA-256 |
|---|---|
| `mac-suites.log` | `b55475d703ac1f90093fd918e8232dab4731b8f62b98ceee3051c90ac3483fe9` |
| `contracts.log` | `52115d09876f5a2bd8ad4354262fbde679da708c152a62ad190f4419c113c772` |
| `kernel-check.log` | `3340218cc020cc24eb70149db03fddc05c213581fed9fee89309a91eb9a400a4` |
| `kvm-logs/shard-test.log` | `d5dc1fa76a64b192c38ce1501bfcfde2fabaa9997d7213416c20989b4c78b47a` |
| `linux/report.json` | `69e1672bdac7151bf74218512d5dde6b6c96e0b636c2348e0e1fc494f8aad994` |
| `executor-READY` | `a680fe1046bc5fba20bea0f8f8d6be6ca938e3bc1ed0084de98d7bccf47dff1a` |


## Refreshed contract source SHA-256 values

Generated after the full kernel suite passed; historical evidence hashes are
unchanged. Raw receipt: `kernel/dist/r8/contract-refresh.json`.

| Handler | Old | New |
|---|---|---|
| ppoll | `47412424533ee162ade48a00af1c5aa93b05bd98325aa9296c13e8340de86a33` | `1a74a4e0bb7f15ed75eececb88dd3ee17b0df09b82d5df9964f4eb848b4798b8` |
| rt_sigprocmask | `41a598203348d53dbba585bb456426254a77554961a8b0c366d930a1dd6cbcba` | `78f483509a8e5457a5cbd0a4175aa9ae8c21eeb38f09dd1f97f925b8c6ab0cea` |
| rt_sigaction | `47e2ded222d7ae69038590502a0e9f705879dee34bcc9df92b0fb0f4d0dc6c36` | `3460fcf2a9f58a91ba8b1650e198140c812d69fe3447c2c62cae5ec7fca98f0d` |
| openat | `3ea3343a63e7ea2dfb9efd93c1b14aae63e9f367394aabb9d5de804b91ecd411` | `f24d41fcdc40360bad79c386ed823d60d5d45ae334e75f04c26d40b5a3863f34` |
| close | `29556ef36f73d73da28c418d4783e81ce6b536e14e5b6c7afc3e00a07b6c7466` | `f1adfda4085a38808c11ac7d05de9db8a466f3409e6e15e235d2718f94a11aa8` |
| lseek | `01755c9e0b1e5a602a0602f53b7450cf2bb7a5059a225a6c3e97e543d3a5af0b` | `e10cd50da116ed238e341094488aefdd049944706333452c767b32df63b34351` |
| read | `07b3f10781fa319bf8fc324453c27c2b87507efc27b7ef5aa6d66da2dbd880d5` | `c9e54830ede6c6ebcd4bba6fae47d0a7f3b5efca97f09911e56bab36ad0ae16c` |
| readv | `255c87eb0e615f4f52445b2e3390f4aa370e8f8b6fa414f30ac78c79eb7b73ef` | `c7de8524a2d5bbfac5fc6ed3c938ae2239aba8821d39c3606438ba97f42c1a80` |
| readlinkat | `0e30f8b109d3d710b7cda90390b49478435ab67df2d0ca7af20fa08b7efc4ca2` | `924c66464aea7b113c86421dff7edd1e65aaabc1b254f1cf245273b7811be59c` |
| fcntl | `e1661894336eb460574b5d46b64d2f04eec331c3990de816625ca9242e37ba04` | `ec0f5319b394e0696f0316098ab06275b15b3addd38747f59e6a355654ce70d1` |
| getdents64 | `b7efb95c2f37b06c990f8ce1fa59046afa2079009820e39e3d0f4b03da6e5812` | `13b1f09bfdc12f38c6a0db57002c882af56ffae4399285f1a82d21b31c887d45` |
| newfstatat | `ef3788da2e5827026c4279389f26184efd39d77585d44aa6515abf75308d1fcc` | `f354830106c6e195a46ee6c1c634ef33a09e18def36ca9cc8fd9d2c1ead692c8` |
| fstat | `7cf4c18f9203af081edc9e4baadbfe3bb5f60db92b3789479a76096c084e74d4` | `34fe8ea464aaf21fd6dd5698d3c548866a9fe92cc1314ac92a1df8c58eca8361` |
| pread64 | `75d908e6b1d067a6163c4abddac53380191e5f9a3ad606d05af0c0af1507f7bd` | `41fda29c434630e77ed72d9aea27a1828cd18b440bae3d75f7d6eb645157d63c` |

## Reproduce and raw evidence

From this worktree, `sh arch/jitk/kernel/check.sh` checks every Rust input and
both Clippy configurations. Under the Mac benchmark lock, run
`JITK_VMM_BINARY=/tmp/jitk-01/r3/darwin/jitk-vmm python3 arch/jitk/kernel/refresh-contracts.py`
to regenerate verified metadata, then `sh arch/jitk/kernel/build.sh`.

The exact eleven-suite and executor-certification environment/commands are
retained in `kernel/dist/r8/mac-suites.sh`. First recreate the cleaned scratch
copy with `python3 arch/jitk/kernel/dist/r8/prepare-mac-stage.py`, then run with
`lockf -k /tmp/sofort-bench.lock sh arch/jitk/kernel/dist/r8/mac-suites.sh`.
It tests an archived scratch tree so generated files and dependency links stay
outside the source worktree. Every suite uses the rebuilt default image.

Linux reproduction: archive **all** `arch/jitk` into a fresh owned scratch tree;
export `PATH=$HOME/.cargo/bin:$PATH RUSTUP_TOOLCHAIN=stable JITK_NATIVE_ROOT=$PWD`,
then `sh arch/jitk/kernel/build-ring.sh` and
`make -C arch/jitk/shard test`. Prerequisites are the existing checksum-pinned
`/home/dev/r6-census` inputs; no third-party download was needed.

Raw evidence is local under `arch/jitk/kernel/dist/r8/`: `contracts.log`,
`contracts/*.json`, `contract-refresh.json`, `before-{slots-borrowing,fdt}.log`,
`kernel-check.log`, `readiness.log`, `readiness/*.json`, `mac-suites.log`,
`kvm-logs/{ring-build,shard-test}.log`, `linux/report.json`,
`executor-READY`, `summary.json`, and `kvm-native/` (both 41-row corpus
receipts, exact fd/region bytes, layout rejection and build/preparation receipts).

## Commits

- `97c9e3f` — Fix kernel syscall generation from strict shared JSON parse
- `40c926c` — Fix exclusive borrowing of kernel open descriptions
- `a5610af` — Fix bounded FDT token and boot argument parsing
- `1dbae40` — Keep positional reads inside the exclusive open borrow
- `b694504` — Refactor kernel fd routing and archive extents into named types
- `2904fea` — Refactor kernel unsafe boundaries and name runtime ABI constants
- `ba75d44` — Add verified kernel contract digest refresh tool
- `f08348b` — Refresh kernel contract hashes after R8 verification
- `01d7ae3` — Update kernel readiness for the R8 safety image

## Limits / handoff

No ABI generation or shard/executor implementation change was made. Kernel
constants mirror their current published ABI; cross-language generation remains
the separate A06 work. Historical mutation receipts were retained rather than
relabelled as new R8 mutation runs. Current contract suites, native differential
probes, full subtree tests and executor certification were rerun. No new memory
or latency improvement is claimed.
