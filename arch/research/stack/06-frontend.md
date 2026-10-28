# 06 — Frontend: the browser is the missing witness

Research round 10. **2026-10-28.** Lens: Foldkit, Elm, XState/Stately, Effect, frontend frameworks, design systems, browser behavior, and self-extension.

Labels: **F** = sourced fact; **M** = measured in this research; **I** = inference; **E** = estimate or proposed acceptance threshold. All external sources were checked on 2026-10-28 unless a publication date is stated. Issue reports are reports, not independently reproduced incidents, except where explicitly marked M.

## Verdict

**I — Replace the broad production Message/Command replay pitch as the ONE pick.** Its useful parts survive as an upstream contribution, but the premise that this is an unoccupied effects-as-values category does not survive research. Foldkit has the exact session-to-Story request, Redux DevTools generates tests, Redux-Saga already exposes causal effect monitoring, and Stately now has behavioral machine diffs and agent-edit review. A Command descriptor also does not describe everything its Effect will do.

**I — My pick is a small, shared corpus of browser handoff tests:** can a person type, select, and focus a server-rendered control before JavaScript takes ownership, and have the application adopt that interaction correctly? Check real DOM state, application-visible behavior, focus/selection, and outbound actions across the handoff. Begin with Foldkit and React, then add Svelte and Solid. This is a public acceptance corpus and thin Playwright fixture package, not another browser runner or frontend framework. The gap is provisional and deserves a two-day kill test before a two-week build.

**I — The strongest finding is a boundary:** explicit application architecture makes some regressions cheap to check, but the model is not the browser. At that boundary, increasing the number of agent-written Story tests can increase confidence without increasing coverage of the actual failure.

## 1. What changed, and how much demand is real?

### Numbers and observable changes

- **F — Agent code volume is a real pressure in this ecosystem.** Effect's September 7 report describes **207 PRs in three days**, originating in an OpenCode Queue bug and followed by agent investigations and maintainer review. This is evidence of an agent-heavy library workflow, not a measured frontend productivity gain. [Effect, “Astra vs. The Boys”](https://effect.website/blog/astra-vs-the-boys).
- **F — An actual team changed its default.** XO Research says it moved all TypeScript work to Effect and explicitly attributes the choice to developing ordinary software with coding agents. It describes scrapping agent implementations after an early wrong decision and calls out tests that merely confirm the agent's own implementation. This is a June 22, 2026 practitioner account, without a controlled comparison or adoption denominator. [XO Research](https://xoresearch.org/blog/effect-for-agentic-development).
- **F — Established design-system owners are adapting to agent authors.** Atlassian's June 2 report gives **34% faster tasks, 26% fewer tool calls, 16% fewer tokens, and 4.9% more accurate code** against agents without its MCP context. Its separate “up to 52%” figure concerns specific queries, not overall code accuracy. The source describes internal evaluations, not an independent benchmark. [Atlassian](https://www.atlassian.com/blog/ai-at-work/teaching-ai-to-speak-our-design-language).
- **F — Foldkit's live repository had 1,064 stars and 57 forks**, with `packages/foldkit/package.json` at **0.169.0**. The published package targets Effect 4.0.0. Inspected source revision: `b702a5efbb74bebc056b798b414ddb923a82fbd5`, fetched on October 28. This is beyond the “Effect v4 beta” snapshot in older posts. [Repository metadata](https://api.github.com/repos/foldkit/foldkit), [pinned package](https://github.com/foldkit/foldkit/blob/b702a5efbb74bebc056b798b414ddb923a82fbd5/packages/foldkit/package.json).
- **F — npm's explicit October 20–26 window reported 36,803 downloads for `foldkit` and 43,527,191 for `effect`.** Downloads include CI and transitive installations; these are not developer or team counts, and Effect downloads do not measure frontend adoption. [Foldkit API](https://api.npmjs.org/downloads/point/2026-10-20:2026-10-26/foldkit), [Effect API](https://api.npmjs.org/downloads/point/2026-10-20:2026-10-26/effect).
- **F — There is some public attention, not a runaway demand signal.** The July 24 Foldkit HN submission had **94 points and 49 comments**. Comments include interest in an agent-driven full-stack/state-machine workflow, and objections about ergonomics and documentation. These are expressed preferences, not production migrations. [Discussion](https://news.ycombinator.com/item?id=49037031), [Algolia item](https://hn.algolia.com/api/v1/items/49037031).

### Demand for Foldkit specifically

**F — The most concrete request is already our candidate.** [Foldkit #622](https://github.com/foldkit/foldkit/issues/622), opened July 4, asks for captured sessions lowered into Story tests. Its author says a production application would use it immediately. It has one positive reaction and three comments. [#615](https://github.com/foldkit/foldkit/issues/615), by the same author on the same day, describes a production task-management application rebuilding keyboard-shortcut machinery. These are two requests from one reported application, not evidence of two independent teams.

**F — A second commenter on #622 describes finding difficult bugs in Playwright and friction closing the loop with Story/Scene.** The maintainer's September 5 comments relay Mattia Manzati's “Copy to Story” request and outline bounded recording, user-authored intent, and explicit gaps in inferred correlation. Those comments are disclosed as AI-generated and posted at the user's request. They establish upstream interest; they should not be counted as unsolicited independent customer testimonials. [Comment thread](https://github.com/foldkit/foldkit/issues/622#issuecomment-5123169529), [maintainer scope](https://github.com/foldkit/foldkit/issues/622#issuecomment-5553720734).

**F — There is inspectable application code.** Effect-TS/slopcop's web package depends on Foldkit, its UI/DevTools, and Effect. Foldkit's own site and typing game provide additional examples, but framework-owned applications are not independent adoption. [Slopcop package](https://github.com/Effect-TS/slopcop/blob/main/apps/web/package.json), [Foldkit roadmap](https://foldkit.dev/roadmap).

**F — Effect adoption does not require replacing React.** T3 Code's public web package uses React, `@effect/atom-react`, and Effect together, alongside existing React component and editor libraries. That is a concrete alternative for an agent-heavy product. [T3 Code package](https://github.com/pingdotgg/t3code/blob/main/apps/web/package.json).

**I — Answer:** demand for Effect's explicit errors, services, and lifecycle management among agent-heavy teams is supported. Demand for Foldkit is credible but small and not quantified by team count. I found no controlled evidence that Foldkit yields fewer escaped UI defects or better agent throughput than React + Effect Atom, Solid, or Svelte. The framework's architectural rationale is plausible; the productivity superiority claim remains unproved. Requiring a framework migration to buy a testing benefit would substantially weaken a side project.

## 2. Foldkit, studied below the slogan

The following implementation facts refer to the pinned revision above. Source paths are linked so future changes can be distinguished from this audit.

### Model, update, and the actual effect boundary

**F — Foldkit implements a Model/Message/update/view architecture with multiple outside-work boundaries.** Commands describe one-shot work; Subscriptions describe external event streams; Mounts bind imperative work to an element; ManagedResources describe state-dependent handles. A production trace limited to Commands misses the other sources of Messages and lifecycle work. [Runtime](https://github.com/foldkit/foldkit/blob/b702a5efbb74bebc056b798b414ddb923a82fbd5/packages/foldkit/src/runtime/runtime.ts), [architecture docs](https://foldkit.dev/ai/overview).

**F — A Command is a named Effect with optional arguments and an interruption key.** The object contains executable Effect data, not a closed algebra of primitive I/O instructions. `Command.define` defers the argument-taking execute body with `Effect.suspend`, which prevents that body from running while update constructs the Command. It does not make the Effect body fully inspectable as JSON. [Command implementation](https://github.com/foldkit/foldkit/blob/b702a5efbb74bebc056b798b414ddb923a82fbd5/packages/foldkit/src/command/index.ts).

**F — Commands in one batch run concurrently; array position is not an execution-order guarantee.** The source explicitly warns that an interrupt Command and its replacement in one batch race. Replacing an array comparison with a set comparison is also wrong: it would lose duplicate invocations. A meaningful comparison needs multiplicity, arguments, ownership, and causal ordering where ordering exists. [Command interruption contract](https://github.com/foldkit/foldkit/blob/b702a5efbb74bebc056b798b414ddb923a82fbd5/packages/foldkit/src/command/index.ts).

**I — Effect is useful as a controllable execution boundary, not an automatic behavioral specification.** `Effect<A,E,R>` exposes success, expected errors, and service requirements. It does not, by itself, enumerate every HTTP write hidden in a service, enforce purity of arbitrary TypeScript callbacks, or tell a checker which UI change a human intended.

### Story: strong assertions, deliberately simulated results

**F — Story calls the real update function but does not execute Command Effects.** Tests supply result Messages through `Command.resolve`. Definition matchers compare names; instance matchers include arguments. `expectExact` is order-independent and preserves multiplicity. `resolveAllExact` requires that every supplied resolver be used and every actual Command be resolved. Child Message mapping metadata lets a root test supply a child result without rebuilding its parent wrappers. [Story implementation](https://github.com/foldkit/foldkit/blob/b702a5efbb74bebc056b798b414ddb923a82fbd5/packages/foldkit/src/test/story.ts), [shared match/resolution logic](https://github.com/foldkit/foldkit/blob/b702a5efbb74bebc056b798b414ddb923a82fbd5/packages/foldkit/src/test/internal.ts).

**F — Story rejects a new `message(...)` while previous Commands are pending, and rejects unresolved Commands at the end.** That makes an ordinary test explicit and easy to read. It also means an arbitrary production schedule, such as “start save; edit while save is pending; receive save result,” cannot be translated literally into today's standard Story steps. Draining the save before the edit changes the schedule being tested. [Story documentation](https://foldkit.dev/testing/story).

**F — The repository already demonstrates the distinction.** Weather's Story tests substitute success/failure Messages, while separate tests execute the Effect against an `HttpClient` Layer. Scene tests drive the weather view but still supply the Command result. Calling this “no mocks” without specifying the boundary is misleading: no mocking framework is needed, but outcomes are substituted. [Weather Story](https://github.com/foldkit/foldkit/blob/b702a5efbb74bebc056b798b414ddb923a82fbd5/examples/weather/src/story.test.ts), [Weather Scene](https://github.com/foldkit/foldkit/blob/b702a5efbb74bebc056b798b414ddb923a82fbd5/examples/weather/src/scene.test.ts).

**F — The effect-body blind spot is already recognized upstream.** [#1302](https://github.com/foldkit/foldkit/issues/1302), September 4, proposes live Story/Scene mode with real resources, Commands, Subscriptions, and TestClock. Its motivating tooltip example can have an inverted PubSub filter while both simulated suites stay green. The proposal deliberately excludes real-layout Mount execution. This kills “add a mode that runs the real Effect with test services” as a novel project.

### Scene: useful view checking, not a second browser

**F — Scene evaluates real view/update functions over VNodes.** It supports semantic locators, interaction handlers, Command and Mount assertions, and supplied Subscription/ManagedResource results. It does not start a browser or run the Effects. Its visibility and accessibility-name checks operate on the rendered representation. Browser layout, native focus/default actions, hydration timing, CSS occlusion, and assistive-technology announcements require a different witness. [Scene docs](https://foldkit.dev/testing/scene), [implementation](https://github.com/foldkit/foldkit/blob/b702a5efbb74bebc056b798b414ddb923a82fbd5/packages/foldkit/src/test/scene.ts).

**F — A concrete simulation/runtime disagreement has been reported.** [#1497](https://github.com/foldkit/foldkit/issues/1497), September 29, reports Scene expecting a Mount added to an existing element even though the live runtime does not start it. The report includes a runnable reproduction and a Dialog consumer. This research did not rerun that historical reproduction against current main; it is evidence of the failure class, not a claim that the current release reproduces it.

**F — Foldkit already wants an internal scheduling driver.** [#1278](https://github.com/foldkit/foldkit/issues/1278), September 1, requests explicit control over animation frames, View Transition callbacks, Mount completions, Subscription delivery, and time-travel operations. It says one test file exceeds 2,200 lines and explicitly rejects a generic settle helper that silently drains everything. A new deterministic browser scheduler would overlap both upstream and existing testing systems.

### Machine, in depth

**F — Machine is an experimental pure transition-table helper, not a replacement Runtime.** `Machine.define({ state, message, context? })({...})` fixes Schema types before checking the table. The staged definition allows each edge's source state and triggering Message to narrow from its table position. Edges declare literal target tags so the graph can be inspected without calling handlers. Their handlers return the target Model and ordinary Commands. `Machine.fold` integrates that result into an enclosing Model. [Machine guide](https://foldkit.dev/core/machine), [implementation](https://github.com/foldkit/foldkit/blob/b702a5efbb74bebc056b798b414ddb923a82fbd5/packages/foldkit/src/experimental/machine/machine.ts).

**F — Its behavioral semantics are precise but narrower than statecharts.**

- A guarded edge list is evaluated in order. A boolean guard selects or declines; an Option guard can carry a lookup/validation result into the handler.
- `otherwise` and `ignore` terminate selection. An edge after either cannot be selected.
- `step` distinguishes `OutOfAlphabet`, `NotApplicable`, `GuardsFellThrough`, and `ExplicitlyIgnored`; `transition` gives an ordinary update result, including a no-op when no edge applies.
- `forStates(...).on(...)` expands shared defaults. A state-local edge overrides its default; overlapping shared declarations for a source/Message pair throw.
- Optional context is supplied on every transition/fold from current parent state. The implementation says it is neither decoded nor stored nor included in graph analysis.
- Parallel machines are separate Model fields. Nesting a machine state in another variant does not provide inherited edges, automatic forwarding, or hierarchical-statechart semantics.

These facts come from the [guide](https://foldkit.dev/core/machine), [selection/folding code](https://github.com/foldkit/foldkit/blob/b702a5efbb74bebc056b798b414ddb923a82fbd5/packages/foldkit/src/experimental/machine/machine.ts), and tests for [shared edges, context, ignored outcomes, and type-level guarantees](https://github.com/foldkit/foldkit/blob/b702a5efbb74bebc056b798b414ddb923a82fbd5/packages/foldkit/src/experimental/machine/machine.test.ts).

**F — Its analysis is structural.** `edges`, `reachableFrom`, `unreachableStates(extraRoots?)`, `deadTransitions`, and `toMermaid` inspect the declared transition skeleton. External entry states must be listed as extra roots. The graph can identify an unreachable source or a branch shadowed by an unconditional fallback; it does not solve arbitrary TypeScript guards. The tests also explicitly distinguish type-rejected definitions from what can still be constructed at runtime. [Source](https://github.com/foldkit/foldkit/blob/b702a5efbb74bebc056b798b414ddb923a82fbd5/packages/foldkit/src/experimental/machine/machine.ts).

**M — A machine with an always-false guard to `Complete` returned no unreachable states and no dead transitions, but its attempted transition returned `Ignored/GuardsFellThrough`.** This is consistent with the documented scope. A green graph check is not evidence that a guarded business outcome is reachable.

**I — Where Machine helps agent authors:** legal moves are visible together, narrowing makes wrong source/target combinations expensive to express, and reviewers can inspect a stable graph. Where rigor must be added: externally owned invariants, actual edge witnesses, effect execution, and browser tests. Generating tests from the same agent-generated machine only checks agreement with that machine unless a separate implementation or independent property is supplied. Building a graph linter or path generator around it is principally an adapter to an already occupied category.

### DevTools: capture data exists, a portable causal log does not yet follow

**F — Runtime Command invocations get numeric IDs internally.** `recordCommandResult(id, message)` extracts only the result's Submodel path and records it on the invocation. The history entry has the Message, Commands, Mount starts/ends, timestamp, and diff; it has no explicit completion-origin ID. Serialized Commands omit the internal ID and expose name, inspectable args, and optional Submodel path. Thus two overlapping identical Commands cannot generally be correlated with their completions from the public serialized history alone. [Runtime instrumentation](https://github.com/foldkit/foldkit/blob/b702a5efbb74bebc056b798b414ddb923a82fbd5/packages/foldkit/src/runtime/devToolsIntegration.ts), [store types](https://github.com/foldkit/foldkit/blob/b702a5efbb74bebc056b798b414ddb923a82fbd5/packages/foldkit/src/devTools/store.ts), [wire serialization](https://github.com/foldkit/foldkit/blob/b702a5efbb74bebc056b798b414ddb923a82fbd5/packages/foldkit/src/devTools/serialize.ts).

**F — Inspectable is not round-trippable.** Serialization turns Redacted values into placeholders and File/Blob instances into metadata. History defaults to 100 Messages, is capped at 500, and may intentionally exclude Message tags. Keyframes let inspection reconstruct states even when excluded inputs prevent faithful event replay. Time travel presents a historical view while the live application and its work continue; it is not rollback of production effects. [DevTools docs](https://foldkit.dev/core/devtools), [serializer](https://github.com/foldkit/foldkit/blob/b702a5efbb74bebc056b798b414ddb923a82fbd5/packages/foldkit/src/devTools/serialize.ts).

**I — Consequence:** a complete, decodable, bounded capture with explicit event origins is a real engineering task. “DevTools already records everything” overstates what the current public protocol supports. This is a useful upstream bug/feature brief, not proof of a new category.

## 3. Attack on production Messages-in / Commands-out replay

### Closest prior art, including the inconvenient examples

| Prior art | What is already there [F] | Remaining distinction [I] |
| --- | --- | --- |
| [Elm architecture](https://guide.elm-lang.org/architecture/) and [Elm browser history encoding](https://github.com/elm/browser/blob/1.0.2/src/Debugger/History.elm) | Model/update/view and export/import of Message history; reconstruction folds Messages through update. | A Message log does not reveal arbitrary Command internals. Elm's opaque Cmd and Foldkit's named wrapper are different inspection surfaces. |
| [elm-program-test](https://github.com/avh4/elm-program-test) | Whole-program view/update tests, simulated effects, HTTP and port testing. | No evidence here of a turnkey Foldkit production-capture adapter; the testing approach is established. |
| [Redux DevTools](https://github.com/reduxjs/redux-devtools) and its [Test Generator](https://github.com/reduxjs/redux-devtools/tree/main/packages/redux-devtools-inspector-monitor-test-tab) | Action replay, hot reloading, import/export, and tests generated from action/previous-state/current-state history. | Plain Redux reducers return state, so effect comparison needs middleware/application instrumentation. Test promotion is not the gap. |
| [Redux-Saga monitor](https://redux-saga.js.org/docs/api/#sagamonitor) and [effect testing](https://redux-saga.js.org/docs/advanced/Testing/) | Effect IDs, parent IDs, completion/failure/cancellation hooks, interception, recording yielded CALL/PUT effects, and assertions over effects. | Not a verified ready-made Foldkit PR gate; nevertheless, “effects-as-values plus record/compare” has direct technical prior art. |
| [XState pure transitions](https://stately.ai/docs/pure-transitions) | Computes next state and selected actions without executing side effects. | A second framework already supplies the proposed pure comparison boundary. |
| [Stately model-based testing](https://stately.ai/docs/xstate/v6/model-based-testing) | Current v6 alpha docs describe generated paths, independently connected systems under test, saved/replayed failure fixtures, and generated invoked-actor outcomes. | Alpha maturity must be distinguished from established versions. This kills a new generic state-machine test generator. |
| [Stately MCP](https://stately.ai/docs/packages/mcp) | Structural/semantic machine diffs, simulation traces, and review of edited machines against proposed behavioral patches. Verification can consume a baseline report but requires a host execution adapter. | It is not universal production I/O equivalence; lack of a Foldkit adapter is an integration gap, not an empty market. |
| [Replay.io rerecording](https://replay.io/blog/rerecording), 2024-11-26 | Replays recorded interactions on a changed frontend/preview PR, supplies recorded network responses, compares screenshots. It documents failures on changed requests or interaction layouts. | A semantic Command report could be smaller and more domain-specific, but changed-code replay is already a product workflow. |
| [Meticulous](https://www.meticulous.ai/) | Records development/staging and optionally production interactions; tests PRs against recorded backend responses; describes deterministic scheduling. | No product claim verified here about Foldkit Command-level reporting. Do not describe automatic frontend replay or deterministic scheduling as vacant. |
| [rrweb observer design](https://github.com/rrweb-io/rrweb/blob/main/docs/observer.md) | Reconstructs DOM mutations and interactions without executing the original application JavaScript. | Watching an old session does not execute candidate update code or validate its effects. |
| [PostHog](https://posthog.com/docs/session-replay/how-to-watch-recordings), [LogRocket](https://docs.logrocket.com/docs/session-replay) | Session reconstruction, events, inspection, network/console context; LogRocket also describes Redux tracking. | Their cited session-viewing docs do not establish a candidate-code Command-diff gate. This is a bounded finding, not a claim that no other feature exists. |
| [Chronicle paper](https://arxiv.org/abs/2609.20625), 2026-09-17 | Selectively executes new code while serving other nondeterministic boundaries from recorded envelopes; six simulated incidents demonstrate the cut-point mechanism. | Adjacent agent-runtime work, not a frontend tool. It directly attacks the error of stubbing away the code one intended to test. The [current repository](https://github.com/theagentplane/chronicle) has since changed its storage/API contract, so the paper's local-fixture interface should not be presented as today's package API. |
| [Foldkit #622](https://github.com/foldkit/foldkit/issues/622), [#1302](https://github.com/foldkit/foldkit/issues/1302) | Exact session-to-Story proposal and a live-effects test-mode proposal, both open when checked. | The useful work is causal capture, fidelity reporting, and integration with these requests. Upstream owns the natural distribution. |

### What the proposed gate can actually assert

**I — Valid claim:** “For this recorded input prefix, candidate update emits a different declared Command multiset at this causal point.” This can catch new/removed/duplicated Commands and changed parameters. It can be valuable even when ordinary tests remain green.

**I — Invalid stronger claim:** “The PR will email a customer twice” from the wrapper alone. A `PlaceOrder` Effect can hide two email sends, a different endpoint, changed service implementation, or a changed idempotency key without changing its name or argument object. A browser frontend may only request a backend operation; actual email count also depends on backend semantics.

**I — Recorded completions are observations of the old program.** Once candidate code changes the corresponding request, cancels it, or no longer emits it, injecting the old successful result manufactures a counterfactual. Stop at the unsupported causal point, or re-execute a declared code slice against controlled services. Continuing to the end and comparing only Models can produce a comforting answer to an impossible history.

**I — A minimally honest record needs:**

1. An initial seed, flags/URL/context, app/build/schema versions, and an explicit completeness boundary.
2. Environment-origin Messages distinguished from Command completions, Subscription emissions, Mount results, routing events, and other runtime-produced facts.
3. Invocation identity, owner/Submodel identity, occurrence, completion/cancellation relation, and captured ordering within one run. Runtime IDs must not be assumed stable between builds.
4. Candidate replay evolving its own Model, rather than resetting to each recorded old snapshot and hiding an earlier divergence.
5. Comparisons that preserve duplicate counts and declared concurrency. Ignore only narrowly declared volatile fields; never normalize away an idempotency key or payment amount for convenience.
6. A separate boundary-execution mode when changed Command/service code must be checked. No real write endpoints or production credentials are needed for this mode.
7. Outcomes named **same on observed inputs**, **diverged**, or **incomplete/unsupported**. A missing response, excluded Message, unknown codec, or ambiguous completion must not become a green check.
8. A human-owned assertion about intended behavior when promoting a trace. Recording a bug and asserting the recorded wrong result preserves the bug.

**I — It remains gameable.** An agent allowed to edit normalization, fixture selection, adapter behavior, or assertions can remove the evidence. Candidate code can recognize visible fixtures, or put work outside instrumented services. Keep capture/adapter/oracle changes outside the application PR's acceptance authority, retain some unseen sessions, check the instrumentation against a real browser, and treat this as regression evidence rather than semantic proof. No trace collection proves correctness on unseen inputs.

### Verdict on the brief's candidate

**I — Kill the standalone novelty claim; sharpen the contribution.** Build a bounded causal recorder plus a fidelity-aware diff, initially for developer/staging sessions. Export exact, serializable sequential prefixes to Story; retain overlapping schedules as explicit replay fixtures until the test API supports them. Coordinate the design with #622/#1302 rather than ship an unrelated competing DSL. Production capture adds data handling and completeness work and should follow demonstrated demand, not be the premise of v1.

**I — Why it is not my ONE pick:** the concrete user request is real, but upstream has already articulated the delivery, and the independent effect boundary becomes application-specific exactly where the most consequential bugs hide. It is a good contribution-sized backup with a modest novelty score.

## 4. Small experiment: four checks against published Foldkit

**M — Environment:** Node `v26.13.0`; npm-installed `foldkit@0.169.0`, `effect@4.0.0`, `@effect/platform-browser@4.0.0`. No browser, network service, model API, or benchmark timing was involved. The complete scratch directory stayed below 500 MB, about 169 MB when checked, and was removed after preserving the essential reproduction below.

| Probe | Measured result | Consequence [I] |
| --- | --- | --- |
| Two `SaveDraft` definitions with the same name/args, one incrementing a write counter once and one twice | Descriptor comparison equal; both Stories pass with supplied `Saved`; Stories execute zero write-counter increments; executing the Effects yields **1 vs 2**. | Descriptor diff does not cover effect-body edits. |
| `ClickedSave`, then `Edited` before resolving save | Story throws `I found unresolved Commands when you sent a new Message`. | Literal lowering of overlapping user activity is unsupported by the standard step API. |
| Update emits two identical saves where one exact instance is expected | `Command.expectExact` throws. | The existing exact matcher already catches the easy duplicate-wrapper case. |
| Machine's only edge to `Complete` has `when(() => false, ...)` | `unreachableStates() = []`, `deadTransitions() = []`; `step(...)` returns `Ignored/GuardsFellThrough`. | Graph reachability is a useful structural check with a deliberate behavioral limit. |

**M — Essential reproduction** (run as a `.mts` file after the three exact installs above; routine result printing omitted):

```ts
import assert from 'node:assert/strict'
import { Effect, Schema } from 'effect'
import * as Cmd from 'foldkit/command'
import * as Story from 'foldkit/story'
import { Machine } from 'foldkit/experimental'
import { when } from 'foldkit/experimental/machine'
import { defineTaggedUnion } from 'foldkit/schema'
import { defineMessageUnion } from 'foldkit/message'

let writes = 0
const Msg = defineMessageUnion({
  ClickedSave: {}, Edited: { body: Schema.String }, Saved: {},
})
const makeSave = (n: number) => Cmd.define('SaveDraft', {
  args: { body: Schema.String }, messages: [Msg.Saved],
  execute: () => Effect.sync(() => { writes += n; return Msg.Saved() }),
})
const once = makeSave(1), twice = makeSave(2)
type Model = { body: string; saved: boolean }
const makeUpdate = (save: typeof once, duplicate = false) =>
  (model: Model, message: typeof Msg.Type) => {
    switch (message._tag) {
      case 'ClickedSave': return { model, commands: duplicate
        ? [save({body: model.body}), save({body: model.body})]
        : [save({body: model.body})] }
      case 'Edited': return { model: {...model, body: message.body} }
      case 'Saved': return { model: {...model, saved: true} }
    }
  }
const seed = { body: 'old', saved: false }
const a = makeUpdate(once)(seed, Msg.ClickedSave()).commands![0]
const b = makeUpdate(twice)(seed, Msg.ClickedSave()).commands![0]
assert.deepEqual({name: a.name, args: a.args}, {name: b.name, args: b.args})
for (const save of [once, twice]) Story.story(makeUpdate(save),
  Story.given(seed), Story.message(Msg.ClickedSave()),
  Story.Command.resolve(save, Msg.Saved()),
  Story.model(m => assert.equal(m.saved, true)))
assert.equal(writes, 0)
await Effect.runPromise(a.effect); assert.equal(writes, 1)
writes = 0
await Effect.runPromise(b.effect); assert.equal(writes, 2)
assert.throws(() => Story.story(makeUpdate(once), Story.given(seed),
  Story.message(Msg.ClickedSave()), Story.message(Msg.Edited({body:'new'})),
  Story.Command.resolve(once, Msg.Saved())), /unresolved Commands/)
assert.throws(() => Story.story(makeUpdate(once, true), Story.given(seed),
  Story.message(Msg.ClickedSave()),
  Story.Command.expectExact(once({body:'old'})),
  Story.Command.resolve(once, Msg.Saved())))
const State = defineTaggedUnion({Idle:{}, Complete:{}})
const Event = defineMessageUnion({Go:{}})
const machine = Machine.define({state: State, message: Event})({
  initial: State.Idle(), states: {Idle: {on: {
    Go: [when(() => false, 'Complete', () => ({model: State.Complete()}))],
  }}},
})
assert.deepEqual(machine.unreachableStates(), [])
assert.deepEqual(machine.deadTransitions(), [])
assert.equal(machine.step(State.Idle(), Event.Go())._tag, 'Ignored')
```

**I — Limits:** these are counterexamples to overbroad claims, not a measurement of defect prevalence, framework performance, or whether one framework is better. The reproduction uses fake writes solely to expose the observation boundary.

## 5. Sixteen ideas, searched before selection

Every row is an inference about opportunity based on the linked facts. “Killed” means do not pitch the broad idea as a separate project. The three retained rows are conditional experiments, not three verified empty markets.

| # | Idea / old technique that might flip [I] | Closest primary prior art / killer [F] | Decision [I] |
| --- | --- | --- | --- |
| 1 | Production input/effect differential gate for every agent PR | Foldkit [#622](https://github.com/foldkit/foldkit/issues/622), [#1302](https://github.com/foldkit/foldkit/issues/1302), [Redux-Saga](https://redux-saga.js.org/docs/api/#sagamonitor), [Replay.io](https://replay.io/blog/rerecording) | **Keep B, narrowed:** causal capture and honest fidelity, upstream-compatible. |
| 2 | One-click observed session → regression Story | Exact [#622](https://github.com/foldkit/foldkit/issues/622), [Redux Test Generator](https://github.com/reduxjs/redux-devtools/tree/main/packages/redux-devtools-inspector-monitor-test-tab) | Kill standalone; a delivery slice of B. |
| 3 | Live Effect execution inside Story/Scene | Exact [#1302](https://github.com/foldkit/foldkit/issues/1302) with resource Layers and TestClock | Kill standalone; contribute upstream. |
| 4 | Agent-generated machines with graph validation and exhaustive path tests | [Foldkit Machine](https://foldkit.dev/core/machine), [Stately v6 tests](https://stately.ai/docs/xstate/v6/model-based-testing), [MCP review](https://stately.ai/docs/packages/mcp) | Kill generic generator. Independent invariants still matter. |
| 5 | Model-check UI races and automatically shrink failures | [fast-check scheduler/model testing](https://fast-check.dev/docs/advanced/race-conditions/), Stately tests, [Foldkit #1278](https://github.com/foldkit/foldkit/issues/1278) | Kill new engine; use existing scheduling and build specific cases. |
| 6 | Shared input/model/focus continuity contracts across browser ownership handoffs | [Playwright hydration guide](https://playwright.dev/docs/navigations#hydration), [Foldkit #1784](https://github.com/foldkit/foldkit/issues/1784), [Svelte #18951](https://github.com/sveltejs/svelte/issues/18951), [Solid bootstrap](https://docs.solidjs.com/reference/rendering/hydration-script) | **Keep A:** test corpus/fixture gap, contingent on integration work beating handwritten tests. |
| 7 | Turn ARIA keyboard patterns into executable temporal contracts | [Aria-Ease](https://github.com/aria-ease/aria-ease), [React Aria testers](https://react-spectrum.adobe.com/v3/testing.html), [ARIA-AT](https://aria-at.w3.org/) | Kill broad project. The exact APG+Playwright category exists. |
| 8 | Automatically judge every generated UI visually | [Percy agent plugin](https://github.com/percy/percy-visual-testing-agent), [Chromatic](https://www.chromatic.com/), [Playwright snapshots](https://playwright.dev/docs/aria-snapshots) | Kill broad project; model-judged visual intent is also a weaker independent oracle. |
| 9 | Closed-vocabulary design system: wrong styling fails mechanically | [Polar Orbit](https://polar.sh/blog/orbit-llm-safe-design-system), typed props and Oxlint restrictions | Kill as new offering; strong evidence the rigor flip is already happening. |
| 10 | Generate versioned design-system context, docs, skills, MCP from one manifest | [Atlassian structured content](https://www.atlassian.com/blog/ai-at-work/teaching-ai-to-speak-our-design-language), [Foldkit #630](https://github.com/foldkit/foldkit/issues/630) | Kill broad generator; owners have both the intent and distribution. |
| 11 | Safe generated UI via an allowlisted declarative component/action language | [json-render schemas/catalogs](https://github.com/vercel-labs/json-render/blob/main/apps/web/content/docs/schemas.mdx), [A2UI catalogs](https://a2ui.org/concepts/catalogs/) | Kill new protocol; host authorization still cannot be inferred from a UI schema. |
| 12 | A conversational app that writes its own plugins and UI | [bb August 4 release](https://getbb.app/changelog), [Pi extension API](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md), [Tambo](https://github.com/tambo-ai/tambo) | Kill general app. A plugin-authoring loop is already shipped. |
| 13 | Rehearse plugin replacement while the UI and old work are live | [bb #4432](https://github.com/get-bb/bb/issues/4432), [#5969](https://github.com/get-bb/bb/issues/5969), [VS Code integration host](https://code.visualstudio.com/api/working-with-extensions/testing-extension), [Vite dispose](https://vite.dev/guide/api-hmr) | **Keep C, narrowed:** a host-specific handoff conformance fixture, not another runtime. |
| 14 | Agents synthesize versioned Model and in-flight Message migrations | [Lamdera Evergreen](https://dashboard.lamdera.app/docs/evergreen) | Kill generic migration/proof pitch, already on the earlier kill list too. |
| 15 | Save/fork a running generated UI as a portable heap | Earlier catalogue [R5 / 10-wild](../catalogue/R5-teleport-06-10.md#10-wild-wildcards-live-programs-as-specimens-save-games-and-experimental-worlds), [Qwik resumability](https://qwik.dev/docs/concepts/resumable/) | Kill universal live-image pitch; Model data does not contain DOM/native resources. |
| 16 | More browserless accessibility/Scene tests as a substitute for browser QA | [Foldkit #1497](https://github.com/foldkit/foldkit/issues/1497), [Storybook's stated automation limit](https://storybook.js.org/docs/writing-tests/accessibility-testing), [ARIA-AT results](https://aria-at.w3.org/) | Kill substitution claim. Cheap simulation is useful within its boundary. |

### Earlier catalogue ideas that change at this layer

- **I — R9 / 06-tooling, Replaygate** ([catalogue](../catalogue/R9-deep.md#1-replaygate--production-traffic-as-the-regression-oracle-for-agent-changes-on-workers)): the frontend version becomes cheaper at update's pure seam, but much less complete once the browser and opaque Command body matter. This narrows it to B; it does not create fresh generic replay novelty.
- **I — R9 / 03-language, Replay diff** ([catalogue](../catalogue/R9-deep.md#4-replay-diff-edit-a-running-typescript-program-and-see-what-the-edit-does-to-its-past)): its “new code against old in-flight effects” problem reappears concretely in bb reloads and old continuations. That justifies C's specific lifecycle fixtures, not reviving a general durable-workflow engine.
- **I — R2 / 06-selfgrowing, malleable applications** ([catalogue](../catalogue/R2-moonshots.md#7-a-malleable-application-that-grows-at-the-point-of-use)): the old weakness was the lack of an objective intention oracle. In A/C, preserve a typed draft, keep the new prompt pending, and retire the old owner are narrower observable contracts. They check continuity, not whether the requested feature is a good idea.
- **I — R5 / 10-wild, runnable failure specimens** ([catalogue](../catalogue/R5-teleport-06-10.md#10-wild-wildcards-live-programs-as-specimens-save-games-and-experimental-worlds)): a versioned input sequence plus explicit browser handoff is a useful specimen without a movable VM heap. Reject the heap machinery; retain the failure artifact.
- **I — R6 / 04-broad, accessibility/localization automation** ([catalogue](../catalogue/R6-flip.md#04-broad-the-graveyard-outside-osinfra-which-old-ideas-did-agents-actually-un-kill)): its crowded verdict stands. A uses focus as one narrow observation; it does not relaunch automatic accessibility repair.

## 6. Finalist A — shared tests for the moment JavaScript takes over

**I — One sentence:** a small public corpus and Playwright fixture package that delays a frontend's takeover of server-rendered controls, performs real user edits, and checks that accepted input reaches the application without losing focus, selection, or producing extra actions.

**E — Thirty-second demo:** split screen, unchanged Story suite green on both versions. Hold the hydration bundle; type a search term, select a substring, change a checkbox; release JavaScript. One version clears the term or displays it while its search request uses an empty query. The other preserves the edit and submits the expected query once. Show the exact failed assertion and a replayable browser trace. No AI decides which result wins.

### Gap and closest alternatives

**F — There is a concrete current Foldkit reproduction.** [#1784](https://github.com/foldkit/foldkit/issues/1784), October 25, describes pre-hydration text erased while node identity and focus survive. The proposed fix requires Model/DOM agreement and explicit bootstrap ownership. Its workaround is reported tested in Chromium and WebKit. The report concerns the Blocks/Layers preview branch; do not label it a reproduced stable-release defect.

**F — Svelte has a corresponding report and fix effort.** [#18951](https://github.com/sveltejs/svelte/issues/18951), October 7, reports one-way input values overwriting pre-hydration edits. [PR #18952](https://github.com/sveltejs/svelte/pull/18952), still open when checked, covers direct/spread/async controls, textarea, checkbox, selections, and later updates. These tests and fixes are strong prior art; this project would extract/share a contract family, not invent the failure or its solution.

**F — Playwright documents the issue and supplies the mechanics.** It recommends disabling controls until hydration. Solid provides an early event-replay bootstrap, and Qwik takes a resumability approach. These are different valid product/runtime policies. A must report an honestly unavailable control separately from a control that accepts then loses input. [Playwright](https://playwright.dev/docs/navigations#hydration), [Solid](https://docs.solidjs.com/reference/rendering/hydration-script), [Qwik](https://qwik.dev/docs/concepts/resumable/).

**F — Foldkit already has a browser parity gate** comparing server markup and client DOM properties, including numeric/boolean reflection edge cases. That is an especially close baseline. It checks initial DOM interpretation; the proposed addition targets a person's intervening edits and application uptake during takeover. [Existing script](https://github.com/foldkit/foldkit/blob/b702a5efbb74bebc056b798b414ddb923a82fbd5/scripts/check-dom-state-parity.mts).

**I — Bounded gap finding:** searches for hydration conformance suites, input-preservation tests, npm packages, framework issues, and browser-testing docs found framework-local regressions, guides, and helpers; I did not identify a maintained cross-framework corpus with these explicit handoff profiles and application-level observations. This is weaker than proving absence. The closest implementation may be a few extracted framework tests, which is why the kill test is strict.

### Beneficiary and pain

**I — Named beneficiaries:** Foldkit's SSR/runtime maintainers, Svelte form-control maintainers, and application teams changing controlled form state with agents. Their concrete pain is accepted user input being erased or never adopted. These reports have low/no reactions; they establish a reproducible failure class rather than large-market demand. A particularly useful application beneficiary is a team whose “ready” test workaround currently hides the loss.

### Independent check and gaming

**I — The check has two public profiles:**

1. **Accept edits:** a visible enabled control accepts edits before takeover; afterward, its value/checked state, selection where meaningful, and logical focus are preserved, and submitting produces the edited value exactly once at a local test sink.
2. **Declare unavailable:** the control consistently signals that it cannot accept interaction until ready. This passes that declared policy, not the stronger accepted-edit preservation profile. Native form submission can be a separately declared supported path.

**I — Test the user's outcome, not an internal Model export.** A local submit/search sink observes what the application actually does with the value. For Foldkit, a Model read may add diagnostic detail but cannot be the sole oracle. Input preservation with stale application state is a failure; a node replacement that preserves the declared behavior is not automatically a failure. Check identity only in a profile that promises identity preservation.

**I — Gaming paths:** disable controls only under the fixture URL, lie in a test-only `readModel`, discard an edit then repopulate it before a final screenshot, or declare every case unsupported. Use production builds, multiple takeover points, observation immediately around the handoff, external action sinks, and stable public profile requirements. Review adapters and supported-case declarations separately from candidate application changes. Synthetic DOM `compositionstart` is not proof of native IME fidelity; v1 must mark IME, autofill, real screen-reader speech, and device keyboards as unverified.

### Why better models and why an outsider?

**I — Survives better models:** more capable models still cannot infer all browser timing and user activity from source. The check runs without a model, and a fixed failure capsule is useful to any author. Agents reduce the work of building the fixture variants and small adapters; the browser supplies the acceptance evidence.

**I — Ownership:** each framework owns its fix, but no one framework owns an independently usable cross-framework behavioral corpus. The plausible outcome is maintainers adopting/exporting the cases. If all useful assertions are framework policy rather than shared public behavior, the outsider advantage disappears and the result should become upstream tests.

### Two–three-week version

**E — Week 1:** copy/reduce publicly reproducible cases with attribution; define the two profiles; implement an explicit hydration latch and external action sink; use production builds; support text, textarea, checkbox, and select in Chromium and WebKit. Keep times as gates/callbacks rather than sleeps.

**E — Week 2:** Foldkit and React adapters with roughly 12–20 focused cases: edit before entry, before the initial controlled commit, repeated edits, selection preservation, focus return, accepted submit, and subsequent normal updates. Publish pass/fail/unsupported plus browser traces and tiny reproductions, not an aggregate “framework correctness” score.

**E — Optional week 3:** Svelte/Solid examples and a reusable fixture API. Do not add a recorder, model-generated assertions, BFCache, arbitrary hot patches, or a replacement automation engine. Existing runner limitations and native-browser cases need separate work.

### Expert reply that kills it

**I — “This is twenty lines of Playwright plus application-specific expectations. A shared DSL adds more maintenance than it saves, and our framework already runs all useful cases.”** That is a decisive objection if shown on real consumers. A tutorial or a pair of upstream PRs is then the right outcome.

### One–two-day kill test

**E — Day 1:** extract six cases from the Foldkit and Svelte reports and implement the accepted-edit check against minimal Foldkit and React pages. Include a passing control, an intentionally stale-state case, and an intentionally lost-value case. Require an observable application action as well as the DOM result.

**E — Day 2:** try adding Svelte or Solid using the same assertions. Kill the package if setup needs more than about 50 lines of framework-specific policy per case, if four of six assertions cannot be shared, if a handwritten test is simpler for both consumers, or if all failures are already covered by equally reusable upstream fixtures. Before expanding, seek a maintainer willing to reuse the corpus; no outreach was made during this research.

## 7. Finalist B — a causal Foldkit replay bridge, as an upstream contribution

**I — One sentence:** turn a bounded, complete Foldkit session into a causal replay fixture, compare candidate declared Commands only while recorded results remain valid, and emit Story source for supported prefixes with explicit holes elsewhere.

**E — Thirty-second demo:** record a double-click/save interaction; an agent PR accidentally returns two `SaveDraft` Commands. Exact instance/multiplicity comparison fails at the responsible update. A second PR changes only the Effect body: descriptor mode says it does not cover that change; boundary mode executes the body against the recorded test service and catches two write attempts. An overlapping trace exports as a replay fixture, not a falsified sequential Story.

**F/I — Gap:** #622 owns export/promotion, #1302 owns live test mode, Redux-Saga supplies the monitoring precedent, and Stately supplies semantic machine tooling. What remains to implement is Foldkit-specific causality/completeness and an honest comparison workflow. See §3 for the primary links and exact overlap. This is an integration contribution, not a defensible new standalone replay product.

**F/I — Pain:** the production-app author in #622 says they would use the bridge immediately; another commenter identifies E2E-to-Story friction. That is better direct demand than a generic agent-testing survey, but it remains a small sample. The effect-body case is measured here and independently articulated in #1302; frequency in production is unknown.

**I — Check:** frozen recorder protocol and test-service boundary, current candidate update, exact instances/counts, explicit event provenance, fail on unused/missing outcomes, and stop at the causal mismatch. Do not infer safety from command names. The implementation cannot prevent an arbitrary TypeScript Effect from accessing an uninstrumented global; restrict supported effect execution to controlled test processes/services and report that limit. A schema-valid trace can still lack a trustworthy business assertion.

**I — Gaming:** candidate changes a resolver, normalization, callback name, or fixture; visible records are memorized; old-success Messages are fed after canceled work. Separate oracle ownership and explicit incomplete verdicts reduce these routes. The existing exact Story matcher is part of the check, not something to rebuild.

**I — Better models:** changed environmental observations and independently captured behavior remain useful; descriptor prettification and test drafting become commodities. This is why causal fidelity is the contribution and an LLM-generated summary is optional.

**I — Owner:** Foldkit should ship/adopt it. The maintainer has already specified a discoverable bounded-recording workflow. Shipping as an upstream protocol/test-helper contribution is more credible than competing for users with a third-party production recorder.

**E — Two–three-week version:** week 1 adds capture start/end and invocation/completion origin records plus codecs/completeness flags; week 2 supplies a network-free pure replayer, exact Command diffs, and serial-prefix Story export; week 3 optionally connects real Command execution to one declared Effect service Layer. Exclude production retention, universal Effect interception, and automatic intent assertions. If the standard Story API remains serialized, keep concurrency in an explicit schedule runner.

**I — Killing expert reply:** “The only missing piece is #622's clipboard button, and our existing tests plus Replay/Meticulous already cover the meaningful faults. Causal instrumentation is not worth runtime cost.”

**E — One–two-day kill test:** capture ten bounded sessions from three existing example apps, including overlapping identical requests and cancellation. Unchanged-code replay must classify all supported sessions correctly, with no invented completion matches. Create four changes: duplicate wrapper, changed args, changed Effect body, removed request with an old completion. The checker must either catch the change at its declared boundary or say unsupported. Kill the separate bridge if it adds no actionable signal over existing exact Stories plus a small Copy-to-Story contribution, or if useful captures require application-specific instrumentation throughout.

## 8. Finalist C — extension replacement under live work

**I — One sentence:** a conformance fixture that keeps a draft, pending prompt, old callback, and tool-schema consumer alive while an agent-authored plugin is replaced, then checks which plugin instance owns each operation.

### What “bb” most plausibly means

**F — There is a much better match than babashka.** [get-bb/bb](https://github.com/get-bb/bb) calls itself an IDE that builds itself. Its August 4 changelog says an agent can scaffold, build, install, and reload a plugin from a conversation; October 23 expands replaceable navigation/composer surfaces. **I — I assume this is the brief's “bb.”** Babashka/SCI remains relevant scripting lineage, but its name is not the strongest match to the builder's self-extending-app example. [bb changelog](https://getbb.app/changelog), [SCI](https://github.com/babashka/sci).

**E — Thirty-second demo:** a plugin has an approval form open and an old queued task waiting. Replace the plugin. The new form remains open, the old task gets a declared canceled/retired outcome, releasing its old gate cannot mutate the new UI, and the resumed agent sees the new tool schema or an explicit restart requirement. A tiny action ledger names the old/new owners and any late writes.

### Gap, pain, and prior art

**F — Concrete bb failures exist.** [#4432](https://github.com/get-bb/bb/issues/4432), September 27, reports old-instance disposal canceling the new instance's form. [#5964](https://github.com/get-bb/bb/issues/5964), October 21, reports two production server exits from stale plugin handles, with about 30-second restarts. [#5969](https://github.com/get-bb/bb/issues/5969) distinguishes containing those errors from settling pending callers and retiring old work. [#5479](https://github.com/get-bb/bb/issues/5479), October 14, reports stale tool schemas in resumed Claude sessions after plugin reload. These reports had zero reactions when inspected; they demonstrate concrete workflows, not broad demand counts.

**F — Existing building blocks are substantial.** Vite has HMR `dispose` and persistent data; VS Code has an Extension Development Host for integration tests; Pi has TypeScript extensions and hot reload, with the same operating-system permissions as Pi itself. Lamdera explicitly migrates old Models and in-flight Messages. A generator, hot loader, capability protocol, or universal state migration engine is therefore not the gap. [Vite](https://vite.dev/guide/api-hmr), [VS Code](https://code.visualstudio.com/api/working-with-extensions/testing-extension), [Pi](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md), [Lamdera](https://dashboard.lamdera.app/docs/evergreen).

**I — The narrow gap is the reusable hostile-timing fixture and independently stated lifecycle contract across a plugin update.** It is closer to a regression corpus for the host than to a plugin certification service. A generic across-host checker is not yet justified: bb, Pi, and VS Code expose different promises and ownership semantics.

### Check, gaming, and limits

**I — Check actual host observations:** old/new instance IDs; pending-caller settlement; exactly which instance owns a prompt/listener/route; declared schema version seen by a resumed client; draft and configuration persistence; rejection of a late old-owner write through host APIs. Use explicit gates to release an old callback after replacement. Arbitrary promises cannot be forcibly canceled; a checker should verify the host's declared stale-work behavior, not claim it can stop all JavaScript continuations.

**I — Gaming:** plugins can bypass tracked host APIs, spawn detached work, or special-case the fixture. This does not certify arbitrary plugin isolation. Only a host-controlled runtime can enforce access revocation. Compile checks show SDK compatibility, not lifecycle correctness or whether an extension should receive authority.

**I — Better models:** self-extension increases the number of live replacements; ownership and continuation problems remain even when plugin source is well written. The accepted result runs without a model.

**I — Owner:** bb already has regression fixtures and specific follow-ups. The owner should adopt this. An outsider should start with a small contribution and only extract a common harness after a second host expresses the same contract. The distribution risk is high, and reproducing the public fixture may reveal that all useful work is an ordinary upstream bug fix.

**E — Two–three-week version:** week 1: reduce #4432/#5969 into a local no-model plugin pair, deterministic gates, and prompt/caller ledger. Week 2: add tool-schema refresh and preserved configuration/draft checks, with a bb adapter and a concise host-contract document. Week 3 only if justified: a Pi adapter for the subset whose semantics actually match. No new agent loop, arbitrary code sandbox, or runtime migration substrate.

**I — Killing expert reply:** “These are four bb bugs and four existing bb test fixtures. Our lifecycle implementation, not an external package, is the correct place to own them.” This likely kills a standalone tool, but can validate a worthwhile upstream contribution.

**E — One–two-day kill test:** reproduce two reported failure classes locally using public fixtures and fixed versions, without model calls or private accounts. Require an independent observation that distinguishes old and new instance ownership. Kill extraction if existing tests already expose the full contract, if no shared core survives a second host, or if the meaningful fix requires changing host internals with no reusable acceptance interface.

## 9. Where rigor flips beyond traces

**I — The flip is selective, not “all ceremony is free.”** Agents lower the cost of writing a transition table, Schema, test fixture, or design-token adapter. They do not make specifications correct, remove reviewer attention, or turn an application representation into a browser implementation. More generated test code can increase maintenance and false reassurance.

1. **F/I — Closed authoring vocabularies are already winning where the owner controls the check.** Polar's Orbit uses typed semantic tokens and Oxlint restrictions rather than relying on prose instructions. This is a stronger frontend example of the thesis than a new framework benchmark: the owner makes a disallowed style decision mechanically fail. It still does not prove useful layout, accessible interaction, or visual quality. [Polar](https://polar.sh/blog/orbit-llm-safe-design-system).
2. **F/I — Public interaction contracts can supply an independent check, but the generic project is taken.** APG specifies modal focus entry/containment/restoration with contextual exceptions; Aria-Ease and React Aria testers already operationalize interaction patterns. Use those tools. An axe pass or accessibility-tree snapshot cannot establish every keyboard/screen-reader outcome. Foldkit's roadmap itself calls for real screen-reader audits. [APG modal dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/), [Aria-Ease](https://github.com/aria-ease/aria-ease), [Foldkit roadmap](https://foldkit.dev/roadmap).
3. **F/I — Real interop results justify keeping the browser/AT boundary explicit.** ARIA-AT reports different outcomes across JAWS/Chrome, NVDA/Chrome, and VoiceOver/Safari. A pure Model, type checker, or guessed accessible name cannot substitute for those combinations. ARIA-AT is a source of evidence and an existing ecosystem, not a reason to build another universal accessibility badge. [ARIA-AT](https://aria-at.w3.org/).
4. **I — Executable handoff obligations are the less crowded seam.** State that the person has already entered and work that is already pending are observable before the code changes. A/C preserve those obligations across ownership transfer. This revives a narrow part of Smalltalk/Emacs-style living software without reviving portable heaps or trusting an agent's description of its own patch.
5. **F/I — Declarative generated UI is useful but already occupied.** json-render/A2UI constrain components/actions; AI SDK renders tool results as application-authored UI; bb/Pi permit generated code extensions. These are different extension powers and need different checks. Schema conformance is appropriate for a closed UI description; live-code replacement additionally needs state and lifecycle checks. [json-render](https://github.com/vercel-labs/json-render), [A2UI](https://a2ui.org/concepts/catalogs/), [AI SDK UI](https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces).
6. **I — Rigor that survives better models describes externally observable obligations.** Preserve accepted edits; use the declared arguments; retire the old owner; keep the human-approved design vocabulary; expose actual action multiplicity. “The machine graph looks plausible” or “another model liked the screenshot” is not the same kind of evidence.

**F — Search scope:** Foldkit source, docs, tests, roadmap, and issue searches for replay/Story/Machine/agents/browser; Elm and Redux/Redux-Saga docs/source; XState/Stately current docs; Replay.io, rrweb, PostHog, LogRocket, Meticulous; npm's explicit download window; HN's search/item APIs; the Chronicle arXiv paper and current repository; framework hydration reports; design-system owner posts; bb/Pi/VS Code/Vite extension material. **I — Limits:** no private production traces, interviews, outreach, controlled agent-productivity trial, real AT/device run, or general competitive completeness claim. Only the Foldkit counterexamples in §4 were executed.

## 10. Ranked top three

Scores are **I**, 1–5 per the brief. Gap scores reflect bounded searches; value scores reflect evidence strength rather than imagined market size. All three are independent of GrowOS. Totals are not a substitute for their kill tests.

| Rank | Finalist | Cool | TS / CF / Vercel adjacency | Real gap | Value / pain | Survives better models | Not GrowOS | Total |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | **A — Browser handoff tests/corpus** | 4 | 5 | 3 | 3 | 5 | 5 | **25/30** |
| 2 | **C — Live extension replacement fixtures** | 4 | 5 | 2 | 3 | 5 | 5 | **24/30** |
| 3 | **B — Causal Foldkit replay bridge** | 3 | 5 | 2 | 3 | 5 | 5 | **23/30** |

**I — ONE pick: A, the browser handoff corpus.** Run its two-day kill test. Its credible advantage is a small public body of executable obligations spanning framework owners. If adapters reduce to trivial app-specific Playwright, stop at upstream tests. B is the most immediately requested contribution, but #622/#1302 and the measured descriptor blind spot prevent me from recommending it as a fresh broad project.

### Five-line TL;DR

1. **F/I:** Agent-heavy teams demonstrably use Effect; Foldkit has credible niche users, without comparative productivity evidence.
2. **F:** Foldkit #622 already requests session-to-Story; Redux-Saga, Redux DevTools, Stately, Replay.io, and Meticulous cover much of the proposed ground.
3. **M:** Equal Command descriptors concealed one versus two writes; ordinary Story rejected overlapping input; structural Machine reachability did not establish guard reachability.
4. **I:** Keep causal replay as an upstream contribution with explicit incomplete verdicts, and keep real browser/AT checks separate from pure simulation.
5. **I:** Pick a shared browser-handoff corpus: preserve accepted input, application uptake, focus/selection, and action count when JavaScript takes ownership.

### Rejected ideas, one line each

- **I — Generic capture-to-test exporter:** killed by [Foldkit #622](https://github.com/foldkit/foldkit/issues/622) and [Redux's Test Generator](https://github.com/reduxjs/redux-devtools/tree/main/packages/redux-devtools-inspector-monitor-test-tab).
- **I — New live-effects Story mode:** killed by [Foldkit #1302](https://github.com/foldkit/foldkit/issues/1302).
- **I — New machine/graph/test generator:** killed by [Foldkit Machine](https://foldkit.dev/core/machine) and [Stately](https://stately.ai/docs/xstate/v6/model-based-testing).
- **I — Generic UI race-testing engine:** killed by [fast-check scheduling](https://fast-check.dev/docs/advanced/race-conditions/) and existing framework/runtime scheduling tests.
- **I — APG-to-Playwright accessibility platform:** killed by [Aria-Ease](https://github.com/aria-ease/aria-ease), React Aria testers, and ARIA-AT.
- **I — Agent visual-review platform:** killed by [Percy's agent plugin](https://github.com/percy/percy-visual-testing-agent), Chromatic, and established screenshot tools.
- **I — A constrained design system for agent authors:** killed as a new category by [Polar Orbit](https://polar.sh/blog/orbit-llm-safe-design-system).
- **I — A design-system context/schema/MCP generator:** killed by [Atlassian](https://www.atlassian.com/blog/ai-at-work/teaching-ai-to-speak-our-design-language) and framework-owned context tools.
- **I — A safe declarative generative-UI protocol:** killed by [json-render](https://github.com/vercel-labs/json-render) and [A2UI](https://a2ui.org/concepts/catalogs/).
- **I — Another self-extending app or plugin authoring loop:** killed by [bb](https://getbb.app/changelog), Pi, and existing generative-UI frameworks.
- **I — Generic live Model/Message migration synthesis:** killed by [Lamdera Evergreen](https://dashboard.lamdera.app/docs/evergreen) and the earlier migration kill list.
- **I — Universal save/fork/move of a live frontend heap:** killed by the [R5 failure-specimen analysis](../catalogue/R5-teleport-06-10.md#10-wild-wildcards-live-programs-as-specimens-save-games-and-experimental-worlds) and browser resources outside the Model.
- **I — Browserless tests as complete accessibility/browser evidence:** killed by the observation boundary and concrete [Scene/runtime disagreement](https://github.com/foldkit/foldkit/issues/1497).
