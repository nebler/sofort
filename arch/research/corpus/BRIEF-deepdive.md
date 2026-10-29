# Brief, round 14: a deep dive on the two finalists (2026-10-29)

Read first:
- `tailwind/SUMMARY.md`;
- your idea's source report: `tailwind/T01-seed-hunter.md` and `tailwind/T08-self-extending.md` for Grow-install, or
  `tailwind/T02-languages-compilers.md` for Lemma;
- `BRIEF-tailwind.md`, which gives the builder's filter: model tailwind, the one-shot test, about 10× ambition, solo, no
  users needed, no Python, not taken, not GrowOS.

The builder is a solo platform engineer. They have built a Rust aarch64 kernel (jitk), a VMM, a TypeScript compiler,
Cloudflare/Wasm work and Lean-adjacent work. They liked GrowOS because "it has a clear value proposition that holds up
and even gets better when the models get stronger."

## The two finalists
- **Grow-install:** a package manager that grows the dependency functions your code actually calls, instead of
  downloading packages. Each function is checked against the original package running in an isolated sandbox
  (differential fuzzing, replayed calls, mutants), then kept in a reusable catalogue.
- **Lemma:** a Wasm→AArch64 compiler written in Lean where models grow every lowering and optimisation. A change is kept
  only with a machine-checked semantic-preservation proof and a measured speedup.

## Two kinds of investigation
- **GAPS (prior art):** an adversarial search for anyone already doing this or most of it, dated 2026. Use GitHub, npm or
  crates, arXiv, HN, X, company blogs and conference programmes. Verify each named neighbour yourself:
  - Grow-install: nirdep, Harp, 2026 regeneration work, Socket/Aikido, Deno/JSR, "vendoring with AI",
    micro-dependency removal tools (e18e), and anything that replaces dependencies with AI.
  - Lemma: Axon (MIT), Basis, CertiCoq-Wasm, vWasm, Arrival/Cranelift verification, Talos, CompCert, CakeML, Vellvm,
    WasmCert, Iris-Wasm, and agent-built verified compilers.

  For each neighbour: what exactly it does, how far it got, whether it is active, and what precisely is left. End with a
  verdict: **Open / Narrow opening (say exactly where) / Taken**.
- **VALUE (does it matter):**
  - Who would care if it worked, and how much? Ground this in real evidence: incidents, costs, numbers, practitioner
    quotes from the transcripts (`transcripts/`, `../connect26/transcripts/`) and the web.
  - Steelman, then attack, the tailwind claim: does the next model make this *better*, or does it make it pointless
    (for example, "the model just writes the function or compiler on demand")?
  - Test the one-shot claim concretely.
  - Estimate the realistic ceiling at 1 year solo and at 3 years.
  - What is the most impressive demo at 6 weeks, and what would a sceptical expert say about it?
  - Is the value real without users?

  End with a verdict: **Strong / Real but narrow / Weak**, with the main reason.

## Output
Write ONLY your assigned file, `arch/research/corpus/deepdive/<file>.md`. No other edits, no commits.

Labels:
- **Q**: quoted;
- **F**: sourced (with a link);
- **I**: inference;
- **E**: estimate.

Be adversarial and honest; the builder would rather kill an idea now than in month three. End with a 5-line TL;DR.
