# G08 — Papers and engineering-effort graveyards: graphics, networks, databases, FPGA and scientific computing

Research date: **2026-10-29**. Read BRIEF-gaps.md, BRIEF-tailwind.md, the round-13 summary and the earlier kill list before selecting ideas.

**I — Result:** the strongest new lead is **ContactForge**, a growing collection of conservatively checked collision algorithms for curved, moving geometry. **CaptionCircuit** and **PauseProof** are narrower, conditional investigations. None has an established claim to being untaken. The cheap tests below must establish a missing capability, rather than merely demonstrate that an agent can write code.

**F/I — Scope:** 40 screened source seeds: 16 papers from 2025–2026 and 24 tracker/mailing-list entries, including older graveyards. These are not 40 validated opportunities. Solved issues, semantic disagreements, excluded ideas and existing implementations are marked explicitly. In particular, an old open issue does not establish that its whole checklist remains unimplemented.

**Evidence labels:** **Q** = exact quotation; **F** = sourced fact; **I** = inference/proposal; **E** = estimate or proposed threshold. Quotes are short excerpts, not invented summaries in quotation marks. Paper explanations distinguish the paper's contribution from my proposed extension. No source below supports a numerical person-year claim; I have not manufactured one.

**Screening labels:** **A** = concrete effort/scope blocker with a plausible independent check; **B** = useful missing-capability or oracle seed, but engineering effort is inferred; **X** = solved, taken, excluded, or blocked by something agents do not simply remove. A is a research priority, not a novelty certificate.

## 1. Paper seeds

### S01 — MiSo: robust geometry algorithms are still built case by case — A

**Source:** Sichetti et al., *MiSo: A DSL for Robust and Efficient Solve and Minimize Problems*, SIGGRAPH 2025, conclusion and limitations. [Author PDF](https://huangzizhou.github.io/assets/img/research/miso/solve_minimize_dsl_tex.pdf), [conference record](https://s2025.conference-schedule.org/presentation/?id=papers_1052&sess=sess155).

**Q:** “the historically cumbersome task of inventing, developing, and testing ad-hoc collision detection algorithm for each pair of primitives”.

**F — Plain explanation:** MiSo turns a mathematical description of a small geometry problem into C++ that gives conservative answers: it can report uncertainty rather than miss a possible collision. It already handles problems such as curved trajectories and checking whether a simulated element has folded inside out. **I — Seed:** agents could grow fast algorithms for additional shape/motion combinations, checked by a slower independent geometry checker. **F/I — Boundary:** MiSo already automates much of this; dimensionality and difficult numerical cases are real limitations, not just missing programmers. Develop only the residual in §3.1.

### S02 — Vcc leaves GPU runtime support outside its paper — A, adjacent excluded territory

**Source:** Devillers et al., *No More Shading Languages: Compiling C++ to Vulkan Shaders*, High-Performance Graphics 2025, §7.2. [Author PDF](https://graphics.cg.uni-saarland.de/papers/devillers-2025-hpg-vcc.pdf).

**Q:** “functionality reliant on the host operating system such as malloc is unavailable.”

**F — Plain explanation:** Vcc lets ordinary C/C++ target Vulkan graphics hardware instead of forcing everything into a separate shading language. A compiler alone does not supply the supporting runtime that C++ programs expect. **I — Seed:** each missing GPU-side runtime facility is potentially bounded engineering with CPU semantics and device tests as checks. **I — Disposition:** compiler/runtime growth and library transplantation collide with T01/T02/T05; retain the evidence without pitching another compiler or growing standard library.

### S03 — Topological Offsets deliberately evaluates a restricted mesh population — B

**Source:** Zint et al., *Topological Offsets*, SIGGRAPH 2025; arXiv preprint dates to 2024. [Authors' project](https://zhouyuan-chen.github.io/projects_webpage/topological_offsets.html), [paper](https://arxiv.org/abs/2407.07725).

**Q:** “the non-intersecting subset of Thingi10k”.

**F — Plain explanation:** Making a shell around a 3D surface can accidentally introduce holes, intersections or the wrong topology. This work constructs a shell with strong structural guarantees and then tries to move it to the requested distance. **I — Seed:** dirty, intersecting inputs are an obvious frontier to investigate, with exact intersection and mesh-validity checks available. **I — Disposition:** no evidence here that supporting arbitrary dirty inputs is merely engineering; the intended inside/outside and topology may be ambiguous. Do not promise that agents erase this mathematical problem.

### S04 — Neural light sampling has a quality/performance tradeoff — X

**Source:** Figueiredo et al., *Neural Importance Sampling of Many Lights*, SIGGRAPH 2025, limitations. [Author PDF](https://people.engr.tamu.edu/nimak/Papers/SIGGRAPH2025_ManyLights/media/SIGGRAPH_2025_Importance_Sampling.pdf).

**Q:** “it produces outlier fireflies due to our aggressive optimization strategy.”

**F — Plain explanation:** The renderer learns which lights deserve more computation, improving efficiency in scenes with many lights. Occasionally it underestimates an important light and produces a bright speck. **I — Seed/disposition:** a useful warning against treating every limitations paragraph as an engineering graveyard: this is an estimator/convergence tradeoff. More generated code does not establish a better estimator, and attractive screenshots are a weak admission check.

### S05 — Kernel-bypass networking costs much more application work than advertised — A

**Source:** Awamoto and Honda, *Opening Up Kernel-Bypass TCP Stacks*, USENIX ATC 2025, §8.1. [Paper](https://www.usenix.org/system/files/atc25-awamoto.pdf).

**Q:** “our experience suggests significant engineering effort for their adoption.”

**F — Plain explanation:** The authors run several fast networking stacks under comparable workloads and find that neither performance nor adoption is straightforward. Applications may need different concurrency, connection bookkeeping, buffer handling or asynchronous I/O. **I — Seed:** there is real per-application integration work that stronger agents could reduce, with an original server's client-visible behavior and controlled benchmarks as partial checks. **I — Disposition:** retain as strong effort evidence; app migration itself is already on the kill list, and growing a library OS would violate this round's scope.

### S06 — Database networking is expensive to replace — A

**Source:** Zhou et al., *OLTP Through the Looking Glass 16 Years Later: Communication is the New Bottleneck*, CIDR 2025, kernel-bypass discussion. [Paper](https://vldb.org/cidrdb/papers/2025/p17-zhou.pdf).

**Q:** “Integrating DPDK requires significant engineering effort to rewrite the DBMS networking layer”.

**F — Plain explanation:** This paper reexamines where transaction-processing time goes and identifies communication as an important bottleneck. A faster packet path is not a drop-in improvement: database developers inherit transport integration and operational work. **I — Seed:** the interesting frontier is application-plus-network semantics under realistic scheduling, not another SQL engine. **I — Oracle limit:** correct query results alone do not check connection shutdown, backpressure, cancellation, TLS or resource isolation; a throughput number cannot establish correctness either.

### S07 — Configuration-template engineering has already attracted an automated solution — X

**Source:** Liu et al., *CEGS: Configuration Example Generalizing Synthesizer*, NSDI 2025, abstract. [Paper and authors' explanation](https://www.usenix.org/conference/nsdi25/presentation/liu-jianmin).

**Q:** “existing synthesizers still require much human effort in drafting configuration templates or coding in a domain-specific language.”

**F — Plain explanation:** Network operators normally translate examples and intended behavior into device-specific configurations. CEGS uses learned models and LLMs to adapt documentation examples to different network topologies. **I — Disposition:** an excellent example of engineering work falling, but the paper is already doing the obvious idea. It is prior art against a generic agent that turns network intent into configuration.

### S08 — Ellsberg supplies an implementation-to-protocol check, with explicit blind spots — B

**Source:** Ding et al., *Runtime Protocol Refinement Checking for Distributed Protocol Implementations*, NSDI 2025, abstract and §1. [Paper](https://www.usenix.org/system/files/nsdi25-ding.pdf).

**Q:** “These bugs are often introduced by programmers when converting protocol descriptions into code.”

**F — Plain explanation:** A correct design for coordinating machines can still be implemented incorrectly. Ellsberg compares a running implementation's messages with behavior permitted by a protocol model, catching certain deviations without inspecting its internal state. **I — Seed:** models can potentially grow implementation details against an independently owned protocol model. **F/I — Disposition:** the paper cannot detect all deadlocks, stored-data corruption or performance failures; its monitor is not a complete synthesis oracle. An agent-era Jepsen or generic protocol-verification loop is excluded.

### S09 — Stateful packet programs need a temporal oracle — B

**Source:** Zhang, Ye and He, *On Temporal Verification of Stateful P4 Programs*, NSDI 2025, abstract. [Paper page](https://www.usenix.org/conference/nsdi25/presentation/zhang-delong).

**Q:** “existing P4 verifiers overapproximate the stateful nature of P4 programs”.

**F — Plain explanation:** A programmable switch can remember previous packets, so checking one packet in isolation is insufficient. This paper introduces a language and checker for properties that must hold across packet sequences. **I — Seed:** retained packet-processing capabilities could be admitted using temporal properties, rather than a handful of successful packet examples. **I — Disposition:** the checker and P4-program synthesis are existing research areas; no untaken product follows directly from adding an agent.

### S10 — AnyBlox attacks the format-adoption engineering tax directly — X

**Source:** Gienieczko et al., *AnyBlox: A Framework for Self-Decoding Datasets*, PVLDB 18(11), 2025, abstract. [Paper](https://www.vldb.org/pvldb/vol18/p4017-gienieczko.pdf), [authors' artifacts](https://github.com/AnyBlox/vldb-2025).

**Q:** “new formats are not adopted due to high implementation cost”.

**F — Plain explanation:** A better data encoding is hard to adopt if every database must learn how to read it. AnyBlox packages a small WebAssembly decoder with the data, so multiple engines can use the format through a shared interface. **I — Disposition:** the portable-decoder substrate exists, and T07 already considered this evidence. It is not an opening for another general format adapter, data-preservation archive or codec-growing pitch.

### S11 — EPOCH's device migration remains a concrete extension point — A, broad capability taken

**Source:** Malik, Karabulut and Aysu, *EPOCH: Enabling Preemption Operation for Context Saving in Heterogeneous FPGA Systems*, arXiv 2025; journal DOI points to IEEE Access 2026. §VII-B. [Paper](https://arxiv.org/html/2501.16205v3#S7.SS2).

**Q:** “To integrate EPOCH with the UltraScale FPGA family, slight modifications will be required.”

**F — Plain explanation:** A normal program can be paused and resumed; a circuit running on an FPGA also has hidden state in registers, memories and arithmetic blocks. EPOCH captures that state on a demonstrated FPGA family and resumes execution, while describing changes needed for another family. **I — Seed:** independently checked state-preservation support across circuit structures is potentially a growing artifact. **F/I — Caution:** the authors describe this particular port as small; PauseProof below must justify substantially more than implementing that port. Pausing FPGA work itself is already taken.

### S12 — LLM-directed FPGA parameter search exists in 2026 — X

**Source:** Sharma et al., *LLM-Driven Design Space Exploration of FPGA-based Accelerators*, arXiv 2605.05920, May 2026, abstract. [Paper](https://arxiv.org/abs/2605.05920).

**Q:** “identifying optimal accelerator configurations still requires substantial manual effort and domain expertise.”

**F — Plain explanation:** An FPGA accelerator has many choices about memory, parallelism and data movement. SECDA-DSE uses LLMs to explore those choices and reports an initial generated design meeting synthesis constraints. **I — Disposition:** direct prior art against a broad agent that designs or tunes FPGA accelerators. Successful synthesis checks timing and resources; it does not alone establish functional equivalence. The earlier HLS kill remains in force.

### S13 — Accelerator engineering can buy disappointing performance — A, economics warning

**Source:** Barbone et al., *Application of Computational Modelling to Particle Physics*, Communications in Computational Physics 37(5), May 2025, abstract and conclusion. [University record](https://spiral.imperial.ac.uk/entities/publication/c42b0d0d-5f81-4fb9-ad5d-3b9e711b746d), [paper](https://global-sci.com/index.php/cicp/article/download/17178/34106/35336).

**Q:** “Accelerating applications can require significant engineering effort, prototyping and measuring the speedup that might finally result in disappointing accelerator performance.”

**F — Plain explanation:** The authors estimate how well an application would run on an accelerator before spending heavily on the port. Their example uses particle-physics computation, where moving data and coordinating computation can erase the expected win. **I — Seed:** cheap agents change the cost of trying an implementation; they do not remove bandwidth, synthesis time or hardware cost. A viable growth loop must require an actual measured benefit before retaining a circuit.

### S14 — Legacy scientific-code translation already has a reusable implementation — X

**Source:** Nytko et al., *Teaching An Old Dog New Tricks: Porting Legacy Code to Heterogeneous Compute Architectures With Automated Code Translation*, arXiv, February 2025, abstract. [Paper](https://arxiv.org/abs/2502.05279).

**Q:** “without significant time investment and while avoiding intrusive changes to the codebase.”

**F — Plain explanation:** This work moves an existing multigrid solver onto GPUs through a reusable translation layer and runtime. The value is preserving the investment in established scientific code while obtaining accelerator execution. **I — Disposition:** additional evidence for the existing Fortran/HPC-porting kill; do not re-pitch general legacy-science modernization.

### S15 — Performance portability still requires a major commitment — A, excluded broad pitch

**Source:** Davis et al., *Taking GPU Programming Models to Task for Performance Portability*, ICS 2025, introduction. [Paper](https://pssg.cs.umd.edu/assets/papers/2025-06-portability-ics.pdf).

**Q:** “Choosing a programming model for porting a CPU-only application to GPUs is a major commitment, requiring significant time for developer training and programming.”

**F — Plain explanation:** A program can compile on two GPUs and still run well on only one. The authors compare several programming models and scientific proxy applications to expose these differences. **I — Disposition:** useful effort evidence, but GPU-kernel agents and a cross-GPU numerical atlas are already excluded; no new pitch. The check must include numerical requirements as well as speed.

### S16 — Scientific compression needs reproducible numerical building blocks — A, excluded broad pitch

**Source:** Cappello et al., *What to Support When You're Compressing: The State of Practice Gaps and Opportunities for Scientific Data Compression*, SC 2025, reproducibility discussion/Takeaway 23. [Paper](https://petterjohansson.me/content/2025-sc25-what-to-support-when-you-are-compressing.pdf).

**Q:** “More research and development effort is needed for performance portability layers and techniques to support applications that need this kind of bit-for-bit reproducibility.”

**F — Plain explanation:** Some scientific compressors depend on tiny numerical details, so moving between machines can change reconstructed values or break an intended guarantee. The paper distinguishes preserving an error bound from reproducing exactly the same bits. **I — Disposition:** a strong oracle-design lesson; ordinary tolerance-based comparison is insufficient for some workloads. It does not reopen the rejected compression-loop or numerical-atlas ideas.

## 2. Issue-tracker and mailing-list seeds

For GitHub issues, dates and open/closed states below were fetched from the issue metadata during this research. A stale checklist is a lead to reproduce on current code, not proof of a present defect. Mailing-list entries establish what someone said at that date; they do not establish present implementation status.

### S17 — LLVM's SPIR-V numerical audit is an explicit umbrella — B

**F — Source/status:** [llvm/llvm-project #73459](https://github.com/llvm/llvm-project/issues/73459), opened 2023-11-26; open.

**Q:** “We should audit the conversions to the SPIR-V dialect for floating point precision semantics”.

**I — Plain explanation:** converting a GPU operation must preserve details such as NaNs and signed zero, not merely the normal arithmetic result. **I — Oracle/gate:** the source and target specifications can constrain a check, but unspecified behavior must remain unspecified. Useful finite audit; a general proven compiler or numerical atlas would repeat excluded ideas.

### S18 — AArch64 GlobalISel has an operation-by-type completion matrix — B

**F — Source/status:** [LLVM #115133](https://github.com/llvm/llvm-project/issues/115133), opened 2024-11-06; open, updated 2026-04-23.

**Q:** “Blank spaces usually mean not checked / not supported.”

**I — Plain explanation:** the compiler has many combinations of operation and data type, and a matrix identifies gaps that otherwise hide behind fallback paths. **I — Oracle/gate:** compare against the established backend, executable semantics and code-size measurements. Strong bounded scope, but completing compiler backends is T02 territory; retain the seed only.

### S19 — SVE backend support has a long-standing tracking issue — B

**F — Source/status:** [LLVM #114644](https://github.com/llvm/llvm-project/issues/114644), opened 2024-11-02; open.

**Q:** “Discussion and Bug Tracker for SVE support”.

**I — Plain explanation:** ARM's variable-width vector instructions multiply the compiler cases that need support. **I — Oracle/gate:** architecture semantics, emulation and the mature backend can check individual cases; the very short issue body is not evidence of a quantified manpower blocker. Treat as a checklist-discovery entry, not a standalone idea.

### S20 — Cranelift's differential fuzzer has uncompleted capability families — B

**F — Source/status:** [Wasmtime #3050](https://github.com/bytecodealliance/wasmtime/issues/3050), opened 2021-07-01; open.

**Q:** “Full coverage of SIMD ops”.

**F/I — Plain explanation:** this fuzzer runs generated programs in an interpreter and on the real machine, then compares results; its roadmap includes memory, calls and vector-operation gaps. **I — Oracle/gate:** the existing interpreter is a useful external reference, subject to supported/defined behavior. This is attractive finite engineering, but a new generic mutation-testing product is excluded.

### S21 — Cranelift interpreter coverage itself is incomplete — B

**F — Source/status:** [Wasmtime #4889](https://github.com/bytecodealliance/wasmtime/issues/4889), opened 2022-09-09; open.

**Q:** “Implemented for some types (i.e. only scalar but no SIMD) / Missing some tests”.

**I — Plain explanation:** the reference checker can have coverage holes too; writing a new compiler feature and its reference behavior together creates a circular check. **I — Oracle/gate:** keep an independent semantics source and tests outside the agent's editable workspace. Good oracle-maintenance work, rather than evidence that a new compiler company is open territory.

### S22 — RISC-V vector instruction selection is explicitly rule-heavy — A

**F — Source/status:** [Wasmtime #7186](https://github.com/bytecodealliance/wasmtime/issues/7186), opened 2023-10-08; open, updated 2026-10-04.

**Q:** “Matching one of these instructions includes a lot of rules”.

**I — Plain explanation:** implementing an instruction is not just knowing what the arithmetic does; the compiler must match the right widths, types and surrounding operations. **I — Oracle/gate:** architecture tests and independent execution can check the semantics, with separate code-quality benchmarks. Strong engineering seed, already within the excluded backend-growth family.

### S23 — A useful fuzzer integration was removed because maintenance was costly — A

**F — Source/status:** [Wasmtime #4338](https://github.com/bytecodealliance/wasmtime/issues/4338), opened 2022-06-27; open.

**Q:** “These are difficult and time consuming to track down for a foreign codebase, however.”

**F/I — Plain explanation:** Binaryen generated differently shaped programs, but investigating its generator failures and waiting for dependency updates imposed maintenance work. **I — Oracle/gate:** measure additional compiler-path coverage and independently reproducible defects, rather than counting generated test cases. This is a credible engineering graveyard; it remains a contribution-shaped testing task, not a fresh product pitch.

### S24 — Emitted-code coverage has been requested since 2019 — B

**F — Source/status:** [Wasmtime #1151](https://github.com/bytecodealliance/wasmtime/issues/1151), opened 2019-11-15; open, updated 2026-07-30.

**Q:** “Add the ability to insert instrumentation to track code coverage.”

**I — Plain explanation:** without seeing which generated instructions actually execute, a fuzzer can miss entire behaviors while appearing productive. **I — Oracle/gate:** known-coverage programs and execution traces can check instrumentation. Missing scope is concrete, but the issue does not itself say engineering cost is the blocker; generic testing automation stays excluded.

### S25 — Valgrind already supplied a stronger check than ordinary execution — B

**F — Source/status:** [Wasmtime #2582](https://github.com/bytecodealliance/wasmtime/issues/2582), opened 2021-01-14; open.

**Q:** “our generated code depended on the initial (undefined) value of an XMM register.”

**F/I — Plain explanation:** a generated program can pass on a particular run only because an unspecified register happened to contain a convenient value. The issue proposes running compiler tests under Valgrind to catch that dependence. **I — Gate:** a useful independent checker; too small and already testing-shaped to develop as an idea.

### S26 — Zig's SPIR-V pointer problem is a real semantic mismatch — B/X

**F — Source/status:** [Zig #15230](https://github.com/ziglang/zig/issues/15230), opened 2023-04-10; open.

**Q:** “In order for Zig to support shaders for Vulkan or OpenGL, there needs to be some way to work with or around these limitations.”

**I — Plain explanation:** ordinary Zig pointers can express behavior that Vulkan's shader memory model restricts. **I — Oracle/gate:** a compiler must either reject unsupported programs or supply a semantics-preserving representation; a validator accepting the output is not enough. More engineering may help, but language restrictions and target semantics need a decision that code generation cannot make on its own.

### S27 — Zig unions meet several independent SPIR-V restrictions — B

**F — Source/status:** [Zig #15233](https://github.com/ziglang/zig/issues/15233), opened 2023-04-10; open, updated 2025-01-21.

**Q:** “Unions are problematic in SPIR-V”.

**F/I — Plain explanation:** a union reuses the same bytes for different values; SPIR-V's casts, constants and alignment rules complicate that representation. The issue separates three concrete obstacles. **I — Oracle/gate:** byte-layout equivalence plus target validation and execution; useful finite compiler work, already excluded as a new pitch.

### S28 — Fixed-point support is partly a language-design decision — X

**F — Source/status:** [Zig #1974](https://github.com/ziglang/zig/issues/1974), opened 2019-02-17; open, updated 2026-04-21.

**Q:** “One feature that I feel is missing currently is built-in support for fixed-point numbers.”

**I — Plain explanation:** fixed-point arithmetic trades a fixed fractional scale for predictable integer-like execution, useful in embedded and hardware work. **I — Gate/disposition:** exhaustive small-width arithmetic checks are possible, but the requested language feature needs agreed rounding, overflow and type rules. A seven-year-old proposal is not automatically seven years of unperformed coding.

### S29 — Rust specialization is not just a large implementation backlog — X

**F — Source/status:** [Rust #31844](https://github.com/rust-lang/rust/issues/31844), opened 2016-02-23; open, updated 2026-04-21.

**Q:** “Restrictions around lifetime dispatch (currently a soundness hole)”.

**I — Plain explanation:** choosing a more specific implementation can interact incorrectly with Rust's rules about how long values remain valid. **I — Gate/disposition:** the hard part includes settling a sound language design; passing today's examples does not prove one. Do not infer that a decade-old tracker can be closed merely by assigning more agents.

### S30 — Blender-to-Godot materials run into renderer architecture — A/X

**F — Source/status:** [Godot proposal #1354](https://github.com/godotengine/godot-proposals/issues/1354), opened 2020-08-12; open. Quote from SIsilicon's [technical comment](https://github.com/godotengine/godot-proposals/issues/1354#issuecomment-673130722).

**Q:** “This is impossible to achieve in Godot without rewriting some of how shaders should work.”

**F/I — Plain explanation:** some Blender material nodes depend on when lighting is evaluated, so copying their expressions into Godot does not recreate the effect. **I — Oracle/gate:** matching controlled rendered scenes is a partial check, not a proof across all illumination. **F/I — Prior-art stop:** [Goblend's March 2026 announcement](https://forum.godotengine.org/t/goblend-export-from-blender-to-godot/135385) already includes basic shader conversion and baking; a broad material converter is taken.

### S31 — MaterialX import is an explicit cross-system work list — B

**F — Source/status:** [Godot proposal #714](https://github.com/godotengine/godot-proposals/issues/714), opened 2020-04-15; open, updated 2026-02-02.

**Q:** “Write a MaterialX to glsl rendering importer.”

**I — Plain explanation:** a portable material description still needs a backend that fits Godot's shader model and resources. **I — Oracle/gate:** compare the supported subset against the MaterialX reference generator and controlled numerical shader evaluations. Existing shader generation and S30 make this a scoped implementation lead, not evidence for a novel general bridge.

### S32 — Runtime asset import exposes the editor/export boundary — B

**F — Source/status:** [Godot proposal #1632](https://github.com/godotengine/godot-proposals/issues/1632), opened 2020-10-08; open.

**Q:** “replicate the import process at run-time”.

**I — Plain explanation:** assets prepared inside an editor and files supplied later by a player take different paths. The issue asks for a consistent way to import the latter in an exported game. **I — Oracle/gate:** compare the resulting resources with the editor's import on the same inputs. Useful repeated engineering, but a general growing adapter library would duplicate round 13.

### S33 — Godot's WebTransport proposal names a missing transport surface — B

**F — Source/status:** [Godot proposal #3899](https://github.com/godotengine/godot-proposals/issues/3899), opened 2022-01-31; open, updated 2026-10-28.

**Q:** “A base class WebTransportMultiplayerPeer which inherits from NetworkedMultiplayerPeer”.

**I — Plain explanation:** browser multiplayer games want the option to send time-sensitive data without waiting for every earlier packet. The proposal describes client/server classes and reliable-stream versus datagram access. **I — Oracle/gate:** independent endpoints and protocol tests can check transport behavior, while latency needs controlled loss/reordering tests. Current implementation must be checked: the issue's API names and historical browser claims are not a 2026 specification.

### S34 — Yosys's memory-inference redesign is a solved scope specimen — X

**F — Source/status:** [Yosys #1959](https://github.com/YosysHQ/yosys/issues/1959), opened 2020-04-17; closed; linked implementation [#3189](https://github.com/YosysHQ/yosys/pull/3189).

**Q:** “support for asymmetric width ports (eg. 4-bit write, 8-bit read)”.

**F/I — Plain explanation:** a hardware memory has a cross-product of port widths, clocks, reset behavior and simultaneous read/write rules. The issue writes that scope down explicitly. **I — Oracle/gate:** symbolic sequential equivalence is stronger than checking a few memory operations. Useful model for structuring PauseProof; this specific redesign has already been done.

### S35 — A graphics maintainer explicitly declines a proof because of effort — A, closed symptom

**F — Source/status:** [vkd3d-proton #1636](https://github.com/HansKristian-Work/vkd3d-proton/issues/1636), Resident Evil 4 reflection glitches; closed as completed in August 2023. HansKristian-Work's August 10 comment discusses FP16 selection.

**Q:** “But proving that is too much work.”

**F/I — Plain explanation:** the visible bug was worked around, but proving when a shader should avoid reduced precision was a larger task. This is unusually direct effort evidence. **I — Oracle/gate:** arithmetic semantics and a proof could establish a transformation's conditions; screenshots alone could not. It does not reopen driver translation, GPU numerics or proven-compiler pitches already rejected.

### S36 — Subtitle filtering touches the semantics of FFmpeg's whole media graph — A

**Source/date:** softworkz, [*Subtitle Filtering: Concepts*, 2025-06-05](https://ffmpeg.org/pipermail/ffmpeg-devel/2025-June/344675.html).

**Q:** “it would require a complete rewrite of filtering so that it can work with AVSubtitle data”.

**F/I — Plain explanation:** audio and video normally advance in a regular sequence; subtitles can overlap, disappear for a long time, or acquire their end time later. Reusing the wrong frame assumptions makes the problem architectural, rather than adding a subtitle parser. **I — Oracle/gate:** a separately defined presentation-time state machine can check exact cue visibility and timing. The proposed patchset already exists; CaptionCircuit investigates a specific residual, not subtitle filtering's existence.

### S37 — FFmpeg's abandoned effort includes review uncertainty — X as a coding-only fix

**Source/date:** Nicolas George, [*API enhancements / broken promises*, 2022-08-17](https://ffmpeg.org/pipermail/ffmpeg-devel/2022-August/300196.html).

**Q:** “if the patches are eventually rejected, that work goes to waste.”

**I — Plain explanation:** major changes can require most of the work before maintainers decide whether they accept the design. **I — Gate/disposition:** an agent can reduce sunk coding cost; it cannot guarantee agreement or upstream adoption. Any project whose core value requires a contentious merge fails the no-partners/solo requirement.

### S38 — FFmpeg's old project list contains actual graveyard language — A, historical only

**Source/date:** nevcairiel in the project's [2016-02-10 developer IRC log](https://mplayerhq.hu/pipermail/ffmpeg-devel-irc/2016-February/003376.html), 17:07–17:12 CET.

**Q:** “someone should remove all of those projects that we've been carrying around for 10 GSoCs”.

**F/I — Plain explanation:** the discussion says old student-project suggestions persisted even when they were too complex or no longer compelling. **I — Oracle/gate:** this is a place to hunt named codec features with standards and conformance files, not permission to resurrect the entire list. No specific old GSoC item is asserted to remain missing today.

### S39 — PostgreSQL explicitly deferred general incremental aggregates — X: existing T07 evidence

**Q/F:** “because it would need substantial works and make the patch more complex and bigger.” — Yugo Nagata, [pgsql-hackers, 2021-11-29, Aggregate support](https://www.postgresql.org/message-id/20211129144826.c9d42c1f61495c6983d8b6b1%40sraoss.co.jp). **I:** computing small view updates has real deferred engineering, and full recomputation provides a check; this is DeltaForge's already-covered territory, so no new idea is developed.

### S40 — SQLite's transaction wrapper illustrates a bounded combinatorial oracle — X: historical, closed

**Source/status:** [System.Data.SQLite ticket 1f7bfff467](https://system.data.sqlite.org/home/info/1f7bfff467), *SQLiteTransaction: critical rollback bug*, opened 2016-10-27; closed 2016-11-17, resolution Not_Backwards_Compatible.

**Q:** “If this seems to be too much work, please consider implementing the easy fix of just disallowing nested transactions at all instead.”

**F/I — Plain explanation:** savepoints, commits and rollbacks create many short command sequences that a wrapper can mishandle. A tiny explicit state model can enumerate expected results. **I — Disposition:** a useful oracle specimen, not a live SQLite-engine defect, and not an excuse to pitch another database-testing platform.

## 3. Three developed candidates

These are original **I** proposals derived from the cited seeds. Implementation counts, budgets and pass thresholds are **E**, not paper results. Better models accelerate search inside each structure; none gets credit merely for including an agent loop. The generic proposer/checker mechanism is established prior art.

### 3.1 ContactForge — a collision engine that grows certified fast paths for curved moving shapes

**I — One sentence/value:** describe two curved objects and their motion; the engine acquires a reusable collision algorithm that cannot declare a time interval safe without a checkable enclosure argument.

**F/I — Seed:** S01 supplies both the per-primitive engineering burden and a serious baseline: MiSo already generates conservative geometry solvers. S03 supplies an adjacent warning that geometry guarantees are conditional on precisely defined inputs. This is about fixed geometric questions and executable spatial algorithms; the proposal supplies no new world laws or symbolic integration rules.

**I — What grows:** a Rust/C++ runtime contains a small fixed language for shape/motion expressions, a slow subdivision fallback and a catalog indexed by the expressions' structure. An unsupported or very slow query sends its expression family to an offline agent. The agent proposes reusable bounding constructions, domain splits and fast-path dispatch conditions. The retained artifact is that catalog plus executable implementations, not an answer for one arrangement of objects.

**I — Independent oracle:** the builder owns a small certificate checker, outward-rounded arithmetic, domain semantics and adversarial inputs. A candidate must partition the requested space/time domain into cells whose enclosures establish separation, collision witnesses, or an explicit unresolved remainder. Agents cannot edit the checker, silently remove cells, change the input trajectory, or equate an unresolved interval with no collision. A timeout falls back conservatively. Random tests and a second implementation help find checker errors, but are not presented as a proof. Initial support stays with bounded-degree polynomial expressions; transcendental support is a later research question.

**I — Tailwind/one-shot:** a stronger model can invent better bounds for more combinations of curvature, trajectory and degeneracy. Already admitted algorithms continue to execute without a model. A one-prompt collision routine is not the finished value: it lacks the retained family-wide admissibility conditions, certificate coverage, difficult-case corpus and performance envelope. The builder's contribution is choosing those contracts and keeping the trusted checker much smaller than the algorithms it accepts.

**E — Six-week version/demo:** implement planar curves and a small set of 3D polynomial patches with a CPU fallback; grow approximately 10 useful shape/motion families. Show a fast moving curved object passing another between animation frames: demonstrate both a missed collision in naive frame sampling and the exact interval retained by ContactForge. Then restart offline and process unseen arrangements. Target at least a 5× median improvement over the conservative baseline for admitted families, with adversarial cases still returning safe uncertainty. This is a bounded computational-geometry prototype, not a complete physics engine.

**F — Prior art:** [MiSo](https://gitlab.com/fsichetti/miso) already generates conservative C++; [IPC Toolkit](https://github.com/ipc-sim/ipc-toolkit) already provides broad/narrow-phase continuous collision detection, including nonlinear trajectories. Their existence kills a generic claim to generating robust collision code. **I — What's left:** a retained, automatically expanding catalog of certificate-checked specialization strategies for expression families that those baselines handle too slowly or do not express. The search did not establish that this residual is untaken. MiSo's Python authoring layer is prior art, not a proposed dependency; the deliverable and its checker use Rust/C++ and native arithmetic libraries.

**E — Cheapest kill:** spend two days on 30 preselected low-dimensional cases, including tangencies, almost coincident surfaces and high curvature. Give both existing tools and a strong one-prompt implementation a fair baseline. Stop if the only advantage is wrapping MiSo, if useful fast paths need changing the semantic checker, or if verification is as expensive as repeatedly running the baseline. Continue only after producing a reusable family-level gain on held-out arrangements. Also stop if the candidate is simply a new name for a generic proof-guided optimizer.

**E — Scores:** Tail 5; Cool 5; Value 4; Open 3; Solo 3; Demo 5.

### 3.2 CaptionCircuit — a growing native engine for subtitles that interact with live audio and video

**I — One sentence/value:** keep styled subtitles correct while a live media pipeline cuts, changes speed, splices or overlays content, including cues whose duration is initially unknown.

**F/I — Seed:** S36 describes a representation mismatch deep enough to motivate a filtering rewrite; S37 explains why waiting for an upstream decision is a poor core dependency. The missing capability to test is composition across sparse subtitle events and continuous media clocks. This proposal's artifact is a native media runtime, not an editing interface, a file-format editor, or incremental maintenance of database collections.

**I — What grows:** the builder fixes a timestamp and event model: rational time, overlapping cue identity, style state, end-time revisions, gaps, stream resets, EOF and explicit buffering bounds. A Rust/C++ engine connects FFmpeg's existing decoding/encoding libraries at its boundary. When a declared operation/type combination is absent, an agent implements an operator inside this model, such as speed-changing an animated cue, preserving region state across a splice, or composing a bitmap-caption stream with text captions. Operators and their declared preconditions remain in the runtime and run without a model.

**I — Independent oracle:** a deliberately slow event interpreter owned by the builder defines the expected presentation state at every event boundary and at selected points within animation intervals. The checker compares text, style/region identity, active intervals, reset behavior and rational timestamps. Pinned libass rendering supplies a separate image check where ASS semantics apply; pinned fonts and rendering settings are part of the fixture. Live traces include a long absence of subtitles, unknown cue ends and discontinuities. Fixed deadlines and buffer ceilings prevent an implementation from passing by waiting forever. Ambiguous format behavior must be restricted or explicitly specified before growth; another model does not decide acceptance.

**I — Tailwind/one-shot:** better models can handle more interactions between concrete subtitle semantics and media operations. The accumulated thing is the functioning operator/format cross-product, its compatibility conditions and preserved temporal behavior. A stronger model can write a retiming function in a prompt; that alone does not produce a live engine with controlled buffering and checked composition across the supported cue families. Whether this distinction is large enough is part of the kill test.

**E — Six-week version/demo:** support ASS and a bounded bitmap-caption subset with cut, splice, delay and speed change. Use hand-authored synthetic streams, so no media licenses or private production captures are required. Demonstrate a long subtitle gap while audio/video continue; splice while two styled cues overlap; change playback speed while an animated cue is active; deliver a late end event without freezing the video. Replay the same trace offline with network and model access disabled. Target six operators across two caption families, rather than broad codec coverage.

**F — Prior art:** softworkz already has [subtitle-filtering demonstrations](https://github.com/softworkz/SubtitleFilteringDemos/blob/master/Demo1/Readme.md), including text manipulation of bitmap subtitles. [GStreamer documents sparse subtitle streams and gap events](https://gstreamer.freedesktop.org/documentation/additional/design/sparsestreams.html); sparse-stream scheduling is established. [FFmpeg's current manual](https://www.ffmpeg.org/ffmpeg.html#Advanced-Subtitle-options) documents that fixing subtitle duration by waiting for the next packet can increase latency and memory consumption. [ez-ffmpeg](https://docs.rs/ez-ffmpeg/latest/ez_ffmpeg/subtitle/struct.SubtitleFilter.html) already offers Rust-based subtitle burn-in against frame timestamps.

**I — What's left:** only independently specified, composition-checked live operations that the existing patchset and GStreamer cannot already perform correctly under the same semantics. Subtitle filtering, burn-in, transcription, translation and ordinary timestamp shifting are all already taken. There is no evidence of an exclusive opening; Open is deliberately low. If the remaining work is only exposing existing filters, this candidate fails.

**E — Cheapest kill:** take 12 hard traces, run them through the existing subtitle patchset and GStreamer, and document exact mismatches against the fixed event model. Stop within three days if either existing system expresses and passes all traces, if the differences are arbitrary taste about semantics, or if the project reduces to T06-style interaction behavior or T07-style generic incremental operators. Continue only for a concrete media-processing capability missing in both implementations. Core value must survive in the standalone engine without an upstream merge.

**E — Scores:** Tail 4; Cool 4; Value 4; Open 2; Solo 3; Demo 5.

### 3.3 PauseProof — grow circuit-specific pause/resume transformations with an external equivalence gate

**I — One sentence/value:** make an existing, openly available RTL accelerator interruptible, retaining each supported circuit/memory pattern only after proving that interruption does not change its observable computation.

**F/I — Seed:** S11 demonstrates a useful pause/resume mechanism with device-specific details; S34 exposes the large combination of memory-port behaviors a transformation must preserve. The narrow opportunity is certified transformation coverage for source-visible RTL blocks. Merely adding support for one more EPOCH board is not ambitious enough.

**I — What grows:** the builder fixes an RTL subset, a pause protocol and the meaning of observable I/O. Agents grow transformation templates and state schemas for patterns such as synchronous block RAM, asymmetric ports, pipelined arithmetic, FIFOs and ready/valid interfaces. A supported block emits synthesizable Verilog with capture/restore logic and a certificate; unsupported clocking or proprietary black boxes produce an explicit rejection. No hardware description or checker may silently omit internal state.

**I — Independent oracle:** compare the original circuit, held stalled during an interruption, with the transformed circuit that captures, clears and restores its state. Check correspondence for arbitrary supported inputs and legal pause points using symbolic equivalence/induction, not just identical outputs for one testbench. Reset, memory collision rules, pending output transactions and input backpressure belong in the reference contract. Use a fixed C++/Rust harness driving native Yosys equivalence/SAT operations; a waveform renderer is a demo, not the admission authority. Post-synthesis checks and one physical board test strengthen implementation evidence but cannot extend the proof to unspecified silicon behavior.

**I — Tailwind/one-shot:** a stronger model can support more interacting state patterns and find better decompositions for the proof. The retained deliverable is a synthesis-capable transformation system with checked structural coverage. A one-prompt scan-chain implementation does not establish that a block RAM's old/new read behavior, pending handshakes and pipeline state all survive interruption. If one generic instrumentation pass already handles everything in scope, the proposed agent-growth moat disappears.

**E — Six-week version/demo:** one clock domain, approximately six small open RTL blocks, including a FIFO and a memory-using signal-processing block. Show two tasks sharing a physical FPGA when a suitable board is available; otherwise use a cycle-accurate simulator and label the demonstration accordingly. Interrupt at varying cycles, clear state, resume and show identical output events while allowing the declared timing stretch. Measure state size, added logic and maximum pause delay. Begin with simulation/proofs so expensive hardware is not a prerequisite for the kill test.

**F — Prior art:** [EPOCH](https://arxiv.org/abs/2501.16205) already pauses hardware and captures LUT/register/BRAM/DSP state. Its authors publish a [preemption benchmark repository](https://github.com/aamalik3/Benchmarks). France-Pillois et al.'s [2026 architecture-agnostic checkpointing/rollback toolchain](https://www.research.ed.ac.uk/en/publications/a-step-toward-stateful-hw-sw-migration-an-architecture-agnostic-c/) already inserts migration points into HLS-generated applications. [Yosys EQY](https://github.com/YosysHQ/eqy) supplies established equivalence-checking infrastructure; it is prior art, not a proposed Python runtime dependency.

**I — What's left:** reusable, independently checked source-RTL capture/restore transformations for explicit state-pattern combinations outside existing tools' supported contracts. Broad FPGA preemption, hardware/software migration and generic HLS generation are taken. The sources do not prove that this narrower gap exists, and this is the least secure candidate on novelty and solo feasibility.

**E — Cheapest kill:** in three days, compare existing approaches with three blocks: a FIFO, asymmetric dual-port memory and a pipelined operator with backpressure. Stop if existing instrumentation already covers them, if proving equivalence needs manually specifying most of the circuit, or if hidden device state requires unavailable vendor information. Continue only after a structurally reusable transformation passes an independent proof and does not require an OS-growing project around it. A board port or a generic RTL-repair agent would fail this round's filter.

**E — Scores:** Tail 4; Cool 5; Value 4; Open 2; Solo 2; Demo 5.

## 4. Prior-art search audit and limits

**F — Performed on 2026-10-29:** live web searches, primary author/project pages and GitHub issue/comment fetches. Searches included 2026 in the query where checking present prior art. Paper years above come from publication/arXiv records, not the search engine's sometimes inconsistent relative dates. Some papers were read through searchable primary-source excerpts or their abstracts rather than a complete PDF; none of their experiments was rerun.

**I — Reproducible search terms and outcomes:**

- ContactForge: “2026 certified continuous collision detection implicit procedural geometry interval”; “2026 agent collision detection verification”; “MiSo transcendental future work”; “2026 collision MiSo Sichetti”; “2026 certified geometry collision solver synthesis MiSo GitHub”. The load-bearing collisions are MiSo and IPC Toolkit, linked above. A separate search surfaced unrelated projects also called MISO; those are not evidence about this geometry compiler.
- CaptionCircuit: “FFmpeg subtitle filtering 2026 native text subtitles libavfilter”; “2026 FFmpeg subtitle filtering Zach Swena”; “2026 subtitle filter graph engine Rust cue timing GStreamer”; “2026 subtitle processing graph formal”. The load-bearing collisions are the existing subtitle patchset, GStreamer and Rust subtitle wrappers. The search does not establish the absence of a certified composition engine.
- PauseProof: “2026 FPGA preemption formal checkpoint state capture EPOCH”; “2026 FPGA preemption StateMover”; “FPGA checkpoint Yosys”. The 2026 hardware/software migration paper and EPOCH are direct collisions. Formal RTL-repair and netlist-to-RTL agent work also surfaced, so a generic proof-guided hardware agent is not an opening: [formal RTL repair, July 2026](https://arxiv.org/abs/2607.28877), [Netlist2RTL](https://github.com/hdsinghbrar/Netlist2RTL).
- Discovery sweeps also used “site:news.ycombinator.com 2026 MiSo collision detection” and “site:x.com 2026 FPGA preemption EPOCH”. They produced adjacent discussions and unrelated name matches rather than a reliable competitor inventory. No technical claim here relies on HN commentary or automatically generated X summaries. No result from these searches is evidence of absence.

**F/I — Coverage limitation:** this report does not claim exhaustive coverage of every conference named in the assignment or every listed project's tracker. The concrete ledger is strongest in graphics, USENIX networking, database integration, FPGA state handling, scientific portability, LLVM/Wasmtime/Zig/Godot and FFmpeg. Searches for literal effort language in Mesa and Firefox produced insufficiently strong primary-source seeds; I did not fill the ledger with invented quotations or unrelated browser UI requests.

**I — What the hunt changed:** the valuable pattern is a large, finite cross-product with a smaller independent semantics: shape × trajectory, cue family × media operation, circuit state pattern × interruption. The source must establish the expensive repeated work, and the prototype must establish that checking it is cheaper. A future-work paragraph, old issue age, passing tests or a model-generated proof claim cannot substitute for those two demonstrations.

## 5. Ranked candidates

All ratings are **E**, from 1–5; higher is better. **Open** measures how much defensible residual space remains after the cited prior art, not confidence that nobody else is building it.

| Rank | Candidate | Tail | Cool | Value | Open | Solo | Demo | Decision / decisive kill |
|---|---|---:|---:|---:|---:|---:|---:|---|
| 1 | ContactForge | 5 | 5 | 4 | 3 | 3 | 5 | **Run a two-day baseline test.** Kill if it is MiSo packaging or lacks reusable, cheaply checked speedups. |
| 2 | CaptionCircuit | 4 | 4 | 4 | 2 | 3 | 5 | **Conditional.** Kill if GStreamer or the existing subtitle patchset already passes the hard live traces. |
| 3 | PauseProof | 4 | 5 | 4 | 2 | 2 | 5 | **Hold behind a three-day prior-art/proof test.** Kill if generic instrumentation already works or each circuit needs a bespoke proof. |

**TL;DR — I:** ContactForge is the pick: a curved-geometry collision engine that retains independently checked algorithm families.
**TL;DR — F/I:** Most attractive networking/database/HPC seeds already collide with existing work or the earlier exclusions; old issue age is weak evidence.
**TL;DR — E:** Spend two days proving a residual gap against MiSo/IPC before building; CaptionCircuit and PauseProof remain conditional, not recommendations to start three projects.
