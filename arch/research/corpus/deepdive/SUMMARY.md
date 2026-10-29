# Round 14: Grow-install, Lemma and Futamura

Research date: 2026-10-29. This round challenges the finalists from [round 13](../tailwind/SUMMARY.md) on two separate questions: what remains unbuilt, and whether building it would satisfy the builder's [filters](../BRIEF-tailwind.md). The six reports are linked below. GPT-6.1 completed D2 and audited the interrupted experiments in D4/D6. All report-writing work is closed; unfinished experimental arms are explicitly inconclusive, with no results promised later.

**The original pitches all shrink under scrutiny. Lemma retains the clearest technical artifact; Grow-install's strongest evidence concerns validation of replacements; generic Futamura has the weakest value case. None has yet demonstrated that it passes every filter.** That is a reason to narrow the decision, not evidence that better models have made verified software worthless.

## Verdicts

| Idea | Prior-art verdict | Value verdict | What remains |
|---|---|---|---|
| **Grow-install** | Narrow opening | Real but narrow | Tree-wide replacement with independent acceptance evidence and refresh against upstream versions. The replacement generator itself has close prior art. |
| **Lemma** | Narrow opening | Real but narrow | A theorem from Wasm semantics through the front end to AArch64 bytes, with honest runtime assumptions, plus competitive performance. A Lean backend and proof-preserving optimization already exist in adjacent forms. |
| **Futamura** | Narrow opening | Weak as a generic factory; real but narrow for trusted Lean computation | Verified erasure, primitives and memory management for Lean are substantive gaps. They require a different project from a small-language-to-Wasm compiler factory. |

The prior-art verdicts describe publicly located projects, not an exhaustive proof that nobody else is building the remainder. Estimates of months to build or of when competitors will arrive are forecasts.

## Grow-install

The original proposal was to grow the dependency functions an app calls, compare them with an isolated original, and reuse accepted units in a catalogue.

Two close research projects remove much of the novelty. Singla and Davis regenerate repository-specific dependency slices; their 180-pair study reports preservation of 99.8% of existing validation checks. This measures repository-observed behavior, not equivalence on all inputs. Lexo regenerates components from observed input/output behavior with isolation and guardrails. [Use-case-oriented regeneration](https://arxiv.org/abs/2607.13021), [Lexo](https://arxiv.org/abs/2510.14522).

[D1](D1-growinstall-gaps.md) locates the opening in whole-tree integration, stronger acceptance criteria, versioned reusable units and refresh. Existing swaps and trusted-original services also compete with the practical value proposition.

[D2](D2-growinstall-value.md) tests whether an ordinary agent plus an oracle already supplies much of the grow loop. Each completed model row checks 560,000 constructed inputs across three selected package surfaces. Oracle-guided Haiku has 3/80,000 qs divergences per distribution (all in `parse`) and 38/40,000 realistic minimatch divergences. It also exceeds six seconds on five of six separate timing probes, while the pinned original takes milliseconds. These are observed errors and timeouts, not production error rates or five distinct CVEs.

There are important boundaries to that result. Both implementations run in the same ordinary Node worker, so the experiment does not demonstrate containment of a malicious original. No whole application tree was dissolved. The timing-aware B2 arm is incomplete: the study cannot settle whether adding an explicit timing requirement to an ordinary agent removes the apparent checking advantage. Recent release dates and resemblance to older package behavior do not establish a model's cutoff or memorized training contents.

The strongest objection is that these failures can support keeping the maintained original rather than replacing it. Removing package names does not automatically remove maintenance work or establish a security improvement. A replacement gate is useful for people already rewriting dependencies, but its value must exceed the cost and risk of owning those rewrites.

**Decision (I): do not retain the broad package-manager pitch on the strength of generation alone.** D2 supports a bounded functional demo: retain useful slices for one real consumer, run them with inference off, demonstrate actual dependency removal, and compare against an equally instructed ordinary agent. That is proposed work, not a result of this round. A benchmark or package-behavior atlas is not a substitute for that artifact; the brief explicitly rejects that direction.

## Lemma

The central correction is [clifv](https://github.com/eth-act/clifv/blob/main/README.md). It already provides a Lean CLIF-to-AArch64 backend and a correctness theorem for functions within its scope. It explicitly retains ABI/callee contracts, semantic models, native evaluation and outside code in its trust assumptions. It also permits fallback code; a successful build is not equivalent to a wholly verified executable. Its theorem begins at CLIF, not at a Wasm module.

Cajal's [Tau](https://caj.al/blog/introducing-tau) separately demonstrates the commercial proximity of Lean-proved binary optimization on x86 and ARM. Its performance results are vendor-reported. Together these projects substantially narrow the novelty of “every speedup is a theorem”; they do not establish that Wasm-to-AArch64 compilation is already solved end to end.

[D3](D3-lemma-gaps.md) identifies the remaining seam: Wasm validation and semantics, traps, address arithmetic, tables, host calls and the runtime ABI must connect to the backend theorem. Floating point and SIMD add further work. Its short schedule estimate assumes a reusable backend; the report found no clifv license, so reuse cannot simply be assumed.

The pain has direct evidence. Wasmtime's maintainers describe 12 April advisories, 11 found with LLM tools, including two Critical issues rated CVSS 9.0, and a stale verification model that missed a lowering change until updated. That supports keeping the proof and implementation synchronized. It does not prove that a proposed Lemma theorem would prevent every runtime escape. The two October compiler Criticals are rated 9.9; describing all four as 9.9 is incorrect. [Wasmtime's April security report](https://bytecodealliance.org/articles/wasmtime-security-advisories), [October SSA advisory](https://github.com/bytecodealliance/wasmtime/security/advisories/GHSA-897f-g5gm-fmxm), [October branch advisory](https://github.com/bytecodealliance/wasmtime/security/advisories/GHSA-mghf-wjfp-p5xm).

**Decision (I): Lemma remains the strongest fit if a narrow verified-compiler project is attractive in its own right.** Its convincing deliverable would be a real Wasm subset compiled to actual bytes, a checked theorem covering the executed path, explicit assumptions, and measured performance. Rebuilding an existing backend merely to make the scope larger does not improve the value case.

The recovered experiment in [D4](D4-lemma-value.md) gives a bounded positive result. Opus's restricted compiler, control-flow model and peephole variants pass Lean 4.35.0 with only the three standard axioms. Its optimized samples use 76→62 and 29→25 modeled instructions; these are not native timings. Fable's base proof passes, while its optimization extension fails and includes `sorryAx`. Neither artifact parses real Wasm, emits AArch64 bytes or validates its ISA model against hardware. The session-limit interruption leaves no certified timed comparison. The full project's one-shot test remains unresolved.

## Futamura

A verified shared middle end is established prior art. [Peregrine](https://github.com/peregrine-project/peregrine-tool/blob/master/README.md) connects Lean, Agda and Rocq to LambdaBox and multiple backends, including Wasm. Its verified middle end does not imply that every frontend and backend is verified. CakeML and CertiRocq add substantial adjacent work, detailed in [D5](D5-futamura-gaps.md).

The generic pitch still needs to show why automatic compiler generation and proof reuse deliver more than a shared backend plus an agent. Existing examples of valuable verified compilers do not, by themselves, establish demand for a Wasm-only compiler factory. Conversely, failure to find a buyer is not proof that no buyer exists.

[D6](D6-futamura-value.md) finds a more concrete technical need in Lean's native computation. A backend proof alone cannot repair incorrect erasure, primitive implementations or unjustified substitutions upstream. A meaningful project must address those boundaries. Calling it “CakeML for Lean” expresses the ambition, but does not make it a small extension to the original compiler-factory plan.

Combining it with Lemma also requires matching semantics, host interactions, resource-exhaustion behavior and memory-management contracts. A backend that itself trusts native proof evaluation does not automatically eliminate native evaluation from the combined trust base. A direct native path remains an alternative to introducing Wasm.

**Decision (I): drop the generic factory as the selected project. Keep trusted Lean computation as a separate research direction only if that larger scope is itself the desired work.** D6 recovers a runnable closure-converting compiler with seven matching examples, but its proof draft fails and depends on `sorryAx`. The experiment is closed as inconclusive/interrupted; it supplies neither a proven compiler nor evidence of model incapability.

There is also a crucial integration requirement: rerunning a computation and obtaining the same answer is an independent check, not discharge of a Lean axiom. Logical discharge requires a kernel-checkable proof of the asserted equation tied to the actual source and execution result. The alternative executor or certificate bridge must not silently introduce another unexamined trust assumption.

## What the round changes

The earlier summaries conflated three propositions:

1. Better models make a useful artifact cheaper to build.
2. The artifact continues to have value after those models improve.
3. The original builder has a durable commercial advantage.

These are different tests. A weak moat does not make a correct compiler useless, and the user did not require a venture business. Equally, a growing collection of generated code is not automatically an irreplaceable asset. The relevant comparison is the complete checked artifact against what a fresh agent can produce with the same public tools and evidence.

Nor does proving a small fragment in one prompt prove that a production compiler is one-shottable. A failed or interrupted 75-minute run proves even less about models one or two generations ahead. The future-model claims in these reports are estimates.

**My assessment against the actual brief (I):** Lemma has the clearest intrinsic artifact and builder fit, but a contested, narrower opening. Grow-install needs stronger evidence of net benefit from replacement, beyond evidence that rewrites can be wrong. Futamura's strongest surviving use is a substantially different Lean assurance project. This round supplies no unqualified replacement for GrowOS.

If choosing among these three, keep Lemma as the candidate for a deliberately narrow proof-to-bytes project. Resolve backend reuse and scope before treating it as a short build. Keep Grow-install conditional on a useful real-consumer demo and a fair agent baseline. Drop generic Futamura from the current shortlist. No additional experiments or maintainer outreach were performed as part of closing these reports.

## Reports and evidence

- Grow-install: [D1 prior art](D1-growinstall-gaps.md), [D2 value](D2-growinstall-value.md).
- Lemma: [D3 prior art](D3-lemma-gaps.md), [D4 value](D4-lemma-value.md).
- Futamura: [D5 prior art](D5-futamura-gaps.md), [D6 value](D6-futamura-value.md).
- Original task: [deep-dive brief](../BRIEF-deepdive.md).
- Experimental evidence is local and outside git. D2 uses `/Users/noah/.t3/scratch/2026-10-28-here-are-the-absolute-paths-a63c3f1b/d2exp/`; the Lean experiment paths and audit results belong in D4/D6.

The source checks in this continuation confirm the main prior-art relationships, not every number in the six reports. Publication statistics, vendor claims, local measurements and forecasts should retain those distinctions. No maintainer outreach has been performed.
