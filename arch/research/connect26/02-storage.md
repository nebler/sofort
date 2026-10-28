# Storage for agents: what the talks leave open

Research date: 2026-10-28. Scope: talks 03, 05 and 13, read completely, including Q&A.

**I — Verdict:** the global filesystem, agent Git hosting, analytical infrastructure, generic semantic layer, AI review and health-based rollout are already occupied. The credible remaining scopes are small, executable checks around application-owned storage semantics. None is a validated standalone business. My conditional pick is a **mixed-version Durable Object migration rehearsal kit**.

## Evidence conventions and sources

- **Q** = transcript quotation or a speaker's claim, without independent validation. **F** = checked external source, linked beside the claim. **I** = interpretation, proposed scope or bounded search conclusion. **E** = estimate, including schedules and scores.
- All quote cells below are **Q**; all meaning cells are **I**, unless explicitly labelled otherwise. Speaker codes resolve to the roles below on every row. A signal ID begins with its talk number.
- Timestamps identify a caption's one-minute bucket, not an exact utterance time. Quotes retain caption wording; bracketed text marks a correction. Unclear personal/model names are not reconstructed. Benchmark numbers in the talks are speaker reports.
- **J:** Jackie, Relevance AI co-founder/co-CEO; Cloudflare customer, building Arg. **M:** Micah, Cloudflare principal engineer and Basin technical lead; identified as Micah Wylde by the [Basin announcement](https://blog.cloudflare.com/cloudflare-basin/) (**F**). **D:** Dillon Mulroy, Cloudflare employee, Artifacts engineer; his [author page](https://blog.cloudflare.com/author/dillon-mulroy/) identifies his role as Principal Systems Engineer (**F**). **A:** audience member; employer and customer status unstated.
- [T03: global filesystem transcript](/Users/noah/code/sofort/arch/research/connect26/transcripts/03-break-the-ceiling-of-internal-productivity-with-a-fast-globa.txt), [video](https://www.youtube.com/watch?v=xMg9VDCQVWM).
- [T05: Basin transcript](/Users/noah/code/sofort/arch/research/connect26/transcripts/05-turning-data-questions-into-data-infra-with-cloudflare-basin.txt), [video](https://www.youtube.com/watch?v=NlRTSleUkE0).
- [T13: Artifacts transcript](/Users/noah/code/sofort/arch/research/connect26/transcripts/13-artifacts-git-compatible-versioned-storage-from-zero-to-beta.txt), [video](https://www.youtube.com/watch?v=D_tnYlZe5t8).

**F — Background read:** [research summary §0, §11, §12](/Users/noah/code/sofort/arch/research/RESEARCH-SUMMARY.md) and [stack summary §1](/Users/noah/code/sofort/arch/research/stack/SUMMARY.md). **I:** generic Git storage, durable agent hosting, forkable runtimes, verification loops and agent-grown software are excluded as new pitches. The candidates below are narrow extensions to existing tooling, with explicit kill conditions.

## 1. Per-talk signal inventory

### Talk 03 — Relevance AI / Arg

| ID | Minute | Speaker | Kind | Short caption quote (Q) | Meaning (I) |
|---|---|---|---|---|---|
| 03-01 | 01:00 | J | Prediction | “agentic traffic is making up more and more percentage” | Agents become another major consumer of work infrastructure; the accompanying 60% website-traffic claim is not a verified universal statistic. |
| 03-02 | 01:00 | J | Pain | “we are drowning in tool sprawl, outdated SaaS” | Existing work is spread across products whose interfaces were designed around people. |
| 03-03 | 02:00 | J | Wish / hand-rolled | “What does the space for humans and agents to work at scale together look like?” | Relevance funded a five-person group to build this workspace. |
| 03-04 | 03:00 | J | Prediction / design | “it had to start with files” | Documents, apps and databases are treated as surfaces over shared file storage. |
| 03-05 | 04:00 | J | Constraint | “it had to be serverless” | Fast standalone deployment and enterprise access requirements shaped the architecture. |
| 03-06 | 04:00 | J | Pain | “Workers didn't really apply to me because uh, I was more of a Python developer” | Language familiarity initially hid the platform's usefulness from this customer. |
| 03-07 | 05:00 | J | Hand-rolled | “a mobile app, a desktop app, a CLI, an SDK” | The team built multiple clients in about three months; shared storage amortized their work. |
| 03-08 | 06:00 | J | Hand-rolled | “a file system for teams and agents at scale” | A simultaneous human/agent workspace is an existing customer product. |
| 03-09 | 06:00 | J | Hand-rolled | “rebuild as much of this with as much quality and taste as possible” | Relevance already pursued the unified Docs/Notion/Figma/Asana/Dropbox-like suite. |
| 03-10 | 07:00 | J | Hand-rolled | “internal apps that also make use of those same files” | App generation and workflow automation share the workspace's data rather than making copies. |
| 03-11 | 07:00 | J | Hand-rolled | “the same version attributed file system on every single surface” | Versioning and attribution live below individual applications. |
| 03-12 | 07:00 | J | Roadmap, customer | “plus way, way more as well that's on our road map” | More surfaces over this storage are already in Arg's plans; this is not a Cloudflare promise. |
| 03-13 | 07:00 | J | Pain / design | “every single surface on top got it for free” | Shared durability, access controls and audit behavior reduce repeated implementation. This does not mean those features arise automatically from R2. |
| 03-14 | 08:00 | J | Prediction | “agents could remember more” | A durable shared filesystem doubles as agent context and organizational memory. |
| 03-15 | 08:00 | J | Hand-rolled / discovery | “look at some of the formats of these files” | The team optimized representations as well as storage. |
| 03-16 | 08:00–09:00 | J | Pain | “you are spending about 21 um x more tokens” | Speaker compares Google Docs MCP representation with MDX; this is a workload-dependent serialization claim. |
| 03-17 | 09:00 | J | Cost | “about $1,200 uh of cost extra cost per year per agent” | Claimed inference overhead multiplies with agent count; usage and pricing assumptions matter. |
| 03-18 | 09:00 | J | Pain | “you're looking at at least nine um x” | Forms are another claimed format-overhead problem, beyond rich documents. |
| 03-19 | 09:00–10:00 | J | Hand-rolled | “our evals, uh where we see that the leaner formats also meant better results” | They tested small-model outcomes, not just byte counts; no reproducible quality benchmark is included in the captions. |
| 03-20 | 10:00–11:00 | J | Hand-rolled | “collaboration for free, version history for free” | The product implements collaboration, fine-grained sharing and comments on R2/DO foundations. |
| 03-21 | 11:00 | J | Pain | “latency issues with uh the standard S3FS” | Metadata access through a generic object-store mount slowed agent work. |
| 03-22 | 11:00 | J | Hand-rolled | “we actually built uh a custom mounting” | A customer paid to replace generic mounting; the accompanying claim is up to 130× faster `ls` lookups. |
| 03-23 | 11:00–12:00 | J | Customer demand | “Can you create me like a custom dashboard?” | Financial-services customers and the internal team want live applications over spreadsheet files. |
| 03-24 | 12:00–13:00 | J | Workaround | “persist the sandbox for as long as possible. Open up a tunnel” | The build environment became the deployed app by keeping it running. |
| 03-25 | 13:00 | J | Existing platform | “we can actually just white label um this whole deployment service” | Workers for Platforms already supplies an embedded deployment path. |
| 03-26 | 13:00–14:00 | J | Pain / benchmark | “the latency was quicker in regions outside of US as well” | Regional distance matters to agent interaction, beyond cold start. The Modal comparison is not independently reproduced. |
| 03-27 | 15:00 | J | Prediction | “designing the system uh that actually prompts the agent” | Work shifts from manual prompting to recurring autonomous loops. |
| 03-28 | 16:00 | J | Hand-rolled | “whenever there's a customer feedback that comes through about the product, it automatically comes up with PRs” | Feedback-to-PR and frontend-bug loops are already running internally. |
| 03-29 | 17:00–18:00 | J | Hand-rolled | “he just built a dashboard, a, um, essentially a factory” | A custom farm interface coordinates code, bugs and PR approvals; later rendered in 3D. |
| 03-30 | 18:00–19:00 | J | Prediction | “you can actually now create custom software” | Hyper-personalized work interfaces are his future-of-work thesis, not a missing storage primitive. |
| 03-31 | 19:00–20:00 | J | Hand-rolled | “automatically determines how the core loop prompt uh gets improved” | GTM content approvals feed back into prompts. |
| 03-32 | 20:00 | J | Hand-rolled | “I actually built an internal app that uh looks through all of those different files” | Even video retrieval becomes a custom surface over the shared namespace. |
| 03-33 | 21:00 | J | Demand | “over 10 enterprises uh starting to use it” | Customer-reported adoption supports the workspace demand, without independently proving retention or willingness to buy another tool. |
| 03-34 | 21:00–22:00 | J | Wish | “I do wish for Cloudflare Postgres” | He wants an operational PostgreSQL service inside the same vendor platform. Basin's analytical SQL is a different requirement. |

### Talk 05 — Cloudflare Basin

| ID | Minute | Speaker | Kind | Short caption quote (Q) | Meaning (I) |
|---|---|---|---|---|---|
| 05-01 | 01:00–02:00 | M | Pain | “we don't really have any visibility into that” | Existing traffic/order tables omit the checkout steps needed to explain a drop. |
| 05-02 | 02:00 | M | Pain / prediction | “you have to figure out what you think is going to be interesting in a year” | Instrumentation decisions precede the questions; useful information is often never recorded. |
| 05-03 | 02:00–03:00 | M | Pain | “by the time we get the answers, it's probably irrelevant” | Application tickets, instrumentation, ingestion and analysis are a slow handoff chain. |
| 05-04 | 03:00 | M | Pain | “this is going to take weeks at at any kind of organization” | The relevant latency is organizational as well as computational. |
| 05-05 | 04:00–05:00 | M | Existing demo | “I'm just going to ask my question directly of Claude” | Question-driven chart/query generation is already demonstrated. |
| 05-06 | 06:00 | M | Limit | “we're just fundamentally missing the data” | Reasoning and SQL cannot recover events that were not collected. |
| 05-07 | 07:00 | M | Existing demo | “ask it to instrument the checkout flow” | An agent can change application instrumentation and provision the ingestion path. |
| 05-08 | 08:00 | M | Existing platform | “a managed Iceberg catalog built on top of R2” | The storage/catalog foundation already exists. |
| 05-09 | 08:00–09:00 | M | Existing platform | “you can bring whatever tools you want to your data” | Open formats allow external query engines rather than a proprietary query-only surface. |
| 05-10 | 09:00 | M | Pain / shipped response | “the data gets disorganized, it gets ends up in small files” | Compaction is a real maintenance cost, already handled by Catalog. |
| 05-11 | 09:00 | M | Existing platform | “Basin Catalog does this all for you automatically” | A standalone compaction service would compete with the platform's existing capability. |
| 05-12 | 10:00 | M | Existing platform | “You can also send events via HTTP” | Workers bindings, HTTP and Logpush already cover multiple ingestion paths. |
| 05-13 | 10:00 | M | Existing platform | “transform it by writing a SQL query” | Pipeline transformation is provided, not an unfilled connector between raw events and tables. |
| 05-14 | 10:00–11:00 | M | Existing platform | “we can scan petabytes of data in literal seconds” | Speaker claims high parallel scan capacity; this is not a guaranteed latency for arbitrary joins or queries. |
| 05-15 | 11:00 | M | Existing platform | “There's no clusters to manage” | Capacity provisioning is removed from the agent's task. |
| 05-16 | 12:00 | M | Prediction / design | “fast, cheap, and uh non-destructive” | Try/check/retry loops need inexpensive disposable infrastructure. |
| 05-17 | 13:00 | M | Existing platform | “created, investigated, destroyed via an API and a CLI” | Resource lifecycle automation is already an intentional product feature. |
| 05-18 | 13:00–14:00 | M | Pain | “you really are bottlenecking how fast the agents can solve your problems” | Fixed cluster capacity limits parallel exploration. |
| 05-19 | 14:00 | M | Existing platform | “agents to just kind of like swarm the problem” | Basin is explicitly designed to absorb parallel query exploration. |
| 05-20 | 14:00–15:00 | M | Pain / shipped response | “They're just reading it from the cache” | Repeated related queries should reuse nearby data instead of rereading cold storage. |
| 05-21 | 15:00 | M | Status | “all of this went GA 3 weeks ago” | Catalog, Pipelines and SQL are existing products; do not pitch their integration as unbuilt. |
| 05-22 | 15:00–16:00 | M | Existing demo | “It uh created all of these resources” | Instrumentation and resource creation succeeded; deployment still requires his instruction in the demo. No subsequent historical explanation is shown. |
| 05-23 | 16:00 | A | Wish / pain | “two departments have three different answers” | An attendee asks who decides which revenue definition is authoritative. Company unstated. |
| 05-24 | 16:00–17:00 | M | Gap | “that is I would say the fundamentally hard problem” | Correct-looking analytics can be semantically wrong. |
| 05-25 | 17:00 | M | Workaround / design | “look at the code that's collecting the data” | Source-to-pipeline-to-field visibility helps an agent interpret the result. |
| 05-26 | 17:00 | M | Gap | “still like a fundamental challenge that everyone in the space is kind of trying to figure out” | No complete correctness solution is claimed. Human understanding of definitions still matters. |
| 05-27 | 18:00 | A / M | Limit / roadmap | “Not available yet, but coming in Q4” | Jurisdiction-restricted storage and compute are Cloudflare roadmap, not an outsider opening. The date is a speaker commitment, not verified delivery. |
| 05-28 | 18:00–19:00 | A / M | Wish / considered | “a basin for platforms kind of sort” | An attendee wants isolated per-customer instances. Micah acknowledges value and prior thought, without promising a product/date. |
| 05-29 | 19:00–20:00 | M | Limit / setup | “you'll need to instrument your application basically to send those events” | Basin does not observe arbitrary business events automatically; HTTP/bindings/Logpush are inputs, not omniscience. |
| 05-30 | 20:00 | M | Status | “log push is actually available to everyone now” | A former enterprise-only ingestion route has broadened; this is a product-status claim, not a gap. |
| 05-31 | 20:00 | A / M | Limit / roadmap | “Not today, but it's it's coming soon” | Access/custom departmental RBAC is requested; the response marks work as Cloudflare-owned, without specifying final policy granularity. |

### Talk 13 — Dillon Mulroy / Artifacts

| ID | Minute | Speaker | Kind | Short caption quote (Q) | Meaning (I) |
|---|---|---|---|---|---|
| 13-01 | 00:00–01:00 | D | Hand-rolled / demand | “large customer that had uh come to us with a need” | An actual multi-tenant customer's storage requirement triggered Artifacts. |
| 13-02 | 02:00 | D | Pain / demand | “some of these struggles from other Git providers” | Human-scale source-hosting assumptions were failing agent-scale usage; no named provider incident is specified. |
| 13-03 | 02:00 | D | Demand | “small repos that agents can operate over quickly” | Many task/user workspaces, rather than one large human repository, are the target. |
| 13-04 | 02:00 | D | Prediction | “less of a problem as agents become more capable” | Familiarity from Git's training-data presence is a weakening advantage; client interoperability is more durable. |
| 13-05 | 03:00 | D | Prediction / discovery | “It's good for just version storage in general” | The use case extends beyond source code to general versioned agent files. |
| 13-06 | 03:00 | D | Constraint | “a thousand repos per second” | A single tenant/namespace needed high creation throughput; he reports achieving the benchmark. |
| 13-07 | 03:00–04:00 | D | Hand-rolled | “That's how we landed on Zig and Wasm” | An engineer's holiday Git-engine prototype supplied a starting point under a three-week beta deadline. |
| 13-08 | 04:00 | D | Limit | “10 gigabytes of SQLite storage” | Per-object capacity limits the repo server's design; current product repo limits differ, checked below. |
| 13-09 | 04:00 | D | Limit | “128 megabytes of memory shared across the isolate” | Buffering and cross-boundary copies were constrained by the runtime budget described in the talk. |
| 13-10 | 05:00 | D | Pain / invariant | “unacceptable to corrupt a user's Git data” | Durability and atomic push publication are non-negotiable behavior, not model-judged quality. |
| 13-11 | 05:00 | D | Design constraint | “Stream everything, never buffer” | Keep memory bounded as repositories and pushes grow. |
| 13-12 | 05:00 | D | Design constraint | “do as little CPU work in a durable object as possible” | A single-threaded object cannot absorb arbitrary processing at high request rates. |
| 13-13 | 05:00 | D | Limit / design | “we can't put any one durable object in the hot path” | Shared control-plane serialization would defeat the required aggregate throughput. This is about a shared bottleneck, not avoiding all per-repo objects. |
| 13-14 | 05:00–06:00 | D | Hand-rolled | “The registry shards basically keep track of all the repos” | Repositories are indexed through a sharded registry rather than one account-wide writer. |
| 13-15 | 06:00 | D | Hand-rolled | “marks itself as dirty, alarms, batches” | Alarm-driven aggregation updates the namespace index outside the create path. |
| 13-16 | 06:00 | D | Hand-rolled | “every repo has uh a DO that has all the tokens” | Per-repo token managers and KV reverse indexes are already implemented. |
| 13-17 | 07:00 | D | Roadmap | “a clone API is coming” | Cloudflare plans a DO clone primitive to replace the R2-based forking path. Do not build a competing primitive from this hint. |
| 13-18 | 07:00 | D | Benchmark / constraint | “a theoretical throughput of 4,000 creates per second” | Internal sharding headroom is a theoretical estimate, distinct from a public API entitlement. |
| 13-19 | 07:00–08:00 | D | Limit / tradeoff | “the cost of that sharding those the registry shards is uh eventual consistency” | Create success does not imply immediate visibility in a list operation. |
| 13-20 | 08:00 | D | Hand-rolled | “it never touches the control plane” | Git data requests use token validation and the repo server without the shared registry lookup. |
| 13-21 | 08:00 | D | Hand-rolled / limit | “chunk it uh into 2 MB rows into SQLite” | Storage-row limits shaped the streaming implementation. |
| 13-22 | 09:00 | D | Limit | “artifact repos are constrained to like 10 gigs at max” | This is the speaker's stated limit, superseded for newly created repos by published docs. |
| 13-23 | 09:00 | D | Roadmap | “hopefully support Git LFS in the future” | LFS is Cloudflare intent, with no delivery date given. |
| 13-24 | 09:00 | D | Roadmap / exploration | “ideas for sharding the Git server itself” | Larger repositories, R2-backed lazy references and cache-fronted content are being explored internally. |
| 13-25 | 09:00 | D | Hand-rolled | “using deltas and chaining those together” | Clone memory optimization already exists inside the engine. |
| 13-26 | 10:00 | D | Roadmap | “the team hopes to open source it in the near future” | Git-engine publication and a technical blog post are intended; neither implies a maintainer-free engine opportunity. |
| 13-27 | 10:00 | D | Hand-rolled | “we write them to like a quarantine table” | Incoming chunks are staged, then atomically published; failed pushes leave the main tables intact. |
| 13-28 | 11:00–12:00 | D | Pain | “mem copy and data serialization across that boundary really killed us” | The Wasm/JS boundary, rather than language reputation, drove CPU and memory problems. |
| 13-29 | 12:00 | D | Pain / scale | “reliability issues, with memory issues” | The prototype stopped behaving well as multi-tenant adoption rose toward tens of millions of repos. |
| 13-30 | 12:00–13:00 | D | Hand-rolled | “used agents, and got the full thing rewritten” | A JavaScript rewrite already solved the engine's immediate boundary problem. |
| 13-31 | 13:00 | D | Hand-rolled / enabling condition | “our entire test suite, conformance test suites” | Existing Git correctness tests made an agent-driven rewrite tractable. The test oracle mattered. |
| 13-32 | 13:00 | D | Benchmark | “we dropped from 359 megs down to 40” | Speaker reports lower peak memory, roughly halved push/clone times and flatter growth; these are not independent measurements or per-isolate allocations. |
| 13-33 | 14:00 | D | Pain / mistake | “I forgot to lowercase the repo names” | Equivalent spellings could route to different objects; identity normalization became a persisted-state problem. |
| 13-34 | 14:00 | D | Pain | “I never had the time to do by hand” | He knew the migration design, but sequencing implementation was too costly amid other commitments. |
| 13-35 | 15:00 | D | Pain | “agents weren't able to do it” | Repeated agent attempts could not split the migration into compatible PRs; he later reports a newer model solved it. |
| 13-36 | 15:00 | D | Pain | “make sure that we didn't have like version skew” | Correct intermediate versions mattered as much as the final schema. |
| 13-37 | 15:00 | D | Hand-rolled | “add a unique index” | The fix combined ingress normalization, per-shard uniqueness and migration machinery. |
| 13-38 | 15:00–16:00 | D | Lasting cost | “check basically the the spelling that comes in and the lowercase version” | Old persisted identities require compatibility reads/fanout even after the repair. |
| 13-39 | 15:00 | D | Roadmap, retrospective | “get juris- just jurisdiction support rolled out” | Other platform delivery competed with repair work; Artifacts localization is now documented as shipped. |
| 13-40 | 16:00 | D | Prediction | “small AI native teams are the future” | Three engineers and extensive inference compressed delivery; staffing is not the missing primitive. |
| 13-41 | 16:00 | D | Wish / process | “build tooling and automation that lets you trust what they're doing” | Verification and short feedback cycles should replace repeated manual intervention. |
| 13-42 | 17:00 | D | Prediction | “writing code by hand is dead” | His thesis is that generation keeps improving; do not build a business solely around current model mistakes. |
| 13-43 | 17:00–18:00 | D | Pain | “we're still very much reading every line of code that the agent produces” | Review is becoming the team's bottleneck. |
| 13-44 | 18:00 | D | Workaround / pain | “I'll have my agent review my co-worker's PR” | Agent-to-agent review can reproduce the same expensive coordination loop. |
| 13-45 | 18:00 | D | Wish / question | “is it really worth spending all the compute to be re-running CI/CD” | He questions duplicated local/remote verification, rather than announcing a complete replacement. |
| 13-46 | 18:00 | D | Hand-rolled / being built | “our own basically health mediated deployment roll out” | His team is experimenting with an agent reading logs/traces and rolling back unhealthy cohorts. This area already has an internal owner. |
| 13-47 | 19:00 | D | Existing platform | “there's something there to solve most problems” | Previews, Queues and durable execution already provide the basic building blocks. |
| 13-48 | 19:00 | D | Replicability | “replicate the exact design I had here” | His argument is accessibility of existing primitives, not a proprietary runtime addition. |
| 13-49 | 20:00 | D | Uncertainty | “I don't know if they're using Artifacts in the core product” | He cannot establish Cloudflare OS's integration status. |
| 13-50 | 20:00 | D | Limit on opportunity | “you could just wire up a binding” | He explicitly rejects the premise that integration requires a substantial new layer. |
| 13-51 | 21:00 | D | Gap / wish | “how do we onboard new devs into this world” | Experienced production judgment remains useful; he gives no answer for training newcomers. |
| 13-52 | 21:00 | D | Prediction / wish | “using that inference to ensure higher bars of quality” | More generated software should raise monitoring, performance and UI-quality expectations. |
| 13-53 | 14:00 | D | Pain / earlier mistake | “I didn't understand the difference” | He also recalls an earlier NoSQL choice with lasting consequences. The alternative database name is garbled, so no specific comparison is inferred. |
| 13-54 | 11:00 | D | Prediction / process | “language doesn't matter. Rewriting does.” | He provocatively generalizes from a faster, more reliable rewrite; the anecdote does not establish a universal language-performance rule. |

## 2. Checked signals and classifications

**F — Search coverage:** checked GitHub repositories/issues, npm packages, product documentation, Cloudflare blog/changelogs and HN discussions on 2026-10-28. Indexed X searches included `site:x.com/dmulroy Artifacts`, `site:x.com Cloudflare Basin`, and the lowercase-migration terms; no useful accessible primary post surfaced. **I:** X coverage is incomplete. A missing search result never establishes that nobody is building something. “Open” below means only that the exact narrow deliverable was not found in this bounded search; the surrounding mechanisms usually ship already.

### Corrections that change the interpretation

1. **F — Repo limits:** current [Artifacts limits](https://developers.cloudflare.com/artifacts/platform/limits/) specify **1 GB** for repos created on/after 2026-09-29; earlier repos retain **10 GB**. They list **2,000 control-plane requests per 10 seconds per namespace**, and the same window per artifact for Git requests. **I:** Dillon's 1,000 creates/sec and theoretical 4,000/sec describe an internal benchmark/design, not the published service contract. The captions do not explain the difference.
2. **F — DO limits:** the [DO limits page](https://developers.cloudflare.com/durable-objects/platform/limits/) confirms 10 GB per SQLite-backed object, 2 MB row/value constraints and a soft 1,000 requests/sec limit. **I:** the DO capacity ceiling and the Artifacts product quota are separate limits.
3. **F — Format ratios:** [Arg's benchmark](https://arg.ai/benchmark) reports 647 versus 13,464 tokens for one rich-document specimen, with `o200k_base`; its own caveats distinguish serialization size, expressive capability and quality. **I:** the talk's 21× is supported as that specimen's ratio, not a universal quality/cost multiplier. The $1,200 yearly extrapolation and 130× mount figure remain **Q**, not independently validated here.
4. **F — Markdown collaboration:** Google's [2026-10-05 announcement](https://workspaceupdates.googleblog.com/2026/10/preview-edit-and-collaborate-on-Markdown-files-natively-across-Drive-and-Docs.html) introduced native Markdown viewing, editing, collaboration and comments without conversion into a Doc, with a rollout scheduled over up to 15 days. **I:** “make Google Docs usable with agent-friendly text” is already occupied too.
5. **Q / F — Compression ambiguity:** T13 08:00–09:00 says “ZSTD” and calls it Git's main compression algorithm. [Git's pack-format reference](https://git-scm.com/docs/gitformat-pack) discusses zlib-compressed objects. **I:** do not turn uncertain captions or a possible internal storage codec into a claim about Git's wire format. No codec-dependent candidate relies on it.
6. **Q — Unknowns retained:** the 359 MB benchmark's measurement scope is unstated; the captions cannot establish how it relates to the quoted 128 MB isolate budget. Cloudflare OS integration and Giddy's current publication status are also not established. Neither ambiguity is evidence of an open product gap.

### Storage, representation and application surfaces

| Signals | Classification | Checked owner / evidence and disposition |
|---|---|---|
| 03-02–14, 03-20, 03-33; 13-03–05 | **Shipped** | **F:** [Arg](https://arg.ai/) offers the human/agent workspace; [Cloudflare Computer's filesystem](https://developers.cloudflare.com/agents/tools/filesystem/) persists files in DO SQLite; [Turso AgentFS](https://github.com/tursodatabase/agentfs) provides a filesystem, state and tool-call history. **I:** another generic persistent agent filesystem would repeat killed territory. |
| 03-15–19 | **Shipped** | **F:** [Arg's format study](https://arg.ai/research/file-benchmark-document-formats-part-1-token-efficiency) already measures document representations. Native Markdown collaboration is also announced by Google above. **I:** smaller serialization is useful but neither a new discovery nor a durable proprietary engine opportunity. |
| 03-16–20; proposed lossless Markdown bridge | **Being built** | **F:** [md-gdoc](https://github.com/MattFisher/md-gdoc) is alpha with comment-preserving sync and live API tests; it documents gaps around images, footnotes, suggestions and changed anchors. [gdoc-sync](https://github.com/MattHandzel/gdoc-sync) implements another round trip and describes API/fidelity limitations. **I:** a generic converter/sync tool is taken; unsupported document semantics would need a specific adopter and corpus. No separate candidate is promoted here. |
| 03-21–22, 03-26 | **Shipped** | **F:** [ArtifactFS](https://github.com/cloudflare/artifact-fs) lazily mounts Git repositories; [R2 FUSE in Containers](https://developers.cloudflare.com/containers/examples/r2-fuse-mount/) and [Daytona external mounts](https://www.daytona.io/docs/en/mount-external-storage/) already support remote storage access. **I:** mounting itself is occupied. The unresolved narrow scope is workload-specific compatibility evidence, C3. |
| 03-21–22; 13-28–32 | **Open**, narrow scope C3 | **F:** [ArtifactFS's README](https://github.com/cloudflare/artifact-fs/blob/main/README.md) documents slow large-tree status/reset operations and missing checkout filters/EOL transforms for snapshot-only reads. [Tigris fs-correctness](https://github.com/tigrisdata/fs-correctness) already supplies differential filesystem testing. **I:** add lazy-Git working-tree transition probes to that ecosystem; do not pitch a new filesystem or generic POSIX checker. |
| 03-23–25 | **Shipped** | **Q:** Arg already builds apps over customer CSVs, persists sandbox apps and uses Workers for Platforms. **F:** [Daytona's mount documentation](https://www.daytona.io/docs/en/mount-external-storage/) also covers persistent/shared sandbox data. **I:** “spreadsheet to internal app with storage” is an existing product pattern. |
| 03-27–32 | **Shipped** | **Q:** the talk shows bug/feedback loops, review dashboards, content loops and file-search apps. **F:** Cloudflare's [Git-platform invitation](https://blog.cloudflare.com/next-git-platform-on-cloudflare/) explicitly solicits coordination/review applications above Artifacts. **I:** an invitation is a distribution opportunity, not evidence that no competing workflow tools exist. |
| 03-34 | **Shipped**, adjacent supply; exact wish unresolved | **F:** [Cloudflare's Neon integration docs](https://developers.cloudflare.com/workers/databases/third-party-integrations/neon/) provide managed serverless Postgres through Neon/Hyperdrive. **I:** this does not satisfy the exact wish for Cloudflare-operated Postgres, but the useful database capability is served. No examined source establishes a Cloudflare managed-Postgres roadmap; do not invent one or re-pitch a Wasm port. |

### Basin: occupied infrastructure versus missing knowledge

| Signals | Classification | Checked owner / evidence and disposition |
|---|---|---|
| 05-01–07, 05-16–22, 05-29 | **Shipped** | **F:** the [Basin overview](https://developers.cloudflare.com/basin/) and [getting-started guide](https://developers.cloudflare.com/basin-sql/get-started/) cover event ingestion, catalog creation and querying. **Q:** the talk demonstrates an agent doing the setup. **I:** a prompt-to-pipeline wrapper is insufficient differentiation; new instrumentation cannot retrospectively collect a missing week. |
| 05-08–15, 05-18–21 | **Shipped** | **F:** the [Basin Pipelines changelog](https://developers.cloudflare.com/changelog/product/basin-pipelines/) records GA, typed stream bindings and visibility into dropped events. **I:** ingest/store/query, small-file maintenance, parallel exploration and schema-error dashboards already have platform owners. |
| 05-23–26 | **Shipped**, broad metric/lineage layer | **F:** [dbt MetricFlow](https://docs.getdbt.com/docs/build/about-metricflow) defines shared metrics and generates queries; [OpenLineage's specification](https://github.com/OpenLineage/OpenLineage/blob/main/spec/OpenLineage.md) includes source location/version, SQL, dataset versions and column lineage. **I:** neither common definitions nor code lineage is unclaimed territory. |
| 05-23–26; proposed Basin semantic/RBAC gateway | **Shipped** | **F:** [Icelight](https://github.com/cliftonc/icelight) is an MIT-licensed deployable example combining Analytics.js, Basin, Iceberg, Drizzle-Cube and MCP; its [project demo](https://try.icelight.dev/) describes shared metric definitions and row-level security in the semantic API. **I:** a Basin-specific semantic layer alone is already supplied. Application-layer filtering is distinct from native Basin authorization. |
| 05-01–02, 05-06, 05-25, 05-29 | **Open**, narrow scope C2 | **F:** [Snowplow Micro](https://docs.snowplow.io/docs/testing/) already tests tracking/schema/enrichment behavior, including [automated expected-event checks](https://docs.snowplow.io/docs/testing/snowplow-micro/automated-testing/). **I:** the unlocated exact deliverable is a Basin answer bundle joining deployed source revision, event arrival, transformation, table snapshot and observation start date. This is an integration gap, not a universal verifier. |
| 05-27 | **Cloudflare roadmap** | **Q:** Q4 jurisdiction support. **F:** the [Basin announcement](https://blog.cloudflare.com/cloudflare-basin/) lists jurisdiction controls as future work. **I:** treat this as owned until a later changelog verifies shipment; no candidate. |
| 05-28 | **Open**, exact request unconfirmed; adjacent **Cloudflare roadmap** | **Q:** Micah says the team has thought about per-platform isolation, without a delivery commitment. **F:** the Basin announcement plans more granular namespace/table authorization. **I:** that related roadmap does not prove a full “Basin for Platforms” product. Nevertheless, customer isolation on one vendor's service has high platform-ownership risk; no candidate. |
| 05-31 | **Cloudflare roadmap** | **Q:** Access/custom RBAC is “coming soon.” **F:** finer-grained authorization is also listed in the Basin announcement. **I:** row/column/department policy semantics and delivery dates are unspecified; do not claim every requested permission model is promised. |
| 05-30 | **Shipped** | **Q:** broader Logpush availability is stated in the talk. **F:** the Pipelines changelog documents its Logpush integration. **I:** integration is verified; the precise entitlement of every Logpush dataset was not audited. |

### Dillon's missing, hard and next

| Signals | Classification | Checked owner / evidence and disposition |
|---|---|---|
| 13-01–06, 13-10, 13-20, 13-27 | **Shipped** | **F:** [Artifacts](https://developers.cloudflare.com/artifacts/) provides programmable Git-compatible versioned storage. The [Artifacts changelog](https://developers.cloudflare.com/changelog/product/artifacts/) records bindings, event subscriptions, Builds/Previews and localization. **I:** do not rebuild agent Git hosting, atomic push staging or repository-token management. |
| 13-08–19, 13-21 | **Shipped**, hand-rolled architecture | **Q:** the registry, dirty-shard alarms and token objects run in Artifacts. **F:** [durable-utils](https://github.com/lambrospetrou/durable-utils) also provides sharding and SQL migration utilities; [durability on npm](https://www.npmjs.com/package/durability) supplies operation/alarm/outbox/topology capabilities. **I:** sharding helpers and reliable background propagation are not empty categories. |
| 13-17 | **Cloudflare roadmap** | **Q:** DO clone API and replacement for R2-backed fork implementation. **I:** a public shipping date was not verified; this remains an explicit ownership signal even without one. |
| 13-22–25 | **Cloudflare roadmap** | **Q:** LFS, larger-repo strategies, lazy R2 references and server sharding are internal plans/explorations. **F:** the current limits still constrain new repositories to 1 GB. **I:** a size-limit workaround would be exposed to the platform roadmap, while an LFS implementation alone would repeat existing Git infrastructure. |
| 13-07, 13-26, 13-28–32, 13-54 | **Shipped** rewrite; **Cloudflare roadmap** publication | **Q:** the JS engine and conformance-driven rewrite are complete; engine publication and a deep dive are intended. **I:** Git compatibility tests already enabled the work. Giddy and ArtifactFS are different components; the public ArtifactFS repository does not establish that Giddy is open source. |
| 13-33–38 | **Shipped** fix; **Open** reusable rehearsal scope C1 | **Q:** the casing migration was ultimately solved by a newer model, leaving compatibility reads. **F:** [DO gradual-deployment docs](https://developers.cloudflare.com/workers/versions-and-deployments/gradual-deployments/with-durable-objects/) require compatible caller/callee versions. [Drizzle](https://orm.drizzle.team/docs/get-started/do-new), [durable-utils on npm](https://www.npmjs.com/package/durable-utils) and [@durability/storage](https://www.npmjs.com/package/@durability/storage) already handle schema migration. **I:** the plausible residual is testing intermediate rollout states against application invariants; migration generation itself is taken and improving models already removed Dillon's coding blockage. |
| 13-39 | **Shipped** | **F:** the Artifacts changelog dates US/EU localization support to 2026-08-13. **I:** Dillon's jurisdiction push is retrospective, not an unclaimed next project. |
| 13-40–44 | **Shipped**, broad review automation | **F:** [CodeRabbit](https://docs.coderabbit.ai/) documents PR review, custom checks and automatic approvals. **I:** another agent reviewing an agent's PR is exactly the crowded answer he already describes. His review bottleneck is real, but no independent new category follows. |
| 13-45 | **Shipped**, material prior art | **F:** [Bastion](https://bastion.attune.inc/guide/local-workflow/) reuses eligible outcomes and can replay signed local review outcomes in CI; its [attestation design](https://github.com/attunehq/bastion/blob/main/docs/developer-guide/attestation.md) binds replay to source/context and falls back on mismatch. [GitHub attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations) provide build provenance, not proof that tests or behavior are correct. **I:** avoid a generic “skip CI because the agent says it passed” product. Environment/data-dependent checks still require explicit invalidation rules. |
| 13-46 | **Being built** by Dillon's team; **Shipped** adjacent | **Q:** Cloudflare's Artifacts team is experimenting with agent-directed cohort rollback. **F:** [Argo Rollouts](https://argo-rollouts.readthedocs.io/en/stable/architecture/) and [Flagger](https://docs.flagger.app/usage/deployment-strategies) already automate metric-based promotion/rollback. **I:** adding an LLM to canary rollout is not an open project claim. |
| 13-47–50 | **Shipped** primitives; integration need unproven | **F:** Artifacts' documented Worker interface already makes programmable repository access possible. **Q:** Dillon says he does not know the OS usage and that a binding would suffice. **I:** no evidence supports building a special Artifacts-to-OS layer. |
| 13-51–52 | **Open**, underspecified human/process problem | **Q:** he has no answer for onboarding inexperienced engineers and wants higher quality bars. **I:** no storage-specific buyer, workflow or inexpensive independent acceptance check follows from this remark alone. Retain the signal; do not manufacture a storage project from it. |
| 13-53 | **Shipped**, broad database choices | **Q:** this is a retrospective mistake, without a specific current request. **I:** an unspecified poor NoSQL selection does not establish a missing storage product. |

**F — External demand check:** a separate customer engineering report, [Context Mode's Slipstream lessons](https://contextmode.ai/blog/durable-objects-in-production), describes rehearsing a six-class transfer over 343,332 rows and observing roughly five minutes of old code before the switch. This is the author's reported measurement, not independently rerun here. A [Cloudflare docs issue #32982](https://github.com/cloudflare/cloudflare-docs/issues/32982) records confusion around migration/version-upload restrictions. **I:** these corroborate deployment-state friction beyond Dillon, without proving demand for a commercial migration service.

**F — HN check:** the [SQLite-in-DO discussion](https://news.ycombinator.com/item?id=41832547) includes practitioners asking how to migrate many tenant databases; it is qualitative problem evidence, not current product documentation. The [Artifacts platform discussion](https://news.ycombinator.com/item?id=49947051) also raises agent-workspace and coordination concerns. **I:** anonymous enthusiasm or objections are not purchase commitments.

## 3. Convergence and what it actually supports

| Independent signals | Shared issue | Assessment |
|---|---|---|
| **Q:** 03 07:00–11:00; 13 02:00–10:00 | Versioned shared files support agent work, while metadata and memory become bottlenecks. | **F / I:** Arg, Computer, AgentFS and Artifacts already supply the storage category. Convergence confirms demand, not white space. |
| **Q:** 03 11:00, 13:00–14:00; 05 12:00–15:00; 13 05:00, 12:00 | Agent loops amplify latency, repeated I/O and finite runtime resources. | **I:** mechanisms remain relevant as models improve, but mounts, caches, streaming and fanout already have owners. Test a specific boundary rather than build another engine. |
| **Q:** 03 09:00–10:00; 05 16:00–17:00; 13 13:00, 16:00–18:00 | Fast generation needs independent evidence that results mean the intended thing. | **I:** this supports narrow executable checks. Token savings, SQL validity and model review are each insufficient evidence of semantic correctness. |
| **Q:** 03 10:00–11:00; 13 14:00–16:00 | Shared mutable state outlives one agent turn and one code version. | **I:** migration compatibility is a concrete consequence. Only Dillon names a migration incident; cross-talk migration demand itself should not be overstated. |
| **Q:** 05 17:00; 13 18:00, 21:00 | Human understanding moves toward definitions, operational quality and rollout decisions. | **I:** better code generation does not choose whose revenue definition is authoritative, recover unrecorded events or establish how old persisted identities should behave. |

## 4. Three conditional candidates

**I — Scope of “Open”:** these are specific deliverables above shipped foundations, not claims to an untouched category. Each is more credible as an upstream package/contribution than a venture. None should receive a multi-week commitment before its kill test.

### C1. Mixed-version Durable Object migration rehearsal kit

**Q — Source:** T13 15:00, “make sure that we didn't have like version skew”; 14:00, “I never had the time to do by hand”; 15:00–16:00, “the spelling that comes in and the lowercase version.” The implementation blockage was later solved, not left open.

**I — One sentence:** a TypeScript test adapter runs an application's old and new Worker/DO code against seeded legacy states and selected rollout orderings, then reports a minimal sequence that breaks a declared identity or data invariant.

**I — 30-second demo:** create `RepoA`, retain its original storage identity, and deploy a lowercase-name migration. The all-new-code test passes. The rehearsal then routes a new caller to an old registry shard, delays the index update, and shows either a duplicate creation or a lost lookup. Add a compatible normalization/read protocol; the same sequence passes. The demo uses a reconstruction of Dillon's described failure class, not private Artifacts code.

**F — Closest prior art:** Cloudflare's [integration test harness](https://developers.cloudflare.com/workers/testing/test-harness/) already runs multiple production-built Workers, and [storage preparation](https://developers.cloudflare.com/workers/testing/test-harness/prepare-test-state/) can seed DO SQL state. [Drizzle's migrator](https://orm.drizzle.team/docs/get-started/do-new) applies schema changes; [durability's storage package](https://www.npmjs.com/package/@durability/storage) supplies reversible migration types. [Jepsen](https://github.com/jepsen-io/jepsen) supplies general distributed-system fault-testing methods. **I:** the residual is a small adapter/corpus for old/new application versions, seeded persisted identities, interrupted migration steps and compatibility reads. None of the inspected documentation establishes that this exact reusable matrix is provided out of the box.

**I — Beneficiaries and demand:** teams with many tenant DOs, sharded registries and user-owned persisted names. **F:** the Slipstream report and issue #32982 above independently describe rollout/rehearsal constraints. **I:** customer-authored examples remain hand-built, so a reusable adapter may save work; no willingness-to-pay evidence was found.

**I — Why Cloudflare might adopt it:** actual identity and preservation rules belong to each application, so an external public fixture corpus can help customers and feed the existing test harness. Cloudflare can also implement this adapter itself; platform ownership risk is substantial. Prefer a contribution and design partners over a competing deployment product.

**E — 2–3-week v0:** week 1: two immutable application builds, seeded SQL fixtures, old/new caller/callee matrix and stable instance identities; week 2: application-level delay/failure hooks, interrupted-step restart, invariant callbacks and trace minimization; optional week 3: one independent customer fixture and hosted-runtime comparison. **I:** start with logical SQL exports/customer fixtures, not an unshipped clone API. A local harness cannot emulate Cloudflare's global control plane or establish production rollout timing. Keep class-lifecycle changes distinct from application SQL migrations.

**I — Acceptance check:** declared uniqueness/preservation rules, lookup results and row/content hashes are evaluated outside the authoring model. One DO instance runs one code version at a time; exercise different versions across objects/callers and sequential upgrades of the same persisted state. A down migration's success alone does not prove old behavior remains valid.

**E — 1–2-day kill test:** use the existing harness to reproduce the case-normalization failure in a small four-shard app, plus one independent old/new RPC mismatch. Ask two DO maintainers to try their current migration test on these fixtures. **I — Kill if:** existing helpers already cover the matrix with trivial setup; stable storage cannot be carried across builds without changing the behavior under test; or neither maintainer contributes a real compatibility fixture. If newer models make the whole adapter disposable per migration, publish the examples upstream and stop treating it as a product.

### C2. Event-to-metric evidence bundle for Basin

**Q — Source:** T05 06:00, “we're just fundamentally missing the data”; 17:00, “look at the code that's collecting the data”; 16:00 audience, “two departments have three different answers.”

**I — One sentence:** an application-owned evidence file links a metric's definition to the deployed event producer, pipeline transform, observed arrival and retained table snapshot, while explicitly stating which historical periods were never observed.

**I — 30-second demo:** ask why checkout conversion fell last week. The report says that a required checkout event only began arriving today, so that explanation is unsupported for last week. Run a synthetic checkout with a trace ID, watch it reach the table, and see the expected metric contribution. Deliberately drop the event in the pipeline: the check pinpoints the missing boundary. Human owners choose between competing revenue definitions; the tool does not silently decide for them.

**F — Closest prior art:** [OpenLineage](https://github.com/OpenLineage/OpenLineage/blob/main/spec/OpenLineage.md) already models source versions, transformations and dataset snapshots; [MetricFlow](https://docs.getdbt.com/docs/build/about-metricflow) owns metric definitions; [Snowplow Micro](https://docs.snowplow.io/docs/testing/snowplow-micro/automated-testing/) owns expected-event tracking tests; [Icelight](https://github.com/cliftonc/icelight) supplies a Basin analytics/semantic stack. **I:** the possible addition is a lightweight producer-to-answer receipt with observation intervals, not another semantic layer, data catalog or generic data-quality platform. A prototype should emit existing lineage facets where possible.

**I — Beneficiaries and evidence:** small teams letting agents add instrumentation and analyze results without dedicated data engineers. **F:** Snowplow's documented tracking tests and Icelight's implementation establish independent investment in neighboring workflows. **I:** no outside customer demand for this exact bundle was found; its commercial case is weaker than the problem statement.

**I — Why Cloudflare might adopt it:** source repositories, metric owners and business definitions cross platform boundaries. An open adapter helps Basin users supply that knowledge, although Cloudflare is well placed to build its own arrival/lineage tools. Do not compete with its announced authorization or ingestion roadmap.

**E — 2–3-week v0:** one TypeScript Worker application; one pipeline transform; one metric; synthetic event IDs; deployed revision and schema/SQL hashes; bounded polling to verify arrival; an observation-start ledger; JSON/Markdown output. Add Iceberg snapshot IDs only through a verified supported interface and report their absence explicitly. Begin without an LLM or automatic code instrumentation.

**I — Acceptance check:** a known event must produce a known contribution after the real transform, and unavailable coverage must remain unavailable. This verifies the chosen example and declared definition, not all production events or causal explanations. New instrumentation does not backfill unrecorded history.

**E — 1–2-day kill test:** implement the receipt as an Icelight extension, then seed missing events, a renamed field, duplicate delivery and a changed metric definition. **I — Kill if:** OpenLineage plus existing tracking tests already yields the same answer with a thin configuration; historical coverage cannot be established from retained deployment/arrival evidence; or a user only needs the existing semantic API. That outcome warrants an integration example, not a new product.

### C3. Working-tree fidelity probes for lazy agent mounts

**Q — Source:** T03 11:00, “latency issues with uh the standard S3FS” and “we actually built uh a custom mounting”; T13 13:00, “conformance test suites.” **I:** a faster mount must still preserve the behavior its clients rely on.

**I — One sentence:** a small reusable corpus compares native Git checkout and lazy mounted working trees through read/edit/commit/reset transitions, recording byte, mode, status and latency differences against each adapter's declared capabilities.

**I — 30-second demo:** use a fixture with EOL attributes, an executable, a symlink and an unhydrated file. Show native and lazy trees side by side, perform an edit/reset, and report the exact bytes/status that diverge. Unsupported checkout filters appear as a documented unsupported capability; an unexpected regression gets a minimized reproduction. Include mount/hydration time in the end-to-end timing.

**F — Closest prior art:** [ArtifactFS](https://github.com/cloudflare/artifact-fs/blob/main/README.md) already has FUSE/Git E2E coverage and declared limitations. Its historical [issue #16](https://github.com/cloudflare/artifact-fs/issues/16) shows how metadata could produce thousands of modified paths with empty diffs; it is closed, so this is historical pain evidence, not an outstanding defect. [Tigris fs-correctness](https://github.com/tigrisdata/fs-correctness) already compares mounted filesystems with a native baseline and includes Git workloads; [pjdfstest](https://github.com/pjd/pjdfstest) supplies filesystem semantics tests. **I:** only lazy-Git transition coverage absent from those suites qualifies as the remaining scope. General differential filesystem testing is already taken.

**I — Beneficiaries and evidence:** sandbox providers and teams choosing a remote agent workspace. **F:** [Cloudflare's R2 mount guide](https://developers.cloudflare.com/containers/examples/r2-fuse-mount/) and [AWS Mountpoint documentation](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mountpoint-usage.html) explicitly distinguish their mount behavior from full POSIX semantics. **I:** a capability-aware result is more useful than marking every deliberate limitation as a failure. No evidence establishes that providers will pay for this separately.

**I — Why Cloudflare might adopt it:** results compare an application-visible contract across native Git and multiple vendors; they can improve upstream mount tests. Cloudflare already maintains much of the relevant machinery, making adoption as a test contribution more plausible than an independent service.

**E — 2–3-week v0:** a Node/TypeScript coordinator over native Git, ArtifactFS and one other usable mounted backend; approximately 20 deterministic fixtures; cold/warm timing; expected unsupported features; final object/tree verification; reproducible reports. Scope Linux initially. Reuse filesystem probes rather than writing an engine or a full conformance suite.

**I — Acceptance check:** native Git's resulting objects and explicit per-adapter contracts are the oracle, with a separately generated expected content manifest. Do not assume an object-store mount promises Git-working-tree fidelity or that byte identity applies where declared checkout conversions differ.

**E — 1–2-day kill test:** port five lazy-tree transitions to Tigris/ArtifactFS's existing suites. **I — Kill if:** they already exercise every transition; the only differences are documented unsupported behavior; or no currently reproducible, maintainer-useful gap remains after the historical fixes. Then send the fixtures upstream and stop. A benchmark-only dashboard is not sufficient justification.

### Scores

**E — Scores, 1–5; higher is better.** “Gap” applies only to the narrow deliverable, and remains discounted for incomplete absence evidence. “Survives models” concerns persisted state, missing observations and storage contracts, not a forecast of model weakness.

| Candidate | Cool | CF/Vercel/TS adjacent | Real gap | Value | Survives better models | Not GrowOS | Total / 30 |
|---|---:|---:|---:|---:|---:|---:|---:|
| C1: mixed-version DO migration rehearsal | 3 | 5 | 3 | 4 | 4 | 5 | 24 |
| C2: Basin event-to-metric evidence | 3 | 5 | 2 | 4 | 5 | 5 | 24 |
| C3: lazy-mount working-tree probes | 3 | 4 | 2 | 3 | 4 | 5 | 21 |

**I — Why no high-gap winner:** C1 builds on an existing harness and a previously identified research boundary; C2 overlaps lineage/semantic/tracking tools; C3 overlaps mature filesystem and Git suites. No candidate earns a 4–5 on novelty from these checks. None adds a kernel, agent runtime or self-extending OS, so all remain separate from GrowOS.

## 5. ONE pick

**I — C1: mixed-version Durable Object migration rehearsal kit, conditional on the two-day kill test.** Dillon describes a concrete cost: the right end-state design was known, yet intermediate deployment states and legacy identities made the change hard. A newer model solved his implementation, so the durable opportunity is reusable evidence about the migration's behavior, not writing its code. Independent DO users report their own rehearsals and deployment surprises. That gives C1 a clearer falsifiable entry point than a generic filesystem, agent review product or analytical “truth” layer.

**I — Decision rule:** proceed only if the small harness exposes an incompatibility ordinary migration tests miss and another maintainer supplies a genuine fixture. Prefer an upstream adapter and public regression corpus. If the result is a short disposable test that an agent readily writes from the existing harness, accept that result and stop; the talks do not justify forcing a larger project.

## 6. Five-line TL;DR

1. **Q / F:** Agent filesystems, Git storage and the Basin data stack already ship; the talks establish demand rather than an empty storage category.
2. **F:** New Artifacts repos are limited to 1 GB, and published rate limits differ from the talk's internal throughput benchmarks.
3. **Q:** Dillon exposes migration/version-skew costs, review bottlenecks, duplicated CI and rollout work; several areas already have active owners.
4. **I:** Three narrow conditional scopes survive: DO migration rehearsals, Basin event-to-metric evidence and lazy-mount working-tree probes.
5. **I:** Pick the DO rehearsal kit only after a two-day test finds a real compatibility failure and an independent maintainer contributes a fixture.
