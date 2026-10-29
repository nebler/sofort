# G05 — Graphics, GPU, rendering, and new languages like Goose

**Research date: 2026-10-29.** Read against [BRIEF-gaps](../BRIEF-gaps.md), [BRIEF-tailwind](../BRIEF-tailwind.md), the
[round-13 summary](../tailwind/SUMMARY.md), the [kill list](../../RESEARCH-SUMMARY.md#11-the-kill-list) and the sibling
[G02](G02-oracles-physical.md). Only this file was written. Nothing was built or benchmarked.

**Labels:** **Q** quoted (checked at the transcript timestamp; caption spelling lightly cleaned) · **F** sourced ·
**I** inference · **E** estimate.

**What I read:** your [Goose spike](../../cloudflare-goose/03-goose-spike.md); the Goose source at the spike's pinned
commit `e76d5c9` (read-only) and the live repositories through the GitHub API; G02 §1–6; T01's Transplant idea;
RESEARCH-SUMMARY §8, §11 and §12; 14 corpus transcripts (key in §9). I also fetched captions for three graphics talks that are
not in the corpus, with yt-dlp into a scratch directory outside the repo: Khronos' SIGGRAPH 2026 *Real Time Shading* BoF,
Khronos' SIGGRAPH 2026 *Slang in Action* BoF, and Jonathan Blow on *The Standup*.

---

## 0. The answer to "is there something here with Goose?"

**I — Yes, but not where it looks at a glance.**

1. **F — New languages and graphics stacks got cheap in 2026.**
   - Goose went from a spec on 2026-08-27 to a 65,873-line compiler and runtime, with gfx, physics, audio and UI
     packages, in about two months. Its README credits Claude Fable with the implementation ([spike](../../cloudflare-goose/03-goose-spike.md),
     [README](https://github.com/aardappel/goose)).
   - Randy Gaul replaced glslang, SPIRV-Cross and DXC in Cute Framework with a 9,292-line single-header compiler,
     `cute_spirv`. Its GLSL ES, HLSL and MSL back ends were committed within 85 minutes of each other
     ([commit history](https://github.com/RandyGaul/cute_framework/commits/master/libraries/cute/cute_spirv.h)).
   - GoGPU rebuilt a pure-Go graphics stack between December 2025 and October 2026: WebGPU, a port of naga, a CPU
     rasterizer, 2D, 3D with glTF, and UI ([org](https://github.com/gogpu)).
2. **I — So the obvious idea fails.** "Grow a young language's graphics ecosystem against reference libraries" mostly
   fails the one-shot test, because porting is now cheap. For Goose it isn't even needed: Goose compiles to C and reaches
   SDL3 through a 64-function layer.
3. **I — The part a young language can't borrow through C is its GPU half.** A shader can't call into C. So Goose (GLSL
   strings in `embed_shader`) and Lobster (GLSL bodies in `.materials` files) keep a second language, with struct layouts
   matched by hand. That half has an oracle the agent cannot edit: the language's own CPU build. This is idea 1, **Twin**.
4. **I — Across graphics, the grow-against-a-reference loop is already spreading.** Ports of Blender Geometry Nodes are
   being checked against Blender itself, one of them clean-room. GoGPU's naga port is checked against Rust naga,
   `cute_spirv` grows "on request", and Theo's Claude-built Skate clone was judged on screenshots. What is still open:
   - acceptance that needs **measurement on real devices**: idea 2, **Shader Ladder**;
   - a reference **locked to one vendor's GPUs**: idea 3, **pbrt Anywhere**.
5. **I — The brief's third shape is mostly done.** Shader translation checked by pixels leaves only a contribution-sized
   version: idea 4, **Shader Ratchet**.

---

## 1. What 2026 looks like

### 1.1 Languages and graphics stacks got cheap

| What | Evidence | Label |
|---|---|---|
| Goose | 905 commits since 2026-08-27 and 65,873 physical lines, both per the spike. 2,470 stars on 2026-10-29. [HN front page](https://news.ycombinator.com/item?id=50224100) on 2026-10-24 with 602 points and 367 comments. Wouter van Oortmerssen [on HN](https://news.ycombinator.com/item?id=50224856): "I had it go thru that codebase [Lobster's compiler], distill an elaborate code style guide from it, and used that to make it write the new code pass by pass in that style." | F/Q |
| `cute_spirv` | 2026-07-22: "replace glslang with CF's own GLSL-to-SPIR-V compiler". 2026-07-23: v1.01 (GLSL ES), v1.02 (HLSL SM 5.1) and v1.03 (MSL), committed 04:08–05:32 UTC. 2026-08-05: "Fix 19 confirmed findings from a multi-agent branch review". 2026-10-05: "Optional WebGPU backend", with a WGSL emitter. The header says: "The subset is documented precisely in CF's docs and grows on request." ([commits](https://github.com/RandyGaul/cute_framework/commits/master/libraries/cute/cute_spirv.h)) | F/Q |
| GoGPU | 19 repositories since 2025-12-05. They include a pure-Go WebGPU with Vulkan, Metal, DX12, GLES and software back ends; the software back end is a CPU rasterizer of about 14K lines. There is also a pure-Go naga that turns WGSL into SPIR-V, MSL, GLSL, HLSL and DXIL; its outputs are compared with Rust naga's 172-shader snapshot corpus. The rest is 2D, 3D with PBR and glTF, UI and audio ([naga](https://github.com/gogpu/naga), [wgpu](https://github.com/gogpu/wgpu), [g3d](https://github.com/gogpu/g3d)). | F |
| Bun | Ben Davis: "the whole bun migrating from Zig to Rust over the course of a couple weeks using just obscene amounts of … Mythos tokens … The languages are much more fungible" (`32` [07:00]–[08:00]). Gergely Orosz (LDX3 talk): "it probably would have taken years" (`21` [06:00]). | Q |
| Agent-written languages | [agentlanguages.dev](https://agentlanguages.dev/) catalogues languages designed for agents to write. Some list PTX, SPIR-V, Metal or WGSL targets. These are self-published claims. | F |

**I — What this means:** writing code in a new language is no longer the bottleneck, and porting one library is a
prompt-sized job. The bottleneck has moved to two places:
- what a language cannot borrow through C;
- evidence that new code is right on hardware the author doesn't own.

### 1.2 Goose's graphics, today

All **F**, from [goose_gfx docs/gfx.md](https://github.com/aardappel/goose_gfx/blob/main/docs/gfx.md) and Goose's
`docs/stdlib.md`, `docs/goose_spec.md` and `docs/design/packages.md` at `e76d5c9`, unless marked otherwise.

- **The stack.** `gfx` sits on SDL3's GPU API (Direct3D 12, Vulkan or Metal) through a 64-function C layer, "not SDL's
  1,270". It supports headless rendering. Shaders are GLSL 450, compiled at Goose compile time by `cute_spirv` into SPIR-V,
  MSL and HLSL.
- **The shader dialect.** It is `cute_spirv`'s: "no doubles, no geometry or tessellation stages, uniform blocks without
  instance names, and each storage buffer block one runtime array". The header adds that out/inout parameters and
  multi-dimensional arrays are unsupported, and that recursion is rejected. From reading the header, I found no 64-bit
  integer type (**I**).
- **The vendored compiler predates WGSL.** Goose vendors `cute_spirv` at a 2026-09-15 commit, before Cute Framework's
  WGSL emitter.
- **Host and shader layouts are only loosely checked.** "Uniform structs are checked against the shader's block size,
  not member offsets."
- **Testing.** "They draw only on pixel boundaries, so their output is exact on every backend." "On Windows the
  showcase's screenshots from Direct3D 12 and Vulkan differ by 0.65 of 255 per channel on average."
- **Metal is untested.** "Nothing on macOS has run: the MSL that cute_spirv emits, SDL's Metal backend under this layer,
  … are all unverified until CI or a Mac runs them."
- **Wouter's own follow-up list.** "A 2D and 3D immediate-mode layer in Goose on top of this one, as Lobster has, and
  shader hot reload."
- **Packages design.** "Build steps: a package that runs a tool while the program compiles (a shader compiler of its own)
  … Planned for, not built."
- **Safety semantics that a GPU port must keep.**
  - Signed overflow "aborts in debug builds; wraps two's-complement (defined) in release."
  - Index checks abort.
  - `checkfree fn` asks the compiler "to reject the program if a bounds check is left" (spec §7.14).
- **No web target yet.** There is no Wasm back end (spike). An outside contributor opened
  [#134](https://github.com/aardappel/goose/issues/134) on 2026-10-28 to make the C runtime build for wasm32. Wouter on
  [HN](https://news.ycombinator.com/item?id=50228755) (**Q**): "it doesn't just need wasm64 … but it also needs the wasm64
  memory to not commit until touched".
- **What Goose is for.** Wouter on [HN](https://news.ycombinator.com/item?id=50224978) (**Q**): "Most of my current Goose
  projects are games, not surprisingly". The samples include `21_raytrace`, `27_gfx_cube`, `28_physics_boxes`,
  `30_mini_minecraft` and `31_mini_doom`. John Carmack, quoted [on HN](https://news.ycombinator.com/item?id=50224336)
  (**Q**): "'Parsing' file and network data is often 100x slower than it needs to be."

### 1.3 What practitioners ask for (the seeds)

| # | Who, where | Quote (Q) | Feeds |
|---|---|---|---|
| S1 | Chris Lattner, `p3-38` [1:04:00] | "Swift can't program the GPU or the neural engine or … many of the other pieces of silicon on the chip. And so there isn't a coherent programming model for even a modern iPhone" | Twin |
| S2 | Lattner, `p3-38` [0:18:00]–[0:19:00] | "in Mojo, you have true heterogeneous compilation. And so one program can have different chunks of it that are compiled for multiple devices." | Twin |
| S3 | Randi Rost (Khronos), [Real Time Shading BoF](https://www.youtube.com/watch?v=eU6orN1gA90) [1:12:00] | "we want a real language, not a toy shading language. We want a language that got everything in it, pointers and … everything that a real language has." Also: "get Apple to cooperate, please." | Twin, pbrt |
| S4 | same talk, [1:08:00]–[1:11:00] | 400+ survey responses. Shader debugging and profiling pain averaged 52/100, and "debugging complexity came out number one". A "cross vendor shader debugging standard" was rated very or extremely valuable by 77%. | Twin's fault parity |
| S5 | Matt Keeter, [blog](https://www.mattkeeter.com/blog/2026-08-23-wgpu-facet/) ([HN](https://news.ycombinator.com/item?id=49883913), 2026-09-28) | "In WGSL, each row of a `mat3x3` has 4 bytes of padding", while Rust's `[[f32; 3]; 3]` packs into 36 bytes. Result: "congrats, your GPU now has persistently spinning threads which can only be killed by rebooting your computer" | Twin |
| S6 | Shannon Woods (NVIDIA, Slang), [Slang BoF](https://www.youtube.com/watch?v=WIYpleedRw4) [0:10:00] | "with the rise of agentic coding workflows, a single consistent syntax becomes more valuable and less ambiguous than borrowed familiarity from another language" | Context: languages now get designed around agents |
| S7 | Slang BoF demo, [0:26:00] | For a multi-pass Gaussian-splat renderer, "the glue code is still in C++ or Python, and you need to port it to each and every system … slang is really not properly solve the portability problem until we can get this part right" | Twin: host and device in one language |
| S8 | Theo, `01` [08:00], [15:00], [21:00] | "Recreating things is quite trivial to hill climb." Theo's setup compared screenshots "to real skate footage … and then have a panel of judges compare". And: "You need some way to programmatically verify with code that says pass or fail" | Ladder: a real oracle instead of judges |
| S9 | Richard Feldman, `p3-38` [0:52:00]–[0:53:00] | "what if we did the same stuff only faster … as opposed to hey what if we did better stuff … take full advantage of the hardware. Don't just take advantage of 10% of it." | Ladder |
| S10 | Matt Pharr, [pbrt-v4 README](https://github.com/mmp/pbrt-v4#readme) and [issue #419](https://github.com/mmp/pbrt-v4/issues/419) | "only available via CUDA and OptiX on NVIDIA GPUs today, though we'd be happy to see pbrt running on any other GPUs that provide those capabilities." Also: "ideally all that could be done on Macs as well." | pbrt Anywhere |
| S11 | Lattner, `p3-38` [1:08:00] | "too few people care about it because they're not really practically able to get onto that … a lot of use cases just aren't getting explored" | pbrt Anywhere, Twin |
| S12 | Jonathan Blow, [The Standup](https://www.youtube.com/watch?v=vHfdUqLmPNU) [0:46:00] | "this game was supposed to be the proof of concept game with like a simple engine just to prove out the programming language" | Context: language → engine → game used to take a decade |
| S13 | Lattner, `24` [1:28:00] | "the most important thing for LLM based coding … is have a massive amount of open source … 700,000 lines of Mojo code" | Context: a young language needs verified code |

### 1.4 The grow-against-a-reference loop is already spreading in graphics

| Project | What grows | Oracle | Status |
|---|---|---|---|
| [geonodes-kit](https://github.com/vibegameengine/geonodes-kit) (Pavel Belugin, 2026-09-28) | Blender Geometry Nodes in JavaScript, 360 node types. Analysts read Blender's source and write specs; implementers never see the source. | Blender 5.2.2 headless: every attribute within tolerance, plus real BlenderKit assets | One day of commits, 0 stars (F) |
| tinynodes ([80.lv](https://80.lv/articles/blender-developer-works-on-geometry-nodes-web-port), 2026-05-18) | Geometry Nodes on the web, translated "like a compiler" | Blender | Announced, unreleased (F) |
| GoGPU naga | A Go port of naga | Rust naga's 172-shader snapshot corpus, plus spirv-val | Active (F) |
| `cute_spirv` | A GLSL subset with five back ends | Its own 700+ checks | Active, "grows on request" (F) |
| Theo's Skate clone (`01` [06:00]) | A game and engine built by Claude | Screenshots against real footage, scored by "a panel of judges" (`01` [15:00]) | Demo (Q) |
| [ShaderMatch](https://conf.researchr.org/details/icse-2025/llm4code-2025-papers/13/Evaluating-Language-Models-for-Computer-Graphics-Code-Completion) (ICSE 2025 workshop) | A benchmark: models complete Shadertoy functions | Rendered frames compared | Research (F) |

**I — Lesson:** growing something against a reference is not the insight any more; in graphics it became a common pattern
within months. The scarce part is an oracle that needs something a prompt can't supply: a different GPU, a measurement,
or a semantics the agent isn't allowed to edit.

---

## 2. Idea 1 — Twin: the GPU half of Goose, grown against its CPU half

**Name and one sentence.** **Twin**: mark a supported Goose function `gpu` and run it on Metal, Vulkan, Direct3D 12 or
WebGPU under an explicit CPU/GPU agreement contract. When a construct can't be lowered yet, an agent grows the lowering.
The pinned CPU build supplies differential evidence; it does not prove correctness on untested inputs. Exact integer
results, floating-point tolerances and deliberately instrumented errors need separate acceptance rules.

**The seed.**
- **Q:** S1–S5 and S7 above.
- **F:** Goose's own documents (§1.2). Shaders are a second language, layouts are checked by size only, Metal is
  unverified, and a shader-compiler build step is "planned for, not built".
- **Q:** Wouter's remark that most Goose projects are games says where the demand is.

### What grows, and its oracle (I)

**What grows.** A lowering pass from Goose's typed, monomorphized program to `cute_spirv`'s GLSL dialect, and through
`cute_spirv` to SPIR-V, MSL and HLSL (and WGSL once the vendored copy is updated). It also grows generated host bindings
whose layouts come from the Goose types, so the S5 bug class becomes a compile error. Start with `checkfree` functions
over flat values, which have no bounds checks left to carry. Then grow:
- **64-bit integers.** Neither `cute_spirv` nor WGSL has an int64 type, so they are emulated bit-exactly.
- **Goose's aborts on a device that has none.** Overflow aborts (debug builds) and index-check aborts become a fault
  record on the GPU: kind, source line and invocation. The host then raises the same Goose error the CPU build would
  raise. This is a small, real answer to S4's debugging pain.
- **Slices as buffer views, and SoA layouts.**
- **Function blocks and generics.** Both are specialized at compile time, which suits GPUs.
- **Vertex and fragment stages** whose inputs and outputs are Goose structs.

**Trigger.** A program marks a function `gpu`, and the compiler answers "not lowerable: \<construct\>". That is Twin's
ENOSYS. A queue of these diagnostics from real programs drives the agent.

**Oracle.** The same function, compiled by Goose's normal C path and run on the same inputs.
- **What must match.** Integers, booleans and memory images must match bit for bit. Floats must stay within each back
  end's documented precision per operation. Inputs that fault on the CPU must fault on the GPU with the same kind and line.
- **Inputs.** They come from generators derived from the Goose types, plus corpus inputs. They are frozen outside the
  agent's writable tree.
- **Devices:**
  - Metal on your M4 Pro;
  - Vulkan through lavapipe (Mesa's CPU Vulkan, from a distro package) on the existing Linux VM;
  - Direct3D 12 through WARP when a Windows machine is available;
  - WebGPU through Dawn or wgpu.

**Ratchet.**
- A construct-by-back-end coverage table that only grows.
- Every previously accepted function must pass again on every back end after each change.
- Per-program speedup floors, so a correct but 10× slower lowering can't slip in.

**Runs without a model.** It is a compiler pass.

### Tailwind, and why the next model doesn't eat it (I)

Each model release lowers harder constructs per hour: relative references, SoA, blocks with captures, better int64
emulation. It also keeps pace with a language that changes weekly. A prompt cannot produce three things:
- a guarantee that host and shader still agree after the next refactor (a model writing GLSL per program is a
  probability; Twin is a check);
- attestation on GPUs the model doesn't run;
- Goose's fault semantics carried onto devices that otherwise clamp silently or hang.

The honest risk is not the next model; it is Wouter's next prompt (see the kill test).

**One-shot test (I).** Told "add GPU functions to Goose", Fable 6 would produce a subset lowering in a day. It would not
produce bit-exact int64, fault parity and equivalence across four GPU APIs. Those need the device matrix and the frozen
oracle, which are the parts you build.

**Value, in one line a stranger understands.** Write a game's hot loop once in Goose and run it on the CPU or any GPU, with
the same results and the same error messages. That is what Mojo's split compilation (S2) does for AI kernels, applied to a
game language (S1, S3).

### The 6-week version and its demo (E)

| Week | Work |
|---|---|
| W1 | Run goose_gfx's suite and showcase on the M4 Pro; this is an open item on Wouter's own list. Build the CPU-vs-GPU harness on headless compute. |
| W2 | Lowering v0: `checkfree` functions over i32/u32/f32, fixed arrays, flat structs and slices. Layouts are generated from the Goose types. |
| W3 | i64/u64 emulation, checked against the CPU on about 10^8 random inputs; release-mode wrap semantics. |
| W4 | Fault parity for index checks and debug-mode overflow. |
| W5 | The agent loop on a corpus: `20_life`, `21_raytrace`, `22_image_filters`, `23_mandelbrot_threads`, the chunk mesher in `30_mini_minecraft`, the column caster in `31_mini_doom`, and functions from Goose's test suite. The agent may edit only the lowering. |
| W6 | Vulkan via lavapipe; WGSL by bumping `cute_spirv` to the Cute Framework commit that has it; the demo. |

**Demo.**
1. Add one word to `samples/21_raytrace.goose`. The image is byte-identical to the CPU build on Metal and Vulkan, and N×
   faster.
2. Put an off-by-one into the GPU function. You get the same Goose error message and line number as on the CPU.
3. A new program uses a construct Twin lacks. The agent grows it live, and the oracle rejects the agent's opening attempt,
   which has S5's 12-byte layout gap, before accepting the next.

### Prior art, and what's left

**F — The closest projects:**
- Mojo's split compilation (Modular, "just over 140 people", `24` [1:16:00]);
- [Rust GPU](https://rust-gpu.github.io/blog/2025/07/25/rust-on-every-gpu/), running Rust on every GPU (2025);
- [wgsl-rs](https://github.com/schell/wgsl-rs): a Rust subset that runs on the CPU and transpiles to WGSL, with round-trip
  tests that check the two agree;
- NVIDIA's
  [cuda-oxide](https://nvidia.github.io/cuda-rust/cuda-oxide/compiler/fuzzing-and-differential-testing.html): runs
  randomly generated programs on a CPU back end and a GPU back end, then compares trace hashes;
- Zig's SPIR-V back end, used to write vertex and fragment shaders in Zig in a June 2026
  [devlog thread](https://ziggit.dev/t/spir-v-backend-progress-devlog/16351);
- Slang's heterogeneous prototype (S7).

**F — Paper, plainly:** [*No More Shading Languages: Compiling C++ to Vulkan SPIR-V*](https://graphics.cg.uni-saarland.de/publications/devillers-2025-hpg-vcc.html)
(Vcc, HPG 2025). The authors made ordinary C++, with pointers, function calls and recursion, compile into Vulkan
shaders. They argue shading languages should be libraries on top of a general language. It shows the
one-language-for-CPU-and-GPU goal works for C++. It is a Vulkan-only research compiler.

**I — What's left:**
- Checking the GPU against the CPU is an established method (cuda-oxide, wgsl-rs).
- None of these projects targets Goose.
- I found none that grows the back end with an agent against the language's frozen CPU build. I also found none that
  carries a language's bounds and overflow aborts onto GPUs with fault parity. Both are bounded negatives (§9).
- Goose's design points the same way. Only flat values cross thread queues (spec), and flat values are exactly what a
  GPU buffer can hold. The packages design already plans tool-running build steps.

### The kill

**I — Strongest objection:**
- Wouter, working with Fable, could build this in days, and may simply prefer GLSL strings.
- Or the next model writes correct GLSL and bindings per program reliably enough that a compiler adds nothing.

**E — Cheapest test (3 days):**
1. With a hand-guided agent, lower three hot functions through `embed_shader`: the life step, the Mandelbrot inner loop
   and the ray tracer's per-pixel function. Run the oracle on Metal and lavapipe over 10^7 inputs.
2. Baseline: the strongest model writes the same three shaders plus their Goose bindings, one prompt each. Run the same
   oracle.
3. Post the design on Goose's issue tracker or Discord.

**Kill if:**
- the one-prompt versions pass as reliably and run as fast;
- int64 and fault semantics make the GPU slower than the CPU on these programs;
- or Wouter is already building it. In that case, contribute the harness and the Mac verification instead.

**Scores:** Tail 4 · Cool 4 · Value 3 · Open 3 · Solo 4 · Demo 4.

---

## 3. Idea 2 — Shader Ladder: automatic quality/speed ladders, grown as reusable rules

**Name and one sentence.** **Shader Ladder**: for any shader, grow a ladder of cheaper versions and, more importantly,
*reusable simplification rules*. Each rule is kept only if it beats the current ladder on error versus milliseconds,
against the original shader's own render, measured on real devices and on shaders it wasn't fitted to.

**The seed.**
- **F — Paper, plainly:** Sitthi-amorn, Modly, Weimer and Lawrence,
  [*Genetic programming for shader simplification*](https://web.eecs.umich.edu/~weimerw//p/sitthiamorn_siga11.pdf)
  (SIGGRAPH Asia 2011).
  - **What they did:** a genetic algorithm randomly deleted and replaced pieces of a shader. Each variant was rendered, and
    the result was a menu running from exact-and-slow to rough-and-fast.
  - **Why it matters:** it showed a shader's level of detail can be searched for instead of hand-made.
  - **Why it stayed a paper (I):** random edits produce unreadable, scene-specific shaders.
- **F — The line continued without language models:**
  - [Olano et al. 2003](https://diglib.eg.org/items/af9bf5b4-3c70-458a-af68-bc55788461a5);
  - [Pellacini 2005](https://www.researchgate.net/publication/220184125_User-configurable_Automatic_Shader_Simplification);
  - [NVIDIA's rapid automatic shader LOD](https://research.nvidia.com/publication/2015-11_system-rapid-automatic-shader-level-detail)
    (2015), which brought the search down to seconds or minutes;
  - [ShaderTransformer](https://dl.acm.org/doi/fullHtml/10.1145/3528233.3530722) (2022), a learned quality predictor
    that made the search about 350× faster.
- **Q:** Theo (S8) says recreation "is quite trivial to hill climb", but Theo's graphics oracle was a panel of judges, and
  Theo asks for "some way to programmatically verify with code".
- **Q:** Feldman (S9): "Don't just take advantage of 10% of it."

### What grows, and its oracle (I)

**What grows:**
1. **Per-shader ladders:** variants, each tagged with measured error and milliseconds per device class.
2. **A rule library.** Rules are guarded transformations on shader code, for example:
   - "drop noise octaves whose on-screen frequency is above the pixel's Nyquist limit";
   - "move view-independent terms to the vertex stage";
   - "replace this analytic integral with a small lookup table".

   A deterministic compiler pass applies the rules, and a runtime picks the rung.

**Trigger.** A shader in the corpus misses its frame budget on a target device class.

**Oracle.**
- **The reference is the original shader's own output** on frozen camera paths, lights and inputs. No path tracer is
  needed.
- **Error.** NVIDIA's [FLIP](https://github.com/NVlabs/flip), a perceptual image-difference metric with a C++
  implementation (F), plus a frame-to-frame flicker measure.
- **Time.** GPU timestamp queries on real devices: your M4 Pro and one cheap Android phone running Chrome's WebGPU (E).
- **Isolation.** The agent submits code only. It never sees the reference images or the timing harness.

**Ratchet.**
- A rule is accepted only if it moves the error-vs-milliseconds Pareto front on **held-out** shaders.
- Accepted rules and ladders are re-measured whenever the harness changes.

**Runs without a model.** Rules are code; ladders are shaders.

### Tailwind, and why the next model doesn't eat it (I)

Genetic search could not propose *meaningful* simplifications. Language models can, and each release proposes better and
more general rules. A prompt cannot produce a measured library validated on held-out shaders: that needs devices, renders
and a generalization gate. A future model makes the library grow faster; it does not replace it.

### Why this is not a re-pitch (I)

- **Not "GPU kernel agents"** (kill list). Those make exact-output ML kernels faster. Ladder accepts approximate output
  judged by perception, in graphics shaders.
- **Not G02's Sampler Foundry.** That grows unbiased sampling recipes checked against pbrt. Ladder grows biased,
  budgeted approximations checked against the shader itself.

### The 6-week version and its demo (E)

| Week | Work |
|---|---|
| W1 | Harness: Rust with wgpu or Dawn, FLIP in C++, timestamp queries, two devices. |
| W2 | A corpus of about 100 permissively licensed shaders (three.js example materials, which are [MIT](https://github.com/mrdoob/three.js/blob/dev/LICENSE); Bevy and Godot materials; CC0 procedural shaders), split 70/30. |
| W3 | Two baselines: a re-implemented genetic search, and "strongest model, one prompt: simplify this". |
| W4–5 | The agent proposes rules; the gate accepts or rejects them. |
| W6 | Demo. |

**Demo.** A three.js scene with a quality slider from 100% down to 25%. Each notch shows the FLIP error and milliseconds on
the Mac and on a cheap phone. Alongside: a readable 30-line rule, learned on 20 shaders, that makes 14 held-out shaders
about 1.8× faster at FLIP below 0.05.

### Prior art, and what's left

- **F:** the 2003–2022 research line above.
- **F — Paper, plainly:** NVIDIA's [*Real-Time Neural Appearance Models*](https://research.nvidia.com/labs/rtr/neural_appearance_models/)
  (SIGGRAPH 2024). It replaces complex layered materials with small neural networks that run inside a real-time path
  tracer, using the GPU's tensor operations. It shows that "cheaper than the original, close enough to it" is a live
  goal at NVIDIA. It is a different artifact from Ladder: neural rather than readable code, and not aimed at WebGPU or
  phones.
- **I (bounded):** my searches on 2026-10-29 found no shader simplification done with language models (§9).
- **I — It passes the research's own flip rule** (RESEARCH-SUMMARY §12.4):
  - the idea died of manual cleanup per shader;
  - the check (render, FLIP, timer) is cheap and public;
  - the result runs without a model.

### The kill

**I — Strongest objection:**
- Engines already ship hand-tuned quality presets.
- On desktop GPUs the savings are small.
- Perceptual metrics get gamed.

**E — Cheapest test (3 days):** take 30 shaders and run three approaches (model-written rules, the genetic baseline, and
one-prompt simplification), measured on the phone.

**Kill if:**
- the rules don't beat the one-prompt baseline by at least 1.5× in time at equal FLIP on held-out shaders;
- the rules don't transfer;
- or held-out views show artifacts that FLIP misses.

**Scores:** Tail 5 · Cool 4 · Value 3 · Open 3 · Solo 4 · Demo 4.

---

## 4. Idea 3 — pbrt Anywhere: the textbook reference renderer on every GPU

**Name and one sentence.** **pbrt Anywhere**: port pbrt-v4's GPU renderer, which today runs only on CUDA and OptiX, to
Slang, and through Slang to Metal, Vulkan, Direct3D 12 and WebGPU. The port proceeds one subsystem at a time, and each
step is accepted only when its images are statistically indistinguishable from pbrt's own CPU renderer.

**The seed.**
- **Q:** S10.
  - Pharr's README invites ports to other GPUs.
  - Pharr in issue #419, asked about Apple GPUs: "For NVIDIA GPUs, almost all of pbrt's rendering code … runs on the GPU;
    it's almost entirely the same code as runs on the CPU … So ideally all that could be done on Macs as well." Also:
    "I don't know anything about Metal so can't say."
- **Q:** S3, "get Apple to cooperate, please".
- **Q:** S11.
- **Q:** the Slang demo at [0:29:00]: "you write this once, you can just take it and run it on metal, D3D, Vulcan, WebGPU,
  etc."
- **I — What pbrt is:** the renderer from the textbook *Physically Based Rendering*. Researchers use it as the reference
  to check their own images against. The repository's `gpu/` directory holds CUDA- and OptiX-specific code (F).

### What grows, and its oracle

**What grows (I).** Slang modules that mirror pbrt-v4's GPU code:
- cameras, samplers, lights, textures and media;
- BxDFs, including layered and coated ones;
- the wavefront integrator;
- hardware ray tracing on Metal, Vulkan and D3D12, and a software BVH for WebGPU.

**Trigger (I).** A scene in pbrt-v4-scenes uses a feature that hasn't been ported yet.

**Oracle (F/I).** pbrt-v4's CPU renderer at a pinned commit, checked at two levels.
- **Unit level.** pbrt's own unit tests, re-run against the GPU implementations. For example, `bsdfs_test.cpp` runs
  chi-square tests with 1,000,000 samples at significance 0.01 (F).
- **Image level.** Statistical equivalence, using per-pixel tests across independent seeds with false-discovery control.
  This is how Mitsuba tests images instead of demanding identical noisy pixels (F, G02 §1).

**Ratchet.** Scenes passed on each back end, plus speed floors.

### Tailwind (I)

Hard subsystems (subsurface scattering, layered BxDFs, volume media) get ported faster with each release, and the
statistical oracle doesn't care who wrote the code. But the target is finite: once pbrt-v4 is covered, growth becomes
maintenance. Hence Tail 3.

### One-shot test (I)

The GPU path is the same large C++ code base compiled with CUDA (F, Pharr). Slang is not C++. No prompt yields a port that
is statistically indistinguishable on four APIs.

### The 6-week version and its demo (E)

| Week | Work |
|---|---|
| W1 | The oracle: reference renders, variance estimates, and pbrt's tests ported. |
| W2–4 | The minimal path in Slang on Metal: perspective camera, triangle meshes, diffuse/conductor/dielectric materials, area/point/infinite lights, the independent sampler, the path integrator. |
| W5 | 10 scenes, plus the agent loop on failures. |
| W6 | WebGPU build and demo. |

**Demo.** pbrt-v4 test scenes rendering in a browser tab and on the M4's GPU. Each carries a "statistically
indistinguishable from pbrt CPU" badge and its speedup over the CPU renderer on the same Mac. One scene initially fails
on a grazing-angle dielectric; the oracle finds it, and the agent fixes it.

### Prior art, and what's left

- **I (bounded):** I found no Metal, Vulkan or WebGPU port of pbrt-v4 (§9).
- **F:** Blender Cycles runs on Metal but is a different renderer
  ([Cycles GPU docs](https://docs.blender.org/manual/en/latest/render/cycles/gpu_rendering.html)). Mitsuba 3's GPU
  variants are CUDA ([variants](https://mitsuba.readthedocs.io/en/stable/src/key_topics/variants.html)).
- **I:** this rhymes with the killed "Wasm ports of famous engines": port a famous engine to a new platform. Two things
  differ: the statistical oracle, and the fact that no port exists.
- **F/I:** porting CUDA code was also round 7's conditional bet ("CUDA → AMD operator port", RESEARCH-SUMMARY §8).
- **I:** this would also let G02's Sampler Foundry run its experiments on Macs.

### The kill

**I — Strongest objection:**
- Researchers can rent NVIDIA GPUs cheaply, and students can wait for CPU renders.
- Slang isn't C++, so the "port" may really be a rewrite.

**E — Cheapest test (2 days):** port three BxDFs to Slang and pass pbrt's chi-square tests on Metal and Vulkan. Ask the
pbrt maintainers whether they would link the port.

**Kill if:** more than half of the touched code must be restructured rather than translated, or nobody wants it.

**Scores:** Tail 3 · Cool 4 · Value 3 · Open 4 · Solo 3 · Demo 5.

---

## 5. Idea 4 — Shader Ratchet: conformance-grown tiny shader compilers

**Name and one sentence.** **Shader Ratchet**: grow a small, dependency-free shader compiler of the `cute_spirv` kind
toward full GLSL. Each new construct is accepted only when its output, on every back end, executes like glslang's output on
Khronos' own test data.

**The seed.**
- **Q:** the `cute_spirv` header says the subset "grows on request".
- **Q:** goose_gfx says "Nothing on macOS has run: the MSL that cute_spirv emits …".
- **Q:** in the Khronos survey, "better documentation reference implementations standardization of tool chain" each drew
  over 60% (S4 talk, [1:11:00]).

### What grows, and its oracle

**What grows.** The accepted subset (out/inout parameters, multi-dimensional arrays, int64 and so on), each back end's
translation, and a regression corpus.

**Oracle (F/I).**
- **Khronos' test data.** [VK-GL-CTS](https://github.com/KhronosGroup/VK-GL-CTS/tree/main/external/vulkancts/data/vulkan/glsl/es310)
  ships GLSL tests as data. `conversions.test` alone holds 530 cases, each with input and expected output values.
- **Front end.** glslang's accept/reject verdict.
- **Execution.** glslang's SPIR-V run on lavapipe is the reference. Against it: `cute_spirv`'s SPIR-V on lavapipe, its MSL
  on Metal, its HLSL on WARP, and its WGSL on Dawn.

### Tailwind (I)

More of GLSL gets covered with each release. But `cute_spirv` itself shows such compilers now get written in days, so
much of this becomes a prompt. The durable part is the oracle harness, which belongs to the kill list's "LLM proposer +
verifier" family.

### The 6-week version and its demo (E)

Run the harness on both Goose's vendored copy and Cute Framework's current `cute_spirv`, send fixes upstream, and publish a
conformance table per back end.

**Demo.** `cute_spirv`'s MSL output goes from "unverified" to a measured pass rate on Khronos' cases, with the bugs found
and fixed upstream.

### Prior art, and what's left

**F — Existing projects:**
- `cute_spirv` (700+ self-written checks);
- naga, Tint, Slang, and glslang with SPIRV-Cross;
- GoGPU's naga;
- [CrossTL](https://arxiv.org/pdf/2508.21256) (2025): one shared IR that translates between CUDA, HIP, Metal, HLSL, GLSL,
  SPIR-V and others. It shows a universal shader translator is already being attempted head-on.

**F — Testing tools:**
- [WGSLsmith](https://github.com/wgslsmith/wgslsmith);
- [GraphicsFuzz](https://github.com/google/graphicsfuzz);
- [DarthShader](https://arxiv.org/pdf/2409.01824) (2024). It fuzzes the shader translators inside browsers (naga, Tint,
  and WebKit's) by generating many programs and looking for crashes and mismatches. That makes translator testing an
  active security topic.

**I — What's left:** an execution oracle for small compilers on Metal. That is a contribution, not a 10× project.

### The kill

**E — Cheapest test (1 day):** run 1,000 CTS cases through `cute_spirv` on lavapipe and Metal. If mismatches are rare,
there is little to grow. Either way, treat it as a contribution.

**Scores:** Tail 3 · Cool 2 · Value 3 · Open 2 · Solo 5 · Demo 3.

---

## 6. For Goose specifically: three small contributions (not ideas)

These are the small, measured fixes the spike recommended starting with when working with Wouter, and they double as
Twin's W1 groundwork (**I**).

1. **Run goose_gfx on macOS (days).** It's on Wouter's own follow-up list and you have the Mac. It also exercises the MSL
   that `cute_spirv` emits under Goose's layer, which the docs list as unverified (F, goose_gfx docs).
2. **Build a web path (weeks).** Two pieces: the wasm32 representation contract (the spike's blockers plus
   [#134](https://github.com/aardappel/goose/issues/134)), and a WebGPU layer for gfx using Cute Framework's new WGSL
   emitter. SDL's developers have said they won't write a WebGPU back end from scratch
   ([forum](https://discourse.libsdl.org/t/can-sdl3-gpu-functions-shader-be-compiled-to-wasm/59691)), and Cute
   Framework wrote its own in October 2026 (F).
3. **Build Lobster parity (weeks).** Wouter's listed "2D and 3D immediate-mode layer … as Lobster has", grown with Lobster
   itself as the pixel oracle: run the same drawing programs in both and compare frames (I).

---

## 7. Considered and dropped

| Direction (the brief's examples in **bold**) | Evidence | Decision |
|---|---|---|
| **A young language's graphics ecosystem grown against existing references** | GoGPU did this for Go in about 10 months (§1.1). Goose reaches SDL3 through 64 C functions. Bun's Zig→Rust port took weeks (Q, `32` [07:00]). | Drop as stated. The GPU half, which can't be borrowed, became Twin. |
| Blender Geometry Nodes runtime checked against Blender | geonodes-kit (clean-room analyst/implementer split, Blender black box) and tinynodes (§1.4) | Taken in shape |
| WebGPU on the CPU, grown against the CTS | GoGPU's software back end (about 14K lines); Dawn with SwiftShader; Mesa's lavapipe for Vulkan | Taken |
| **Renderer grown against a reference**: glTF | Khronos' glTF Sample Viewer is the certification reference ([program](https://www.khronos.org/blog/update-on-the-khronos-3d-viewer-certification-program-and-the-drive-for-rendering-consistency)). The [Render Fidelity site](https://www.khronos.org/blog/khronos-upgrades-gltf-sample-assets-and-render-fidelity-comparison-websites) (2026-03) compares engines. | Commodity |
| GPU UI frameworks grown to CSS parity against Chrome | [Blitz](https://github.com/DioxusLabs/blitz) renders HTML/CSS natively (4.3k stars). GPUI CE adds blur, gradients and squircles by hand (`57` [19:00]). It also rhymes with the rejected "executable web spec". | Drop |
| Gaussian-splat renderers everywhere | three.js main branch (`p3-26` [23:00]); [Brush](https://github.com/ArthurBrussee/brush) (5.2k stars); Slang's heterogeneous splat demo (S7) | Crowded |
| Shader packages grown on import ("Transplant for shaders") | [LYGIA](https://github.com/patriciogonzalezvivo/lygia), a multi-language shader library; [WESL](https://github.com/webgpu-tools/wesl-spec) packages; a package manager on Slang's wish list (Slang BoF [0:10:00]) | One-shot per function; thin |
| Blender material nodes → WGSL | Mechanical translation of node functions | One-shottable |
| Real-time techniques checked against path-traced truth | Overlaps G02's pbrt oracle; NVIDIA's neural approaches | Folded into Ladder, with a cheaper oracle |
| Clone a game, judged by screenshot panels | Theo's Skate (`01` [06:00]–[15:00]) | Killed family (Lockstep, on-demand content) |

---

## 8. Kill list and don't-re-pitch notes (one line each)

- **GPU kernel agents:** still crowded. 2026 adds evolutionary kernel search on Apple Silicon
  ([Metal-Sci](https://arxiv.org/pdf/2605.09708)) to [Astra](https://arxiv.org/pdf/2509.07506),
  [GPU Kernel Scientist](https://www.alphaxiv.org/abs/2506.20807) and
  [speed-of-light-guided kernel agents](https://arxiv.org/html/2603.29010v1) (F).
- **Lockstep and on-demand game content:** Theo says recreation "is quite trivial to hill climb" (`01` [08:00]), which
  supports the kill (Q).
- **A new agent language:** [agentlanguages.dev](https://agentlanguages.dev/) lists many agent-written languages, which
  supports the kill (F).
- **Browser-divergence map:** Khronos' Render Fidelity site is its 3D twin, run by the standards body (F).
- **Cross-GPU numerical atlas:** goose_gfx measured a 0.65/255 difference between D3D12 and Vulkan, so the need exists. It
  stays rejected; Twin uses tolerances, not an atlas (F/I).
- **T01 Transplant:** GoGPU is a live graphics instance of it, in Go (F).
- **G02 Sampler Foundry:** no overlap with Ladder or pbrt Anywhere. pbrt Anywhere would speed Sampler Foundry up on Macs
  (I).

---

## 9. Sources key and search log

**Corpus transcripts** (`../transcripts/`):

| Short name | File |
|---|---|
| `p3-38` | Software Unscripted: GPU Programming and Language Design with Chris Lattner |
| `p3-37` | Software Unscripted: Jonathan Blow on Programming Language Design (context only) |
| `24` | The Pragmatic Engineer: From Swift to Mojo |
| `01` | Theo: How To Give Claude Unlimited Usage |
| `32` | Ben Davis: Programming feels very different |
| `21` | The Pragmatic Engineer: State of the tech industry 2026 |
| `57` | Syntax: I'm Using GPUI For Everything |
| `p3-26` | NDC: Copy & Paste the World with Gaussian Splatting |

**Also checked, with no graphics seeds:** `25`, `26` and `28` (the Modular panels are about AI kernels); `p3-20` (Bun's
rewrite, [36:00]); `p3-33` (Muratori lists Jai, Odin and Zig at [0:22:00]); `08` (an agent driving Blender from
screenshots, [1:38:00]).

**External captions**, fetched 2026-10-29:

| Talk | Uploaded (per G10) |
|---|---|
| [eU6orN1gA90](https://www.youtube.com/watch?v=eU6orN1gA90): Khronos, SIGGRAPH 2026 Real Time Shading BoF | 2026-08-18 |
| [WIYpleedRw4](https://www.youtube.com/watch?v=WIYpleedRw4): Khronos, SIGGRAPH 2026 Slang in Action | 2026-08-02 |
| [vHfdUqLmPNU](https://www.youtube.com/watch?v=vHfdUqLmPNU): The Standup with Jonathan Blow | 2025-12-20 |

**Searches run on 2026-10-29.** The web, GitHub API, HN Algolia and arXiv were all searched. Negative results are
bounded; they are not novelty facts.

| Family | Representative queries | What changed |
|---|---|---|
| CPU WebGPU | `software WebGPU implementation CPU no GPU 2026 wgpu cpu backend` | Found GoGPU's software back end → dropped GrowGPU |
| Shader translation | `LLM agent shader translation GLSL HLSL WGSL pixel comparison 2026`; `ShaderMatch shadereval …` | Found DarthShader, ShaderMatch and CrossTL |
| Goose | `Goose programming language Wouter van Oortmerssen`; HN Algolia `goose aardappel`; GitHub issues | Found the HN thread, Wouter's and Carmack's comments, and #134 |
| `cute_spirv` | Web search (no hits); GitHub commit history | Found the timeline in §1.1 |
| SDL WebGPU | `SDL3 SDL_GPU WebGPU backend merged 2026` | Not merged; SDL developers decline |
| pbrt | `pbrt-v4 port Metal WebGPU Apple Silicon 2026`; `pbrt-v4 Vulkan OR Slang …`; GitHub issues | No port found; found the README sentence and issue #419 |
| Engines by agents | `AI agent wrote game engine renderer from scratch Claude 2026 reference images` (extended) | No reference-checked engine found |
| glTF | `glTF render fidelity comparison reference …` | Found the certification program and the 2026 site refresh |
| Geometry Nodes | `Blender Geometry Nodes standalone runtime …`; `"geometry nodes" evaluator outside Blender …` (extended) | Found geonodes-kit and tinynodes → dropped |
| Shader LOD | `LLM evolutionary search real-time rendering shader approximation …` (extended); `LLM shader simplification Pareto …` (extended); `Sitthi-amorn …`; `"shader" "level of detail" … large language model …`; `LLM agent optimize fragment shader … FLIP …` | Found only the classical work from 2003–2022 and compute-kernel agents |
| GPU halves of languages | `Zig SPIR-V backend shaders 2026 status`; `language compiler GPU backend written by AI agent 2026 …` (extended); `Vcc Vulkan Clang Compiler Shady …`; `Rust GPU 2026 …`; `rust-gpu difftest …` | Found Vcc, cuda-oxide, wgsl-rs, Numbat and agentlanguages.dev |
| Shading languages | Khronos Shading Languages Symposium 2026 page | Slang, WESL, Vcc and a test-framework talk; no talk on AI |

---

## 10. Ranked table and TL;DR

| Rank | Idea | Grows | Oracle the agent can't edit | Tail | Cool | Value | Open | Solo | Demo | Cheapest kill test |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---|
| 1 | **Twin** | Goose's GPU lowering: bit-exact int64, fault parity, generated layouts | Goose's own CPU build, on Metal, Vulkan, D3D12 and WebGPU | 4 | 4 | 3 | 3 | 4 | 4 | 3 days: three functions vs one-prompt shaders; ask Wouter |
| 2 | **Shader Ladder** | Readable simplification rules, plus per-shader ladders | The original shader's render, FLIP, device timers, held-out shaders | 5 | 4 | 3 | 3 | 4 | 4 | 3 days: 30 shaders, rules vs one-prompt, on a phone |
| 3 | **pbrt Anywhere** | A Slang port of pbrt-v4's GPU path | pbrt's CPU renderer: chi-square tests and per-pixel statistics | 3 | 4 | 3 | 4 | 3 | 5 | 2 days: three BxDFs pass chi-square on Metal and Vulkan |
| 4 | **Shader Ratchet** | A tiny shader compiler's coverage | Khronos CTS data, glslang, devices | 3 | 2 | 3 | 2 | 5 | 3 | 1 day: 1,000 CTS cases on lavapipe and Metal |

**I — Why Twin ranks above Ladder despite Ladder's stronger tailwind:**
- It is the only idea where the new language is essential rather than incidental.
- It fits your compiler work and the spike.
- Its 3-day kill test is cheap.
- Even its failure leaves something useful: Mac verification of goose_gfx and a CPU-vs-GPU harness.

If you don't want to bet on Goose, or on Wouter not building it, take Ladder. It passes the research's flip rule most
cleanly and depends on no single language.

**TL;DR**
1. New languages and graphics stacks are cheap now (Goose in ~2 months, `cute_spirv`, GoGPU); only their GPU half can't be borrowed through C.
2. Pick **Twin**, conditionally: grow Goose GPU lowering against a pinned CPU build, with exact integer checks, declared float tolerances and explicit fault instrumentation; kill in 3 days against one-prompt shaders and current maintainer plans.
3. Alternate: **Shader Ladder** (shader LOD rules measured on devices, strongest tailwind); pbrt Anywhere is open but finite; pixel-checked translation is mostly done.

## GPT-6.1 continuation audit (2026-10-29)

**F/I — Scope correction:** the headline's original blanket CPU/GPU bit-equality promise was too broad. The
[current WGSL specification](https://www.w3.org/TR/WGSL/#floating-point-evaluation) permits floating-point variation,
including rounding/accuracy differences and subnormal handling. Per-operation bounds do not automatically establish an
end-to-end error bound for a ray tracer. The byte-identical image in the proposed demo is a target for one constrained
implementation, not a portable guarantee. Exact memory comparison also needs canonical layouts/padding.

**F/I — Fault correction:** [WGSL dynamic errors](https://www.w3.org/TR/WGSL/#errors) do not promise Goose's source-level
diagnostics. Matching an error kind/line would require inserted checks and a specified fault-selection rule when several
invocations fail; it is proposed compiler work, not a feature inherited from the backend. Check effects and barriers as
well as diagnostic text. lavapipe/WARP validate software backends; physical-device speed and behavior remain unmeasured.

**I — Gap status:** this report establishes a research lead around language integration and checked lowering. It does
not establish that the niche is untaken, that CPU compilation is an infallible oracle, or that four physical GPU families
have been tested. No maintainer was contacted and no implementation test was run in this continuation.
