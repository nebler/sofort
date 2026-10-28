# Round 11 summary: mining Cloudflare Connect 2026 (2026-10-28)

All 13 talks of the Cloudflare Connect 2026 playlist were transcribed ([README](README.md)) and read in full by 5 GPT-6.1-Sol
agents ([BRIEF](BRIEF.md)). They extracted about 560 timestamped signals and checked each against existing products.
**Verified** means I checked the quote in the transcript or the source myself.

## 1. The one-page version

1. **No "unikernels will fall" moment.** The predictions in these talks are generic: agent traffic grows (talk 09 cites
   1,700% growth), "writing code by hand is dead" (13), "small AI native teams are the future" (13). Conference talks are
   product and customer stories, so they yield **pain**. GrowOS's seed came from a *podcast*, where people speculate.
   For predictions, mine podcasts.
2. **The pain is consistent: transitions lose something.** All five picks independently check that a lifecycle
   transition stays correct, and each is grounded in a named team that got hurt:

| Report | Transition | What broke (quote verified) | Pick | Score |
|---|---|---|---|---|
| [02](02-storage.md) | deploy with old and new code live | Artifacts forgot to lowercase repo names; agents weekly failed to split the fix "to make sure that we didn't have like version skew" until a newer model one-shot it; reads still check both spellings (talk 13, 14:00–16:00) | Mixed-version DO migration rehearsal | — |
| [03](03-durable.md) | idle → hibernate | DOs bill unless they really hibernate; [cloudflare/agents #1956](https://github.com/cloudflare/agents/issues/1956) "No supported way to assert a Durable Object's hibernation state / eligibility in tests" (open since 2026-07-16, 0 reactions) | Passive hibernation-eligibility assertions, upstream to workerd/Vitest | 26 |
| [04](04-customers.md) | tenant move between cells | Ramp's router keeps "a freshness, but we have also an expiration… not fresh anymore, but not expired, you can still route based on it" (talk 10, 31:00) | Cutover Witness: counterexample when a stale cache or alias still reaches the retired cell | 26 |
| [05](05-platforms.md) | storage path change | TELUS moved events to Analytics Engine; "Analytics engine samples… not for counting people… our numbers jumped like seven times" when moved back (talk 12, 11:00–12:00) | Sampling Witness: counterexample when an exact metric cannot survive sampling | — |
| [01](01-agentweb.md) | plan / flag / surface change | VSCO hand-built capability catalogs, harnesses, prerequisite and tier checks and readback verification for its agent | Business-action conformance fixtures | 25 |

3. **The best seed line is talk 02's close (Cloudflare speaker, 18:00, verified):** *"building got cheap, but owning it is
   still kind of a problem for now, but that is changing."* The same talk says "I can build the replacement in 6 months
   with better models" and warns of "a thousand versions of slightly different but kind of the same software". Every
   pick above is a piece of *owning* generated software over time.
4. **Taken (do not pitch):** the agent-web stack (Cloudflare's agentic-web work: discoverable, callable, payable),
   business-outcome verification ([Postcept](https://postcept.com/)), agent hosting, scheduling, recovery, files and tracing on DOs,
   global filesystems, agent git hosting, analytics infrastructure, AI review, health-based rollout, generic routing,
   classifiers and distillation. Shutdown, deploy and retry improvements for DOs are on Cloudflare's roadmap
   (talks 09/11).
5. **Same caveat as round 10:** each pick is narrow, often upstream, and conditional on a 1–2-day kill test. Issue
   reactions are near zero; the pain is quoted but not counted.

## 2. My synthesis (inference, not yet prior-art checked)

The five picks share one shape: **declare a transition plus a contract that must hold across it, run it locally on
workerd with a virtual clock, and return the shortest counterexample.** Combined, that is a *transition harness for
Workers apps*: Jepsen-style counterexamples, but for lifecycle events instead of network partitions:
- deploys with version skew;
- hibernation;
- tenant moves;
- storage swaps;
- replacing a tool outright ("the replacement in 6 months").

It matches the talk-02 thesis ("owning is the problem") and the round-10 thesis ("checks at boundaries the author cannot
casually redefine"). Agents don't make it obsolete: they make the transitions more frequent.

Before building it, check: Cloudflare's own test harness and `vitest-pool-workers`, Antithesis, Jepsen, and
Cloudflare's roadmap for each transition.

## 3. Lessons for the method

- Talks give pain with names attached, which is better evidence than desk research. But they give few non-obvious
  predictions.
- Customer talks (Ramp, TELUS, VSCO) produced the strongest signals. Cloudflare talks mostly mark ground as taken.
- **Next source:** podcasts and unscripted conversations (Next Token, Latent Space, Oxide and Friends, Changelog), mined
  for "the next thing to fall is…".
