# G03 — Resurrections: every killed idea, re-run through the tailwind filter (2026-10-29)

**Assignment.** Rounds 1–12 killed ideas with filters that round 13 dropped or changed. This report lists every distinct
killed or parked idea I could find, re-runs each one through the round-13 filter (`../BRIEF-tailwind.md`, unchanged in
`../BRIEF-gaps.md`), re-checks the "already taken" deaths against 2026 activity, and develops the strongest
resurrections in the grow → oracle → ratchet form.

**Labels.**
- **Q**: quoted;
- **F**: sourced;
- **I**: inference;
- **E**: estimate.

"Checked" means I opened the source myself on 2026-10-29.

**How the inventory was built.**
- **My own reading:** `../../RESEARCH-SUMMARY.md` (§0–16), A09's 131-row audit, `flip/04-broad.md`'s 25-idea sorting
  table, `flip2/06-sweep.md` in full, and `stack/` and `connect26/SUMMARY.md`.
- **Four parallel extraction passes** (reading helpers, no writing):
  - catalogue R1–R5;
  - catalogue R6–R9 (1,109 entries plus 362 rejected one-liners in total);
  - `stack/`, `connect26/` and the side folders (`cloudflare-goose/`, `primitive/`, `portability/`, `next/`,
    `podcast/`, `product/`, `pitch/`, and the top-level notes);
  - `synthesis/S01–S07` and `ambition/A01–A08`, plus the round-13 cut lists.

  Each helper returned rows with `file:line` anchors. I merged and deduplicated them, and spot-checked the rows that
  matter for a verdict against the source.

---

## 1. What changed in the filter, and what that frees

| Old filter (rounds 1–12) | Where it killed | Round-13 filter | What that frees, and what it doesn't |
|---|---|---|---|
| **100–1000× ambition** (A09: "Product/Tool rung → NO") | Nearly every tool-sized finalist from rounds 6–12 | **About 10×**: "very ambitious for one person" | Frees deep, solo-sized artifacts. It does *not* free tools whose whole value is code a model can write. |
| **One-shot test read as "the value must be non-code"** (data, people, institutions) | All tools; pushed survivors into commons and registries | **One-shot test:** the accumulated grown artifact, the structure and the check count as value | Frees *grown catalogues checked against an oracle* (a kernel's syscalls, a library's boxes, a language's lexers). Still kills fixtures, wrappers and harnesses. |
| **Needs users / demand evidence** ("niche market", "demand inferred", "tiny buyer") | Protocol learning, RLBox, OpenZL, Rubi, verified numerics | **Clear value, no users needed** | Frees ideas killed only by market size. |
| **Needs community / an institution** (B01–B20) | The 20 A09 survivors | **Solo**: no partners, participants or private data | Kills the commons **again**. Their solo kernels mostly turn back into the small tools A09 already rejected. |
| **Stack-native**: Cloudflare/TS-adjacent, "the platform builds it" | Everything non-web from rounds 6–7 after round 8 | **Any language except Python** | Frees compression, C libraries, protocols and lexers. Platform-owned ideas stay dead as TAKEN. |
| **Flip rule, gate 4**: "whoever owns the check wins" | QEC, PLC, zkVM, simulation codes | **Not taken**, checked in 2026 | Frees ideas whose oracle is *public* (a reference implementation, a round-trip, an official lexer). Incumbent-owned oracles stay dead. |
| **"The loop is free; the check is scarce"** (read as a reason to kill) | Every "propose and check" idea in rounds 2–7 | **The check is the builder's contribution** | Reverses the sign. A scarce, hard-to-game check is now the moat, not the objection. |
| **Pre-AI priors**: "missing capabilities aren't missing code", "per-case labour keeps it niche" | Fault-grown Node (round 3), RLBox, SFI, mappers | Dropped | GrowOS disproved the first. Most ideas it killed were later taken by others (Deno), so they stay dead anyway. |

**Kill tests that still apply, and that do most of the killing below:**
- **TAKEN, active in 2026.**
- **Excluded:** GrowOS lineage, the builder-rejected list, and round-13 ideas (T01–T08).
- **Fails tailwind:** the value *is* the code, so the next model writes it.
- **Needs people, devices or private data.**
- **No oracle the agent cannot edit.**
- **A mechanism, not a value.**

---

## 2. Verdict codes used in the table

- **R**: resurrected, developed in §5.
- **P**: passes the new filter; held in reserve (§5.4).
- **T**: stays taken; the taker is active in 2026. §4 lists the re-checks.
- **XG**: GrowOS lineage (kernel/OS growing, driver environments, the STEPS loop, DB personality).
- **XB**: on the builder-rejected list in `BRIEF-tailwind.md`.
- **X13**: already pitched in round 13 (T01–T08 picks and runners-up).
- **Ft**: fails tailwind. A wrapper, fixture, adapter, harness or port whose value is its code; one prompt for the
  next model.
- **Fs**: fails solo / no-users. Needs participants, partners, customers' traffic, physical devices or private data.
- **Fo**: fails oracle. No independent check the agent cannot edit, or the check is gameable or circular.
- **Fv**: a mechanism without a value, or the economics were measured and refuted.
- **Fp**: Python-bound, or physics/capital-bound.

---

## 3. The inventory: every distinct killed or parked idea

<!-- TABLE -->

---

## 4. "Taken" deaths, re-checked for stalled takers (2026-10-29)

The rule: a TAKEN death stays dead unless the taker has stalled or quit. I re-checked every taker behind an idea that
would otherwise pass the new filter.

| Idea that would otherwise pass | Taker | Status on 2026-10-29 (F) | Verdict |
|---|---|---|---|
| Agent-grown Node compatibility / fault-grown Node (rounds 2, 8) | Deno's `node-compat` agent skill | Active. Deno 2.8 is reported at 76.4% of Node's own test suite ([summary of the release notes](https://dev.to/0xgosu/deno-28-makes-the-node-compatibility-bet-real-ijd)), and the skill ships in `denoland/deno` | **T** |
| Workload-specific database engines (round 13 cut, Mattis/Theo seeds) | Bespoke OLAP, TU Darmstadt | Active. Published at VLDB 2026 with code ([arXiv 2603.02001](https://arxiv.org/abs/2603.02001), [PVLDB 19](https://www.vldb.org/pvldb/vol19/p3759-wehrstein.pdf)) | **T** |
| Proven rewrites of C libraries | lean-zip (Kim Morrison, Lean FRO) | Active. Presented June 2026 ([Lean talk](https://lean-lang.org/presentations/20260604_DFMD/)) | **T** |
| Agent-evolved SAT/SMT solvers | SATLUTION (NVIDIA), LLM2SMT | SATLUTION: a 2025 paper with no public code found ([arXiv 2509.07367](https://arxiv.org/abs/2509.07367)). LLM2SMT: March 2026. Crowded rather than stalled | **T** |
| Excel-exact formula engine (round 13 cut: "no seed") | IronCalc and others | Active. IronCalc 0.8.3 tests itself against Excel-computed files ([docs.rs](https://docs.rs/crate/ironcalc/0.8.3)) | **T** |
| Live Wasm migration ("teleport") | Weave | Small (93 commits, 48 stars, [repo](https://github.com/dphilla/weave)). The idea fails value anyway | **Fv** |
| Byte-exact game decompilation (round 13) | momo5502, freeqaz | Active hobbyists. Only decomp.wtf was archived, on 2026-10-15 (per T01 §7) | **T** |
| Library sandbox retrofits by agent | none found | Firefox still has six RLBox libraries ([searchfox](https://searchfox.org/firefox-main/source/security/rlbox/docs/index.md)); no LLM automation found | **R** (§5.2) |
| Agent-grown OpenZL format descriptions | Meta (risk) | Moving. Collet: LLM SDDL "actually works"; "dozens more" formats planned ([LWN](https://lwn.net/Articles/1053018/)) | **R** (§5.3), Open 2 |
| Multi-language SIMD lexing | none (OXC covers JavaScript only) | One-language projects only (§5.1) | **R** (§5.1) |
| LLM-written mappers for protocol learning | none found | Human-mapper learning is active ([SSTIC 2026](https://www.sstic.org/2026/presentation/using_active_automata_learning_to_find_vulnerabilities_in_network_stacks/)) | **P** |
| Certificates required of evolved code | none found | Google's guide lists no certificates (updated 2026-10-28) | **P** |
| LLM-evolved QEC decoders | none found | qBraid's AlphaEvolve work covers encodings, not decoders | **P** |

**I — The general finding.** None of the takers I checked has stalled. The one small taker (Weave) backs an idea that
fails on value regardless. Every "taken" death in the inventory stays dead.

---

## 5. The resurrections

All three developed ideas came from the only two places where earlier rounds asked "which old idea died of per-case
labour, and has a public check?": the flip rounds (`flip/04`, `flip2/06`) and A09's "pending discovery" row. Rounds
8–11 produced no resurrection. Under any filter, their kills were correct: platform-taken, or tool-sized.

### 5.1 Carve: every programming language lexed at memory bandwidth, token for token identical to its official lexer

**Name and one sentence.** An agent grows a classify–carve–compress SIMD lexer for one language after another. A
language is admitted only when its token stream matches the language's own official lexer exactly, on a held-out
corpus and on adversarial files, at several GB/s. The accepted lexers are plain Rust that runs with no model.

**What it resurrects.** A09 row E19 #5 (E19 P04), "sparse-context language-processing research". It died as "**NO
pending discovery**; H/M. 'Research might discover something' cannot itself pass both tests". The reason given was "a
port, likely", and "a new general algorithm/theorem is not assured" (`ambition/A09-critic.md:155`). Both
objections belonged to the old filter. The tailwind filter does not ask for a theorem; it asks for a grown artifact
with an uneditable check.

**The seed (Q, checked against `transcripts/p3-64-viteconf-viteconf-2026-5th-edition-we-are-vite.txt`).** Shannon
Jackson, principal engineer at Atlassian, ViteConf 2026. Auto-captions normalised: "pausing"/"pasa" → parsing,
"byes" → bytes.
- [2:40:00] "[Parsing] is underneath everything. linting, bundling, code highlighting, meta frameworks… I spent eight
  months working on this and nearly quitting quitting twice because I was getting negative results."
- [2:46:00] "95 to 99% of all [bytes] don't require any context at all. Which leads me to the solution not just for
  JavaScript, but for any low density context dependent language. And this is the algorithm that cracked it.
  Classify, carve, compress."
- [2:47:00] "…it can lex JavaScript source code at roughly 6 to 7 GB per second."
- [2:52:00] "users will see a two times improvement in [parse] speed on 95% of files."

This is a seed of the GrowOS kind: one practitioner says the method generalises to a whole class, and then builds only
one member of it.

**How the algorithm works, plainly (Q/I).**
1. **Classify:** SIMD instructions mark every token start and end, 64 bytes at a time.
2. **Carve:** a scalar pass visits only the 1–5% of bytes that need context and repairs them: strings, comments,
   templates, regex versus division.
3. **Compress:** the bitmap is packed into a dense token array.

The parser then reads tokens from an array instead of pulling them one by one. That change is what doubled his
end-to-end parse speed (2:50–2:51).

**What grows, and its oracle.**
- **What the builder designs (I).**
  - A small lexer IR: a declarative "context sketch" of which constructs open and close context-dependent regions.
  - The bitmap-to-token-array runtime.
  - A canonical token format, with a per-language mapping from official token kinds. It is fixed before growth starts.
  - The harness, the acceptance rule and the public scoreboard.
- **What the agent grows, per language and ISA (I).** The carve routines for each context construct, classify kernels
  for AVX2, AVX-512, NEON, SVE2 and Wasm SIMD128, and the compress stage.
- **The growth trigger, the equivalent of GrowOS's missing syscall (I).** A file the accepted lexer cannot certify:
  a mismatch on a newly added corpus file, or a new language version. That lexer drops to a scalar fallback and is
  queued for regrowth.
- **The oracle the agent cannot edit (I).**
  1. **The official lexer as a black box.** Examples: rustc's `rustc_lexer`, Go's `go/scanner`, CPython's tokenizer
     (run as a reference binary; the builder writes no Python), the TypeScript compiler's scanner, clang's raw-token
     dump, javac's scanner, Ruby's Ripper. Token kinds and byte spans must be equal under the fixed mapping.
  2. **A held-out corpus split by repository, not by file.** Several GB per language from permissively licensed code,
     never shown to the agent.
  3. **Generated adversarial files** aimed at carve constructs: nested quotes, unterminated comments, Unicode
     identifiers, CRLF, BOMs, and constructs placed across 64-byte block boundaries.
  4. **Throughput on fixed hardware**, the median of repeated runs.
  5. **A mutation check on the oracle itself:** bugs injected into a correct lexer must be caught, or the harness is
     too weak.
- **The ratchet (I).** For each (language, language version, ISA), the scoreboard keeps the fastest token-identical
  lexer. A mismatch demotes it to the scalar path until it is regrown, so nothing accepted is silently lost.

**Tailwind, and why the next model doesn't eat it (I).**
- **What the models are working against is the hard carve logic.** Examples: Python f-strings (nested since PEP 701),
  Ruby, Perl and shell heredocs, C++ raw strings, Swift and Kotlin interpolation, Rust `r#"…"#` strings and nested
  block comments, Haskell layout, and division-versus-regex-style ambiguities.
- **Each model release can do more of it:** crack more of these constructs, write better kernels for more ISAs, and
  shrink the share of bytes that need carving. Because the oracle and the corpus never move, every gain is real.
- **The next model doesn't eat it.** From a prompt, it produces one plausible lexer. Carve holds a measured,
  oracle-checked catalogue across languages × versions × ISAs, plus the harness that makes "identical" mean something.

**One-shot test (I/E).**
- **What a model two generations ahead could do (E):** probably write a decent SIMD lexer for an easy language from one
  prompt.
- **What it cannot produce from a prompt (I):**
  - more than 30 languages × 4 ISAs;
  - each proven token-identical to the official lexer on tens of GB of real code.

  That needs per-language oracle harnesses (each in a different toolchain), the corpus, the hardware and days of runs.
  The one existing human instance took eight months of search (Q, 2:40).

**About 10× (E).** "simdjson for every programming language" is very ambitious for one person, but not impossible. Once
the IR exists, each further language is days of agent time plus harness work.

**Value proposition.** Every code tool (linters, formatters, bundlers, code search, AI code indexers) can tokenize
source at memory bandwidth, with a guarantee that its tokens are exactly the compiler's.
- **For JavaScript (Q):** the speaker measured about 2× end-to-end parse speed on 95% of files.
- **For other languages (I):** the end-to-end gain is unknown. Measuring it is part of the project.

**The 6-week version (E).**
- **Week 1:** canonical token format, and oracle adapters for Go, Rust, Python, C, Java and TypeScript. Also a
  repository-split held-out corpus (about 5 GB per language), the adversarial generator, and the oracle mutation test.
- **Week 2:** calibration. JSON against simdjson, and JavaScript against OXC's lexer and the speaker's published
  prototype gist (2:52).
- **Weeks 3–5:** the IR and runtime. Agents grow the six languages on AVX2 and on NEON (the builder's M-series Mac).
- **Week 6:** an unseen language (Lua or Zig) grown overnight, end to end, plus the write-up.

**The demo.** A terminal scoreboard with one row per language: official lexer MB/s, Carve GB/s, identical files out of
total, and the share of bytes carved. Then a live "add Zig" run: the agent works overnight, and by morning Zig runs at
N GB/s with zero mismatches on 2 GB, next to the list of mismatches the oracle caught on the way. The "wait, what?"
line: *"Python tokenized at 4 GB/s, and every token matches CPython's own tokenizer on 5 GB of GitHub code."*

**Prior art, and what's left (F, searches dated 2026-10-29).**
- **simdjson** ([repo](https://github.com/simdjson/simdjson), [Langdale & Lemire 2019](https://arxiv.org/abs/1902.08318)).
  In plain terms: it showed that a parser can find every structural character with SIMD bitmasks *before* parsing,
  and so parse JSON at GB/s. Carve's seed extends that idea to languages whose meaning depends on context.
- **OXC is integrating the speaker's JavaScript lexer** (Q, 2:41). Its docs mention SIMD on x86-64 AVX2, with other
  platforms "work in progress" ([docs mirror](https://docsearch.algolia.com/mcp/docs/repo/oxc-project/oxc); unverified
  wording).
- **One-language human projects:**
  - Validark's compaction-based Zig tokenizer: AVX-512 only, 1.4 GB/s, "~2.75x faster than current", April 2025
    ([ziggit](https://ziggit.dev/t/new-compaction-based-zig-tokenizer/9661)).
  - A TU Delft thesis lexing C with SIMD at about 12× GCC's lexer, without Unicode
    ([repository](https://repository.tudelft.nl/file/File_0dd21f86-ee80-49e2-b4d1-bdb56f84f265)).
  - HTML: [fhp-tokenizer](https://docs.rs/fhp-tokenizer) and [arXiv 2503.01662](https://www.arxiv.org/pdf/2503.01662)
    (about 20× HTML scanning on ARM).
  - SQL: [Lime's SIMD tokenizer](https://gregburd.codeberg.page/lime/tokenize__simd_8h_source.html).
  - DNS zone files ([arXiv 2411.12035](https://arxiv.org/pdf/2411.12035)).
- **What's left (I):** each of these is one hand-made language. None checks token identity against an official lexer
  at corpus scale. No one has tested the speaker's generalisation claim ("any low density context dependent
  language"). I found no multi-language SIMD lexer generator in 2026 searches.

**The kill test (E: 3 days, about $100–300 of model calls).** Grow Go and Python against the harness. Kill if any of
these happens:
1. Token-identical lexers stay below 3× the official lexer's throughput.
2. The carved share is above 20% of bytes on the corpus, so the low-density assumption fails outside JavaScript.
3. The current frontier model one-shots a lexer that passes the full held-out and adversarial suite at the same
   speed. Then the catalogue is a prompt, and the idea fails tailwind.
4. The speaker or OXC announces a multi-language generalisation. Then contribute languages instead.

| Tail | Cool | Value | Open | Solo | Demo |
|---:|---:|---:|---:|---:|---:|
| 4 | 4 | 3 | 4 | 5 | 5 |

### 5.2 Boxed: every widely used C library in an in-process sandbox, grown one library at a time

**Name and one sentence.** A program depends on a C library nobody has boxed yet. An agent compiles that library to
Wasm, wraps it with RLBox's tainted types, and writes a validator for every value that crosses back. The box is
accepted only after byte-identical differential runs and long untrusted-library fuzzing find nothing. Accepted boxes
run with no model.

**What it resurrects.** `flip/04` rank 1, "Library sandbox retrofits by agent: RLBox with a hostile-library oracle". It
was the only one of 25 old ideas in that table that was "**uncrowded** (no LLM work found)" (`flip/04-broad.md:30`).
It then died three times:
1. **flip/04 itself:** "a bridge technology; Rust rewrites with differential oracles are winning at Chrome. It is
   weaker than GrowOS" (`flip/04-broad.md:18–19`).
2. **§13 #7:** "smaller ones… each is narrow, a contribution, or uncool".
3. **A09:** "**NO → B06**; H. Adopting an existing boundary does not create a new evidence or participant asset"
   (100× and non-code tests).

Under the new filter, the grown, fuzz-evidenced catalogue *is* the asset, and no institution is needed.

**The seed.**
- **The issue (Q, checked):** RLBox maintainer Deian Stefan, RLBox v2 RFC, 2023-01-04. The C wrappers are "tedious
  boilerplate code that developers have to write by hand today"
  ([PLSysSec/rlbox discussion #50](https://github.com/PLSysSec/rlbox/discussions/50)).
- **The paper (F):** Narayan et al., "Retrofitting Fine Grain Isolation in the Firefox Renderer", USENIX Security 2020
  ([arXiv 2003.00572](https://arxiv.org/abs/2003.00572)). In plain terms, the team compiled libraries to WebAssembly
  and back to C. They then used C++ types to mark every value coming out of a library as *tainted* until code checked
  it, so a memory bug inside the library cannot corrupt the browser. Each library took "a bit over two days" and about
  180 lines, plus hand-written validators (28 sites for JPEG, 51 for PNG, per `flip/04:72–73`).
- **The adoption gap (F, checked):** Firefox ships six such libraries (graphite, ogg, hunspell, expat, woff2 and
  soundtouch), still six on 2026-10-29
  ([searchfox](https://searchfox.org/firefox-main/source/security/rlbox/docs/index.md)). Per-library labour and review
  are why it never spread.

**What grows, and its oracle.**
- **What the agent grows, per library (I):**
  - a wasm2c build recipe;
  - a tainted-type API wrapper;
  - validators;
  - a box manifest: memory cap, allowed callbacks, the host-visible API.
- **What the builder designs (I):**
  - the manifest format;
  - the oracle;
  - the acceptance rule;
  - re-verification against upstream releases;
  - consumer bindings: C++ initially, Rust and Go later.
- **The growth trigger (I).** A build that links an unboxed library is a fault and is queued.
- **The oracle the agent cannot edit (I):**
  1. **The compiler.** `tainted<T>` will not compile until every crossing is validated or explicitly copied. This
     checks that the boundary marking is complete.
  2. **Differential runs.** The boxed and native library run on a corpus and must produce byte-identical outputs.
     This checks functional equivalence.
  3. **An untrusted-library harness.** The library side is replaced by an adversarial stand-in that returns
     fuzzer-chosen values and scribbles over its own sandbox memory, while the host runs under ASan and UBSan. Any host
     fault is a "validator fault" returned to the agent.
  4. **A necessity check.** Each validator is removed in turn, and the harness must then find a host fault; otherwise
     the validator is marked untested. This stops "validate everything" no-ops from passing.
- **The ratchet (I).**
  - A published box records the library version, the recipe and its evidence: CPU-hours clean and coverage.
  - Every upstream release re-runs the oracle, and a regression demotes the box.
  - The catalogue only grows.

**Tailwind, and why the next model doesn't eat it (I).**
- **Harder targets need better models.** Bigger, gnarlier APIs (libxml2, libarchive, poppler, ImageMagick coders,
  libavcodec subsets) and semantic validators (a length used for logic, not just memory) need them, and each model
  release boxes more of that tail, faster.
- **The safety does not rest on trusting the model's code.** The sandbox confines the library's memory errors, and the
  evidence comes from harnesses the agent cannot touch.
- **What a prompt yields is one wrapper.** The catalogue, with thousands of fuzzing CPU-hours and version tracking, is
  accumulated.

**One-shot test (I).**
- **What a model can do from a prompt:** box libyaml.
- **What it cannot produce:** 100 boxes, each with independent fuzz evidence and re-verified on every upstream release.

**About 10× (E).** Boxes for the 100 C parsing and codec libraries that Rust, C++ and Go programs most often vendor.
That is very ambitious for one person.

**Value proposition.** Use libwebp, libxml2 or libarchive unchanged, and if one of them has a memory bug, the bug stays
inside its box. Two facts show the stakes:
- **The share (F):** memory-safety bugs are about 70% of serious security bugs in Chromium
  ([Chromium](https://www.chromium.org/Home/chromium-security/memory-safety/)).
- **The example (F):** the 2023 libwebp heap overflow, CVE-2023-4863, reached Chrome and every app that bundled the
  library ([Tenable](https://www.tenable.com/cve/CVE-2023-4863)).

Unlike a rewrite, a box keeps behaviour byte-identical, so there is no compatibility risk.

**The 6-week version (E).**
- **Week 1:** the toolchain (RLBox, wasm2c and the no-op sandbox), the four oracle layers, and five targets: libyaml,
  cJSON, libpng, the libwebp decoder and zstd.
- **Week 2:** calibration on Firefox's expat box. Regrow its validators blind and compare them with Mozilla's; the
  necessity check must rate Mozilla's validators as necessary.
- **Weeks 3–5:** agents box the five libraries. Record agent wall-clock against the paper's two person-days,
  validators written, faults found and overhead.
- **Week 6:** publish the boxes with their evidence, and switch one real C++ image tool to the boxed libwebp.

**The demo.** A split screen.
- **Left:** the untrusted-library harness drives a host that uses native libwebp, and ASan reports host faults
  within seconds.
- **Right:** the same harness against boxed libwebp runs for hours with zero host faults, with a ticker of the
  validator faults the agent fixed during growth.

**Prior art, and what's left (F, searches dated 2026-10-29).**
- **RLBox itself** (manual; six libraries in Firefox).
- **Google's Sandboxed API.** Process-based, with hand-written policies; the code dates from 2019–2023
  ([docs](https://developers.google.com/code-sandboxing/sandboxed-api)).
- **LLM-CAL** ([NDSS 2026](https://www.ndss-symposium.org/wp-content/uploads/2026-s709-paper.pdf)). In plain terms: an
  LLM annotates C code so that a tool can split cryptographic code into a trusted-hardware part and an ordinary part.
  It is adjacent: partitioning, not library boxing, and it has no adversarial-library oracle.
- **Compartmentalization-aware program repair** (ICSE 2026, journal-first;
  [record](https://research.manchester.ac.uk/en/publications/compartmentalization-aware-automated-program-repair/)).
- **The rewrite alternative.** [DARPA TRACTOR](https://www.darpa.mil/research/programs/translating-all-c-to-rust)
  (C to Rust) and Chrome's Rust rewrites (`flip/04:115–116`).
- **Distinct from the rejected "Fil-C extended to all LLVM languages."** Fil-C changes the compiler so that C itself
  is memory-safe. Boxed changes nothing about the language; it contains one library and checks what crosses its
  boundary.
- **What's left (I):** no agent-grown catalogue of boxed libraries, and no evidence-backed catalogue of any kind.
  Searches for LLM-driven RLBox or library sandboxing on 2026-10-29 found none.

**The risks (F/I).**
- **wasm2c overhead on hot codecs.** The expert objection quoted in `flip/04:115–116` is 10–40%.
- **The sandbox runtime is itself a target.**
  - [CVE-2026-90648](https://osv.dev/vulnerability/CVE-2026-90648): a wasm2c sandbox escape on 32-bit platforms.
  - Wasmtime's 2026-04-09 batch: twelve advisories, eleven found with LLM tooling
    ([Bytecode Alliance](https://bytecodealliance.org/articles/wasmtime-security-advisories), via `flip/01:194`).
  - The response: keep the trusted runtime small, pin it, and re-run the oracle on every runtime release.
- **Proximity to the rejected Fil-C item** (see above).

**The kill test (E: 2 days, from `flip/04:116–118`).** Box libyaml and libpng. Kill if any of these happens:
1. At least 30% of accepted validators pass the harness, yet a reviewer still finds a semantic hole. The oracle is then
   too weak.
2. wasm2c overhead is above 25% on 3 of the 5 libraries.
3. The necessity check shows that the harness leaves most validators untested.

| Tail | Cool | Value | Open | Solo | Demo |
|---:|---:|---:|---:|---:|---:|
| 4 | 3 | 4 | 4 | 4 | 4 |

### 5.3 Format Foundry: a compressor that grows a codec for each file format it meets

**Name and one sentence.** Whenever a file falls back to generic zstd, an agent writes an OpenZL format description for
it. The description is kept only if OpenZL's fixed universal decoder round-trips every file and held-out files get
measurably smaller at a set speed. The result compresses at GB/s with no model.

**What it resurrects.** `flip2/06`'s ONE bet, "Grow format descriptions for format-aware compression (OpenZL), with
roundtrip as the oracle" (`flip2/06-sweep.md:98`). It was never developed. It died to filters the new round dropped:
- **Stack-native:** from round 8 on, rounds had to be Cloudflare/TypeScript-adjacent.
- **Needs users:** the value case leaned on paying customers' data, "a $1–3k/month service per customer is plausible
  only at multi-PB scale" (`:135–136`).
- **Occupancy risk:** "Meta wrote the LLM spec page" (`:131`).

**The seed.**
- **Yann Collet, OpenZL's lead (Q), quoted by Jake Edge in
  [LWN, 2026-01-14](https://lwn.net/Articles/1053018/):**
  - designing a format-specific algorithm "typically takes around 18 months";
  - asking an LLM to write SDDL "actually works", but "like every LLM, you should read it".
- **Meta Engineering (Q),
  [2025-10-06](https://engineering.fb.com/2025/10/06/developer-tools/openzl-open-source-format-aware-compression-framework/):**
  every bespoke scheme means "another compressor and decompressor to create, ship, audit, patch, and trust". The same
  post's benchmark on one file (F): zstd -3 at 1.31×, xz -9 at 1.64×, and OpenZL at 2.06×, compressing at 340 MB/s and
  decompressing at 1,200 MB/s.
- **Coverage today (F):** OpenZL supports "around a dozen formats", with dozens more planned (LWN).

**What grows, and its oracle.**
- **What the agent grows, per format (I):** an SDDL description or parser, plus a trained plan.
- **What the builder designs (I):**
  - **The growth trigger, a "format fault":** a crawler runs every file through the current registry, and each fallback
    to zstd is a fault.
  - The acceptance gate, held-out splits by date and source, the registry and the scoreboard.
- **A later rung (I):** new transforms inside the compression graph. Each is accepted only with exhaustive
  round-trip tests *and* a Lean proof that decoding inverts encoding, on the
  [lean-zip](https://lean-lang.org/presentations/20260604_DFMD/) precedent.
- **The oracle the agent cannot edit (I, from `flip2/06:116–125`):**
  1. **Lossless round-trip of every file through OpenZL's fixed universal decoder.** The agent cannot ship a custom
     decoder, so it cannot hide data inside one.
  2. **Compressed bytes on held-out files,** counting plan and dictionary bytes.
  3. **A throughput floor** for both compression and decompression.
  4. **A baseline floor:** the result must beat max(zstd -19 with a trained dictionary, OpenZL with no description).
- **The ratchet (I).** One registry entry per format version. It is replaced only by a better score on the same
  held-out set, and any failure falls back to zstd, never to data loss.

**Tailwind, and why the next model doesn't eat it (I).**
- **The specs are hard and the score is honest.** Better models read gnarlier specs (GRIB2, FITS, HDF5 internals,
  pcap-ng, game replays, CAN logs) and find better transforms, and the score is a byte count that cannot be faked.
- **The artifact sits where no model can.** It runs in storage and network hot paths at GB/s (`flip2/06` gate 3).
- **What a prompt yields is one description.** The registry of hundreds, with held-out evidence, is accumulated.

**One-shot test (I).**
- **What a model can do:** write one good description.
- **What it cannot produce from a prompt:**
  - a measured registry across hundreds of public formats;
  - transforms that come with proofs.

**About 10× (E).** The "zstd of everything": beat zstd -19 by at least 1.3× on 100 common structured formats at zstd
speeds. That is very ambitious for one person.

**Value proposition.** Files 1.3–2× smaller than zstd at zstd's speed, for every format the system has met, and every
file still round-trips.

**The 6-week version (E, extending `flip2/06`'s two-week proof).**
- **Week 1:** build OpenZL's CLI and trainer from source (the 2026-10-28 attempt with the Python wheel failed because
  the wheel has no trainer; `flip2/06:153–156`), and pick 15 public formats with their baselines: pcap, Parquet pages,
  protobuf-delimited logs, OTLP dumps, GRIB2, FITS, BAM, SQLite pages, game replays, CAN logs, NetCDF, GLB, MIDI,
  OSM PBF and GeoTIFF.
- **Weeks 2–4:** the agent writes descriptions with only the spec, sample files and a read-only harness.
- **Week 5:** the format-fault crawler, run on a mixed corpus.
- **Week 6:** the scoreboard and the write-up, plus optionally one proof-carrying transform.

**The demo.** Point it at a folder of 40 file types. It finds 12 that it doesn't know and grows codecs overnight. By
morning the folder is 1.4× smaller than zstd -19, and every file round-trips.

**Prior art, and what's left (F, searches dated 2026-10-29).**
- **OpenZL itself.** Meta is moving in this direction: the [2026 paper](https://arxiv.org/abs/2605.09928), an "SDDL for
  LLMs" spec page ([openzl.org/sddl](https://openzl.org/sddl/)), Collet's LWN remarks, and an "automated compressor
  explorer" that "is getting better at proposing safe, testable changes" (Meta post).
- **[AgentGC](https://arxiv.org/abs/2601.13559)** (January 2026). In plain terms, a team used several LLM agents to
  evolve compressors for genomics files. It covers one domain and has no public registry.
- **LLM-as-compressor work.** Here the model sits in the decode path, which is a different idea. Example:
  [arXiv 2607.24192](https://arxiv.org/pdf/2607.24192), on source code.
- **What's left (I):**
  - the long tail of public formats Meta will not prioritise;
  - a public held-out scoreboard;
  - transforms that come with proofs.

  This is the weakest "Open" of the three: Meta owns the framework and is heading the same way.

**The kill test (E, from `flip2/06:147–151`).** Kill if, on held-out files, the grown plan beats max(zstd -19 with a
dictionary, OpenZL generic) by less than 15% on at least 6 of 10 formats at equal or better decode speed. Also kill if
more than 2 formats need human edits. If Meta ships agent authoring plus a public format library first, stop the
project story and keep the results as upstream contributions.

| Tail | Cool | Value | Open | Solo | Demo |
|---:|---:|---:|---:|---:|---:|
| 4 | 3 | 4 | 2 | 4 | 4 |

### 5.4 Reserves: these pass the new filter, but are weaker than the three above

**Mealy Foundry: learned state machines for protocol implementations, with LLM-written mappers.**

**Resurrects:** `flip2/06` §3.5. It died as "plausible and unoccupied, but a niche security-testing market that overlaps
`flip/02`" (`flip2/06-sweep.md:479`), a needs-users death the new filter drops.

**The method, plainly (F).**
- **How it learns:** Angluin's L* algorithm (1987) learns a state machine by sending inputs and watching outputs.
- **The labour:** a hand-written *mapper* turns abstract inputs such as "ClientHello" into real bytes, one protocol at
  a time.
- **What it found:** de Ruiter & Poll (USENIX Security 2015) used it to find state-machine flaws in TLS libraries
  ([Vaandrager, CACM 2017](https://cacm.acm.org/research/model-learning/)).

**The grown form (I).**
- **What grows:** the agent writes and extends the mapper (the input alphabet) from the RFC.
- **The oracle:** the live implementation answers the queries, and fixed-budget conformance suites check the learned
  model.
- **The ratchet:** the alphabet only grows.
- **What runs without a model:** the learned models and their derived regression tests.

**2026 check (F).** At
[SSTIC 2026](https://www.sstic.org/2026/presentation/using_active_automata_learning_to_find_vulnerabilities_in_network_stacks/),
active learning with human-built mappers found authentication bypasses in TLS and SSH stacks. So the method is alive,
but I found no LLM-as-mapper work.

**Why it is a reserve.**
- The artifact is a map of implementations, close to the rejected "divergence map" family.
- It overlaps G06's networking ground.

| Tail | Cool | Value | Open | Solo | Demo |
|---:|---:|---:|---:|---:|---:|
| 3 | 3 | 3 | 4 | 4 | 3 |

**Receipts: agent-evolved solvers that must carry certificates checked by tiny verified checkers.**

**Resurrects:** `flip2/06` §3.3. It died as "reads as a feature for Google's AlphaEvolve or OpenEvolve rather than a
product" (`flip2/06-sweep.md:228`).

**The idea, plainly (F).** A certifying algorithm returns its answer plus a witness that a small checker verifies. For
example, a dual solution proves that a linear program's answer is optimal (McConnell, Mehlhorn, Näher & Schweitzer,
[2011](https://doi.org/10.1016/j.cosrev.2010.09.009)).

**2026 check (F).**
- Google's AlphaEvolve reward-hacking guide recommends held-out validation, AST checks and hidden scoring files, but no
  certificates ([docs](https://docs.cloud.google.com/gemini/enterprise/docs/alphaevolve/developer-guide/reward-hacking-prevention),
  updated 2026-10-28; checked).
- Proof logging with verified checkers is active in academia: VeriPB with the CakePB checker
  ([CP 2026](https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.CP.2026.21)).

**Why it is a reserve.**
- Same shape as G08's ContactForge (certificate-checked geometry) and T04's GrowCAS (proof-carrying answers).
- The value is indirect.

| Tail | Cool | Value | Open | Solo | Demo |
|---:|---:|---:|---:|---:|---:|
| 4 | 2 | 3 | 3 | 5 | 3 |

**Evolved quantum error-correction decoders, gated by circuit-level simulation in Stim.**

**Resurrects:** `flip2/06` §3.2. It died to gate 4 ("buyers are about 10–20 hardware companies… can run the same loop
in-house") and to a Python-first start.

**2026 check (F).** I found no LLM-evolved decoder.
[qBraid used AlphaEvolve](https://qbraid.com/press/qbraid-uses-alphaevolve-for-quantum-error-correction) (June 2026),
but for fermion-to-qubit encodings, not decoders.

**Why it is a reserve.**
- No practitioner seed in the corpus.
- The builder has no quantum background.
- It must beat tuned decoders (Relay-BP) and survive FPGA latency, not just untuned BP-OSD.

| Tail | Cool | Value | Open | Solo | Demo |
|---:|---:|---:|---:|---:|---:|
| 4 | 3 | 2 | 3 | 3 | 2 |

---

## 6. What the re-run says about the old filters

<!-- PATTERNS -->

---

## 7. Ranked table and TL;DR

| # | Idea | Resurrects | What grows | Oracle the agent cannot edit | Tail | Cool | Value | Open | Solo | Demo | Sum | Kill test |
|---:|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | **Carve**: every language lexed at memory bandwidth | A09 E19 #5, sparse-context lexing ("NO pending discovery") | Per-language carve rules and per-ISA SIMD kernels | Official lexers on a repo-split held-out corpus, adversarial files, measured GB/s | 4 | 4 | 3 | 4 | 5 | 5 | **25** | 3 days on Go and Python: ≥3× at token identity, carved share ≤20%, not one-shottable today |
| 2 | **Boxed**: the C library ecosystem in in-process sandboxes | `flip/04` #1, RLBox retrofits ("narrow", "→ B06") | Per-library box: recipe, tainted API, validators | Byte-identical differential runs, untrusted-library fuzzing under ASan, validator-necessity check | 4 | 3 | 4 | 4 | 4 | 4 | **23** | 2 days on libyaml and libpng: semantic holes under 30%, overhead ≤25% |
| 3 | **Format Foundry**: a codec for each format it meets | `flip2/06` ONE bet, OpenZL descriptions (never pursued) | Per-format SDDL descriptions and plans; later, proven transforms | Fixed universal decoder round-trip, held-out bytes, speed floor | 4 | 3 | 4 | 2 | 4 | 4 | 21 | 2 weeks on 10 formats: ≥15% over the best baseline on ≥6 of them |
| 4 | Mealy Foundry (reserve) | `flip2/06` §3.5, LLM mappers ("niche market") | Mappers and learned protocol models | Live implementations plus conformance testing | 3 | 3 | 3 | 4 | 4 | 3 | 20 | Does an LLM mapper learn a TLS 1.3 model as large as the hand-written one? |
| 5 | Receipts (reserve) | `flip2/06` §3.3, certificate-carrying code | Certifying solvers | Small verified checkers | 4 | 2 | 3 | 3 | 5 | 3 | 20 | Held-out wrong-answer rate with and without certificates (`flip2/06:238–242`) |
| 6 | Evolved QEC decoders (reserve) | `flip2/06` §3.2 | Decoder programs | Stim circuit-level simulation | 4 | 3 | 2 | 3 | 3 | 2 | 17 | Beat tuned Relay-BP at equal op budget, after HLS synthesis |

**ONE pick: Carve.**
- **The seed:** a verified practitioner prediction of the GrowOS kind ("not just for JavaScript, but for any low
  density context dependent language").
- **The check:** an oracle that is public and uneditable (each language's own lexer), and a number that cannot be faked
  (GB/s at token identity).
- **Fit:** compiler and systems work the builder is good at, a demo that works on a laptop, and a 3-day kill test.

**Runner-up: Boxed.** It has the clearer value, but it sits close to the rejected Fil-C item, and the builder has called
security tools "not exciting".

**TL;DR**
1. <!-- TLDR1 -->
2. Three ideas come back, all with the same shape: a one-off human precedent, a public oracle, and per-case labour that
   agents remove. They are Carve (SIMD lexers for every language), Boxed (RLBox boxes for C libraries) and Format
   Foundry (OpenZL codecs per format, exposed to Meta's roadmap).
3. Pick Carve: a verified ViteConf 2026 seed, official lexers as the oracle, an honest GB/s number, and a kill test in
   three days.
