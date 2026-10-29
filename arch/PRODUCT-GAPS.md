# jitk: what is missing for a product

jitk works as a research prototype: fresh microVM per snippet, ~1.1 ms `execute()` and ~1.7 CPU-ms
per run on the Linux shard (nested KVM, indicative), p50 0.13–0.20 ms and ~325 CPU-µs per run on the
Mac's HVF engine, ~0.5 MiB per VM. This file lists what a *product* would still need. Engineering
debt is tracked separately in the latest review (`review/R11-REVIEW.md`, "Ranked fix list").

## Product gaps

| Gap | Today | What a product needs |
|---|---|---|
| Distribution | Runs only from this repo, on the Mac plus `kvm-dev` | An installable package or a hosted service; one-command setup |
| User API | Executor implements Cloudflare codemode `Executor` and TanStack `IsolateDriver`; MCP server with `execute` (JS) and `run` (native programs) | A stable, versioned public API/SDK; user-facing docs and examples |
| Multi-tenancy | One trust boundary per VM; no tenant concept above that | Auth, per-tenant quotas and rate limits, usage metering, billing hooks |
| Operations | Test suites and benchmark ledgers | Metrics, dashboards, alerts, crash reporting, upgrade and rollback path |
| Value size | Both engines share the ABI v11 limits (4,096 calls, 1 MiB calls/replies, 64 KiB code, timers) and a 96-case parity corpus; the glue-2m arena (~400 KiB QuickJS heap) makes values of ~100 KiB an out-of-memory error | Limits derived from the arena class; a larger class where callers need big values |
| Hardware | aarch64 only; no bare-metal numbers | Bare-metal numbers (c7g.metal); x86_64 for most clouds (`jitk/kernel/ARCH.md`) |
| Shard containment | Mac engine is Seatbelt-confined; the Linux KVM shard has no seccomp, Landlock, namespaces or no_new_privs; deadlines run inside the engine's processes | OS sandbox for the Linux shard; supervisor-owned deadlines |
| Program reach | Strict printable-stdout rule; 261 corpus programs fail by design | Output wrapping, or a full Linux microVM fallback tier |
| Proof from outside | Internal reviews only; no users; GitHub CI (`make ci`) builds and tests on arm64 but boots no VM | CI that boots VMs on both engines; external security audit; first users and their feedback |

## Order that makes sense

1. Bare-metal numbers and the million-VM demo (the headline).
2. CI that boots VMs plus the setup reduction (so "works" means more than this Mac).
3. Linux shard containment (a prerequisite for real tenants).
4. Public API, packaging and docs.
5. Tenancy, metering and operations (only once someone wants to run it for others).
6. x86_64.
