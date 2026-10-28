# Product round: summary (2026-10-28)

Six GPT-6.1-Sol research agents (xhigh). Brief: `BRIEF.md`. Reports: `01-headline-demo`, `02-distribution-api`,
`03-value-gaps`, `04-outside-proof`, `05-presentations`, `06-hosting-ops`. Labels as in the reports (F/M/I/E).

## Where the six agree

1. **First move (01, 04, 06 independently):** one fresh-checkout hardware receipt on real ARM metal. That means:
   - pinned host, OS, page size and CPU features;
   - correct results, plus total and marginal memory;
   - reset and timeout behaviour, and every failure.

   It needs no service and no million counter. It costs **$15–40 and 1–2 days**. Options:
   - phoenixNAP ARM about **$0.99/h**;
   - c7g.metal **$2.27/h in Malaysia** or $2.67/h in Singapore;
   - c7g Spot in Stockholm about $0.28/h.

   Prices were checked 2026-10-28. The same script then becomes the second-machine CI check. It closes the Hardware gap and
   half of Proof from outside.
2. **The 1 KiB tool-reply cap is the real value blocker (03).** It kills the core code-mode job: fetch lots of data, reduce it
   to a small answer. The 261 non-printable-stdout programs, timers and aarch64-only do not block the first segment.
   Native binary streams already exist in part; integrate them rather than reinvent them.
3. **No proven wedge yet (03).** The best candidate is an **embedded ARM/KVM backend for short, unique JS tool programs
   where hardware isolation is a stated requirement**. It would ship behind the Cloudflare codemode `Executor` and TanStack
   seams that already exist. Hosted sandbox, billing and full workspaces are a different, later product.
4. **Distribution = a local npm package (02).** It needs:
   - a frozen `open/execute/close` API with typed errors;
   - `doctor`;
   - a signed macOS VMM;
   - adapters for Cloudflare, TanStack and MCP.

   Estimate: 6–10 days. The OpenAI Agents, Mastra, Pydantic and Deep Agents workspace contracts need more than jitk
   supplies today.
5. **Containment (04):** supervisor-owned deadlines whose hard retirement **survives a shard forging an acknowledgement**,
   plus seccomp/Landlock on the shard process. Estimate: 5–10 days.
6. **Defer tenancy, billing and x86 (06).** Tenancy and operations are a 10–15-day slice, worth building only when a
   builder wants editable code. The x86 port is **24–37 days** for the ring path alone and 33–52 days for both paths.
   Do it only for a named deployment.

## Corrections to our own claims

- About 0.5 MiB/VM is a small-fixture shard slope. The **full executor is about 0.66 MiB**, and Hyperlight is slightly lower.
  All timings are nested KVM. Say so every time (01, 05).
- "Million VMs" must name its noun: cumulative executions, concurrent resident guests or scaled-to-zero snapshots.
- **8/16-bit arm64 VMIDs are a performance constraint (rollover/TLB flush), not a hard cap on VM count** (01). The limits
  that break first are the current 64/16,384-slot checks, fds, maps, commit and notifiers.
- `arch/viz` material is stale relative to current numbers (05).
- **Cirrus CI shut down 2026-06-01** (04). GitHub's hosted ARM and Mac runners do not give the needed KVM/HVF path, so use
  owned or dedicated hardware.

## Demos worth building, in order

| Demo | Report | What it shows | Cost |
|---|---|---|---|
| "The tool returned 64 KiB. The model got the answer." | 03 A | The core value, once the 1 KiB cap is fixed | $0 |
| "Where the half-megabyte goes" | 01 E | Memory breakdown vs Hyperlight; strongest hiring proof | $0–25 |
| "Ask eight throwaway computers" (offline laptop) | 01 C | A meetup-safe live demo, no network | $0 |
| "10,000 waiting computers, one challenge" | 01 B | The waiting architecture at scale, with a nonce wake test | $10–20 |
| "Poison this run; the next still starts clean" | 03 B | Isolation and reset | $0 |
| "One million runs; count the actual computers" | 01 A | Headline, cumulative, honestly labelled | metal hours |
| "One million guests actually retained" | 01 D | Capstone; only after 16K/64K/128K gates pass | $100–150 hard cap |

## Presentations

- **Write one public-claim sheet first (05).** It separates the current runtime, the grown-kernel variant, nested
  measurements and future features. Every talk, post and interview reuses it.
- **Deadlines to act on now:**
  - **Rust Nation UK** (London, 18 Feb 2027): the CFP is open, and report 05 cites **Oct 31** from the organizer's posts.
    The CFP page itself says the deadline is on the form, so check `cfp.rustnationuk.com` today.
  - **FOSDEM** microkernel/virtualization devroom: **Nov 23**.
  - **FOSSASIA**: **Nov 30**.
  - **Cloud Native KL**: a rolling CFP through Sep 2027.
  - **Rust Malaysia**: a community route toward KL.
- After the metal receipt, write one long engineering post with matched Hyperlight runs and failing cases. Then do a
  Show HN.
- For KL interviews, the story is platform-engineering judgment: a restricted runtime, independent checks, corrected
  benchmarks and clear failure boundaries. Avoid "fastest sandbox" claims.

## Suggested next order (revises `arch/PRODUCT-GAPS.md`)

1. Claim sheet, then a Rust Nation or FOSDEM abstract (1 day, this week).
2. Metal receipt as a script (1–2 days, under $40). The same script becomes the second-machine CI check.
3. Fix the 1 KiB reply cap and add a customer-shaped >1 KiB parity case (4–8 days). This unlocks the 64 KiB demo.
4. Supervisor deadlines and shard confinement (5–10 days).
5. npm package with Cloudflare, TanStack and MCP adapters (6–10 days). Then find one design partner, then fuzzing and a
   scoped human review (€2–6k, optional).
6. The 10K-waiting demo and the gated million-resident capstone.
7. Tenancy, operations and x86 only on demand.
