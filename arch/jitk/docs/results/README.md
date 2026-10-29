# Measurement and experiment reports

Every results report in `arch/jitk`, newest first per area. They are dated
records of one run each: the code, engines and numbers they describe may have
changed since (libkrun, for example, is gone). The reports in this directory
are no longer written or read by any tool. The ones under "In place" stay next
to the code that writes or cites them. Raw files they link to may live in the
evidence store: `tools/.work/bin/evidence fetch PATH` restores them
([evidence/README.md](../../../../evidence/README.md)).

For current numbers, see the latest review (`arch/review/R11-REVIEW.md`,
"Performance") and the subtree READMEs.

## Archived here

| Report | Date | What it measured |
| --- | --- | --- |
| [hvf-spike-2026-10-28](hvf-spike-2026-10-28.md) | 2026-10-28 | HVF engine spike: ring kernel on Hypervisor.framework, reset cost, cold/fork VM cost, the risks the engine closed |
| [bench-copy-restore-2026-10-28](bench-copy-restore-2026-10-28.md) | 2026-10-28 | KVM shard copy-restore reset, before/after (nested) |
| [bench-admission-queue-2026-10-28](bench-admission-queue-2026-10-28.md) | 2026-10-28 | executor FIFO admission queue, before/after (nested) |
| [grow-phase2-2026-10-27](grow-phase2-2026-10-27.md) | 2026-10-27 | GrowOS phase 2: corpus on the grown kernel |
| [scriptc-corpus-phase2](scriptc-corpus-phase2.md) | 2026-10-27 | scriptc corpus on the phase-2 grown kernel |
| port-parity-[kernel](port-parity-kernel-2026-10-26.md), [shard](port-parity-shard-2026-10-26.md), [executor](port-parity-executor-2026-10-26.md), [protocol](port-parity-protocol-2026-10-26.md), [docs](port-parity-docs-2026-10-26.md) | 2026-10-26 | Python → scriptc TypeScript tooling port: paired checks per subtree |
| [grow-e2-e3-2026-10-26](grow-e2-e3-2026-10-26.md) | 2026-10-26 | GrowOS experiments E2 and E3 |
| [grow-e0-e1-2026-10-26](grow-e0-e1-2026-10-26.md) | 2026-10-26 | GrowOS experiments E0 and E1 |
| [grow-r7](grow-r7.md) | 2026-10-25 | grow R7: read-only SQLite (fstat, pread64) |
| [shard-r7-shard](shard-r7-shard.md) | 2026-10-25 | KVM shard R7: bounded arenas, owners, watchdog leases |
| [shard-r7-ipc](shard-r7-ipc.md) | 2026-10-25 | Node policy over shard IPC (R7) |
| [shard-r7-integrate](shard-r7-integrate.md) | 2026-10-25 | native tools under bounded ring layouts (R7) |
| [shard-r7-rng](shard-r7-rng.md) | 2026-10-25 | fresh QuickJS and libc randomness after restore (R7) |
| [shard-r6](shard-r6.md) | 2026-10-25 | real kernel + static QuickJS on the KVM shard (R6) |
| [shard-spike-2026-10-25](shard-spike-2026-10-25.md) | 2026-10-25 | the first minimal KVM shard (assembly fixtures) |
| [mcp-latency-2026-10-24](mcp-latency-2026-10-24.md) | 2026-10-24 | MCP layer latency, parked path (libkrun era) |
| [bench-native-watchdog-2026-10-24](bench-native-watchdog-2026-10-24.md) | 2026-10-24 | canonical bench with the native watchdog (libkrun era) |
| [bench-quiet-2026-10-24](bench-quiet-2026-10-24.md) | 2026-10-24 | canonical bench, quiet host (libkrun era) |

## In place

| Report | Date | Why it stays there |
| --- | --- | --- |
| [bench/RESULTS-LINUX-MEMORY-2026-10-27](../../bench/RESULTS-LINUX-MEMORY-2026-10-27.md) | 2026-10-27 | Linux memory, shard vs Hyperlight; method for `bench/linux-memory/ledger.ts` |
| [grow/EXPERIMENTS-PATHFS-2026-10-27](../../grow/EXPERIMENTS-PATHFS-2026-10-27.md) | 2026-10-27 | GrowOS path syscalls; cited by `grow/pathfs-grown/GROWN.json` |
| [scriptc-corpus/RESULTS](../../scriptc-corpus/RESULTS.md) | 2026-10-26 | written by `scriptc-corpus/report.ts` |
| [shard/RESULTS-R7-bytes](../../shard/RESULTS-R7-bytes.md) | 2026-10-25 | native byte streams; cited by `kernel/syscalls.manifest.json` |
| [bench/ledger/RESULTS](../../bench/ledger/RESULTS.md) | 2026-10-25 | macOS memory + CPU ledger (gate 0), next to its raw files |
| [bench/RESULTS](../../bench/RESULTS.md) | 2026-10-24 | written by `bench/run.ts`; cited by the frozen R4 claims |
| [bench/hyperlight/results/RESULTS](../../bench/hyperlight/results/RESULTS.md) | 2026-10-24 | written by `bench/hyperlight/bench.ts` |
| [bench/hyperlight/smoke-r3/RESULTS](../../bench/hyperlight/smoke-r3/RESULTS.md) | 2026-10-24 | Hyperlight smoke run, next to its raw file |
| [kernel/RESULTS-fs](../../kernel/RESULTS-fs.md) | 2026-10-24 | read-only resources; part of the kernel tree that grow copies and hashes |
