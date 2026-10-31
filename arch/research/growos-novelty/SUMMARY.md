# Is GrowOS new? (2026-10-31)

Three desk-research reports (GPT-6.1-Sol): [01 prior art](01-PRIOR-ART.md),
[02 hard number](02-HARD-NUMBER.md), [03 showcase](03-SHOWCASE.md).

## Verdict

- **"An agent builds a (Linux-compatible) kernel" is taken.**
  - OSFoundry (2026 preprint): agents build and evolve an xv6-derived OS.
  - Ginux (October 2026): a human-directed agent builds a Rust x86-64 kernel
    with a Linux personality that boots Rocky 10 systemd.
  - LEMU (August 2026): LLM-synthesized QEMU instruction rules, checked against
    hardware with held-out tests. The closest method precedent.
  - gVisor has long grounded compatibility in real Linux behaviour.
- **No exact public match** was found for GrowOS's complete arrangement: sealed
  held-out probes, a real-Linux differential oracle as the acceptance gate,
  mutant rejection, independent host tests and source validation.
- **The defensible contribution is narrower:** a measured case study of
  kernel growth plus the acceptance methodology, including its failures. Four
  gate-accepted handlers were excluded by hand, and the reference itself was
  Docker Desktop (docs/results/oracle-recordings.md).
- **Correction:** the phase-2 gain is 4.0% → 81.0% on comparable programs, with
  610 held-out programs newly passing. The 11% figure was a different
  layout.
- **No cost number exists.** 30 agent calls and 1.47M input tokens are
  recorded; human time, dollars and wall time are not. The proposed headline is
  the hand-written/GrowOS all-in cost ratio at identical verified
  compatibility. A convincing target is ≥3×, independently verified.

## What reviewers will demand

Gate ablations (what each gate catches), stronger held-out histories,
reproducibility from a clean checkout, and a productivity comparison against
hand-written work.

## Next, if we pursue it

Showcase: **SQLite with writes and rollback journals** on a per-run scratch
filesystem (Stage 1), grown automatically, with full cost logging from the
first attempt.
- 100/100 frozen file workflows byte-identical to Linux.
- 32 transaction assertions derived from SQLite's own tests.
- 200 filesystem histories with zero regressions.
- 10,000 reset sequences with no leaked state.

Estimated 15–30 engineer-days. ripgrep is second.
