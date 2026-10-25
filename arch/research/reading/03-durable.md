# Durable execution & correctness

Curated for Sofort / Capsule, 2026-10-25. Context: `demo.md` §§0–1 and `arch/research/cloudflare-goose/SYNTHESIS.md`. **28 items; eight P1s.** Read the P1s before defending the pause/fork/move and effects-journal claims.

The question to keep asking: **what is durably committed, who may act on it, and what happens if the process dies after the outside world changes but before the result is recorded?** A saved continuation does not, by itself, close that gap. The “Why for Sofort” lines below are applications of the sources to this project, not claims that the sources discuss Sofort.

Verification: every item URL was fetched and its identity/content checked on 2026-10-25. Gillum's Medium article was verified through the web-fetch tool; a direct HTTP client received 403. The YouTube item's title and channel were additionally verified through YouTube oEmbed; its duration came from the watch-page metadata. Blog reading times marked `~` are estimates, and other reading times are publisher estimates. “Blog” includes technical essays/articles. Two explicitly marked paper-PDF fallbacks cover historical material for which no suitable accessible post/talk was verified; these are the brief's exception, not additional required papers. Undated pages are labeled rather than assigned a copyright year.

## Durable workflows: establish the comparison baseline

- [P1] **Building reliable distributed systems in Node.js part 2** — Loren Sands-Ramshaw (Temporal), Type (Blog), 2023; updated 2026, 10 min — <https://temporal.io/blog/building-reliable-distributed-systems-in-node-js-part-2>
  Why for Sofort: Understand how event histories reconstruct local variables and control flow without exporting a stack image; this is the recorded-result-replay baseline Capsule must beat. Concepts: deterministic replay, event history, workflows, activities, recovery.

- [P1] **Common Pitfalls with Durable Execution Frameworks, like Durable Functions or Temporal** — Chris Gillum (Microsoft; creator of Azure Durable Functions), Type (Blog), 2022, 8 min — <https://blog.cgillum.tech/common-pitfalls-with-durable-execution-frameworks-like-durable-functions-or-temporal-eaf635d4a8bb>
  Why for Sofort: The builder's critical account covers Azure Durable Functions, idempotency, code/version compatibility, payload/history growth and poison work; check which problems snapshots remove and which survive. Concepts: Azure Durable Functions, replay constraints, at-least-once activities, versioning, journal limits.

- [P2] **Building a modern Durable Execution Engine from First Principles** — Stephan Ewen, Ahmed Farghal, Till Rohrmann (Restate), Type (Blog), 2025, ~20 min — <https://restate.dev/blog/building-a-modern-durable-execution-engine-from-first-principles>
  Why for Sofort: Study the server's authoritative journal, durable invocation coordination and epoch-based fencing before designing a Durable Object owner plus R2 continuation protocol. Concepts: Restate, journals, replicated logs, leader epochs, fencing, durable communication.

- [P2] **Why Durable Execution Should Be Lightweight** — Peter Kraft, Qian Li (DBOS), Type (Blog), 2025, ~8 min — <https://www.dbos.dev/blog/what-is-lightweight-durable-execution>
  Why for Sofort: A useful builder's challenge to heavyweight orchestration: compare a database-backed execution library with Capsule's claimed simplicity, and keep transactional database work separate from external effects. Concepts: DBOS, embedded orchestration, database-backed checkpoints, recovery, deployment cost.

- [P2] **How a durable workflow engine works: you might not need a queue** — Tony Holdstock-Brown (Inngest), Type (Blog), 2023; updated 2026, 10 min — <https://www.inngest.com/blog/how-durable-workflow-engines-work>
  Why for Sofort: Named steps and memoized results provide a simple serverless recovery baseline; distinguish a checkpointed result from a portable execution-state image. Concepts: Inngest, step identity, memoization, state transitions, queues, serverless suspension.

- [P2] **What Is Durable Computing?** — John A. De Goes (Golem), Type (Blog), 2023, ~6 min — <https://golem.cloud/blog/what-is-durable-computing/>
  Why for Sofort: Read the original durable-Wasm pitch as prior art for preserving apparent stack/heap execution; its abstract “snapshot” language is not evidence of an exportable raw continuation format. Concepts: Golem, durable Wasm, incremental recovery, execution state, persistence boundary.

- [P2] **Golem 1.4: Code-First Rust, Atomic Deployments, and a More Powerful Agent Runtime** — John A. De Goes (Golem), Type (Blog), 2025, ~5 min — <https://golem.cloud/blog/golem-1-4-code-first-rust-atomic-deployments-and-a-more-powerful-agent-runtime/>
  Why for Sofort: Explicitly identifies agent forking, durability/idempotence controls and durable promises as existing platform capabilities exposed to Rust; fork itself cannot be the novelty claim. Concepts: durable Wasm, agent fork, persistence levels, durable promises, deployment versions.

- [P1] **Golem 1.6: Agents, Tools, and Artifacts** — John A. De Goes (Golem), Type (Blog), 2026, ~15 min — <https://golem.cloud/blog/golem-1-6-agents-tools-and-artifacts/>
  Why for Sofort: The current comparison includes stream forks, snapshot-based restoration/updates, Wasm import authority and replayed authorization; identify precisely what Capsule adds in artifact portability and independently testable effects semantics. Concepts: Golem, Wasm, forks, snapshots, oplog, capabilities, read-only execution, versioning.

## Continuations and checkpoint/restore: know the lineage and the boundary

- [P2] **Forensic container checkpointing in Kubernetes** — Adrian Reber (Red Hat / CRIU), Type (Blog), 2022, ~7 min — <https://kubernetes.io/blog/2022/12/05/forensic-container-checkpointing-alpha/>
  Why for Sofort: Uses familiar Kubernetes/OCI machinery to explain CRIU stateful copies and repeated restoration; enumerate what a one-tool-channel guest avoids having to reconstruct. Concepts: CRIU, process checkpoint/restore, container images, forensic copies, runtime integration.

- [P3] **Design Evolution of the EROS Single-Level Store** — Jonathan S. Shapiro, Jonathan Adams (Johns Hopkins / University of Pennsylvania), Type (Paper PDF — fallback), 2002, 14 content pages; ~45 min — <https://www.usenix.org/legacy/publications/library/proceedings/usenix02/full_papers/shapiro/shapiro.pdf>
  Why for Sofort: The primary account follows KeyKOS into EROS and explains globally consistent transparent persistence; study checkpoint commit, recovery and the boundary between persistent state and external devices. Concepts: KeyKOS, EROS, orthogonal persistence, single-level store, copy-on-write, checkpoint consistency.

- [P3] **What Makes Smalltalk Unique?** — Erik Engheim (independent), Type (Blog), 2022, ~6 min — <https://erikexplores.substack.com/p/what-makes-smalltalk-unique>
  Why for Sofort: A concise historical introduction to Lisp/Smalltalk image-based development; distinguish preserving a live object world from guaranteeing recovery of external effects. Concepts: Smalltalk images, Lisp images, serialization, live state, image-based development.

- [P2] **Serializable Closures in PLT Scheme** — Jay McCarthy (PLT / Racket), Type (Blog), 2009, ~6 min — <https://blog.racket-lang.org/2009/06/serializable-closures-in-plt-scheme.html>
  Why for Sofort: Shows the code/environment representation supporting serializable continuations, a useful alternative to an opaque Wasm stack image; ask how code identity and free-variable representation survive versions. Concepts: serializable continuations, closures, environment capture, source transformation, deserialization.

## Replay and time-travel debugging: recovery is also an inspection primitive

- [P2] **Introducing rr** — Robert O'Callahan (Mozilla), Type (Blog), 2014, ~7 min — <https://robert.ocallahan.org/2014/03/introducing-rr.html>
  Why for Sofort: The original design explains deterministic replay, nondeterminism capture and single-core execution; compare those assumptions with jitk's syscall/tool boundary, treating its platform-support list as historical. Concepts: rr, record/replay, scheduling, syscalls, reverse execution, determinism boundary.

- [P2] **Advanced Debugging Technology In Practice** — Robert O'Callahan (Pernosco; rr co-creator), Type (Blog), 2024, ~5 min — <https://robert.ocallahan.org/2024/10/debt-workshop.html>
  Why for Sofort: An unusually candid builder's account of rr and Pernosco explains omniscient debugging, reverse dataflow and adoption obstacles; use it to define what a replay/fork debugger would actually let an agent author inspect. Concepts: Pernosco, rr, time-travel debugging, omniscient debugging, reverse dataflow, developer workflow.

## Effects: make the guarantee precise

- [P2] **Designing robust and predictable APIs with idempotency** — Brandur Leach (Stripe), Type (Blog), 2017, ~7 min — <https://stripe.com/blog/idempotency>
  Why for Sofort: The clearest short explanation of ambiguous network outcomes and receiver-side idempotency keys; a completed external write can remain unknown to the caller. Concepts: Stripe, idempotency keys, ambiguous completion, retries, backoff, jitter.

- [P1] **Implementing Stripe-like Idempotency Keys in Postgres** — Brandur Leach (independent article; Stripe engineer at publication), Type (Blog), 2017, ~25 min — <https://brandur.org/idempotency-keys>
  Why for Sofort: Translate atomic phases and recovery points into prepared → dispatched → completed → delivered; its non-idempotent foreign-mutation case exposes the limit of any “write never repeats” demo. Concepts: idempotency keys, foreign effects, atomic phases, recovery points, request identity, reconciliation.

- [P2] **Exactly-once message delivery** — Szymon Pobiega (Exactly Once / Particular Software), Type (Blog), undated, ~11 min — <https://exactly-once.github.io/posts/exactly-once-delivery/>
  Why for Sofort: A useful counterweight to blanket “exactly once is impossible” claims: specify delivery versus processing and the transaction/protocol boundary within which a once-only effect can be established. Concepts: exactly-once myths, delivery versus processing, transactional scope, deduplication, broker protocols.

- [P2] **Transactionally Staged Job Drains in Postgres** — Brandur Leach (independent article; Stripe engineer at publication), Type (Blog), 2017, ~5 min — <https://brandur.org/job-drain>
  Why for Sofort: A concrete transactional-outbox-style design closes the database-commit/enqueue gap; the analogous Capsule question is how journal intent and dispatch become recoverable without claiming the remote write is in the same transaction. Concepts: transactional outbox, staged jobs, commit/enqueue race, atomic intent, duplicate delivery.

- [P2] **Saga compensating actions design pattern** — Emily Fortuna (Temporal), Type (Blog), 2023, 9 min — <https://temporal.io/blog/compensating-actions-part-of-a-complete-breakfast-with-sagas>
  Why for Sofort: Compensation must account for an operation that succeeded before timing out; define how failed or canceled executions repair business state, and why restoring a snapshot does not undo the world. Concepts: sagas, compensation ordering, partial failure, timeouts, business recovery.

- [P3] **Life beyond Distributed Transactions: an Apostate's Opinion** — Pat Helland (Amazon), Type (Paper PDF — fallback), 2007, 10 pages; ~30 min — <https://www.cidrdb.org/cidr2007/papers/cidr07p15.pdf>
  Why for Sofort: The classic primary treatment of entities, activities, remembered messages and tentative business operations supplies the vocabulary for a journal that coordinates separate authorities. Concepts: Pat Helland, local transactions, entity boundaries, message identity, idempotence, tentative operations.

## Ownership: restored copies need enforceable authority

- [P1] **How to do distributed locking** — Martin Kleppmann (University of Cambridge), Type (Blog), 2016, ~15 min — <https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html>
  Why for Sofort: The must-read for stale executors: a lease can expire during a pause, so enforce fencing at the journal/effect gateway rather than trusting a resumed worker's ownership belief. Concepts: fencing tokens, stale owners, GC pauses, leases, correctness versus efficiency, Redlock critique.

- [P2] **Is Redlock safe?** — Salvatore Sanfilippo / antirez (Redis), Type (Blog), 2016, ~10 min — <https://antirez.com/news/101>
  Why for Sofort: Read the designer's rebuttal alongside Kleppmann; make clock, delay and resource-cooperation assumptions explicit instead of importing the debate's conclusion without its system model. Concepts: Redlock, leases, timing assumptions, unique tokens, fencing debate, system models.

## Testing: turn the guarantees into failures you can reproduce

- [P1] **“Testing Distributed Systems w/ Deterministic Simulation”** — Will Wilson (FoundationDB), Type (YouTube; channel: Strange Loop Conference), 2014, 40:20 — <https://www.youtube.com/watch?v=4fFDFbi3toc>
  Why for Sofort: The foundational explanation of simulated time/network/failures and reproducible seeds; Sofort's single I/O channel is a promising seam for a much smaller version of this harness. Concepts: FoundationDB, deterministic simulation testing, fault injection, seeded replay, invariants, state-space exploration.

- [P1] **Simulation Testing For Liveness** — Alex Kladov / matklad (TigerBeetle), Type (Blog), 2023, ~6 min — <https://tigerbeetle.com/blog/2023-07-06-simulation-testing-for-liveness/>
  Why for Sofort: VOPR separates safety under faults from progress after conditions improve; “no duplicate write” and “every committed result is eventually delivered” need separate checks. Concepts: TigerBeetle VOPR, deterministic simulation, safety, liveness, fault healing, availability.

- [P2] **So you think you want to write a deterministic hypervisor?** — Alex Pshenichkin (Antithesis), Type (Blog), 2024, ~13 min — <https://antithesis.com/blog/deterministic_hypervisor/>
  Why for Sofort: The implementer's account of CPU, time, parallelism and I/O entropy is a reality check for “replays exactly”; define whether Sofort promises tool-level equivalence or instruction-level determinism. Concepts: Antithesis, deterministic hypervisor, entropy, virtual time, CPU behavior, whole-system simulation.

- [P1] **Orkes Conductor 5.3.2** — Kyle Kingsbury (Jepsen), Type (Blog / analysis article), 2026, ~25 min — <https://jepsen.io/analyses/orkes-conductor-5.3.2>
  Why for Sofort: A directly relevant workflow-engine fault test checks concurrent task attempts, forgotten workflows and false completion; reuse its operation-history/oracle approach, while noting the report also documents subsequent fixes. Concepts: Jepsen, workflow correctness, observed histories, fault injection, concurrent execution, lost work, safety and liveness.

- [P2] **Files are hard** — Dan Luu (independent), Type (Blog), 2015, ~20 min — <https://danluu.com/file-consistency/>
  Why for Sofort: Crash outcomes depend on persistence ordering, not just successful writes; turn snapshot publication, journal pointers and local durable caches into explicit crash-consistency cases rather than copying filesystem assumptions onto DO/R2. Concepts: crash consistency, write ordering, fsync, rename, recovery protocols, filesystem testing.

- [P2] **How SQLite Is Tested** — SQLite development team (SQLite), Type (Blog / technical article), undated living article, ~30 min full; ~8 min for §§3.2–3.4 — <https://sqlite.org/testing.html>
  Why for Sofort: Copy the method of injecting I/O errors, simulated crashes and compound failures around persistence operations; test journal/checkpoint recovery at each boundary, including failure during recovery itself. Concepts: crash-consistency testing, I/O fault injection, torn/reordered writes, compound failures, recovery invariants.

## If you only have 3 hours

1. **30 min — Recovery mechanisms:** Temporal part 2 → Gillum's pitfalls → Golem 1.6; write down replay history, execution image and authority as three separate contracts.
2. **40 min — Effect boundary:** Brandur's idempotency implementation → staged job drains → Stripe; enumerate crashes before dispatch, after remote commit, before journal completion and before result delivery.
3. **25 min — Ownership:** Kleppmann → antirez; specify where a monotonically increasing epoch is checked, and how a resumed stale owner or fork is denied dispatch.
4. **41 min — Harness design:** Watch Will Wilson's FoundationDB talk; identify every uncontrolled input in Sofort and sketch a seeded fault schedule around the tool channel.
5. **44 min — Acceptance criteria:** TigerBeetle liveness → Jepsen's Conductor report → SQLite §§3.2–3.4; derive separate no-duplicate/no-lost-result/progress checks and crashes during recovery.
