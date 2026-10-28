# Round 10 summary: every layer of the stack, the rigor flip, and self-extending software (2026-10-28)

10 GPT-6.1-Sol agents (reasoning effort xhigh), one lens each, brief in [BRIEF.md](BRIEF.md). About 73k words.
The trigger was two posts: the "Software Industrial Revolution" post (Alchemy / Foldkit / Effect: rigor beats conciseness
when agents write the code) and Infinity (hydro-project/infinity, a Rust runtime for very many concurrent agents).
GrowOS was excluded.

Labels as in [RESEARCH-SUMMARY.md](../RESEARCH-SUMMARY.md): **verified** = I checked the primary source myself;
everything else is what the agents reported.

## 1. The one-page version

1. **The thesis is half right.** Agents make *writing* rigor cheap: annotations, transitions, tests, proofs (Dafny
   verification went from 68% to 96% across model generations). They do not make *deciding what is correct* cheap.
   There is no evidence yet that stricter frameworks make agents better: llmlangbench scored TypeScript 95.9%,
   Python 97.0%, Rust 87.0%, Haskell 82.0% (`10`). Effect/TS types structure code but do not certify the real effects
   (`03`). Corrected thesis (`10`): *optimise for checkable behaviour at boundaries the author cannot casually
   redefine.*
2. **Generation is taken at every layer.** Generated UI, generated apps with their own database (Durable Object
   Facets), agent-written extensions (Pi, get-bb/bb), skill libraries, schemas, API specs, TLA+, deterministic
   simulation for TypeScript and cheap idle agents all have shipping or open-source owners.
3. **What is open is narrow evidence at boundaries:** device behaviour, upgrades of persisted state, browser handoff,
   combinations of extensions, cleanup when an owner dies, deployment recovery. Every finalist scored 2–3/5 on "gap".
   Every pick is conditional on a 1–2-day kill test, and most are upstream contributions, not projects of their own.
4. **The strongest thread: rules over effects in Foldkit-style apps.** Four lenses (`03`, `05`, `06`, `10`) arrived at
   it independently. It is upstream territory: Foldkit #622 (session → Story test) is planned and PR #626 is open
   (**verified** #622).
5. **The post-merge survivor from round 6 is weaker.** Prior art exists: Graft (a design contract with partial
   implementation in `feder-cr/git-ai`, **verified**: not a shipped product), LUCI's production culprit/revert
   machinery, Mogplex, HydraFlow. Merge-queue vendors already batch and bisect. The broad "no one packages this" claim
   is withdrawn. A narrow piece survives ("revert rehearsal": prove that the revert fixes the *current* tip).

## 2. Picks by lens

| # | Lens | ONE pick | Score | What it is | Main risk |
|---|---|---|---|---|---|
| 01 | hardware | **Converter Witness** | 26 | Capture real Zigbee device traffic and turn it into regression evidence for Zigbee2MQTT's TypeScript device converters | Demand; owner may absorb it |
| 02 | runtime | **Remote lifetime scopes** | 24 | Leases, owner epochs and restart reconciliation for async tool jobs/subscriptions; Infinity #45 (orphan subscriptions), Pi-Web #546 (9 orphans, ~900 MB) | Plain TTL plus startup cleanup may be enough |
| 03 | languages | **Command-law gate** | 25 | Replay Message histories through base and PR `update`; check a few human-owned laws ("one receipt per order"); measured toy: 1,365 histories, shortest witness found | Changes inside effect bodies are invisible |
| 04 | data | **LiveStore upgrade rehearsal** | 25 | Rehearse a release against published clients, persisted state and queued offline writes | May reduce to an existing test recipe |
| 05 | distributed | **Causal Command Diff** | — | Same family as 03; replay stops where the recorded future is no longer causally valid; keeps duplicates | Foldkit #622/#626 |
| 06 | frontend | **Browser handoff corpus** | 25 | Shared cross-framework tests: does typed input, focus and pending work survive when JS takes over a server-rendered page? | Adapters may be trivial Playwright |
| 07 | infra/ops | **Alchemy Recovery Lab** | 25 | Fault-and-recovery corpus for Alchemy providers: persisted state vs observed resource identity/ownership | Sieve, Faultline; Alchemy already tests lifecycles |
| 08 | self-ext agents | **Pi lifecycle conformance** | 24 | Check that Pi's extension test harness matches the real host across reload, overlap and removal | Gap 2/5; contribution only |
| 09 | self-ext apps | **Feature-collision workbench** | 26 | Detect when two individually fine extensions of a generated app break in combination, under owner-set rules | Demand confidence low |
| 10 | rigor flip | **Command Diff** (alt. **RigorBench**) | 25 / 24 | Same family as 03; RigorBench = controlled benchmark of whether Effect/Foldkit-style rigor helps agents | Gap 2/5; benchmark upkeep |

## 3. The Foldkit effect-rules thread, assembled

What the four lenses require together:
1. **Record full Command arguments**, not names. `02` measured a replay that reported success while a refund changed
   from €10 to €1,000 because the record had no arguments.
2. **Do not trust descriptor equality.** `06` measured two `SaveDraft` Commands with equal descriptors where one wrote
   once and the other twice.
3. **Stop replay at the first causally invalid point** and keep duplicates and causal order (`05`).
4. **Check a few laws a human owns**, plus enumerated short histories, not only recorded ones (`03`).
5. **State the blind spot**: changes inside an effect's implementation are out of scope unless the boundary executes.

Shape: a contribution to Foldkit around #622/#626, not a new category.

## 4. Self-extending software

- **Agents:** extension-writing is the intended workflow in Pi (~118k stars) and get-bb/bb (~4.7k stars, an IDE that
  builds and customises itself, with plugin precedence, collision detection and out-of-monorepo plugin CI). Tool makers
  (LATM, Voyager, selfMCP, BabyAGI/functionz, ToolMaker) and skill compilation are taken. Babashka was also covered.
- **Apps:** genUI (Google generative UI, A2UI/MCP Apps), persistent artifacts (Claude, >0.5B), per-app databases (DO
  Facets), branches and merges for user code (Val Town) and AI-generated state machines (Stately) exist.
- **What is open:** the relationships between extensions: combinations (`09`), surviving upstream upgrades (`09` B),
  teardown and orphaned work (`02`, `08`). Ink & Switch's *Malleable Software* essay names composition as unsolved.

## 5. Corrections to earlier rounds

- **Post-merge integration (R6, ranked #1):** the broad novelty claim is withdrawn (see §1.5). The old 8–75× saving
  estimate is withdrawn too: pre-merge batching amortises the same suite (`07`).
- **Replaygate / replay diff (R9):** generic traffic replay is sold (Curtail ReGrade, Replay.io rerecording). The
  effects-as-values variant is Foldkit's own roadmap.
- **Schema lenses (R9 runner-up):** closer prior art found; 30,000 passing lens-law assertions still accepted wrong
  units (`04`, measured).
- **Infinity's "75k agents on a Raspberry Pi"** extrapolates a memory test from one EPYC thread with scripted
  completions (~100 KB per idle history). It is not 75k active agents (`02`).

## 6. Ranked, for the builder

1. **RigorBench** (`10`, 24). It is the only finalist with a headline: it tests the claim both posts rest on, nobody has
   measured it, and either answer is publishable. The risk is benchmark upkeep.
2. **Foldkit effect rules** (`03`/`05`/`06`/`10`). It has the most agreement, measured demos and a real upstream user
   request. It is a contribution, which is good for signal and small in scope.
3. **Feature-collision workbench** (`09`, 26). It has the coolest framing of self-extension, but low demand evidence.
4. **Converter Witness** (`01`, 26). Concrete users and a TypeScript codebase; niche.

Every report ends with a 1–2-day kill test; run one before building anything.
