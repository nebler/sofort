# 06 — Giants: what the great computer scientists left unfinished, and what 2026 changes

Lens: both A (graveyard) and B (needed more than ever), read through people. 2026-10-28.
Labels: **F** sourced · **M** measured · **I** inference · **E** estimate.

## 0. Up front

- **The one sentence that explains the whole round is Lampson's, from 1983.** "A hint, like a cache entry, is the saved
  result of some computation. It is different in two ways: it may be wrong … Because a hint may be wrong, there must be a
  way to check its correctness before taking any unrecoverable action. It is checked against the 'truth'" (Lampson,
  *Hints for Computer System Design*, 1983, §3; quote checked against the PDF) **F**. In Lampson's sense, a model's
  output is a hint. Old ideas flip exactly where a cheap "truth" exists to check the hint against. That is GrowOS's
  Linux oracle and this brief's "oracle" field. Lampson also wrote "Plan to throw one away; you will anyhow" (ibid.)
  **F**. With agents, throwing away a thousand drafts is cheap.
- **Lens A has a confession from one of the giants.** Rob Pike, 2000: "To be a viable computer system, one must honor a
  huge list of large, and often changing, standards: TCP/IP, HTTP, HTML, XML, CORBA, Unicode, POSIX, NFS, SMB, MIME,
  POP, IMAP, X, …". The slides estimate that "90-95% of the work in Plan 9 was directly or indirectly to honor
  externally imposed standards" (*Systems Software Research is Irrelevant*, 2000-02-21) **F**. That is the brief's
  thesis, stated by the author of Plan 9: new systems died from compatibility labour, not from bad ideas.
- **Hamming supplies the ranking rule.** A problem is important only if "you have a reasonable attack" (*You and Your
  Research*, 1986) **F**. Most items below were always important. The question is whether 2026 supplied the attack.
- **Ranked by how ripe they are** (has the blocker actually gone?):
  1. Lamport, specs before code
  2. Hoare/Dijkstra, verification
  3. Kay/Wirth, lean systems
  4. Miller/Dennis–Van Horn, capabilities
  5. Miller–Drexler, agoric markets
  6. Plan 9 namespaces
  7. Nelson, provenance

  Ripeness is not opportunity. #1 is being executed well already: Specula won the TLA+ Foundation/NVIDIA GenAI challenge
  and reports 382 bugs in 67 projects **F**. #2 is crowded.
- **The one bet is the Kay–Wirth compression loop, gated by Liskov's substitution rule.** Agents rewrite a system to be
  as small as possible. Every candidate must stay behaviour-identical to the original on a held-out corpus. Agents
  currently make code *bigger*: FastRender is 1–3M lines, and Anthropic's agent-built C compiler is ~100k lines **F**.
  Kay's STEPS asked for "personal computing … from the end-user down to the metal" in 20,000 lines and ran out of funding
  and labour in 2012 **F**. A size objective with an oracle is the part nobody I found is running.

---

## 1. Kay, Wirth and Hoare: lean systems (STEPS), with Liskov substitution as the acceptance test

**The idea.**
- STEPS (Viewpoints Research Institute, NSF grant 0639876, 2006–2012) set a 20,000-line budget for the "runable
  meaning" of personal computing "from the end-user down to the metal". The aim was 3–4 orders of magnitude less code than
  current practice (VPRI 2007 and 2010 reports) **F**.
- The 2012 final report frames the problem: "a typical desktop OS and commonly used application suite amount to over 100
  million lines of code", and "much of this complexity is 'accidental'". Its Frank document editor, KScript compiler and
  FRP evaluator came to "about 10,000 lines" (VPRI TR-2012-001, Oct 2012, read from the PDF) **F**.
- The method was DSLs plus meta-compilers: OMeta and Maru; Nile for graphics in a few hundred lines; a tiny TCP/IP built
  by "non-deterministic parsing" (2007 report) **F**.
- Wirth made the same plea in IEEE Computer, Feb 1995 (*A Plea for Lean Software*), citing Reiser's law that software
  gets slower faster than hardware gets faster **F**.
- Hoare, 1980 Turing lecture: "make it so simple that there are obviously no deficiencies … The first method is far
  more difficult" **F**.
- Liskov (1987) supplies the acceptance rule. S may replace T if "for all programs P defined in terms of T, the
  behavior of P is unchanged when o1 is substituted for o2" (*Data Abstraction and Hierarchy*) **F**. Read "all programs
  P" as the corpus and you get GrowOS's gate.

**Why it died.**
- STEPS was a "science project" (its own heading) that ended with the grant. Frank was demonstrated but never shipped as
  a usable system **F**.
- Oberon stayed a teaching system. Pike's 90–95% figure explains why: a lean system that does not honour the long tail
  of standards gets marginalised **F**.
- Lean code costs more expert labour per line, not less. "The first method is far more difficult" (Hoare) **F**.

**What flipped.**
- *Labour.* The long tail is now agent work. Anthropic's 16-agent team wrote a C compiler that builds Linux 6.9 on three
  architectures in about two weeks, for about $20k. It used GCC as the oracle, compiling random subsets of the kernel
  with each compiler **F**.
- *Lens B: agents produce bloat.* Cursor's FastRender browser is 1M to 3M lines depending on who counts; The Register
  reported it did not compile cleanly **F**. A 2026 Harvard study found agents raise lines of code ~30% while issue
  resolution "barely moves" **F** (secondary report).
- *Lens B: human and verifier attention is fixed.* Proof effort grows with code size. seL4 needed ~20 person-years
  (brief's calibration).
- *Consequence.* Code got cheaper to write and stayed just as costly to understand and verify, so size is the cost to
  minimise **I**.

**Oracle: strong.**
- The original system is the oracle, as in GrowOS. Run differential tests on a corpus with a held-out split, plus
  fuzzing.
- The size metric needs care. Count zstd-compressed source bytes *including* any DSL implementation; Kay counted the
  meta-tools too.
- Add a second metric that is hard to game: the tokens a fresh agent needs to land held-out change requests. This puts
  a number on "understandable".

**Superhuman-model test: more valuable.**
- Better models generate more code. They are also better compressors.
- Size still prices the parties who don't have the model: auditors, regulators, a weaker reviewing model, cold starts,
  bundle limits, attack surface **I**.
- Risk: if a superhuman model can verify 3M lines as cheaply as 20k, the human-readability argument weakens. The
  attack-surface and verification-cost arguments do not **I**.

**Who is already doing it.**

| Work | What it does | Gap |
|---|---|---|
| Chisel (Heo et al., CCS 2018) | Reinforcement-learning-guided debloating against a property test, on UNIX utilities of 13–90 KLOC **F** | Removes features; doesn't rewrite to preserve all behaviour |
| C-Reduce / delta debugging | Shrinks code while keeping a single property | Not whole-system behaviour |
| TRIM (2026) | Minimises agent *patches*, up to 32.9% of the "CodeSlop" **F** | Patch-level only |
| CodeScene agent refactor | 300k lines refactored for ~$4k **F** | Optimises "code health", not size |

I found nobody running whole-system, behaviour-preserving compression as an objective, with an oracle. That rests on my
searches only; it is not a claim to be first.

**Value.**
- Smaller trusted computing base for regulated or embedded code, and cheaper formal verification afterwards ("compress,
  then verify", linking to item 3).
- Workers and edge bundle size and cold-start time.
- The supply-chain argument (fewer lines, fewer dependencies).
- Buyers are security and compliance teams and platform vendors. The size of that market is unknown. Plausibly a
  services and tool market, not a platform **E**.

**2-week proof.**
- Use the GrowOS loop with the gate inverted: fault → *shrink* proposal → differential test → accept only if the
  metric drops and all visible and held-out cases stay byte-identical.
- Targets with strong public oracles:
  - YAML 1.2 (yaml-test-suite plus differential fuzzing against libyaml), or
  - CommonMark (spec examples plus differential fuzzing against cmark), or
  - GrowOS's own grown syscall layer against Linux.
- Measure the baseline with cloc first. Take the smallest *compliant* human implementation as the bar.
- Rust or TS; no Docker needed.

**Demo, tweet, kill.**
- *Demo:* a live counter of lines and bytes falling while the pass rate stays pinned at 100%, then a held-out change
  request landed by a fresh agent in fewer tokens on the small version.
- *Tweet:* "Agents wrote a 3M-line browser. We pointed them the other way: same behaviour, byte-for-byte, in 1/10th the
  code. Alan Kay's 20,000-line dream, with an oracle."
- *Expert kill reply:* "LOC is a vanity metric. Golfed code is unreadable. STEPS only hit its numbers by hiding
  complexity in bespoke DSLs nobody else can maintain."
- *Kill test:* stop if, at an equal pass rate,
  - the compressed version is not at least 3× smaller than the smallest compliant human implementation (DSL counted), **or**
  - a fresh agent needs *more* tokens to land 10 held-out change requests on it than on the original.

## 2. Lamport: specs before code, now checkable against code

**The idea.**
- Write a precise, model-checkable specification (TLA+) before or alongside code. Lamport: "If you're thinking without
  writing, you only think you're thinking" **F** (widely cited Lamport line).
- AWS reported bugs found by TLA+ that would have taken 35-step traces to reach (Newcombe et al., *How Amazon Web
  Services Uses Formal Methods*, CACM 2015) **F**.

**Why niche.**
- Spec-writing expertise was scarce.
- Specs drift from code, and TLC proves properties of the *model*, not of the implementation.

**What flipped.**
- *Labour.* SysMoBench (ICLR 2026) shows frontier models now write syntactically valid TLA+ almost every time. The gaps
  are in conformance and invariants **F**.
- *Oracle.* Trace validation closes the model–code gap: instrument the code, replay its traces through the spec.
- *Already productised.* Specula (Cheng, Xu, Huang) derives TLA+ from source code with agents and checks it by trace
  validation. It won the first TLA+ Foundation/NVIDIA GenAI challenge and reports 382 reproducible bugs in 67 projects
  as of 2026-08-19 **F** (secondary report of their figures).

**Oracle: strong.** TLC/Apalache for the model, trace validation for conformance.

**Superhuman-model test: more valuable.** Specs become the authoritative thing humans sign off on. This matches the
moonshots critic: "authoritative specifications" remain scarce **I**.

**Who is doing it.** Specula, SysMoBench, the TLA+ Foundation challenge, and Kiro/Spec Kit as informal "spec-driven"
tools.

**Value.** Distributed-database and cloud vendors already pay for this work (AWS, Azure, MongoDB) **I**.

**2-week proof.** Not worth building separately. Point Specula at our own TS/Rust services and contribute upstream.

**Verdict.** The ripest idea in the list, and **already taken well**. Use it; don't build it.

## 3. Hoare and Dijkstra: the verifying compiler, correctness by construction

**The idea.**
- Hoare, "The Verifying Compiler: A Grand Challenge for Computing Research" (JACM 50(1), 2003) **F**: a compiler that
  guarantees correctness before the program runs.
- Dijkstra (1970): testing shows "the presence of bugs, but never … their absence".
- Dijkstra, EWD667 (1978), on why natural language is the wrong interface: "The virtue of formal texts is that their
  manipulations, in order to be legitimate, need to satisfy only a few simple rules; they are … an amazingly effective
  tool for ruling out all sorts of nonsense" **F**. Read in 2026, that paragraph argues for formal specs *between*
  prompts and code.

**Why niche.** Proof labour. seL4 took ~20 person-years (brief's calibration).

**What flipped.**
- Proof checkers tolerate a model that hallucinates. Kleppmann, 2025-12-08: "the proof checker will reject any invalid
  proof and force the AI agent to retry" **F**.
- The vericoding benchmark (arXiv 2509.22908, 2025) covers Lean, Verus and Dafny **F**.

**Oracle: strongest of any item.** The proof checker.

**Superhuman-model test: more valuable.** The bottleneck moves entirely to specs.

**Who is doing it.** Lean FRO, Harmonic, Verus groups, the vericoding authors, AWS. Crowded.

**For us.** The opening is item 1's output. Verification cost grows with code size, so compress first, then verify.
Don't compete head-on.

## 4. Dennis–Van Horn, Hardy and Miller: object capabilities, for agents

**The idea.**
- Authority travels only with unforgeable references; there is no ambient authority. Sources:
  - Dennis & Van Horn, 1966
  - Hardy, *The Confused Deputy*, 1988
  - Miller, *Robust Composition*, 2006, plus E and later Hardened JavaScript
- Miller–Drexler made the economic reading explicit: "encapsulation in software serves the same crucial function as
  property rights in human affairs" (*Markets and Computation*, 1988, §4.2) **F**.

**Why niche.**
- The mainstream OS and web stacks shipped ambient authority (Unix users, cookies, API keys).
- Retrofitting capabilities is a rewrite.
- On why agoric/ocap ideas didn't spread, Wei Dai's 2019 LessWrong thread blames security labour and rewrite cost **F**.

**What flipped (Lens B).**
- Prompt injection is a confused-deputy problem at scale.
- CaMeL (Google DeepMind, 2025-03-24) attaches capability metadata to values. It solves 77% of AgentDojo tasks "with
  provable security" against 84% undefended **F**.
- Cloudflare shipped Cap'n Web (2025-09-22): schemaless object-capability RPC for JS, under 10 kB **F**.
- The IETF has `draft-niyikiza-oauth-attenuating-agent-tokens` (2026-03-16), a credential format in the macaroon
  tradition that agents can attenuate offline. The WIMSE credential-delegation draft followed in July 2026, and the OAuth
  WG was rechartered with agents in scope in June 2026 **F** (secondary report).

**Oracle: medium.** Attack suites such as AgentDojo, and reference monitors that can be checked.

**Superhuman-model test: more valuable.** A smarter injected model is a better attacker, and authority structure doesn't
depend on the model **I**.

**What is still unfinished.**
- Attenuated tokens are *copyable*. A forked agent duplicates its authority.
- Miller's own answer is conserved, exclusive rights: purses and payments that cannot be duplicated, as in Agoric's ERTP
  **I** (I didn't re-read the ERTP spec this round).
- This is the earlier round's "conserved mandates across copies", and it has prior art in Miller's own work.

**2-week proof.**
- Build ERTP-style purses over Cap'n Web for agent authority: spend limits, API quotas, data-egress allowances.
- Run 100 agent forks, each getting a split purse, with an injected adversary.
- Measure whether total spend or egress ever exceeds the mandate, against bearer-token attenuation.

**Kill.**
- *Expert reply:* "Just keep a central quota server." That is Lampson's 'truth' check, and it may well be enough.
- *Kill test:* if a quota service with per-fork sub-keys gives the same guarantees at under 1 ms added latency, the
  capability machinery is ceremony.

## 5. Miller and Drexler: agoric computing (special attention)

**What they proposed (1988).**

The two papers are *Markets and Computation: Agoric Open Systems* and *Incentive Engineering for Computational Resource
Management*, both in Huberman (ed.), *The Ecology of Computation*.
- *Definition:* "An agoric system is defined as a software system using market mechanisms" (§1.2) **F**.
- *Processor time by auction.* The "escalator algorithm": "A processor always runs the highest-bidding process". Bids
  rise automatically. "Among initial-strategy bidders, the escalator algorithm reduces to a round-robin scheduler"
  (*Incentive Engineering* §2.1) **F**.
- *Storage by rent.* "Landlords own storage space. They charge other objects rents at a rate determined through
  auction. When objects fail to pay rent they are evicted (that is, garbage collected)."
- *Retainer fees.* Objects that are "needed but rarely used must survive by charging their clients retainer fees". This
  is "the market sweep approach to garbage collection" (§1.3, §3.2) **F**.
- *Their own scale caveat:* "In small systems, the overhead of accounting and negotiations is unjustified" (*Markets*
  §7) **F**.
- *Their own open problem:* "There is as yet no open-systems language which provides for ownership and trade of basic
  computational resources" (§4.5) **F**.
- *Their own admitted cost:* market GC is "substantially more expensive than typical garbage collection algorithms"
  (§3.3) **F**.

**Why it didn't happen (evidence).**
1. *Overhead versus value.* In 1988 a timeslice was worth about as much as the bookkeeping for it. Miller and Drexler
   concede this for small systems **F**.
2. *Most programs have one owner.* "The functions in a program don't really compete", and programmer time costs more
   than compute (Wei Dai thread, 2019-02-16) **F**.
3. *Markets got de-marketed.*
   - Spawn (Waldspurger et al., 1992) was a real computational economy. Waldspurger's lottery scheduling (OSDI 1994)
     kept the tickets and currencies and dropped the market **F**.
   - AWS Spot removed bidding in Nov 2017 for "smoother" prices. Academics call the result "retail pricing … rather than
     market-based" **F**.
   - Solana's storage "rent" became a refundable deposit (rent-exempt minimum) rather than a recurring fee **F**.
   - The pattern: users take prices and quotas over live auctions **I**.
4. *No cheap micropayments, and complicated pricing confuses buyers* (same thread) **F**.

**What flipped.**

| Change | Evidence |
|---|---|
| The unit is worth far more than its accounting | One ACID debit+credit+journal row in SQLite costs 2.9 µs batched, 20.7 µs per commit (M4 Pro) **M**. At ~$0.04 per vCPU-hour that is ~2×10⁻¹⁰ $ **E**. One LLM call costs ~$10⁻³–10⁻¹ **E**. Accounting is now ~10⁻⁶–10⁻⁹ of the resource, so the "small systems" objection inverts **I** |
| Many owners | Agents act for different principals over shared tools, APIs and sandboxes. This answers the "no competing goals" objection **I** |
| Bidders can reason about prices | LLM agents read prices; 1988 programs could not |
| Payment rails exist | x402 passed ~138M transactions on Base by Q3 2026; 87% were under 10¢ (Chainalysis, secondary report) **F** |

**Counter-evidence (be ruthless).**
- *Real agent demand is tiny.* TRM Labs estimates actual *agentic* x402 volume at roughly $5–11k a month. Adjusted
  dollar volume fell ~77% from its Nov 2025 peak while transaction counts rose (Artemis via CryptoSlate) **F**.
- *Agents are poor market participants today.* Microsoft's Magentic Marketplace (arXiv 2510.25779, Oct–Nov 2025)
  found strong first-proposal bias: ~80–100% accepted the first offer. Welfare degraded sharply with market size **F**.
- DeepMind's *Virtual Agent Economies* (arXiv 2509.10147, 2025-09-12) argues for *designed*, steerable sandbox
  economies with auctions, because emergent ones risk crashes and monopolies **F**. That is a position paper, not a
  system.
- *Inside one org, budgets win.* The 2026 "Token Budgets" paper catalogues 63 budget-overrun incidents and proposes
  affine-typed budget pools, not auctions **F**. Agora (arXiv 2607.09600) runs auctions for task allocation **F**.

**Oracle: weak to medium.** Counterfactual cost on traces, compared with simple baselines.

**Superhuman-model test: more valuable.** Better models are better bidders, and markets exist to coordinate parties with
divergent goals, which better agents don't remove **I**.

**Prediction.** Repeating the Spawn→lottery history, *inside* one principal's fleet the winners will be tickets, quotas
and budgets. Markets win only *across* principals. Live per-call auctions will be de-marketed again **I**.

**The unfinished piece worth testing: rent and retainer GC for agent artifacts.**
- The artifacts: sandboxes, VM/heap snapshots, branches, preview deploys, prefix/KV caches, forked prefixes from the
  teleport round. Nobody owns their deletion, and a TTL guesses wrong both ways.
- Under market sweep, each artifact pays rent from the budget of whoever *references* it. An artifact nobody
  references can't collect retainer fees and is evicted.
- The 2-week proof is a TS library plus a simulator. Compare total cost (storage rent plus re-creation cost) against
  TTL and LRU. Use traces: our snapshot/fork logs and Anthropic-style 5-minute/1-hour cache tiers.
- *Kill test:* if rent-based eviction doesn't beat a tuned TTL+LRU by ≥20% total cost on real traces, kill it.
  Lampson's own hint applies: "When in doubt, use brute force" **F**.
- *Expert kill reply:* "This is just reference counting with extra steps and a currency nobody wants to manage."

## 6. Pike et al.: Plan 9 per-process namespaces

**The idea.** "The foundations of the system are built on two ideas: a per-process name space and a simple
message-oriented file system protocol" (*The Use of Name Spaces in Plan 9*, 1992/93) **F**.

**Fate.** Partially won. Linux mount namespaces (descended from Plan 9's rfork) underpin every container. 9P survives
inside WSL2 and gVisor's gofer **I**.

**What flipped (Lens B).** Each agent wants its own composed view of the world. Agents are best at files and shell.
- Turso's AgentFS (2025) gives each agent session a SQLite-backed copy-on-write overlay with a tool-call audit log **F**.
- MCP reinvented RPC where Plan 9 would have used a file tree **I**.

**Oracle: weak.** Agent task success rate.

**Superhuman-model test: neutral.**

**Verdict.** Mostly absorbed (containers, AgentFS). The leftover, "MCP as a 9P tree", is a weekend hack, not a bet.

## 7. Nelson: transclusion, two-way links, transcopyright

**The idea.** *Xanalogical Structure, Needed Now More than Ever* (ACM Computing Surveys 31(4es), Dec 1999):
- deep links to content
- transclusion as "visible re-use"
- deep versioning
- a copyright scheme in which the quote stays bound to its source

Nelson argued the Web "vastly but incorrectly simplifies" this into "fragile ever-breaking one-way links" **F**.

**Why it died.** Engineering never converged (Xanadu, 1960–), and the one-way-link Web won.

**What flipped (Lens B).** LLM answers are transclusion without provenance.
- ProRata/Gist pays publishers 50% of ad revenue in proportion to attributed contribution, with 500+ publishers by mid
  2025 (company figures) **F**.
- Cloudflare's pay-per-crawl and the RSL standard (2025) are cited from memory and not re-verified this round.

**Oracle: weak.** Attribution of a generated sentence is itself inference.

**Superhuman-model test: more valuable but less checkable.**

**Verdict.** Real demand, weak oracle, and well-funded incumbents. Not for a single engineer.

## 8. Gray: transactions, sagas, the 5-minute rule

**The ideas.**
- Atomic, durable, isolated actions, and compensation for long-lived ones (*The Transaction Concept*, VLDB 1981; sagas,
  Garcia-Molina & Salem 1987).
- Keep data in memory if it is re-referenced within ~5 minutes (Gray & Putzolu 1987).

**What flipped (Lens B).** Agents take irreversible real-world actions, and KV caches are a memory-versus-recompute
trade.

**Already done.**
- SagaLLM (PVLDB 2025) and Robust Agent Compensation (2026) cover agent sagas **F**.
- The 5-minute rule was applied to LLM KV caches in arXiv 2411.07447 (Nov 2024) **F**.
- Prompt caching ships as 5-minute and 1-hour tiers **F**.
- Temporal and Restate cover durable execution.

**Verdict.** Gray's ideas *are* being revived, by others, competently. Reject as a bet.

## 9. Armstrong and Hewitt: let it crash, actors

**The ideas.**
- Hewitt's actor paper was literally *A Universal Modular ACTOR Formalism for Artificial Intelligence* (IJCAI 1973)
  **F**.
- Armstrong's thesis (*Making reliable distributed systems in the presence of software errors*, 2003) added supervision
  trees: restart, don't repair.

**Fate.** Won. Durable Objects, and Cloudflare's Agents SDK on top of them, Orleans' virtual actors, and Temporal are
all actors with supervision **I**.

**Verdict.** It already happened. Reject. One footnote for Gray's 1985 Heisenbug finding: agent failures are mostly
Heisenbugs, so restarting from a checkpoint is the right default **I**.

## 10. Knuth: literate programming

**The idea.** "Instead of imagining that our main task is to instruct a computer what to do, let us concentrate rather on
explaining to human beings what we want a computer to do" (*Literate Programming*, 1984) **F**.

**Why it died.** Maintaining both prose and code, and programmers don't write prose.

**What flipped.** Prose is free. DeepWiki turns any repo into a wiki in 30 seconds to minutes **F**.

**Superhuman-model test: less valuable.** Humans read less over time, and the reader of the program becomes the
model **I**.

**Verdict.** Absorbed (DeepWiki and similar). Reject.

## 11. Bush, Licklider, Engelbart, Victor: symbiosis, trails, bootstrapping, immediate connection

**What they proposed.**
- *Bush, 1945:* associative "trails" and "a new profession of trail blazers" **F**.
- *Licklider, 1960:* "About 85 per cent of my 'thinking' time was spent getting into a position to think" **F**. That
  85% is exactly what agents absorb.
- *Licklider, 1963 Intergalactic memo:* networked centers must "agree upon some language or, at least, upon some
  conventions for asking such questions as 'What language do you speak?'" (memo of 1963-04-23) **F**. That is MCP/A2A
  capability negotiation 62 years early, and it has now been built.
- *Engelbart:* bootstrapping, i.e. improving the improvement process. Today's versions are AlphaEvolve and Darwin Gödel
  Machine-style work **I**.
- *Victor, 2012:* "creators need an immediate connection" **F**. Today's versions are artifacts and live previews.

**Verdict.** Interface ideas with no oracle, and all heavily pursued. Use them as framing only.

## 12. Lampson: confinement (an anti-flip)

**The idea.** *A Note on the Confinement Problem* (1973): a program must be unable to leak information except to its
caller. Lampson showed covert channels make that hard in principle **F** (paper's thesis, from memory).

**Why it matters.** The "lethal trifecta" of prompt-injection exfiltration is the confinement problem.

**Verdict.** **Needed more than ever, but not labour-bound.** The obstacle is information theory, not effort. Agents
don't flip it. Narrowing authority (item 4) and narrowing egress are the practical answers.

**Attribution correction.** "All problems … can be solved by another level of indirection" is Wheeler's. Lampson's 1992
Turing lecture credits David Wheeler **F**.

---

## Ripeness ranking

| # | Idea (giant) | Lens | Blocker gone? | Oracle | Superhuman test | Already taken? | Opening for one engineer |
|---|---|---|---|---|---|---|---|
| 1 | Specs before code + trace validation (Lamport) | A | yes | strong | ↑ | **yes, Specula** | use it |
| 2 | Verifying compiler (Hoare/Dijkstra) | A | mostly | strongest | ↑ | crowded | via #3 |
| 3 | Lean systems / STEPS (Kay/Wirth/Hoare + Liskov gate) | A+B | yes | strong | ↑ | partial (debloating only) | **high** |
| 4 | Object capabilities (Dennis–Van Horn/Hardy/Miller) | B | n/a (adoption) | medium | ↑ | CaMeL, Cap'n Web, IETF | narrow: conserved rights across forks |
| 5 | Agoric markets (Miller–Drexler) | B | partly | weak–medium | ↑ | position papers, x402 | narrow: rent/retainer GC |
| 6 | Per-agent namespaces (Pike/Plan 9) | B | yes | weak | = | AgentFS, containers | low |
| 7 | Transclusion/provenance (Nelson) | B | no (oracle) | weak | ↑ but unchecked | ProRata etc. | low |
| 8 | Transactions/sagas/5-min rule (Gray) | B | yes | medium | = | SagaLLM, KV caching | none |
| 9 | Actors/let it crash (Hewitt/Armstrong) | B | done | — | = | DO, Temporal | none |
| 10 | Literate programming (Knuth) | A | yes | weak | ↓ | DeepWiki | none |
| 11 | Symbiosis/trails/bootstrapping (Bush/Licklider/Engelbart/Victor) | B | — | none | = | everyone | framing only |
| 12 | Confinement (Lampson) | B | **no, inherent** | — | ↑ | — | anti-flip |

## Ranked top 3 (by opening, not ripeness)

1. **Kay–Wirth compression under a Liskov gate.**
   - *Why it ranks first:* strong oracle. Agents currently push size the wrong way. Size compounds into verification,
     audit and edge costs. It reuses the GrowOS loop the user already has.
2. **Agoric rent and retainer GC for agent artifacts.**
   - *What it is:* the one concrete Miller–Drexler mechanism whose economics clearly inverted, since accounting now
     costs ~10⁻⁶–10⁻⁹ of the resource (**M**/**E**).
   - *Caveats:* weak oracle. Brute-force TTLs may win.
3. **Conserved capabilities across agent forks (Miller ERTP over Cap'n Web).**
   - *Why it's on the list:* necessary, and the copy problem is real.
   - *Caveat:* the closest to being absorbed by IETF drafts plus a quota server.

## The ONE bet

**The shrink loop.** Point the GrowOS machinery at *size*. Pick one system with a public oracle: YAML 1.2 against
yaml-test-suite plus libyaml, or the grown syscall layer against Linux. Agents propose rewrites, and each rewrite is
accepted only if it is byte-identical on visible and held-out corpora *and* lowers compressed source bytes, DSL tooling
included. After that, a fresh agent must land held-out change requests more cheaply on the small version. This is STEPS
with the two things it lacked, free labour and an oracle. It also answers Wirth's law at the moment agents are
accelerating it.

## 5-line TL;DR

1. Lampson's 1983 "hint checked against the truth" is the rule for which old ideas flip: model output is a hint, so
   value lies where a cheap truth exists.
2. Pike (2000) put 90–95% of Plan 9's work on standards compliance. That labour is what killed lean systems, and agents
   now absorb it.
3. The ripest revivals (Lamport/TLA+ via Specula, Hoare's verifying compiler via Lean/Verus) are already being executed
   well; join them, don't compete.
4. Agoric computing's own 1988 objection ("small systems") inverted: accounting costs ~10⁻⁶–10⁻⁹ of an LLM call. But
   history (Spawn→lottery, AWS Spot 2017, Solana deposits) says quotas beat live auctions inside one owner.
5. Bet: Kay's 20,000-line STEPS goal as an oracle-gated *shrink* loop with Liskov substitution as the gate. Kill it if
   it isn't ≥3× smaller than the smallest compliant human implementation, or if it is harder for a fresh agent to change.

## Rejected (one line each)

- **Literate programming (Knuth):** DeepWiki-class tools absorbed it, and it gets less valuable as models become the
  readers.
- **Actors / let it crash (Hewitt, Armstrong):** already the substrate (Durable Objects, Orleans, Temporal).
- **Sagas / 5-minute rule (Gray):** SagaLLM, RAC and KV-cache break-even work, plus shipped cache tiers.
- **Plan 9 namespaces:** containers plus AgentFS. The rest is a weekend hack.
- **Xanadu transclusion (Nelson):** demand is real but attribution has no strong oracle, and incumbents are funded.
- **Live auctions inside a fleet (agoric scheduling):** four decades of de-marketing evidence, and current agents show
  first-proposal bias.
- **Confinement (Lampson 1973):** inherent covert channels, not labour; agents don't flip it.
- **Symbiosis, trails, bootstrapping, live programming (Licklider, Bush, Engelbart, Victor):** no oracle, and everyone
  is building them. Kept only as framing.
- **Licklider's "What language do you speak?":** built (MCP/A2A).
- **TLA+ revival (Lamport):** ripest of all, but Specula already does it well. Use it rather than build it.

---

## Sources (accessed 2026-10-28)

**Primary sources, the giants**
- Lampson, *Hints for Computer System Design* (1983), PDF via Microsoft Research: https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/acrobat-17.pdf
- Pike, *Systems Software Research is Irrelevant* (2000-02-21): https://doc.cat-v.org/bell_labs/utah2000/utah2000.html
- Pike et al., *The Use of Name Spaces in Plan 9*: https://plan9.io/sys/doc/names.html
- VPRI, *STEPS Toward the Reinvention of Programming, 2012 Final Report*, TR-2012-001: https://tinlizzie.org/VPRIPapers/tr2012001_steps.pdf
- VPRI STEPS 2007 and 2010 reports: https://archive.rickardlindberg.me/writing/alan-kay-notes/tr2007008_steps.pdf · https://archive.rickardlindberg.me/writing/alan-kay-notes/tr2010004_steps10.pdf
- Wirth, *A Plea for Lean Software*, IEEE Computer 28(2), 1995, doi:10.1109/2.348001: https://en.wikipedia.org/wiki/Wirth%27s_law
- Hoare, *The Verifying Compiler* (JACM 2003): https://www.eecg.utoronto.ca/~steffan/carg/readings/jacm.hoare.pdf
- Dijkstra, EWD667: https://www.cs.utexas.edu/~EWD/transcriptions/EWD06xx/EWD667.html
- Miller & Drexler, *Markets and Computation*: https://papers.agoric.com/papers/markets-and-computation-agoric-open-systems/full-text/
- Drexler & Miller, *Incentive Engineering*: https://papers.agoric.com/papers/incentive-engineering-for-computational-resource-management/full-text
- Licklider, Intergalactic Network memo (1963-04-23): https://www.thekurzweillibrary.com/memorandum-for-members-and-affiliates-of-the-intergalactic-computer-network
- Licklider, *Man-Computer Symbiosis* (1960): https://groups.csail.mit.edu/medg/people/psz/Licklider.html
- Nelson, *Xanalogical Structure* (1999): https://www.cs.uvic.ca/~mstorey/teaching/infovis/articles/Xanalogical%20Structure.htm
- Wheeler attribution: https://en.wikipedia.org/wiki/Fundamental_theorem_of_software_engineering

**Why agoric computing stalled**
- Wei Dai, *Why didn't Agoric Computing become popular?* (2019-02-16): https://www.lesswrong.com/posts/5XzQQHwYtSgrATzMC/why-didn-t-agoric-computing-become-popular
- Spawn: https://researcher.ibm.com/publications/spawn-a-distributed-computational-economy
- Lottery scheduling: https://usenix.org/legacy/publications/library/proceedings/osdi/waldspurger.html
- AWS Spot pricing change (Nov 2017): https://aws.amazon.com/blogs/compute/new-amazon-ec2-spot-pricing/
- Solana rent as a deposit: https://docs.chainstack.com/docs/solana-rent-reduction-reclaim-excess-rent

**Agent economies, 2025–2026**
- *Virtual Agent Economies*: https://arxiv.org/abs/2509.10147v1
- Magentic Marketplace: https://arxiv.org/html/2510.25779v1
- Agora (auction-based task allocation): https://arxiv.org/html/2607.09600v1
- Token Budgets: https://arxiv.org/html/2606.04056v1
- x402 statistics:
  - https://www.trmlabs.com/trm-tech-blog/whos-actually-paying-measuring-ai-agent-payments-onchain
  - https://aiweekly.co/alerts/chainalysis-base-x402-agentic-payments-hit-138m-in-q3-with-87-under-10-cents

**Agent-built systems and code size**
- Anthropic, *Building a C compiler*: https://www.anthropic.com/engineering/building-c-compiler
- FastRender: https://simonwillison.net/2026/Jan/23/fastrender/ · https://www.theregister.com/2026/01/22/cursor_ai_wrote_a_browser/
- Chisel: https://kihongheo.kaist.ac.kr/publications/ccs18.pdf
- TRIM: https://arxiv.org/pdf/2607.18161
- CodeScene refactor: https://www.infoq.com/news/2026/09/agentic-refactoring-case-study/
- *More code, not more software*: https://redreamality.com/blog/coding-agent-more-code-not-more-software-2026/

**Specs and verification**
- Kleppmann (2025-12-08): https://martin.kleppmann.com/2025/12/08/ai-formal-verification.html
- Vericoding benchmark: https://arxiv.org/pdf/2509.22908
- SysMoBench: https://arxiv.org/abs/2509.23130v2
- Specula: https://www.alphaxiv.org/abs/2607.25333
- TLA+ GenAI challenge: https://foundation.tlapl.us/challenge/

**Capabilities**
- CaMeL: https://simonwillison.net/2025/Apr/11/camel/
- Cap'n Web: https://github.com/cloudflare/capnweb
- IETF attenuating agent tokens: https://datatracker.ietf.org/doc/draft-niyikiza-oauth-attenuating-agent-tokens/
- WIMSE credential delegation: https://www.ietf.org/archive/id/draft-sweeney-wimse-credential-delegation-00.html

**Transactions and caching**
- SagaLLM: https://arxiv.org/abs/2503.11951v3
- RAC: https://arxiv.org/pdf/2605.03409
- KV-cache 5-minute rule: https://arxiv.org/pdf/2411.07447

**Revivals of other ideas**
- AgentFS: https://turso.tech/blog/agentfs
- DeepWiki: https://docs.devin.ai/work-with-devin/deepwiki
- ProRata: https://www.businesswire.com/news/home/20250606852177/en/ProRata-AI-Signs-Partnerships-With-More-Than-500-Publications-Giving-Gist.ai-One-of-the-Largest-Licensed-Content-Libraries-in-Generative-AI-Search

**Scale data**
- Octoverse 2025 (986M commits, +25%): https://github.blog/news-insights/octoverse/octoverse-a-new-developer-joins-github-every-second-as-ai-leads-typescript-to-1/

**Measurement (M):** `/tmp/flip-giants/exp/ledger.py`, SQLite WAL with synchronous=normal, 1,000 accounts, 200k
transfers, Apple M4 Pro: 2.86 µs per transfer (batched) and 20.7 µs per committed transfer. Scratch deleted after the
run.
