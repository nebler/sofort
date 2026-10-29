# T07 — Data, databases and storage: engines that acquire capabilities

Research date: **2026-10-29**. Read against `BRIEF-tailwind.md`, the relevant rows of `synthesis/S05-seeds.md` and the extraction ledgers, the raw passages below, `SUMMARY.md`, `ambition/A09-critic.md`, and the research summary’s kill list.

**I — Recommendation:** investigate **DeltaForge**, an incremental collection engine whose missing algorithms models implement and prove against ordinary batch definitions. **ByteGarden**, an engine for editing existing encoded documents without materializing them, has the clearest individual pain quote. **ProofSkip**, a growing compiler of sound pruning rules for custom predicates, has an attractive check but the closest competition. These are three narrowed research bets; the search does not establish exclusive territory for any of them.

**Labels:** **Q** = transcript quotation; **F** = externally sourced fact; **I** = inference or proposed design; **E** = estimate or proposed threshold. All implementation plans and demos are **I/E**, not results obtained during this research. Quotes preserve caption wording. Transcript timestamps are minute buckets, not second-level utterance locations. All proposed implementations use Rust, TypeScript, and native verifier tools; no Python implementation or runtime is required.

## What the corpus changes about the search

**Q — Meaning is an input to the check.** An audience member asks Micah Wylde what happens when “two departments have three different answers” about revenue; he responds that agents need humans to understand “what does our data represent”. Source: **Micah Wylde, Cloudflare Basin lead, and an unnamed audience member**, `05-turning-data-questions-into-data-infra-with-cloudflare-basin.txt`, **16:00–17:00**, checked at [lines 20–21](../../connect26/transcripts/05-turning-data-questions-into-data-infra-with-cloudflare-basin.txt#L20), [video](https://www.youtube.com/watch?v=NlRTSleUkE0&t=960s). **I:** none of the engines below determines what revenue ought to mean. The builder supplies a reference computation and explicit treatment of time, multiplicity, missing values, and ordering. Models grow implementations of that definition. Equality to a reference is a computational claim, not validation of the business definition.

**Q — Keep the substrate narrow.** Brendan O’Brien recounts users saying “I just want a dumb pipe between two machines. Get it out of my way.” Source: **Brendan O’Brien, Iroh/Number Zero**, `p3-57-local-first-conf-brendan-o-brien-iroh-syncing-terabytes-of-data-peer-t.txt`, **12:00**, checked at [line 16](../transcripts/p3-57-local-first-conf-brendan-o-brien-iroh-syncing-terabytes-of-data-peer-t.txt#L16), [video](https://www.youtube.com/watch?v=QLr-0RgMNzo&t=720s). **I:** this is evidence against proposing another complete sync stack. His talk concerns the reliability and narrowing of Iroh’s connectivity primitive; its title is not evidence of an unsolved terabyte-sync algorithm. The candidates below can sit underneath applications or existing engines without acquiring a network, cloud, or collaboration product.

**Q — Partitioning is still a design decision.** Ashley Peacock says to “think about your hottest path and optimize for that”, while avoiding “too much coordination between your durable objects”. Source: **Ashley Peacock, Cloudflare Durable Objects engineer**, `09-why-modern-software-engineering-needs-durable-objects.txt`, **13:00**, checked at [line 17](../../connect26/transcripts/09-why-modern-software-engineering-needs-durable-objects.txt#L17), [video](https://www.youtube.com/watch?v=75jxhU6z3ho&t=780s). **I:** begin with a local engine and explicit keys. Shipping generated code does not remove cross-shard transactions, communication costs, or a hot key.

### Directions cut by the actual search

- **F — Generated query engines and generated maintained indexes are occupied.** Cornell’s [GenDB repository](https://github.com/SolidLao/GenDB) describes agent-generated layouts, indexes, and query executables, including accumulating optimization experience. [JetStream, submitted 2026-08-23](https://arxiv.org/abs/2608.22476), goes further: a fixed substrate, generated database adapters, persistent auxiliary state, and generated maintenance logic for changing databases. **I:** “GrowOS, but a database/query accelerator” is already too broad. Incremental maintenance alone does not distinguish a proposal from JetStream.
- **F — A universal decoder boundary is occupied.** [AnyBlox](https://github.com/AnyBlox) bundles Wasm decoders with data and integrates with several engines. Its [March 2026 SIGMOD Record account](https://sigmodrecord.org/publications/sigmodRecord/2603/pdfs/14_decode-gienieczko.pdf) reiterates that architecture. **I:** growing readers or inventing a self-decoding file format is not an available broad pitch.
- **F — Schema lenses and CRDT synthesis are occupied.** [Cambria](https://github.com/inkandswitch/cambria-project) translates documents, edits, and schemas bidirectionally. [Katara](https://github.com/hydro-project/katara) already synthesizes CRDT designs from sequential data types with explicit conflict policies. **I:** adding a model proposer to those descriptions does not supply a new project.
- **I — Exclusions retained:** fault records, package-behaviour atlases, an agent-era Jepsen, preservation archives, generic semantic layers, and kernel/OS growth. The accumulated asset in each candidate is executing engine capability. Test cases support that asset; a casebook is not the deliverable.

## 1. DeltaForge — a collection engine that grows its own delta algorithms

**I — One sentence:** write a deterministic batch definition of a custom collection operation; when the running dataflow lacks an incremental implementation, models build a reusable state representation and update algorithm inside a fixed, checked operator boundary.

### The seed

**Q:** “Teams have to manage thousands of models in some cases” to serve pre-aggregated data; the presenter explicitly says dbt is working on this burden. **Speaker:** dbt Labs presenter, personal name not identified in the captions. **Video file:** `03-dbt-labs-the-semantic-layer-is-dead-long-live-the-semantic-layer.txt`, **10:00**, checked at [line 14](../transcripts/03-dbt-labs-the-semantic-layer-is-dead-long-live-the-semantic-layer.txt#L14), [video](https://www.youtube.com/watch?v=DcaIBzQlrJk&t=600s).

**Q:** “you're only updating the delta of what change, not the entire thing”. **Speaker:** Delaney Gillilan, Datastar creator, discussing his binary data representation. **Video file:** `p3-34-software-unscripted-podcast-fast-functional-reactive-programming-with-.txt`, **1:20:00**, checked at [line 84](../transcripts/p3-34-software-unscripted-podcast-fast-functional-reactive-programming-with-.txt#L84), [video](https://www.youtube.com/watch?v=CpLEVZ3r5mM&t=4800s).

**I — Inference from those seeds:** make maintaining a derived result an acquired execution capability. Gillilan’s quote concerns encoded data, not a claim that arbitrary incremental algorithms are solved. The dbt quote identifies a real burden and also a commercial owner; ordinary warehouse materialization management is excluded from this proposal.

### What grows, and what the builder designs

**I:** the artifact is an embedded Rust engine with an expanding library of **collection-to-collection delta operators**. Examples worth testing are interval coalescing with deletions, custom session boundaries under late corrections, and ordered deduplication with explicit tie rules. A batch interpreter handles every admitted definition; an accepted incremental implementation replaces repeated batch work for that operator and can compose with other accepted operators.

The human designs a small total collection language, key/identity rules, an explicit insert/delete/update algebra, state ownership, a reference interpreter, and the promotion contract. This is bounded to that language; it is not a promise to incrementalize unrestricted Rust, side effects, or external API calls.

For an operator with input collection `X`, internal state `S`, observation function `observe`, and batch meaning `F`, the central obligation is:

`observe(update(S, ΔX)) = F(apply(X, ΔX))`, assuming `observe(S) = F(X)` and the state representation invariant holds.

**I:** models propose auxiliary indexes, update routines, invariants, and proofs. A native verifier checks initialization and preservation against the frozen reference semantics; a fixed lowering translates the admitted implementation language to Rust. Differential mutation sequences, deletion-heavy cases, checkpoint/reload tests, and performance measurements additionally check the generated path. Bounded checks are labelled bounded. An unproved candidate remains experimental and the engine retains batch evaluation. Models cannot edit the meaning of `F`, the checker, or the acceptance thresholds while submitting an operator.

**I — What is kept:** executable operator implementations, their abstraction relations and composition laws, checkpoint formats, and measured workload envelopes. A later operation uses those implementations rather than regenerating its entire pipeline. Semantics changes create a new operator version and rebuild affected state; automatic state migration is outside the initial scope.

### Tailwind and the one-shot test

**I — Tailwind:** a stronger model can discover a compact auxiliary structure, handle harder deletion cases, discharge an induction proof, or improve an existing operator. Old admitted operators keep running with no model on the update path. The useful frontier moves from simple aggregates toward ordered, nested, and graph-shaped collections as model capability improves.

**I — One-shot test:** a model can already write a particular sessionizer. The proposed finished value is a coherent engine containing many composable stateful algorithms, persistent representations, independently checked refinement obligations, and measured update costs. Producing another implementation does not reproduce those integration obligations or establish that its deletion, checkpoint, and composition semantics agree. The cheapest challenge to this argument is to give the same future model the frozen interfaces and held-out operators: if it produces the whole usable set in one unassisted generation, the project’s claimed accumulation advantage is weak.

**I — Value proposition:** **keep custom derived data current after corrections without repeatedly rescanning it or hand-writing its bookkeeping.**

### The six-week version

**E:** one person builds a single-process engine with integer/time/tuple collections, stable row IDs, a batch interpreter, a narrow verifier bridge, and two admitted custom operators. Existing Rust storage handles persistence. No distributed planner, SQL frontend, hosted service, or connector fleet is required. A broader library is a many-month systems project.

**I/E — Demo:** maintain coalesced availability intervals and sessions over one million public or generated events. Insert a late event that bridges two sessions; delete the bridge and watch them split correctly. Request an unsupported session rule, let the model build its operator and proof, admit it, restart the engine, and repeat with model access disabled. Compare with batch recomputation after every mutation and with the best existing SQL expression. Report update time, affected output size, state size, and synthesis cost separately. The target is at least a 10× update improvement on sparse corrections; large changes may legitimately touch most of the result.

### Prior art and precisely what is left

**F:** [Feldera](https://github.com/feldera/feldera) already incrementally evaluates rich SQL; it is a commercial platform with a substantial open-source engine. Its [current UDF documentation](https://docs.feldera.com/sql/udf/#creating-user-defined-non-linear-aggregate-functions) says custom non-linear aggregate functions are unsupported, while custom linear aggregates exist. This is an API boundary, not evidence that the corresponding result cannot be expressed through built-in SQL. [Cozy](https://github.com/CozySynthesizer/cozy) already synthesizes representations and efficient methods from specifications; its [ICSE 2018 paper](https://homes.cs.washington.edu/~mernst/pubs/generalized-synthesis-icse2018.pdf) includes incrementalization. JetStream already generates maintained auxiliary state, as noted above.

**I — Residual:** an operator-level growth mechanism for custom non-linear collection functions, with reusable implementations and checked state refinements, independent of a particular SQL workload or database backend. That is narrower than automatic incrementalization, generated indexes, or a new streaming platform. No inspected source established this complete residual as a shipped system. It is a scope hypothesis, not a claim that replacing Cozy’s search with models is itself novel. Feldera could absorb the result; its future UDA work is a direct competitive risk.

### The kill

**I:** the strongest objection is that these “missing algorithms” are already efficient SQL/dataflow expressions, or that invariant authoring consumes all the effort the model saves. A second risk is the unavoidable size of the changed output: no algorithm makes a global rearrangement local.

**I/E — Cheapest test, two days:** select three non-linear collection definitions before building the engine. Try Feldera/built-in SQL, an ordinary hand-written Rust implementation, and a model candidate under the same frozen reference. Continue only if at least two reveal a useful implementation or expressiveness gap and one yields a checked local update algorithm without hand-authoring the whole solution. Kill the independent project if the outcome is merely a few routine UDA examples. This gate precedes the six-week build.

## 2. ByteGarden — an encoded-document editor that grows format support

**I — One sentence:** a single edit engine applies structural changes directly to existing encoded documents, and models grow missing format operations under contracts that preserve the intended decoded result and untouched encoded regions.

### The seed

**Q:** “if you're ingesting something, making a minor change, and then sending off a wire, um that's a very costly thing.” **Speaker:** Delaney Gillilan, describing ETL work with large JSON payloads and his TRON representation. **Video file:** `p3-34-software-unscripted-podcast-fast-functional-reactive-programming-with-.txt`, **1:18:00**, checked at [line 82](../transcripts/p3-34-software-unscripted-podcast-fast-functional-reactive-programming-with-.txt#L82), [video](https://www.youtube.com/watch?v=CpLEVZ3r5mM&t=4680s).

**Q:** “the only way to beat it is by not doing the work.” Same speaker, file, timestamp, and transcript line. **I:** take the sparse-edit workload seriously while retaining the sender’s existing format. The speaker already has a format implementation; inventing another binary JSON representation would not be the opening.

### What grows, and what the builder designs

**I:** the core operates on byte spans using a small edit algebra: locate a typed path, validate the necessary framing, retain untouched spans, replace a value, repair enclosing lengths/counts, and emit a valid result. Models add format-specific navigation, mutation, and framing rules. Initial targets are Protobuf and CBOR; BSON offers a subsequent length-framed test. Existing codecs remain independent semantic references.

The human fixes path semantics, duplicate-field/key behavior, integer/decimal treatment, unknown-field preservation, resource limits, and a reference “decode, edit, encode” meaning. The model builds implementation modules inside those interfaces. It must state where an edit changes surrounding framing and where bytes must be retained exactly. There is no universal claim that all serializers preserve all opaque information: unsupported ambiguous cases are explicit.

**I — Checks:** use two complementary obligations: the decoded result equals the reference edit, and encoded regions outside the declared edit/framing footprint remain identical. Reference decoders check semantic results over generated and real fixtures. A small verifier checks span bounds, non-overlap, length accounting, and compositional frame laws for admitted primitives. Integration fuzzing checks actual native decoders and code generation; those results do not become a blanket proof of arbitrary format support. Compressed envelopes, signatures over changed content, and unknown schema-dependent interpretations require explicit handling.

**I — Accumulated artifact:** interoperating navigation/edit/framing implementations and their laws, compiled into one engine. Growing support for CBOR indefinite-length containers or Protobuf packed-field edits adds reusable capabilities to every subsequent transformation. Unchanged embedded data can remain opaque.

### Tailwind and the one-shot test

**I — Tailwind:** stronger models can handle more awkward encodings, discover shared framing combinators, and produce better checked specializations. Every addition expands the permanent set of documents and edits the engine understands. Execution remains deterministic without inference.

**I — One-shot test:** a generated decoder or a one-off field replacement is cheap. A maintained multi-format editor must make all the combinations of nesting, length changes, duplicate handling, unknown fields, and edit composition agree with the same contract. The human contribution is the edit semantics and trusted span machinery; the grown value is the integrated library and its independently checked laws. If thin wrappers around existing codecs achieve that entire result, this fails the ambition test and should be cut.

**I — Value proposition:** **change a few fields in a large message without allocating and rebuilding the entire decoded object.**

### The six-week version

**E:** a Rust library/CLI, TypeScript control interface, a span-based interpreter, and two formats with replace/delete/insert operations. Restrict the initial schema and numeric domains. Use native reference codecs and public format fixtures; no company’s production messages are needed.

**I/E — Demo:** apply the same nested edit to 100 MiB Protobuf and CBOR documents containing large untouched payloads. Grow one missing container operation from the public format specification, reject a candidate with incorrect enclosing lengths, admit the repaired implementation, and rerun offline. Show equivalent decoded output, exact retention of declared opaque regions, and allocation/CPU measurements against established sparse-access libraries. A useful target is additional heap use below 4 MiB for that workload, excluding the input/output buffers. Scanning and emitting may still be linear in document size; this is not a claim of constant-time editing or zero I/O.

### Prior art and precisely what is left

**F:** ByteDance/CloudWeGo’s [DynamicGo Protobuf implementation](https://github.com/cloudwego/dynamicgo/blob/main/proto/INTRODUCTION.md) already provides path access, sparse set/delete operations, unknown-field handling, and repair of enclosing encoded lengths. [Sonic](https://github.com/bytedance/sonic/blob/main/README.md) already supplies lazy JSON navigation and mutation. Microsoft’s [EverParse](https://github.com/project-everest/everparse) generates verified parsers and, through EverCDDL, C/Rust parsers and serializers; [releases on 2026-10-25 and 2026-10-27](https://github.com/project-everest/everparse/releases) show active CBOR work. AnyBlox already supplies the decoder portability boundary.

**I — Residual:** models grow **raw-preserving mutation support across existing formats** against a shared edit algebra and compositional frame checks. Sparse access, zero-copy parsing, code generation, and verified serialization are occupied. A mere Rust rewrite or “add CBOR to DynamicGo” is too small. The distinct ambition is an engine whose mutation vocabulary extends without a manually maintained bespoke editor per encoding. The search found substantial components and capable institutional owners; it did not establish that the complete residual is unclaimed.

### The kill

**I:** DynamicGo may already capture most of the practical value, while whole-message copying/compression dominates total cost. The novel remainder could reduce to a pleasant adapter layer whose generation a better model makes trivial.

**I/E — Cheapest test, two days:** implement three representative sparse edits through existing libraries before designing a new core. Measure full pipeline cost, not parser microbenchmarks. Then ask a model to add one unsupported framing operation using only the proposed generic span primitives. Kill the engine pitch if there is no material cost/retention advantage, or if each format still requires a separate hand-built editor. Continue only if the shared algebra actually carries the new implementation.

## 3. ProofSkip — query pruning that grows with the functions it encounters

**I — One sentence:** when a query contains an unfamiliar deterministic function, models build a reusable conservative summary rule and its proof, enabling the query engine to skip irrelevant data blocks while retaining the ordinary exact function for candidate rows.

### The seed

**Q:** repeated exploratory queries should avoid “having to read all of that data from cold storage.” **Speaker:** Micah Wylde, Cloudflare Basin lead, explaining reuse of cached data during agent exploration. **Video file:** `05-turning-data-questions-into-data-infra-with-cloudflare-basin.txt`, **14:00**, checked at [line 18](../../connect26/transcripts/05-turning-data-questions-into-data-infra-with-cloudflare-basin.txt#L18), [video](https://www.youtube.com/watch?v=NlRTSleUkE0&t=840s).

**Q:** “Every time you every node you're traversing a different cache line”. **Speaker:** Peter Mattis, database engineer and Cockroach Labs co-founder, discussing why an STL map replacement needed a different layout. **Video file:** `22-the-pragmatic-engineer-distributed-databases-with-peter-mattis.txt`, **0:31:00**, checked at [line 35](../transcripts/22-the-pragmatic-engineer-distributed-databases-with-peter-mattis.txt#L35), [video](https://www.youtube.com/watch?v=0GzwuYGvKA4&t=1860s).

**I — Inference:** grow the engine’s ability to avoid irrelevant work rather than just generate another exact evaluator. Neither practitioner is asking for this particular compiler. Basin already caches and Mattis already built faster containers; those existing mechanisms are not the proposed gap.

### What grows, and what the builder designs

**I:** start with an immutable local Parquet dataset and a small Rust query host. The host has exact scalar functions plus block summaries. For an unsupported custom predicate, the model proposes summary construction, combination, and a `may_match(summary, parameters)` evaluator. The exact predicate still runs on surviving rows.

The builder defines a typed total expression language, summary semantics, null/error behavior, a constrained module ABI, and a solver-backed admission check. The essential obligation is:

`for every row x represented by summary s: keep(predicate(x, p)) implies may_match(s, p)`.

**I:** the checker must also establish that the actual summary builder covers every row in its block. Metadata and accepted modules are bound to the immutable block’s content and function semantics; changes invalidate them. Proofs cover the admitted expression semantics, and fixed lowering connects that semantics to native execution. Arbitrary opaque native UDFs are outside the claim. An unknown case always scans. Tests and measured pruning precision supplement the proof; sampled agreement never permits dropping rows.

**I — What is kept:** summary domains, function transfer rules, exact matching semantics, and composition lemmas. A new rule for an interval predicate or bounded string operation becomes usable in later query compositions. Models can grow richer multi-column summaries when per-column min/max is too weak, subject to a metadata/build-cost budget.

### Tailwind and the one-shot test

**I — Tailwind:** better models find more precise sound summaries and prove harder function combinations. The scan fallback stays correct while the admitted rule library expands. Better models improve coverage and pruning efficiency; they do not make reading irrelevant remote bytes free.

**I — One-shot test:** a model can propose a min/max index in one response. It cannot thereby establish the soundness of an entire extensible family of rules, the real summary builder, all supported numeric/null semantics, and the cross-rule compositions. Those are the builder’s fixed contracts and accumulated implementation obligations. However, a generic solver or existing index system might subsume the family quickly; that is an explicit kill risk, not an argument for adding a dashboard.

**I — Value proposition:** **make exact searches involving custom functions read less data, without silently omitting matches.**

### The six-week version

**E:** one Rust host/extension, integer/time/string domains, one solver bridge, and three admitted parameterized predicate families. Choose the families from public functions before measuring: interval overlap, a piecewise integer function, and a restricted pattern operation are starting candidates. Measure against generated-column/expression indexes and normal engine pushdown. No hosted database, learned semantic filter, or new search service is required.

**I/E — Demo:** a query initially scans every block because its custom predicate has no summary rule. A model proposes a rule; the solver finds a boundary/null counterexample; a corrected rule is admitted. The same query then skips blocks, produces identical exact results, survives reordered data, and runs offline. Show bytes fetched, summary size/build cost, and warm/cold latency. Target a 5× reduction in bytes fetched on held-out selective workloads and an end-to-end improvement after amortizing summary construction. A data layout with no useful block separation should visibly fall back to scanning.

### Prior art and precisely what is left

**F:** [Materialize’s 2025 account of filter pushdown](https://materialize.com/blog/how-filter-pushdown-works/) already describes abstract interpretation over block metadata, including the work of supplying abstract implementations of scalar functions. IBM’s [Extensible Data Skipping](https://research.ibm.com/publications/extensible-data-skipping) already supports custom metadata/indexes and UDF predicates. [Sparser](https://dawn.cs.stanford.edu/news/filter-you-parse-faster-analytics-raw-data-sparser) already compiles conservative raw filters. [SAIL’s PLDI 2026 artifact](https://github.com/uiuc-focal-lab/SAIL) already uses LLMs with SMT checks to synthesize sound abstract transformers, in neural-network verification. [MLSkip, revised 2026-09-23](https://arxiv.org/abs/2606.03946), applies verification techniques to pruning ML filters. GenDB and JetStream occupy generated acceleration more generally.

**I — Residual:** demand-triggered generation and admission of **reusable proved summary builders and transfer rules for ordinary custom data functions**, connected to actual block pruning. The individual mechanisms are established. SAIL plus existing data skipping is a serious route for another team to cover this residual, and Materialize/IBM already own adjacent production systems. The bounded search found no exact shipped combination; this ranks below the other two because the remaining differentiation is comparatively narrow.

### The kill

**I:** expression indexes or manually declared summaries may solve the same workload with little effort. Generated sound rules may also be so conservative that nothing useful is skipped, or require more metadata/build time than they save. Proof success without useful pruning is a failed result.

**I/E — Cheapest test, two days:** freeze ten public custom predicates and three data layouts, including adversarially mixed blocks. Compare ordinary pushdown, expression indexes, hand-declared summaries, and proposed synthesized rules. Continue only if at least three predicates gain useful precision beyond the simple baselines under a fixed metadata budget. Drop the project if its gains require hand-picking functions that were already easy to index, changing predicate meaning, or using model judgments to decide which rows to discard.

## Search record and limits

**F — Search performed on 2026-10-29:** live web searches covered GitHub, arXiv/primary papers, product documentation, Hacker News, and indexed X pages. Older foundations were checked alongside 2026 work rather than interpreted as abandoned merely because they are old. Sources were inspected as research/documentation; no competitor benchmark or artifact was executed.

**I — Representative reproducible queries:**

- DeltaForge: `LLM incremental view maintenance 2026`; `incrementalization LLM`; `incremental computation synthesis delta program compiler Cozy`; `site:docs.feldera.com aggregate Rust experimental`; `site:arxiv.org incremental LLM user-defined aggregate`; `site:github.com incrementalization LLM`; `site:news.ycombinator.com Cozy data structure`; `site:x.com incrementalization LLM`.
- ByteGarden: `zero-copy transformation compiler formats`; `site:github.com/cloudwego/dynamicgo Path Set protobuf`; `site:github.com/bytedance/sonic Set Get`; `site:github.com/project-everest/everparse parser serializer`; `AnyBlox self-describing data formats`; `site:news.ycombinator.com Sonic JSON DynamicGo`; `site:x.com binary rewriter LLM`; `site:x.com data format sparse synthesis`.
- ProofSkip and broad-pitch elimination: `LLM database operator synthesis query engine extensions autonomous GenDB`; `UDF index synthesis database`; `LLM data skipping indexes`; `data skipping abstract interpretation`; `SAIL Sound Abstract Interpreters github`; `site:news.ycombinator.com/item GenDB`; `site:x.com data skipping LLM`; `site:x.com SAIL abstract interpreters`.

**F/I — Search outcomes:** HN surfaced an existing [GenDB discussion](https://news.ycombinator.com/item?id=47243804) and an older [pointer to Cozy](https://news.ycombinator.com/item?id=18678803). These were discovery/collision signals; technical claims above rely on the authors’ papers, code, or documentation. The X-restricted searches returned no useful matching indexed implementation announcements. Several broad HN searches returned irrelevant name collisions. These are coverage limits, not evidence of absence. Private work, unindexed posts, or a newly released competitor could invalidate any residual.

## Ranking and one pick

**I — Rank 1: DeltaForge.** Largest useful capability frontier: a batch definition becoming a permanently available, checked dynamic algorithm. The explicit custom non-linear aggregation boundary supplies a concrete place to test the gap. Its main threats are existing SQL expressiveness, Cozy, JetStream, and proof engineering cost.

**I — Rank 2: ByteGarden.** Strongest direct practitioner pain and an immediately legible demo. The project is justified only if one shared mutation algebra carries growth across encodings; DynamicGo and EverParse make a collection of codec adapters insufficient.

**I — Rank 3: ProofSkip.** Strong local admission condition and measurable value. Adjacent production systems plus SAIL/MLSkip leave less unexplored ground; useful summary precision is a harder economic test than merely generating a sound rule.

**I — ONE pick: DeltaForge, subject to its two-day baseline test.** The human designs the collection/update semantics and admission structure; models grow the algorithms that run inside it. A stronger model increases the engine’s permanent repertoire. The initial standalone engine and public reference workloads establish the core value without customers, partnerships, or a community.

**Three-line TL;DR**

1. **I:** Grow reusable data-engine capabilities with frozen semantics; better generation should enlarge the artifact that already runs.
2. **F/I:** Generic generated databases, sync/lens systems, and decoder portability are occupied; the credible openings are narrower operator, mutation, and pruning machinery.
3. **I/E:** Pick DeltaForge; demonstrate a newly acquired deletion-correct incremental operator running after restart with model access disabled, and stop if existing engines make the gap disappear.
