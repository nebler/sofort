**V3 — Does the ARM model match real hardware?**  
Review date: 2026-10-29. Assignment: instruction semantics, hardware differential testing, and the path to an independently justified ISA model.

**The modeled instruction subset matched the M4 Pro in 695,680 differential comparisons. The model does not describe arbitrary real machine states.** There were zero divergences in 690,560 comparisons of complete register/flag state and a 64-byte memory window, plus 5,120 branch-range comparisons. Five fault probes and two tagged-address observations expose missing virtual-memory semantics. These are limitations of the abstraction, not a demonstrated miscompilation of the three fixtures. The current README states this proof boundary accurately; this review does not close it formally.

I read `BRIEF.md` first and copied the spike to `/tmp/lemma-verify-v3` before building anything. All harnesses, binaries, records, downloaded sources and experiments are in that copy's `v3/` directory. I used C, assembly, JavaScript, shell and Lean; no Python, commits or edits to the original spike. This report is the only repository file I wrote.

**The experiment is a direct CPU-versus-Lean comparison.** The CPU is an Apple M4 Pro, running macOS 26.6.1 (25G76), Darwin arm64 25.6.0, with 16,384-byte pages. Tools: Apple clang 21.0.0 (`clang-2100.1.1.101`) and Lean 4.35.0, commit `eb6cafb7290e8bd5f2937522d8d804f58f02bafc`.

The three audited sources remained byte-identical to the original:

| File | SHA-256 |
|---|---|
| `lean/CheckedModel.lean` | `a05391bd8c8b87eb9b9aead9b398adaf104e623c577edf8fb634cbb2eb01188b` |
| `lean/NativeBridge.lean` | `d8f63c719510a81ed0bf8d3cd863e45a6426c04cd06902bbe0800703625641c8` |
| `src/arm.mjs` | `ac4d87ff9119b1fb2a478dfb5cb0a1ab540058d7b3c8018ab3699653117aa058` |

`v3/generate.mjs` calls the spike's actual encoder and emits 5,318 static assembly variants. Each wrapper saves the caller's callee-saved state, initializes the tested registers and NZCV, executes the encoded word, captures registers and flags before instrumenting them, then restores the caller. Branch destinations record the observed destination without changing the captured flags or registers. X29 and X30 can therefore contain arbitrary test values during the instruction. X18 is never overwritten: the emitter rejects it, and Apple reserves it. Its actual value is included in the input and preservation comparison.

`v3/hardware.c` writes binary records containing the initial machine state and actual CPU results. `v3/Oracle.lean` decodes each exact word with the unchanged `Native.decode`, executes the unchanged **`Arm.pstep`**, and compares all 31 X registers, all four NZCV bits, the next PC/trap boundary, and **every byte** of the 64-byte memory window. This evaluates the real Lean definitions, compiled using Lean's C backend; it is not a JavaScript or C reimplementation of their arithmetic. The model and byte bridge were re-elaborated from source before compilation. Evaluating compiled Lean still trusts its executable compiler/runtime path; these tests are empirical evidence, not kernel proofs of all samples.

The sweep has 64 states per encoding: 32 edge-pattern states and 32 pseudorandom states. For each of 38 opcode/condition combinations, there are another 1,024 edge cross-product records and 8,192 random-state records. The comparison representatives for CMP W/X use distinct source registers. The deterministic xorshift64 seed starts at `0x4c454d4d41563301`; addresses vary with ASLR. Register aliases cover distinct operands, destination equal to either source, equal sources, and all operands equal where applicable. MOV W covers every pair of emitter-allowed register numbers. Other register sweeps cover every allowed number, including X29/X30 beyond the compiler's current allocation.

The edge set includes zero, one, all ones, alternating bits, signed minima/maxima at both widths, `0xffffffff`, `0x100000000`, `0xdeadbeef80000000`, and shift counts 30, 31, 32, 33, 63, 64, 65 and values with high bits set. Every instruction family sees all 16 input NZCV combinations, including flag combinations that CMP need not ordinarily produce.

**Every emitted instruction form is represented.** There are 16 `Arm.Instr` constructors, or 23 forms after separating the eight ALU operations; expanding six conditions on CSET, CSEL and B.cond gives 38 tested opcode/condition combinations. Counts below are completed full-state comparisons; all have zero divergences.

| Model form / actual AArch64 instruction | Comparisons | Coverage details |
|---|---:|---|
| `movz` / MOVZ X | 39,936 | All four halfword positions; immediates 0, 1, 0x8000, 0xffff |
| `movk` / MOVK X | 39,936 | Same positions/immediates; preservation of other destination bits |
| `movW` / ORR Wd,WZR,Wn alias | 66,816 | All allowed register pairs; high-half clearing |
| `alu.add`, `alu.sub`, `alu.mul` / ADD, SUB, MUL W | 18,816 each | Modular overflow, underflow, low-product truncation, aliases |
| `alu.and`, `alu.orr`, `alu.eor` / AND, ORR, EOR W | 18,816 each | Full-width initial X values; W result and preserved flags |
| `alu.lsl`, `alu.lsr` / LSLV, LSRV W | 18,816 each | Counts modulo 32, including ≥32 and ≥64 |
| `addX` / ADD X register | 18,816 | 64-bit wraparound and aliases |
| `addXi` / ADD X immediate, unshifted imm12 | 32,256 | Immediates 0, 1, 4, 2047, 2048, 4095 |
| `cmpW` / SUBS WZR,Wn,Wm alias | 13,056 | All NZCV outputs checked, including signed overflow |
| `cmpWi` / SUBS WZR,Wn,#imm12 alias | 20,736 | Same six immediate boundaries, W width |
| `cmpX` / SUBS XZR,Xn,Xm alias | 13,056 | 64-bit signed overflow and unsigned borrow |
| `cset` / CSINC Wd,WZR,WZR,inverse-condition alias | 66,816 | EQ, NE, HS, LO, HI, LS; all 16 flag combinations |
| `csel` / CSEL W | 112,896 | Same conditions; aliases; high-half clearing |
| `ldrW` / LDR Wt,[Xn,Xm], unscaled X offset | 18,816 | Four-byte little-endian read; high-half clearing; aliases |
| `strW` / STR Wt,[Xn,Xm], unscaled X offset | 18,816 | Exactly four written bytes; surrounding window unchanged |
| `bTrap` / B.cond to designated trap entry | 55,680 | Same six conditions; taken and untaken |
| `b` / B immediate | 9,344 | Forward and backward control transfers |
| `cbnz` / CBNZ W | 13,056 | Low-32-bit test, forward/backward, flags preserved |
| **Total** | **690,560** | **Zero divergences** |

For memory tests, a mapped 64-byte window straddles an actual page boundary. Accesses cover each byte position where a four-byte access fits, all alignment residues, and unaligned accesses spanning the page boundary. Across loads and stores, residues 0/1/2/3 have 11,854 / 7,414 / 11,132 / 7,232 observations. Base and offset registers also receive large values whose **64-bit sum**, including wraparound, resolves to the valid window. This tests full X offset arithmetic rather than quietly narrowing it to W. Equal address registers necessarily restrict the generated effective addresses to even addresses; the other variants cover odd addresses.

`v3/branches.c` separately uses a sparse 256 MiB-plus executable mapping to exercise actual imm26 and imm19 branch ranges, including the most negative displacement, most positive displacement, adjacent endpoints, ±3, and internal sign/truncation boundaries. It tests B, CBNZ W, and all six B.cond conditions, across all 16 NZCV inputs and values 0, 1, `0x100000000`, and `0xffffffffffffffff`. That adds **5,120 comparisons, zero divergences**. B's byte range is −134,217,728 through +134,217,724; the conditional/compare branch range is −1,048,576 through +1,048,572. The Lean range oracle uses `Native.decode` and an instruction-step adapter whose equality to `Arm.pstep` is kernel-checked (`decodedStep_is_pstep`); it avoids allocating a list with tens of millions of dummy instructions. These range tests compare control destinations, not a second complete register dump.

Concrete successful observations, recoverable from `v3/records.bin` and `v3/stats.json`:

- MOV W of `0xdeadbeef80000000` produces X = `0x0000000080000000`.
- LSLV W and LSRV W of 65 by 64 both produce 65; 64 is reduced modulo 32.
- CMP W of `0x80000000` against 1 produces NZCV `0011`: N=0, Z=0, C=1, V=1. CMP X of `0x8000000000000000` against 1 produces the same flags. Borrow, zero and negative-result cases also pass.
- CBNZ W with X = `0x100000000` falls through: the nonzero upper half does not make W nonzero.

There is no signed load, data sign-extension instruction, arithmetic-right shift, X-form variable shift, or signed condition code in this model. Consequently, the branch-displacement sign-extension tests above do not validate SXTB/SXTH/SXTW, LDRSW, ASR, or 64-bit shifts modulo 64. Those forms are absent, not passing implicitly.

**Seven observations expose two missing parts of the machine-state contract.** The first five are direct exception differences:

| Probe | Actual CPU/process outcome | `Arm.step` outcome |
|---|---|---|
| LDR W from address zero | SIGSEGV, signal 11 | `.ok`; zero in the supplied total memory |
| LDR W from a PROT_NONE page | SIGBUS, signal 10 | `.ok` |
| STR W to a read-only page | SIGBUS, signal 10 | `.ok` |
| Unaligned LDR W crossing from writable memory into a guard page | SIGBUS, signal 10 | `.ok` |
| Unaligned STR W crossing into that guard page | SIGBUS, signal 10 | `.ok` |

Commands: `./v3/faults` and `LEAN_PATH=lean "$LEAN_BIN" v3/FaultModel.lean`. Full outputs are in `v3/faults.log` and `v3/fault-model.log`. The native fault cases run in child processes. The Lean load/store definitions return `.ok` at every address; they cannot express mapping or permission faults. I did not infer whether a faulting store partially changed memory.

The other two observations concern **top-byte address aliases on this Mac**. With a real word `0x11223344` at address `p`, a load from `p | 0xab00000000000000` succeeds and reads `0x11223344`. A flat model initialized only at untagged `p` reads zero at that distinct 64-bit index. More decisively, even initializing the Lean memory so both tagged and untagged addresses read `0x11223344` does not preserve the alias after a store: hardware STR through the tagged pointer changes the untagged word to `0xdeadbeef`; `Arm.write32` changes only the tagged indices and leaves its untagged word `0x11223344`.

Commands: `./v3/tagged` and `LEAN_PATH=lean "$LEAN_BIN" v3/TaggedModel.lean`; outputs are `v3/tagged-hardware.log` and `v3/tagged-model.log`. The tagged-load comparison deliberately illustrates a naive address-to-memory mapping; it does not start from an alias-aware relation. The tagged-store comparison starts with agreement at both aliases and demonstrates why that relation needs more than an initial equality. These are measured properties of this OS/CPU configuration, not assertions about every Arm system.

The appropriate refinement domain must therefore specify normal mapped memory, permissions, address normalization/canonicality, and which aliases are excluded or related. `Compiler.MemRel` currently constrains size, nonwrapping placement and byte contents; it contains no real page-table or protection assertion. The C runner supplies mapped memory in the exercised cases. Nothing above demonstrates a fault in a fixture under that runner's ordinary untagged memory placement.

`bTrap` is another intentional abstraction: hardware executes a conditional **branch**, not an architectural exception. I observed arrival at the designated trap entry. The trap handler's return convention, actual return to C, and ABI restoration remain outside this instruction-model comparison. Likewise, stepping beyond a modeled body's end means model halt, not a physical CPU halt. The existing wrapper uses STP/LDP, SP addressing, RET and other forms beyond the certified body; these experiments do not prove that wrapper.

**The results have useful but finite limits.** All emitter/decoder instruction forms were exercised; immediate values, register triples and machine states were sampled, not exhausted. X18 operands are accepted by the Lean decoder but forbidden by the emitter and were not executed. SP/explicit register-31 operands are outside this model, except fixed implicit ZR uses in instruction aliases. This is one M4 Pro and one OS configuration, with ordinary little-endian memory, no concurrent interference, no device memory, and no claim about speculative or timing behavior. The full-state tests compare the 64-byte observation window, not every address in the process. No complete instruction-sequence refinement theorem follows from successful single-step tests.

The checker has an exercised failure path. I changed one result register, one NZCV bit, one PC, one observed memory byte, and replaced one opcode by `0xffffffff` in five separate records. It rejected all five, with the expected register/flag/PC/memory/decode diagnoses and exit status 1 (`v3/selftest.log`). These artificial divergences are harness checks and are not counted as hardware/model failures.

**Reproduction and retained evidence.** The complete rebuild/run script is `/tmp/lemma-verify-v3/v3/run.sh`. It uses the saved Lean toolchain by default; `LEMMA_LEAN` can select an equivalent Lean binary. Its important commands are:

```sh
cd /tmp/lemma-verify-v3
LEAN_BIN=/Users/noah/.t3/scratch/2026-10-28-here-are-the-absolute-paths-a63c3f1b/lean-oneshot/elan/toolchains/leanprover--lean4---v4.35.0/bin/lean
./v3/run.sh

# Recheck the captured CPU observations without rerunning hardware:
./v3/oracle v3/records.bin
LEAN_PATH=lean "$LEAN_BIN" --run v3/BranchOracle.lean
```

The script independently defaults to that saved Lean toolchain. The recorded successful output is:

```text
hardware=Apple-M4-Pro variants=5318 op_condition_forms=38 sweep_iterations=64 records=690560 seed_initial=0x4c454d4d41563301 seed_final=0x820fa23413a6e202 mem_base=0x0000000102a2bfe0 page_size=16384
records=690560 divergences=0; compared 31 X registers, NZCV, PC/trap boundary and all 64 memory bytes
branch-range records=5120 divergences=0
```

The final record hashes are `9c8a8defb2b1bc6d701d64c4b9d1261f580c8a5f0cb5eb5729dbeec49b9b16ad` (`records.bin`, 690,560 × 680 bytes) and `d11909e2f76748b9580e8b484c6a4a234303fdbe05ddb95f9c0a7677dbc7005a` (`branches.bin`). Re-running hardware changes ASLR addresses and therefore the first hash. Source, assembly, generated C, executables, logs, manifest and provenance remain together in scratch; the repository report does not depend on modifying the spike.

**LNSym is a plausible nearer-term reuse path, with specific holes.** I inspected upstream commit `5c05220ff970e3bdd7813ad0c9ef3741522c8b92`, cloned under `v3/lnsym`. It is a Lean AArch64 symbolic simulator with actual-hardware co-simulation infrastructure. It is not a theorem that silicon implements its definitions. Its [README](https://github.com/leanprover/LNSym/blob/5c05220ff970e3bdd7813ad0c9ef3741522c8b92/README.md) describes the co-simulation target; its [licence](https://github.com/leanprover/LNSym/blob/5c05220ff970e3bdd7813ad0c9ef3741522c8b92/LICENSE) is Apache-2.0. The separately listed ELFSage material is MIT in [THIRD_PARTY_LICENSES](https://github.com/leanprover/LNSym/blob/5c05220ff970e3bdd7813ad0c9ef3741522c8b92/THIRD_PARTY_LICENSES).

Most current arithmetic/control families have corresponding definitions: move-wide, add/sub immediate and shifted-register, logical shifted-register, multiply/data-processing, variable shifts, conditional selects and branches. But three concrete qualifications matter:

1. Its [load/store decoder](https://github.com/leanprover/LNSym/blob/5c05220ff970e3bdd7813ad0c9ef3741522c8b92/Arm/Decode.lean#L219) has immediate, unscaled-immediate, pair and SIMD-structure forms; it lacks the spike's exact **LDR/STR W register-offset encoding**. Add that class, or change lowering to ADD X address followed by an already supported load/store form and reprove the compiler step.
2. Its [default random instruction list](https://github.com/leanprover/LNSym/blob/5c05220ff970e3bdd7813ad0c9ef3741522c8b92/Arm/Insts.lean) excludes LDST. Its [BR random list](https://github.com/leanprover/LNSym/blob/5c05220ff970e3bdd7813ad0c9ef3741522c8b92/Arm/Insts/BR/Insts.lean) contains only hints. Thus, default hardware co-simulation does **not** establish validation of these memory or branch forms. Extend the driver to observe memory and control destinations, including extreme signed displacements. The harness built here provides a starting test corpus.
3. Its [toolchain pin](https://github.com/leanprover/LNSym/blob/5c05220ff970e3bdd7813ad0c9ef3741522c8b92/lean-toolchain) is `nightly-2024-10-07`, versus the spike's Lean 4.35.0. Reuse requires a port or a common toolchain and an axiom audit of the actual dependency closure. I inspected these sources; I did not build or co-simulate LNSym in this review.

The formal work is to define a relation between custom `Arm.State` and LNSym state: GPR widths and zero-register behavior; PSTATE/NZCV; byte PCs versus instruction indices; code placement; memory contents, valid addresses and permissions; and the special trap-entry observation. Prove decoder agreement and a step simulation for each accepted form under that relation, then lift it to traces and compose it with `Native.compiler_to_bytes`. Alternatively lower directly to LNSym instructions and replace the current target semantics, accepting the resulting compiler-proof changes. Merely importing LNSym or sharing its arithmetic helpers does not supply either theorem.

My rough estimate for the present integer body is **6–10 engineer-weeks** for one experienced Lean/AArch64 engineer: roughly 1–2 weeks for toolchain/state integration, 1–2 for missing forms and stronger co-simulation, and 3–6 for decoder/step/trace proofs and review, with overlap. Budget another **2–4 weeks** for a narrow host entry/exit and memory-placement contract. These are engineering estimates, not measured project delivery times; unfamiliarity with Lean or a difficult port could expand them substantially. Reusing LNSym would strengthen provenance and validation while retaining a tested, handwritten ISA model as an assumption.

**ASL-derived Sail provides the stronger specification provenance, but its Lean path needs qualification.** [sail-arm](https://github.com/rems-project/sail-arm) contains Armv8.5-A, Armv9.3-A and Armv9.4-A models derived from Arm's ASL. The [Armv9.4 README](https://github.com/rems-project/sail-arm/blob/master/arm-v9.4-a/README.md) identifies the ASL translation and distinguishes implementation/default-setting and memory-interface glue from architectural material. This avoids manually reinventing the ISA subset, but requires selecting architecture features, EL0 state, endianness, memory behavior and permitted exceptions explicitly.

A useful correction to the earlier deep-dive: an Arm Lean-generation route **does exist upstream**. At sail-arm commit `7d0581642d0e3aaca367bbc5650aca7c53057543`, the [Armv9.4 Makefile](https://github.com/rems-project/sail-arm/blob/7d0581642d0e3aaca367bbc5650aca7c53057543/arm-v9.4-a/Makefile#L75) has `gen_lean`/`lean.stamp`, not just C/Coq/Isabelle targets. However, it uses force-output and noncomputable-generation options, and the imported [ArmExtras.lean](https://github.com/rems-project/sail-arm/blob/7d0581642d0e3aaca367bbc5650aca7c53057543/arm-v9.4-a/lean/ArmExtras.lean#L17) defines a termination tactic that falls back to **`sorry`**. That is an actual source finding; it does not establish that every generated definition uses the fallback. The tree contains that support file, not a checked-in, demonstrated build of the generated Arm Lean model. The [Sail changelog](https://github.com/rems-project/sail/blob/sail2/CHANGELOG.md) introduces its highly experimental Lean backend in 0.19 and records later fixes, including 0.20.3. Neither `sail` nor `opam` is installed on this machine, so I did not generate or kernel-check this model.

The concrete path is:

- Pin a licensed model snapshot and compatible Sail/Lean versions. Generate the current instruction subset and its dependency closure; build the generated Lean, fix unresolved obligations, and check the axioms of every definition/theorem used by the bridge. A successful generator exit or the existence of `gen_lean` is insufficient.
- Instantiate a precise user-mode machine/memory contract. Resolve implementation-defined and nondeterministic choices, and show that faults, address aliases and trap entries are either represented or excluded by preserved hypotheses.
- Prove custom decoder/step correspondence to those generated definitions, including implicit ZR, PC scaling, load/store attributes and flag preservation. Lift it to traces and compose with the existing compiler theorem. Maintain a direct hardware/Sail/Lean differential suite across more than one CPU generation.
- Audit the ASL-to-Sail translation, generated support primitives and any trusted imports. Unless separately verified, those translations remain part of the trusted specification pipeline. Even an authoritative ISA refinement still assumes that the physical CPU conforms to its architectural specification.

Estimate **3–6 engineer-months** for a reviewed integration of this bounded subset, with a first **1–2 week feasibility gate** on generating, compiling and axiom-auditing the needed Lean slice. Backend repairs could make it longer. A C emulator comparison could be obtained sooner, but would supply testing rather than the missing Lean refinement theorem. The existing upstream target reduces discovery work; it does not yet justify a shorter completed-proof estimate.

Licensing differs materially between these options. The released [Sail Arm model licence](https://github.com/rems-project/sail-arm/blob/master/arm-v8.5-a/LICENSE) is BSD 3-Clause Clear, with attribution/redistribution conditions and no patent grant; the repository states generated artifacts retain the model licence. [Sail itself](https://github.com/rems-project/sail/blob/sail2/LICENSE) and the [ASL-to-Sail translator](https://github.com/rems-project/asl_to_sail) use BSD-2-Clause, subject to their listed component exceptions. By contrast, I downloaded the official [2026-03 Arm A64 XML/ASL archive](https://developer.arm.com/-/cdn-downloads/permalink/Exploration-Tools-A64-ISA/ISA_A64/ISA_A64_xml_A_profile-2026-03_96.tar.gz): its `ISA_A64_xml_A_profile_2026-03_96-2026-03_rel/notice.xml` carries a proprietary reproduction restriction and disclaims a general IP licence. That public download must not be treated as having sail-arm's separate permissive grant. The extracted notice is retained as `v3/arm-asl-notice.xml`; archive SHA-256 is `9d138aa4dd6db8b04bd6ad3a378205537bf67172a5f99180729517d1445f1906`. This is an inspection of those notices, not a complete file-by-file rights audit.

**A realistic Wasm subset needs substantially more target semantics.** The current compiler supports a single `(i32) → i32` function, selected i32 integer operations, selected empty-result block/loop control, locals/select, and i32 word loads/stores. It lacks even several common scalar-integer operations and calls. Compared with the [Wasm instruction families](https://webassembly.github.io/spec/core/syntax/instructions.html), useful C/Rust-style modules require broader numeric, memory and control coverage. The following are practical lowering choices and their proof obligations, not a unique minimum Arm instruction set—helpers or longer sequences can substitute for individual instructions.

| Useful Wasm capability | Likely added Arm/model support and obligations |
|---|---|
| Complete scalar integer operations, i32/i64 | X-form arithmetic/logical/multiply/shifts/select; ASR/ROR, signed/unsigned DIV plus remainder sequences such as MSUB; CLZ, CTZ/popcount sequences or helpers; explicit division-by-zero and signed-overflow traps |
| Signed comparisons and integer conversions | LT/LE/GT/GE conditions, signed flag interpretation, SXTB/SXTH/SXTW or equivalent bitfield sequences, i32 wrapping and i64 sign/zero extension; shifts modulo 64 for i64 |
| All scalar memory widths | Byte, halfword, word and doubleword loads/stores; signed/unsigned extension variants; immediate and spill addressing; exact widths, unaligned and boundary behavior, preserved outside-memory frame |
| Functions, imports, spills, general control | BL/BLR/RET and BR or equivalent dispatch; LR/SP/callee-save semantics; stack memory and alignment; argument/result ABI; `if`, general block values, `br_table`, indirect-call type/bounds checks |
| f32/f64 | FP registers and FPCR/FPSR; arithmetic, comparisons, rounding, conversions and bit reinterpretation; Wasm NaNs, signed zero, trapping/saturating conversions and subnormal behavior |
| Tables, bulk memory, memory growth | Runtime/helper contracts, aliasing and overlap semantics, changing memory bounds/base and allocation failure; instruction correctness alone is insufficient |
| Optional later SIMD/threads | v128 instruction and lane semantics; atomics/barriers and a concurrency model. The present sequential total-memory model cannot establish these |

For the immediate spike, retain the measured subset, state the canonical mapped-memory and ABI assumptions, and connect it to one reusable ISA semantics before adding features. LNSym offers the smaller integration surface; ASL-derived Sail offers stronger vendor-specification provenance and a less mature Lean build path. Neither option turns successful hardware testing into an all-states theorem by itself.

**Verdict table.** “Holds” below is scoped to the checked claim and evidence; passing a finite differential suite is not universal ISA correctness.

| Claim checked | Verdict | Evidence |
|---|---|---|
| Each current emitter/decoder instruction form can be exercised natively and compared with its actual Lean semantics | **Holds** | 23 forms / 38 opcode-condition combinations, 5,318 variants; 690,560 full-state records, zero divergences |
| W writes clear the upper half; W arithmetic/shifts and X additions match sampled hardware states | **Holds** | Every resulting X register checked; ≥32/64 shift counts, modular arithmetic, aliases and high-half inputs |
| CMP NZCV and all six modeled conditions match hardware on the exercised states | **Holds** | All 16 input flag combinations; W/X overflow and borrow cases; CSET/CSEL/B.cond observations |
| Signed PC-relative decoding and branch behavior agree at tested range endpoints | **Holds** | 5,120 additional CPU/Lean comparisons at imm19/imm26 endpoints and internal boundaries |
| The 32-bit memory operations agree on the exercised ordinary mapped-memory domain | **Holds** | 37,632 load/store records, all alignment residues, page crossings, bytewise 64-byte observations |
| The custom total 64-bit memory is an unconditional model of real memory behavior | **Wrong** | Five fault cases return `.ok` in the model; tagged store breaks an initially agreeing alias relation |
| The byte-bridge theorem independently establishes hardware semantics | **Unverified** | It reuses `Arm.step`; `Native.step_eq` relates two versions of the same custom semantics. No authoritative-model refinement was supplied or proved here |
| The current README accurately leaves ISA conformance and the host wrapper outside the proof | **Holds** | README proof-boundary text and unchanged Lean definitions; this review adds conformance evidence only |
| LNSym supplies reusable Lean semantics and hardware-test infrastructure under Apache-2.0 | **Holds** | Pinned upstream source, README, licence and co-simulation implementation |
| Calling LNSym “hardware validated” implies all forms needed here already have default hardware coverage | **Overstated** | Exact register-offset LD/ST class absent; LDST excluded from random list; BR random list only hints |
| There is no upstream Sail Arm→Lean route | **Wrong** | Armv9.4 `gen_lean` target exists; this corrects the earlier search result |
| That target supplies a clean, compiled, axiom-audited Arm Lean model ready for composition | **Unverified** | Support macro has `sorry` fallback; generated model not built here; no Sail/opam installed |
| Public raw Arm XML/ASL has the same permissive reuse terms as released sail-arm | **Wrong** | Raw archive's proprietary notice versus sail-arm's explicit BSD 3-Clause Clear licence |
| The current model covers a realistic scalar Wasm backend, including signed/i64/FP/call/ABI behavior | **Overstated** | It covers the enumerated i32 body subset; required families and runtime contracts above remain absent |

**TL;DR**
1. All 23 current instruction forms passed: 690,560 full-state tests plus 5,120 extreme-branch tests on an M4 Pro, zero divergences in the stated domain.
2. Five memory-fault probes and two tagged-address observations expose missing mapping, permissions and alias semantics; no fixture miscompilation was demonstrated.
3. LNSym is reusable Apache-2.0 infrastructure, but needs register-offset loads/stores, branch/memory co-simulation coverage, a toolchain port and an actual refinement proof.
4. Sail Arm has an upstream Lean-generation target, but its `sorry` fallback needs auditing; released models are BSD Clear, while the inspected raw Arm bundle is proprietary.
5. Budget roughly 6–10 engineer-weeks for the bounded LNSym bridge or 3–6 months for the ASL/Sail path, then additional ABI work; i64, signed operations, wider memory, calls and FP remain outside today's model.
