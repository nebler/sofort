# Round 10 / 04-data — growing schemas without stranding yesterday's app

Research date: **2026-10-28**. **F** = sourced fact; **M** = local measurement; **I** = inference or proposal; **E** = estimate. Living documentation and repository metadata below were checked on that date; a publication date is given where available. Repository feature claims are distinguished from features exercised locally.

**I — Verdict:** the most promising small project is **an upgrade rehearsal for local-first apps**: run yesterday's persisted app and queued writes against an agent's proposed schema/event/materializer change, and return the actual event, client version and record that breaks. Start with LiveStore. This is a conditional open-source integration project, not an empty product category. Snapshot migration rehearsal, schema compatibility, lens generation, branching and DDL commutativity all already have substantial prior art.

**M/I — The important correction to round 9:** lens laws do not establish intended meaning. A deliberately wrong cents→dollars lens passed **30,000 law assertions** locally. A migration can also preserve every existing row while misinterpreting the next old-client write. The scarce input is the application's protected data contract, including what old clients are still entitled to do. Agents can write the compatibility machinery; they cannot author their own acceptance criteria and thereby establish safety.

## 1. What changed at this layer

- **F — Workload change, not a hypothetical:** Neon's [2025-07-16 incident report](https://neon.com/blog/may-june-recap) attributes more than **5× database-creation growth** and **50× branch-creation growth** to agentic partners. It reports control-plane queries moving from hundreds of milliseconds to over a minute, and test workloads that failed to represent the new project/branch distribution. These are vendor-reported operational observations, not my measurements.
- **F — Agents use state branches differently:** the Berkeley [CIDR 2026 paper, §6.2](https://vldb.org/cidrdb/papers/2026/p32-liu.pdf), presented January 18–21, reports **20× more branches and 50× more rollbacks** for agents than humans at Neon. [BranchBench](https://arxiv.org/abs/2604.17180), submitted **2026-04-19**, explicitly evaluates whether database branching meets agentic workloads. Neither observation proves that best-of-100 application generation is a valuable user experience.
- **F — Per-generated-app storage is platform territory:** [VibeSDK](https://github.com/cloudflare/vibesdk) already connects an agent, Dynamic Worker previews, Artifacts history and isolated SQLite-backed Durable Object Facets. [D1 documentation](https://developers.cloudflare.com/d1/) explicitly describes thousands of databases for vibe-coding platforms. Supplying a database per app is not an outside project's gap.
- **F — The runtime changes are already concrete:** LiveStore's [0.5.0 release, 2026-10-15](https://github.com/livestorejs/livestore/releases/tag/v0.5.0), and [changelog](https://github.com/livestorejs/livestore/blob/main/CHANGELOG.md) describe schema fingerprints, rematerialization, interrupted-rebuild recovery, preserved pending events and Cloudflare row-write costs. Event sourcing makes rebuilding possible; it does not make decoder changes or replay costs disappear.
- **F — Operational pain is specific but demand is modest:** LiveStore [#1552, 2026-08-11](https://github.com/livestorejs/livestore/issues/1552) reports a nullable-column addition stranding persisted clients; its attempted reset also removes the event log. More recently, [#1689, 2026-10-23](https://github.com/livestorejs/livestore/issues/1689) reports an incompatible event producing a silent WebSocket interruption and `ServerAheadError` on **0.5.0**, with a local Cloudflare reproduction. At inspection both issues had **0 reactions and 0 comments**. The changelog contains subsequent rebuild fixes; an open older issue is not proof that the latest release retains every reported defect.

**I — Where rigor flips:** keeping published event definitions, executable old clients, migration pre/postconditions and semantic query contracts can become routine generated output. The expensive part used to include manually maintaining those artifacts for every change. Their execution is independent of model judgment. Actual data scans, coordination, retention, contract selection and deployment compatibility remain real costs. The causal claim that agents now make all of this economical is a hypothesis to test, not an established consequence of the workload numbers.

## 2. Re-test the earlier catalogue, including its weak assumptions

**F — Required prior work read:** [research summary](../RESEARCH-SUMMARY.md) and [catalogue index](../catalogue/README.md). The relevant catalogue entries are [R9 / 02-primitives / A: schema lenses](../catalogue/R9-deep.md#a-remix-safe-data-model-written-mechanically-checked-lenses-so-forks-keep-sharing-records), [R9 / 02-primitives / B: copy-on-write data forks](../catalogue/R9-deep.md#b-fork-the-data-not-just-the-code-copy-on-write-sqlite-per-agent-attempt-on-facets), and [R9 / 06-tooling / Replaygate](../catalogue/R9-deep.md#1-replaygate--production-traffic-as-the-regression-oracle-for-agent-changes-on-workers). For the original argument and caveats see [deep/02-primitives, §§2.3–2.4](../deep/02-primitives.md). The data-order experiment below also revisits **R6 / 05-code-production / post-merge integration**, catalogued in [R6-flip](../catalogue/R6-flip.md): independently acceptable changes can interact after integration.

### Schema lenses: retain the shared-data question; discard the authoring novelty

**F:** [Cambria, October 2020](https://www.inkandswitch.com/cambria/), already proposed bidirectional schema translation for distributed software. [panproto](https://github.com/panproto/panproto) provides transformations, complements, structural schema merge and sampled law checks. More damaging to the earlier gap claim, [panproto-toolkit](https://github.com/panproto/panproto-toolkit) advertises **31 skills, six agent roles, 72 MCP tools**, migration/lens authoring and CI law checks. Its README targets 0.71.0; the [npm registry](https://registry.npmjs.org/@panproto%2fcore/latest) and [crates.io](https://crates.io/crates/panproto-check) returned **0.76.1**. Package availability establishes neither adoption nor correctness.

**F:** [Jazz migrations](https://jazz.tools/docs/schemas/migrations) already keep different schema versions usable. Its [authoritative specification, chapter 10](https://github.com/garden-co/jazz/blob/main/crates/jazz/SPEC/10_lenses_migrations.md), retains authored schema identity, accepts old-schema work after the write pointer moves, supports paths through sibling schemas, pins a policy-evaluation schema, and explicitly specifies **translate-then-apply = apply-then-translate**. Therefore neither a lens graph nor that commuting-square check is new. Catalogue mutation is admin-controlled. The repository identifies Jazz 2 as an alpha; specification requirements are not evidence that I exercised all these paths.

**I — Revised verdict:** an agent-generated lens plus law checks is **taken**. A small, separately evaluated runtime for independently owned app remixes sharing records remains a possible integration experiment, but weak demand and Jazz's substantial overlap demote it to #3. “Cambria died because hand-authoring cost too much” is a plausible explanation, not a sourced finding about why its authors stopped. The round-9 report treated that causal story too confidently.

### Copy-on-write database per attempt: real missing D1 API, poor outside project

**F:** D1's [Time Travel documentation, updated 2026-04-21](https://developers.cloudflare.com/d1/reference/time-travel/), still says it cannot clone/fork into another database and explicitly describes future branching. Restore overwrites the existing database. Native [DO SQLite PITR](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/) is likewise a restore API, not a general branch merge system. The D1 omission is real; it is not proof that implementing a page VFS is the best way to fill it.

**F:** Neon already supplies copy-on-write branches; [Turso's beta](https://turso.tech/private-beta) advertises branching and agent databases; [PGlite's API](https://github.com/electric-sql/pglite/blob/main/docs/docs/api.md) supplies `dumpDataDir`/`loadDataDir` for portable copies, without thereby promising copy-on-write cost. [Neon's 2026-09-25 changelog](https://neon.com/docs/changelog/2026-09-25) extends **reset-from-parent** to Object Storage in two regions. That is not arbitrary historical restore across a database and an external R2 bucket.

**I — Revised verdict:** **reject a new CoW engine or Facet VFS.** Use an existing branch/copy mechanism beneath the checker. The platform has both the roadmap and the implementation advantage. Better models might need fewer speculative attempts; safe deployment against preserved state remains useful regardless. No new throughput, latency or cost measurement was made here, so round 9's proposed two-second grid and performance guesses are not carried forward as evidence.

## 3. Generate broadly, search every idea, keep only three narrow experiments

**F/I:** the table lists **16 ideas** and the closest primary prior art found before retention. “Gap” denotes a bounded inference from inspected material, never an exhaustive absence claim.

| # | Idea / rigor or self-extension pattern | Prior art and verdict |
|---|---|---|
| 1 | Event-source every generated application; agents maintain CQRS projections | **F:** [LiveStore](https://livestore.dev/) already uses event logs and SQL materializers; [Axon event versioning](https://docs.axoniq.io/axon-framework-reference/4.11/events/event-versioning/) already provides upcaster chains. **I: reject as a new framework/default prescription.** Reuse where a durable event vocabulary is actually useful. |
| 2 | An agent writes lens DSL and a mechanical checker approves it | **F:** [panproto-toolkit](https://github.com/panproto/panproto-toolkit) covers agent workflows, lenses and CI checks. **I: reject the generic pitch.** |
| 3 | Independently owned app remixes share one record lineage through restricted lenses | **F:** [Jazz chapter 10](https://github.com/garden-co/jazz/blob/main/crates/jazz/SPEC/10_lenses_migrations.md) already handles sibling schemas, but catalogue publication is centralized. **I: retain #3 only as the independent-remix integration experiment**, not a new lens engine. |
| 4 | Copy-on-write SQLite/DO database for every agent attempt | **F:** [Neon branching](https://neon.com/docs/introduction/branching), [Turso beta](https://turso.tech/private-beta), D1's stated fork roadmap. **I: reject the storage project; use existing storage.** |
| 5 | Typed migration plans, contracts and executable pre/postconditions | **F:** [Prisma's current migration subsystem design](https://github.com/prisma/orm/blob/main/docs/architecture%20docs/subsystems/7.%20Migration%20System.md) describes attested `ops.json`, TypeScript authoring and pre/execute/post phases. This is an explicit design/implementation source, not a claim that every described feature is in every released Prisma version. **I: reject as an unoccupied idea.** |
| 6 | Rehearse migrations against real rows and verify rollback/invariants | **F:** [Atlas migration tests](https://atlasgo.io/faq/changesets), [migration-preflight](https://github.com/arnaud-zg/migration-preflight), [SQLite Rehearsal](https://github.com/KanadeK/sqlite-rehearsal). The latter uses read-only online backup, runs actual SQL and checks logical rollback equivalence. **I: reject a generic rehearsal CLI.** |
| 7 | Zero-downtime versions of one database schema | **F:** [pgroll](https://github.com/xataio/pgroll) and [Reshape](https://github.com/fabianlindfors/reshape) maintain concurrent schema versions via expand/contract. **I: reject a new migration runtime.** |
| 8 | Put invariants in constraints instead of model-written assertions | **F:** [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html) enforce writes mechanically; [invariant confluence, VLDB 2015](https://amplab.cs.berkeley.edu/publication/coordination-avoidance-in-database-systems/) already analyzes when coordination is necessary. **I: use constraints; reject “CRDTs make arbitrary business invariants safe.”** |
| 9 | Temporal tables for every agent-created fact and correction | **F:** [XTDB](https://docs.xtdb.com/quickstart/sql-overview.html) already combines dynamic schema, a durable log and valid/system time. **I: reject a new temporal database.** History cannot decide whether an assertion was true. |
| 10 | A schema registry rejects incompatible generated event types | **F:** [Confluent](https://docs.confluent.io/platform/current/schema-registry/fundamentals/schema-evolution.html) supplies forward/backward/full/transitive policies, including logical mapping checks; [LiveStore #69](https://github.com/livestorejs/livestore/issues/69) explicitly requests evolution guardrails. **I: reject another shape-only registry; reuse its compatibility concepts.** |
| 11 | A self-extending app adds fields/tables through safe tools | **F:** [NocoDB's MCP schema tools](https://nocodb.com/docs/mcp/schema) already create/change structure and offer dry runs reporting cleared/rounded cells and affected formula/link dependencies. **I: reject “agent adds its own columns” as the product.** |
| 12 | Restore generated application code, database, auth and blobs together | **F:** [Neon's backend reset](https://neon.com/docs/changelog/2026-09-25) already spans database and Object Storage for reset-from-parent; [VibeSDK](https://github.com/cloudflare/vibesdk) already owns app code/history/storage integration. **I: reject the broad pitch.** Cross-vendor historical consistency is harder and no specific underserved beneficiary was verified. |
| 13 | Detect conflicts between parallel schema-changing agent PRs | **F:** [Drizzle beta.16, 2026-03-05](https://github.com/drizzle-team/drizzle-orm/releases/tag/v1.0.0-beta.16) already ships DDL commutativity checking; [Atlas rebase](https://atlasgo.io/cli-reference#atlas-migrate-rebase) handles history ordering. **I: reject schema-only conflict checking.** |
| 14 | Compare actual data after both orders of supposedly independent migrations | **F:** Drizzle's published algorithm uses DDL footprints; [Dolt](https://www.dolthub.com/docs/concepts/dolt/git/conflicts/) merges schema and row changes; [Seqwall](https://github.com/realkarych/seqwall) checks sequential up/down schema consistency. **I: retain #2 as a narrow data-order diagnostic**, not general merge or confluence proof. |
| 15 | Rehearse published app versions, persisted state and queued writes across a schema extension | **F:** [Zero](https://zero.rocicorp.dev/docs/schema) documents rollout order and incompatible-client handling; [Replicache](https://doc.replicache.dev/) has schema-version/protocol mechanisms; Jazz already specifies lens-delta compatibility. **I: retain #1 for actual application codecs/handlers, persisted clients and protocol outcomes**, beyond snapshot rows or an engine's internal lens operations. |
| 16 | Signed/hash-addressed evidence proves a migration is safe | **F:** [DSH Schema Migration Proof](https://github.com/dongsheng123132/dsh-schema-migration-proof) already verifies recorded invariant/idempotence/rollback evidence and explicitly does not execute migrations. **I: reject generic receipts.** A digest binds evidence to artifacts; it does not make the evidence truthful or the contract sufficient. |

**F — Search breadth:** inspected GitHub issues/discussions and changelogs, official product documentation, arXiv/CIDR/VLDB, npm and crates registries, and HN. The [Cambria HN discussion](https://news.ycombinator.com/item?id=24699615) had **101 points / 26 comments** in the retrieved index: a useful historical demo signal, not current demand. Searches included schema lenses, mixed-version/offline migration replay, data-migration commutativity, migration testing, runtime schema growth and agent database branches. Registry searches led to executable packages; small repository READMEs were not treated as proof of mature deployments.

## 4. Three local counterexamples that determine the design

**M — Method:** a dependency-free Python script in `/tmp/stack-data/` used **Python 3.15.0 / SQLite 3.54.1**. These are illustrative counterexamples, not benchmarks or tests of Jazz, panproto, Drizzle or LiveStore. Scratch was deleted after the report was completed. The essential programs are reproduced here so deletion does not remove the evidence's recipe.

### A. Lawful does not mean semantically correct

```python
get = lambda s: s
put = lambda s, v: v
for s in range(10_000):
    v, w = s + 17, s + 31
    assert put(s, get(s)) == s
    assert get(put(s, v)) == v
    assert put(put(s, v), w) == put(s, w)
```

**M:** **30,000 assertions passed.** If the source integer means cents and the target number means dollars, this identity lens returns **1299**, whereas the approved interpretation is **12.99**. It preserves information and satisfies all three tested laws. Nothing in those laws names the unit.

**I:** increase law-test volume to improve counterexample coverage, not to manufacture meaning. Require an independently approved unit/domain contract where meaning changes. A complement that stores every discarded value can likewise pass reconstruction while providing a surprising user-facing view.

### B. A correct snapshot migration can still break an old write

```python
from decimal import Decimal
migrate = lambda cents: Decimal(cents) / 100
old_apply = lambda state, cents: cents
new_apply_bad = lambda state, value: Decimal(value)
new_apply_good = lambda state, value: Decimal(value) / 100
assert migrate(old_apply(1000, 1299)) == Decimal('12.99')
assert new_apply_bad(migrate(1000), 1299) == Decimal('1299')
assert new_apply_good(migrate(1000), 1299) == Decimal('12.99')
```

**M:** migration-before-old-write and old-write-before-migration disagree by **100×** with the bad handler. The corrected old-version handler commutes on this case. Replacing both migration and handler with the same wrong identity interpretation also makes the square commute: **commutation alone does not supply the intended unit conversion.**

**I:** capture published writes as versioned operations, not just current rows. Keep the approved semantic mapping outside the candidate's editable acceptance artifacts. Jazz already specifies the underlying translate/apply law; the potential contribution is checking the application's complete operation/version boundary and reporting concrete failures.

### C. Identical final schemas can conceal order-dependent data

```sql
CREATE TABLE users(id INTEGER PRIMARY KEY, email TEXT NOT NULL);
INSERT INTO users VALUES (1, ' Bob@Example.com ');

-- Migration A
ALTER TABLE users ADD COLUMN normalized_email TEXT;
UPDATE users SET normalized_email=lower(email);

-- Migration B
UPDATE users SET email=trim(email);
```

**M:** applying A→B and B→A on separate in-memory copies succeeds and yields identical `sqlite_schema` definitions. Both pass `PRAGMA integrity_check`. But A→B leaves `normalized_email = ' bob@example.com '`, and B→A leaves `'bob@example.com'`. The primary-key/non-null conditions also hold. This proves neither path is universally correct; it proves an undeclared data dependency despite identical final DDL.

**I:** compare data or protected observations for operations claimed to be independent. Where ordering is intentional, require that dependency and test that order. Rejecting every noncommuting migration would be incorrect.

## 5. Finalist #1 — Upgrade rehearsal for a self-extending local-first app

**I — One sentence:** a CI/development gate runs a proposed schema/event extension against preserved app versions, histories and pending writes, then identifies the exact old client and operation that will fail or change a protected result.

**I — Thirty-second demo:** two tabs show a shared issue board. One is yesterday's app, offline with an unpushed edit. An agent adds assignees and changes an event payload. The new app works on a fresh database. The rehearsal reconnects the old tab and turns red: “v1 event 87 cannot decode; this queued edit has no acknowledged durable outcome.” A corrected version keeps the old event decoder/adapter. Rehearsal passes and the offline edit appears after reconnect. A separate cents/dollars example shows a semantic diff only when the unit contract has been approved.

### Closest art and the remaining gap

**F:** [migration-preflight](https://github.com/arnaud-zg/migration-preflight) is especially close: TypeScript, SQLite and PGlite adapters, Drizzle/Prisma/plain-SQL sources, seeding between migrations and row-survival checks. [SQLite Rehearsal](https://github.com/KanadeK/sqlite-rehearsal) executes actual migration SQL on a copy and validates supplied SQL invariants. [Atlas](https://atlasgo.io/faq/changesets) already supports data migration tests and external test tools. A generic snapshot/rollback checker would duplicate them.

**F:** [Zero's production guidance](https://zero.rocicorp.dev/docs/schema) distinguishes DB/API/client rollout order, backfill completion and old-client incompatibility. [Electric's current shape guide](https://electric.ax/docs/guides/shapes) describes invalidation when table metadata changes; that is engine behavior, not an application migration proof. [Automerge's cookbook](https://automerge.org/docs/cookbook/modeling-data/) still warns about old/new client compatibility and says Cambria ideas are not implemented there. [Jazz chapter 10](https://github.com/garden-co/jazz/blob/main/crates/jazz/SPEC/10_lenses_migrations.md) is much closer than round 9 credited and already covers supported lens operations across authored schemas.

**F:** [Replicache's current options reference](https://doc.replicache.dev/api/interfaces/ReplicacheOptions) warns that a missing registered mutator is replaced with a no-op during replay and recommends that registered names only grow. A dated [Yjs maintainer response, 2024-12-04](https://discuss.yjs.dev/t/handling-unknown-nodes-marks-in-prosemirror-schema/3683), explains that y-prosemirror removes invalid nodes and does not translate documents for older schemas. This identifies the application/editor compatibility boundary; it is not a verification that every 2026 binding still has the same behavior.

**I — Bounded gap:** none of those inspected surfaces was a ready-made LiveStore harness that takes **published application bundles + their persisted/pending state + the candidate**, exercises the real app event handlers and reconnect path, and reports decode/acknowledgement/protected-query differences. This is an integration gap to verify with maintainers. It is not evidence that no private or differently named tool exists. A migration-preflight adapter or upstream LiveStore contribution may be the entire useful project.

### Beneficiary and pain

**F/I:** beneficiary: a **LiveStore application maintainer shipping generated feature changes to existing browser/Cloudflare users**, initially whoever can reproduce [#1689](https://github.com/livestorejs/livestore/issues/1689). The repro is contemporary and specific; [#69](https://github.com/livestorejs/livestore/issues/69), opened **2024-05-04**, explicitly asks for schema-evolution checks and has **one eyes reaction / one comment**. This is evidence of a real task, not evidence of a large market. Preserved historical state is the relevant input; a production traffic recorder is unnecessary for the initial version.

### Check, ownership, and gaming

**I — Acceptance contract:** freeze the published event names/codecs, supported-client matrix, protected query/identity/permission obligations and fixture provenance outside the candidate patch. A run must name its actual executed cases. Require:

1. Old retained events and queued operations decode under their declared version, or receive an explicit contract-permitted rejection; an unknown/skipped event is not silently counted as successful replay.
2. Successfully acknowledged operation IDs remain durably accounted for, including after restart/reconnect; retries do not create extra domain operations where the contract requires idempotency.
3. Replay produces the owner's protected observations: existing entity IDs, amounts in declared units, access decisions, and app-specific queries. Validate at checkpoints, not only a final checksum that can hide intermediate loss.
4. For an approved mapping `M` and old operation `o`, compare `M(apply_old(s,o))` with the candidate's old-version handling of `o` on `M(s)`, where that comparison is semantically defined. Label unsupported mappings and intentional behavior changes explicitly.

**I — How an agent games it:** switches unknown-event handling to ignore, removes the old version, changes the normalizer, shrinks fixtures, supplies mutually wrong migration/adapter logic, or grants every role permission so reads “work.” Pin the harness and parent artifacts, make coverage omissions visible, include denied-access observations, and make contract changes separately reviewable. Hold-outs can expose fixture special-casing; they do not prove universal behavior. A hash of a candidate-authored comparator does not make it an independent oracle.

**I — What it establishes:** compatibility for the frozen contract on exercised states, events and schedules. It cannot infer whether “split customer name” means a linguistically correct split, establish safety for unseen data, or prove a new feature desirable. External effects are captured as data rather than sent during replay. Effect-command comparison can be an adapter to the brief's Messages-in/Commands-out idea; rebuilding state must not itself send historical notifications again.

### Why now, why models do not erase it, and who would ship it

**I:** the old labor was reconstructing persisted upgrade scenarios, old producers and offline queues for each release. Agents can maintain that scaffolding. Execution is model-free. Better models reduce bad patches but do not eliminate independently upgraded clients, long-lived data or intentional semantic changes. The public contract belongs to each app, not to one model vendor. **LiveStore absolutely could adopt this**, and migration-preflight could add the adapter; that is a favorable outcome for an open-source side project. There is no credible claim that a platform cannot build it.

### A 2–3-week version and a 1–2-day kill test

**E — Version:** days 1–4: pin one LiveStore version and export fixture bundles containing old events, a persisted snapshot, pending operations and version metadata; reproduce #1689 using its actual local Worker/browser path. Days 5–9: load old/candidate application codecs and materializers in separate runners, replay fixtures, and emit operation-level diffs. Days 10–14: persisted reopen plus offline reconnect in the real adapter, immutable contract manifests, bounded schedules and machine-readable CI output. Optional third week: VibeSDK-style two-tab demonstration and a migration-preflight adapter. No new sync/storage engine, arbitrary lens synthesis or production rollout service.

**I — Expert reply that kills it:** “Our integration tests already run old clients against the new server; your harness either duplicates that in a few lines or cannot preserve our real offline queue. SQL/lens checks cover the rest.”

**I — Kill test, 1–2 days:** use #1689 plus one persisted-upgrade repro and one queued-old-write fixture. Run them through the actual pinned engine/adapter, then try the closest migration-preflight/LiveStore test surfaces. Continue only if the harness reproduces **two distinct** failures without rewriting production handlers into a toy model, a compatible control passes, skipped/ignored events cannot yield a green result, and a maintainer identifies a reusable adapter boundary. If existing tooling expresses the same check with a small recipe, publish that recipe/contribution and stop the standalone pitch. Failure to obtain meaningful protected observations is also a kill, not permission to replace them with an LLM grade.

## 6. Finalist #2 — Data-order checks for parallel agent migrations

**I — One sentence:** for migrations declared independent, apply both orders to copies of the same representative database and diff logical data/protected queries, exposing a dependency the DDL merge does not describe.

**I — Thirty-second demo:** two PRs each pass on their own: “add normalized email” and “trim existing email values.” Git merges cleanly. The checker shows the two migration paths ending at identical schema nodes but different email values, with the single counterexample row from §4C. Add an explicit dependency or change the backfill; both paths then match where independence is intended.

**F — Closest art:** [Drizzle beta.16](https://github.com/drizzle-team/drizzle-orm/releases/tag/v1.0.0-beta.16) already constructs the migration DAG, finds forks and checks DDL operation footprints. Its [commutative-migrations discussion, 2025-10-31](https://github.com/drizzle-team/drizzle-orm/discussions/5005), had **8 reactions** when inspected. [Dolt](https://www.dolthub.com/docs/concepts/dolt/git/conflicts/) already resolves cell/schema conflicts in database branches. [Seqwall](https://github.com/realkarych/seqwall) already exercises up/down/up sequences and compares captured schema metadata. [Atlas](https://atlasgo.io/concepts/migration-directory-integrity) already forces teams to reconcile migration history.

**I — Narrow gap:** replay the **data-transforming operations** against representative rows, including the intended deployment order and owner-approved observations. DDL commutativity, final-state three-way merge and sequential schema reversibility are related checks with different inputs. No claim here that Drizzle's implementation was executed or that all its versions miss §4C; the published DDL algorithm identifies the boundary to test.

**F/I — Pain:** [Prisma discussion #29604, 2026-05-28](https://github.com/prisma/orm/discussions/29604) asks how to switch schema-changing branches while retaining dev data; it had **11 comments / 0 reactions**. Drizzle shipping a dedicated branch check confirms owner interest. These sources prove branch/schema workflow friction, **not** frequent silent order-dependent data corruption. Beneficiary: a Drizzle/SQL app maintainer merging concurrent agent PRs with backfills. Exact demand for this diagnostic remains unverified.

**I — Trustworthy check:** use identical snapshots; run actual SQL; compare canonical rows keyed by stable IDs and protected queries. Verify DB integrity and preserve run order. For `n` independent changes, exhaustive permutations are not viable; check adjacent declared-independent pairs and label that bounded coverage. Pairwise success is not a proof about all longer histories. A legitimate dependency is a valid result, not a bug.

**I — Gaming:** the candidate can label every pair dependent, mask columns or manufacture identity mappings. Freeze independence declarations and observations in the integration policy; report excluded pairs. Fixed snapshots miss future rows. A consistent transform of all data can still be semantically wrong; approved invariants remain necessary.

**I — Survival and ownership:** integration order remains a problem even if both patches are individually excellent. The owner of Drizzle will probably add useful DML checks once demand is demonstrated. Prefer a Drizzle adapter, using SQL/SQLite/PGlite copies rather than a competing ORM or database. Cross-tool/custom SQL scripts provide a modest outside contribution surface; no strong platform-resistance claim survives.

**E — 2–3 weeks:** one week for a SQL migration-folder adapter, branching snapshots and stable row diff; one week for dependency declarations, query contracts and Drizzle CI integration; optional week for a genuine merge fixture and a small browser demonstration. PostgreSQL claims require PostgreSQL/PGlite compatibility qualification; SQLite measurements are not Postgres evidence.

**I — Expert kill reply:** “Atlas tests plus a required serial migration order solve this; your alternative orders are unsupported deployments. Drizzle already catches every practical conflict we see.”

**I — 1–2-day kill test:** find ten public data-backfill migrations with shared ancestors and establish which were genuinely intended to be order-independent. Compare the current Drizzle check and an Atlas/manual-recipe baseline. Require at least **two real missed dependencies** with low false-alarm burden. Kill if the only successes are manufactured examples, every case is explicitly ordered already, or an existing hook supplies the same reusable result without new machinery. §4C proves feasibility of a counterexample, not demand.

## 7. Finalist #3 — Shared-record remixes, with lenses as a restricted runtime feature

**I — One sentence:** permit separate app remixes to present and edit the same records through a deliberately limited lens interface, retaining hidden fields and the original permission boundary.

**I — Thirty-second demo:** the original book-club app and two remixes share updates: title/name rename, optional tag addition, an approved reversible unit conversion. A remix attempts to drop notes or expose private notes through a renamed field. The runtime refuses the loss/permission change and shows the relevant record. An unsupported split is shown as unsupported rather than silently manufactured by an agent.

**F — Closest art:** [Cambria](https://www.inkandswitch.com/cambria/), [panproto and its toolkit](https://github.com/panproto/panproto-toolkit), and especially [Jazz's shared physical lineage, sibling lens paths and pinned policy schema](https://github.com/garden-co/jazz/blob/main/crates/jazz/SPEC/10_lenses_migrations.md). Jazz already covers much of the demo. The remaining proposed difference is **independent remix ownership and a constrained publication/admission flow**, not concurrent schema versions or the mathematics of lenses.

**F/I — Pain and beneficiary:** [Automerge's cookbook](https://automerge.org/docs/cookbook/modeling-data/) names schema compatibility as unresolved work and invites contributions. [Ink & Switch's malleable-software essay, June 2025](https://www.inkandswitch.com/essay/malleable-software/) argues for user/community modification. Beneficiary: a malleable-app author who already wants two versions to share live data. Neither source demonstrates that users generally want a fork to retain shared records rather than get an independent copy. This is the weakest demand claim of the three.

**I — Mechanical check:** admit only a small DSL of operations with executable inverse/update semantics; test GetPut/PutGet/PutPut, update translation and protected authorization observations on real records and boundary cases. Store complements explicitly with ownership, size limits and deletion rules. Detect inconsistent alternate lens paths rather than merely picking one path deterministically. Preserve original record identity and evaluate access in a stable policy schema. These are engineering obligations, not novel theorems; panproto/Jazz supply much of the foundation.

**I — Gaming/limits:** the agent can retain all old data in a complement and offer an absurd new view; lawful unit confusion in §4A passes. Separate owners can disagree about meaning or permission. No algebra resolves that agreement. If the required transform is lossy or ambiguous, refuse it or require an explicit new contract. Treat complement retention as real stored data: hiding a deleted field in it is not deletion.

**I — Survival and platform response:** heterogeneous user customizations remain even with better models, and the bridge runs without inference. But panproto and Jazz can naturally own this; their existing agent tooling eliminates the strongest authoring gap. A contribution demonstrating an independently owned remix boundary is more credible than a new package claiming a missing lens engine.

**E — 2–3 weeks:** use existing lens primitives; one supervisor DO/SQLite record authority, two prebuilt TypeScript remixes and a restricted admission manifest. Implement rename/add, one approved reversible transform, retained notes and role checks. No arbitrary shape synthesis, lossy split/join inference or general multi-authority CRDT merge. The extra owner boundary is a prototype, not a claim of production-ready federation.

**I — Expert kill reply:** “Your demo already runs in Jazz with one admin admitting both schemas. Separate owners do not solve who controls publication; they introduce a product requirement nobody asked for.”

**I — 1–2-day kill test:** build that same three-pane demo with Jazz's existing schema paths plus panproto authoring. If a thin admin configuration supplies the desired sharing/permission behavior, kill the standalone runtime. Otherwise obtain two concrete remix cases whose users require shared live records and identify precisely why centralized admission is unacceptable. No evidence of that need means stop. Do not revive the broad round-9 lens pitch by renaming its machinery.

## 8. The acceptance boundary for runtime schema growth

**I:** a self-extending app should submit a **versioned extension bundle**: code, storage schema, immutable event vocabulary additions, migrations, supported client versions, declared permissions and any approved changes to protected observations. The check's authority belongs to the app/data owner. A passing compiler is one part of admission, not the admission decision.

**I — Concrete sequence:**

1. **Establish the baseline:** name the parent code/schema/contract hashes and the actual snapshot/log cut. Copies must be consistent database snapshots, not arbitrary live-file copies. Keep the candidate's expected results distinct from owner-maintained requirements.
2. **Use mature static checks:** typecheck, schema compatibility, DDL conflict/constraint checks and restricted migration operations. Reuse Confluent/panproto/ORM facilities; do not claim runtime semantics follow from type compatibility.
3. **Exercise the data boundary:** apply actual migrations on a copy, replay retained histories and queued old writes, then compare protected observations. Preserve IDs, hidden data and denied-access decisions. Report which versions and schedules ran.
4. **Bound effects and recovery:** rematerialization emits no external effects; restart the exercised path and verify pending work remains accounted for. An append-only history is useful recovery input, not permission to retain everything forever or a guarantee that a changed projector is correct.
5. **Apply to the state actually checked:** gate production migration on the parent version and relevant data frontier still matching, or rerun/catch up under an explicit write-coordination protocol. A snapshot that passed yesterday is not a certificate for today's new rows. Do not promote a test database by overwriting concurrent live writes. In a DO a serialized migration/version update is an implementation option; it does not create an atomic transaction with external R2 objects.

**F/I — Why not require event sourcing, temporal tables or CRDTs everywhere?** Mature systems already provide each mechanism. [PostgreSQL's constraint documentation](https://www.postgresql.org/docs/current/ddl-constraints.html) also illustrates why `CHECK` without appropriate nullability can be weaker than intended. [Invariant confluence](https://amplab.cs.berkeley.edu/publication/coordination-avoidance-in-database-systems/) makes coordination requirements depend on the particular invariant and operations. CRDT convergence alone does not establish compatibility of two application's schemas or preservation of business meaning. The useful flip is making an app's obligations explicit and routinely executable; choosing one universal storage architecture does not create those obligations.

**I — “bb” assumption:** unresolved in the supplied brief. I used **babashka**, whose [official book](https://book.babashka.org/) identifies its executable as `bb`, as the most defensible scriptable-tool interpretation. That is an explicit assumption, not identification of the builder's intended project. The relevant pattern is a host accepting a new executable extension under a retained data contract; it does not change the database recommendation. NocoDB's runtime schema tooling supplies a more direct data-layer example than guessing another agent's identity.

## 9. Ranked top three, one pick, TL;DR, rejections

**I — Scores, 1–5; estimates of fit, not measurements.** All three are outside GrowOS. “Gap” scores the remaining bounded integration surface after the prior-art search, not the broad pitch. These are ranked experiments, not three validated projects.

| Rank | Finalist | Cool | TS / CF / Vercel | Real gap | Value | Survives better models | Not GrowOS | Total |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | Upgrade rehearsal: published clients + persisted state + queued writes | 4 | 5 | 3 | 3 | 5 | 5 | **25/30** |
| 2 | Data-order diagnostic beyond DDL footprints | 3 | 5 | 2 | 2 | 5 | 5 | **22/30** |
| 3 | Shared-record app remixes through existing restricted lenses | 4 | 5 | 1 | 2 | 4 | 5 | **21/30** |

**I — ONE pick:** **the LiveStore upgrade rehearsal**, initially an upstream/test-tool integration. Spend **two days** trying to disprove the need before committing to a 2–3-week implementation. The decisive artifact is a real persisted/offline failure reproduced through the actual engine and caught by frozen app obligations. If it reduces to an existing test recipe, contribute the recipe and stop; do not build another migration framework.

### Five-line TL;DR

1. **F:** agents increased database branching dramatically; the storage platforms already serve that workload.
2. **F:** panproto now has agent/CI tooling, Jazz has cross-version lenses, and Drizzle checks DDL commutativity.
3. **M:** 30,000 lens-law assertions accepted wrong units; identical final schemas also concealed different data.
4. **I:** runtime schema growth needs preserved old writes and independently owned semantic/permission obligations.
5. **I:** pick a LiveStore upgrade rehearsal; keep it only if real persisted/offline failures exceed existing test recipes.

### Rejected ideas — one line each, with the killer

- **Event-sourced-everything framework:** LiveStore/Axon already supply the machinery; retention and event meaning still cost work.
- **Agent-authored schema lenses plus law tests:** panproto-toolkit already supplies agent authoring and CI checks; laws do not supply intent.
- **CoW SQLite/Facet VFS per agent attempt:** existing branch providers plus D1's explicit native-fork roadmap; owner advantage dominates.
- **Typed/proof-carrying migration plans:** Prisma's attested operation design and existing pre/postcondition machinery occupy the broad pitch.
- **A generic real-data migration rehearsal CLI:** Atlas, migration-preflight and SQLite Rehearsal already execute it.
- **Concurrent old/new SQL schemas:** pgroll/Reshape already implement expand/contract with adapters.
- **A business-invariant database generator:** SQL constraints and invariant-confluence research already exist; generating the intended invariant remains an authority problem.
- **Temporal tables as a new agent database:** XTDB already supplies temporal/dynamic-schema storage; chronology does not validate truth.
- **Shape-only generated-event registry:** Confluent and existing compatibility libraries own this check.
- **An app that adds its own columns:** NocoDB MCP already changes schemas and dry-runs destructive field conversions.
- **Code/database/blob rollback as a generic new primitive:** existing backend platforms integrate these surfaces; cross-vendor historical consistency lacked verified demand here.
- **Schema-only parallel migration conflict detector:** Drizzle beta.16's DDL commutativity checker is direct prior art.
- **Migration safety receipts:** DSH already packages recorded evidence; hashing candidate assertions cannot establish their sufficiency.
