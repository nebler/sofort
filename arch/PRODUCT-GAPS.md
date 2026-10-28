# jitk: what is missing for a product (2026-10-28)

jitk works as a research prototype: fresh microVM per snippet, ~1.1 ms `execute()` and ~1.7 CPU-ms
per run on the Linux shard (nested KVM, indicative), ~0.5 MiB per VM. This file lists what a
*product* would still need. Engineering debt (sprawl, duplicated ABIs, setup) is tracked separately in
`review/R9-ARCH-QUALITY.md`.

## Product gaps

| Gap | Today | What a product needs |
|---|---|---|
| Distribution | Runs only from this repo, on the Mac plus `kvm-dev` | An installable package or a hosted service; one-command setup |
| User API | Executor implements Cloudflare codemode `Executor` and TanStack `IsolateDriver`; MCP server for agents | A stable, versioned public API/SDK; user-facing docs and examples |
| Multi-tenancy | One trust boundary per VM; no tenant concept above that | Auth, per-tenant quotas and rate limits, usage metering, billing hooks |
| Operations | Test suites and benchmark ledgers | Metrics, dashboards, alerts, crash reporting, upgrade and rollback path |
| Linux feature parity | Shard caps tool replies at 1 KiB, has no timers, caps source at 8 KiB (R9 N6) | Same behaviour as the Mac path, enforced by a shared corpus |
| Hardware | aarch64 only; no bare-metal numbers | Bare-metal numbers (c7g.metal); x86_64 for most clouds (`kernel/ARCH.md`) |
| Shard containment | No seccomp/Landlock; deadline watchdog runs inside the shard (R7#6, R7#7) | OS sandbox for the shard; supervisor-owned deadlines |
| Program reach | Strict printable-stdout rule; 261 corpus programs fail by design | Output wrapping, or a full Linux microVM fallback tier |
| Proof from outside | Internal reviews only; no users; no CI | CI on a second machine; external security audit; first users and their feedback |

## Order that makes sense

1. Bare-metal numbers and the million-VM demo (the headline).
2. CI on a second machine plus the setup reduction (so "works" means more than this Mac).
3. Linux feature parity and shard containment (prerequisites for real tenants).
4. Public API, packaging and docs.
5. Tenancy, metering and operations (only once someone wants to run it for others).
6. x86_64.
