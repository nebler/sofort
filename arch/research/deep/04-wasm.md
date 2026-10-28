# 04 — What important software could actually run in a Worker or a tab?

Research date: **2026-10-28**. Lens: existing Wasm/pure-TS software, the remaining Workers-specific failures, and one useful open-source project. Read [BRIEF.md](BRIEF.md) and the earlier rounds’ TL;DRs in `v8`, `moonshots`, `moonshots2`, `teleport`, `flip`, `flip2`, and `split` before selecting ideas.

**Labels:** **F** sourced fact, including attributed upstream measurements; **M** measured here; **I** inference/judgment; **E** proposed scope, budget, or threshold. Unless a publication date is stated, sources were checked on **2026-10-28**. A source reporting a deployment is not a deployment independently reproduced here. “No matching implementation found” describes the bounded search below, not a universal absence claim.

## Verdict

**I — The broad Wasm-port opportunity is much more occupied than it appears.** Postgres, SQLite, DuckDB, Python, libgit2, FFmpeg, ImageMagick, TypeScript 7, modern JS compilers, Tree-sitter, PDF engines, and Typst already have ports. Some have explicit Workers integrations. The worthwhile remaining work usually changes **object/file I/O, peak memory, or compatibility**, rather than compiling the engine again.

**I — ONE conditional pick: a small, worktree-free Git merge kernel for Workers and browsers**, exposing the equivalent of modern `git merge-tree --write-tree`, with structured conflicts and a bounded object-store interface. Reuse Git’s implementation where practical; compare gitoxide before choosing a port. Make it an independently useful library that Cloudflare Computer, dgit, and browser editors could adopt. Do not build another forge, agent OS, semantic-merge algorithm, or integration service.

**I — No unconditional green light.** I found concrete limitations and plausible beneficiaries, but no named adopter who has committed to needing this library. The two-day implementation/maintainer test below decides whether the remainder of the two-to-three-week project is justified. The backups are a partial-clone **client** and seekable PDF operations over R2. Their gaps are narrower and less certain than their demos suggest.

## 1. The constraints changed; old size objections are misleading

- **F:** On **2026-09-04**, Cloudflare replaced the old 3 MB Free / 10 MB Paid compressed Worker limits with **64 MiB uncompressed on both plans**. Gzip size is now a transfer/startup consideration, not that deployment gate. Several library READMEs below still quote the old limits. [Cloudflare announcement](https://developers.cloudflare.com/changelog/post/2026-09-04-increased-worker-size-limit/)
- **F:** Workers still have **128 MB per isolate**, including JS heap and Wasm allocations; concurrent requests share it. Global-scope startup must complete within **one second**. Paid HTTP CPU can be configured up to five minutes; Free HTTP CPU is 10 ms. Moving initialization into a handler avoids the startup gate but still costs request CPU and latency. [Current limits](https://developers.cloudflare.com/workers/platform/limits/)
- **F:** Workers accept precompiled Wasm modules and SIMD, but do not provide the Web Worker API or parallel Wasm threading. Experimental WASI support is incomplete. A browser library’s use of `new Worker`, fetch-and-compile, OPFS, or dynamic linking must be examined independently. [Workers Wasm](https://developers.cloudflare.com/workers/runtime-apis/webassembly/)
- **F:** `node:fs` now exists. Its `/tmp` is **request-local, memory-backed, and ephemeral**, not a durable disk or a way around the memory ceiling. `/bundle` exposes bundled files read-only. [Filesystem documentation](https://developers.cloudflare.com/workers/runtime-apis/nodejs/fs/)
- **F:** Vercel Functions with Node/Fluid have a different operating envelope: 2 GB by default, up to 4 GB on eligible plans, and native dependencies are possible. A **2026-06-29** public beta raised eligible Node/Python deployment packages to **5 GB**. A Wasm port is consequently less of an unlock there than in Workers or browsers. [Memory limits](https://vercel.com/docs/functions/limitations), [large Functions announcement](https://vercel.com/changelog/vercel-functions-can-now-be-up-to-5-gb-in-package-size)
- **I:** In a browser, large models and heavy conversions can be reasonable because the tab/device has a different resource envelope. “Hosted by Cloudflare Pages” does not mean “executing in a Cloudflare Worker.” Vercel Edge also differs from Node Functions: its Wasm path expects imported modules, rather than runtime compilation from arbitrary bytes. [Vercel Wasm](https://vercel.com/docs/functions/runtimes/wasm)

**I — A useful admission budget:** aim for **≤80–96 MiB total peak**, a fresh instance after failure/heavy jobs, bounded caches, and streamed or ranged input. This is an engineering target, not a Cloudflare guarantee. Engine code size, declared linear-memory minimum, committed linear-memory high-water, JS copies, and actual total isolate memory are different numbers. A 1 MB Wasm file can still request 128 MB at instantiation.

## 2. Measured artifact census

**M — Method:** queried npm’s `latest` metadata, streamed the published tarballs without running install scripts, SHA-256 hashed `.wasm` members, recompressed each with Python gzip level 9 / `mtime=0`, and decoded the core module import/memory sections. **MiB = 1,048,576 bytes**. The memory column is the module-declared minimum, **not** a measured application peak or total runtime footprint. Values are rounded; versions pin the evidence. Package unpacked size is deliberately not used as deployed size: many packages contain several alternate engines and duplicate distributions.

| Published artifact examined | Raw Wasm MiB | gzip-9 MiB | Declared minimum MiB | What this establishes |
| --- | ---: | ---: | ---: | --- |
| [`@electric-sql/pglite@0.5.13`](https://registry.npmjs.org/@electric-sql/pglite/0.5.13), `pglite.wasm` | 8.667 | 3.090 | **128** | Imported `env.memory`; default module alone demands the hosted isolate’s entire nominal budget. |
| Same, `initdb.wasm` | 0.286 | 0.123 | 64 | Separate initialization module. `pglite.data` adds **6,248,509 bytes** before JS/extensions. |
| [`@sqlite.org/sqlite-wasm@3.54.1-build1`](https://registry.npmjs.org/@sqlite.org/sqlite-wasm/3.54.1-build1) | 0.838 | 0.388 | 8 | Small engine; persistence adapter remains the important host dependency. |
| [`@duckdb/duckdb-wasm@1.33.1-dev57.0`](https://registry.npmjs.org/@duckdb/duckdb-wasm/1.33.1-dev57.0), EH | 34.250 | 7.681 | 16 | Single-threaded variant fits code limit; does not establish query memory. MVP: 39.411 MiB; COI variant has shared memory. |
| [`pyodide@314.0.7`](https://registry.npmjs.org/pyodide/314.0.7), core | 9.154 | 3.365 | 30 | Excludes Python stdlib archive, wheels and application. Not the size billed to a Python Worker. |
| [`wasm-git@0.0.17`](https://registry.npmjs.org/wasm-git/0.0.17), ordinary `lg2.wasm` | 0.823 | 0.344 | 16.25 | libgit2 is already a compact port. Asyncify: 1.550 MiB raw; OPFS-JSPI: 0.821 MiB. |
| [`@ffmpeg/core@0.12.10`](https://registry.npmjs.org/@ffmpeg/core/0.12.10), ESM core | 30.739 | 9.713 | 32 | The selected single-threaded core fits the current code limit. Input, decoded frames and output are extra. |
| [`tsgo-wasm@7.0.2`](https://registry.npmjs.org/tsgo-wasm/7.0.2) | 46.750 | 10.214 | 25.375 | Existing third-party TypeScript 7 build; imports `gojs`, not WASI. |
| [`@oxc-parser/wasm@0.60.0`](https://registry.npmjs.org/@oxc-parser/wasm/0.60.0), web | 0.703 | 0.245 | 1.125 | Older dedicated web-parser package; **not** the current complete Oxc toolchain. |
| [`@biomejs/wasm-web@2.6.3`](https://registry.npmjs.org/@biomejs/wasm-web/2.6.3) | **59.832** | 15.519 | **73.375** | Already near the 64 MiB bundle ceiling and substantial memory before opening files. |
| [`@swc/wasm-web@1.16.20`](https://registry.npmjs.org/@swc/wasm-web/1.16.20) | 17.196 | 5.067 | 3 | Existing JS/TS transform engine, not a Node build environment. |
| [`esbuild-wasm@0.28.2`](https://registry.npmjs.org/esbuild-wasm/0.28.2) | 13.331 | 3.554 | 5.9375 | The engine works in the local Worker test below. |
| [`web-tree-sitter@0.27.1`](https://registry.npmjs.org/web-tree-sitter/0.27.1), release core | 0.201 | 0.079 | 32 | Core is small; grammar modules are additional; code size is a poor memory proxy. |
| [`@imagemagick/magick-wasm@0.0.45`](https://registry.npmjs.org/@imagemagick/magick-wasm/0.0.45), wasm32 | 14.711 | 5.074 | 16 | Current loader accepts a precompiled module; local resize succeeds. Memory64 variant is 15.071 MiB. |
| [`@resvg/resvg-wasm@2.6.2`](https://registry.npmjs.org/@resvg/resvg-wasm/2.6.2) | 2.364 | 0.904 | 1.4375 | Practical small headless rasterizer; fonts/pixels are extra. |
| [`@myriaddreamin/typst-ts-web-compiler@0.7.0`](https://registry.npmjs.org/@myriaddreamin/typst-ts-web-compiler/0.7.0) | 27.013 | 10.236 | 9.875 | Existing typesetter; fonts, packages and document graph still need budgeting. |
| [`onnxruntime-web@1.31.1`](https://registry.npmjs.org/onnxruntime-web/1.31.1), SIMD-threaded ordinary core | 14.161 | 3.617 | 16, shared | JSPI variant: 17.090 MiB; Asyncify: 27.416 MiB; weights are not included. Shared memory is not proof of parallel host-thread availability. |
| [`@oxc-parser/binding-wasm32-wasi@0.156.0`](https://registry.npmjs.org/@oxc-parser/binding-wasm32-wasi/0.156.0), current N-API/WASI binding | 1.449 | 0.477 | **61.25, shared** | Much larger declared memory than the older dedicated web binding; imports emnapi/N-API/WASI scaffolding. Not executed here. |
| [`@rolldown/browser@1.2.15`](https://registry.npmjs.org/@rolldown/browser/1.2.15) | 10.869 | 3.488 | **62.5625, shared** | Existing browser bundler; exact host/thread adapters still require qualification in workerd. |
| [`@ttsc/wasm@0.34.2`](https://registry.npmjs.org/@ttsc/wasm/0.34.2) | 33.030 | 7.594 | 19.1875 | Alternate existing TypeScript-Go wrapper; no execution or project-peak claim here. |
| [`mupdf@1.28.1`](https://registry.npmjs.org/mupdf/1.28.1) | 9.928 | 4.478 | 22 | Official PDF engine; measured size/minimum only, not Worker loader or ranged I/O. |
| [`@neslinesli93/qpdf-wasm@0.3.0`](https://registry.npmjs.org/@neslinesli93/qpdf-wasm/0.3.0) | 1.272 | 0.421 | 16.4375 | Existing structural PDF toolkit; engine size is not whole-file-operation memory. |
| [`docx-to-pdf-wasm@0.1.0`](https://registry.npmjs.org/docx-to-pdf-wasm/0.1.0), optimized | 2.252 | 1.048 | 1.9375 | Existing basic Office conversion; actual npm binary differs slightly from README size figures. |

**M:** The selected measurements show why “under 3 MB gzipped” and npm’s total unpacked size are insufficient deployment evidence. For example, PGlite’s measured main binary is 3.090 MiB under these gzip settings, whereas its website advertises a sub-3 MB complete build. This is an artifact/version/compression difference to resolve, not evidence that either number describes live memory. [PGlite’s size claim](https://pglite.dev/)

### Local workerd checks that changed the verdict

**M — Environment:** macOS 26.6.1 arm64, supplied **workerd 2026-10-25** binary, compatibility date `2026-10-25`, loopback HTTP, no deployment/account. Modules supplied through `Workerd.Config` with `wasm = embed ...`. Instantiation was lazy inside request handlers. No Docker/VM or paid API used.

| Check | Result | Interpretation |
| --- | --- | --- |
| esbuild `initialize({wasmModule, worker:false})`, TS entry importing a virtual module through an esbuild plugin | **Passed**: emitted an ESM bundle containing the imported function and stripped types. | “A real bundler cannot run in Workers” is false. This is bundling, not typechecking, arbitrary npm scripts, or a complete framework build. |
| Same esbuild fixture, three fresh processes / six requests each | First request **340.1 / 289.2 / 374.1 ms**; 15 warm requests median **20.82 ms**. | Local wall time includes HTTP/runtime glue. The process was already listening; excludes process startup and deploy-time compilation. Tiny fixture; no edge/cold-PoP benchmark claim. |
| resvg, 32×32 red rectangle | **Passed**, valid PNG signature, 102 bytes. First request **19.76 / 30.21 / 16.31 ms**; warm median **0.768 ms**. | No browser process is required for SVG rasterization. No font/text or large-image performance claim. |
| ImageMagick current wasm32, imported module, PPM → 8×8 PNG | **Passed**, 296-byte PNG; one first-request wall observation **135.7 ms**. | The historical Workers loader complaint is not an established current blocker for this path. |
| TypeScript 7.0.2 `tsgo` Wasm, ordinary default libraries, one `const value: string = 123` file | **Passed**: TS2322 and exit 1. One request **2369.7 ms**; final linear memory **115,867,648 bytes = 110.5 MiB**. | Existing compiler can execute here, but has little apparent hosted headroom even on a tiny project. Total isolate memory and a real dependency graph were not measured. |
| Unadapted Go bridge using workerd `node:fs.read` | Failed with `The "position" argument must be of type number. Received null`. | A host-adapter incompatibility, not a missing compiler. A small per-fd-position adapter using numeric `readSync` offsets removed it for this fixture. |
| PGlite main module with a 64 MiB imported memory | **Rejected**: `memory import has 1024 pages which is smaller than the declared initial of 2048`. | Setting only the JS-side memory object cannot lower the binary’s required minimum. Does not test a reduced-memory rebuild. |
| Dynamic `WebAssembly.compile(bytes)` inside request | **Rejected**: `Wasm code generation disallowed by embedder`. | Use imported precompiled modules; a URL/byte-loader’s success in a browser does not transfer automatically. |
| Real asynchronous JSPI import/export | **Passed**, returned 42. | Host promises can bridge synchronous Wasm call paths; this does not serialize a suspended stack. |
| `Worker`, `SharedArrayBuffer`, shared Wasm memory | `Worker` absent; SAB exists; a one-page shared memory constructor succeeds. | Do not equate SAB/shared memory existence with usable pthreads or a Web Worker API. |
| Allocate a 144 MiB Wasm memory locally | **Succeeded**. | **Local workerd did not enforce hosted 128 MB admission here.** A local “it boots” result cannot establish production fit. |

**M — TypeScript fixture qualifications:** copied the package’s existing Go JS bridge, supplied the static module, set `GOGC=20`, `GOMEMLIMIT=64MiB`, captured stdout/exit, and used request-local `/tmp`. The numeric-offset shim is only enough for this file-reading test, not a complete filesystem implementation. Default library loading was retained; this was not a `--noLib` “typecheck.” The final memory value is a linear-memory high-water proxy, not live Go heap. Newer alternate wrappers such as [`@ttsc/wasm@0.34.2`](https://registry.npmjs.org/@ttsc/wasm/0.34.2) exist and were not execution-qualified; this one result does not prove all TypeScript builds must be too large.

**M — Reproducibility anchors:** executed engines and the PGlite admission fixture are version-pinned above; full SHA-256 digests and the loading recipe are recorded in §7. No scratch-file link is required to interpret these results.

## 3. Survey: what already exists, and how good it is for each host

### Databases: useful engines, mostly a persistence/memory problem

**F — PGlite:** already real PostgreSQL compiled to Wasm, with extensions and browser/server APIs. Its default memory filesystem retains the database in RAM; IndexedDB storage also starts by loading database files into memory, while OPFS uses a browser-specific access-handle strategy. A durable DO implementation needs an appropriate VFS and crash protocol, not merely `new PGlite()` in an object. [Filesystem contracts](https://pglite.dev/docs/filesystems)

**F:** Prior art is direct: [`@dotdo/pglite`](https://www.npmjs.com/package/@dotdo/pglite) describes precompiled callback/loading changes and memory tuning for Workers; [`@dotdo/postgres@0.1.3`](https://registry.npmjs.org/@dotdo/postgres/0.1.3) advertises PostgresDO plus DO/R2 tiered storage. Its README reports approximately 1.2 s cold initialization and 13–16 ms warm queries. These are publisher claims, **not verified durability or benchmarks here**. [Publisher documentation](https://www.npmjs.com/package/@dotdo/postgres)

**F:** PGlite’s sandboxed-runtime `process.exitCode` bug [#1082](https://github.com/electric-sql/pglite/issues/1082), filed **2026-08-14**, was **closed** in the live API snapshot; the search index still described it as open. Precompiled-module integration is also actively addressed by [PR #1121](https://github.com/electric-sql/pglite/pull/1121), filed **2026-10-07**, adding an `unwasm` condition. **I:** do not present either stale complaint or “Postgres per DO” as an untouched category. The unproved valuable part is a resource-bounded, crash-tested supported implementation.

**F — SQLite:** official SQLite Wasm, sql.js, and wa-sqlite already cover browser execution. SQLite’s OPFS VFS variants have distinct threading/locking requirements. Workers already provide native SQLite through DO storage and D1, so embedding another SQLite is normally useful only for a particular extension, portable database file operation, or matching browser engine. [SQLite persistence](https://sqlite.org/wasm/doc/trunk/persistence.md), [wa-sqlite](https://github.com/rhashimoto/wa-sqlite), [DO SQLite API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)

**F — DuckDB:** official DuckDB-Wasm is a mature browser analytical engine, but its browser I/O/concurrency scaffolding is not a Worker adapter. Existing **Worker-specific** implementations matter more: [`ducklings`](https://github.com/tobilg/ducklings) uses Asyncify/fetch and has distinct Iceberg/DuckLake builds; [`smithclay/duckdb-worker`](https://github.com/smithclay/duckdb-worker) uses JSPI range reads. The latter reports a **16.4 MB** optimized engine, **20.2 MB** total raw Worker bundle, and roughly **20 MB** engine baseline, with experiments dated **2026-09-28/10-01**. It explicitly depends on an unreleased DuckDB branch and experimental/unmerged toolchain work. **I:** very promising existing implementation, not proof of a general production analytical database under 128 MB.

**F:** DuckDB-Wasm [#1904](https://github.com/duckdb/duckdb-wasm/issues/1904), filed **2024-10-28**, reports retained memory after queries. **I:** freed engine allocations and shrinking the Wasm backing memory are different things; lifecycle/reset is part of an analytical Worker design. For large scans, compare Containers and managed R2 SQL before investing in another port.

### Python: Cloudflare owns the difficult runtime integration already

**F — Pyodide/Python Workers:** Cloudflare runs CPython through Pyodide, injects the runtime, and snapshots top-level initialization at deployment to improve startup. This platform-owned path is materially different from bundling Pyodide into an ordinary JS Worker. C-extension packages require compatible Wasm builds; subprocesses and host OS modules do not become available simply because CPython imports. [Python Worker lifecycle](https://developers.cloudflare.com/workers/languages/python/how-python-workers-work/), [stdlib limitations](https://developers.cloudflare.com/workers/languages/python/stdlib/)

**I:** Port an essential unsupported Python dependency only after finding its users and checking the supported-package catalogue. “Python at the edge” and generic Pyodide cold-start optimization are already platform work. In browsers, Pyodide remains useful for local notebooks/data tools but the wheels, import graph and peak allocations dominate many real jobs.

### Git: the richest remaining library seams, with strong existing implementations

**F — isomorphic-git:** packfiles, clone/fetch/push, trees and commits already work in pure JS. Cloudflare Computer integrates it with a SQLite VFS. Its documentation explicitly omits protocol-v2 partial clone and several maintenance/porcelain operations, and warns that its pack cache is unbounded. **I:** the gap is particular missing semantics and bounded storage access, not “Git cannot run in a DO.” [Computer Git interface](https://github.com/cloudflare/computer/blob/main/docs/13_git_interface.md)

**F — libgit2:** [`wasm-git`](https://github.com/petersalomonsen/wasm-git) already supplies small sync, Asyncify, OPFS/pthreads and OPFS/JSPI variants. Its current README also describes an experimental **WASI 0.2 component**, with filesystem/HTTP imports and a smart-HTTP server example; that component is not in the npm package. libgit2’s merge behavior is not automatically Git’s modern `ort` behavior.

**F — gitoxide:** existing crates, including `gix-pack`, have Wasm CI. The **current explicit CI list** includes pack/object/traversal crates but not the entire repository API or `gix-merge`. The old “WASM support” [#463](https://github.com/GitoxideLabs/gitoxide/issues/463) is closed, with **20 reactions / 15 comments** in the API snapshot. This is demand/history, not evidence that no Gitoxide code compiles. [Current CI matrix](https://github.com/GitoxideLabs/gitoxide/blob/main/.github/workflows/ci.yml)

**F — strongest prior art against a new Git server:** [`littledivy/dgit`](https://github.com/littledivy/dgit) implements smart HTTP, packs/deltas, shallow/incremental fetch, refs, GC and a web UI in TS, one DO per repository, with optional R2 pack storage; it had **206 stars** in the retrieved page. [`imjasonh/playground/git-server`](https://github.com/imjasonh/playground/blob/main/git-server/docs/design.md) separately documents protocol-v2, range/index-guided object access and DO ref CAS. [`ziggit`](https://github.com/hdresearch/ziggit) advertises a small Wasm build, but native feature lists must not be read as Wasm-qualified operation coverage. **I:** all three must be compared, not silently excluded because the pitch asks for a Wasm rewrite.

### Media and images: broad ports exist; avoid buffering and wrapper assumptions

**F — FFmpeg:** `ffmpeg.wasm` is a real browser product; its normal JS controller creates a Web Worker. [Discussion #782](https://github.com/ffmpegwasm/ffmpeg.wasm/discussions/782), started in **2024**, specifically requests main-thread execution for Cloudflare/service-worker use. However, [`libav.js`](https://github.com/Yahweasel/libav.js) already offers configurable FFmpeg libraries/CLIs and a no-worker mode. [`openclaw/ffmpeg-wasm`](https://github.com/openclaw/ffmpeg-wasm), released **2026-09-05**, reports narrow modern FFmpeg/FFprobe builds around 4.5–4.7 MB per tool and streaming APIs, primarily for Node/browser use.

**F:** Upstream FFmpeg-Wasm also has active proposed work for [chunked files #984](https://github.com/ffmpegwasm/ffmpeg.wasm/pull/984) and [JSPI #987](https://github.com/ffmpegwasm/ffmpeg.wasm/pull/987), opened **2026-09-29**. **I:** “small FFmpeg + streaming” is not new. A portable, bounded R2 range-I/O integration could still be useful, especially for probing/remuxing. Full HD/4K transcoding needs separate CPU/frame-buffer accounting; Wasm does not grant Workers hardware video acceleration.

**F/M — ImageMagick:** [`magick-wasm`](https://github.com/dlemstra/magick-wasm) is maintained upstream. [Discussion #195](https://github.com/dlemstra/magick-wasm/discussions/195), **2025-01-30**, records repeated Workers loader failures and **19 replies**; the current package accepts `WebAssembly.Module`, and the basic conversion passed locally. **I:** reject a new broad port based on that historical complaint. Large pixel caches and particular delegates/formats remain qualification work. SVG, image codecs and document delegates are different capability sets.

### Compilers and source tools: distinguish transform, bundle, typecheck, and build

**F/M — esbuild:** already has `wasmModule` and `worker:false`; the local plugin-based bundle test passes. Cloudflare’s [`@cloudflare/worker-bundler`](https://github.com/cloudflare/agents/tree/main/packages/worker-bundler) already resolves real npm dependencies and creates Worker/app bundles; its README calls it experimental and specifically workerd-only. **I:** a general “real build tool in a Worker” pitch is killed. The remaining gap would have to be a **named unsupported build graph**, plugin or asset pipeline, not a repeat of the same bundler demo.

**F — Oxc/SWC/Biome/Rolldown:** Oxc maintainers documented Wasm parser/transform/minify availability by **2025-03-23**, while a **2026-03-11** request asks about resolver/lint/format builds. Current `oxc-parser@0.156.0` has a Wasm binding, so the old dedicated parser package in the census is not the best current-size claim. [Oxc discussion #3311](https://github.com/oxc-project/oxc/discussions/3311), [current parser binding](https://registry.npmjs.org/@oxc-parser/binding-wasm32-wasi/0.156.0)

**F:** Biome publishes Wasm variants; SWC has [`@swc/wasm-web`](https://registry.npmjs.org/@swc/wasm-web/1.16.20). [`@rolldown/browser@1.2.15`](https://registry.npmjs.org/@rolldown/browser/1.2.15) is also published, and recent upstream releases include real-browser package smoke tests. [Rolldown releases](https://github.com/rolldown/rolldown/releases) **I:** native N-API/WASI packages can still drag in thread/host assumptions. Test the exact entrypoint; do not propose a fresh parser/minifier rewrite.

**F/M — TypeScript native / TS 7:** the Wasm port exists. Microsoft explicitly answered that browser support is intended; maintainers also explained why their expected distribution remains an all-in-one compiler. Existing wrappers include [`sxzz/tsgo-wasm`](https://github.com/sxzz/tsgo-wasm), [`@ttsc/wasm`](https://ttsc.dev/docs/wasm/), and the established JS compiler/VFS. [Upstream browser discussion #458](https://github.com/microsoft/typescript-go/discussions/458), [API discussion #455](https://github.com/microsoft/typescript-go/discussions/455) The local 110.5 MiB one-file result is a reason to measure whole projects, not to promise the native port’s advertised speedups in Wasm.

**F — Tree-sitter:** current Web Tree-sitter documents `Language.loadSync(precompiledModule)` explicitly for Cloudflare/Vercel Edge. This removes a historically important dynamic-grammar-loading objection. [Current binding README](https://github.com/tree-sitter/tree-sitter/blob/master/lib/binding_web/README.md) **I:** memory-bounded parse/query operations over a particular storage API can be useful; compiling Tree-sitter again is not an opportunity.

**F — ripgrep:** [`pithings/ripgrep-node`](https://github.com/pithings/ripgrep-node) already ships upstream rg as `wasm32-wasip1` with a Node-fs WASI shim; its npm package stores encoded compressed Wasm and dynamically decodes/compiles it. [Package description](https://www.npmjs.com/package/ripgrep) WASIX and other preview1 distributions also exist. **I:** the CLI’s filesystem walk/mmap/thread/process assumptions do not map directly to R2/DO storage. Porting its search crates behind explicit streaming inputs is sensible; claiming a missing rg Wasm compiler target is not.

### Documents and rendering: distinguish faithful conversion from extraction

**F — LibreOffice:** upstream has both GUI and **headless** Emscripten build instructions. That is important prior art against “LibreOffice has never been compiled to Wasm.” [Upstream build guide](https://github.com/LibreOffice/core/blob/master/static/README.wasm.md) Browser integrations report artifacts around **147–154 MB Wasm plus 95–100 MB data**, threads and substantially more than 128 MB runtime memory. These are particular distributions, not a lower bound for every possible headless build. [PDFCraft deployment](https://github.com/PDFCraftTool/pdfcraft/blob/master/DEPLOYMENT.md), [LibreOffice Web integration](https://github.com/mapo80/libreoffice-web/blob/main/README.md)

**F:** [`deepseek-ai/dsh-libreoffice-kit`](https://github.com/deepseek-ai/dsh-libreoffice-kit/blob/master/engine/wasm-source/README.md) also documents a headless Writer/Calc/Impress **Node-worker** Wasm recipe. **I:** “headless LibreOffice Wasm” is taken; “fits unmodified ordinary Workers at useful fidelity” is not established. Cutting code/data and removing mandatory thread assumptions would be a serious porting project, not a two-week wrapper.

**F:** Basic DOCX conversion is also taken: [`docx-to-pdf-wasm`](https://github.com/fforres/cloudflare-worker-docx-to-pdf-wasm/blob/main/packages/docx-to-pdf-wasm/README.md) publishes an explicit Worker recipe and reports a **2.23 MiB optimized engine**. It documents missing footnote/endnote rendering, inconsistent track-change handling, and deep-table limitations. Its “recall versus LibreOffice” results concern recovered text, not page/layout equivalence. **I:** a faithful full-office converter is a genuine hard problem; a new basic DOCX-to-PDF endpoint would duplicate prior art.

**F — PDF:** MuPDF’s official JS/Wasm API supports rendering/extraction/manipulation, with AGPL or commercial licensing. QPDF Wasm ports and [`pdfstudio`](https://github.com/fayazara/pdfstudio) already cover structural operations. [MuPDF upstream](https://github.com/ArtifexSoftware/mupdf/blob/master/platform/wasm/README.md), [QPDF port](https://github.com/neslinesli93/qpdf-wasm) [MuPDF #142](https://github.com/ArtifexSoftware/mupdf.js/issues/142), filed **2025-03-01**, specifically asks how to make it work in Workers. This is not proof of absence today: [PDF Slim](https://pdfslim.app/api.html) claims MuPDF execution inside Workers, and [Kreuzberg](https://docs.kreuzberg.dev/getting-started/installation/) explicitly supplies a Worker-oriented Wasm extraction package.

**I:** the more plausible remaining PDF gap is **seekable asynchronous R2-backed input and bounded per-page execution**, not a new PDF parser or “PDFs at the edge.” It must demonstrate something whole-buffer packages cannot do. Extraction, layout recovery, rasterization, redaction and Office conversion are separate operations.

**F/M — resvg and Typst:** resvg passed the local headless test. [`typst.ts`](https://github.com/Myriad-Dreamin/typst.ts) already compiles in browsers; [`cf-rendercv`](https://github.com/jchoi2x/cf-rendercv) describes a DO/Workers PDF pipeline using optimized Typst packages. A particular integration request, [typst.ts #716](https://github.com/Myriad-Dreamin/typst.ts/issues/716), concerns a rehype wrapper importing the native Node compiler. **I:** this is an adapter seam, not evidence that the typesetting engine cannot run. Standard HTML/CSS/JS screenshot/PDF rendering is also already served by [Cloudflare Browser Run](https://developers.cloudflare.com/browser-run/get-started/); resvg/Typst do not replace a browser’s layout and scripting semantics.

### Inference: small CPU models can fit; a browser LLM is not a Worker LLM

**F:** Transformers.js and ONNX Runtime Web already provide browser inference; WebLLM uses **WebGPU** and supplies browser worker/service-worker adapters. Current packages exist: [`@huggingface/transformers@4.3.2`](https://registry.npmjs.org/@huggingface/transformers/4.3.2), [`@mlc-ai/web-llm@0.2.86`](https://registry.npmjs.org/@mlc-ai/web-llm/0.2.86). [WebLLM implementation](https://github.com/mlc-ai/web-llm), [ORT deployment guide](https://onnxruntime.ai/docs/tutorials/web/deploy.html)

**F:** [ORT discussion #27400](https://github.com/microsoft/onnxruntime/discussions/27400), **2026-02-20**, provides a working Worker-specific static-module injection pipeline and reports **~424 ms** session creation, **~36 ms** first inference and **~0.7 ms** average inference for a **2.3 MB Silero VAD model**. It used ORT 1.24.1; those results do not qualify the current 1.31.1 package. **I:** small VAD/classification/embedding models are plausible Worker workloads; the exact loaders, weight copies, operator set and allocation peaks decide.

**E/I:** one billion parameters at idealized four-bit packing already means **500 MB of weights**, before quantization metadata, runtime or KV state. Ordinary Worker isolates cannot host that resident model. Browser GPU inference can, depending on the device. Fetching weights from R2 does not make their resident/tensor footprint disappear. Compare Workers AI and Vercel native execution before porting another broad inference runtime.

## 4. WASI, components, GC and stack switching: current status, not 2024 assumptions

| Capability | Sourced status at the research date | Consequence for this project |
| --- | --- | --- |
| WASI 0.2 | **F:** stable component-oriented interfaces, with pollable/resource-based I/O. | Useful source/ABI target; does not imply built-in workerd host support. |
| WASI 0.3 | **F:** 0.3.0 shipped **2026-06-11**, adding native component async/future/stream machinery; **0.3.2 released 2026-10-13**. | Do not describe 0.3 as merely planned. Toolchain and host support still need checking separately. |
| Native component model in workerd | **F:** Workers docs still describe incomplete experimental WASI; no native `WebAssembly.Component` entrypoint was present locally. **I:** no supported general native 0.2/0.3 component host was established by this survey. | Compile/transpile to imported core modules plus explicit JS host adapters. The missing constructor alone is not a complete compatibility test. |
| `jco` | **F:** transpiles components to JS/core-Wasm modules; instantiation mode accepts a callback that supplies precompiled core modules. Preview2/preview3 shims have different host coverage. | A Worker adapter need not reimplement the component compiler. Node filesystem shims and arbitrary runtime byte compilation must be replaced. |
| Wasm GC | **F:** standardized/implemented in mainstream browser engines; feature table lists Chrome 119, Firefox 120, Safari 18.2. | Does not retrofit Go/CPython/C++ ports to use host GC, shrink existing linear memory, or supply persistent heaps. |
| JSPI | **F:** phase 5 in the proposal catalogue. **M:** asynchronous import/export passed in supplied workerd. | Good mechanism for native synchronous file access awaiting `fetch`/R2. Suspended execution remains engine-local; no standard serialization follows. |
| General stack switching | **F:** phase 3, separate from JSPI. | Do not require universal support for the v1 library. No portable stack-image format is implied. |

Sources: [WASI 0.3 overview](https://github.com/bytecodealliance/wasi.dev/blob/main/docs/releases/wasi-p3.md), [actual releases](https://github.com/WebAssembly/WASI/releases), [jco](https://github.com/bytecodealliance/jco), [jco instantiation contract](https://github.com/bytecodealliance/jco/blob/main/docs/src/transpiling.md), [proposal stages](https://github.com/WebAssembly/proposals), [engine feature table](https://webassembly.org/features/), [stack-switching explainer](https://github.com/WebAssembly/stack-switching/blob/main/proposals/stack-switching/Explainer.md).

**I:** A Worker-native WASI-component adapter is a useful enabling contribution, but a weak standalone pick: the benefit depends on a specific guest and there is no large demand count here. A generic POSIX-emulation platform also collides with existing projects such as [Nimbus](https://github.com/AshishKumar4/Nimbus), whose alpha advertises a DO filesystem, shell, npm, Python/Ruby and clang-to-WASI. Its README’s broad behavior claims were not execution-tested here. This report does not recommend building another OS/syscall-growth project or using GrowOS/jitk.

## 5. Generate broadly: fourteen candidates, then eliminate aggressively

Each entry includes sentence, 30-second demo, closest gap/pain, model durability, platform position, short v1, expert objection and kill test. The first three receive the deeper treatment in §6.

### 1. Worktree-free Git merge kernel — retain conditionally

**I — Sentence/demo:** two real Git commits go into a browser or DO, and a native-Git-compatible merged tree plus typed conflicts comes back, without checking out the repository. Show a rename/modify and a criss-cross history, with stock Git as the visible comparison.

**F/I — Gap/pain:** Cloudflare OS’s [Git storage plan](https://github.com/cloudflare/cloudflare-os/blob/main/plans/git-storage.md) explicitly works around isomorphic-git’s recursive-merge and add/add behavior. Wasm-git/libgit2 and gitoxide are the closest alternatives. A Worker-qualified object-store-backed merge API with the chosen compatibility contract was not found.

**I/E — Durability/platform/v1:** stronger models still need standard Git results; platforms can adopt a standalone library. Two to three weeks buys one bounded merge API, not full Git. **Expert kill:** “libgit2 or gix already does this adequately.” **Kill test:** compare those adapters first; stop if they handle the adopter’s actual cases without substantial new code or if the result needs a generic POSIX runtime.

### 2. Partial-clone Git client over DO/R2 — retain conditionally

**I — Sentence/demo:** open a large remote repository in a DO, fetch one selected blob, edit/commit/push it, and display the actual transferred bytes and cache high-water.

**F/I — Gap/pain:** [isomorphic-git #1123](https://github.com/isomorphic-git/isomorphic-git/issues/1123), **2020-05-06**, remained open with **8 reactions / 4 comments**; [gitoxide discussion #2791](https://github.com/GitoxideLabs/gitoxide/discussions/2791), **2026-07-22**, tracks partial/promisor work. Existing servers are not a client implementation. However [gource-view](https://github.com/schlunsen/gource-view) already combines a minimal protocol-v2 filtered fetch with isomorphic-git indexing.

**I/E — Durability/platform/v1:** generated agents still benefit from fetching fewer bytes; an upstream-compatible client is adoptable. Two to three weeks: one HTTPS remote/protocol profile, `blob:none`, lazy blob reads, ordinary commits/push, fixed resource bounds. **Expert kill:** “upstream gource-view’s few missing functions.” **Kill test:** port that path first; stop if a thin maintained extension suffices or if indexing buffers the whole pack.

### 3. Seekable PDF operations directly on R2 — retain as research backup

**I — Sentence/demo:** extract text boxes and one thumbnail from a page in a PDF larger than the isolate’s memory ceiling while showing range requests and peak memory.

**F/I — Gap/pain:** MuPDF #142 asks for Workers execution, but generic extraction/transforms already exist. The proposed gap is a maintained **async seekable source** and bounded page lifecycle. MuPDF has a native seekable-stream abstraction. [Native stream API](https://github.com/ArtifexSoftware/mupdf/blob/master/include/mupdf/fitz/stream.h)

**I/E — Durability/platform/v1:** better models still need exact source text/pages; Cloudflare can adopt the adapter and native engine maintainers can own it. Two to three weeks: PDF-only, text/thumbnail, R2/HTTP range source, explicit limits. **Expert kill:** “PDF.js, MuPDF’s existing progressive loader, or Kreuzberg already does this.” **Kill test:** try their real range-loading paths first; stop if the only difference is a deployment example or if xref/image high-water still exceeds budget.

### 4. Bounded FFprobe/remux engine over R2 — inspect, then demote

**I — Sentence/demo:** probe a large video or copy a short audio segment without staging the whole file. **F/I — Closest/pain:** FFmpeg-Wasm discussion #782 requests Workers support; libav.js, the OpenClaw narrow build, and upstream chunked-I/O/JSPI PRs directly overlap. **I — Survives/models/platform:** media still needs deterministic codecs; platform/upstream adoption is plausible. **E — V1:** two-week range-read integration for one container and probe/remux only. **Expert kill:** “libav.js’s device I/O already provides this.” **Kill test:** prove a useful bounded-memory operation its existing no-worker path cannot provide. **Verdict:** adapter contribution, not a fresh broad port; less whitespace than candidates 1–3.

### 5. Postgres-compatible database per DO — reject broad pitch

**I — Sentence/demo:** restart an object and query committed PostgreSQL data. **F/I — Closest/pain:** PGlite, dotdo PostgresDO and tiered VFS cover the idea; default upstream module’s 128 MiB minimum is a real obstacle, not evidence competitors are absent. **I — Models/platform:** compatible local SQL remains valuable; Cloudflare might adopt a properly tested port but already offers SQLite/Hyperdrive alternatives. **E — V1:** two to three weeks could qualify a reduced-memory build and one transactional storage adapter. **Expert kill:** “the fork already supplies it.” **Kill test:** audit fork source and crash recovery before coding. If real commits survive forced restarts within budget, contribute upstream instead of rebuilding.

### 6. A real JavaScript build system inside Workers — reject broad pitch

**I — Sentence/demo:** npm imports → bundled app → Dynamic Worker preview. **F/M — Closest/pain:** worker-bundler already does it, and esbuild passed locally; [agents #1306](https://github.com/cloudflare/agents/issues/1306) is a **closed** Node-loader issue, not proof Workers bundling is broken. **I — Models/platform:** builds persist as a need, but Cloudflare already owns the main distribution. **E — V1:** a named missing framework/plugin in two weeks. **Expert kill:** “call createApp.” **Kill test:** reproduce an actual unsupported application against current worker-bundler and browser Rolldown. Without it, stop.

### 7. TypeScript 7 typechecking service in each DO — reject as default choice

**I — Sentence/demo:** real diagnostics for generated code without a container. **F/M — Closest/pain:** tsgo-wasm and ttsc already exist; upstream browser/API discussions have substantial participation; the local default-lib fixture reached 110.5 MiB. **I — Models/platform:** typechecking survives model improvements, but good models can reduce demand for a particular latency optimization; Microsoft owns compiler support. **E — V1:** qualify a reduced/alternate build plus `.d.ts` source service for a bounded Code Mode profile. **Expert kill:** “the JS compiler/VFS is smaller and faster here.” **Kill test:** compare exact diagnostics, total peak and latency against it on real projects; no native-speed claim without this result.

### 8. Oxc/Biome/SWC Workers toolbox — reject new rewrite

**I — Sentence/demo:** lint, transform and format source in one endpoint. **F/M — Closest/pain:** Wasm packages ship; Oxc’s resolver/linter/formatter request is narrower than missing parsing. Biome’s measured code/minimum are large. **I — Models/platform:** standardized lint/format remains useful; upstream would adopt specific target/loader fixes. **E — V1:** a small upstream-compatible lint/format build or resolver adapter. **Expert kill:** “this is the existing playground package.” **Kill test:** identify an indispensable missing operation and show it cannot be supplied by the published packages with a static-module adapter.

### 9. Tree-sitter native structural search in a DO — reject generic port

**I — Sentence/demo:** structural query across a workspace, including syntax-error recovery. **F/I — Closest/pain:** Web Tree-sitter already supports precompiled grammar modules; agent workspace search is plausible but a concrete unmet Workers request was not established here. **I — Models/platform:** parse structure remains useful; platforms can adopt a storage adapter. **E — V1:** chunked file source + bounded parser/tree cache. **Expert kill:** “instantiate web-tree-sitter.” **Kill test:** demonstrate a real query/corpus that the existing binding cannot support within the chosen bounds. Otherwise ship an example, not another engine.

### 10. ripgrep for DO/R2 repositories — reject generic port

**I — Sentence/demo:** ordinary rg output over a repository without syncing it into a container. **F/I — Closest/pain:** preview1/WASIX ports and JS shell grep implementations already exist; Worker-native large-repository demand is an inference here, not a measured support queue. **I — Models/platform:** cheap deterministic search remains useful; upstream or Computer could adopt it. **E — V1:** search crates + explicit file enumerator/stream source, no process spawning. **Expert kill:** “JS regex plus existing storage enumeration is sufficient.” **Kill test:** compare full scan bytes/CPU/result parity with that baseline; a faster regex does not fix scanning every R2 object.

### 11. Full-fidelity Office-to-PDF inside a Worker — reject two-week commitment

**I — Sentence/demo:** difficult Word footnotes, tables and tracked changes retain layout in PDF without a browser/container. **F/I — Closest/pain:** LibreOffice headless Wasm and basic DOCX converters exist, but the latter explicitly omit important document behavior. That is concrete pain, not a promise a smaller renderer can match Office. **I — Models/platform:** documents and their layout semantics persist; upstream would welcome reusable headless improvements. **E — V1:** two weeks only establishes whether a Writer-only build can meet size/memory/thread constraints. **Expert kill:** “your first useful artifact takes months, or just use Vercel native LibreOffice.” **Kill test:** boot/export a representative corpus within the real Worker envelope before promising a library. No full-suite rewrite.

### 12. Portable small-model inference in ordinary Workers — reject generic runtime

**I — Sentence/demo:** VAD or a small embedding/classification model executes beside a request. **F/I — Closest/pain:** ORT’s Worker pipeline already exists; WebLLM/Transformers.js already serve browsers. Current package loaders can still require host patching. **I — Models/platform:** local decisions and avoiding network/model calls remain valuable; model/runtime vendors and Workers AI already cover the platform. **E — V1:** one model-specific reduced-operator build with total-memory measurements. **Expert kill:** “use Workers AI, native Functions, or the existing ORT workaround.” **Kill test:** show useful latency/cost/data-locality wins against all applicable alternatives at equal output quality; no resident LLM claim under 128 MB.

### 13. SQLite extensions/portable SQLite files in DOs — reject generic database

**I — Sentence/demo:** upload a SQLite file and query an extension missing from built-in SQLite. **F/I — Closest/pain:** official Wasm/wa-sqlite and native DO SQLite already cover most of the stack; no indispensable missing extension was verified. **I — Models/platform:** SQL remains useful, but Cloudflare directly owns the native product. **E — V1:** port exactly one demanded extension and a file/VFS adapter. **Expert kill:** “this is already FTS/JSON in native SQLite.” **Kill test:** get a real failing query from an adopter before compiling anything.

### 14. Headless Typst/resvg document/image service — reject broad pitch

**I — Sentence/demo:** generate a polished report/preview from typed data, then render the same source in a tab. **F/M — Closest/pain:** typst.ts, cf-rendercv, resvg and Browser Run already cover the major execution paths; rehype’s native import is an adapter bug. **I — Models/platform:** deterministic rendering survives better models; upstream/platform adoption is straightforward. **E — V1:** fix the particular wrapper in a few days or build a domain template in two weeks. **Expert kill:** “this is a template, not a missing runtime.” **Kill test:** require a concrete unsupported input/host behavior beyond existing modules.

## 6. Three remaining bets, examined as buildable contributions

### A. The pick: Git merge operations without a checkout

**I — Product/API:** `mergeCommits({ours, theirs, objectStore, limits}) → {tree, newObjects, conflicts}`. A TS wrapper accepts immutable Git objects, emits standard Git objects, and supplies structured conflict entries. A DO serializes publication of refs; immutable pack/object bytes live in R2 or the existing workspace store. The merge engine itself does not decide ref updates.

**F — Why this is real work:** Cloudflare’s Git-storage plan reimplements a small tree merge because the existing library cannot perform all needed cases. Separately, GitHub’s **2023** account describes support tickets from disagreement between libgit2-based merges and local Git, then switching to `merge-ort`; its rebase experiment ran **730,000 times**, reporting 2.56 hours of libgit2 work versus under ten minutes for the new path. These numbers demonstrate a real historical beneficiary and semantic problem, **not a predicted Wasm speedup**. [GitHub engineering account](https://github.blog/engineering/infrastructure/scaling-merge-ort-across-github/)

**F — Closest prior art that can kill it:** modern [`git merge-tree`](https://git-scm.com/docs/git-merge-tree) already performs content/rename/directory-conflict handling and recursive merge-base consolidation without an index/worktree. Gitoxide’s maintainer reported production tree merging at `ort`-level quality in **2024-11**, so a Rust library may be a better starting point than extracting Git C. [Gitoxide progress report](https://github.com/GitoxideLabs/gitoxide/discussions/1695) Wasm-git supplies another existing engine. None should be discounted because it is not a newly written TS implementation.

**I — Precise remaining hypothesis:** these semantics are not yet packaged behind a practical Worker/browser object-provider API, with stated memory bounds and a relevant compatibility corpus. A native filesystem library that can compile to Wasm is not automatically that package. Conversely, if adapting existing gix/wasm-git is small, that adaptation **is the project**; do not rewrite its internals to manufacture novelty.

**I — Beneficiaries:** maintainers embedding Git into Cloudflare Computer-like workspaces, Git-backed web apps, and small DO forges. The primitive is useful even with a perfect agent because deterministic version integration still has standard object/rename/history semantics. This differs from the earlier killed structural/semantic-merge and post-merge-integration ideas: no new merge algorithm or orchestration product is proposed.

**I — Why platforms might adopt:** Cloudflare has already chosen isomorphic-git and documented its workarounds; a small engine with a compatible storage boundary can be upstreamed or imported. Vercel can execute it too, though native Git is a stronger baseline there. The value is a shared maintained artifact and host adapters, not ownership of a new platform feature.

**E — Two-to-three-week v1:**

1. **Days 1–2:** select a named caller and frozen required fixtures; try gix-merge and Wasm-git adapters; compile the needed Git merge path only if the required semantics still fail. Measure one nontrivial rename/recursive-base case in workerd. **Stop here if this cannot produce a usable artifact without building an OS.**
2. **Days 3–7:** one engine, a JS in-memory object-provider adapter and a workerd adapter, standard tree/blob output, structured conflicts, bounded input/output/cache accounting. Start with pre-existing bare objects, so clone/SSH/pack negotiation is not on the critical path.
3. **Days 8–12:** compare a pinned native Git oracle on at least **100** purposeful fixtures: rename/modify, rename/delete, directory/file collisions, add/add, binary/mode changes, Unicode paths and multiple merge bases. Explicitly reject unsupported external drivers/filters rather than silently substituting text merge.
4. **Days 13–15:** one integration into an existing DO Git store, browser demo, cancellation/failure cleanup and documented supported-profile limits. Ref publication uses compare-and-swap outside the engine; racing agents get a retry/conflict rather than a lost update.

**E — Acceptance:** all supported fixtures match the chosen contract; package’s total Worker bundle ≤32 MiB; total hosted peak target ≤96 MiB on the agreed corpus; bounded failure on over-limit inputs. Publish local estimates separately until actual hosted memory is qualified by an adopter. Do not require “any repository fits” or a universal millisecond SLA.

**I — Expert reply that kills it:** “You are replacing an adequate libgit2/gix merge with an expensive promise of stock-Git parity; arbitrary attributes, drivers, large blobs and rename detection blow the budget.” Correct response: preserve a narrow explicit profile and retain an engine only when a real caller needs cases the alternatives miss. A model resolving content does not remove the need for correct tree/history semantics, but it can reduce the feature’s practical importance.

**E — Kill test:** by day 2, no essential adopter fixture beyond an existing adapter → submit that adapter/documentation and stop. By day 5, no useful in-budget merge → stop the port. Any silent tree loss on a held-out fixture → block release. If exact `ort` parity requires too much C substrate, do not relabel a differing gix result as “the same as Git.”

### B. Backup: a resource-bounded partial-clone client

**I — Product/API:** `openRemote → filtered commit/tree fetch → lazy object read → local commit → push`, using DO/R2-backed immutable storage and bounded metadata/delta caches. Its “large repository” claim is about **avoiding irrelevant object transfer**, not fitting an entire clone in RAM.

**F/I — Why a gap remains plausible:** the long-running partial-clone issue is concrete but modest demand; eight reactions are not a huge market. Computer’s documented omission supplies a relevant current host. The gource-view filtered-fetch implementation means the wire negotiation is not the invention. The difficult useful part is managing promisor objects, indexing, lazy blob reads, limits and normal push semantics as a supported library.

**I — Beneficiary/models/platform:** browser coding tools and DO agents editing a small part of a large repository. Better agents can make more targeted edits, increasing the value of targeted retrieval. Cloudflare/forge maintainers can adopt an upstream client module; do not build another origin service.

**E — Two-to-three-week v1:** a single tested HTTPS smart-HTTP profile; `blob:none`; commits/trees and selected blobs only; existing SHA-1 packs; clear shallow/promisor distinction; static code; bounded delta depth/object size; existing remote fixtures plus stock Git interoperability. Keep HTTP auth at the host boundary. Reuse a published object/index engine rather than write every pack algorithm anew.

**E — Demo/acceptance:** open a repository with ≥1 GiB reachable blobs while reading/editing one small file; transfer <10 MiB of actual Git data for the selected fixture, stay below a ≤96 MiB hosted target, push one valid commit and read it with stock Git. These are deliberately chosen fixture thresholds, not expected results. Measure cold metadata traversal separately; a very large tree/commit graph may still exceed limits.

**I — Expert reply:** “filtered fetch plus isomorphic-git already works; dgit or a GitHub content API is enough.” **E — Kill test:** implement the best thin extension to gource-view/isomorphic-git first, including real indexing. If it meets the corpus, contribute there. If preserving packfiles still requires whole-pack copies or unbounded parsed caches, the claimed Worker unlock fails. Native Git in an on-demand container is the end-to-end baseline, including all storage operations.

### C. Research backup: random-access PDF processing over R2

**I — Product/API:** an immutable `readAt(offset,length)` source feeding a selected PDF engine, with page-at-a-time text/thumbnail output and explicit memory/pixel limits. A JSPI or existing progressive-stream bridge allows the synchronous native reader to await an R2 range read. Pin the object version/ETag for the operation; use a small bounded block cache.

**F/I — Closest/gap:** MuPDF already exposes seekable streams natively; PDF.js already has range/progressive loading; existing Worker extraction and MuPDF products prevent a broad novelty claim. MuPDF #142 is evidence of integration friction, not proof of a current unsolved engine port. No source in this search establishes a maintained general R2-backed adapter with the proposed bounds; absence is a hypothesis to verify with maintainers.

**I — Beneficiary/models/platform:** apps with large documents already in R2 that need exact per-page evidence/preview rather than a full download into a separate container. Better models still need source coordinates and rendering. A reusable stream adapter belongs upstream; Cloudflare need not build a full document suite. MuPDF’s AGPL/commercial terms materially affect adoption; an open-source project can choose a compatible distribution.

**E — Two-to-three-week v1:** try PDF.js’s range path and MuPDF’s existing progressive machinery first; expose only PDF page text and low-resolution thumbnail, no Office, OCR or full save/redaction. Build a bounded cache, serialization/lifecycle policy and native-reference comparisons on a fixed corpus. A byte-range HTTP test server can exercise it locally without an account; an adopter must later qualify hosted limits.

**E — Acceptance/demo:** selected PDFs >256 MiB produce a selected page’s output with <64 MiB total guest/JS target and substantially less than whole-file input transfer. Include unlinearized PDFs and a large cross-reference table. Reject pathological files/page dimensions cleanly. Report range count/latency/bytes; random seeks can make this worse than a nearby container.

**I — Expert reply:** “the engine needs a large xref/image/font graph anyway; range support already exists; this is only a storage example.” **E — Kill test:** by day 2 show an operation the current Worker/browser packages cannot do without exceeding memory or downloading the entire file. If the existing range loader works, contribute an R2 example. If no bounded source bridge works without a major engine rewrite, stop. A full 256 MiB PDF cannot be assumed to need only a small working set.

## 7. Evidence hygiene and reproducibility

**F/M — Search coverage:** primary project docs/repos/releases, npm registry metadata and tarballs, GitHub issues/discussions/PRs, and direct HN searches. The GitHub search API initially returned live issue counts/states, then unauthenticated requests hit rate limits; no missing reaction count was invented. Search-index issue status can lag live state, as PGlite #1082 demonstrated. The negative searches included `git-merge-tree wasm`, `merge-ort WebAssembly`, `gix-merge wasm`, `mupdf R2 range`, `jco workerd`, `tsgo-wasm Cloudflare`, and broader npm/GitHub searches for each engine; finding no matching maintained package is not proof none exists. For counts above, “reactions” is the issue’s aggregate, not unique users or upvotes alone.

**F — HN calibration:** the **2024-11-08** [ZetaJS Show HN](https://news.ycombinator.com/item?id=42087201) had only **5 points / 4 comments**, despite the impressive LibreOffice-in-a-browser technology. The [TypeScript 7 discussion](https://news.ycombinator.com/item?id=48833715) contains a maintainer describing multiple different meanings of “Wasm support” (CLI, API, LSP). **I:** recognizable engines can attract interest, but a port alone does not establish a shareable demo or user demand. No X engagement figures were verified.

**M — Minimal census reproduction:** create `/tmp/deep-wasm`, retrieve `https://registry.npmjs.org/<package>/<version>`, download its `dist.tarball`, stream/extract the selected member, calculate `len(bytes)`, `len(gzip.compress(bytes, compresslevel=9, mtime=0))`, and `hashlib.sha256(bytes).hexdigest()`. Decode the module memory/import limits using unsigned LEB128; one page is 65,536 bytes. For table precision, use raw byte counts rather than recompressed package archives. Do not execute package install hooks.

**M — Full SHA-256 for executed main engines and the inspected PGlite fixture:**

```text
@electric-sql/pglite 0.5.13 dist/pglite.wasm
90d7b3859ee8e9e9e222c63f1d4c2907606b27a29453c508ee9bae7b48a544c2
tsgo-wasm 7.0.2 tsgo.wasm
24ea14c522de5e08cec9f625fa0bc0d98773206b5be1bb2384d981ca2392021e
esbuild-wasm 0.28.2 esbuild.wasm
b1831a5c0f6cf688034fb94d0419812f165ea316a3380d3fc00a151e562d2eaf
@resvg/resvg-wasm 2.6.2 index_bg.wasm
22bf6e9f9a100d972da0411a69c5ba504367fc1fa87b3b64e3f35e53926d2d70
@imagemagick/magick-wasm 0.0.45 dist/x86/magick.wasm
54629cbcf06dd10db38b4d87fa6ab241b248c09c94f2d9689506e5f994ac5f0c
```

**M — Local loading recipe:** a `Workerd.Config` module worker declares each JS file with `esModule = embed "path.js"`, each Wasm with `wasm = embed "path.wasm"`, compatibility date `2026-10-25`, and a loopback HTTP socket. Import the Wasm by that module name. The decisive esbuild invocation was:

```js
await esbuild.initialize({ wasmModule: importedModule, worker: false });
const result = await esbuild.build({
  stdin: {
    contents: 'import {double} from "virtual:math"; const n:number=21; export default double(n)',
    sourcefile: 'entry.ts', loader: 'ts', resolveDir: '/',
  },
  bundle: true, write: false, format: 'esm',
  plugins: [{ name: 'vfs', setup(build) {
    build.onResolve({ filter: /^virtual:/ }, a => ({ path: a.path, namespace: 'vfs' }));
    build.onLoad({ filter: /.*/, namespace: 'vfs' }, () => ({
      contents: 'export const double=(x:number)=>x*2', loader: 'ts',
    }));
  }}],
});
```

**M — Limits of the evidence:** no actual hosted memory/cold-start measurements, no claimed production DO persistence qualification, no full Git/LibreOffice/compiler rebuild. Code minimums were inspected; only the explicitly listed workloads were executed. The main scratch footprint was about **105 MiB**, under the brief’s 500 MB ceiling; all scratch files/processes were removed after recording the report. Only this report was written in the repository; no commit/push.

## Ranked top three against all six criteria

**I — Scores are judgments, 1–5, not measured probabilities.** “Gap” scores the narrow proposed contract after accounting for prior art. A high total does not override a failed two-week feasibility or adopter test. Criterion 6 is literally independence from GrowOS/jitk; platform defensibility/adoption is assessed separately above.

| Rank / candidate | 1 Cool | 2 CF/Vercel adjacent | 3 Real gap | 4 Concrete value | 5 Survives better models | 6 Not GrowOS | Total /30 | Main remaining veto |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| **1. Worktree-free Git merge kernel** | 4 | 5 | 3 | 4 | 5 | 5 | **26** | An existing gix/libgit2 adapter may suffice; no committed adopter; native-Git parity can exceed scope. |
| **2. Partial-clone DO/R2 client** | 4 | 5 | 3 | 4 | 5 | 5 | **26** | Filtered-fetch prior art; bounded indexing/promisor correctness; overlaps existing client maintainers. |
| **3. Seekable R2 PDF operations** | 4 | 5 | 2 | 4 | 5 | 5 | **25** | Existing progressive/range loaders may eliminate the gap; licensing and worst-case working set. |

### The ONE pick

**I/E — Spend two days on the Git merge kernel, with one actual embedding maintainer and a frozen set of missing merge cases.** Prefer adapting existing gix/wasm-git; port Git’s modern merge-tree path only if those fail the required semantics. If no needed case remains or the dependency substrate expands beyond a small library, kill it. That is a useful OSS contribution with a credible demo; the evidence does not justify a new general edge Git platform.

### Five-line TL;DR

1. **F:** By October 2026, almost every famous engine named in this lens already has a Wasm/TS port, often with Workers prior art.
2. **F/M:** The bundle gate is now 64 MiB raw; memory remains 128 MB. PGlite declares 128 MiB; one tsgo check reached 110.5 MiB.
3. **M:** esbuild plugins, resvg, ImageMagick and existing TypeScript 7 Wasm execute in local workerd; local memory admission is not hosted admission.
4. **I:** The remaining opportunity is a precise operation with bounded object/file access and maintained compatibility, not “compile famous software again.”
5. **I/E:** Pick worktree-free Git merges conditionally; let existing adapters and a two-day adopter/fixture test kill it before investing the remaining weeks.

### Rejected ideas — one line each

- **I — New Git forge/pack server:** dgit and another DO/R2 smart-HTTP implementation already cover it.
- **I — Generic Postgres per DO:** direct PGlite/dotdo prior art; remaining memory/durability work must be proved against those implementations.
- **I — Another SQLite port:** native DO/D1 SQLite and mature browser ports make the generic benefit negligible.
- **I — DuckDB in a Worker as the discovery:** ducklings and a JSPI range-read port already demonstrate it.
- **I — Python at the edge / generic Pyodide startup:** Cloudflare owns and ships this integration and deploy-time initialization snapshots.
- **I — JavaScript bundler in a Worker:** esbuild works locally and worker-bundler already resolves npm and builds apps.
- **I — Automatic TypeScript-native speedup at the edge:** the Wasm build exists; memory and actual Wasm performance still need workload qualification.
- **I — New parser/formatter/Tree-sitter rewrite:** published engines and precompiled-module support already cover the core execution.
- **I — Generic rg Wasm:** preview1/WASIX ports exist; data enumeration and storage access are the actual constraints.
- **I — ImageMagick “cannot run in Workers”:** the selected current module initialization/resize path passed locally.
- **I — General FFmpeg port or small-codec build:** FFmpeg-Wasm, libav.js, OpenClaw’s narrow build and active upstream PRs overlap.
- **I — Full-fidelity LibreOffice under 128 MB in two weeks:** potentially valuable but no evidence for the required shrink/thread-removal effort fitting that budget.
- **I — Basic DOCX-to-PDF or PDF text extraction:** direct Worker-oriented converters and document toolkits already ship.
- **I — Typst/resvg service as a missing engine:** browser ports and Worker PDF integrations already exist.
- **I — WebLLM inside an ordinary Worker:** GPU host APIs and resident model memory, not the Wasm format, prevent the broad claim.
- **I — New general component/POSIX runtime:** reuse jco and explicit guest adapters; generic runtime/platform work is occupied and fails the small-project focus.
