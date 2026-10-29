# Round 14: gap analysis (2026-10-29)

**Status: complete.** All ten G01–G10 reports, the 80 new transcripts, eight E20–E27 extractions and their combined
transcript synthesis are saved. GPT-6.1 recovered the interrupted software-oracle and paper reports, checked the new
source coverage and reconciled material conflicts after the Opus usage limit interrupted the round. This completes the
selected gap-analysis round; it does not establish that any domain is exhausted or that a candidate has passed every
project filter.

This thread fills gaps in the research. Other threads develop Lemma, Grow-install and the earlier finalists. The scope is the builder's selected gaps: defensive security, networking, graphics/new languages, inverse oracle search, re-filtering earlier rejections, a new source batch, and papers/issues. The [round brief](../BRIEF-gaps.md) retains the [tailwind filter](../BRIEF-tailwind.md).

**Evidence convention.** File counts below were measured locally on 2026-10-29. Report findings are attributed to their authors. Proposed artifacts, rankings and objections are synthesis judgments. Costs, performance goals and kill thresholds are estimates; none of the proposed prototypes or kill tests has been run in this continuation. A short prior-art search does not establish that an opening is untaken.

## 1. What was recovered and what remains

| Workstream | Output | Current state |
|---|---|---|
| Software oracle inventory | [G01](G01-oracles-software.md) | Complete: 50 entries, three developed pairings, and a corrective prior-art/DDC audit. No untaken winner established. |
| Physical/graphics/scientific oracle inventory | [G02](G02-oracles-physical.md) | Complete report: 54 public oracle systems; three developed pairings. |
| Re-filter old rejections | [G03](G03-resurrections.md) | Complete report: 468 inventory rows; three primary resurrections and three reserves. The approximate 1,000-idea count groups multiple ideas in some rows. |
| Defensive security | [G04](G04-security.md) | Complete report: four proposals. Cross-report and acceptance-policy caveats below qualify its recommendations. |
| Graphics and Goose | [G05](G05-graphics-languages.md) | Complete report: four proposals. Its float contract is narrower than its headline wording. |
| Networking and Homa | [G06](G06-networking.md) | Complete report: three conditional proposals; no established novelty claim. |
| PL/systems/verification/security papers | [G07](G07-papers-pl-systems.md) | Complete: 43 paper entries with checked quotation spans and plain explanations; 41 have a 2025–26 publication/preprint, two are labelled historical. |
| Other papers and issue trackers | [G08](G08-papers-trackers.md) | Complete report: 40 screened seeds, including 16 papers and 24 tracker/mailing-list entries; three conditional proposals. |
| New video curation | [G09](G09-videos-pl-systems.md), [G10](G10-videos-hw-games-sec.md) | Two batches of 40 selected video IDs, with URLs and metadata. |
| Transcription | `../transcripts/g1-*`, `../transcripts/g2-*` | 80 files, 40 per batch; 616,898 whitespace-delimited words including metadata. Earlier progress messages rounded this differently. |
| Extraction and synthesis | [E20](../extract/E20.md)–[E27](../extract/E27.md), [transcript synthesis](TRANSCRIPT-SYNTHESIS.md) | Complete: 3,322 signal records, six raw-caption quotation checks and targeted current primary-source audits. |

The current corpus directory has **232 files / 232 unique YouTube IDs**. The separate Cloudflare Connect directory adds
13 distinct IDs: **245 files / 245 IDs** combined, up from 165. The new batch has no ID overlap with the old corpus.
The new video queues total **60:35:01** by their metadata. Upload dates and conference dates can differ; eight uploads
are from 2024, 59 from 2025 and 13 from 2026. The parent reproduced the file, uniqueness, word and signal-row counts from
the counting code in the [transcript synthesis](TRANSCRIPT-SYNTHESIS.md). Signals can overlap in meaning and are not
3,322 independent ideas. Six quotation checks verify supplied caption text, not the original audio.

The initial commit `c3934ff3` saved the 80 transcripts, briefs and several reports. The continuation preserved the
extractions (`848f8108`), resurrection/security/graphics reports with assurance corrections (`4e60c7f6`), completed G01
(`969944d5`) and the transcript synthesis (`d939ceee`). The [status record](STATUS.md) tracks the recovery. Saving a
report is distinct from independently reproducing every experiment it cites.

## 2. What filling the gaps has changed so far

**The source gap has narrowed substantially.** The new batch adds PL verification, systems, hardware, games, defensive security, graphics and networking. The paper/issue work supplies written seeds as well as spoken predictions. This is a broader sample, not exhaustive coverage of those communities.

**Strong oracles are plentiful.** G02's 54 systems already disprove the idea that a shortage of references is the main obstacle. The hard question is whether a growing artifact provides useful, reusable capability beyond an ordinary port, existing generator or a strong model given the same reference. Every candidate needs that baseline.

**Changing the filter did not revive most old ideas.** G03 reports that about 98.5% of its 468 rows remain rejected or otherwise unavailable, with only three primary resurrections and three reserves. Treat that percentage as the author's classification of an inventory, not a measured probability of an idea succeeding. Most rejection reasons survive the new filter: active incumbents, dependence on other people, lack of a check, or work a prompt can already produce.

**Papers expose a useful recurring pattern.** G08 finds large combinations of cases around a smaller fixed contract: shape × trajectory, subtitle family × media operation, circuit state × interruption. Those can support accumulated artifacts, but a paper's future-work sentence alone does not show an open product or a solo-sized project.

## 3. Leads worth reading, with the missing evidence attached

This reading order is grouped by the builder's questions. Scores within the reports are judgments, not comparable
measurements; different auditors also rate the same idea differently. A lead below is a concrete research question,
not confirmation that all the solo/10×/tailwind/untaken filters have passed.

### Inverse search: bootstrap routes, with a sharply bounded claim

[G01](G01-oracles-software.md) completed 50 software-oracle entries; [G02](G02-oracles-physical.md) supplies 54 physical,
graphics and scientific entries. These are **104 inventory rows across the reports**, not 104 deduplicated independent
oracles. The useful output is the map of check strength, access, scope and possible artifacts—not a claim that every
reference must have an unoccupied project attached.

G01's provisional pick, **Thompson's Mirror**, grows an implementation capable of executing one selected compiler's
source, then retains a reproducible, inspectable route to a specified artifact. It overlaps G07's **Seedless** and must
be counted once. GHC's agent-assisted bootstrap, Kotlin work, Resid and longstanding bootstrap/DDC projects already
occupy much of the ground. Select one exact current artifact before claiming a missing route.

The assurance distinction is decisive: ordinary reproducibility means the selected builds agree; a source bootstrap
records a route from declared seeds; diverse double-compiling requires a justified diverse parent→target route and
checks a specified source/artifact correspondence under assumptions. A matching hash alone proves neither independence,
benign source nor universal compiler correctness. [Wheeler's DDC account](https://dwheeler.com/trusting-trust/)
supports that narrower interpretation. G01's Open Recalc and Last Copy alternatives are downgraded to potential upstream
contributions or baseline investigations because substantial engines/importers and benchmarks already exist.

### Fresh transcript lead: memory guarantees that survive compilation

The strongest new lead in the [transcript synthesis](TRANSCRIPT-SYNTHESIS.md#s01--source-facing-compiled-memory-bounds)
is a source-level proof of memory use that connects to the compiled program's heap/stack requirement. Magnus Myreen's
CakeML talk describes existing space reasoning as difficult to use; the auditor checked that caption in the raw minute
bucket. Existing CakeML compiled-space work and high-level garbage-collection separation logic provide two substantial
ingredients. The residual question is whether a useful source-facing join is still missing and can be built without
mirroring every compiler pass in user annotations.

This is narrower than the excluded generic verified-compiler/proof-agent ideas: the proposed value is a usable bound for
an executable, including roots, retention, GC, stack and external-call assumptions. It is also research-heavy—the
transcript auditor rates solo feasibility 2/5. No all-filter pass is established. Current CakeML code and subsequent
author work should be checked before implementation.

Two other transcript questions are concrete but heavily occupied: **Verilator incremental rebuilds** need an architectural
alternative to already-investigated stable C++ output; **cross-hook eBPF transitions** need one specific cooperating-state
case not covered by current interference/contract systems. Broad CPU ray queries are dropped: current Slang/slang-rhi
pull requests already implement that capability. An unsupported release matrix was an insufficient novelty check.

### Defensive security: Least-Authority Lockfile

[G04](G04-security.md) proposes a versioned record of the files, hosts, environment variables and process abilities each package may use. An agent proposes narrower wrappers and policy entries; a runtime enforces the accepted policy with the model disconnected. Its useful difference would have to be better, maintainable fine-grained policy, since per-package sandboxing and automatic policy generation already exist in [LavaMoat](https://github.com/LavaMoat/LavaMoat), and [NodeShield](https://arxiv.org/abs/2508.13750) already evaluates capability-based runtime enforcement.

**Synthesis reservation:** passing application tests, a necessity witness and a finite malware corpus does not establish that a new permission is authorized. A compromised package can exercise malicious behavior through a legitimate network or filesystem grant. The trusted contract must set limits on what may be granted; a denial is a request to investigate, not permission to expand authority automatically. Keep compatibility, containment and policy authorization as distinct checks.

**Decisive missing evidence:** compare narrowed policies against LavaMoat/NodeShield on the *same* applications and attack set, especially attacks that stay within legitimate capabilities. G04's suggested +10 percentage-point containment improvement is meaningful only if that baseline leaves ten points to gain; NodeShield's published historical-set result already exceeds 98%. Report blocked attacks, false denials and resource cost separately.

The runner-up, **Proven Package Gate**, is a machine-checked package proxy. Its theorem statements must cover exactly what the boundary promises. Memory-safe parsing by itself does not prove proxy isolation, safe dependency behavior, client agreement or absence of every vulnerability. Six-week scope in G04 is an ambitious estimate.

### Graphics and new languages: Twin, with a narrower semantic claim

[G05](G05-graphics-languages.md) proposes growing a Goose-to-GPU compiler pass instead of repeatedly maintaining handwritten shader strings and host layouts. Goose's CPU compilation supplies a differential reference. The [current Goose documentation](https://aardappel.github.io/goose/docs/stdlib.html) already documents its SDL3 GPU facilities and shader integration, so an ecosystem-from-scratch pitch is inappropriate.

**What could accumulate:** lowering coverage, generated layouts, backend-specific implementation work and a frozen device regression suite. Its closest risk is ordinary compiler work that Goose's maintainer or one strong model can already perform cheaply.

**Semantic correction:** G05's detailed contract requires bit identity for integers/booleans/memory layouts, but allows floating-point differences within declared backend precision. Its headline promise of “same bits” cannot be generalized to arbitrary floating-point rendering. Matching a finite CPU/GPU corpus is also not a proof over all programs. GPU fault records require an explicit ordering/observation contract when several invocations can fail.

**Decisive missing evidence:** the same three functions through a growing lowering versus one-prompt shaders, on the same hardware and comparison contract. Real-device results and software Vulkan results must be labelled separately. Checking the maintainer's roadmap is useful; contacting anyone remains a separate user-authorized action.

G02's **Sampler Foundry** grows reusable light-sampling methods under probability semantics. G05's **Shader Ladder**
grows simplification rules under a declared image-error budget. They share the need for strong existing baselines,
held-out scenes/shaders and real wall-time measurements, but their semantic contracts differ: preserving an estimator
is not the same guarantee as allowing a perceptual approximation. They are not independent confirmations of one idea's
novelty. Stochastic image comparisons require statistics, not exact pixels.

### Networking: HomaCore is a reuse experiment before it is a project

[G06](G06-networking.md) proposes a maintained Homa protocol core with explicit ownership/recovery contracts and stock-host adapters. Its strongest feature is a specific falsifiable objection: [userspace Homa already exists](https://github.com/PlatformLab/Homa). First establish whether reviving that implementation is cheaper than a new growing core.

The [reference module's change log](https://github.com/PlatformLab/HomaModule#significant-changes) documents a September 2026 granting change and `START_MSG`. A new implementation must pin its wire revision; reproducing the talk's old startup sequence is not current interoperability. “No custom kernel module” still does not imply unprivileged deployment or Workers compatibility. Loss/reordering tests establish only the tested scope, and throughput on localhost cannot establish datacenter tail-latency value.

G06's **CapsuleMachine** and **PacketSeam** remain reserves because existing QUIC/MASQUE and verified-parser work cover much of their machinery. None of the three has earned an unqualified novelty finding.

### Resurrections: Carve and Boxed

[G03](G03-resurrections.md)'s pick, **Carve**, grows language-specific SIMD lexer rules checked token-for-token against official lexers. It has a clear local baseline: full token output, not just byte scanning, with real-source and adversarial inputs. Its proposed advantage must survive against current lexers and a strong model given the same task. Python appears as a *language being tokenized* in its proposed experiment; the project's implementation need not be Python.

**Boxed** grows RLBox integrations for C libraries. Byte-equivalent behavior checks compatibility; they do not establish that validators enforce the intended boundary. Independent negative/security tests must target that boundary. This is adjacent to earlier rejected safety-retrofit ideas, so a concrete new integration benefit must be shown rather than inferred from a new name.

**Format Foundry** remains a lower-confidence reserve because OpenZL is close prior art. Its decoder round-trip checks losslessness, while speed/ratio must be compared with strong format-aware baselines.

### Papers: ContactForge

[G08](G08-papers-trackers.md)'s strongest lead grows reusable collision-algorithm specializations for curved moving shapes, accepted through conservative enclosure checks. The appeal is an executable family of algorithms, not a model answering one geometry question.

The [MiSo paper](https://huangzizhou.github.io/assets/img/research/miso/solve_minimize_dsl_tex.pdf) already generates conservative geometric solvers and reports nonlinear collision examples. That is a major existing capability, not just a nearby name. ContactForge needs a held-out family-level improvement over MiSo/IPC, a small correctly specified checker, and a useful fallback when it cannot resolve a case. A pretty collision demo alone is insufficient.

**CaptionCircuit** and **PauseProof** are secondary paper leads with strong existing baselines: GStreamer/FFmpeg subtitle work and EPOCH/checkpointing tools, respectively. Their remaining gap is conditional.

[G07](G07-papers-pl-systems.md) adds 43 checked paper entries with plain explanations of what each paper built, its
remaining limitation and the strength of its check. Forty quotation spans are complete sentences/sentence groups;
three are labelled excerpts. Its strongest original lead, Seedless, merges with G01 rather than becoming another
winner. **Tilework**, a static translation extension, remains on hold: Elevator, MirrorBall and libLISA closely overlap
the mechanism, and the report establishes no valuable blocked workload or available extension framework. Broad
**Rebuild Doctor** is dropped because Google's actual agent implementation supplies direct prior art.

## 4. Reconcile these conflicts before choosing anything

1. **Rebuild Ratchet is not a fresh recommendation.** G04 still lists it conditionally, but G03 identifies Google's agent-assisted OSS Rebuild as satisfying its own kill condition. Treat it as rejected unless a *different, demonstrated* missing capability remains. G01 also recognizes this collision.
2. **Immutable checker does not mean complete oracle.** An agent unable to edit tests can still overfit them. A small checker can faithfully check an insufficient specification. Distinguish mathematical proofs, exact discrete differential checks, numerical/statistical checks and physical measurements.
3. **A ratchet can preserve a mistake.** Keep evidence and prior working versions, but permit revocation when a new counterexample appears. Tests do not make accepted behavior permanently correct; proofs retain their claim only under their stated specification and assumptions.
4. **Independent agent picks are hypotheses.** Similar grow/check/keep wording is not independent evidence of feasibility, demand or novelty. Reusing an existing reference is a technique; the accumulated useful capability and cheaper verification must be demonstrated.
5. **No benchmark targets are results.** G02's sampling gains, G03's lexer speedup and G04's containment targets have not been measured here. Costs and timelines should not be quoted as established facts.

## 5. Which gaps are filled, partial or still open?

| Requested gap | What this round added | What remains unresolved |
|---|---|---|
| Inverse oracle search | 50 software and 54 physical/scientific inventory entries, with oracle strength, access and growth pairings | Which pairing yields a valuable capability beyond existing implementations; no oracle inventory proves an untaken opportunity |
| Re-filter earlier rejections | G03's 468-row classification, three primary resurrections and three reserves | Independent feasibility/novelty checks for the survivors; the row classifications are research judgments |
| Defensive security and worms | Incident/defence map, per-package capability-policy and package-gate leads, existing-runtime baselines | Owner intent as the permission oracle, within-grant behavior, corpus access, matched containment/compatibility measurements |
| Networking and the Homa talk | Current-wire correction, three scoped leads, existing userspace baseline | Reuse versus new core, privilege/deployment burden, real-network recovery and tail-latency evidence |
| Graphics and new languages | Goose GPU lowering, sampler/simplification leads, current compiler/renderer prior art | Useful accumulated semantics beyond cheap ports; hardware coverage and numerical/fault contracts |
| New source communities | 80 unique videos; PL/systems, hardware/EDA, games, security, graphics and networking now have substantive representation | Representativeness, repeated-speaker/venue bias, omitted slides, English-caption selection and current roadmap changes |
| Papers and issue trackers | G07's 43 paper entries; G08's 16 papers and 24 tracker/mailing-list seeds | A future-work statement is not a current opening; counts are report entries, not a cross-report deduplicated bibliography |
| Choosing a validated project | Concrete research questions and explicit reasons to stop | No implementation/kill test was run; no candidate has an independently established pass through every filter |

**Source gaps outside the selected expansion remain visible, rather than silently counted as covered.** Audio/DSP appears
incidentally in game sound, FFT and bus examples; it lacks a dedicated practitioner sample. Embedded coverage includes
CHERIoT, energy-harvesting firmware and peripheral models, but is incomplete. Robotics has no dedicated community sample,
and the 80 fetched texts provide no direct non-English source coverage. This identifies the boundary of this round;
it does not automatically authorize or recommend another broad source round in fields the builder chose to leave aside.

**The important remaining gaps inside the selected scope are specific:**

1. **Oracle adequacy:** what property must hold, who specifies it, and how does the check cover the actual deployed
   artifact? Permission intent, numerical approximation, hardware timing and compiler trust routes each need a distinct
   answer. Freezing a checker cannot supply missing semantics.
2. **Baseline and reuse:** compare with the incumbent implementation and a strong model given the same task, inputs and
   budget. A large generated artifact is not evidence of durable advantage. Some leads are valuable upstream work rather
   than separate projects; the research should be allowed to reach that conclusion.
3. **Current-state checks:** distinguish requested, designed, in an open PR, merged and released. The Slang CPU-ray-query
   case shows why reading only a support matrix or old talk misses active work. Old issue age is similarly weak evidence.
4. **Model timing:** the round uses a tailwind hypothesis, but does not measure it across model generations on the same
   fixed tasks. No evidence here predicts when a future model will erase a particular workload's engineering cost.
5. **Independent replication:** quoted performance, coverage and incident counts remain their authors' results unless
   explicitly marked as locally reproduced. No prototypes, performance benchmarks, incident replays, contacts or multi-day
   kill tests were performed as part of this continuation.

The next useful action is a bounded check of an exact residual, not another unfiltered list of ideas. Examples are one
source-to-compiled memory-bound join, one justified compiler stage comparison, or one policy-intent boundary. Existing
idea-development threads can use this evidence without this thread starting duplicate implementations.

## 6. Reading order and verification

For the new source evidence, start with [TRANSCRIPT-SYNTHESIS.md](TRANSCRIPT-SYNTHESIS.md). For the builder's selected
questions, read G04 (security), G06 (networking) and G05 (graphics/Goose); then G01/G02 for the inverse search, G03 for
resurrections, and G07/G08 for written-source seeds. G09/G10 are the acquisition provenance, not idea recommendations.

The continuation checks inventory/cardinality and source-ID uniqueness, local file links, quotation provenance reported
by the auditors, material cross-report conflicts and whitespace. It does not independently reproduce every paper result
or validate every historical report claim. Report-specific search audits and explicit limitations remain part of the
deliverable. Unrelated research, reviews and implementation changes from other threads remain outside these commits.
