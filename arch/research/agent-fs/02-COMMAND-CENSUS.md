# Agent shell command census

Offline local census. Transcript arguments, command text, output, project identities and session identities are deliberately absent. All figures below are aggregates; displayed commands are generic program/flag shapes.

## Headline numbers

- **104,276 unique submitted shell commands; 485,446 syntactic invocations; 2,031 command-bearing trace sessions.**
- **1,549 Claude and 699 Codex JSONL files** scanned (3.62 GB); command date range **2026-10-06–2026-10-31 UTC**.
- Primary command mix: **A 24.41%, B 21.78%, C 23.75%, D 6.51%, E 23.56%**; E is an exclusive shell-syntax bucket with underlying needs recorded separately.
- With host orchestration and compatible static tools, current read-only *potential* is **25.21%** (**43.89%** if host-resolved `cd` is allowed); Stage 1 **47.65%**; eventual bounded offline Node at Stage 2 **49.69%**. These are command-count routing scenarios, not measured execution success.
- The native census proves **9 narrow profiles**, not general read-only CLI compatibility; 2,425 commands (2.33%) fall in standalone read-only families containing demonstrated profiles, still requiring argument/artifact qualification.
- **19,336 commands (18.54%)** have unambiguous numeric synchronous tool-wall durations, totaling **1.37 hours**; population time shares remain unknown.
- Median commands/session **35**, p90 **113.0**; median shell observation span **11.30 min**, p90 **43.66 min**.
- In 1,136 fully paired synchronous sessions with ≥2 commands, shell-call envelopes occupy **9.67%** of observed session span; residual **90.33%** is non-shell time, not a direct measure of model thinking.
- **90,822 commands (87.10%)** contain multiple parsed invocations; **11,246 (10.78%)** contain complex/uncertain shell syntax.
- One user’s development-heavy history; no builds, VM launches, transcript commands, network operations or external services were run for this census.

## Method

The standard-library analysis script streams all recursively discoverable JSONL files from the two requested local transcript stores, including nested agent traces when present. It accepts assistant Claude `Bash` tool-use blocks and Codex shell/exec calls. Codex JavaScript wrappers are lexed, never evaluated: literal `tools.exec_command`/shell argument objects and simple literal variable bindings are extracted; computed strings, dynamic templates and opaque objects are counted as unparsed. Poll calls are linked where their session IDs and result objects are unambiguous, but are not counted as new shell commands. Typed stdin is counted separately and is not interpreted as another command.

A command is one extracted shell submission; an invocation is one syntactic simple command, including a few explicitly labeled shell-only actions. Thus a loop body is counted once, not once per iteration, and an invocation is not a measured process launch. Quote-aware tokenization splits pipes, conditionals, separators, groups, redirections, substitutions and literal shell-launcher bodies. Heredoc bodies are removed before tokenization, so embedded Python/JS/source text is not miscounted as shell programs. Executable paths are reduced to basenames, Python/pip/node versions are normalized, common wrappers are peeled, and BusyBox applets are attributed to applet names. Wrapper requirements remain flags. No transcript executable outside a fixed public-tool allowlist is displayed; private/custom executables share an aggregate bucket.

Duplicate copied tool calls are removed globally by source + tool-call ID + command hash. A retained call belongs to the first trace encountered; this prevents fork/replay inflation but can move copied work between session profiles. Session means a command-bearing trace file, not a human workday; sessions with no extracted shell commands are counted only in scan coverage. Claude project groups use the transcript directory key; Codex groups use recorded cwd, separately, without attempting identity reconciliation or exposing names.

Primary command labels are exclusive: E takes precedence if shell state/expansion/control logic is present; otherwise D > C > B > A across invocations. Invocation labels use the same capability meanings. Output redirection upgrades read-only work to B except descriptor routing and the null device. Static environment prefixes and cwd are tracked. Read-only Git subcommands are A by intent, mutations B, transport D; hooks, aliases, helpers, indexing, subprocesses and configuration remain compatibility risks. Unknown/custom executables default to C. A and B are resource-intent categories, not size, safety or existing-kernel support certifications.

Runtime names remain C even for short/version invocations, as requested. Installs/transports and recognizable inline network APIs become D; scripts can still hide network and child processes. General Python, package runners, builds, test runners, compilers, containers and external script files are never assumed to fit Stage 2 merely because Node/threads arrive. Read-only tools may have writable caches or threading in their actual distribution builds.

Reproduce with the generic shape `python <analysis-script>`; it performs only local reads and exclusive creation of the requested report. It refuses to overwrite an existing report. Sources for kernel feasibility: [jitk README](../../jitk/README.md), [GrowOS→Node synthesis](../growos-node/SUMMARY.md), and [native census](../native-census/RESULTS.md).

## Tables

### Corpus and coverage

| Source | Files scanned | Parseable files | Command-bearing sessions | Unique commands | Share | Duplicate copied commands removed | Project/cwd groups |
| --- | --- | --- | --- | --- | --- | --- | --- |
| claude | 1,549 | 1,549 | 1,352 | 70,531 | 67.64% | 2,464 | 51 |
| codex | 699 | 699 | 679 | 33,745 | 32.36% | 0 | 105 |

Project identities are withheld uniformly. Counts below rank anonymous groups within each source; cwd/worktree differences can represent one actual project, and the two sources must not be added as unique projects.

| Source | Project/cwd groups | Largest group: commands / share within source | Top 5 groups: commands / share | Singleton-command groups |
| --- | --- | --- | --- | --- |
| claude | 51 | 15,735 / 22.31% | 47,511 / 67.36% | 0 |
| codex | 105 | 17,731 / 52.54% | 24,137 / 71.53% | 1 |

Largest anonymous project/cwd groups, ranked separately within each source. Rank is only a local count label and carries no cross-source identity.

| Source | Anonymous group rank | Commands | Share within source | Command-bearing trace sessions |
| --- | --- | --- | --- | --- |
| claude | 1 | 15,735 | 22.31% | 239 |
| claude | 2 | 13,431 | 19.04% | 277 |
| claude | 3 | 10,120 | 14.35% | 124 |
| claude | 4 | 4,219 | 5.98% | 56 |
| claude | 5 | 4,006 | 5.68% | 55 |
| claude | 6 | 3,684 | 5.22% | 95 |
| claude | 7 | 2,812 | 3.99% | 77 |
| claude | 8 | 2,494 | 3.54% | 66 |
| claude | 9 | 1,611 | 2.28% | 21 |
| claude | 10 | 1,437 | 2.04% | 22 |
| claude | 11 | 1,397 | 1.98% | 56 |
| claude | 12 | 1,111 | 1.58% | 32 |
| claude | 13 | 1,111 | 1.58% | 30 |
| claude | 14 | 1,010 | 1.43% | 41 |
| claude | 15 | 668 | 0.95% | 8 |
| claude | 16 | 632 | 0.90% | 28 |
| claude | 17 | 632 | 0.90% | 12 |
| claude | 18 | 465 | 0.66% | 15 |
| claude | 19 | 459 | 0.65% | 12 |
| claude | 20 | 388 | 0.55% | 3 |
| codex | 1 | 17,731 | 52.54% | 339 |
| codex | 2 | 3,052 | 9.04% | 123 |
| codex | 3 | 1,143 | 3.39% | 20 |
| codex | 4 | 1,128 | 3.34% | 16 |
| codex | 5 | 1,083 | 3.21% | 19 |
| codex | 6 | 639 | 1.89% | 33 |
| codex | 7 | 500 | 1.48% | 18 |
| codex | 8 | 248 | 0.73% | 1 |
| codex | 9 | 199 | 0.59% | 1 |
| codex | 10 | 181 | 0.54% | 1 |
| codex | 11 | 172 | 0.51% | 1 |
| codex | 12 | 171 | 0.51% | 1 |
| codex | 13 | 170 | 0.50% | 1 |
| codex | 14 | 161 | 0.48% | 1 |
| codex | 15 | 159 | 0.47% | 1 |
| codex | 16 | 153 | 0.45% | 1 |
| codex | 17 | 153 | 0.45% | 1 |
| codex | 18 | 152 | 0.45% | 1 |
| codex | 19 | 146 | 0.43% | 1 |
| codex | 20 | 143 | 0.42% | 1 |

| Extraction/quality item | Count |
| --- | --- |
| Malformed JSON lines | 0 |
| Codex wrapper calls inspected | 31,652 |
| Codex literal shell calls extracted | 33,746 |
| Codex nonliteral shell command expressions (not in denominator) | 155 |
| Codex nonliteral tool argument objects (not in denominator) | 1 |
| Codex argv-array calls not extracted | 0 |
| Codex polling calls (not new commands) | 4,998 |
| Codex nonempty stdin writes (not new commands) | 53 |
| Codex result wrappers with ambiguous pairing | 1,919 |
| Lexical-uncertainty commands | 27 |
| Commands with no parsed invocation | 0 |
| Invocations of unknown/custom executables | 22,689 |
| Commands explicitly backgrounded / yielded | 6,242 |

### Exclusive classification

| Class | Intent | Commands | Command share | Invocations | Invocation share | Timed commands | Observed timed hours | Share of observed timed wall |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A | Read-only files / inspection | 25,449 | 24.41% | 298,729 | 61.54% | 9,345 | 0.082 | 6.02% |
| B | Writes / cwd | 22,709 | 21.78% | 78,543 | 16.18% | 925 | 0.015 | 1.07% |
| C | Processes / runtime / unknown | 24,769 | 23.75% | 69,606 | 14.34% | 6,974 | 0.825 | 60.22% |
| D | Network / transport / install | 6,784 | 6.51% | 19,623 | 4.04% | 428 | 0.133 | 9.73% |
| E | Shell state / expansion / control | 24,565 | 23.56% | 18,945 | 3.90% | 1,664 | 0.314 | 22.96% |

E is not independent of A–D. The following disjoint decomposition shows the highest underlying non-shell requirement for E commands. A shell-only assignment has an A underlying requirement but still needs host shell semantics.

| E underlying requirement | Commands | Share of E |
| --- | --- | --- |
| A | 1,964 | 8.00% |
| B | 3,914 | 15.93% |
| C | 14,165 | 57.66% |
| D | 4,522 | 18.41% |

### Overlapping shell and routing features

| Feature | Commands | Share |
| --- | --- | --- |
| Pipelines | 56,341 | 54.03% |
| && / || chains | 38,429 | 36.85% |
| Groups / subshell syntax | 2,408 | 2.31% |
| Heredocs | 19,755 | 18.94% |
| Assignment prefix / assignment action | 10,899 | 10.45% |
| Variable expansion | 19,218 | 18.43% |
| Command substitution | 4,264 | 4.09% |
| Loops / branches / functions | 8,830 | 8.47% |
| Process substitution | 158 | 0.15% |
| Globbing | 12,236 | 11.73% |
| Explicit cd | 43,590 | 41.80% |
| Codex cwd/workdir metadata | 17,421 | 16.71% |
| Output / read-write redirection | 33,310 | 31.94% |
| Opaque shell script launcher | 1,487 | 1.43% |
| Process-control / privilege wrapper | 1,781 | 1.71% |
| Complex / uncertain shell | 11,246 | 10.78% |

The host can implement literal argv/env/cwd, ordered lists, `&&`/`||` short-circuiting, exit propagation and bounded byte pipelines without guest fork/exec. Pipelines need streaming/backpressure or bounded spooling with equivalent status/EOF behavior. Variables and command substitutions need an actual expansion interpreter; loops/functions, globbing, process substitutions, traps, interactive jobs and opaque scripts are progressively harder. Executing an untrusted script in a privileged host shell is not the proposed solution. Host orchestration means a reviewed parser/interpreter driving isolated tool invocations; Stage 1 mutations additionally need transactional shared run state and explicit commit/reset semantics.

### Routing scenarios by complete submitted command

| Scenario | Conservative syntax subset: commands / share | Broader shell interpreter: commands / share | Timed subset: eligible wall share |
| --- | --- | --- | --- |
| Read-only potential on current capability class | 26,285 / 25.21% | 26,824 / 25.72% | 6.07% |
| Stage 1 + writes/cwd, compatible tool artifacts | 49,684 / 47.65% | 51,446 / 49.34% | 7.29% |
| Stage 2 + bounded offline Node, compatible artifacts | 51,810 / 49.69% | 53,795 / 51.59% | 12.17% |

Conservative scenarios reject complex/uncertain shell logic, opaque scripts, nontrivial process wrappers, shell background jobs, yielded commands and opaque dispatch. They allow simple variables/assignments/substitutions only as host-interpreter work and require every parsed underlying invocation to fit. Broader scenarios additionally assume host support for complex shell syntax but still reject opaque E invocations, C/D dependencies and yielded jobs; this is sensitivity analysis, not an implementable upper guarantee. Stage 2 admits only direct Node invocations without recognizable child-process/network use; unknown script behavior makes even that increment conditional. Cwd supplied as tool metadata is assumed to be host-resolved to admitted paths for the read-only scenario; explicit `cd` is B.

**Cwd sensitivity:** resolving explicit `cd` as host metadata, without adding file writes, makes **45,767 commands (43.89%)** read-only routing candidates. This accounts for **18.68 percentage points** of the nominal Stage 1 uplift. The remaining Stage 1 increment is **3.76 points** under that assumption. Threads/signals alone do not justify a higher command-share claim; the forecast Node increment is **2.04 points** and assumes eventual offline Node compatibility.

Invocation-level A potential is **61.54%**; A+B is **77.72%**. Those larger shares are opportunities to split mixed commands, not shares of whole shell calls that can be moved unchanged. Command wall time cannot defensibly be divided among pipeline stages without process-level telemetry.

## Top programs

Top 50 allowlisted public program names by syntactic invocation count. Wrapper names are peeled rather than double-counted; shell launchers with literal bodies are represented by their children. Private/custom executable names are never printed. Class columns show argument-sensitive invocation counts.

| Rank | Program | Invocations | Share of all invocations | A | B | C | D | E |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | head | 57,916 | 11.93% | 57,850 | 66 | 0 | 0 | 0 |
| 2 | grep | 57,253 | 11.79% | 57,169 | 84 | 0 | 0 | 0 |
| 3 | cd | 47,017 | 9.69% | 0 | 47,017 | 0 | 0 | 0 |
| 4 | sed | 45,163 | 9.30% | 42,361 | 2,802 | 0 | 0 | 0 |
| 5 | cat | 37,150 | 7.65% | 25,840 | 11,310 | 0 | 0 | 0 |
| 6 | echo | 20,632 | 4.25% | 19,591 | 1,041 | 0 | 0 | 0 |
| 7 | git | 18,860 | 3.89% | 13,720 | 4,302 | 301 | 537 | 0 |
| 8 | tail | 17,374 | 3.58% | 17,348 | 26 | 0 | 0 | 0 |
| 9 | python | 17,120 | 3.53% | 0 | 0 | 16,942 | 178 | 0 |
| 10 | rg | 14,107 | 2.91% | 14,081 | 26 | 0 | 0 | 0 |
| 11 | gh | 13,442 | 2.77% | 0 | 0 | 0 | 13,442 | 0 |
| 12 | ls | 13,392 | 2.76% | 13,392 | 0 | 0 | 0 | 0 |
| 13 | node | 6,413 | 1.32% | 0 | 0 | 6,409 | 4 | 0 |
| 14 | cut | 6,275 | 1.29% | 6,247 | 28 | 0 | 0 | 0 |
| 15 | wc | 6,155 | 1.27% | 6,155 | 0 | 0 | 0 | 0 |
| 16 | date | 5,555 | 1.14% | 5,263 | 292 | 0 | 0 | 0 |
| 17 | curl | 4,298 | 0.89% | 0 | 0 | 0 | 4,298 | 0 |
| 18 | go | 3,868 | 0.80% | 0 | 0 | 3,846 | 22 | 0 |
| 19 | sort | 3,473 | 0.72% | 3,341 | 132 | 0 | 0 | 0 |
| 20 | mkdir | 3,472 | 0.72% | 0 | 3,472 | 0 | 0 | 0 |
| 21 | source | 3,322 | 0.68% | 0 | 0 | 0 | 0 | 3,322 |
| 22 | vitest | 3,268 | 0.67% | 0 | 0 | 3,268 | 0 | 0 |
| 23 | awk | 2,868 | 0.59% | 2,744 | 117 | 7 | 0 | 0 |
| 24 | rm | 2,338 | 0.48% | 0 | 2,338 | 0 | 0 | 0 |
| 25 | export | 2,265 | 0.47% | 0 | 0 | 0 | 0 | 2,265 |
| 26 | sleep | 2,202 | 0.45% | 0 | 0 | 2,202 | 0 | 0 |
| 27 | docker | 2,109 | 0.43% | 0 | 0 | 2,109 | 0 | 0 |
| 28 | cp | 2,003 | 0.41% | 0 | 2,003 | 0 | 0 | 0 |
| 29 | bun | 1,971 | 0.41% | 0 | 0 | 1,950 | 21 | 0 |
| 30 | base64 | 1,962 | 0.40% | 1,794 | 168 | 0 | 0 | 0 |
| 31 | tr | 1,742 | 0.36% | 1,722 | 20 | 0 | 0 | 0 |
| 32 | find | 1,564 | 0.32% | 1,464 | 26 | 74 | 0 | 0 |
| 33 | jq | 1,473 | 0.30% | 1,403 | 70 | 0 | 0 | 0 |
| 34 | ps | 1,432 | 0.29% | 0 | 0 | 1,432 | 0 | 0 |
| 35 | make | 1,353 | 0.28% | 0 | 0 | 1,353 | 0 | 0 |
| 36 | du | 1,201 | 0.25% | 1,200 | 1 | 0 | 0 | 0 |
| 37 | printf | 1,187 | 0.24% | 521 | 666 | 0 | 0 | 0 |
| 38 | npm | 1,072 | 0.22% | 0 | 0 | 837 | 235 | 0 |
| 39 | sh | 1,070 | 0.22% | 0 | 0 | 0 | 0 | 1,070 |
| 40 | uniq | 979 | 0.20% | 978 | 1 | 0 | 0 | 0 |
| 41 | perl | 958 | 0.20% | 0 | 0 | 957 | 1 | 0 |
| 42 | df | 957 | 0.20% | 0 | 0 | 957 | 0 | 0 |
| 43 | [ | 929 | 0.19% | 929 | 0 | 0 | 0 | 0 |
| 44 | chmod | 850 | 0.18% | 0 | 850 | 0 | 0 | 0 |
| 45 | pnpm | 768 | 0.16% | 0 | 0 | 658 | 110 | 0 |
| 46 | npx | 695 | 0.14% | 0 | 0 | 695 | 0 | 0 |
| 47 | xargs | 664 | 0.14% | 0 | 0 | 664 | 0 | 0 |
| 48 | bash | 578 | 0.12% | 0 | 0 | 0 | 0 | 578 |
| 49 | cargo | 554 | 0.11% | 0 | 0 | 550 | 4 | 0 |
| 50 | eval | 547 | 0.11% | 0 | 0 | 0 | 0 | 547 |

The suppressed executable/shell-action aggregate contains **31,390 invocations (6.47%)**. Its count is separate from the top 50 public programs; no private filename is promoted into a tool label.

## Session profile

Shell observation length is the first extracted shell-call timestamp to the latest paired result or call in the same trace, not the full conversation lifetime. Adjacent start gaps include command execution and are not thinking time. Non-shell gaps are the complement of the union of synchronous call→result envelopes, avoiding double-counting overlapping parallel commands. Those gaps can contain model reasoning, user absence, non-shell tool work, orchestration, disconnected periods and missing data.

| Metric | N | p10 | p50 | p90 | p99 |
| --- | --- | --- | --- | --- | --- |
| Commands per command-bearing session | 2,031 | 6.00 | 35.00 | 113.00 | 265.10 |
| Shell observation span (minutes) | 2,031 | 1.43 | 11.30 | 43.66 | 1322.27 |
| Adjacent command-start gap (seconds) | 102,245 | 1.97 | 8.51 | 47.29 | 508.37 |
| Observed non-shell gap (seconds) | 87,534 | 2.70 | 7.21 | 44.97 | 568.83 |
| Numeric synchronous command wall (seconds) | 19,336 | 0.00 | 0.00 | 0.65 | 4.53 |

| Session cohort | Sessions | Observed span (hours) | Shell envelope (hours) | Residual non-shell share |
| --- | --- | --- | --- | --- |
| All timestamped sessions (incomplete pairing can inflate residual) | 2,031 | 2609.70 | 165.98 | 93.64% |
| Fully paired, synchronous, ≥2 commands | 1,136 | 470.27 | 45.45 | 90.33% |

| Source | Sessions | Median commands | p90 commands | Median span (min) | Complete paired synchronous sessions |
| --- | --- | --- | --- | --- | --- |
| claude | 1,352 | 31.0 | 117.0 | 7.89 | 1,076 |
| codex | 679 | 40.0 | 100.4 | 14.69 | 60 |

### Idle-gap sensitivity

Charging every long pause to a session VM exaggerates what an idle timeout would actually pay. This table caps each individual non-shell gap; shell envelopes stay charged. It is an occupancy sensitivity model over fully paired synchronous sessions, not a billing reconstruction.

| Maximum charged non-shell gap | Charged residual (hours) | Residual share of charged residency | Residency / shell-envelope ratio |
| --- | --- | --- | --- |
| 30 seconds | 91.99 | 66.93% | 3.02× |
| 60 seconds | 106.94 | 70.17% | 3.35× |
| 5 minutes | 135.74 | 74.91% | 3.99× |
| 30 minutes | 167.25 | 78.63% | 4.68× |
| No idle timeout | 424.82 | 90.33% | 10.35× |

### Timing coverage and interpretation

| Source | Numeric timed commands | Coverage within source | Numeric timed hours | Non-background paired call→result commands |
| --- | --- | --- | --- | --- |
| claude | 0 | 0.00% | 0.000 | 69,384 |
| codex | 19,336 | 57.30% | 1.369 | 22,717 |

Numeric time is a completed synchronous tool’s reported wall time, not CPU time or measured guest execution. Yielded tool waits/polls are excluded from numeric shares: a poll wall time is a wait segment and cannot be treated as total process runtime. This preferentially removes long-running commands, so the observed time shares are especially unsuitable as population compute shares. Claude’s paired timestamps supply shell-call envelopes when numeric durations are absent; those envelopes include harness/queue delays and are not silently substituted for measured durations. Result pairing is accepted only for equal-count, ordered shell/poll/result objects; ambiguous wrappers retain count classification but lose numeric timing. Successful/failing exit statuses do not change a command’s intent category.

## Implications

**The actionable count target is 25.21% read-only routing potential, expanding to 47.65% with Stage 1 and 49.69% with conditional offline Node. None is a claim that those commands run in today’s µs VM.** The existing native evidence has nine tiny passing profiles (musl jq; Lua; MicroPython; BusyBox sed/awk/grep/sort/wc/tar-list). It explicitly leaves general Git, ripgrep, SQLite, binary/Unicode streams, stderr/exit transport, arbitrary paths, writable files, threads and larger ELF loading unproven or unsupported. Most top read-only tools therefore require artifact qualification and syscall/transport work before admission. Literal unchanged whole-shell success today cannot be estimated from program names alone; no transcript commands were replayed.

### Ten tool priorities

Priorities combine observed frequency with the native census’s cost/risk evidence. Each needs a pinned static aarch64 artifact, semantic/negative/reset tests and an explicit argument/resource profile. Counts below are total observed invocations, not qualified eligible traffic.

| Priority | Tool / shape | Observed invocations | Initial support contract / reason |
| --- | --- | --- | --- |
| 1 | rg | 14,107 | `rg --no-config --no-ignore --no-mmap -j1`: search leverage; grow ELF layout, metadata, signals and memory protection first. |
| 2 | sed | 45,163 | `sed -n`: BusyBox read-only stream baseline; separate in-place writes for Stage 1. |
| 3 | cat | 37,150 | `cat`: bounded file/byte reads; simple artifact qualification, useful for host-fed streams. |
| 4 | git | 18,860 | `git status/log/diff/show`: high-value but isolated read-only profiles; disable hooks/helpers/pagers/config surprises; full Git stays Linux. |
| 5 | ls | 13,392 | `ls`: bounded directory metadata/enumeration; qualify BusyBox/static build and deterministic flag support. |
| 6 | head | 57,916 | `head -n`: bounded prefix reads and byte-stream behavior; qualify static applet. |
| 7 | grep | 57,253 | `grep -n`: already demonstrated BusyBox family; preserve exact regex/flag differences. |
| 8 | find | 1,564 | `find`: read-only predicates first; exclude `-exec`/`-delete` and external helpers. |
| 9 | wc | 6,155 | `wc -l`: already demonstrated BusyBox profile, tiny composition building block. |
| 10 | jq | 1,473 | `jq`: demonstrated unchanged musl profile; richer JSON operations, with bytes/errors/entropy work. |

BusyBox is one shared implementation opportunity, not independent kernel work per applet. Add immutable SQLite after `fstat`/`pread64` even if it is outside the top ten by current usage; Stage 1’s structured-data product can create new usage absent from this history. `sort`/`awk` are cheap supplementary existing-profile candidates. Stage 1 file mutations are not automatically cheap Git support: `git add/commit` can require locks, atomic rename, config, hooks, signing and subprocesses.

### Economics of one VM per command

Let N be shell commands, p the fraction routed to the small tier, s admission+restore+reset+filesystem/transport overhead per admitted command, r its execution time, M unique memory, and T the session residency a competing VM charges. Small-tier memory-time is approximately `N × p × M × (r+s)` plus warm pool/snapshot/cache overhead; a session VM costs `M_session × T` plus work. CPU, host orchestration, shared page cache, workspace synchronization, storage writes and fallback capacity must also be charged. The fractions above estimate p by count; the timed column estimates a biased observed slice, not total compute savings.

For the fully paired synchronous cohort, keeping a VM resident through every recorded pause yields a **10.35×** residency-to-shell-envelope ratio at equal memory. The capped-gap table shows how rapidly suspend/idle-timeout policy reduces that apparent advantage. A warm snapshot pool or suspended session with near-zero charged resources changes the comparison; one-per-command still pays N restores, parsing and mounts.

Illustrative overhead assumptions, not measurements: 100 µs of extra lifecycle overhead is 0.1% of a 100 ms tool and 10% of a 1 ms tool; 1 ms overhead is 1% and 100% respectively. For a 10-invocation compound, host splitting can multiply lifecycle admissions by ten. Prefer bounded compound execution plans and shared read-only mappings, and measure total result latency/dirty pages/private MiB on real eligible tools. The kernel’s initialized-JavaScript µs reset figures must not be reused as native CLI cold-start measurements.

The strongest supported thesis is a cheap disposable inspection/write tier alongside a full Linux fallback, with host-owned session state and explicit mutation commit semantics. The current count coverage does not justify replacing Linux build/test/network workloads or funding broad Node compatibility by itself. Stage 2 threads/futex/signals do not supply fork/exec, dynamic loading, npm’s subprocess graph, networking or all Node/V8 memory semantics. Any broader Stage 2 command-share claim needs additional gates and replay evidence.

## Limitations

- One user’s sessions are a convenience sample with correlated projects, assistants, worktrees, forks and historical tool habits; no population-level market inference or confidence interval is justified.
- This is a lightweight lexical census, not a full Bash/zsh grammar or symbolic execution engine. Shell quoting, nested expansion, shell options, aliases, functions, unusual heredocs, arrays, arithmetic and language embedding can be ambiguous. Complex/uncertain cases are excluded from conservative routing. Invocation counts are syntactic; actual loop iterations/children are unknown.
- Flags/known subcommands establish resource intent imperfectly. Workload size, cache/config writes, implicit Git index refresh, credential lookup, hidden network, dynamic plugins, subprocesses and platform-specific flags can invalidate admission. Runtime/script bodies are not executed or exhaustively analyzed.
- Unresolved JavaScript-generated shell strings, opaque dispatch, typed interactive commands and missing/corrupt records reduce extraction coverage. Denominators are explicitly the extracted unique submissions, not every possible shell process. No transcript command was replayed to verify correctness.
- The local transcript stores are live and were read without locking or copying them. This is a scan-time observation, not an atomic frozen corpus; concurrent append/new-session activity can change exact counts on a later rerun.
- Time shares cover only unambiguous numeric synchronous observations. Missing durations, tool delivery latency, parallel/background work, truncation and replay/deduplication affect timing and session boundaries. Non-shell time cannot be equated to model thought; session trace files do not map one-to-one to billable VMs.
- Read-only A is not a literal “runs today” label: the required native binaries, auxv, ELF layout, stdout/stderr/exit bytes, filesystem semantics and static tool profiles must be admitted and tested. Existing native results are tiny functional fixtures, not general tool certification or latency/density benchmarks.
- Scratch semantics alone do not persist workspace changes between fresh VMs. A host-managed filesystem commit layer and cwd/env state must preserve the user-visible command contract without executing untrusted shell logic with host privileges.
- No network, builds, Docker, VMs, external uploads, modifications to pre-existing files or transcript mutations were used. The only new artifacts from this census are this report and its optional analysis script.
