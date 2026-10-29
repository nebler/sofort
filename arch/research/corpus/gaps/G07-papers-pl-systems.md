# G07 — Paper seeds: programming languages, verification, compilers, systems and security

**Research and recovery date: 2026-10-29.** Briefs: [gap analysis](../BRIEF-gaps.md) and [tailwind filter](../BRIEF-tailwind.md). This is a recovery of the interrupted G07 research, not a new development round for existing finalists. Only this report was written; no implementation, benchmark or commit was made.

**I — Result.** The strongest original lead, **Seedless**, is the same project family as [G01’s Thompson’s Mirror](G01-oracles-software.md). Merge its paper evidence and trust-boundary corrections into that idea conceptually; do not count it as a second discovery or develop another competing project here. **Tilework** has a real instruction-coverage backlog but closely overlaps Elevator and existing semantics projects. **Rebuild Doctor** has direct agent prior art and [G04 overlap](G04-security.md), so its broad pitch is dropped. There is no unconditional new project recommendation from this recovery.

**F — Coverage and provenance.** The ledger contains **43 unique paper entries: 41 with a 2025–26 publication or preprint, plus two explicitly historical references** (Camlboot 2022 and the Arch paper published in 2024). Each has one checked short quotation: 40 complete sentences or sentence groups and 3 explicitly marked exact excerpts. Long saved quotations were shortened rather than presented as full sentences. Every retained quotation was matched against the saved primary PDF/HTML text, allowing whitespace, line-break hyphenation, typographic apostrophes and PDF ligature normalisation; PDF page numbers below count from the opening page, including proceedings cover pages.

**F — Recovery method.** Read all ten surviving draft parts, including the search audit and intermediate seed notes. Reused the two surviving ledgers, recovered nine compiler/runtime entries from the already downloaded evidence because that ledger section was absent, and incorporated the later GHC/Resid prior-art corrections instead of repeating the earlier incompatible claims. The original claim of about 200 downloaded papers is not treated as a claim that this continuation read every paper. Headline primary pages and current project repositories were rechecked; searches and limits are recorded in §4. Local evidence identifiers below are relative to `/Users/noah/.t3/scratch/2026-10-28-here-are-the-absolute-paths-a63c3f1b/g07/`.

**Labels:** **Q** exact quotation; **F** sourced fact or author-reported measurement; **I** inference/proposal; **E** estimate. **A** promising labour backlog with a plausible external check; **B** weaker oracle, substantive research or uncertain value; **X** occupied, excluded or already addressed. An A is not a novelty or correctness certificate. The source cited directly above each Q/F block supports that paper’s explanation; the oracle extensions labelled I are proposals, not reported results.

**I — Reading the seeds.** A limitation is a useful lead when a named capability is missing, implementation can accumulate, and an independent check can reject wrong additions. A future-work paragraph proves only what that paper did not attempt. A passing test, a formal proof, a reproducible build and diverse double-compiling establish different things; this report keeps those claims separate.

## 1. Checked seed ledger

### 1.1 Verification and proof engineering

**P01 — Rust’s standard library: manual proofs plateau; generics are skipped (A, owned).**
Cook, Delmas, … Tautschnig, Val, Zech, *Verifying the Rust Standard Library*, NFM 2026 (LNCS 16622). [arXiv 2606.17374](https://arxiv.org/abs/2606.17374)
- **Q:** “This plateau illustrates a fundamental scalability limitation: manual proof engineering alone cannot reach the tens of thousands of functions in the standard library.” (PDF p. 5; local evidence: `dl/ruststd/raw`.)
- **F — Plain:** Amazon and the Rust Foundation coordinate a public verification campaign for Rust’s standard library. Autoharness generated 16,748 harnesses, 11,970 discharged the supported undefined-behaviour checks, and 989 functions across automatic and manual work were checked against function contracts; this is partial coverage, not proof that the entire library is correct.
- **I — Gap → check → limit:** Contract-writing labour and tool limitations coexist: 9,635 generic functions are skipped by automatic generation. Kani, VeriFast, Verus and Flux provide checks under their respective models; specifications and assumptions still need review. Active owner: contribution opportunity, not an unoccupied project.

**P02 — Lean's SMT bridge replays only 30% of the solver's step types (A, owned).**
Mohamed, Mascarenhas, Khan, Barbosa, Reynolds, Qian, Tinelli, Barrett, *Lean-SMT: An SMT tactic for discharging proof goals in Lean*, CAV 2025. [arXiv 2505.15796](https://arxiv.org/abs/2505.15796)
- **Q:** “lean-smt supports around 200 of these proof rules, which amounts to approximately 30%.” (PDF p. 6; local evidence: `dl/leansmt/raw`.)
- **F — Plain:** An automatic solver, cvc5, finds a proof and Lean-SMT reconstructs it as Lean proof terms. The paper reports support for about 200 of more than 662 rule types, leaving substantial reconstruction work.
- **I — Gap → check → limit:** The Lean kernel checks the reconstructed theorem, assuming sound kernel implementation and appropriate axioms. Missing rules are not necessarily one independent theorem each: some require theory infrastructure. This has an existing owner.

**P03 — C specification testing: the remaining gaps are "straightforward engineering" (A).**
Banerjee, Memarian, Makwana, Pulte, Krishnaswami, Sewell, *Fulminate: Testing CN Separation-Logic Specifications in C*, POPL 2025. [PDF](https://www.cl.cam.ac.uk/~pes20/cn-testing-popl2025.pdf)
- **Q:** “Many of these are straightforward engineering, with a few more substantial.” (PDF p. 28; local evidence: `dl/fulminate/raw`.)
- **F — Plain:** CN expresses ownership and memory conditions for C; Fulminate turns those specifications into runtime checks. The paper applies it to pKVM allocator code and lists unsupported CN/C features, including unions and some control-flow and multi-file cases.
- **I — Gap → check → limit:** A genuine implementation backlog, but runtime testing does not prove all executions. Keep the CN specification and reference C semantics separate from the agent’s implementation.

**P04 — Every new Rust analysis tool pays a compiler tax (B).**
Ho, Boisseau, Franceschino, Prak, Fromherz, Protzenko, *Charon: An Analysis Framework for Rust*, CAV 2025. [arXiv 2410.18042](https://arxiv.org/abs/2410.18042)
- **Q:** “The effort to write this whole project spanned 2 person-years.” (PDF p. 10; local evidence: `dl/charon/raw`.)
- **F — Plain:** Charon translates Rust compiler representations into a form that program-analysis tools can consume. Aeneas uses it on the route from Rust to proof assistants; the paper documents the substantial engineering cost of that interface.
- **I — Gap → check → limit:** Useful shared infrastructure, already built. Downstream proofs help check consumers’ properties but do not automatically prove Charon’s translation correct.

**P05 — Intel TDX: 22 of 108 entry points studied, not fully verified (B, owned).**
Beyer et al., *A Case Study in Firmware Verification: Applying Formal Methods to Intel TDX Module*, TACAS 2026. [PDF](https://www.sosy-lab.org/research/pub/2026-TACAS.A_Case_Study_in_Firmware_Verification_Applying_Formal_Methods_to_Intel_TDX_Module.pdf)
- **Q:** “The total human effort for this case study was approximately ten to twelve person-months.” (PDF p. 4; local evidence: `dl/tdx-tacas26/raw`.)
- **F — Plain:** The Intel TDX Module is firmware supporting confidential virtual machines. The study constructs 418 verification tasks from 22 of its 108 host/guest entry points and compares six analysis tools; that is a study scope, not 22 fully proved interfaces.
- **I — Gap → check → limit:** Harnesses, assumptions and slicing take labour. Multiple tools, reachability checks and deliberately changed examples could expose bad harnesses, but shared assumptions can still make all tools agree incorrectly. Active team; contribution-shaped.

**P06 — Atmosphere: verified kernel, unverified drivers (B, flag: generic proofs).**
Chen et al., *Atmosphere: Practical Verified Kernels with Rust and Verus*, SOSP 2025. [PDF](https://mars-research.github.io/doc/2025-sosp-atmo.pdf)
- **Q — exact excerpt:** “I/O intensive shared device drivers will require proof about concurrent code, which we leave as future work” (PDF p. 9; local evidence: `dl/sosp25-atmosphere/raw`.)
- **F — Plain:** Atmosphere uses Rust and Verus to verify specified properties of a microkernel, with development and verification reported below 2.5 person-years. Drivers and roughly 3,000 lines of hardware-interface setup remain in the trusted base.
- **I — Gap → check → limit:** The concurrency gap is substantive, not simply a queue of routine proofs. Kernel-growing is excluded by the brief, and generic proof automation overlaps existing work.

**P07 — A production allocator makes full proof expensive (B, research-heavy).**
Wang et al., *jwmalloc: A Verified Memory Allocator for Mobile Devices*, OSDI 2026. [PDF](https://www.usenix.org/system/files/osdi26-wang-jiawei.pdf)
- **Q:** “Traditional approaches based on manual, machine-checked proofs (e.g., large Coq developments [84]) are prohibitively labor-intensive for a production allocator of this complexity.” (PDF p. 11; local evidence: `dl/osdi26-wang-jiawei/raw`.)
- **F — Plain:** jwmalloc is a production mobile allocator reported deployed on 12 million devices. The paper uses bounded formal verification to check selected executions and properties rather than claiming a complete unbounded proof.
- **I — Gap → check → limit:** Labour plus weak-memory reasoning and tooling limits. A bounded checker is an oracle for the encoded bounds and model, not every concurrent execution.

**P08 — One Ethernet-driver proof cost three person-months (B, flag: language port).**
Zhao et al., *Verifying Device Drivers with Pancake*, arXiv Jan/May 2025. [arXiv 2501.08249](https://arxiv.org/abs/2501.08249)
- **Q:** “The verification of our Ethernet driver took around three person-months.” (PDF p. 2; local evidence: `dl/pancake-2501/raw`.)
- **F — Plain:** Pancake is a systems language with a verified compiler. The authors port an Ethernet driver from C and verify driver properties for the seL4-based LionsOS setting, showing that driver proof work can be concrete and bounded.
- **I — Gap → check → limit:** The specification, hardware model and compiler theorem define the claim. Further drivers are a backlog, but driver/OS growth is excluded or adjacent to GrowOS.

**P09 — Model-checking a Rust kernel's concurrency: 4 person-months for 4,000 lines (B).**
Tang et al., *Converos: Practical Model Checking for Verifying Rust OS Kernel Concurrency*, USENIX ATC 2025. [PDF](https://www.usenix.org/system/files/atc25-tang.pdf)
- **Q:** “When discrepancies are found during conformance checking, developers manually revise the specification or code.” (PDF p. 6; local evidence: `dl/atc25-tang/raw`.)
- **F — Plain:** Converos compares Rust kernel executions with TLA+ models of concurrency modules. Its study covers about 4,000 lines in 12 Asterinas modules and reports 20 bugs; model and test construction remain manual.
- **I — Gap → check → limit:** Trace conformance checks the model/code relationship on observed executions. It does not establish that an agent-written model captures the intended operating-system behaviour.

**P10 — The LFI formal case study covers Arm64 (A).**
Sotoudeh et al., *Automated Formal Verification of a Software Fault Isolation System*, FMCAD 2025. [arXiv 2508.15898](https://arxiv.org/abs/2508.15898)
- **Q:** “It would be interesting to produce a fully verified SFI system for x86-64 or RISC-V.” (PDF p. 4; local evidence: `dl/lfiverif/raw`.)
- **F — Plain:** LFI confines untrusted native code using a checker over machine instructions. This paper verifies an ARM64 software-fault-isolation design and discusses extension to other architectures.
- **I — Gap → check → limit:** A defined invariant and trusted ISA semantics offer a strong conditional oracle. The authors expect RISC-V to fit the strategy; that expectation is not evidence that x86 extension is routine.

**P11 — Verified certificate validation: features and policies still missing (B, flag: exec-spec).**
Lin et al., *Towards Practical, End-to-End Formally Verified X.509 Certificate Validators with Verdict*, USENIX Security 2025. [PDF](https://www.usenix.org/system/files/usenixsecurity25-lin-zhengyao.pdf)
- **Q:** “A few tests require features that Verdict does not yet support, e.g., unsupported signature schemes of DSA, ECDSA P-192, and ECDSA with SHA-1.” (PDF p. 12; local evidence: `dl/verdict/raw`.)
- **F — Plain:** Verdict implements certificate-validation policies in Rust and verifies them with Verus. Differential tests compare it with Chrome, Firefox and OpenSSL, reporting 99.3–99.9% agreement on the Limbo corpus.
- **I — Gap → check → limit:** There is a concrete feature backlog. Policy equivalence, RFC compliance and cryptographic correctness are different claims; agreement with implementations does not settle all three.

### 1.2 Compilers, runtimes and instruction semantics

**R01 — TPDE leaves a concrete control-flow case unsupported (A, owned).**
Schwarz, Kamm and Engelke, *TPDE: A Fast Adaptable Compiler Back-End Framework*, preprint 2025; CGO 2026. [Paper](https://arxiv.org/abs/2505.22610), [author publication list](https://aengelke.net/pubs.html).
- **Q:** “TPDE currently does not support such multi-edges, but support could be added with reasonable effort.” (PDF p. 4; local evidence: `dl/tpde/raw`.)
- **F — Plain:** TPDE generates machine code quickly from existing compiler representations instead of forcing another intermediate-language conversion. Block-argument control-flow graphs can have multiple edges between the same blocks carrying different values; the paper names that unsupported case.
- **I — Gap → check → limit:** A bounded backend feature, checked through differential execution and structural compiler tests. Useful upstream work, with an active implementation and no independent new-project claim.

**R02 — MLIR semantics have an engineering tax, and a framework already addresses it (X, owned).**
Fehr, Fan, Pompougnac, Regehr and Grosser, *First-Class Verification Dialects for MLIR*, PLDI 2025, PACMPL 9, article 206. [DOI](https://doi.org/10.1145/3729309).
- **Q:** “A major limitation of MLIR is that it is syntax-focused: it has no support for directly encoding the semantics of operations in its dialects.” (PDF p. 1; local evidence: `dl/mlirverif/raw`.)
- **F — Plain:** MLIR lets compiler projects define new intermediate languages, but syntax alone does not say what their operations mean. This PLDI paper introduces dialects for expressing semantics and derives verification and analysis tools from them.
- **I — Gap → check → limit:** The introductory problem is partly addressed by the paper itself. More dialect semantics could be grown, but the formal meaning and translation must be reviewed; this is prior art for the structure, not a vacant proposal.

**R03 — CertiCoq-Wasm leaves verified optimisations open (B, proof-family overlap).**
Meier, Jensen, Pichon-Pharabod and Spitters, *CertiCoq-Wasm: A Verified WebAssembly Backend for CertiCoq*, CPP 2025. [DOI](https://doi.org/10.1145/3703595.3705879).
- **Q:** “A verified CSE optimisation on CertiCoq’s middle-end and verified Wasm optimisations such as local coalescing are left as future work.” (PDF p. 9; local evidence: `dl/certicoqwasm/raw`.)
- **F — Plain:** CertiCoq-Wasm compiles an intermediate representation from the Rocq/Coq ecosystem to WebAssembly with a machine-checked backend proof. Some performance work still uses wasm-opt, and verified common-subexpression elimination and local-variable coalescing are left open.
- **I — Gap → check → limit:** Rocq can check the optimisation theorem for the specified intermediate languages. The paper explicitly distinguishes backend correctness from a complete end-to-end CertiCoq theorem; generic proof-growing overlaps the prior finalists.

**R04 — AArch64 translation validation has explicit scope boundaries (B, owned).**
Berger et al., *Translation Validation for LLVM’s AArch64 Backend*, OOPSLA 2025, PACMPL 9, article 369. [DOI](https://doi.org/10.1145/3763147).
- **Q:** “arm-tv focuses on sequential user-mode code.” (PDF p. 17; local evidence: `dl/armtv/raw`.)
- **F — Plain:** arm-tv checks whether LLVM’s generated AArch64 machine code implements the input LLVM program. It compares mechanically derived and handwritten instruction semantics and explicitly excludes concurrency, privileged code and several calling-convention and floating-point cases.
- **I — Gap → check → limit:** Translation validation can reject bad candidate translations under its model. Extending beyond sequential user-mode code requires stronger semantics as well as instruction coverage; not all exclusions are mechanical labour.

**R05 — Synthesised instruction selection omits atomic and special memory operations (A, owned).**
Drescher and Engelke, *Synthesizing Instruction Selection Back-Ends from ISA Specifications Made Practical*, CGO 2026. [Author PDF](https://aengelke.net/pubs/2602-cgo2.pdf), [publication](https://doi.org/10.1109/CGO68049.2026.11395203).
- **Q:** “Additionally, atomic operations and specifically aligned memory accesses are currently not included.” (PDF p. 7; local evidence: `dl/iselsyn/raw`.)
- **F — Plain:** This work synthesises instruction-selection rules from formal ISA descriptions and integrates them into LLVM for AArch64 and RISC-V. It gets near the existing backend’s benchmark performance but leaves atomic and certain memory operations outside the supported model.
- **I — Gap → check → limit:** An SMT equivalence check supplies a conditional oracle for generated rules. Memory ordering needs an adequate model; a funded or owned synthesis pipeline already occupies the broad idea.

**R06 — MirrorBall’s fully static translation still has program-class exclusions (B, close prior art).**
Huang et al., *No Bit Left Behind: Using Brute-Force Lifting to Achieve Fully Static Binary Recompilation and Cross-Compilation of Arbitrary Binary Executables*, preprint, September 2026. [Paper](https://arxiv.org/abs/2609.16423).
- **Q:** “Three further classes of binary input are excluded from the prototype but are possible extensions rather than fundamental limitations.” (PDF p. 18; local evidence: `dl/nobitleft/raw`.)
- **F — Plain:** MirrorBall lifts ambiguous binary code into LLVM IR by retaining multiple possible interpretations. This September 2026 paper shares the superset-disassembly direction of Elevator, while its prototype excludes several important classes of real programs.
- **I — Gap → check → limit:** This strengthens the evidence that static translation has concrete missing capability. It also adds close prior art: multithreading and exception unwinding are whole-program problems that instruction tiles alone cannot solve.

**R07 — Managed-library linking for Wasm lacks reverse callbacks (B, owned).**
Jiang, Zeng, Zhou and Lyu, *Bringing Managed Language Support to WebAssembly with External Library Linking*, FSE 2026. [Paper](https://arxiv.org/abs/2606.21919).
- **Q:** “WALL-E currently supports invoking external libraries initiated from Wasm programs, but it does not support callbacks from external runtimes back into Wasm.” (PDF p. 18; local evidence: `dl/wasmmanaged/raw`.)
- **F — Plain:** WALL-E links WebAssembly programs to libraries hosted in external managed-language runtimes. It avoids recompiling every runtime into WebAssembly, but calls currently travel outward without callbacks into the Wasm program.
- **I — Gap → check → limit:** A reference runtime and callback tests can check examples. Re-entrancy, object lifetimes and isolation policies remain design work; the paper’s motivation about costly runtime ports is not an untouched solution.

**R08 — RISC-V’s compiler-to-hardware proof bridge stops at case studies (B, research-heavy).**
Kan and Ertel, *Interaction Tree Semantics for RISC-V: Bridging Compiler and Hardware Verification*, preprint 2026, revised August. [Paper](https://arxiv.org/abs/2605.04933v2).
- **Q — exact excerpt:** “proving LLVM lowering correct for general programs, verifying a real-world RISC-V processor implementation against our ISA specification” (PDF p. 17; local evidence: `dl/itreeriscv/raw`.)
- **F — Plain:** The authors express RISC-V instructions in Rocq using interaction trees, a way to describe computation and its external effects. They connect small compiler and hardware case studies through one framework; general LLVM lowering and a complete production processor remain future work.
- **I — Gap → check → limit:** Machine-checked refinement is stronger than passing an ISA test suite, but the proposed next step is research-scale. This corroborates the proof-family work rather than yielding a fresh standalone pitch.

**R09 — RISC-V vector performance still outruns compiler cost models (X, excluded broad family).**
Shi, Gokhale, Lin, Teruel and Peng, *Closer in the Gap: Towards Portable Performance on RISC-V Vector Processors*, preprint 2026. [Paper](https://arxiv.org/abs/2605.10860v2).
- **Q:** “Using the benchmarks, we find that predication overhead and stride load pose performance bottlenecks that current compiler cost models do not yet fully capture.” (PDF p. 1; local evidence: `dl/rvvgap/raw`.)
- **F — Plain:** This study measures RISC-V vector code on actual hardware and compares GCC 15 with Clang 21 on six applications. Handwritten vector intrinsics can reduce instruction counts without reliably producing the expected speedup, exposing gaps in compiler cost models.
- **I — Gap → check → limit:** Hardware measures performance, while separate semantic checks must guard correctness. This is platform-dependent optimisation and overlaps the rejected broad performance-portability/atlas family, so it is evidence only.

### 1.3 Operating systems and systems software

**S01 — Ichnaea: emulating every x86 instruction is "huge engineering effort" (A).**
Haque et al., *Ichnaea: A Framework for Precise Tracking of Memory Objects*, OSDI 2026. [PDF](https://www.usenix.org/system/files/osdi26-haque.pdf)
- **Q:** “Also note that emulating all the instructions on x86 is huge engineering effort.” (PDF p. 8; local evidence: `dl/osdi26-haque/raw`.)
- **F — Plain:** Ichnaea tracks accesses to individual memory objects by write-protecting them, trapping faults and emulating the instruction that touched them. Unsupported instructions use a slower path that executes the instruction on the CPU.
- **I — Gap → check → limit:** A direct labour bottleneck with a practical differential oracle: compare emulated and native register, flag and memory effects. CPU families, exceptional cases and undefined behaviour bound what a test establishes.

**S02 — UCSAN: inline assembly is modelled by hand (A).**
Yin et al., *A Compilation-based Under-Constrained Execution Engine*, OSDI 2026. [PDF](https://www.usenix.org/system/files/osdi26-yin.pdf)
- **Q:** “Manually modeling every inline assembly instruction is highly case-specific and labor-intensive. It is therefore out of scope for this prototype.” (PDF p. 8; local evidence: `dl/osdi26-yin/raw`.)
- **F — Plain:** UCSAN explores isolated functions under incomplete calling-context information to look for bugs. Inline assembly needs a model that the execution engine understands, and complicated snippets still need custom wrappers.
- **I — Gap → check → limit:** Native execution can check concrete wrapper behaviour, with virtual machines for privileged instructions. That does not by itself prove that a symbolic summary covers every possible state.

**S03 — DeCl: the deterministic instruction set stops at integers (B).**
Yedidia et al., *Deterministic Client: Enforcing Determinism on Untrusted Machine Code*, OSDI 2025. [PDF](https://www.usenix.org/system/files/osdi25-yedidia.pdf)
- **Q:** “We restrict our analysis to the integer subsets of x86-64 and Arm64, including SIMD but not including floating point.” (PDF p. 4; local evidence: `dl/osdi25-yedidia/raw`.)
- **F — Plain:** DeCl validates untrusted machine code so execution remains deterministic. The paper excludes floating point because some permitted instructions can produce hardware-dependent results, while suggesting that a carefully selected subset could be admitted.
- **I — Gap → check → limit:** Multiple CPUs provide counterexamples to a determinism claim; agreement on sampled machines is not proof for every conforming or future CPU. Some work is semantic design rather than missing emulation code.

**S04 — eBPF verifier fuzzing: 50 of 455 kernel helpers specified (A).**
Lyu et al., *eBPF Misbehavior Detection: Fuzzing with a Specification-Based Oracle*, SOSP 2025. [PDF](https://cs.uwaterloo.ca/~m285xu/assets/publication/ebpf_smt_fuzz-paper.pdf)
- **Q:** “The remaining gap is in kernel helpers, where we deliberately focus on the 50 most frequently used of 455 functions (≈ 11%).” (PDF p. 10; local evidence: `dl/sosp25-veritas/raw`.)
- **F — Plain:** Veritas judges eBPF-verifier behaviour using instruction and helper specifications and reports 13 bugs. Its helper model covers 50 of 455 functions, so helper coverage is a clear limit on the supported programs.
- **I — Gap → check → limit:** The authors explicitly explore automation of specification writing. Real-kernel tests and old bug cases can challenge specifications, but copying implementation behaviour does not establish that a safety policy is right.

**S05 — Linux scheduler: 232 bugs studied, 7 reproduced (B).**
Cao et al., *kSTEP: Characterization and Deterministic Testing of Linux CPU Scheduler Bugs*, OSDI 2026. [PDF](https://www.usenix.org/system/files/osdi26-cao.pdf)
- **Q:** “Existing scheduler tests leave most behavior untouched.” (PDF p. 4; local evidence: `dl/osdi26-cao/raw`.)
- **F — Plain:** kSTEP runs Linux scheduler scenarios deterministically, making bugs easier to reproduce. The authors study 232 bug-fix commits, demonstrate seven historical bugs and find four new ones; they also propose scheduler-testing agents.
- **I — Gap → check → limit:** Fail-before/pass-after on pinned commits is a useful check for regression reproducers. A fix may alter many behaviours, so this does not prove the reproducer isolates the intended bug; the broad testing project is owned and Jepsen-shaped.

**S06 — Tock: hardware-support infrastructure needs dedicated engineering (B).**
Schuermann et al., *Tock: From Research To Securing 10 Million Computers*, SOSP 2025. [arXiv 2603.22585](https://arxiv.org/abs/2603.22585)
- **Q:** “While an automated hardware testing framework was a clear solution, the process of creating it was an enormous engineering effort without clear research questions.” (PDF p. 11; local evidence: `dl/sosp25-tock10m/raw`.)
- **F — Plain:** Tock is a Rust operating system deployed in security-sensitive hardware. The paper describes tedious register-definition work and an automated hardware-testing framework eventually built by a contracted engineer after a long unmet need.
- **I — Gap → check → limit:** Vendor register descriptions and real-board tests are useful cross-checks but can themselves be incomplete. Further register and driver growth is adjacent to excluded GrowOS work.

**S07 — pKVM: device and interrupt paths lie outside this specification (B, exec-spec flag).**
Memarian et al., *Ghost in the Android Shell: Pragmatic Test-oracle Specification of a Production Hypervisor*, SOSP 2025. [PDF](https://www.cl.cam.ac.uk/~pes20/Stuff/exec-spec-paper.pdf)
- **Q:** “We do not cover aspects of pKVM dealing with providing VMs with access to devices, nor for its management of the Arm GIC or IOMMU.” (PDF p. 3; local evidence: `dl/sosp25-ghost/raw`.)
- **F — Plain:** The authors write an executable specification of Android’s pKVM hypervisor and compare it with implementation executions. It cost roughly one person-year and leaves device access, interrupts and IOMMU management outside the model.
- **I — Gap → check → limit:** The missing part needs an independently justified specification, not only more code. Rejected executable-spec families apply; historical bugs and varied hardware models could test an extension’s usefulness.

**S08 — EMT: Linux memory management refactored except for IOMMU and VMs (B).**
Chai et al., *EMT: An OS Framework for New Memory Translation Architectures*, OSDI 2025. [PDF](https://www.usenix.org/system/files/osdi25-chai-siyuan.pdf)
- **Q:** “EMT currently only supports the native environment; virtualization support is on the roadmap.” (PDF p. 8; local evidence: `dl/osdi25-chai-siyuan/raw`.)
- **F — Plain:** EMT separates Linux memory-management code from details of a particular address-translation design. The authors report 15 person-months of refactoring; virtualisation and parts of device-memory translation remain future work.
- **I — Gap → check → limit:** Kernel self-tests and differential workloads supply regression evidence, not a full behaviour-preservation proof. Broad OS capability growth is excluded.

### 1.4 Defensive security and software supply chains

**C01 — Elevator: additional instruction support remains engineering work (A).**
Chen et al., *Deterministic Fully-Static Whole-Binary Translation without Heuristics*, arXiv May 2026. [arXiv 2605.08419](https://arxiv.org/abs/2605.08419)
- **Q:** “We hand-craft the translation for each category.” (PDF p. 8; local evidence: `dl/elevator/raw`.)
- **F — Plain:** Elevator translates an x86-64 executable into an AArch64 executable ahead of time using small instruction tiles. It tests each supported instruction with over 100,000 native-hardware inputs and compares translated benchmark outputs; extra instruction coverage remains engineering work.
- **I — Gap → check → limit:** This is strong evidence for a missing-capability queue, and also the closest implementation of Tilework. Tiles do not settle ABI bridging, concurrency, exceptions or code expansion; tests are not a universal translation proof.

**C02 — Breaking Bad: compiler transformations can defeat constant-time code (B).**
Schneider et al., *Breaking Bad: How Compilers Break Constant-Time Implementations*, ACM AsiaCCS 2025. [arXiv 2410.13489](https://arxiv.org/abs/2410.13489)
- **Q:** “However, this approach requires manual analysis for each architecture and thus needs a high level of effort and expertise for every supported architecture.” (PDF p. 3; local evidence: `dl/breakingbad/raw`.)
- **F — Plain:** The authors compile eight cryptographic libraries for six architectures and find that compiler transformations can reintroduce secret-dependent behaviour. Defensive source-code patterns therefore do not automatically survive compilation.
- **I — Gap → check → limit:** Binary-level constant-time analysis needs fixed secret/public input boundaries and a leakage model; known-answer tests check functionality separately. This is already active verification and audit territory.

**C03 — Fun with flags: finding the guilty compiler passes is manual (B).**
Geimer, Maurice, *Fun with flags: How Compilers Break and Fix Constant-Time Code*, arXiv Jul 2025. [arXiv 2507.06112](https://arxiv.org/abs/2507.06112)
- **Q — exact excerpt:** “the analysis requires a substantial amount of manual effort to identify problematic optimization passes, and does not guarantee completeness” (PDF p. 9; local evidence: `dl/funflags/raw`.)
- **F — Plain:** This paper traces constant-time failures to compiler optimisation passes and tests flag changes that prevent observed regressions. It shows why identifying a troublesome pass is useful but does not eliminate unobserved pass interactions.
- **I — Gap → check → limit:** A pass-diagnosis and repair loop needs binary leakage checks and functional tests for every compiler version. It is a narrow audit workflow with research competition, not an automatic guarantee.

**C04 — Post-quantum signatures: timing-leak tooling is "tedious work" per scheme (B).**
Adjonyo et al., *Systematic Timing Leakage Analysis of NIST PQDSS Candidates: Tooling and Lessons Learned*, arXiv Sep 2025 (NIST PQC conference). [arXiv 2509.04010](https://arxiv.org/abs/2509.04010)
- **Q:** “Since manual binary analysis is extremely challenging, automated analysis becomes highly important.” (PDF p. 1; local evidence: `dl/pqdss/raw`.)
- **F — Plain:** The study applies four timing-leak tools to 302 builds of 15 post-quantum signature candidates and reports 26 issues. Preparing correct per-scheme builds and harnesses is a major practical burden, including the risk of analysing the wrong variant.
- **I — Gap → check → limit:** The harness must bind to the intended cryptographic scheme and configuration. Timing experiments are statistical evidence; a clean run does not prove the absence of leakage.

**C05 — Triosecuris: the authors leave a real compiler implementation open (B).**
Baumann et al., *Triosecuris: Formally Verified Protection Against Speculative Control-Flow Hijacking*, IEEE CSF 2026. [arXiv 2601.22978](https://arxiv.org/abs/2601.22978)
- **Q:** “We have not implemented these ideas in a real compiler like LLVM.” (PDF p. 2; local evidence: `dl/s7x_trio/raw`.)
- **F — Plain:** Triosecuris proves a defence against specified speculative control-flow attacks in small model languages using Rocq. The authors leave a real compiler implementation and an empirical overhead evaluation open.
- **I — Gap → check → limit:** A verified model is not a verified LLVM implementation. Translation validation and hardware experiments could help, but connecting the production machine behaviour to the model is a substantial open obligation.

**C06 — Ruby on CHERI: 4,429 failing tests, no JIT, no FFI (B).**
Liu et al., *Pitfalls in VM Implementation on CHERI: Lessons from Porting CRuby*, arXiv Mar 2026 (*Programming* journal). [arXiv 2603.05645](https://arxiv.org/abs/2603.05645)
- **Q:** “We have not ported JIT compilers and the foreign function interface (FFI) for CRuby.” (PDF p. 6; local evidence: `dl/cheriruby/raw`.)
- **F — Plain:** CHERI adds hardware-enforced authority and bounds to pointers. The CRuby port runs on emulated CHERI-RISC-V, but its main test suite still has 4,429 failures, alongside smaller-suite gaps, and the JIT and FFI remain unsupported.
- **I — Gap → check → limit:** The suite and capability faults give practical feedback. Passing tests does not prove isolation or tight object bounds; a general memory-safety port would re-enter the rejected Fil-C family.

**C07 — Compartmentalisation is still done by hand (B).**
Lefeuvre et al., *SoK: Software Compartmentalization*, IEEE S&P 2025. [arXiv 2410.08434](https://arxiv.org/abs/2410.08434)
- **Q:** “Among others, our findings reveal that mainstream efforts largely rely on manual methods, custom abstractions, and legacy mechanisms, poles apart from recent research.” (PDF p. 1; local evidence: `dl/sokcomp/raw`.)
- **F — Plain:** This survey reviews methods for splitting programs into isolated compartments so one faulty component has less authority. It finds that manual boundary design is expensive and deployed examples often use coarse partitions.
- **I — Gap → check → limit:** Functional tests can show that a split still runs, but they do not establish that the authority boundaries meet a defensible security policy. The missing independent policy oracle is decisive.

**C08 — Firmware emulation: each new peripheral kind requires emulator-scale work (B, hardware flag).**
Lei et al., *FlexEmu: Towards Flexible MCU Peripheral Emulation*, ACM CCS 2025. [arXiv 2509.07615](https://arxiv.org/abs/2509.07615)
- **Q:** “Second, supporting a new kind of peripheral in FlexEmu requires approximately the same engineering effort as developing a dedicated peripheral emulator.” (PDF p. 11; local evidence: `dl/flexemu/raw`.)
- **F — Plain:** FlexEmu builds software models of microcontroller peripherals so firmware can be tested without the original chip. It demonstrates reusable modelling machinery while acknowledging that genuinely new peripheral kinds still require emulator-scale work.
- **I — Gap → check → limit:** Real-device traces are useful evidence, but this falls into the rejected driver/hardware-trace family. A follow-up on reactive peripheral models already explores LLM assistance: [paper](https://arxiv.org/abs/2608.29737).

**C09 — Static analysers' library models are "tedious and potentially unsound" (X, taken).**
Kishor et al. (AWS), *Soundness Checking of Taint Flow Models*, arXiv Sep 2026. [arXiv 2609.28750](https://arxiv.org/abs/2609.28750)
- **Q:** “However, manually and precisely modeling a method’s taint flows is tedious and potentially unsound.” (PDF p. 1; local evidence: `dl/taintsound/raw`.)
- **F — Plain:** Taint analysers need summaries describing how library calls move potentially sensitive or untrusted data. This AWS paper combines LLM-generated Go summaries with symbolic soundness checks and reports success for 93% of the methods in its evaluated coverage.
- **I — Gap → check → limit:** The result is relative to the checker’s language and execution model. This is direct prior art for an agent proposer plus independent checker and an existing team’s project.

**C10 — Proven Rust crypto: proofs must be updated as code changes (X, taken).**
Ho et al., *Scaling Verification of Cryptographic Software with Aeneas, Rust, and Lean*, arXiv Sep 2026. [arXiv 2609.15648](https://arxiv.org/abs/2609.15648)
- **Q:** “Moreover, integrating and maintaining verified code in production remains challenging as code evolves continuously and forces frequent and tedious updates to the proofs.” (PDF p. 1; local evidence: `dl/aeneas/raw`.)
- **F — Plain:** This work uses Rust, Aeneas and Lean to scale proofs for Microsoft’s SymCrypt cryptographic code. It reports substantial AI assistance while emphasising ongoing proof maintenance as production implementations change.
- **I — Gap → check → limit:** Proof repair is a recurring model-friendly workload. The production owner already develops this pipeline, so broad crypto-proof growth is taken.

**C11 — Reproducible ≠ honest; a tampered seed reproduces itself (A).**
Malka, Sharma, Monperrus, Zacchiroli, Zimmermann, *Trusting-Trust Attack against an Entire Linux Distribution through Binary Manipulation*, SCORED '26. [arXiv 2607.24888](https://arxiv.org/abs/2607.24888)
- **Q:** “It hides inside strip, which the original build and every rebuild trust alike.” (PDF p. 9; local evidence: `dl/trusting/raw`.)
- **F — Plain:** The authors demonstrate a self-propagating modification in a starting strip utility used by a NixOS build. Rebuilding with that shared utility can reproduce the unwanted binary modification despite unchanged source, illustrating a trusted-build-tool gap.
- **I — Gap → check → limit:** Ordinary reproducibility does not establish an honest starting toolchain. Compiler-focused DDC also leaves a shared post-processing utility outside its guarantee unless that utility is trusted or independently checked; see §3.1 for the exact claim.

**C12 — Making packages reproducible is "manual and highly time-consuming" (A).**
Drexel, Hänggi, Méndez Veiga, *Reproducible Builds and Insights from an Independent Verifier for Arch Linux*, Sicherheit 2024 / arXiv May 2025. [arXiv 2505.21642](https://arxiv.org/abs/2505.21642)
- **Q:** “Despite some recent progress in automating these tasks [Re22], achieving R-B remains a manual and highly time-consuming process.” (PDF p. 7; local evidence: `dl/archrepro/raw`.)
- **F — Plain:** The authors independently rebuild Arch Linux packages and investigate mismatches with the published packages. Case studies identify packaging issues and a source-level cause of unreproducibility, showing that each mismatch may need its own diagnosis.
- **I — Gap → check → limit:** Historical background: published at Sicherheit 2024, uploaded to arXiv in May 2025, so not counted as a new 2025–26 paper. Matching bytes establishes equality of the chosen artifacts, not the honesty of their shared dependencies.

**C13 — Java: the remaining normalisers are "purely an engineering task" (A).**
Sharma et al., *Causes and Canonicalization of Unreproducible Builds in Java*, IEEE TSE (arXiv Apr 2025). [arXiv 2504.21679](https://arxiv.org/abs/2504.21679)
- **Q:** “We leave this as future work as it is purely an engineering task.” (PDF p. 10; local evidence: `dl/javarepro/raw`.)
- **F — Plain:** The Java study classifies causes of build differences and develops Chains-Rebuild with canonicalisation. It reports canonicalised matches for 26.6% of 12,803 initially unreproducible Maven artifacts; that result is not strict byte-for-byte reproducibility.
- **I — Gap → check → limit:** The cited future work concerns more canonicalisation cases, including SBOMs and bytecode layout. A normaliser creates an equivalence relation whose information loss must be justified; a negative test set alone does not prove it safe.

**C14 — Python packages: bit-identical rebuilds are "the exception" (B).**
Dietrich, Sun, White, Hassanshahi, *No Snake Oil: Verifying Python Package Builds*, arXiv Jul 2026. [arXiv 2607.21888](https://arxiv.org/abs/2607.21888)
- **Q:** “Strict bitwise reproducibility is therefore the exception rather than the rule for PyPI releases.” (PDF p. 6; local evidence: `dl/nosnakeoil/raw`.)
- **F — Plain:** This paper compares PyPI wheel rebuilds from macaron and OSS Rebuild. Exact published-wheel matches are 15.4% and 19.1% in the measured rebuild sets; its daleq4py normalisation then recognises additional equivalences.
- **I — Gap → check → limit:** Those percentages are sample results, not a universal registry-wide rate. Source-commit mapping and semantic effects of normalisation remain obligations; the research subject is Python packages, but no Python was used for this report.

**C15 — Tailored compiler bootstrapping has a substantial labour cost (A; 2022 background).**
Courant, Lepiller, Scherer, *Debootstrapping without Archeology: Stacked Implementations in Camlboot*, *Programming* 6(3), 2022. [arXiv 2202.09231](https://arxiv.org/abs/2202.09231)
- **Q:** “Debootstrapping becomes interesting once you consider human effort.” (PDF p. 5; local evidence: `dl/camlboot/raw`.)
- **F — Plain:** Camlboot builds OCaml 4.07 through stacked, simpler implementations and performs diverse double-compilation against its bootstrap artifacts. The interpreter is OCaml implemented over a small language compiled through Scheme/C infrastructure, not simply a full OCaml interpreter written in C.
- **I — Gap → check → limit:** Historical exception: 2022, not part of the 2025–26 count. The paper demonstrates one version and an artifact-specific correspondence claim under its trusted-base assumptions; it does not establish current OCaml 5 coverage.

## 2. Patterns that survive the recovery

**I — Instruction coverage is a repeated bottleneck, but the same bottleneck is already being attacked.** Ichnaea (S01), UCSAN (S02), DeCl (S03) and Elevator (C01) independently expose missing machine-instruction support or models. Their needs differ: concrete emulation, symbolic summaries, deterministic execution and static translation are not interchangeable deliverables. R04–R06 add production validation and synthesis work around the same surface. This makes instruction coverage credible; it does not make a new all-x86 project novel.

**F/I — Proof labour is real, and the owners are automating it.** Rust std, TDX, Atmosphere, Pancake and Converos document expensive specifications, harnesses or proofs (P01, P05–P09). [VeruSAGE](https://arxiv.org/abs/2512.18436) reports agents completing proof tasks left unfinished by experts; [SymCrypt/Aeneas](https://arxiv.org/abs/2609.15648) reports AI assistance inside a production verification effort. These support a model tailwind for bounded proof work, while weakening a novelty claim for a generic proof agent. They do not show that specifications can safely be delegated without review.

**F/I — Repository completion is harder than local proof completion.** [Vero](https://arxiv.org/abs/2608.13522) evaluates 43 multi-module instances with predetermined APIs and curated specifications; its strongest evaluated agent fully solves 27. The [Rust-to-Lean experience report](https://arxiv.org/abs/2605.30106) leaves specification design, invariants and mathematical abstraction to human engineers. The builder’s contribution must include those boundaries, a dependency plan and acceptance rules, rather than an editable test file beside editable code.

**I — Byte equality is a sharp predicate with a narrow meaning.** It detects a difference in the selected bytes. It says nothing by itself about whether the reference is desirable, whether both build paths share a compromised utility, or whether a normaliser removed an important difference (C11–C14). DDC adds a specific independently justified build path and a correspondence argument; it is not another name for matching two rebuild hashes.

**F/I — The labour tailwind has a concrete bootstrap example.** [andreabedini/ghc-bootstrap](https://github.com/andreabedini/ghc-bootstrap) reports building GHC 9.14.1 from a C compiler and Hugs source, using Claude for much of the build-and-patch work. The chain is concrete prior art and evidence of feasibility; this report did not execute it. Its GHC fixed-point result is not presented here as a DDC comparison against an official release binary.

**I — Performance, hardware models and security policy remain weaker oracles.** A faster benchmark can be a compiler improvement, measurement noise or a correctness bug (R09). Matching a few peripheral traces need not model unseen states (C08). A functioning compartment split need not enforce a useful authority boundary (C07). These do not pass the brief merely because a loop can be automated.

## 3. Three original leads, developed to a decision

These preserve the draft’s strongest work while applying current prior art and the brief’s exclusions. Proposals below are **I** and schedules/budgets are **E**; none is a completed experiment. They are not three claims of open territory.

### 3.1 Seedless → merge into G01’s Thompson’s Mirror

**Name and one sentence — I.** Grow a small independent implementation just capable of executing a self-hosted compiler’s source, then publish a rerunnable, explicitly scoped source-to-artifact correspondence check.

**Seed — Q/F.** C15 supplies the tailored-bootstrap labour bottleneck and an OCaml 4.07 demonstration; C11 supplies the warning about shared build utilities. Zig’s own [overview, package-maintainer section](https://ziglang.org/learn/overview/#friendly-toward-package-maintainers) explicitly hopes for a third-party Zig interpreter written in C to shorten its bootstrap chain. This replaces the draft’s long secondhand Ziggit quotations with a direct project source.

**Overlap and value — I.** The mechanism, missing independent implementations and DDC oracle are substantively the same as G01’s Thompson’s Mirror. G07 adds a paper trail and a corrected claim boundary; it is not an additional ranked discovery. The value in plain words is to check that a shipped compiler artifact actually follows from the declared source, instead of trusting an opaque compiler seed.

**What grows — I.** A deliberately limited interpreter/compiler, a pinned release recipe, a stage graph and an execution record. The implementation may stop at an unsupported construct and let an agent extend it, but acceptance requires running the complete target build, not accumulating parser features. C is an attractive low-level implementation language; Camlboot’s stacked design shows it is not the only one. The harness, source inputs, comparison target and acceptance logic are controlled outside the proposing agent. Accepted routes rerun without a model.

**The oracle, precisely — F/I.** [Wheeler’s DDC account](https://dwheeler.com/trusting-trust/) distinguishes the suspect compiler executable, its source and the source of its parent compiler. A trusted diverse implementation compiles the **parent source**; that result then compiles the **target source**. The resulting artifact is compared with the suspect target executable under the stipulated deterministic build conditions. For a self-parenting compiler the two source versions can coincide. The initial diverse implementation’s own machine code need not match the suspect compiler.

A DDC match establishes source/executable correspondence **under the method’s assumptions**: the diverse route implements the required semantics, the build executes as assumed, inputs and stage relationships are correct, and trusted supporting tools/environment do not introduce the targeted discrepancy. It does not prove benign source, every language behaviour or an uncompromised operating system/hardware stack. A mismatch can be an ordinary build difference, not evidence of malice. A compiler-focused check that shares an unchecked `strip` leaves exactly the gap in C11.

**Certificate contents — I.** Record source hashes, parent/target versions, stage commands, all generated-file inputs, toolchain/runtime/OS dependencies, comparison scope and result. A comparison of generated C, bytecode or LLVM IR is labelled at that level; it is not a native-executable certificate. Generated source is inspectable, but trusting previously generated C without independently regenerating it can retain a seed dependency. A small bootstrap seed reduces opaque input, not the entire trusted computing base to a few hundred bytes. Reproducibility fixes applied only to a local build cannot certify a different official artifact.

**Independence check — I.** Network isolation and denying the builder access to the expected artifact help prevent trivial copying. They do not establish semantic independence or rule out code hidden in constants; n-gram scans and size caps are heuristics. Review source lineage, generated artifacts and dependencies, use an isolated final evaluator, and document the residual assumptions. Several agents agreeing is not an independence argument.

**Tailwind and one-shot test — I.** Better models can extend the subset implementation and repair release drift faster. The durable output is an executed route and its evidence, not the interpreter text alone. Still, a future agent given one prompt plus tools might build a single-language route: the draft’s assertion that it cannot is unsupported. The cheap counter-test is to let the strongest available agent attempt the same pinned release from scratch with an equal execution budget; if it rapidly reproduces the whole result, only maintenance and trust review remain as differentiation.

**Six-week version and demo — E.** Weeks 1–2 reproduce one existing Camlboot or Resid artifact-level check as calibration, then establish the exact parent/target graph and determinism of one candidate release. Weeks 3–6 attempt **one** new bounded route chosen after that gate, not OCaml 5 plus full Zig plus a Lean/GHC roadmap. Demo a known artifact produced through the independent route, with the stage hashes and trust manifest visible; show a deliberately altered candidate artifact rejected by comparison. Testing an altered artifact checks the comparator, not the whole adversarial threat model. A full Zig or Lean bootstrap in this period is a stretch, not the promised milestone.

**Prior art and remaining gap — F/I.**

- [Camlboot](https://arxiv.org/abs/2202.09231), [mrustc](https://github.com/thepowersgang/mrustc), [Guix’s source bootstrap](https://guix.gnu.org/en/blog/2023/the-full-source-bootstrap-building-from-source-all-the-way-down/), [live-bootstrap](https://github.com/fosslinux/live-bootstrap) and [stagex](https://stagex.tools/) establish substantial existing routes and infrastructure. [DDC4j](https://github.com/chains-project/DDC4j) and [tcc-hardened](https://github.com/chains-project/tcc-hardened) occupy compiler-specific DDC territory.
- [GHC bootstrap](https://github.com/andreabedini/ghc-bootstrap) closes the draft’s GHC-from-source novelty claim. Its README names trusted generated files and configure scripts. That limits its claim; it does not erase the achievement.
- [resid-ddc](https://github.com/larrydewey/resid-ddc) already has an independent Go interpreter producing matching Resid compiler/runtime LLVM IR. Its README explicitly leaves LLVM/native code outside that comparison. This contradicts a broad absence claim for independent subset-interpreter checks; the material inspected does not establish agent involvement in Resid. Its evidence should not be promoted to a native-binary guarantee.
- [FrankenLean](https://github.com/Dicklesworthstone/franken_lean) actively attempts a ground-up Rust Lean toolchain. Its [implementation status](https://github.com/Dicklesworthstone/franken_lean/blob/main/IMPLEMENTATION_STATUS.md), read on 2026-10-29, says the full source-toolchain objective remains incomplete. It is relevant competition, not evidence that an independent current Lean bootstrap already works. Lean’s [own bootstrap document](https://github.com/leanprover/lean4/blob/master/doc/dev/bootstrap.md) describes generated stage0 C and later fixed-point stages; those facts do not establish DDC.

**I — What may remain:** independently justified, release-maintained checks for a specific artifact/route not already covered. Current Zig, OCaml, Erlang and Lean status must be tested release by release; this recovery does **not** claim that every listed ecosystem lacks any route. Select a language only after inspecting current work. The broad shared project belongs with G01.

**Kill test — E.** Before a large interpreter effort, spend two days checking target reproducibility and building a complete input/stage manifest. Stop that target if the comparison artifact cannot be reproduced under a meaningful common recipe, an allegedly independent stage consumes the seed being tested, or an existing route already supplies the desired certificate. A subsequent 7–10-day feature spike must reach an executable compiler-source slice with measurable progress; parser agreement alone is not the end-value oracle. Budgeting $1–3k for the spike is an estimate, not measured cost.

### 3.2 Tilework — a conditional, narrow extension rather than another all-x86 translator

**Name and one sentence — I.** Extend an available static x86→AArch64 translation framework with instruction families demanded by a fixed real-binary corpus, retaining only additions that pass independently run native-CPU and whole-program checks.

**Seed — Q/F.** C01 states the instruction-tile engineering backlog; S01 and S02 independently report emulation/model labour, while S03 exposes floating-point determinism limits. These are corroborating needs, not proof that one tile library automatically serves all four projects.

**What grows and value — I.** A reusable, versioned catalogue of instruction implementations plus conformance records and a translator able to run the chosen binaries without runtime translation. The value is a concrete executable on a target where runtime code generation is undesirable, together with evidence about the translation. Static output is not automatically certified or secure because it can be signed.

**The oracle and independent checks — F/I.** Elevator already reports over 100,000 native inputs per instruction and end-to-end comparisons (C01). The proposed acceptance harness runs outside the agent: compare the native instruction and generated tile on edge cases, random states, memory faults and documented architectural modes; then compare complete translated-program behaviour with the original. Use multiple Intel/AMD families where the promised target set requires them. Freeze state projection and undefined-bit rules before agents work; do not let an agent “fix” a failure by editing the mask. Cross-check a separately sourced semantics model, while tracing shared components.

A pass is **test evidence for the specified CPUs, modes and states**, not a proof for all inputs or x86 implementations. Exceptions, signals, ABI calls, atomics and the x86/Arm memory-model difference can break an otherwise correct tile catalogue. Floating-point rounding, denormals and exceptional values need explicit contracts. R06’s exclusions and R04’s scope limits demonstrate why those are separate obligations.

**Tailwind and one-shot test — I.** Better models can cover harder instruction forms and shrink failure cases; accepted implementations and test records remain usable without a model. That is a plausible engineering tailwind, but a future agent can also extend an existing emulator from a single instruction prompt. The accumulated corpus, independent evaluator and resulting executable must provide measurable extra value, or the project becomes ordinary patch generation.

**Six-week version and demo — E.** Start only after obtaining a usable, licensed translator codebase; the Elevator paper promises release, which is not proof that its implementation is currently obtainable. Pick one missing SIMD family and a small corpus containing actual blocked binaries. Build the harness in weeks 1–2; grow that family and integration support in weeks 3–5; in week 6 translate one previously unsupported unmodified Linux executable into a standalone AArch64 executable and compare held-out outputs. Report code-size expansion, speed and deployment requirements. Full SSE2–SSE4.2 plus AVX2 in six weeks is removed as an unsupported promise. SQLite or a compressor is a valid demo only if the baseline actually failed for the capability added.

**Prior art and what remains — F/I.** [Elevator](https://arxiv.org/abs/2605.08419) is almost the exact proposed architecture; [MirrorBall](https://arxiv.org/abs/2609.16423) adds close static-lifting competition. [FEX](https://github.com/FEX-Emu/FEX), [Box64](https://github.com/ptitSeb/box64) and [QEMU](https://www.qemu.org/) already address practical dynamic translation. [libLISA](https://liblisa.nl/) synthesises CPU-specific instruction semantics and explicitly pursues validation of emulators and other semantics; its project reports five measured CPU architectures. A standalone “grow semantics against silicon” pitch is therefore occupied, including funded prior art. The potential residual is a specific static-translation workload and unsupported family, demonstrated against these baselines. No such unmet workload was established by this research.

The draft’s post-Rosetta Mac argument is removed: a Linux instruction translator does not supply macOS framework/ABI compatibility. That would add a separate large compatibility project. The cross-GPU numerical-atlas rejection and T02’s Lemma also caution against treating a coverage dashboard as the value proposition.

**Kill test — E.** In five days, demonstrate that one pinned real binary is blocked by a specific missing instruction family, that an available framework can accept the extension, and that an accepted addition makes the binary run with matching held-out results. Compare with the best existing dynamic translator and an agent simply patching that project. Stop if framework access fails, the real blocker is ABI/concurrency rather than instruction coverage, or static translation has no concrete deployment advantage. Instruction pass percentages alone do not establish a useful project.

**Decision — I.** The only potentially fresh implementation lead among the three, but **hold pending a workload and codebase gate**. Its broad form fails the novelty filter.

### 3.3 Rebuild Doctor — keep the evidence, drop the broad pitch

**Name and one sentence — I.** Agents diagnose package-build mismatches and retain recipes or narrow patches that make independently executed builds agree under deliberately varied environments.

**Seed — Q/F.** C12 documents manual diagnosis; C13 identifies additional canonicalisation engineering; C14 measures low strict wheel match rates in its sample. C11 explains why agreement can coexist with a shared untrusted tool. These are distinct problems, not one universal two-hash guarantee.

**What grows, the oracle and value — I.** A catalogue of pinned rebuild recipes, explanatory diffs and, where needed, upstream patches. Matching an independently rebuilt artifact to a published artifact provides evidence about that release. A source change that makes future builds deterministic normally creates a **new artifact**; it cannot retroactively make the old published bytes equal. Keep those two outcomes separate.

The external runner varies time, paths, locale, user IDs, parallelism and file ordering, with the candidate unable to fetch/copy the expected artifact. Record compilers and utilities; environment variation alone does not supply an independent trusted toolchain. If canonicalisation is used, label the result normalised equivalence and state what information was discarded. Review that transformation separately and test meaningfully different artifacts remain distinguishable; a finite negative corpus is useful evidence, not proof that the normaliser is semantics-preserving.

**Tailwind and one-shot test — I.** Better models should diagnose more difficult build-system failures. Retained recipes and patches rerun without a model, and executing a long tail of releases has value beyond writing a suggested fix. Nevertheless this is a natural task for general coding agents, and existing owners already implement the loop. Scale alone is not an adequate answer to the next-model test.

**Six-week version and demo — E.** As an evaluation of residual value, choose 30–50 current Arch or Nix mismatches, freeze source/recipe/toolchain inputs and compare an agent with existing automated rebuild inference. Demo one real timestamp/order/path failure fixed across changed environments, with honest labels for published-artifact reproduction versus reproducibility of a patched new build. A 300-package target before measuring build costs and diagnosis yield is removed. Patches can be produced solo, but adoption into official releases depends on maintainers; that weakens the “no users needed” value proposition.

**Prior art and what is left — F/I.** Google’s [OSS Rebuild](https://github.com/google/oss-rebuild) goes beyond a README aspiration: current source includes a runnable [agent command](https://github.com/google/oss-rebuild/blob/main/cmd/agent/main.go), Gemini model selection, an [agent implementation](https://github.com/google/oss-rebuild/tree/main/internal/agent) and rebuild tooling. That is direct existing infrastructure for model-assisted rebuild work, even though it does not prove automatic source-level repair of every distribution package. [Chains-Rebuild](https://arxiv.org/abs/2504.21679), [Reproducible Builds](https://reproducible-builds.org/) and [rebuilderd](https://github.com/kpcyrd/rebuilderd) occupy canonicalisation, methodology and distributed rebuilding. [G04’s Rebuild Ratchet](G04-security.md) is also the same family inside this research corpus.

**Kill test — E.** Compare a fixed batch against OSS Rebuild’s current agent and the strongest general coding agent with the same runner. Continue only if a clearly named failure class is left uncovered and the project repeatedly fixes it without widening normalisation or relying on upstream redesign. The saved draft’s “kill if Google ships an agent” condition is already triggered for the broad proposal.

**Decision — I.** Drop as an independent idea. Preserve the paper measurements and trust-boundary lessons for the existing work; do not re-pitch it as distro scale without new evidence.

## 4. Search audit, exclusions and material corrections

**F — Continuation checks, 2026-10-29.** Reopened the arXiv primary pages for the bootstrap/supply-chain, Elevator/MirrorBall, Rust std, Lean-SMT, VeruSAGE, Vero, Triosecuris and reactive-peripheral headline claims. Read primary repository files for GHC bootstrap, Resid’s interpreter/check scope, Lean’s stage0 build, FrankenLean’s implementation status, and Google’s actual agent source; read libLISA’s own description of CPU-specific semantics. Exact ledger quotations were checked locally against the downloaded primary evidence, not against search snippets. Publisher DOI endpoints for the ACM papers returned HTTP 403 during link checks; the DOI identifiers and quote text were verified from the saved papers instead. This is verification of the report’s claims, not independent replication of the papers’ experiments.

**F — Dated searches.** The saved audit records bootstrappable builds/DDC/GHC/Zig/Lean/OCaml/Erlang, x86 semantics/static translators and agent-driven reproducibility searches. This continuation reran bounded web searches including:

- `2026 agent reproducible builds OSS Rebuild Gemini agent`; `site:security.googleblog.com "Rebuild" "Gemini"`; checked the repository tree and actual implementation after weak search hits.
- `2026 Zig bootstrap interpreter Lean independent compiler DDC`; `"Lean" "bootstrap" "independent" compiler 2026`; these exposed FrankenLean, which the original openness claim omitted.
- `2026 Elevator static binary translator tiles x86 AArch64`; `"Elevator" "binary translation" 2026 github`; no usable released Elevator codebase was established. The paper’s release pledge is not treated as a checkout.
- `"Synthesizing Instruction Selection Back-Ends from ISA Specifications Made Practical" 2025 2026`; checked the author PDF and CGO 2026 programme for the recovered compiler entry.
- `site:news.ycombinator.com "ghc-bootstrap"`; `site:x.com "diverse double" compiler 2026`. These did not provide reliable current coverage; returned HN material was older or unrelated, and no relevant X evidence was used. This is a search limitation, not evidence that work is absent.

**I — Novelty limit.** Direct code, project pages and paper claims establish close collisions. An empty query never establishes that a language has no bootstrap path or a field has no competitor. GitHub status is a dated observation; repository ambition and verified implementation are kept separate. The earlier audit’s “not found” claims are narrowed accordingly.

**F/I — Exclusions respected.** The [tailwind summary](../tailwind/SUMMARY.md), [rejected families](../BRIEF-tailwind.md) and [kill list](../../RESEARCH-SUMMARY.md#11-the-kill-list) remain binding. Rust/crypto proof automation is evidence for existing proof work, not a new Lemma/Futamura pitch. Kernel/driver/peripheral growth is not developed. Scheduler testing remains adjacent to the rejected agent-era Jepsen family. Hardware-trace modelling and broad performance atlases are not reintroduced. The [G08 ledger](G08-papers-trackers.md) covers other engineering backlogs; the nine recovered entries here concern compilers/runtimes and do not reuse its paper seeds.

| Saved claim or ambiguity | Correction retained in this report |
|---|---|
| Seedless is an additional top discovery | Same mechanism as G01’s Thompson’s Mirror; merge the evidence conceptually and count one idea. |
| Matching a compiler fixed point is DDC | Ordinary self-rebuild agreement can retain a seed-dependent modification. DDC needs the justified diverse parent→target route and stated assumptions. |
| DDC is the only known check; matching bytes proves a compiler clean | Removed the exclusivity claim. The scoped result is source/artifact correspondence under assumptions, not benign source or complete toolchain/hardware assurance. |
| An independent compiler rebuild catches a tampered `strip` automatically | Shared post-processing tools can remain outside a compiler-focused check. C11 is a warning about that trust boundary. |
| GHC has no source route; no relevant independent implementation exists | GHC’s Claude-assisted chain and Resid’s independent subset interpreter are concrete prior art. GHC official-release DDC and Resid native-code verification were not established here. |
| Lean is untouched and every candidate language is available | FrankenLean is active but explicitly incomplete; current route/certificate coverage must be inspected per release and artifact. |
| Bytecode/IR/generated-C matching certifies a native binary | The certificate names the checked artifact level. Later compilation, linking and post-processing remain dependencies. |
| Anti-smuggling scans establish independence | They are heuristics; source lineage, denied target inputs, controlled evaluation and residual assumptions are recorded separately. |
| Every missing proof rule/instruction is routine engineering | Some need shared theory, memory semantics, concurrency or a new specification. The ledger marks research-heavy cases. |
| TDX has 22 fully checked entry points | The study derives 418 tasks from 22 entry points and evaluates tools; that is not whole-interface verification. |
| 100k CPU tests verify a tile universally | Tests support only the tested hardware/state contract; instruction and whole-program evidence are both needed. |
| Static translation is open territory, with an immediate Mac replacement market | Elevator, MirrorBall, libLISA and dynamic translators are close prior art; macOS compatibility is a separate large obligation. |
| Normalised equality is bit-for-bit reproduction | It is equivalence under the stated transformation. Information loss and shared-toolchain assumptions remain explicit. |
| A reproducibility source patch makes an old official artifact reproduce | Usually it makes a new artifact. Original-release reconstruction and future reproducibility fixes are distinct deliverables. |
| Google’s rebuild agent is hypothetical | Current `cmd/agent`, `internal/agent` and model-selection source constitute direct prior art. Broad Rebuild Doctor is dropped. |
| All 43 entries are new 2025–26 publications | 41 qualify by publication or preprint date; Camlboot 2022 and the Sicherheit 2024 Arch paper are historical exceptions. |
| Camlboot is simply a C interpreter and its labour number is exact | It uses stacked implementations. The saved paper reports about two human-months for the final design; the arXiv abstract says about a person-month. The discrepancy is not silently turned into a precise budget. |

**F — Evidence integrity.** The headline saved files are identified below by SHA-256 prefix, so later checking can distinguish the downloaded versions from changed landing pages. All 43 quote spans were also rechecked from the assembled report; page locations refer to the retained raw text/PDF, not a promise that a later online revision has identical pagination.

| Evidence | Saved primary file | SHA-256 prefix |
|---|---|---|
| C01 | `dl/elevator/raw` | `9f7fcfb2410ab6ecaff8` |
| C11 | `dl/trusting/raw` | `183166f61b6875ce06cf` |
| C12 | `dl/archrepro/raw` | `0730c99e36afdc683ebc` |
| C13 | `dl/javarepro/raw` | `a6af70267cb18681b415` |
| C14 | `dl/nosnakeoil/raw` | `3c1f9f0e1ff211392aa4` |
| C15 | `dl/camlboot/raw` | `0702d7cc86792414db57` |

## 5. Ranked decision and three-line TL;DR

**E — Scores:** 1–5, higher is better. Open rates the residual after prior art; low scores and the decision column take precedence over an attractive average. Solo rates the meaningful deliverable, not merely a parser demo. This ranking preserves the original three leads; it does not certify that any is a new pass through every brief filter.

| Rank | Idea | Tail | Cool | Value | Open | Solo | Demo | Decision and decisive gate |
|---|---|---:|---:|---:|---:|---:|---:|---|
| 1 | **Seedless / Thompson’s Mirror** | 5 | 5 | 4 | 1 | 2 | 4 | **Merge with G01; no separate pitch.** Paper evidence strengthens the shared idea, but an exact, reproducible, independently justified parent→target route is required. |
| 2 | **Tilework** | 4 | 4 | 3 | 1 | 2 | 4 | **Conditional hold.** Find an available framework, a real blocked binary and a concrete reason static translation matters; otherwise drop. |
| 3 | **Rebuild Doctor** | 4 | 2 | 4 | 1 | 3 | 3 | **Drop broad proposal.** Google has an agent and G04 covers the family; only a demonstrated uncovered failure class could reopen it. |

**I — Pick for this gap-analysis thread:** keep the paper corpus and the corrected shared Mirror evidence. Tilework is the only fresh conditional lead, and does not yet justify building a new translator. No additional development of the existing top idea is proposed here.

**TL;DR**

43 checked paper seeds: 41 from 2025–26 publication/preprint dates, plus two labelled historical references.

Seedless merges with G01; DDC is a conditional source/artifact check, not ordinary reproducibility or proof of benign software.

Tilework needs an unmet workload before proceeding; Rebuild Doctor’s broad pitch is occupied and dropped.
