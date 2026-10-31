# GrowOS showcase: grow writable SQLite next

Research date: 2026-10-31. Repository HEAD inspected: `e84bc278a06b98289ca6ca90bd1b0bb3fb36c90a`. This is desk research and a source/data read, not an experiment. No existing file was modified; no build, benchmark, Docker container, VM, Linux program, dependency install, or remote execution was run. This report is the only new file.

Evidence labels: **[R]** = verified by reading repository source or recorded results, not reproduced here; **[V]** = checked primary web documentation, source, or a first-person experiment; **[I]** = inference/estimate; **[P]** = proposed acceptance criterion or future work. All rankings and effort budgets are **[I]**. Web sources were accessed on the research date. Mutable upstream sources need version/hash pins before implementation.

## Recommendation

- **Choose one program: the unmodified static `sqlite3` shell, with an ordinary writable database and rollback journals in per-run scratch RAM.** Use the existing 3.50.4 artifact initially; verify that exact artifact's write configuration on Linux before freezing the target.
- Make the useful job **import a bounded incident/support CSV, create indexes, join/aggregate it, try an update, roll it back, commit another update, close/reopen the DB, and write a report file**. These are genuinely write-dependent operations; the current immutable-query profile cannot do them.
- Fix the first profile to **one process, one thread, default Unix VFS, `journal_mode=DELETE`, `synchronous=FULL`, `mmap_size=0`, and an explicitly bounded dataset/cache**. Exercise real journal files. `:memory:`, `immutable=1`, journal OFF/MEMORY, or a custom no-op VFS do not satisfy this target.
- Make **real cwd plus coherent mutable filesystem state** the growth challenge. Require an automatically proposed multi-file state change, not only small handlers around a manually finished filesystem. Human-written storage/user-copy primitives are allowed and separately costed.
- Aim for **100/100 frozen SQLite file workflows**, **32 upstream-derived transaction assertions**, **200/200 independent filesystem histories**, **zero regressions by case identity**, and **zero scratch/cwd/fd leaks in 10,000 A→reset→B sequences**. These are proposed finite targets, not present results.
- Target **at least eight behavior-changing syscall entrypoints plus their shared filesystem state**, with the exact manifest frozen after Linux trace discovery. Report actual generated/handwritten lines, all attempts, costs, rejected candidates, and final artifact hashes; handler count is accounting, not success.
- Reserve fresh directory-tree and workload families, not just new filenames/data rows. Require the evaluator to reject false-success writes, unchanged cwd, broken positional offsets, stale sizes, early unlink reclamation, and residual scratch state.
- Budget **15–30 focused engineer-days** end to end, including oracle/tooling and qualification. First fund a **five-day feasibility spike**; stop or narrow the claim if coherent state still requires manual implementation or the evaluator misses known defects.
- Use ripgrep as the runner-up if the immediate objective changes to coding-agent usefulness. Broader jq, Lua and MicroPython coverage are valuable transfer checks, but they already run selected workloads and are weaker standalone evidence of new growth.
- Say precisely what the result establishes: **model-produced, independently checked stateful compatibility for a useful unchanged application**. Running SQLite alone cannot establish automation benefits, exclusive novelty, durability across reset, or an economic advantage over Linux/Wasm/another kernel.

## What the repository establishes

### Today's baseline and the important historical distinctions

**[R] Runtime.** The [architecture](../../jitk/docs/ARCHITECTURE.md) separates the production ring/native execution path from the console profile used by GrowOS and the scriptc corpus. Both run static guest programs at EL0 under the Rust kernel. The current [MCP README](../../jitk/mcp/README.md) documents arbitrary-byte native stdout/stderr, exit status, late-bound read-only input files, and persistent native workers on Linux and macOS. Native `run` has **no JS host-tool grants**. Thus the old census's printable-output failures are historical console/profile limits, not proof that today's native MCP output is ASCII-only.

**[R] Current code.** [`fs.rs`](../../jitk/kernel/src/fs.rs) still has immutable archive nodes, archive/console descriptor kinds, 64 descriptors, and open-file descriptions with positions. Its `AT_FDCWD` path walk starts at root. [`chdir.rs`](../../jitk/kernel/src/syscalls/chdir.rs) checks that a path is a directory but stores no cwd; on ring builds it returns ENOSYS. [`getcwd.rs`](../../jitk/kernel/src/syscalls/getcwd.rs) returns `/`. [`openat.rs`](../../jitk/kernel/src/syscalls/openat.rs) implements read-only permission/mount errors; [`write.rs`](../../jitk/kernel/src/syscalls/write.rs) and `writev.rs` serve output streams, not archive mutation. `fcntl.rs` implements descriptor CLOEXEC flags, not SQLite's record-lock commands. `pread64.rs`, `fstat.rs`, `lseek.rs` and metadata/path operations already exist, but must learn scratch descriptor/node semantics. There is no writable-file implementation to switch on.

**[R] Growth evidence.** [Phase 2](../../jitk/docs/results/grow-phase2-2026-10-27.md) grew eight handlers (218 lines) with 55 lines of human/implementation-agent-written safe mmap helpers, plus loader/tooling work. Its [corpus report](../../jitk/docs/results/scriptc-corpus-phase2.md) records 3,198/3,947 comparable compiled programs byte-identical to Linux, including 644/792 held-out, with no comparable-case regressions. The all-compiled lower bound was 77.5%; 2,924 new passes came from mmap alone. This is strong distribution-specific transfer, not broad Linux compatibility.

**[R] Newer evidence qualifies the headline.** [Stage 0, 2026-10-31](../../jitk/docs/results/scriptc-corpus-stage0.md) preserved all 1,848 previously passing comparable programs, including 386 held-out. Only 2,400 rebuilt programs had the newer reference journal; 2,313 were comparable. The historical 81% was **not** remeasured on the entire corpus after the ELF-reproducibility changes. The baseline `scriptc-corpus/RESULTS.md`'s 3.9% and the native census's “SQLite cannot read” statement describe older kernels and must not be presented as current results.

**[R] The missing state is measured.** The [path-FS experiment](../../jitk/grow/EXPERIMENTS-PATHFS-2026-10-27.md) added one visible pass and zero held-out passes. It measured 93 visible/31 held-out failing write-using programs; **50/16** had no absent calls outside filesystem-write operations, an upper bound on scratch-only gains. Visible writes were under `/tmp` and/or cwd; median payload was ten bytes, maximum 1.03 MiB. One held-out workload held 403 files open. These are compatibility leads, not customer demand, and selected SQLite should not inherit the entire corpus's fd/symlink/link/metadata scope.

**[R] Evaluator failure is a central lesson.** Both ordinary gate splits originally shared one tree. Name-specialized path handlers could pass; even the later general `chdir` never changed relative lookup state. A tree-variant audit exposed additional defects. The present generator still observes descriptor/path structures largely through write/no-write and repetition relations ([autoprofile.ts](../../jitk/grow/autoprofile.ts)). More independently generated one-call probes alone will not certify a mutable filesystem.

**[R] Leaf-handler success is real but narrower than the requested next step.** [E1](../../jitk/docs/results/grow-e0-e1-2026-10-26.md) recorded 178/180 accepted transactions, with substantial pre-existing helpers/tests. [E2/E3](../../jitk/docs/results/grow-e2-e3-2026-10-26.md) showed held-outs rejecting five known overfits and generated probes rejecting nine known mutants, while documenting opaque-output blind spots. The [original SQLite result](../../jitk/docs/results/grow-r7.md) explicitly says its first fstat/pread64 implementations were handwritten and submitted through **REPLAY**; subsequent live regeneration trials are separate evidence. A showcase should preserve that authorship distinction.

**[I] Selection principle.** Pick the smallest recognizable program whose useful behavior forces cross-call state, has an independent executable reference, and transfers to a second program without tuning. That favors writable SQLite over another read-only query, and avoids committing to Node's scheduler, sparse VM, signals and executable-memory agenda before testing the method on state.

## Ranked candidates

Effort means **focused engineer-days for a qualified narrow profile**, including discovery, primitives, growth tooling, independent gates and final native integration. It is not model inference time or a measured forecast. “After scratch” estimates assume the recommended filesystem contract already exists; shared costs are not additive. Demo scores are subjective, 1–5, for an audience of systems developers. Exact deltas and verification plans follow the table.

| Rank | Program / frozen narrow profile | Need and observed starting point | Main additional work | Effort [I] | Demo / method value [I] |
|---|---|---|---|---|---|
| **1** | **SQLite writes, DELETE journal** | SQL data preparation/what-if analysis; immutable SQLite already verified | Mutable files/cwd, positional writes, truncate/unlink, lock commands, sync contract, shared metadata | **15–30 d** | **5/5; best stateful composition test with existing artifact** |
| **2** | **ripgrep**, `-j1 --no-mmap`, bounded tree | Direct coding-agent search demand; census static artifact enters after loader widening but fails Rust signal setup | Real signal registration and guard permissions, anonymous VM semantics, profile qualification | **5–10 d** | **4/5; strong unchanged-binary/Rust transfer, less filesystem novelty** |
| **3** | **Agent-written TypeScript worker compiled with scriptc** | Strong code-mode/file-workflow fit; corpus demonstrates allocator foothold | Same scratch/cwd foundation, perhaps rename; compiler/runtime qualification | **10–20 d; 2–5 after scratch** | **4/5; useful, but easy to co-design program and kernel to the test** |
| **4** | **MicroPython Unix**, pure Python/file I/O | Small scripting jobs; existing standard-variant file-sum profile passes | Scratch writes, imports/cwd/metadata, byte output and memory bounds | **8–16 d; 2–5 after scratch** | **4/5; accessible Python demo, partial ecosystem** |
| **5** | **Lua 5.4.8 with writable file I/O** | Embedded scripting/transformation; file-sum already passes | Scratch open/write/append/seek/rename/remove/temp-file semantics | **7–14 d; 1–4 after scratch** | **3/5; clean transfer test, modest new-program surprise** |
| **6** | **BusyBox file applets**, no shell pipelines | Familiar copy/edit/extract workflows; six read/stream profiles already pass | Scratch, rename/unlink and metadata; binary output already available natively | **8–16 d; 2–5 after scratch** | **3/5; broad surface, applets share one implementation** |
| **7** | **Tree-sitter AST extractor**, statically linked grammar | Agent repo maps have concrete deployment precedent; not censused | Artifact pin; C embedding may need little beyond archive reads; stock Rust CLI adds loader/guard/dynamic-parser concerns | **3–7 d C extractor; 1–3 weeks CLI spike** | **3/5; useful parsing, potentially almost no OS growth** |
| **8** | **jq on realistic JSON/log inputs** | API/log filtering; musl artifact already runs, native byte transport is implemented | Real-data/error/Unicode/modules/limits qualification; cwd only where needed | **2–5 d; often zero new handlers** | **3/5 utility, 1/5 incremental growth evidence** |
| **9** | **Git read-only**, bounded local repo | Coding-agent history/diff/context; only dynamic no-index diff measured | Static artifact; file mmap or qualified fallback, cwd/config/object reads, `/dev/null`; disable helpers/pager/optional writes | **10–20 d constrained; broader Git several weeks+** | **5/5 recognition, large qualification burden** |
| **10** | **CPython static**, pure stdlib/files | High agent-program familiarity and strong code-execution demand; no census artifact | Static interpreter+stdlib/modules, entropy/signals/locks, loader/memory, import/files; threads if used | **15–30 d feasibility/qualification; broad ecosystem longer** | **5/5 recognition, uncertain first milestone** |
| **11** | **cmark / Pandoc-like conversion** | Document ingestion/rendering; actual Pandoc is censused and heavy | cmark: small C artifact/stream checks; Pandoc: huge image, Haskell threads/events/pipes | **2–5 d cmark; Pandoc multi-month tier** | **3/5 cmark but little growth; Pandoc poor next step** |
| **12** | **Static HTTP client through host tools** | Service/API orchestration demand is real; native grants absent | Native capability adapter or narrow socket façade, waiting/cancellation/limits/policy integration | **5–10 d adapter; unchanged curl multi-week scope** | **4/5 product story, mostly broker integration** |
| **13** | **fd**, even `--threads 1` | Agent file discovery; measured artifact still creates threads | Scheduler/TLS/futex plus Rust signal/VM semantics and loader | **6–12+ weeks** | **3/5; dominated by ripgrep for a first search demo** |
| **14** | **DuckDB CLI**, bounded CSV analytics | Useful analytical SQL; both measured artifacts are dynamic and GNU workload creates threads | Static artifact or dynamic loader, large memory/layout, scheduler/futex/protection, temp/spill/extension policy | **6–12+ weeks, low confidence** | **5/5 output story; too many independent prerequisites** |

## Per-candidate notes

### 1. SQLite with writes — recommended

**Need [V/I].** SQLite explicitly documents CSV-driven data analysis, local caches and application files as use cases [S01]. Its shell supports import/export and file-directed output [S02]. An agent creating an intermediate relational dataset, joining two support exports, validating a migration, or trying a reversible correction is a credible workflow **[I]**. This is documented capability and a demand hypothesis, not evidence that a customer specifically wants Sofort. The project's transcript research independently motivates disposable processing of unfamiliar diagnostic files; it does not establish a preferred database [R-fit].

**Delta [R/V/I].** The immutable profile intentionally avoids journal/locking writes. Pinned SQLite's Unix VFS has open, read/write, positional I/O, truncate, sync, access, metadata and fcntl-lock machinery [S03]. An independent first-person SQLite 3.51.2 strace demonstrates journal creation, positional writes, journal/directory/database sync and unlink [S04]. This is useful corroboration, **not** an aarch64/3.50.4 syscall allowlist. Expect `openat` create/truncate/write modes; scratch `write`/`writev`; `pwrite64`; `ftruncate`; `unlinkat`; record-lock `fcntl`; `fsync`/`fdatasync`; actual cwd; scratch-aware `read`/`pread64`/`lseek`/stat/access/close. Trace to decide whether fchmod/fchown, umask, temp-file cleanup or additional fcntl commands are exercised and mandatory. `renameat` is useful general scratch behavior but is not established as necessary for DELETE-journal commit.

**Verification [P].** Use identical ELF/SQL/input trees on Linux tmpfs and Sofort, compare exact deterministic stdout/stderr/exit and file contents, plus the upstream-derived tests and state histories below. Test rollback after partial writes and space exhaustion, stable file identity across handles, and close/reopen. Enforce fixed journal-mode pragmas by querying their returned values. Preserve existing ten immutable cases unchanged.

**Demo/method [I].** Familiar software makes the behavior legible; journal operations make false-success handlers observable. The contribution is automatic shared-state growth and held-out transfer. An ordinary handwritten tmpfs can produce the same output. Costed manual controls and generation receipts are needed to say the method helped.

### 2. ripgrep; keep fd as a distinct, later target

**Need [V].** Claude's own FAQ documents bundled ripgrep, and a user issue reports very slow search in a repository containing millions of ignored dummy files [S11, S12]. That is direct agent integration plus a first-person pain report, not a market-size estimate. Ripgrep's guide documents recursive search and ignore behavior [S13].

**Delta [R].** The census's static rg 15.2.0 needs loader headroom, fstat, real `rt_sigaction`/`rt_sigprocmask`, `mprotect` guard behavior and suitable anonymous mmap. The current loader has since widened and fstat exists, but no new rg acceptance was found. Current signal handlers still return ENOSYS, and console mmap maps PROT_NONE/READ as RW. Native ENOSYS injections made signal registration, mprotect and fstat fatal; sigaltstack/getrandom/affinity/uname/madvise were tolerated individually for the selected workload. This does not establish a combined contract. Use `--no-config --no-ignore --no-mmap -j1 --sort path`, disable helper/compressed/PCRE JIT paths, and separately qualify ignore-file support if it is part of the agent use case.

**Verification/method [P/I].** Run pinned upstream integration cases from its `tests/` tree, adapted by an outside-guest runner, plus hidden repository trees, binary/Unicode files, inaccessible paths, bad regexes and output limits. Direct protection probes must distinguish real guards from success stubs. A held-out sd binary is a natural Rust-runtime transfer test. Strong public runner-up, but it proves signal/VM policy more than Stage 1's writable state.

**fd [R/I].** Do not treat it as “rg with fewer options.” The measured `--threads 1` path still used clone/futex/gettid/scheduling. Correct scheduling, TLS, thread exit/wakeups and reset state are architectural work. No evidence supports making those calls return success without threads. **[P]** Use its version-pinned integration tests, hidden discovery trees and independent thread/futex/TLS/reset invariants [S40]; exclude command-execution options. A correct result would show reuse of scheduler and Rust-runtime support, but simple file discovery is a weaker public payoff for that investment than the other candidates. Prefer rg before fd; fd can become a later scheduler acceptance application.

### 3. Agent-written TypeScript compiled with scriptc

**Need [V/I].** Anthropic's code-execution-with-MCP example uses TypeScript APIs, local filtering, control flow and persisted intermediate files [S14]. A worker reading CSV/JSON, writing a normalized intermediate file and producing an artifact fits Sofort's existing language/tooling **[I]**. The article supports the workflow, not scriptc specifically.

**Delta [R/I].** Use synchronous fs calls in a single compiled program; avoid subprocesses, workers, sockets and asynchronous APIs whose runtime implementations need epoll/threads. The measured write traces identify `mkdirat`, `openat(O_CREAT)`, `unlinkat`, `pwrite64`, `ftruncate`, some rename/link/symlink and metadata operations. Freeze a useful worker before kernel development and select only its required subset. Scriptc/Linux output matching and Node semantic equivalence are different gates; compiler mismatches cannot be fixed by the kernel.

**Verification/method [P/I].** Execute the same compiled ELF on both systems; keep a separately implemented pure-data result oracle and validate artifacts against expected values. Hold out workers written by a different author after the API contract is frozen, plus the existing private corpus. Strong transfer beneficiary of SQLite's filesystem. As the headline showcase, an agent-written application risks being tailored around kernel deficiencies; an unchanged third-party executable supplies a stronger independent constraint.

### 4. MicroPython; 10. CPython static

**Need [V/I].** Agent products explicitly offer Python execution for analysis and generated files [S15]. That supports Python familiarity. It does **not** make MicroPython's standard library interchangeable with CPython's, or imply NumPy/pandas support.

**MicroPython baseline/delta [R].** The census's 1.27.0 Unix standard variant, SSL/FFI/btree disabled, already produced an exact file sum. Thread capability was compiled in but unused. Later native integration passed three cases on glue-4m: its approximately 2 MiB startup mmap did not fit the smaller class [R-native]. Grow file create/append/seek/truncate, directory/cwd/import paths, os rename/remove/stat and error behavior according to the frozen program. Do not add a scheduler because the source can support threads when this profile does not use them.

**MicroPython verification [V/P/I].** Upstream tests normally compare target output to CPython or `.exp` files [S16]. Run those expectations with their capability declarations intact, then also compare **the identical MicroPython ELF** on Linux/Sofort. Select `io`, filesystem and import tests by source audit; don't claim the entire Unix suite. Broad Python syntax with correct file histories is an appealing demo, but selected read-only scripts already run; scratch transfer is the new result.

**CPython delta/verification [V/I/P].** No static CPython ELF or strace is present in this census. CPython requires thread support at build time [S17]; that does not prove a single-threaded script necessarily calls clone. Bootstrap entropy source code uses getrandom/device fallback [S18]. Expect import-time open/stat/read/seek, cwd/readlink, clocks, signal setup and lock/futex behavior depending on libc/version, plus scratch writes for file workflows. Pin a GIL build, static built-in modules and stdlib resources; avoid claiming pip, native extension loading, multiprocessing or pandas. Source-audit selected `test_io`, `test_fileio`, `test_os`, `test_importlib` cases and drive them from outside the guest; CPython's own runner can launch subprocesses [S19]. High recognition, but the unmeasured artifact/stdlib boundary makes its effort much less certain than SQLite's. Held-out imports and file programs would show generated compatibility generalizing to a mature interpreter; demonstrating automation benefits still needs the same authorship, cost and manual controls as SQLite.

### 5. Lua with file I/O

**Need [V/I].** Lua has explicit file-handle, seek, read/write and OS-file operations [S20]. That makes a small agent-authored transformer plausible; no evidence found establishes greater agent demand than Python/TypeScript. Its existing successful sum script means “Lua runs” is already old news.

**Delta [R/I].** Scratch `openat` modes, write/writev, seek and offset/size coherence; rename/remove; temp-file creation and unlink-while-open for `io.tmpfile`; randomness/path selection for `os.tmpname` as the selected libc uses it. The standard library does not supply a universal mkdir/chdir interface: choose an existing module or separate raw-syscall tests rather than inventing a Lua API. Exclude `io.popen`/`os.execute`, which expand into processes/pipes/waiting.

**Verification/method [V/P/I].** Lua publishes a version-matched 5.4.8 test suite [S21]. Audit its file tests for subprocess/temp-name dependencies; use intact eligible assertions, exact Linux-reference streams and additional hidden append/seek/delete histories. Small incremental work after scratch, valuable to prove generality beyond SQLite. Less striking as the single new target because the interpreter and read-only I/O already work.

### 6. BusyBox applets

**Need/baseline [R/I].** Familiar `sed`, `awk`, `grep`, `sort`, `wc` and tar-list jobs already pass in the older census; later native bytes also enable compressed/binary output. Copying files, in-place edits and archive extraction are practical disposable-processing tasks, but the recorded BusyBox build enabled only seven applets. Do not assume it contains cp/mv/mkdir or a shell.

**Delta [I].** A frozen upstream-source configuration can add file applets without patching application code. Expect scratch writes, create/exclusive/truncate/append, mkdir/unlink/rename, directory reads and metadata. `sed -i` often means temporary-file+rename semantics; tar extraction can require symlink/link/chmod/time handling. Large sort may spill; do not infer spill support from the tiny in-memory sort. Running applets separately avoids shell pipelines, fork/exec and job control.

**Verification/method [V/P/I].** BusyBox's testsuite is applet-selectable and consists of shell fragments [S22]. Run the driver on Linux/the trusted host and invoke one guest applet at a time; preserve original assertions and list dependencies/skips. Hold out archive layouts, traversal names and file histories. An applet bundle is useful transfer evidence but not many independent runtimes, and counting each applet as a separate growth success would exaggerate breadth.

### 7. Tree-sitter / AST extraction

**Need [V].** Aider uses repository maps and tree-sitter language queries to provide code context [S23]. This is a more concrete agent-demand precedent than assuming every agent needs a full compiler.

**Delta [V/I].** Tree-sitter's C API can parse caller-provided strings/chunks [S24]. A static C extractor with one embedded, pre-generated grammar may require little beyond existing archive reads, allocation and stdout. It is a newly written wrapper around an existing library, not the unmodified stock CLI. The Rust CLI's parser discovery/build/cache/dynamic-library paths create a different target; its docs expose grammar/library options and test machinery [S25]. Pre-generate/embed grammars elsewhere; don't sneak a compiler, dlopen or subprocess into the guest claim.

**Verification/method [P/I].** Use version-pinned grammar corpus parse trees, exact Linux byte ranges/captures, syntax-error cases and held-out real source files; test incremental edits if advertised. Kernel filesystem mutants still need separate checks. This would demonstrate a useful isolated parser, but passing many grammar tests mostly validates code already supplied by Tree-sitter; it may require no meaningful GrowOS expansion. Rank it as a useful application/transfer target, not the clearest stateful-growth showcase.

### 8. jq on real inputs

**Need [V/I].** jq's documented stream/filter/reduce interface fits local reduction of API and log responses [S26]; code-mode's demand for filtering before returning context is independently documented [S14]. Actual recurring Sofort jobs remain to be obtained.

**Delta [R/I].** Musl jq 1.8.2 already passed the census and later native corpus. Official glibc jq is a separate artifact with mandatory RELRO mprotect and entropy; do not switch between them silently. Real JSON inputs stress memory, streaming/slurp behavior, raw/Unicode output, errors, multiple files and relative module paths. Normal jq does not become a writable-filesystem workload merely because a surrounding shell could redirect stdout; shell redirection happens outside jq.

**Verification/method [V/P/I].** Pin `tests/jq.test` [S27], parse fixtures with a trusted outside runner, and invoke the same ELF; add malformed/truncated JSON, NUL/Unicode, deep objects, NDJSON, missing modules and bounded-output cases. Publish realistic input sizes. Excellent low-effort product validation and a scratch regression beneficiary. Another successful JSON projection alone would show application coverage, with little new evidence that growth matters.

### 9. Git read-only operations

**Need [V/I].** Aider documents Git integration as part of its coding workflow [S28]. Inspecting history, objects and diffs is relevant, although that is not evidence agents require all Git commands inside this VM.

**Delta [R/V/I].** Census Git 2.53.0 is dynamic; the no-index diff spawned no children, whereas its shell-alias workload did clone/exec/wait/pipe. A static build remains unmeasured. Pin a local complete object store and bounded subcommands such as `cat-file`, `ls-tree`, `show` or helper-free `diff`; inspect actual traces. Expect object/pack reads and mmap, config/path discovery, `/dev/null` (the measured Git opens it O_RDWR), metadata and cwd. Use `--no-pager`, disable external diff/textconv/hooks/network/lazy fetching; `GIT_OPTIONAL_LOCKS=0` suppresses optional lock-taking operations, not every possible effect [S29]. Threaded pack access and optional index refresh need explicit qualification.

**Verification/method [V/P/I].** Build repositories on Linux outside the guest, then freeze their bytes; replay selected upstream test assertions [S30] through an external driver, including loose/packed objects, corruption, missing objects and non-ASCII paths. A shell-heavy full test suite is not guest-admissible by default. Recognizable and impressive, but obtaining a constrained profile could dwarf the new semantics it exercises; full Git is a different tier.

### 11. Pandoc-like converter: distinguish cmark from Pandoc

**Need [V/I].** Pandoc documents multi-format readers/writers, filters and document generation [S31]. Disposable document ingestion is also motivated by the project's diagnostic-processing research. This does not mean PDF output is a one-process text transform: Pandoc normally invokes an external PDF engine, and external JSON filters are processes.

**Delta [R/V/I].** The measured static Pandoc executable is about 177 MB with an approximately 169 MiB load span and Haskell RTS threads, epoll/eventfd, pipes and timerfds. Current kernel layout and lack of scheduling make it a poor next program. By contrast, cmark is a C99 reference parser/renderer with no external dependencies [S32]. Its static stream profile might work with little new OS code; it is not a Pandoc replacement for DOCX/PDF/filters.

**Verification/method [V/P/I].** For cmark use versioned CommonMark examples [S33], malformed/large documents and exact Linux output. For Pandoc use its own golden fixtures with a frozen format pair and helper exclusions, after the much larger runtime work. cmark's result would primarily establish parser containment; Pandoc would mix too many growth challenges to interpret the method cleanly.

### 12. Static HTTP client via host tools

**Need [V/I].** Code-mode service workflows are explicitly demonstrated in [S14]. Sofort's trusted host already holds credentials/policy for JS calls, making an HTTP broker plausible **[I]**.

**Delta [R/V/I].** Current native `run` exposes no host grants. A new small client that speaks a bounded capability-file or explicit bridge protocol needs request commit, reply bytes/EOF, ppoll/readiness, backpressure, deadlines, cancellation and generation fencing. Host handles HTTPS/DNS/credentials; the guest need not gain sockets. However, an **unchanged curl** expects sockets/connect/send/recv/options/poll and often TLS entropy/time/CA files and resolver behavior, as the dynamic census trace demonstrates. A libcurl open-socket callback supplies sockets, not an arbitrary HTTP-response broker [S34]. Either disclose a custom client/adapter or implement a narrow socket ABI honestly; do not call a host `fetch` wrapper “curl compatibility.”

**Verification/method [P/I].** Use deterministic recorded/mock service responses, HTTP failures, redirects, byte streams and cancellation around the commit boundary; host-policy tests must independently reject unauthorized requests. Then run a bounded live-service pilot elsewhere. Attractive product demo, but mostly tests a new bridge and authority integration. It gives weaker evidence about automatically growing Linux compatibility than SQLite unless the socket contract itself is the research target.

### 14. DuckDB

**Need [V/I].** DuckDB publishes CSV-loading and analytical query workflows [S35]. These suit data agents; this research found no measured Sofort-specific demand to offset its integration cost.

**Delta [R/I].** The census measured a musl CLI with an absent interpreter and three shared-library dependencies, plus a dynamic GNU CLI that used clone3/futex, protection, memory advice, pread, discovery and libc startup calls. Neither is an accepted static executable; “musl” did not mean “fully static.” A hypothetical static/threads=1 build needs its own evidence. Expect a substantially larger memory/layout contract, possible background tasks, temp spill, writes and extension loading/network exclusions. SQL configuration alone is not proof that the runtime creates no threads.

**Verification/method [V/P/I].** DuckDB has an extended sqllogictest format with explicit SQL/results and a configurable runner [S36]. Freeze a small offline CSV subset, no extensions, stable ordering and bounded memory; separately test spills if supported. A strong public analytics story, but a long route to the first interpretable result. SQLite already provides relational writes with a measured 1.4 MB static artifact and a much narrower kernel surface.

## Recommended acceptance target

### Shipping contract

**[P] Program identity.** Start from the existing SQLite 3.50.4 static aarch64 ELF, SHA-256 `005073a6c1c0e71c22ad8b752f1ffb6c35c8d913fe91f5795038c7d52cf639ff`. Use the exact same bytes on Linux and Sofort. Its historical build recipe does not reproduce that ELF with the currently available compiler, as the [Grow README](../../jitk/grow/README.md) explicitly records. Before release, either recover/pin the original toolchain or produce a separately identified upstream-source static build and establish a **new** Linux baseline; never silently replace the binary or claim reproducible builds from source checksums alone.

**[P] Environment.** Read-only archive inputs under `/inputs`; scratch mounts at `/work` and `/tmp`; initial cwd `/work`. Fixed uid/gid, modes, umask, argv, locale/timezone and SQLite initialization files. Scratch begins from a versioned empty-directory fixture; no mutation of archive nodes or root-overlay whiteouts. Start with **2 MiB of charged file-data pages, 256 scratch inodes, and the existing 64-fd table**. These are proposed small-profile budgets, not corpus-wide coverage. Pin page/inode accounting against a separate 4-KiB-page Linux tmpfs reference; if quota boundaries differ, fix/model them explicitly rather than calling arbitrary ENOSPC timing Linux-exact.

**[P] SQLite scope.** One process/thread, ordinary Unix VFS, one main writable database; default locking with `journal_mode=DELETE`, `synchronous=FULL`, `mmap_size=0`, fixed page/cache/temp policy. Read back each pragma to establish the active mode. Keep data within the budget; include a dedicated spill/journal case that really creates, writes and deletes files. No WAL/shared-memory contract, external extensions, shell commands, threads or subprocesses. Do not choose `locking_mode=EXCLUSIVE` just to evade normal lock behavior. Add other journal modes only under a separately frozen target.

**[V/P] Volatility.** SQLite's rollback journal restores old pages during rollback; its documented durability normally relies on storage synchronization [S05]. Here all state disappears on reset. A synchronous RAM-only filesystem can acknowledge synchronization after valid in-memory writes/metadata updates, with Linux-reference fd/type/error behavior, because it has no persistent device to flush. This qualifies **within-run transaction behavior on volatile storage**. It makes no power-loss, persistent ACID, or post-reset hot-journal-recovery claim. WAL has a separate shared-memory/locking/checkpointing design [S06] and is deferred.

### Success gates and fixed denominators

| Gate [P] | Required result | Evidence and exclusion discipline |
|---|---|---|
| **Useful shell workflows** | **100/100**, 50 development and 50 sealed by workflow family | Same unmodified shell; exact deterministic stdout/stderr/guest exit; no skipped selected case. Import/index/join, commit/rollback, close/reopen, output files, relative paths, malformed/read-only inputs, quota failures. Linux controls must pass first. |
| **Upstream-derived transactions** | **32/32 assertions** with provenance manifest | `trans.test`: `trans-3.1` through `trans-3.14` (14, plus original setup); `trans-5.1` through `trans-5.7` (7, without the suffixed txn-state tests); `savepoint.test`: `savepoint-2.1` through `savepoint-2.11` (11). Preserve sequence, SQL, expected rows/error codes and connection identities [S07, S08]. |
| **Independent syscall histories** | **200/200**, half sealed by history/tree family | Cross-call cwd, namespace, descriptor, offset, metadata, unlink lifetime and quota checks. Generated profiles are supplemented by independently specified state transitions. |
| **Reset isolation** | **0 leaks / 10,000 A→reset→B sequences** on each advertised backend | A leaves secret bytes, open/deleted nodes, cwd and a live transaction; B observes absence and pristine offsets/fds/quota. Include timeout/abort/OOM paths and repeated slot reuse. |
| **Regressions** | **Zero newly failing prior-pass case IDs** | Existing immutable SQLite ten-case set; native 41-case suite and fd/split-buffer probes; QuickJS/Lua integrations; current comparable scriptc visible/held-out sets. Rebuild/re-record drifted references remotely before invoking the full historical denominator. |
| **Growth provenance** | **≥8 meaningful entrypoints and shared state automatically proposed** | Freeze manifest; keep all CLI calls/attempts, proposal patches, helpers, gates and hashes. No manual repair of an “accepted generated” body. Report actual N and all failures. |
| **Independent transfer** | **10/10 new write-dependent workflows**, half sealed | Unchanged Lua/MicroPython or previously frozen scriptc workers, selected before development, absent from proposal feedback. No further kernel tuning against this final set. |

**[V/P] What “upstream-derived” means.** The SQLite tests above are Tcl programs using `tester.tcl` and special test interfaces. The full upstream testfixture does not run in today's guest, and TH3 is proprietary [S09]. For this milestone, a trusted outside-guest extractor and small static C test driver preserve the selected SQL sequences, expected results/errors and two-connection schedule while using the same unmodified SQLite version and normal Unix VFS. Run that identical driver on Linux and Sofort. It is an additional test executable, not the public showcase program. Publish its source and a test-ID→source-hash→assertion map. Say **“32 assertions adapted from SQLite's transaction tests”**, not “SQLite's test suite passes.” Building an unmodified Tcl/testfixture guest is optional later work with a separate compatibility budget.

**[P] Observable file state.** Compare exact final file bytes for the frozen deterministic workflows whose repeated Linux runs establish byte stability. Independently verify rows/schema/`integrity_check` after close/reopen and validate written report bytes. Observe journal creation, writes and deletion through traces plus user-level file observations. Journal checksums/salts or temporary names can vary: compare specified structure/lifecycle or explicit relations, not raw equality to one sampled random journal. Do not relax final SQL/output bytes to hide a mismatch.

**[P] Direct semantic tests.** Use printable hex observations on the console path and raw bytes on the native path. Check sizes, modes and link/lifetime relations, with only explicitly documented identity/time mappings where the two filesystems legitimately differ. Do not copy Linux host inode/statfs/identity constants, and do not reduce stat correctness to “buffer touched.” For `pwrite`, verify that subsequent sequential read/seek still sees the prior position [S10]. For unlink, verify an open descriptor still reads the old object after its last name disappears [S37].

### The work that must actually grow

**[R] Current tooling limitation.** `grow/agent.ts` accepts exactly one `{path, source}` handler, bans unsafe/modules/extern/asm, exposes the helper API and selected read-only `fs.rs`, and rejects tool use. `phase2.ts` builds one handler at a time and grades generated syscall profiles, the ten-case SQLite corpus and affected corpus samples. It has no general multi-file filesystem transaction interface. `--heldout-tree variant` is an audit/replay option, not a mandatory batch gate. A writable SQLite showcase requires controller work; it is not an existing command with a new target name.

**[P] Separate the storage safety boundary from grown policy.** Trusted human-reviewed primitives own bounded page allocation/freeing, checked user copies, range/overflow safety and exclusive access/reset hooks. The proposed code owns coherent cwd/namespace/open-description state and syscall policy through that boundary. Keep unsafe primitives and limits out of the model's editable set. Do not finish path walking, all open flags, lifetime rules and write policy manually, then advertise thin generated adapters as automatically growing a filesystem.

**[P] Provisional target manifest:** `openat`, `write`, `writev`, `pwrite64`, `ftruncate`, `unlinkat`, `fcntl`, `mkdirat`, `chdir`, `getcwd`, `fsync`, `fdatasync` — **12 candidate changed/new entrypoints**. At least the first meaningful mutation/state families must be genuinely proposed, not fixed-return stubs. Existing `read`, `pread64`, `fstat`, `newfstatat`, `lseek`, `faccessat`, `getdents64`, `close` and shared helpers need scratch-aware adaptation. Freeze the final manifest from real Linux write traces before growth; count those adapters separately. Add fchmod/fchown/rename/etc only if evidence or the frozen Stage 1 contract requires them.

**[V/P] Locks need the right ownership model.** Linux's ordinary POSIX record locks are process-associated, whereas OFD locks are associated with open descriptions [S38]. One process per VM means there is no legitimate competing process; it does not justify returning success for invalid fcntl arguments or modeling ordinary locks as conflicts between that process's own fds. SQLite also maintains connection-level coordination in userspace. Test two connections and close behavior; validate lock requests/ranges/types/pointers. Multi-process contention is outside this contract and must not be claimed as tested.

## Plan with the existing tooling

Everything below is **[P], future work**, requiring a separately authorized execution environment. No command in this plan was run for this report. Linux reference recording, builds and heavy validation belong on a separate Linux machine/CI, never this shared laptop. Reuse recorded references for lightweight development where possible; this research session remains read-only except for this report.

1. **Freeze the before-state and useful workload (1–2 days).** Save source/artifact pins, current native/console profiles and case-ID baselines. Obtain ten recurring incident/data-preparation tasks from an intended consumer if possible. Otherwise label the public-support-bundle fixture a product hypothesis. Pin ≤1 MiB input fixtures with malicious/malformed variants. Run the exact SQLite ELF on authorized Linux with `strace -f`, retaining libc/arch/argv/env, success/failure paths, output and post-run files. Classify required successful behavior versus tolerated probes using the census's injection approach. Freeze the 100-workflow/32-assertion manifests before kernel implementation.

2. **Build a shared writable oracle (2–4 days).** Extend `oracle.ts`/the current shared-tree launcher contract to mount identical fresh scratch trees at `/tmp` and `/work`, set real cwd/uid/modes and pin mount/quota inputs. Make independent development and sealed tree families mandatory. Use native Linux tmpfs, not Docker Desktop shared-file behavior: the [oracle-recordings report](../../jitk/docs/results/oracle-recordings.md) documents real root/permission differences. Extend [oracle-store.ts](../../jitk/grow/oracle-store.ts)'s content keys to cover scratch initialization, mounts, cwd, credentials, limits, histories, driver hashes and outputs; archive hashing alone does not pin a mutable environment. Record/verify on Linux CI; a replay miss must fail, never launch Linux locally.

3. **Qualify the evaluator before trusting growth (2–4 days).** Retain `autoprofile.ts`/`auto-observe.ts` for ABI shapes, pointer/error variants and Linux calibration. Add sequence generators and snapshots of user-visible file state; do not derive every expected state transition from candidate helpers. Add selected external syscall assertions from gVisor/LTP/libc-test where their assumptions fit [R-node]. Establish correct Linux controls and at least **12 semantic mutants**: no cwd update; root-relative lookup; success without bytes; wrong pwrite offset; pwrite changes seek position; stale size; omitted zero-fill after extension/truncate; ignored O_EXCL/O_TRUNC; fd aliasing; immediate reclamation after unlink; quota bypass/accounting leak; incomplete reset. Each must compile, complete with a valid protocol and fail a semantic check. Also grade any candidate-specific mutants separately; existing canonical mutants grade the evaluator, not the candidate.

4. **Grow the shared state transaction (3–6 days, bounded retries).** Extend the exact proposal schema to a finite allowlist, e.g. shared scratch/cwd modules plus named adapters, with an atomic all-files patch and source-hash checks. Seal compiler inputs so include/build hooks cannot expose trusted tests. Keep limits, unsafe primitives, evaluator, observer, manifests and policy outside proposals. Reuse isolated auth, no tools, read-only proposals, sanitized feedback, `--validate-only`, attempt receipts and rollback. No hidden source, answers, identities or per-case outcomes enter prompts. Retry at most three proposals per transaction; release held-out feedback is aggregate and submissions bounded. Use small coherent transactions for cwd→relative lookup and file/descriptor lifetime; every accepted transaction reruns the full visible state suite.

5. **Run independent acceptance and transfer (3–6 days).** Reuse `phase2`'s prepare/replay/batch/assemble pattern, but explicitly implement the new writable integration and multi-file gates first. Run the frozen shell workflows, upstream-derived driver, direct histories, unchanged integrations and sealed transfer set. Retain complete stderr/status/timeout/loader failures; a host exit code is not a guest result. Report exact before/after failures and whether each disappears because the missing behavior was added. Publish the subset actually covered, including any artifacts that cannot be rebuilt. No changed assertion or reduced denominator may count as a pass.

6. **Qualify the shipping artifact and reset (2–4 days).** Assemble a fresh native ring profile with an explicit memory class that includes scratch storage. Do not infer ring correctness from a console overlay. Run both advertised backends' byte/fd/region/native regressions, cancellation and 10,000 reset sequences, including incomplete transactions. Read back a report file within the same CLI process using its file-I/O function where supported; native `run` presently returns streams/status, not arbitrary new scratch artifacts. A new host artifact-export interface would be separate work. Measure dirty pages/reset/unique memory only on the authorized measurement host, after functional acceptance; the historical 34–40 µs/~0.5 MiB small-job figures are not SQLite-write predictions.

7. **Test whether the method helped (2–4 days, overlapping qualification).** Keep the same frozen primitives, public information, target semantics and external grader. Compare a manual implementation control with at least three independent growth attempts from the same before-state; record engineer contract/oracle/helper/debugging minutes, model latency/tokens, all failures, accepted lines and final quality. The author of the held-outs should be separate from the implementation. A reasonable provisional hurdle is **≥2 of 3** growth attempts meeting the complete target within three proposals per transaction and **≥30% less implementation/review time** than the manual control, while reporting total end-to-end time too. Those thresholds are proposed decision rules, not statistically strong proof from three samples. If only leaf adapter time falls but oracle/shared-state work rises, report exactly that result.

The phase estimates overlap; the **15–30-day total is an engineering budget**, with substantial uncertainty around safe state primitives and the multi-file proposal boundary. The five-day spike should deliver a fixed contract, Linux write traces, a qualified no-cwd/false-write evaluator, and one generated coherent cwd/create/write/read/reopen sequence in a disposable artifact. If it cannot, stop promising an automatic writable-SQLite milestone on the original schedule.

### Public demonstration

**[P] Show a three-minute failure-to-capability story.** Freeze a real-looking incident CSV and SQL script before growth. First, the unchanged current profile fails when SQLite tries to create `evidence.db` in cwd. Show the Linux reference and the discovered missing semantic families. Next, show the generated transaction patch and independent gate ledger, including a rejected superficially passing implementation. On the accepted artifact, `.cd` to a scratch subdirectory, import events, index/join/group, roll back a deliberately incorrect update, commit a correction, close/reopen and write `report.json`. Show journal lifecycle evidence, exact reference comparisons, and the next run's empty scratch state. End with a sealed Lua/MicroPython/scriptc file workflow that passes without a kernel patch.

Keep the model off the execution path. Give the caller only approved input bytes; the generated kernel does not acquire new host permissions. Show actual resource figures for this workload only if measured. The visible SQL result is the user value; the independent acceptance/transfer ledger is the evidence for GrowOS.

## Risks and decision boundaries

1. **[I] Handwriting can absorb the whole challenge.** Safe ownership/storage primitives are necessary, but a fully implemented human tmpfs leaves too little to grow. Publish their code/effort and the exact generated policy. If the shared-state result must be manually corrected, retain the useful implementation while marking the automatic-growth target failed.
2. **[R/I] Oracle fidelity can dominate model quality.** Shared-root, uid, mount permissions, cwd, quota, metadata and tree histories must match the stated contract. Historical oracle differences already caused wrong acceptances. A larger model does not repair missing observations.
3. **[I] Journaling can become theatrical.** A tiny transaction might leave all meaningful state in user-space cache; journal OFF/MEMORY or an in-memory DB evades the intended behavior. Require writes to real scratch descriptors and a forced file-backed journal case. Check return values and file state, not syscall-name disappearance.
4. **[I] RAM durability language is easy to overstate.** COMMIT within a run and loss of all files on reset are compatible. Persistent ACID/crash recovery needs persistent storage and a different failure model. Quitting and relaunching a whole per-run VM does not test hot-journal recovery because reset destroys the journal too.
5. **[I] SQLite is well-known training material.** Success may be recall plus constrained implementation, not learning unknown semantics. Hold out state families and an independent second application; use no-spec and manual controls. Do not infer unprecedented scientific novelty from familiar syscall code.
6. **[I] Split leakage and evaluator co-design remain possible.** A filename-hash split can put related programs on both sides. Separate implementation and grading ownership, pin families and fresh final data, bound submissions, and release/replenish held-outs after the decision. Hidden filesystem tests must not enter the research/proposal checkout.
7. **[R/I] Memory is part of semantics and economics.** Scratch pages, SQLite page cache/journal buffers and allocator reserve compete for the guest arena. The 64-fd/2-MiB/256-inode profile excludes some corpus workloads. Qualify the exact class, count total dirty/host state, and report ENOSPC/OOM distinctions. Do not extrapolate old small QuickJS memory/reset results.
8. **[I] A useful kernel result can still lose the product comparison.** Linux tmpfs, WASI SQLite, an ordinary sandboxed process, Nanos/Unikraft/Hyperlight-style execution can supply comparable user behavior. This report recommends a method showcase, not a proven cheaper runtime. The [fit synthesis](../growos-fit/SUMMARY.md) correctly requires an actual repeated job and a matched cost comparison for the product claim.
9. **[P] Stop conditions.** Stop automatic promotion if a known semantic mutant survives, references drift, any sealed prior-pass case regresses, no independently frozen useful workload passes, or multi-file code escapes its allowed inputs. Timebox scheduling/network/dynamic-loader expansion out of this milestone. If the goal becomes fastest useful agent tooling instead, ship broader jq/search qualification and call it that.

## Sources and reading ledger

### Repository evidence

- **R-core:** [jitk README](../../jitk/README.md), [architecture](../../jitk/docs/ARCHITECTURE.md), [GrowOS README](../../jitk/grow/README.md), [scriptc corpus README](../../jitk/scriptc-corpus/README.md) and [baseline RESULTS](../../jitk/scriptc-corpus/RESULTS.md). Current source was checked where historical claims differ.
- **R-growth:** [Path-FS experiment](../../jitk/grow/EXPERIMENTS-PATHFS-2026-10-27.md); all reports indexed by [docs/results](../../jitk/docs/results/README.md) were surveyed, with detailed growth, corpus, native-integration, reset and oracle sections read for this decision. Relevant dated records are [E0/E1](../../jitk/docs/results/grow-e0-e1-2026-10-26.md), [E2/E3](../../jitk/docs/results/grow-e2-e3-2026-10-26.md), [Phase 2](../../jitk/docs/results/grow-phase2-2026-10-27.md), [read-only SQLite](../../jitk/docs/results/grow-r7.md), [corpus Phase 2](../../jitk/docs/results/scriptc-corpus-phase2.md), [Stage 0](../../jitk/docs/results/scriptc-corpus-stage0.md), and [oracle recordings](../../jitk/docs/results/oracle-recordings.md). Benchmark tables are historical evidence, not new measurements.
- **R-native:** [Native census RESULTS](../native-census/RESULTS.md), artifact/syscall tables and required-vs-tolerated injection findings; [bounded native integration](../../jitk/docs/results/shard-r7-integrate.md); [native byte transport](../../jitk/shard/RESULTS-R7-bytes.md); current [MCP README](../../jitk/mcp/README.md). The census is n=1 per principal native/guest trace, not a broad conformance certificate.
- **R-fit:** [Fit SUMMARY](../growos-fit/SUMMARY.md), [transcript needs/products](../growos-fit/02-TRANSCRIPT-NEEDS-AND-PRODUCTS.md). Practitioner observations are evidence for containment/workflow pain; this report does not re-audit their underlying audio or treat them as SQLite customer commitments.
- **R-node:** [Node SUMMARY](../growos-node/SUMMARY.md), [Node requirements](../growos-node/03-NODE-REQUIREMENTS.md), [benchmarks/goals](../growos-node/05-BENCHMARKS-AND-GOALS.md). Stage 1 and external syscall-suite selection are proposals inherited as context, not implemented features.
- **R-code:** [`kernel/src/fs.rs`](../../jitk/kernel/src/fs.rs), handlers under [`kernel/src/syscalls/`](../../jitk/kernel/src/syscalls/), [`grow/agent.ts`](../../jitk/grow/agent.ts), [`autoprofile.ts`](../../jitk/grow/autoprofile.ts), [`phase2.ts`](../../jitk/grow/phase2.ts), [`oracle-store.ts`](../../jitk/grow/oracle-store.ts), [`sqlite-corpus.json`](../../jitk/grow/sqlite-corpus.json). No private held-out fixtures or answers were read.

### Primary web sources

- **S01:** [SQLite — Appropriate uses](https://sqlite.org/whentouse.html). Documented data analysis, application files and caches; use cases, not measured agent adoption.
- **S02:** [SQLite CLI](https://www.sqlite.org/cli.html). Import/export, output files, opening DBs and shell file-I/O functions; selected binary features still need qualification.
- **S03:** [SQLite 3.50.4 Unix VFS source](https://raw.githubusercontent.com/sqlite/sqlite/version-3.50.4/src/os_unix.c). Versioned implementation of POSIX I/O and locking; libc maps these functions to architecture-specific syscalls.
- **S04:** [Mehdi Akiki — SQLite commit followed with strace](https://www.mehdi.cz/blog/how-sqlite-commits-a-transaction-followed-with-strace). First-person experiment dated 2026-10-06, SQLite 3.51.2; corroborating journal/sync/unlink sequence, not Sofort's trace.
- **S05:** [Atomic commit in SQLite](https://www.sqlite.org/atomiccommit.html) and [rollback locking](https://sqlite.org/lockingv3.html). Journal/commit and storage assumptions.
- **S06:** [SQLite WAL](https://sqlite.org/wal.html). Separate WAL-index/shared-memory/checkpoint contract.
- **S07:** [SQLite 3.50.4 `trans.test`](https://raw.githubusercontent.com/sqlite/sqlite/version-3.50.4/test/trans.test). Exact proposed transaction assertion provenance, including two connections.
- **S08:** [SQLite 3.50.4 `savepoint.test`](https://raw.githubusercontent.com/sqlite/sqlite/version-3.50.4/test/savepoint.test). Proposed savepoint/rollback sequence provenance.
- **S09:** [How SQLite is tested](https://sqlite.org/testing.html). Tcl harness versus proprietary TH3, fault testing and suite boundaries.
- **S10:** [Linux man-pages — pread/pwrite](https://man7.org/linux/man-pages/man2/pwrite.2.html). Positional I/O and unchanged seek offset.
- **S11:** [Claude Code user FAQ](https://support.claude.com/en/articles/14554922-claude-code-user-faq). Bundled ripgrep deployment precedent.
- **S12:** [Claude Code issue #2084](https://github.com/anthropics/claude-code/issues/2084). First-person large-repository search complaint; anecdote, not prevalence.
- **S13:** [ripgrep guide](https://github.com/BurntSushi/ripgrep/blob/master/GUIDE.md). Recursive/ignore behavior; [15.2.0 feature tests](https://raw.githubusercontent.com/BurntSushi/ripgrep/15.2.0/tests/feature.rs) as a version-pinned fixture source.
- **S14:** [Anthropic — Code execution with MCP](https://www.anthropic.com/research/code-execution-with-mcp). TypeScript tools, local filtering/control flow and filesystem-backed state; workflow evidence.
- **S15:** [Anthropic — Agent API capabilities](https://www.anthropic.com/news/agent-capabilities-api). Python analysis, files and external-system integration as an offered agent capability; no claim of Sofort adoption.
- **S16:** [MicroPython — Writing tests](https://docs.micropython.org/en/latest/develop/writingtests.html). CPython/expected-output oracle and target runners; development docs, pin version before use.
- **S17:** [CPython 3.13 configure requirements](https://docs.python.org/3.13/using/configure.html). Thread support and optional module dependencies; build requirements do not establish runtime clone use.
- **S18:** [CPython 3.13 bootstrap entropy source](https://raw.githubusercontent.com/python/cpython/v3.13.0/Python/bootstrap_hash.c). getrandom/device fallback implementation.
- **S19:** [CPython regression-runner source](https://github.com/python/cpython/blob/main/Lib/test/libregrtest/cmdline.py) and [runner tests](https://github.com/python/cpython/blob/main/Lib/test/test_regrtest.py). Test selection and subprocess-related harness behavior; mutable version must be frozen.
- **S20:** [Lua 5.4 manual](https://www.lua.org/manual/5.4/manual.html). File/OS APIs and process-bearing functions.
- **S21:** [Lua test suites](https://www.lua.org/tests/). Version-specific 5.4.8 test archive/checksum.
- **S22:** [BusyBox testsuite README](https://raw.githubusercontent.com/mirror/busybox/master/testsuite/README). Applet selection and shell-fragment harness; upstream mirror, pin to the selected release.
- **S23:** [Aider repository maps](https://aider.chat/docs/repomap.html) and [language/query support](https://github.com/Aider-AI/aider/blob/main/aider/website/docs/languages.md). Concrete code-agent use of tree-sitter-derived context.
- **S24:** [Tree-sitter basic parsing API](https://tree-sitter.github.io/tree-sitter/using-parsers/2-basic-parsing.html). String/chunk C API.
- **S25:** [Tree-sitter test CLI](https://tree-sitter.github.io/tree-sitter/cli/test.html). Parser tests and grammar/library options.
- **S26:** [jq 1.8 manual](https://jqlang.org/manual/). Filter/stream/file behavior.
- **S27:** [jq 1.8.2 test corpus](https://github.com/jqlang/jq/blob/jq-1.8.2/tests/jq.test). Pinned application fixtures, not syscall coverage by themselves.
- **S28:** [Aider Git integration](https://aider.chat/docs/git.html). Existing coding-agent workflow precedent.
- **S29:** [Git manual](https://git-scm.com/docs/git). Optional locks, pager/config/environment and lazy-fetch controls; subcommand behavior needs tracing.
- **S30:** [Git core-test README](https://raw.githubusercontent.com/git/git/master/t/README). Shell/TAP test harness and selected-case reuse.
- **S31:** [Pandoc manual](https://pandoc.org/MANUAL.html) and [filters](https://www.pandoc.org/filters.html). Document conversion, external PDF engines and filter process boundary.
- **S32:** [cmark README](https://raw.githubusercontent.com/commonmark/cmark/master/README.md). C99 reference converter with no external dependencies.
- **S33:** [CommonMark 0.31.2 specification/examples](https://spec.commonmark.org/0.31.2/). Independent versioned conversion fixtures.
- **S34:** [libcurl open-socket callback](https://curl.se/libcurl/c/CURLOPT_OPENSOCKETFUNCTION.html). Socket callback contract; not an HTTP host-tool protocol.
- **S35:** [DuckDB 2.0 CSV documentation](https://duckdb.org/docs/2.0/data/csv/overview). Verified CSV query/import and table-creation examples after following the stable-page redirect; documented workflow, not agent-adoption evidence.
- **S36:** [DuckDB sqllogictest introduction](https://www.duckdb.org/docs/preview/dev/sqllogictest/intro) and [test configuration](https://duckdb.org/docs/preview/dev/sqllogictest/test_configuration). SQL/result tests and runner controls; preview documentation, pin before experiments.
- **S37:** [Linux man-pages — unlink](https://man7.org/linux/man-pages/man2/unlink.2.html). Name deletion versus open-object lifetime.
- **S38:** [Linux man-pages — fcntl locking](https://man7.org/linux/man-pages/man2/fcntl_locking.2.html). Process-associated and OFD lock distinction.
- **S39:** [Linux man-pages — fsync/fdatasync](https://man7.org/linux/man-pages/man2/fsync.2.html). Storage/directory synchronization semantics and error contract; relevant to the volatile-profile boundary.
- **S40:** [fd 10.5.0 README](https://raw.githubusercontent.com/sharkdp/fd/v10.5.0/README.md) and [integration tests](https://raw.githubusercontent.com/sharkdp/fd/v10.5.0/tests/tests.rs). Version-pinned discovery behavior and test source; not a new guest run.

[R-fit]: ../growos-fit/02-TRANSCRIPT-NEEDS-AND-PRODUCTS.md
[R-native]: ../../jitk/docs/results/shard-r7-integrate.md
[R-node]: ../growos-node/05-BENCHMARKS-AND-GOALS.md
[S01]: https://sqlite.org/whentouse.html
[S02]: https://www.sqlite.org/cli.html
[S03]: https://raw.githubusercontent.com/sqlite/sqlite/version-3.50.4/src/os_unix.c
[S04]: https://www.mehdi.cz/blog/how-sqlite-commits-a-transaction-followed-with-strace
[S05]: https://www.sqlite.org/atomiccommit.html
[S06]: https://sqlite.org/wal.html
[S07]: https://raw.githubusercontent.com/sqlite/sqlite/version-3.50.4/test/trans.test
[S08]: https://raw.githubusercontent.com/sqlite/sqlite/version-3.50.4/test/savepoint.test
[S09]: https://sqlite.org/testing.html
[S10]: https://man7.org/linux/man-pages/man2/pwrite.2.html
[S11]: https://support.claude.com/en/articles/14554922-claude-code-user-faq
[S12]: https://github.com/anthropics/claude-code/issues/2084
[S13]: https://github.com/BurntSushi/ripgrep/blob/master/GUIDE.md
[S14]: https://www.anthropic.com/research/code-execution-with-mcp
[S15]: https://www.anthropic.com/news/agent-capabilities-api
[S16]: https://docs.micropython.org/en/latest/develop/writingtests.html
[S17]: https://docs.python.org/3.13/using/configure.html
[S18]: https://raw.githubusercontent.com/python/cpython/v3.13.0/Python/bootstrap_hash.c
[S19]: https://github.com/python/cpython/blob/main/Lib/test/libregrtest/cmdline.py
[S20]: https://www.lua.org/manual/5.4/manual.html
[S21]: https://www.lua.org/tests/
[S22]: https://raw.githubusercontent.com/mirror/busybox/master/testsuite/README
[S23]: https://aider.chat/docs/repomap.html
[S24]: https://tree-sitter.github.io/tree-sitter/using-parsers/2-basic-parsing.html
[S25]: https://tree-sitter.github.io/tree-sitter/cli/test.html
[S26]: https://jqlang.org/manual/
[S27]: https://github.com/jqlang/jq/blob/jq-1.8.2/tests/jq.test
[S28]: https://aider.chat/docs/git.html
[S29]: https://git-scm.com/docs/git
[S30]: https://raw.githubusercontent.com/git/git/master/t/README
[S31]: https://pandoc.org/MANUAL.html
[S32]: https://raw.githubusercontent.com/commonmark/cmark/master/README.md
[S33]: https://spec.commonmark.org/0.31.2/
[S34]: https://curl.se/libcurl/c/CURLOPT_OPENSOCKETFUNCTION.html
[S35]: https://duckdb.org/docs/2.0/data/csv/overview
[S36]: https://www.duckdb.org/docs/preview/dev/sqllogictest/intro
[S37]: https://man7.org/linux/man-pages/man2/unlink.2.html
[S38]: https://man7.org/linux/man-pages/man2/fcntl_locking.2.html
[S39]: https://man7.org/linux/man-pages/man2/fsync.2.html
[S40]: https://raw.githubusercontent.com/sharkdp/fd/v10.5.0/README.md
