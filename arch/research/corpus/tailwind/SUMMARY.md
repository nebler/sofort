# Round 13 summary: the tailwind round (2026-10-29)

Brief: [../BRIEF-tailwind.md](../BRIEF-tailwind.md). There were 8 agents:
- **Opus 5.5, max effort:** T01–T04;
- **GPT-6.1-Sol, xhigh:** T05–T08.

About 41k words in total. **Verified** means I checked the quote against the transcript myself. Prior-art claims are the
agents' own and are labelled in their reports.

## The filter
1. **Model tailwind:** the idea gets better with each model release.
2. **One-shot test.**
3. **About 10× ambition.**
4. **Solo.**
5. **No users needed.**
6. **No Python.**
7. **Not taken, not GrowOS.**

## The shape that emerged
All eight agents independently converged on the same three-part loop. It is GrowOS's loop, generalised:

1. **A missing capability triggers growth.** In GrowOS the trigger is ENOSYS. Here it is a missing library function, a
   missing Wasm lowering or optimisation, an integral the CAS can't do, or a world law that doesn't exist yet.
2. **An oracle the agent cannot edit checks the result.** The candidates are the original package running in an isolated
   sandbox, the Wasm reference interpreter plus a Lean proof, a Lean proof by itself, or byte-exact replay of recorded
   sessions.
3. **A ratchet keeps what passes.** The grown artifact runs with no model at all, and each model release can only add to
   it.

The tailwind comes from point 3. A better model proves or absorbs more, and nothing it accepted before gets undone.

## Ranked picks

| # | Idea | Agent | Grows | Oracle | Seed (verified) | Kill test |
|---|---|---|---|---|---|---|
| 1 | **Grow-install / Unfinished Library**: a package manager that grows the dependency functions your code calls instead of downloading the package | T01 (Opus) **and** T08 (GPT), independently | Individual library functions, written in your repo, then catalogued and reused | The original package in a sandbox, checked by differential fuzzing, replayed calls and mutants | Ben Davis (32, 12:00): Effect at "no dependencies because they can do all of it with AI"; Latent Space (49, 11:00): "own the dependency"; Greef (p3-35): "supply chain attacks are going to be the next swing"; Ree (11, 1:03): "I don't need all of it" | 20 functions × 1M differential checks, about $300 over 3 days (E) |
| 2 | **Lemma: a Wasm→AArch64 compiler where every speedup is a theorem** | T02 (Opus) | Instruction lowerings and optimisations, kept only with a proof *and* a measured speedup | Lean, the Wasm reference interpreter and the CPU | de Moura (p3-45, 1:02): "when you have proofs it enables optimizations for free"; Nerd Snipe (14): "LLVM might be a target soon" | 2 days: can today's model prove a register allocator end to end? |
| 3 | **GrowCAS: computer algebra where every answer is a Lean theorem** | T04 (Opus) | General rewrite rules, added when the test corpus stumps the CAS | Lean (each rule states the domain where it holds) | Omar (p3-19, 1:02): "billion dollars… to build a standard library"; de Moura (p3-45) | 300 problems from Rubi's test suite: do the proven answers generalise into rules that solve held-out problems without a model? About $300 (E) |
| 4 | **GrowWorld: a 2D world that grows its own laws of physics** | T03 (Opus) | Laws, written in a law language that conserves mass and heat by construction | Byte-exact replay of every recorded session | Ben Davis (14, 0:59–1:01): "the shape of something with a verification function"; Tobi (p3-65): "computers to fulfill our wishes" | Grow 150 laws, then blind-compare against a sandbox the strongest model one-shots. 2 weeks, $200–500 (E) |
| 5 | **DeltaForge:** a dataflow engine that grows its own incremental algorithms | T07 (GPT) | Delta/update algorithms for custom operators | Batch-definition equivalence | dbt (03, 10:00); Gillilan (p3-34, 1:20) | 2-day baseline: do existing engines already close the gap? |
| 6 | **NativeTxn:** native capabilities grown inside commit-or-discard capsules | T05 (GPT) | Native-module capsules | Transactional host contract | Blow (p3-37, 1:27–1:28) | Two library families; risk that it collapses into ordinary staged wrappers |
| 7 | **Interaction Foundry:** UI behaviours grown and reused across apps | T06 (GPT) | Interaction/edit modules | Behavioural requirements | SAP (14:00), Syntax (32:00) | Can the same behaviour carry between two different host apps? |

**Runners-up, in the reports:**
- **T01:** Transplant (grow a young language's standard library against npm originals) and Cutover (grow a self-hosted
  copy of the slice of a SaaS API you use);
- **T02:** Futamura (grow a proven compiler from an interpreter; includes a verified Lean compiler) and Soundcheck (a
  TypeScript subset proven sound);
- **T03:** Lockstep (clean-room game mechanics matched frame for frame) and Glitch Frontier;
- **T04:** Proven Handbook (DLMF formulas in Lean) and Implication Atlas;
- **T05:** SplitActor and LiveImage;
- **T06:** File Surgery and Task Continuations;
- **T07:** ByteGarden and ProofSkip;
- **T08:** Living Workbench and Growing Build Rules.

## Why this order
- **#1 is the only convergence across models.** Opus and GPT reached it separately, from different seeds. It also has
  the cleanest oracle (the original package is the spec) and a tailwind from both directions:
  - bigger models absorb bigger dependencies;
  - every npm worm (axios on 2026-03-31, Shai-Hulud) raises the value.

  Risk: close prior art (nirdep, Harp, 2026 regeneration work) and the one-shot question, i.e. whether a future model
  just writes the function inline. The answer is the catalogue plus the checks, but the kill test must show it.
- **#2 has the strongest pure tailwind.** Proofs are a ratchet: a theorem never gets less true. It is also the closest
  fit to a compiler/kernel builder, and the tailwind is visible in 2026: Basis's verified-compiler attempt failed in
  March–April, and MIT's Axon delivered one for a small toy language two months later. Risk: today's model may not yet
  prove the optimisations that matter.
- **#3 is #2's mathematical twin.** The prior-art search found that formal proof is crowded (AlphaProof Nexus, Lean Pool,
  Tao's repositories) but proven *computation* is open.
- **#4 is the most fun and the best demo.** Its kill test is the softest: "interesting" is a judgement call.
- **#5–7 are narrower mechanisms.** The GPT agents themselves rated their novelty as uncertain.

## What died this round (agent-sourced, dated 2026)
- **Bespoke per-app compilers:** Theo's `lust-lang`; four agent-built Rust toolchains, per Charlie Marsh, 2026-10-21.
- **Fake services and digital twins:** StrongDM, Pome, AgentTwin.
- **Byte-exact game decompilation:** momo5502, Melee, Snowboard Kids 2.
- **Workload-specific databases:** Bespoke OLAP (VLDB'26).
- **Proven rewrites of C libraries:** lean-zip.
- **Proven OEIS and archives of formal proofs:** AlphaProof Nexus, Lean Pool.
- **On-demand game content:** Moonlake, Meshy, Roblox 4D.

## Caveats
- I verified 9 key seed quotes. The agents report checking all of theirs.
- I have not verified the prior-art claims myself. The most load-bearing to check next are nirdep, Harp, lean-zip, Axon
  and Basis.
- Every cost and threshold is an agent estimate. Nothing has been built.
