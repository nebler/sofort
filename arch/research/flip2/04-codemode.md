# Code Mode turns agents into programs: which compiler/PL ideas pay off on agent-written code

Research date: **2026-10-28**. Lens: in Code Mode the model writes one TypeScript/Python program that calls tools, instead
of one tool call per model turn. That makes the agent's behaviour a program, so static analysis, type systems, information
flow, query optimisation and debugging theory can be applied to it. This report asks which of those old ideas work on
agent-written programs and which are worth money.

**Labels:** **F** = sourced fact (link + date), including repository evidence from this repo; **M** = measured here (none
this round, see §Experiments); **I** = inference/judgement; **E** = estimate, scenario or proposed threshold.

**Scope.** `moonshots2/02-compilers.md` already covers the agent tracing JIT, model-free capsules, superoptimisation of
tool workflows (batching, fusion, projection pushdown), Halide-style schedules, incremental agents, static cost budgets,
supercompilation and an agent MLIR. Those are referenced and not re-argued. `flip/04-broad.md` §11 sent IFC/CaMeL here
("Lens B"). `flip/06-giants.md` #3 (conserved capabilities over Cap'n Web) is adjacent and not repeated.

---

## The finding in one paragraph

**I —** Code Mode changes two things that matter to PL theory. (1) The **unit of authority and analysis becomes one
program**, not one session and not one call, so least privilege and pre-approval can be decided per program. (2) The
**channel from data back to the model becomes explicit**: tool results stay in the sandbox, and only what the program
returns or logs enters the model's context. Anthropic's docs state it directly: "Tool results from programmatic calls are
not added to Claude's context — only the final code output is"
([programmatic tool calling docs, GA, accessed 2026-10-28](https://platform.claude.com/docs/en/agents-and-tools/tool-use/programmatic-tool-calling)).
So "what did the model see?" becomes a labelled, checkable value instead of a whole transcript. That is the property that
information-flow control (Denning 1976) always needed and never had in ReAct agents. The **security** ideas (effects, IFC,
capabilities, contracts) get more valuable as models improve, because attackers improve too and the enforcement does not
depend on the model. The **performance** ideas (batching, pushdown, speculation, staging) are mostly already inside Code
Mode itself, in LLMCompiler and Cap'n Web, or covered by moonshots2. Better models write `Promise.all` and filtered API
calls on their own, so those passes lose value as models improve. Research has already occupied the security direction
thoroughly (CaMeL, FIDES, LBAC, ACE, CaMeLoT, Progent). The gap is **shipping it inside a real Code Mode executor whose
interpreter is hostile**, and Sofort's executor is already halfway there.

---

## Prior art that frames everything below

| Work | What it does | What it means for this lens |
|---|---|---|
| **CodeAct**, Wang et al., [arXiv 2402.01030, Feb 2024; ICML 2024](https://arxiv.org/abs/2402.01030) | Python as the agent's action space. Up to 20% absolute success gain and up to 30% fewer actions on M3ToolEval **F**. | Code-as-action predates "Code Mode". smolagents' CodeAgent is the open implementation ([repo](https://github.com/huggingface/smolagents)) **F**. |
| **Cloudflare Code Mode**, Varda & Pai, [2025-09-26](https://blog.cloudflare.com/code-mode/) | MCP tools become a TS API. Code runs in a fresh V8 isolate with `fetch()`/`connect()` disabled. Bindings are the only channel, and the supervisor holds credentials **F**. | Isolation and credential hiding ship. The blog has **no static analysis, type-checking of generated code, or data-flow restriction** **F**. The current docs (updated 2026-06-24) mention "approvals" in the durable runtime only and still say "experimental" ([docs](https://developers.cloudflare.com/agents/tools/codemode/)) **F**. |
| **Anthropic, code execution with MCP**, [2025-11-04](https://www.anthropic.com/engineering/code-execution-with-mcp) | 150,000 → 2,000 tokens on one example. "The MCP client intercepts the data and tokenizes PII before it reaches the model." Real values flow Sheets→Salesforce "but never through the model" **F**. | PII tokenisation **is** a declassification-by-handle IFC mechanism, shipped as an example. |
| **Anthropic programmatic tool calling** ([docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/programmatic-tool-calling)) | GA; `allowed_callers: ["code_execution_20260120"]`. The docs say it "is not a hard API-level block on direct calls" **F**. | The vendor runtime gives no flow policy. The client must enforce it. |
| **Pydantic Monty**, [article](https://pydantic.dev/articles/pydantic-monty), 2026 | Rust bytecode VM for a Python subset, built for Code Mode. Marked experimental **F**. | A restricted, trusted interpreter is exactly where CaMeL-style per-value labels can live. Nobody found here has added them. |
| **CaMeL**, Debenedetti et al. (Google/DeepMind/ETH), [arXiv 2503.18813, v1 2025-03-24, v2 2025-06-24](https://arxiv.org/abs/2503.18813) | A privileged LLM writes pseudo-Python from the trusted query only. A custom interpreter tracks capabilities per value. A quarantined LLM parses untrusted data. 77% of AgentDojo tasks "with provable security" vs 84% undefended **F**. Median-task overhead is 2.82× input and 2.73× output tokens vs native tool calling (reproduced by [2510.05244](https://arxiv.org/abs/2510.05244)) **F**. | **Direct prior art for the whole lens.** The repo warns that its interpreter "likely contains bugs" ([google-research/camel-prompt-injection](https://github.com/google-research/camel-prompt-injection)) **F**. |
| **Operationalizing CaMeL**, [arXiv 2505.22852, May 2025](https://arxiv.org/abs/2505.22852) | Latency >10 s when the Q-LLM reviews ~10 emails. Plan-template caching claims ≤50% savings without published methodology **F**. | The dual-LLM tax is real. |
| **FIDES**, Costa, Köpf, Kolluri et al. (Microsoft), [arXiv 2505.23643, v2 Sep 2025](https://arxiv.org/abs/2505.23643); [code](https://github.com/microsoft/fides) | Planner with confidentiality/integrity labels, results held in variables, selective hide/reveal. It names the core failure of naive taint: one untrusted result "immediately taints the conversation history". About 16% more tasks than a basic planner with policies **F**. | Label creep is the known killer. Hidden variables are the fix. |
| **LBAC — Language-Based Agent Control**, Zhou, D'Antoni, Polikarpova, [arXiv 2605.12863, v2 2026-10-15](https://arxiv.org/abs/2605.12863) | Agents generate programs that must type-check against developer scaffolding. LIO floating labels are used "completely off the shelf". `toLabeled` sub-computations quarantine subagents and generalise dual-LLM **F**. No benchmark numbers on the abstract page **F**. | **The PL community has already applied LIO (2011) to agent programs.** |
| **ACE**, Li et al. (Northeastern), [arXiv 2504.20984; NDSS 2026](https://www.ndss-symposium.org/ndss-paper/ace-a-security-architecture-for-llm-integrated-app-systems/) | Abstract plan from the trusted query, then a concrete plan, then **static** information-flow check, then isolated execution with a privilege score **F**. | Static IFC on plans is occupied. |
| **CaMeLoT**, Nikolaou et al., [arXiv 2609.18674, 2026-09-16; CAMLIS 2026](https://arxiv.org/abs/2609.18674) | Plan → transition system with taint/provenance → CTL model checking (nuXmv) before any tool call. Counterexample returned for repair. No numbers on the abstract page **F**. | Symbolic/model-checking pre-execution verification is occupied. |
| **Can CaMeLs Talk?**, [arXiv 2610.05640, Oct 2026](https://arxiv.org/abs/2610.05640) | Individually CaMeL-secured agents composed hierarchically are hijacked by "boundary laundering" **F**. | Labels must cross agent boundaries. |
| **Progent**, Shi et al. (Berkeley et al.), [arXiv 2504.11703](https://arxiv.org/abs/2504.11703) | JSON-Schema privilege DSL with default deny. An LLM can generate and update the policies **F**. | Contracts/policies at the tool boundary are occupied. LLM-written policies are a reward-hacking surface (see the ONE bet). |
| **Design Patterns for Securing LLM Agents**, Beurer-Kellner et al. (14 authors, Google/MS/IBM/ETH/EPFL), [arXiv 2506.08837, June 2025](https://arxiv.org/abs/2506.08837) | Six patterns, incl. plan-then-execute and **code-then-execute**. The paper says "general-purpose agents" remain hard to secure **F**. | Code Mode is a named security pattern, not just a token trick. |
| **Invariant Labs Guardrails** (Apache-2.0); [acquired by Snyk 2025-06-24](https://siliconangle.com/2025/06/24/snyk-acquires-invariant-labs-expand-ai-agent-security-capabilities/) | Python-like rules over traces, including **flows between tool calls** (read inbox → email unknown address) **F**. | Trace-level flow policy is a product already. |
| **Chrome agentic browsing**, Parker, [2025-12-08](https://blog.google/security/architecting-security-for-agentic/) | "Agent Origin Sets" split origins into read-only and read-write. A User Alignment Critic sees only action metadata **F**. | Google ships coarse IFC (origin labels) for agents. |
| **Meta, Agents Rule of Two**, [2025-10-31](https://ai.meta.com/blog/practical-ai-agent-security/) | No session may combine more than two of: untrusted input, sensitive data, state change/external comms **F**. | A three-bit effect system per *session*. Code Mode allows it per *program*. |
| **The Attacker Moves Second**, Nasr, Carlini et al., [arXiv 2510.09023, 2025-10-10; USENIX Sec 2026](https://arxiv.org/abs/2510.09023) | 12 defences bypassed at >90% attack success for most; most had reported near-zero **F**. | Model-based filters fail under adaptive attack. Deterministic flow control is not in their target set. |
| **Firewalls paper**, Bhagwatkar et al., [arXiv 2510.05244, v2 2026-03-23](https://arxiv.org/abs/2510.05244) | A simple tool-input minimiser plus tool-output sanitiser "achieves perfect security" on AgentDojo, ASB, InjecAgent, tau-Bench. Benchmarks have "flawed success metrics, implementation bugs, and … weak attacks" **F**. | **Any IFC result on stock AgentDojo proves little.** The oracle has to be the fixed benchmark plus adaptive attacks. |

**F — Buyers exist for agent runtime security** (mostly classifier/guardrail products): SentinelOne–Prompt Security $250M
disclosed (closed 2025-09-05); F5–CalypsoAI $180M disclosed; Check Point–Lakera (announced 2025-09-16, ~$300M estimated);
Palo Alto–Protect AI (announced 2025-04-28, estimates $500–700M); Snyk–Invariant (price undisclosed)
([CSO, 2025](https://www.csoonline.com/article/4058653/check-point-acquires-lakera-to-build-a-unified-ai-security-stack.html);
[SecurityWeek](https://www.securityweek.com/check-point-to-acquire-ai-security-firm-lakera/)). Prices other than
SentinelOne's and F5's are press estimates.

**F — Verified pain.** GitHub MCP exploit: a public issue makes an agent copy private-repo data into a public PR
([Willison, 2025-05-26](https://simonwillison.net/2025/May/26/github-mcp-exploited/)). The "lethal trifecta" of private
data, untrusted content and external communication
([Willison, 2025-06-16](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/)). Approval fatigue: "users accept 93%
of [manual prompts] anyway" ([Anthropic auto mode, 2026-03-25](https://anthropic.com/engineering/claude-code-auto-mode)).
Sandboxing "safely reduces permission prompts by 84%" internally
([Anthropic, Oct 2025](https://anthropic.com/engineering/claude-code-sandboxing)).

**F — Repository evidence (this repo).** The Sofort executor's host policy already implements a **v0 coarse floating
label per run**: "Labels are sticky, owned by the host, and kept per run." After a `reads:'private'` result, an `egress`
tool needs approval if it is `endorsable` and is denied otherwise. After any tool output, a `writes` tool needs approval.
The README states the key constraint: "**Per-value labels inside the VM are unsound because the interpreter is
attacker-controlled**". It lists "Host-side opaque handles for private data" as **v1, not built**
([`arch/jitk/executor/policy/README.md`](../../jitk/executor/policy/README.md),
[`policy.mjs` L30–66](../../jitk/executor/policy/policy.mjs)). Tools are declared with
`reads`/`egress`/`writes`/`endorsable` ([`policy-adapter.ts`](../../jitk/executor/policy-adapter.ts)). **I:** That is
Meta's Rule of Two expressed as tool effect annotations, plus LIO's floating label, enforced across a VM boundary.

---

## Per idea

Format per the flip template: (1) idea + origin, (2) why niche, (3) what flipped, (4) oracle, (5) superhuman test,
(6) who does it now, (7) value, (8) 2-week proof, (9) demo/tweet, kill reply, kill test. For agent-in-the-loop ideas:
what the agent does, what checks it, and how it could cheat.

### 1. Static effect inference → a per-program effect manifest and one-shot approval

1. **I/F —** Infer from the program text which effects (tools; read/egress/write classes; argument provenance) it *can*
   perform, before it runs. Origin: Gifford & Lucassen, "Integrating functional and imperative programming", LFP 1986
   ([doi](https://doi.org/10.1145/319838.319848)); Lucassen & Gifford, "Polymorphic effect systems", POPL 1988
   ([doi](https://doi.org/10.1145/73560.73564)) **F**.
2. **F/I —** Mainstream languages never adopted effect annotations. Java's checked exceptions are the cautionary example,
   and effect polymorphism is a burden for humans **I**. Koka and OCaml 5 effects stayed in PL circles **I**.
3. **I —** Agent programs are short (tens of lines), call tools through a generated, closed API object
   (`tools.ns.fn(...)`), and are written fresh per task. Nobody annotates anything: effects come from tool declarations
   (Sofort already has `reads/egress/writes`). The inference is a syntax walk plus constant propagation. The program is
   the approval unit, so one approval can cover a whole effect set instead of N prompts.
4. **Oracle: strong for soundness of the manifest at runtime.** The host policy kills any call outside the manifest, so an
   unsound manifest fails closed. **Weak** for usefulness, which needs a human or policy to judge the manifest.
5. **Superhuman test: more valuable.** Better models write longer programs per approval, so per-call prompting gets worse
   and per-program approval saves more **I**.
6. **Occupied in research:** ACE's static plan check and privilege score; LBAC's type-checked programs; CaMeLoT's model
   checking; Progent's policies **F**. **Not found in the shipping Code Mode runtimes** checked (Cloudflare docs, Anthropic
   PTC docs, Monty docs) **F**. Claude Code addresses fatigue with sandboxing and a classifier (auto mode) instead **F**.
7. **I —** Value: fewer interruptions at the same safety level, measured against "93% accepted anyway". Buyer: whoever
   runs the executor. This is a feature inside an executor, not a product on its own.
8. **E — 2-week proof.** TS compiler-API pass over Code Mode programs → manifest
   `{tool, class, args: const|user|tool-derived(handle id)}`. Programs with computed member access or `eval`-like
   constructs get "unknown", which falls back to per-call policy. Run it on ≥200 programs a real model writes for
   AgentDojo-ported tasks. Measure manifest coverage and approvals per task (per-call vs per-program).
9. **I —** Demo: one dialog, "this program will read 40 inbox messages and send **one** email to `alice@corp` (constant
   from your request)", instead of 41 prompts. Tweet: "Code Mode turns 41 approvals into one, and the host kills anything
   the program didn't declare." **Kill reply:** "Humans rubber-stamp a manifest exactly like a prompt; you moved the fatigue,
   not the risk." **Kill test:** under ≥50% manifest coverage, or if a user study / reviewer simulation shows no drop in
   wrongly approved malicious manifests vs per-call prompts.

### 2. Information-flow control with host-side labels and VM compartments (the strongest idea; see the ONE bet)

1. **F —** Lattice model of secure information flow: Denning, CACM May 1976 ([doi](https://doi.org/10.1145/360051.360056)).
   Static language IFC: Myers, JFlow, POPL 1999 ([doi](https://doi.org/10.1145/292540.292561)). Coarse-grained dynamic
   IFC with a **floating label** per computation and `toLabeled` sub-computations: Stefan et al., LIO, Haskell Symposium
   2011 ([doi](https://doi.org/10.1145/2034675.2034688)). Labelled **compartments** for untrusted JavaScript (pages,
   iframes, workers): Stefan et al., COWL, OSDI 2014
   ([paper](https://www.usenix.org/conference/osdi14/technical-sessions/presentation/stefan)), with "virtually
   imperceptible" page-load cost **F**.
2. **F/I —** Annotation burden and label creep. Jif-style languages needed every variable labelled. Floating-label systems
   needed programmers to split code into compartments, or one sensitive read stalled everything. FIDES restates label
   creep for agents **F**. `flip/04-broad.md` §11 classed it as "killer is not labour" **I**. That is half right: the
   *annotation* labour moved, it did not vanish.
3. **I — Three flips.**
   - **Demand:** prompt injection is a confused-deputy and flow problem, and adaptive attacks break model-based filters
     (Nasr et al.) **F/I**.
   - **Labour:** labels attach at the **tool boundary** (hundreds of tools, not millions of lines). The **model** writes
     the compartment structure, because it writes the program anyway.
   - **Cost:** compartments are fresh isolates or microVMs. Sofort measured a one-tool `execute()` at 1.10 ms p50 /
     1.86 ms p99 on Linux KVM (nested) after copy-restore reset
     ([`bench/RESULTS-copy-restore-2026-10-28.md`](../../jitk/bench/RESULTS-copy-restore-2026-10-28.md)) **F (repo)**, so
     one compartment per untrusted read is affordable.
     Code Mode already returns only selected values to the model, so the "conversation taint" FIDES fights is limited to
     what the program returns.
4. **Oracle: medium.** Label monotonicity and sink checks are deterministic and testable with hostile-guest suites (Sofort
   already has 32 policy-bypass cases) **F (repo)**. Utility/security needs fixed AgentDojo plus adaptive attacks, because
   stock AgentDojo is saturated by a simple firewall (2510.05244) **F**.
5. **Superhuman test: more valuable.** A stronger injected model is a stronger attacker. The enforcement does not depend on
   the model. A stronger planner splits programs into compartments better, so the utility tax falls **I**. It becomes
   obsolete only if in-model injection robustness becomes provable, which the Meta and Nasr et al. sources consider
   unsolved **F**.
6. **Occupied in research**, thoroughly: CaMeL (per-value capabilities, trusted custom interpreter), FIDES (labelled hidden
   variables), LBAC (LIO for agents), ACE (static), CaMeLoT (temporal), NeuroTaint ([arXiv 2604.23374,
   2026-04-25](https://arxiv.org/abs/2604.23374), offline semantic taint audit) **F**. **In products:** Invariant/Snyk
   (trace flow rules), Chrome origin sets, Anthropic's PII tokenisation example **F**. **Not found:** a Code Mode executor
   that runs *hostile* JS/TS with host-owned labels and compartments. Closest are an OpenClaw RFC for a TS CaMeL
   ([issue #39160](https://github.com/openclaw/openclaw/issues/39160), a proposal) and the unverified "sluice" repo **F**.
7. **E —** Value: security for agents that need all three trifecta legs, such as email/CRM/support agents. That is where
   the Rule of Two forces either human approval or crippled agents. Buyers are executor operators (Cloudflare, Anthropic,
   Vercel, E2B, Pydantic) and enterprises adopting MCP. The money in AI security M&A ($180–700M deals) goes to
   detection/guardrail vendors, not deterministic IFC, so willingness to pay for IFC specifically is **unproven** **I**.
8. **E —** The 2-week proof is the ONE bet below.
9. **I —** Demo: the GitHub-MCP attack replayed against a Code Mode agent. The injected program reads the private repo
   inside a compartment; its handle reaches `createPullRequest` on a public repo; the host denies it; the trace shows the
   handle's provenance. The same task without injection still completes. Tweet: "Code Mode + labels the agent can't
   forge: the model sees what it returns, and private data moves only as opaque handles the host checks at every sink."
   **Kill reply (Tramèr/Debenedetti):** "That's CaMeL with a VM. Your coarse labels lose more utility than our per-value
   ones, and the firewall baseline matches you on any benchmark you can cite." **Kill test:** see the ONE bet.

### 3. Batching and promise pipelining of tool calls

1. **F —** Promises/pipelining: Liskov & Shrira, PLDI 1988 ([doi](https://doi.org/10.1145/53990.54016)). Automatic
   batching and deduplication of data fetches: Marlow et al., Haxl, "There is no fork", ICFP 2014
   ([doi](https://doi.org/10.1145/2628136.2628144)). Facebook DataLoader is the JS idiom **F**.
2. **I —** It did not die. It became standard (gRPC streams, GraphQL DataLoader, Cap'n Proto).
3. **I/F —** Agent programs written naively (`for … await tool(id)`) pay one sandbox→host→MCP round trip per call. MCP's
   2025-06-18 revision **removed JSON-RPC batching**
   ([changelog](https://modelcontextprotocol.io/specification/2025-06-18/changelog)) **F**, so the host must batch.
4. **Oracle: strong** (same results, fewer round trips) when tools are read-only and idempotent. Otherwise reordering
   changes semantics.
5. **Superhuman test: less valuable.** Better models write `Promise.all` and batch endpoints themselves **I**.
6. **Occupied:** Cap'n Web pipelining, "one round trip"
   ([repo](https://github.com/cloudflare/capnweb); [blog, 2025-09-22](https://blog.cloudflare.com/capnweb-javascript-rpc-library/))
   **F**. LLMCompiler (DAG planner, up to 3.7× latency and 6.7× cost vs ReAct,
   [ICML 2024](https://arxiv.org/abs/2312.04511)) **F**. Superoptimisation of workflows is moonshots2 bet 3.
7. **I —** A latency feature for executors. No separate buyer.
8. **E —** A DataLoader shim in the generated tool stubs for tools declared `reads` and idempotent. Measure the round-trip
   reduction on the same 200-program corpus. Worth an afternoon inside Sofort, not a bet.
9. **Kill reply:** "Cap'n Web already does it and the model writes Promise.all." Accepted. **Rejected as a bet.**

### 4. Query optimisation and predicate pushdown into tool APIs

1. **F —** Cost-based access-path selection: Selinger et al., SIGMOD 1979 ([doi](https://doi.org/10.1145/582095.582099)).
2. **I —** Did not die. It is the core of every database.
3. **I —** Agent programs often fetch everything and filter in JS ("list all 2,000 issues, keep open ones by bob"). Pushing
   the filter into the API's own parameters cuts bytes and calls.
4. **Oracle: medium.** Results must be equal, but API filter semantics (case, pagination, eventual consistency) differ
   from JS filters, so equivalence is per-API and fragile **I**.
5. **Superhuman test: less valuable.** A model that reads the API docs writes `?state=open&assignee=bob` itself **I**.
6. **Occupied:** semantic-operator optimisers (Cortex AISQL [arXiv 2511.07663](https://arxiv.org/abs/2511.07663) reports up
   to 7× from AI-filter placement; Sema; iPDB) **F**. Workflow-level rewrites are moonshots2 bet 3. No source found that
   pushes JS predicates into tool parameters automatically **F**. The reason is that per-API rewrite rules are the
   expensive part.
7. **I —** Small. **Rejected:** per-API rewrite rules are hand labour with a weak oracle, and the model already does it.

### 5. Speculative execution and deoptimisation

1. **F —** Tomasulo 1967 (out-of-order execution); dynamic deoptimisation, Hölzle et al., PLDI 1992
   ([pdf](https://bibliography.selflanguage.org/_static/dynamic-deoptimization.pdf)).
2. **I —** Did not die in hardware/JITs. For agents, effects cannot be rolled back.
3. **I —** In Code Mode the slow part is the **model writing the next program**, not the tool calls inside one program. The
   only speculation left is predicting the model's next program or tool and pre-running **read-only** calls.
4. **Oracle: strong** for read-only speculation (commit only on match). **None** for writes.
5. **Superhuman test: mixed.** Faster models shrink the gap that speculation hides **I**.
6. **Occupied:** Speculative Actions, Ye et al., [arXiv 2510.04371; ICLR 2026](https://arxiv.org/abs/2510.04371): up to 55%
   next-action prediction, "lossless" commit-on-match **F**. Deopt/guards for agent JIT are moonshots2 bet 1 (PreAct,
   TraceCompiler) **F**.
7. **Rejected:** occupied; within one Code Mode program there is little left to speculate on.

### 6. Partial evaluation and staging at plan time

1. **F —** Futamura 1971; Jones, Gomard & Sestoft, *Partial Evaluation and Automatic Program Generation*, 1993; MetaOCaml/LMS
   (moonshots2 table).
2. **I —** Binding-time annotations and termination of specialisation were the labour.
3. **I —** The plan/observation split is a two-stage program: stage 0 is the trusted query (known), stage 1 is tool data
   (unknown). Plan-then-execute is binding-time analysis by construction.
4. **Oracle:** the same as for staged programs: the residual must equal the unstaged run on all stage-1 inputs. That can be
   tested but not proved for unknown tools.
5. **Superhuman test:** neutral.
6. **Occupied:** ReWOO (planner/worker/solver, [arXiv 2305.18323, 2023-05-23](https://arxiv.org/abs/2305.18323)) **F**; the
   plan-then-execute and code-then-execute patterns (2506.08837) **F**; CaMeL is exactly a staged program whose stage 0
   cannot see stage 1 **F**. Residualisation for reuse is moonshots2 bets 1/2/5.
7. **Rejected as a separate bet.** Its useful form *is* the CaMeL/IFC split (#2).

### 7. Static cost analysis (WCET, amortised resource bounds)

**Covered by moonshots2 bet 6** ("Compile agents into a bounded execution budget"). Lineage:
[Wilhelm et al., WCET survey, TECS 2008](https://doi.org/10.1145/1347375.1347389); Tarjan, amortised analysis, 1985;
Hoffmann et al., multivariate amortised resource analysis (RAML), POPL 2011 **F**.
**I —** One addition from this lens: the effect manifest (#1) gives a **call-count upper bound** for loop-free or
constant-bounded programs. Sofort's admission queue (R10) can reserve it up front, so this is a field in the manifest, not
a new idea. **Rejected as separate.**

### 8. Symbolic execution and model checking of the agent program before running

1. **F —** King, "Symbolic execution and program testing", CACM 1976 ([doi](https://doi.org/10.1145/360248.360252)); KLEE,
   OSDI 2008.
2. **I —** Path explosion and environment modelling. Tools are the environment, and their semantics are unknown.
3. **I —** Agent programs are short, and MCP `outputSchema` (2025-06-18, [spec](https://modelcontextprotocol.io/specification/2025-06-18/server/tools))
   **F** gives symbolic return types. So bounded symbolic execution can find "if the search returns zero results, the
   program sends an empty email" before running.
4. **Oracle: weak.** It finds paths relative to schemas, not to real tool behaviour. Failures on real data paths are mostly
   semantic (wrong record), which schemas do not express **I**.
5. **Superhuman test: less valuable** for reliability (better models write fewer path bugs). **Neutral** for policy
   checking.
6. **Occupied:** CaMeLoT (CTL over plan + taint) **F**; solver-aided compliance (Z3 on planned calls,
   [arXiv 2603.20449](https://arxiv.org/abs/2603.20449)) **F**; Symbolic Constraint Agents (mined SMT constraints on tool
   calls, [arXiv 2610.25552](https://arxiv.org/abs/2610.25552)) **F**; the survey [arXiv 2608.14590](https://arxiv.org/abs/2608.14590)
   says static methods "struggle with dynamically generated plans" **F**.
7. **Rejected:** occupied, and the oracle is weak. The useful slice (policy over paths) folds into #1/#2.

### 9. Program slicing / provenance for "why did the agent do that?"

1. **F —** Weiser, program slicing, ICSE 1981 / TSE 1984; dynamic slicing, Agrawal & Horgan, PLDI 1990
   ([doi](https://doi.org/10.1145/93542.93576)).
2. **I —** Static slices of large programs were too big to read. Dynamic slicing needed full instrumentation.
3. **I —** A Code Mode run is a small program plus a host-mediated log of every tool call and argument. If arguments carry
   host-side handle IDs (#2), the backward dynamic slice of any effect ("which tool results shaped this email's `to`?") is
   a graph walk over data the host already stores. No in-guest instrumentation is needed, which matters because the guest
   is hostile.
4. **Oracle: medium.** Slices can be checked by counterfactual replay: change a source value and observe whether the sink
   changes. That oracle needs deterministic replay of the program with recorded tool results (#10).
5. **Superhuman test: more valuable.** More autonomous agents cause more incidents to explain, and the explanation does
   not depend on trusting the model's own narrative **I**.
6. **Partly open.** The survey [arXiv 2606.04990 (June 2026)](https://arxiv.org/abs/2606.04990) separates logging from
   "semantic provenance" and treats tool-call attribution as unsolved **F**. NeuroTaint does semantic taint offline **F**.
   [arXiv 2603.28345](https://arxiv.org/abs/2603.28345) slices developer code around LLM calls, not agent runs **F**.
   Invariant Explorer shows traces but not slices **F**.
7. **I —** Buyer: incident response and compliance (record-keeping). The willingness to pay is real for SIEM/forensics
   generally and **unproven** for this. Best as a by-product of #2. A separate product would compete with every
   observability vendor.
8. **E —** With #2's handles in place, add `explain(effectId)` that returns the handle DAG and the source text spans of
   the program. Validate on 50 injected-attack runs: does the slice name the injected source? Counterfactual check by
   replaying with the source blanked.

### 10. Record/replay and time-travel debugging

1. **F —** LeBlanc & Mellor-Crummey, Instant Replay, IEEE TC 1987; O'Callahan et al., rr, USENIX ATC 2017.
2. **I —** Did not die. rr and Replay.io are products.
3. **I —** Code Mode narrows nondeterminism to one channel (tool call/return frames). Sofort's ASCII JSON call/ret
   protocol is already a complete replay log ([`ARCHITECTURE.md`](../../jitk/docs/ARCHITECTURE.md)) **F (repo)**.
4. **Oracle: strong.** Replay must reproduce the identical frame sequence.
5. **Superhuman test:** neutral-to-positive.
6. **Crowded:** agentrr ([PyPI](https://pypi.org/project/agentrr/)), Chronicle cut-point replay
   ([arXiv 2609.20625](https://arxiv.org/abs/2609.20625)), OrcaReplay, LangGraph time travel, and the durable-execution
   platforms Temporal/Restate/DBOS (flip/03) **F**.
7. **Rejected as a bet.** Keep it as the cheap substrate for #9's counterfactual oracle.

### 11. Type-directed tool API design and type-checking generated programs

1. **F —** Types as LLM output schema: Microsoft TypeChat (2023). MCP `outputSchema`/`structuredContent` (2025-06-18) **F**.
2. **I —** Not dead; this is Code Mode's own premise ("convert MCP tools into a TypeScript API", Cloudflare) **F**.
3. **I —** The cheap step few runtimes advertise is running `tsc --noEmit` on the generated program against the tool
   `.d.ts` *before* execution and returning errors to the model without spending a sandbox run. Sofort already generates
   `generated-tools.d.ts` ([`executor/`](../../jitk/executor/)) **F (repo)**.
4. **Oracle: strong** (the type checker).
5. **Superhuman test: less valuable.** Better models make fewer type errors **I**.
6. **Occupied:** LBAC requires type-checking for safety **F**; Cloudflare `describe` returns types **F**.
7. **Rejected as a bet. Keep as a 50-line feature.** Its real value is security rather than reliability: in LBAC, labels
   *are* types. A TS type system is unsound under `any`/casts, so it cannot be the enforcement layer for hostile code
   (Sofort's policy README makes the same point about in-VM labels) **I**.

### 12. A DSL per task

1. **F —** Bentley, "Little languages", CACM 1986 ([doi](https://doi.org/10.1145/6424.315691)); Hudak, "Building
   domain-specific embedded languages", ACM CSUR 1996.
2. **I —** Each DSL needed tooling and users.
3. **I —** An agent could generate a small DSL per task family and constrain later programs to it.
4. **Oracle:** the DSL's own validator.
5. **Superhuman test: obsolete-ish.** Bigger models do better at mainstream languages. Evidence: LLMs degrade on
   less-known DSLs and are better at Python-then-translate ([arXiv 2405.16450](https://arxiv.org/abs/2405.16450)) **F**.
   Practitioner reports say a DSL works when it is tiny and validated ([Fowler](https://www.martinfowler.com/articles/llm-and-dsls.html)) **F**.
6. **I —** The useful version is a **restricted subset of TS/Python** (CaMeL's restricted Python, Monty, LBAC's typed
   host language), not a new language.
7. **Rejected:** worse for the model; the restricted subset already captures the benefit.

### 13. Contracts and refinement types on tool APIs, with blame

1. **F —** Design by contract, Meyer, IEEE Computer 1992; refinement types, Freeman & Pfenning, PLDI 1991
   ([doi](https://doi.org/10.1145/113445.113468)); higher-order contracts **with blame**, Findler & Felleisen, ICFP 2002
   ([doi](https://doi.org/10.1145/581478.581484)).
2. **I —** Humans would not write preconditions for every API.
3. **I —** An agent can draft tool contracts (`amount <= balance`, `to ∈ contacts`, "pagination cursor from the previous
   call") from docs and traces. The host enforces them at the boundary. **Blame** is the underused part: when a contract
   fails, say whether the *program* (model) or the *tool* (server) broke it. That routes the failure to the repair loop
   (re-prompt the model) or to ops (tool regression).
4. **Oracle: medium.** Contracts can be tested against recorded traces (no false alarms on known-good runs) and mutants
   (catch seeded bad calls). **Agent cheat:** a vacuous contract (`true`) passes the false-alarm test, so mutant kill rate
   must be required. A contract overfit to traces blocks legitimate new calls, so held-out good traces are needed.
5. **Superhuman test: mixed.** Better models break fewer preconditions, and better models draft better contracts **I**.
6. **Occupied:** Symbolic Constraint Agents (mines formal tool-call constraints, SMT runtime check, auto-repair) **F**;
   solver-aided compliance (2603.20449) **F**; Progent policies **F**; MANTRA benchmarks
   ([arXiv 2605.06334](https://arxiv.org/abs/2605.06334)) **F**. Blame assignment specifically was not found in these
   abstracts **F (absence in what was read)**.
7. **I —** Reliability value is moderate. Blame is a nice operational detail, not a market.
8. **E —** Ranked #3: a contract layer in Sofort's `tool.args` validators (they already exist as strict validators) plus a
   blame tag on `DENIED`/`TOOL_ERROR`.

---

## Where the value is real and where there is no buyer

| Idea | Value axis | Better model makes it… | Occupied by | Verdict |
|---|---|---|---|---|
| IFC with host labels + compartments (#2) | **security** | more valuable | CaMeL, FIDES, LBAC, ACE (research); Invariant, Chrome, Anthropic PII example (partial products) | **Real need; research occupied; executor integration open** |
| Effect manifest / one-shot approval (#1) | security + UX | more valuable | ACE, LBAC, CaMeLoT (research) | **Real; a feature of #2** |
| Provenance slicing (#9) | forensics/compliance | more valuable | surveys call it open | **Real need, buyer unproven; by-product of #2** |
| Contracts with blame (#13) | reliability | mixed | SCA, solver-aided, Progent | modest |
| Batching/pipelining (#3) | latency | less | Cap'n Web, LLMCompiler | feature, not bet |
| Pushdown (#4) | cost | less | semantic-SQL optimisers | paper, no buyer |
| Speculation (#5) | latency | less | Speculative Actions | occupied |
| Staging (#6) | security/cost | neutral | ReWOO, CaMeL, patterns paper | absorbed into #2 |
| Cost bounds (#7) | cost | — | moonshots2 bet 6 | covered |
| Symbolic execution (#8) | reliability | less | CaMeLoT, SMT checkers | weak oracle |
| Record/replay (#10) | debugging | neutral | agentrr, Chronicle, Temporal | crowded; substrate |
| Types (#11) | reliability | less | Code Mode itself, LBAC | 50-line feature |
| DSL per task (#12) | reliability | less | evidence against | rejected |

**I — The pattern.** Everything that saves tokens, round trips or latency is either already the point of Code Mode
(Anthropic's 98.7% example, Cloudflare's 2,500 endpoints in ~1,000 tokens) or gets cheaper for the model to do itself as it
improves. Those are nice papers with no separate buyer. Everything that constrains *authority* and *flow* gets more
valuable with better models, because it constrains attackers that also improve. The model cannot do it for itself: a
model cannot attest to its own uncompromised state.

---

## Experiments

**M — None run.** The decisive question for the bet is utility under coarse labels with compartments vs CaMeL's 77%. It
needs a ported AgentDojo, a real model and adaptive attacks, so it is the two-week proof, not a 200 MB scratch experiment.
A toy effect-inference pass over hand-written programs would only measure my own programs, so it was not worth running.
Repository facts above come from reading `arch/jitk/executor/policy/`, not from running it.

---

## Ranked top 3

1. **Labelled Code Mode (#2 + #1): host-owned labels, opaque handles, VM compartments, and a per-program effect manifest.**
   It has the strongest need (verified incidents, Rule of Two, adaptive-attack results) and gets more valuable with better
   models. It extends Sofort's existing v0 floating label and its listed-but-unbuilt v1 handles, and it uses Sofort's cheap
   nested VMs, which a CaMeL-style trusted interpreter does not need but a hostile-interpreter executor does. Principal
   objection: research is thoroughly occupied (CaMeL/FIDES/LBAC), and the market pays for detectors rather than
   deterministic IFC.
2. **Provenance slicing from host handles (#9).** It falls out of #1 almost for free and has a counterfactual-replay
   oracle. Sources call agent attribution open. Principal objection: no proven separate buyer; observability vendors
   would absorb it.
3. **Tool contracts with blame (#13).** A cheap extension of Sofort's strict `args` validators that routes failures to the
   model or to ops. Principal objection: SMT-checked tool constraints are already published, and the value is moderate.

---

## The ONE bet

**I — Build v1 of Sofort's host policy as "labelled Code Mode": the model writes ordinary TS. Every tool result that is
`private` or untrusted stays on the host as an opaque handle with a label. The guest can inspect a handle's content only
inside a fresh compartment VM, whose floating label then rises. Sinks check labels deterministically. Before execution, a
static pass produces an effect manifest for one-shot approval.** This is LIO/COWL (2011/2014) with VMs as compartments and
the model doing the compartment-splitting labour that killed coarse IFC for human programmers. It is not new as an idea
(LBAC applies LIO to agents; CaMeL and FIDES label values and variables). The claim to test is narrower: **it can be
enforced when the code runs on an attacker-controlled interpreter in a hostile VM, at Code Mode's token cost rather than
CaMeL's 2.8×, with utility close to CaMeL's.**

**Mechanism (I).**
- `tools.x.read()` returns `Handle{id}` for labelled results. The host stores value + label `{conf, integ, sources}`. Tools
  are labelled in the existing policy format.
- `sandbox.inspect(handles, subprogram)` spawns a child VM. The child's floating label starts at the join of its handles'
  labels. Its result comes back as a new handle (LIO `toLabeled`), so the parent's label does not rise.
- `return`/`console.log` to the model is a sink. The model context's label is the join of everything revealed, which makes
  FIDES's "tainted history" explicit and bounded.
- A quarantined-LLM call (CaMeL's Q-LLM) is just a tool whose output is labelled by its inputs.
- Sinks (`egress`, `writes`) compare the argument handles' labels with the policy (deny, approve, or endorse).
  Declassification only happens through a human approval bound to the call digest (exists in v0).
- Static pass: TS AST → manifest of reachable tools and argument provenance (const/user/handle). Anything unresolvable
  falls back to per-call policy. The host kills undeclared calls (v0 already kills unknown tools).

**Where the agent is in the loop, what checks it, how it cheats (I).**
- The *task model* writes the program and decides the compartment structure. **Checked by** the host label rules, which do
  not trust the program. **Cheat:** ask for declassification on every call (approval fatigue again). Count approvals as a
  cost. Covert channels: compartment *timing* and *termination* leak bits to the parent (LIO's known limitation), and so
  does the *number* of tool calls the parent makes after a child returns. Mitigations: fixed-time child results, or count
  these as accepted residual bandwidth and state it.
- A *labelling agent* drafts `reads/egress/writes` for the long tail of MCP tools (this is the old annotation labour).
  **Checked by** canary tests: plant unique canary values in an input, call the tool, and watch the external sinks
  (egress) and state diffs (writes). **Cheat:** label everything maximally restrictive (safe but useless, which shows up as
  a utility drop) or permissive (caught only where canaries reach). Confidentiality class (`private` vs `public`) has
  **no oracle** and stays a human decision.

**E — Two-week proof, one engineer.**
- **Days 1–3:** port AgentDojo's workspace + banking suites to Sofort tool providers through a thin RPC bridge to its
  Python environment. Apply the fixes from 2510.05244. Freeze the model (one pinned Claude model in Code Mode).
- **Days 4–7:** handles, compartments (nested `execute()`), sink checks, static manifest.
- **Days 8–10:** baselines: undefended Code Mode, v0 sticky per-run label, the firewall defence, and CaMeL's published
  numbers at the closest model.
- **Days 11–14:** attacks: the stock suite, the 2510.05244 three-stage attacks, and an adaptive attacker with a fixed
  budget (search over injection strings and over program-shaping instructions). Metrics: utility, attack success
  (excluding text-to-text answers, as CaMeL does), tokens, human approvals per task, p50/p95 latency including
  compartment spawns.

**E — Continue only if:**
- utility is ≥ 70% on the fixed suites (CaMeL reports 77%, undefended 84%);
- **zero** successful data-flow attacks through the mechanism under the adaptive budget (count timing-channel leaks
  separately);
- token cost is ≤ 1.3× undefended Code Mode (vs CaMeL's 2.8×);
- approvals per task drop ≥ 5× vs v0's per-call approvals.

**Kill** if utility is < 60% (label creep wins), or if a mechanism-level exfiltration is found that the design cannot
close, or if the firewall baseline matches on adaptive attacks (then deterministic IFC buys nothing measurable here).

**Demo + tweet (I).** Replay the GitHub-MCP heist against a Code Mode agent: the private file stays a handle, the public PR
is denied, `explain()` shows the flow, and the clean task still completes. "Prompt injection can rewrite the agent's
program. It can't rewrite the host's labels. Code Mode + VM compartments: CaMeL-style flow control at Code Mode's token
cost, on a hostile interpreter."

**Kill reply that should end it (I).** "Anthropic/Cloudflare will add handles to their executors in a quarter. Your
utility is below CaMeL's, and enterprises buy Lakera-style detectors anyway." The first half is likely true. That is why
this is a **Sofort differentiator and CV capstone**, consistent with the user's goals, not a standalone company. The
experiment above decides the second half.

---

## Five-line TL;DR

1. **I:** Code Mode makes the agent a program, so authority and analysis can be per program, and "what the model saw" is
   an explicit return value. That is the precondition IFC (Denning 1976) always lacked in ReAct agents.
2. **F:** The security ideas are thoroughly occupied in research (CaMeL 77% vs 84% utility at 2.8× tokens; FIDES; LBAC
   applying LIO to agents; ACE; CaMeLoT; Progent). No shipping Code Mode runtime checked here enforces flow labels.
3. **I:** Performance ideas (pipelining, pushdown, speculation, staging, cost bounds) are already Code Mode's own win,
   occupied (Cap'n Web, LLMCompiler, Speculative Actions), or covered by moonshots2. Better models make them less valuable.
4. **F/I:** Sofort's host policy already has LIO-style sticky per-run labels and names host-side handles as its unbuilt
   v1. Cheap nested VMs make COWL-style compartments affordable on a hostile interpreter.
5. **E:** Bet: build labelled Code Mode in two weeks. Kill it unless utility is ≥70% on fixed AgentDojo, there are zero
   mechanism-level exfiltrations under adaptive attack, tokens are ≤1.3× undefended, and approvals drop ≥5×.

## Rejected ideas (one line each)

- **Batching/promise pipelining (#3):** Cap'n Web and LLMCompiler already do it, and models write `Promise.all`; a
  DataLoader shim is an afternoon's feature.
- **Predicate pushdown into tool APIs (#4):** per-API rewrite rules are hand labour with a fragile equivalence oracle, and
  models already pass filters.
- **Speculative execution/deopt (#5):** Speculative Actions (ICLR 2026) and the moonshots2 JIT occupy it; little to
  speculate inside one program.
- **Partial evaluation/staging (#6):** ReWOO, plan-then-execute and CaMeL already are the staged form; no separate value.
- **Static cost analysis (#7):** moonshots2 bet 6; here only a call-count field in the manifest.
- **Symbolic execution/model checking (#8):** CaMeLoT and SMT checkers occupy it; tool semantics make the oracle weak.
- **Record/replay (#10):** crowded (agentrr, Chronicle, OrcaReplay, Temporal); kept only as the substrate for slicing.
- **Type-directed APIs / type-checking programs (#11):** Code Mode's own premise; `tsc` pre-check is a 50-line feature,
  and TS types are unsound as enforcement against hostile code.
- **DSL per task (#12):** evidence says models get worse on unfamiliar DSLs; restricted TS/Python subsets capture the
  benefit.
- **A standalone agent-IFC company:** research is occupied, executor owners will build it, and acquirers have paid for
  detectors, not deterministic flow control.
