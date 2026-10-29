# Corpus summary: 165 videos, mined for gaps, then filtered for 100–1000× ambition (2026-10-28/29)

**Historical filter:** this summary records the earlier 100–1000× round. Its institutional recommendations were
subsequently rejected; the current filter is solo-buildable, about 10× ambition, clear value and model tailwind.
Start with [`tailwind/SUMMARY.md`](tailwind/SUMMARY.md) for round 13 and [`gaps/SUMMARY.md`](gaps/SUMMARY.md) for the
completed round-14 gap analysis. The text below is retained as the record of the earlier round.

**Verified** means I checked the quote in the transcript or the source myself. Everything else is the agents' research,
labelled in their reports.

## 1. What was done

| Phase | Input | Output |
|---|---|---|
| Transcribe | 3 playlists: Cloudflare Connect 2026 (13), the builder's playlist (88), playlist 3 (73). 165 videos with captions, about 1.4M words | [README](README.md), `transcripts/`, `../connect26/transcripts/` |
| 1. Extract | 19 GPT-6.1 agents read every line | `extract/E01–E19.md`: about 6,500 signal rows (predictions, wishes, pain, hand-rolled tools, limits, disagreements, practices; ambition and bottleneck tags in E12–E19) |
| 2. Synthesise | 7 agents, by theme, over all ledgers | `synthesis/S01–S07.md`: about 150 projects of every size, a 1,917-row predictions board (S05), and an adversarial check of the lead's own patterns (S07) |
| 3. Ambition | 9 agents, one per "what stays hard when code is free" lens, plus a critic | `ambition/A01–A09.md`, under [BRIEF-ambition](BRIEF-ambition.md): the one-shot test and the 100–1000× test |

## 2. The headline

**No tool-sized idea from any round survives the builder's ambition filter** (A09, after auditing 131 ideas from all
11 rounds and this corpus). Witnesses, rehearsals, conformance fixtures and benchmarks are all one-prompt code for the
next model. A09 counts 20 directions that pass both tests as ambitious programmes. They all share one shape:

> **An institution that accumulates verified real-world evidence. "The runner is expendable. The accumulating evidence
> is the asset."** (A02)

The non-code value is always one of these, and none of them can be produced from a prompt:
- **real runs:** package behaviour, scientific results;
- **physical measurements:** fits across printers and materials;
- **human decisions:** judgment precedents;
- **people:** stewards, maintainers, participating scientists.

The template comes from the corpus itself. Richard Campbell on AlphaFold (p3-32, verified): "He computed the 200 million
most common protein fold sets possibly needed and published them for free. And changed medicine fundamentally."

## 3. The convergent signals that led here (all quotes verified)

1. **Human attention and judgment are the scarce resource, and better models make it worse.** At least 13
   practitioners across 7 channels (S07 §5). Will Larson: "their attention runs out before their ability to write code
   does". Armin Ronacher expects to *hide* tool output (S01). An agent shimmed two incompatible human-approved designs
   together (S02).
2. **Rewriting is cheap; knowing what to preserve is not.** Theo: "I have not read a single line of code" ($420k
   TypeScript→Rust). Dillon Mulroy: "language doesn't matter. Rewriting does", grounded in an existing conformance
   suite. The scarce asset is the oracle (A03).
3. **Seeds of the GrowOS kind exist.**
   - Pizlo (Fil-C, p3-23 46:00): audience: "why is this Fil-C and not Fil-everything that targets LLVM IR?" Pizlo:
     "Send patches."
   - de Moura (Lean, p3-45): "AI synthesizing the code and [proving] that the code… meets your specification".
   - Cyrus Omar (p3-19 47–48:00): "something like Wikipedia where the whole system is a live program being edited by
     thousands of humans and AIs".
   - Tobi Lütke (p3-65 12:00): "it's just computers to fulfill our wishes", about his son designing and 3D-printing
     fidget spinners that sell in a store.
4. **People may want finished software, not malleable software.** Ben, after an hour tailoring a family display: "And
   I'm good… I don't think I'm going to go tweak it much more" (#80, verified).

## 4. The picks, ranked for this builder

| # | Direction | Sources | Why it passes | Six-week first step | Cost | Fit |
|---|---|---|---|---|---|---|
| 1 | **Package Behavior Atlas → executable account of web/JS compatibility** | A02 pick; A09's ONE pick (B20); E19 independently ("executable ecosystem specification") | Accumulated downstream observations; the oracle every rewrite needs | 40 packages × 8 releases × 3 downstream contexts × 2 Node versions × 3 repetitions = 5,760 runs. Publish the witnesses and one undocumented downstream dependency, reproduced by an outside maintainer | ~$570 (cap $1,000) | Strong: sandboxed execution at scale |
| 2 | **Fil-everything: one memory-safety boundary across LLVM languages** | A03 pick; A09 #2 (B06); E14 | Semantics that independent maintainers accept, plus a continuously rebuilt safe ecosystem; the author openly invites it | A Fortran/C app where an allocation crosses languages and back with its capabilities intact; hostile cases; an independent rebuild. Two-day stop test | $2.3–7k (cap $10k), 60–90 h | Excellent: kernel, VMM, compiler background |
| 3 | **Replicated software-methods laboratory** | A09 #3 (B02); E16; stack round's RigorBench, scaled up | Real, sampled outcomes over time; settles "does rigor/framework X help?" with evidence | One workflow, two implementations, one hypothesis about maintenance under hidden change | — | Medium |
| 4 | **Judgment compiler** | A04 | The owner's approved precedents; addresses the strongest convergent pain | 30–50 maintainer decisions → 6 bounded policies; beat both ordinary review and "strong model plus retrieved history" by ≥5× accepted work per human hour | — | Medium; most exposed to the next model |
| Crazy | **Live computational commons** | A01, A05, A09 (B03); Cyrus Omar | Community-calibrated models and observations | Two independently maintained models sharing typed modules; broken drafts contained | — | Excellent runtime fit; needs domain partners |

Other lens picks, all passing both tests, with weaker fit:
- **A05:** a continuously executable scientific record. Closest funded effort: CODECHECK (NWO, 2026–28).
- **A06:** an open repair and fabrication network. Hardest constraint: fit and strength across printers and materials.
- **A07:** "software mutuals" (community stewardship of personal software after its maker leaves).
- **A08:** a commons of outcomes for small local task models. It must reach **≤1% of the cloud cost**, all-in, to be
  100×. Idle-device compute is only partly revived: browser sharding manages "three or four tokens per second".

## 5. My recommendation

Picks 1 and 2 fit together.
- **The Atlas** records what the ecosystem actually depends on.
- **Fil-everything** (and every other herculean rewrite) needs exactly that as its oracle.

**Start with the Atlas.** It is the cheapest (~$570), the most native to the builder's skills, and needs no permission
from anyone. Its first output, a downstream dependency nobody documented, is publishable on its own.

**Run Fil-everything's two-day stop test in parallel.** Its author has publicly said "send patches", and the builder's
compiler and kernel background is unusually suited to it.

## 6. Risks and lessons

- **The real risk moved from "taken" to "adoption".** Every survivor needs participants: maintainers, scientists,
  households. Code is no longer the hard part, by design. Each first step therefore includes an outside party
  reproducing or accepting a result.
- **The speaker of a seed is often already building it.** Cyrus Omar's group has Fairground (2025). Cloudflare speakers
  describe Cloudflare's roadmap. Treat a seed as a direction to join or extend, not a gap to claim.
- **Talks yield pain, podcasts yield predictions, and the ambition filter yields institutions.**
- **Gaps:** #27 and #81 of playlist 2 and #41–43 of playlist 3 have no captions. All costs and thresholds are the
  agents' estimates. Nothing has been built.
