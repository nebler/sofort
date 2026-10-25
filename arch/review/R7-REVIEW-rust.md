# R7 Rust idiom and readability review

## Five-line summary

1. Overall: promising systems work with good bounds in the newer decoders, but unsafe ownership and several inconsistent error boundaries keep this from being a clean portfolio reference yet.
2. **Kernel: C** — the small syscall modules and checked user-memory helpers are useful, but safe APIs manufacture mutable global references, unsafe invariants are implicit, and formatting obscures otherwise simple logic.
3. **Shard: C+** — owner-thread affinity, RAII mappings and generation fencing are good foundations, but a reproduced seal-check bug, borrowed-RAM aliasing, and guest-triggered process aborts undermine the abstractions.
4. **VMM: B−** — launch errors generally propagate clearly through `Result`, but compressed security code, raw descriptor ownership, and state changes before fallible confinement steps need attention.
5. Prioritize R01–R05; this report contains **20 grouped findings: 5 High, 12 Medium, 3 Low**, with no product-code changes.

## Basis and verification

Reviewed commit `bb95bf2c3960128a794a76355b6258daec4199e0`, on 2026-10-26, after reading `arch/V1.md` and `arch/jitk/README.md`. All locations below are relative to `arch/jitk/`; line numbers refer to that commit, not a formatted scratch copy. Scope includes all Rust under `kernel/src`, `kernel/build.rs`, `shard/src`, `vmm/src`, and `vmm/sandbox`; `executor/ipc/bridge.c` was inspected only for the mirrored IPC layout. The crate manifests/build recipes and relevant shard contract notes were also checked to distinguish deliberate prototype limitations from defects.

High means an ownership/safety boundary or substantial correctness/error-containment issue; Medium means a significant maintainability or robustness problem; Low means a localized clarity improvement. An unsound safe API is identified as such even where existing callers happen to obey its unstated rules; that does **not** claim a demonstrated exploit in the current execution path.

All compilation/formatting/probes ran on disposable copies. Mac commands used Rust **1.95.0** (`59807616e`, 2026-04-14), matching `kernel/build.sh` and `vmm/build.py`; the kernel target was `aarch64-unknown-none`. Linux commands ran through `/Users/noah/code/sofort/kvm-dev/ssh.sh` exclusively under `/home/dev/r7-review-rust/`, using its existing Rust **1.99.1** (`58cf8f9c3`, 2026-10-13). Missing Clippy/rustfmt components were installed into disposable **copies** of the installed toolchains using scratch `RUSTUP_HOME`, leaving installed toolchains alone.

The VMM has no checked-in Cargo manifest: a scratch-only edition-2024 Cargo wrapper checked its existing `src/main.rs`, with `sandbox_ready` enabled and the exact cached `krun`, `libc`, and `utils` rlibs from `/tmp/jitk-01/r3/darwin/libkrun/target/release/deps`. This checks the Mac launcher and its sandbox tests, not a rebuild/audit of libkrun or compilation of Linux-only VMM branches.

### fmt and Clippy results

Counts are diagnostic sites, deduplicated by lint/message/file/line across binary and test targets **within each run**. Shared sites in the two kernel feature configurations are intentionally counted in each configuration. Default Clippy warning sets were used, not `-D warnings` or all pedantic lints.

| Target / host | fmt result | Clippy result | Lint categories and counts |
|---|---|---|---|
| Kernel, default `qjs` / Mac, Rust 1.95.0 | `cargo +1.95.0 fmt --check`: **FAIL**, differences in 9 files | **PASS**, exit 0; **12 warnings** | `needless_range_loop` 3; `manual_c_str_literals` 2; `manual_range_contains` 1; `match_like_matches_macro` 1; `write_with_newline` 3; `manual_div_ceil` 1; `missing_safety_doc` 1 |
| Kernel, `transport-ring` / same | Same crate formatting failure; explicit scoped check below includes ring sources | **PASS**, exit 0; **17 warnings**: 12 Clippy + 5 rustc | Clippy: `manual_is_multiple_of` 2; `manual_c_str_literals` 2; `manual_range_contains` 1; `match_like_matches_macro` 1; `write_with_newline` 3; `needless_range_loop` 1; `manual_div_ceil` 1; `missing_safety_doc` 1. rustc: `unused_imports` 1, `unexpected_cfgs` 3, `dead_code` 1 |
| Shard / kvm-dev Linux arm64, Rust 1.99.1 | `cargo +stable fmt --check` and `cargo +stable fmt --all --check`: **PASS**; explicit check of every source also passes | `--all-targets`: **PASS**, exit 0; **13 distinct warnings**, 26 emitted across bin/test builds | `manual_is_multiple_of` 7; `chunks_exact_to_as_chunks` 1; `collapsible_if` 2; `manual_range_contains` 1; `too_many_arguments` 1; `result_large_err` 1 |
| VMM / Mac, scratch Cargo wrapper, Rust 1.95.0 | `cargo +1.95.0 fmt --check`: **FAIL**, differences in all 3 `src` files and `sandbox/mod.rs` | `--all-targets`: **PASS**, exit 0; **1 distinct warning**, 2 emitted | `needless_range_loop` 1, in BPF jump construction |

Kernel Clippy commands were `cargo +1.95.0 clippy --locked --offline --release --target aarch64-unknown-none --message-format=json`, once with defaults and once adding `--features transport-ring`. Shard used `cargo +stable clippy --locked --offline --all-targets --message-format=json`. VMM used `cargo +1.95.0 clippy --offline --all-targets --message-format=json` with the wrapper/extern flags described above.

The ring's three `unexpected_cfgs` warnings are all `ring_glue_4m` in `kernel/src/arch/aarch64/page_tables.rs:5,7,27`. The documented `build-ring.sh` supplies `--check-cfg=cfg(ring_glue_4m)`; the direct Cargo command above does not. These warnings are a build-interface inconsistency, not evidence that the documented script selects the wrong layout. This run checked the default ring memory class, not a separate `ring_glue_4m` build.

Cargo formatting does not discover the handlers reached through the build-generated `include!` dispatcher. An additional `rustfmt +1.95.0 --edition 2024 --check` over every kernel source and `build.rs` found differences in **31 files**, including **22 syscall files**. The original sources were never formatted or rewritten. Shard's successful format check also leaves some large-string/closure expressions visually dense; format success alone does not establish readability.

An additional opt-in `-W clippy::undocumented_unsafe_blocks` audit completed successfully and reported **93 kernel-default**, **96 kernel-ring**, **104 shard**, and **12 Mac VMM** distinct sites. Kernel counts include 26 generated dispatcher call blocks in each configuration; shard counts include tests and two `unsafe impl`s. These are **additional warnings**, excluded from the default-warning table. The inventory under R06 records the repeated pattern together.

Additional evidence:

- `cargo +stable test --locked --offline --bin real` in the Linux scratch tree: **19 passed**; no real guest was launched by these unit tests.
- Mac `sandbox/tests/run-unit.sh`, with scratch `TMPDIR` and toolchain: **9 passed**.
- Seal-check probe: a correctly sized regular file made `F_GET_SEALS` fail with **EINVAL (22)**, yet the scratch `real ipc-probe echo` process accepted it and published READY (`TX cursor = 1`). This probe starts no KVM or watchdog; its own process was terminated and reaped afterward. See R02.
- Generator probe: minifying the existing valid `slots.json` in scratch still made Clippy exit **0**, but generated **1 registered dispatch arm** while `syscalls.json` reported **26 registered slots**. The scratch input was restored afterward. See R04.

No end-to-end microVM/security or performance certification was attempted. Mac and Linux scratch trees and review helper files were removed after recording results; kvm-dev was left running.

## Findings

Effort estimates are focused engineering time, including appropriate regression coverage, not promises of production certification. Each row includes a short source quote; sections below expand the highest-priority issues.

| ID | Severity | Locations and short quote | Issue | Idiomatic fix | Effort |
|---|---|---|---|---|---|
| R01 | High | `kernel/src/fs.rs:59–60,149–152`: `Result<&'static mut Open, isize>` | Safe functions can return overlapping mutable references to global fd/open-description state, including through duplicated descriptors. Single-core execution does not establish unique borrowing. | Own an `FdTable`; make lookup borrow `&mut self`, or expose copied metadata plus scoped updates without escaping global references. | 1–2 d |
| R02 | High | `shard/src/ipc.rs:120`: `fcntl(3, 1034) ... & 7 != 7` | A failed `F_GET_SEALS` returns −1, whose low bits satisfy the seal mask. A regular unsealed file is accepted; subsequent truncation can invalidate the mmap and cause SIGBUS. **Reproduced.** | Check the syscall result for error before testing named seal bits. | <1 h |
| R03 | High | `shard/src/real_kvm.rs:424–559`, especially `457,470,474,487–515,534–541`; `shard/src/owner.rs:244–284`: `assert!`, `from_utf8(...).unwrap()` | The service's JS guest/KVM exit decoder treats malformed external records as internal invariants. Release builds abort the entire shard, affecting unrelated slots. This is documented research behavior, but the service reuses it. | Return `RunError::Protocol`/`UnexpectedExit` and reset or retire the affected slot; use `streams::Receiver` as the model. Keep process-wide failure an explicit supervisor policy. | 1–2 d |
| R04 | High | `kernel/build.rs:27–30,40–42`: `slots.lines()` / `line.split('"')` | Python parses JSON properly for the manifest, then Rust reparses its presentation as one entry per line. Valid minification silently unregisters 25 slots and contradicts the manifest. **Reproduced.** | Parse once: let the existing Python JSON step emit both dispatcher and manifest, including identifier validation. | ½ d |
| R05 | High | `shard/src/real_kvm.rs:68–74,348–374,560–561`; `shard/src/kvm.rs:59–65`: `bytes(&self, ...) -> &[u8]`, `corrupt_canary(&self, ...)` | Safe APIs expose a shared RAM slice while permitting overlapping writes through `&self`. Mapping word helpers also leave alignment implicit and use overflow-prone `off + n` checks. | Return owned copies from externally mutable memory; require exclusive stopped-slot access for mutation; check ranges with `checked_add`, and encode/check word alignment. | ½–1 d |
| R06 | Medium | `kernel/src/main.rs:3,33–68`; `kernel/src/syscalls.rs:5–16`; `shard/src/lease.rs:32–34,289–299`; `vmm/sandbox/mod.rs:146–160`, plus inventory below: `#![allow(static_mut_refs)]`, large `unsafe { ... }` | Unsafe scope and ownership/initialization/alignment/quiescence contracts are mostly implicit; the kernel-wide lint allowance suppresses useful scrutiny. The 104 shard audit sites include two undocumented unsafe trait implementations. | Put safety contracts at raw boundaries, narrow blocks, and contain singleton state behind a scoped exclusive access mechanism appropriate to one masked-IRQ core. | 1–2 d, incremental |
| R07 | Medium | `shard/src/native.rs:88–151,198–219`; compare `shard/src/real_kvm.rs:424–453`: direct `ioctl(..., KVM_RUN, ...)` loop | Native execution bypasses `Running`/`Lease` and has no deadline argument. Its Rust loop can stay inside KVM indefinitely; timeout/restart depends on the separately documented external supervisor. | Reuse a common guarded vCPU-entry abstraction or make the external cancellation/deadline ownership explicit in the native worker API and documentation. | 1–2 d |
| R08 | Medium | `shard/src/real_kvm.rs:567–570`; `shard/src/kvm.rs:343–345`; `shard/src/owner.rs:181–187`; `shard/src/lease.rs:265–271`; `shard/src/main.rs:279–285`: `self.drain()`, `join().unwrap()`, `child.kill().unwrap()` | Destructors perform fallible shutdown and can panic, including during another panic in debug/unwinding builds. Ownership is present, but cleanup failure policy is hidden in `Drop`. | Expose explicit `shutdown/try_drain -> Result`; keep `Drop` best-effort and non-panicking, with safe ordering and escalation owned by the caller. | ½–1 d |
| R09 | Medium | `shard/src/kvm.rs:17–35,75–86`; `shard/src/real_kvm.rs:26–44,84–95,378–394,573–579`; `shard/src/lease.rs:35–53`; `kernel/src/ring.rs:6–10,67–75,177–178`; `kernel/src/arch/aarch64/mod.rs:17–22`; `shard/src/ipc.rs:15–44,182–187`; `executor/ipc/bridge.c:16–20,57–65,73–85`: `self.store(0x228, source.len() as u64)` | ABI layout/FFI knowledge is repeated across backends and languages. `#[repr(C)]` is correctly used for syscall structs, but sizes/offsets of hand-written structs and IPC constants are not checked together. | Centralize a small dependency-free ABI module/schema; generate or verify C/Rust constants and add size/alignment/offset assertions against installed UAPI. Name control fields, record kinds, and pseudo-fds. | 1–2 d |
| R10 | Medium | `kernel/build.rs:8–15`; `kernel/src/fs.rs:6–8`; `kernel/src/syscalls/brk.rs:6–21`; `kernel/src/syscalls/writev.rs:6–68`; `vmm/src/main.rs:35–59`; `vmm/sandbox/mod.rs:301–331`: `pub struct Node { pub ino: usize` and packed branches | Kernel/VMM formatting failures impose substantial visual parsing cost; generated module discovery also lets the handler files escape normal `cargo fmt`. | Format all owned sources, explicitly include generated-dispatch handler inputs in the format gate, and retain a pinned formatting command. | ½ d |
| R11 | Medium | `shard/src/main.rs:1–2`; `shard/src/bin/real.rs:1–14,41–44`; `shard/src/real_kvm.rs:1–2`; `shard/src/native.rs:2–6`; `kernel/src/main.rs:8–18,24`; `vmm/src/confinement.rs:6–10`: `#[path = "../real_kvm.rs"] mod kvm`, `use super::*` | A synthetic backend and real backend are both called `kvm`; path aliases and glob imports make ownership and the active implementation harder to follow. Native code implicitly reaches its parent's private internals. | Introduce an ordinary shard library/module tree (`kvm`, `runtime`, `transport`, `bench`) and thin binaries; give guest transport/page-table variants explicit module names or a small facade. | 1 d |
| R12 | Medium | `shard/src/owner.rs:197–209,331–469,498–499`; `shard/src/ipc_service.rs:98–290`; `kernel/src/fs.rs:6–8`; `kernel/src/ring.rs:12–16`: nine-argument `worker`, `active/policy/canary`, `state: u8`, `a/b` | Long event loops and combinations of booleans/numeric states hide state transitions; `Node.a/b` change meaning for files versus directories. Clippy's `too_many_arguments` and `result_large_err` support this maintainability concern. | Extract command handling and slot driving; group worker dependencies; use named state/kind enums and named node extents. Shrink channel error payload only if recovery does not need the returned event. | 1–2 d |
| R13 | Medium | `shard/src/real_kvm.rs:124–153,259–264,287–289`: `&b[..8]`, `b[at..at + 16]`, `n <= 256` | Corrupt/truncated snapshot metadata panics before useful diagnostics. A record's byte length is not checked against the width encoded in its register ID before a pointer is passed to KVM. Inputs are local prepared artifacts, not ordinary guest ring data. | Use a bounded reader returning `InvalidData`; validate total/count/record width, then construct a validated register value type and return `Result<Snapshot>`. | ½ d |
| R14 | Medium | `kernel/build.rs:49,56`; `kernel/src/syscalls/ppoll.rs:4`; `kernel/src/syscalls/ioctl.rs:2`; `kernel/src/syscalls/readv.rs:18`, plus handler inventory below: `call(a: &[usize])`, `dispatch(63, &[0, base, len])` | The syscall argument length invariant is informal: most handlers index unchecked, two check lengths differently, and one redispatches a three-element slice. Current trap entry supplies six registers, so this is an API inconsistency rather than a demonstrated guest-selected short slice. | Standardize on `&[usize; 6]`/a syscall-argument type; call a read helper directly from readv instead of shortening the dispatcher contract. | ½ d |
| R15 | Medium | `vmm/sandbox/mod.rs:42–43`; `shard/src/real_kvm.rs:127–128,138`: `std::fs::read(p)?; if blob.len() > ...` | Bounds on local profile/snapshot metadata are applied after reading the entire file, or omitted for total register-file size. This does not bound allocation if the selected file is unexpectedly huge. | Read at most limit + 1 with `Read::take`, reject oversize, then parse; constrain record count as well as individual record width. | ½ d |
| R16 | Medium | `vmm/sandbox/mod.rs:27,64,190–193,210–227`; `vmm/src/watchdog.rs:11,25–32,44–50,92,103,131`: `Option<i32>`, `close(fd)`, later `last_os_error()` | Raw fd ownership is spread across cleanup branches. In Linux sandbox setup, an error is fetched after `close`, which can overwrite the original errno; kqueue/pidfd lifetime is also manual. | Use `OwnedFd`/`BorrowedFd` according to ownership; capture syscall errors immediately, before cleanup. Keep explicit close timing where confinement requires it. | ½ d |
| R17 | Medium | `vmm/sandbox/mod.rs:51–58,74–83`: `self.stage = 1` / `self.stage = 2` before fallible operations | A failed confinement step leaves the object claiming the next stage. Current `launch()` propagates the error and exits, but the reusable API allows an inconsistent retry/order. | Advance a named stage only after success, or consume a prepared value to return a confined value. | ½ d |
| R18 | Low | `kernel/src/fdt.rs:20–23,34–49,64–68,98–101`: `while b[pos] != 0`, `checked_mul(10).unwrap() + ...` | The “bounded token walker” checks some fields but does not bound every token/name read or validate decimal digits/addition. This is trusted VMM boot input, so it ranks below guest-facing decoding. | Use checked slice cursors/`position`, validate subranges and decimal bytes, and return a contextual boot-configuration error or deliberate boot failure. | ½ d |
| R19 | Low | `kernel/src/console.rs:64`; `kernel/src/mmu.rs:31,105`; `kernel/src/arch/aarch64/page_tables.rs:95`; `kernel/src/trace.rs:39,49,54`; `kernel/src/fs.rs:54`; `kernel/src/syscalls/ppoll.rs:32`; `kernel/src/user.rs:49`; `kernel/src/syscalls/getcwd.rs:10`; `kernel/build.rs:55`; `kernel/src/ring.rs:92,103`; `shard/src/streams.rs:54,72,136,149`; `shard/src/real_kvm.rs:442,474,487,500,534`; `shard/src/real_harness.rs:447`; `shard/src/owner.rs:473`; `vmm/sandbox/mod.rs:319`: `for i in 0..4`, `(size + 511) / 512` | Mechanical idioms account for most default Clippy warnings; they add noise but should not distract from ownership and error boundaries. | Prefer `writeln!`, `div_ceil`, `contains`, `is_multiple_of`, and appropriate iterators; emit idiomatic generated code. Keep explicit page/ring indexes where they express hardware layout better. | 2–4 h |
| R20 | Low | `shard/src/bin/real.rs:16–30`; `shard/src/real_harness.rs:322–324`: `const rows=Array.from` inside a long Rust string | The large JS fixtures mix another language's logic/escaping into Rust control flow, obscuring fixture intent and making JS changes difficult to review. | Keep fixtures as named `.js` files via `include_str!`; keep only small interpolation wrappers in Rust. | 1–2 h |

## Details and suggested rewrites

The following snippets are focused design sketches, not patches or claims that a larger refactor needs no caller changes.

### R01 — make exclusive descriptor access a real borrow

Before (`kernel/src/fs.rs:59–60`; the ring variant has the same signature at 149):

```rust
pub fn get(fd: usize) -> Result<&'static mut Open, isize> {
    unsafe { FDS.get_mut(fd).and_then(|f| f.as_mut()).ok_or(-9) }
}
```

Two safe `get(fd)` calls can manufacture references to the same `Open`; `get` followed by `close`/`alloc` can also invalidate an outstanding reference. In the ring table, distinct descriptor numbers can intentionally share the same description. This is a reference-uniqueness problem even with one vCPU and masked interrupts, not a request to add a mutex everywhere.

After, make the table own the borrow:

```rust
impl FdTable {
    fn get(&mut self, fd: usize) -> Result<&mut Open, Errno> {
        self.entries.get_mut(fd)
            .and_then(Option::as_mut)
            .ok_or(Errno::BadFd)
    }
}
```

For shared descriptions, resolve the descriptor index and borrow `self.descriptions` through that same `&mut self`. Boot/trap state may still require one carefully documented global `UnsafeCell`, but references must not escape its exclusive access period. Another reasonable small-kernel option is copied metadata with narrowly scoped position updates.

### R02 — convert FFI failure to `Result` before examining bits

Before (`shard/src/ipc.rs:120–122`):

```rust
if file.metadata()?.len() != BYTES as u64
    || unsafe { fcntl(3, 1034) } & 7 != 7
{
    return Err(invalid("IPC requires exact sealed memfd geometry"));
}
```

`fcntl`'s signed error sentinel is not a seal set. In the probe, `F_GET_SEALS` returned EINVAL for a regular file but the endpoint still sent READY. The size check alone does not stop the peer from truncating that file after mapping. This contradicts `inherited()`'s stated SIGBUS protection.

After (named constants elided here only to keep the snippet short):

```rust
let seals = unsafe { fcntl(file.as_raw_fd(), F_GET_SEALS) };
if seals < 0 {
    return Err(io::Error::last_os_error());
}
if file.metadata()?.len() != BYTES as u64
    || seals & REQUIRED_SEALS != REQUIRED_SEALS
{
    return Err(invalid("IPC requires exact sealed memfd geometry"));
}
```

Add a regular-file/unsupported-`F_GET_SEALS` regression alongside the existing hostile-length tests. A mock returning −1 is also useful, but the real regular-file probe exercises the actual failure contract.

### R03 — distinguish hostile records from broken host invariants

Before (`shard/src/real_kvm.rs:500–505`):

```rust
assert!(id >= 1 && id <= 32 && cap == 1 && n <= 1024);
// ...
let text = std::str::from_utf8(&payload).unwrap();
assert!(text.starts_with('[') && text.ends_with(']'));
```

After:

```rust
if !(1..=32).contains(&id) || cap != 1 || n > CALL_LIMIT {
    return Err(RunError::Protocol("invalid call header"));
}
let text = std::str::from_utf8(&payload)
    .map_err(|_| RunError::Protocol("call is not UTF-8"))?;
```

Apply the same policy to cursor reversal/capacity, record geometry/padding, duplicate IDs, FINISH, and unexpected MMIO/KVM exits throughout the cited parser. A checked conversion from `op` to an exit enum would also eliminate later `owner.rs` assertions about the numeric exit kind. Keep assertions for genuinely private host invariants.

`ABI-R6.md` explicitly documents research-shard aborts; this is therefore an architectural debt finding, not an undisclosed behavior claim. Its importance rises because `ipc_service` now drives the same `Slot::try_exit` for multiple live slots. `streams.rs:51–160` already demonstrates a comprehensible bounded-copy/validate/`Result` approach for native output.

### R04 — generate dispatcher and evidence from the same parsed object

Before (`kernel/build.rs:40–42`):

```rust
for line in slots.lines().filter(|s| s.contains(':')) {
    let parts: Vec<_> = line.split('"').collect();
    let (nr, name) = (parts[1], parts[3]);
```

A valid one-line JSON object contains every syscall on one line, so this loop emits only its first pair. Meanwhile, the Python manifest loop at 27–30 still sees all 26 entries. The build succeeds, making this more serious than a helpful syntax error.

After, extend the already-required Python generation step:

```python
slots = json.loads((root / "slots.json").read_text())
rows = validate_slots(slots)  # integer numbers, legal Rust handler identifiers
write_manifest(rows, out)
write_dispatch(rows, out)    # preserve one module per distinct handler
```

Keep Rust `build.rs` as process orchestration with contextual failures. This preserves the no-Cargo-dependencies constraint and the deletion/regrowth contract; there is no need to add a second JSON parser. Check minified/reordered/pretty JSON and duplicate-handler slots against the same expected registration set.

### R05 — do not lend shared RAM while also allowing shared-reference writes

Before (`shard/src/real_kvm.rs:348,365–372`):

```rust
pub fn corrupt_canary(&self, v: u64) { /* writes RAM */ }
pub fn bytes(&self, off: usize, n: usize) -> &[u8] {
    assert!(off + n <= RAM);
    unsafe { std::slice::from_raw_parts(self.ram.ptr.add(off), n) }
}
```

Safe code can retain a canary slice, call `corrupt_canary`, then read the slice. Both methods accept `&self`, so the borrow checker cannot enforce the immutability promised by `&[u8]`. The mapping helpers have another boundary problem: `off + n` may wrap in release builds, and `read_volatile::<u64>` still requires alignment. Present call sites normally use constant, aligned offsets; the abstraction does not encode that requirement.

After, use a checked range and an owned snapshot of bytes:

```rust
fn checked_end(off: usize, len: usize, capacity: usize) -> io::Result<usize> {
    off.checked_add(len).filter(|&end| end <= capacity)
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "RAM range"))
}
fn copy_bytes(&self, off: usize, dst: &mut [u8]) -> io::Result<()> { /* bounded raw copy */ }
fn corrupt_canary(&mut self, value: u64) { /* exclusive stopped-slot mutation */ }
```

Make stopped/running lifetime rules explicit as well; neither a normal slice nor `volatile` grants a synchronization or aliasing exemption. For word helpers, check eight-byte alignment or use byte-wise/unaligned operations where the ABI permits them. Atomic control fields should have a separate typed accessor from ordinary RAM bytes.

### R06 — give unsafe boundaries a local, checkable argument

Before (`kernel/src/syscalls.rs:5–11`):

```rust
pub fn copyin(addr: usize, dst: &mut [u8]) -> Result<(), isize> {
    unsafe {
        let pa = crate::user::access(addr, dst.len(), false).ok_or(-14isize)?;
        core::ptr::copy_nonoverlapping(pa as *const u8, dst.as_mut_ptr(), dst.len());
    }
    Ok(())
}
```

After, keep the existing checked abstraction but document and minimize its raw boundary:

```rust
let source = checked_user_range(addr, dst.len(), Access::Read)?;
// SAFETY: the checked range stays mapped while EL0 is stopped; dst is
// kernel-owned storage, disjoint from that user range, for this entire copy.
unsafe { core::ptr::copy_nonoverlapping(source.as_ptr(), dst.as_mut_ptr(), dst.len()) };
```

The helper's actual API must establish that disjointness, not merely repeat it in a comment. Use equivalent precise arguments for MMIO alignment/device mapping, DMA ownership, page-table lifetime, FFI buffers, and `File::from_raw_fd` ownership. `off()` can be safe with a tiny internal unsafe block if it has no memory-safety precondition for callers. `Running` should tie its signal-visible pointer to the mapping's lifetime and forbid cross-thread movement/nesting, rather than relying only on a comment. The existing single-core, masked-DAIF design is a useful invariant to preserve and document; it does not justify unconstrained reference lifetimes.

Compiled audit locations are grouped here instead of creating a finding for every missing comment. The generated dispatcher's 26 sites map back to `kernel/build.rs:49` and should be fixed in the generator. The inventory includes both kernel configurations and deduplicates overlapping bin/test compilation; Linux-only VMM and disabled feature branches were not included in these counts.

- `kernel/src/arch/aarch64/mod.rs:5,9,16,27`
- `kernel/src/arch/aarch64/page_tables.rs:70,74,118,157,165,170,179`
- `kernel/src/arch/aarch64/wait.rs:4,7,10`
- `kernel/src/console.rs:24,30,36,39,44,50,86,108,122,129,141,152,160,165,181,224,227,230`
- `kernel/src/fdt.rs:19`
- `kernel/src/fs.rs:15,22,60,64,73,150,156,165,173,181`
- `kernel/src/main.rs:34,76,83,85`
- `kernel/src/mmu.rs:24,55,76,82,90,97,104`
- `kernel/src/ring.rs:30,33,38,48,54,89,122,125,128,142,161,164,167,174,180,293,296,313,329,348`
- `kernel/src/syscalls.rs:6,13,20,24,38`
- `kernel/src/syscalls/brk.rs:4`
- `kernel/src/syscalls/clock_gettime.rs:4`
- `kernel/src/syscalls/exit.rs:4`
- `kernel/src/syscalls/getcwd.rs:4`
- `kernel/src/syscalls/mmap.rs:4`
- `kernel/src/syscalls/munmap.rs:4`
- `kernel/src/syscalls/read.rs:3`
- `kernel/src/syscalls/readv.rs:3`
- `kernel/src/syscalls/write.rs:4`
- `kernel/src/syscalls/writev.rs:4`
- `kernel/src/trace.rs:9,17,29,31,44,54`
- `kernel/src/user.rs:15,23,98,120,143`
- `kernel/src/wait.rs:5,12,21,27,33,60,73,75`
- `shard/src/ipc.rs:92,117,118,119,120,123,138,152,189,210,215,223,236,238,241,277`
- `shard/src/ipc_service.rs:82,83,86,302`
- `shard/src/kvm.rs:42,45,53,56,61,65,70,123,133,190,193,198,208,221,229,246,252,260,264,267`
- `shard/src/lease.rs:33,34,56,59,64,75,80,89,101,114,128,153,213,216,285,309,312,313,329,359,371,391,403,410,413`
- `shard/src/native.rs:25,29,34,37,51,64,72,115,124,129,130,134,137`
- `shard/src/real_kvm.rs:51,54,62,65,70,74,79,206,224,229,294,297,299,310,313,357,367,371,428,437,449,456,465,468,469,583`
- `vmm/sandbox/mod.rs:146,165`
- `vmm/src/main.rs:9,18,23`
- `vmm/src/watchdog.rs:46,49,56,59,63,64,106`

### R07 — make native deadline ownership visible

Before (`shard/src/native.rs:114–121`), the native path retries interrupted KVM entries directly:

```rust
loop {
    let ret = unsafe { ioctl(s.cpu.as_raw_fd(), KVM_RUN, 0u64) };
    if ret >= 0 { break; }
    if io::Error::last_os_error().raw_os_error() != Some(4) {
        return Err(io::Error::last_os_error().to_string());
    }
}
```

A clearer shared boundary would look like:

```rust
match stopped_slot.enter(&lease)? {
    VcpuExit::Interrupted => service_expiries()?,
    VcpuExit::Mmio(exit) => receiver.accept(exit)?,
}
```

This is **not** a claim that the MCP native path has no timeout: `RESULTS-R7-bytes.md` records external TIMEOUT followed by a worker requiring restart, and `RESULTS-R7-integrate.md` explicitly defers native lease scheduling. The Rust code should nevertheless make its different cancellation ownership obvious. Otherwise a reader can reasonably infer that the shared `Slot` or the shard's documented leases guard this second KVM entry loop too. A shared entry helper would reduce both unsafe duplication and this policy ambiguity.

### R08 — separate observable shutdown from destruction

Before (`shard/src/lease.rs:265–271`):

```rust
fn drop(&mut self) {
    // ... assertions on every slot ...
    self.child.kill().unwrap();
    self.child.wait().unwrap();
}
```

After, handle/report fallible shutdown before destruction and retain a fallback:

```rust
fn shutdown(&mut self) -> io::Result<()> { /* stop slots, kill/reap, report errors */ }
impl Drop for Watchdog {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}
```

The exact fallback must preserve the watchdog's escalation contract. Likewise, do not simply remove MMIO draining from `Slot::drop`: move the checked operation into an explicit stopped-slot shutdown and retain a non-panicking fallback or explicit process-fatal policy if safe teardown becomes impossible. Release uses `panic=abort`, so a destructor cannot be treated as a recovery mechanism for aborted execution; in debug, a second panic during unwinding is also fatal. Current `Mapping`, `Endpoint`, and `Input` destructors are already simple non-panicking resource cleanup.

### Remaining fixes that need context

- **R09:** Keep byte encoding for ring records; replacing it with a direct `repr(C)` cast would introduce padding/endian/alignment hazards. Share named layout constants and encode/decode helpers instead. Existing `Region`, `OneReg`, `PollFd`, and `Timespec` use `repr(C)` appropriately. Extend the existing `abi.c` UAPI extraction to verify those structs' size/alignment/field offsets, and verify the Node bridge's capacity, slot geometry, header offsets and cursor offsets against the Rust schema. The same naming issue appears at `kernel/src/user.rs:150` (`esr >> 26 != 0x15`), `kernel/src/mmu.rs:56–72` (VA/physical-base arithmetic), and `shard/src/lease.rs:153,313,360,371` (raw syscall numbers). Names such as `ESR_EC_SVC64`, `GUEST_RAM_BASE`, `CONTROL_SEED_OFFSET`, and `SYS_TGKILL` make architectural meaning visible; distinguish a RAM offset from a GPA/VA in names or small types. Cryptographic round variables in `entropy.rs` are conventional and do not need cosmetic renaming.
- **R10:** All 22 failing handler files are `brk`, `clock_gettime`, `close`, `exit`, `fcntl`, `fstat`, `getcwd`, `getdents64`, `lseek`, `mmap`, `munmap`, `newfstatat`, `openat`, `ppoll`, `pread64`, `read`, `readlinkat`, `readv`, `rt_sigaction`, `rt_sigprocmask`, `write`, and `writev`. The other 9 failing kernel inputs are `build.rs`, `src/{console,fs,main,ring,syscalls,trace,user,wait}.rs`. This is one formatting finding, not 31 separate issues.
- **R11–R12:** The two KVM backends need not be forced into a broad trait hierarchy. Share the small ownership/FFI/entry primitives, name the synthetic benchmark explicitly, and keep specialized protocol implementations separate. For `Node`, `File { offset, len }` versus `Directory { first_child, child_count }` would communicate its validated invariant better than `dir/a/b`. For a worker, extracting `handle_command` and `drive_slot` is more useful than moving the same large loop into another file.
- **R13:** The newer `inputs.rs::Reader` is a good local model: take a checked fixed-length slice, then use `try_into().unwrap()` only after that size has been established. Validate each register's payload against `1 << ((id >> 52) & 15)`, within supported widths, before constructing the KVM pointer argument. A malformed local snapshot should produce a useful startup error, not a bounds panic or an ioctl reading a different width than the serialized payload.
- **R14:** Handler signature locations, all under `kernel/src/syscalls/`, are `brk.rs:3`, `clock_gettime.rs:3`, `close.rs:1`, `exit.rs:3`, `fcntl.rs:2`, `fstat.rs:3`, `getcwd.rs:3`, `getdents64.rs:4`, `ioctl.rs:1`, `lseek.rs:4`, `mmap.rs:3`, `munmap.rs:3`, `newfstatat.rs:4`, `openat.rs:5`, `ppoll.rs:3`, `pread64.rs:3`, `read.rs:2`, `readlinkat.rs:2`, `readv.rs:2`, `write.rs:3`, and `writev.rs:3`. Exact argument arrays are appropriate here because the assembly trap supplies six registers. For readv's console forwarding, call a named read implementation or pass a full six-register array. The intentional `usize -> u32` fd/flag conversions model Linux's C integer syscall types; do not mechanically replace them all with rejecting `try_from` conversions and change ABI semantics. Document the truncating boundary once.
- **R15:** For example, `File::open(path)?.take((MAX_PROFILE + 1) as u64).read_to_end(&mut blob)?` bounds the profile allocation before `blob.len()` is inspected. These are operator-selected local files, so this finding is about defensive startup/resource bounds, not a demonstrated guest-controlled allocation.
- **R16:** In `enter_netns`, capture `last_os_error()` immediately after a failed `setns`, before closing the fd. Apply the same rule to failed Landlock ADD/RESTRICT operations. `OwnedFd` lets the error value be constructed before automatic cleanup, while `BorrowedFd` makes a non-owning parameter explicit. Add an owning kqueue wrapper; do not promise persistent pidfd leaks on paths that already close manually or exit the process.
- **R17:** `self.stage = Stage::Confined` belongs after successful profile application. A failed `before_build` must not allow a subsequent `after_build` to report success on macOS. Current `launch()` correctly exits on the first error, so this is a misleading reusable-state API, not evidence of a current unconfined launch.
- **R18:** Validate the 40-byte FDT header range before forming its slice, validate structure/string subranges inside the total length, and search for NUL within a checked remaining slice. Decimal parsing should check digits and both multiplication and addition. A deliberate fatal boot error is reasonable for a broken trusted VMM; implicit indexing/underflow panics are harder to diagnose.
- **R19:** `needless_range_loop` at BPF jump construction can become `for (j, insn) in blk.iter_mut().enumerate()`. Hardware page-table loops often deserve explicit indexes; document why when retaining them. The C-string lint concerns `getcwd`/initial environment construction; preserve exact NUL-terminated ABI bytes if adopting C literals. The `missing_safety_doc` warning on `off()` at `kernel/src/main.rs:81` does not enumerate every private unsafe function; the opt-in block audit gives a broader picture.
- **R20:** For example, `"json64k" => include_str!("../../fixtures/json64k.js")` gives the fixture its own formatting and review surface. A small named table can pair source and expected result, replacing parallel string matches without changing benchmark semantics.

## What is already good

- **Checked user-memory boundary:** `kernel/src/user.rs:97–117` uses `checked_add`, bounds, and page permissions before handing out an address. `syscalls.rs` centralizes copyin/copyout, and ppoll checks fd count, timespec values, multiplication/addition, and output writability before waiting. The fixed-size `try_into().unwrap()` calls after known-length slices are generally justified; they should not all be treated as runtime error bugs.
- **Explicit restricted semantics:** small syscall files state why unsupported signals, readonly filesystem operations, and memory behaviors are intentionally narrow. `pread64` preserves seek state, validates signed offsets and overflow, and skips unused-pointer dereferences at EOF/zero count. `writev` validates stdout vectors before emitting a prefix.
- **Modern bounded decoders:** `inputs.rs` bounds request size, argc, argument bytes, file count, path depth, duplicate/colliding paths, and archive size. `streams.rs` validates copied record geometry, generation, padding, stream offsets, completion totals/order, output/log budgets and cursor arithmetic. Their negative and mutation tests target meaningful protocol behavior.
- **Owner-thread discipline:** a `Slot`'s raw mapping pointers naturally prevent ordinary cross-thread movement, and owners construct/use/reset/destroy their own VM/vCPU objects. There is no blanket `unsafe impl Send for Slot`. Channels and wakeups make the scheduling boundary understandable even though the large worker function needs decomposition.
- **Reasoned ordering:** IPC producer/consumer publication uses Release stores and Acquire loads, paired with C11 atomics in the bridge. Lease deadline/tid stores precede Release publication of the generation/state; the watchdog acquires that state before reading the relaxed metadata. Completion, expiry and escalation use generation-fenced CAS operations. I found no reason to mechanically strengthen these to SeqCst, nor a demonstrated atomic-ordering bug in the reviewed paths.
- **Resource and reset intent:** `File` owns KVM descriptors; `Mapping`, `Endpoint`, lease `Board`, and native `Input` unmap in `Drop`. `NativeVm` deliberately orders its slot before input mapping, and it unbinds the previous input before dropping that extent. Pending MMIO is drained before discard/register restore, with comments explaining why registers alone do not capture KVM's pending completion.
- **Good VMM error flow and fail-closed integration:** `launch()` uses `Result`/`?` for CLI, entropy, payload and confinement errors, validates memory/seed options, and emits the sandbox acknowledgement at the platform-specific correct stage. The unavailable sandbox adapter refuses to launch. BPF policy tests cover wrong architecture, high argument bits, role restrictions, executable memory, and filter size.
- **Appropriate low-level choices:** aligned page-table structs, explicit little-endian byte encoders, `repr(C)` on C-facing structs, deliberate volatile/atomic access, and dependency-free builds can all be idiomatic for this project. The main improvements are to encode their contracts and expose readable ownership/error APIs around them, not to replace necessary systems code with abstraction for its own sake.
