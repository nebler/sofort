# jitk architecture

jitk runs each submitted JavaScript body (or a whole static Linux program) in
its own single-use hardware VM. A VM is never booted per run: each engine slot
is restored from a prepared snapshot, runs one job, and is reset to that
snapshot before the next. Tool calls leave the VM as bounded records; trusted
Node code applies policy, calls the tool with its credentials and replies.

```text
 TRUSTED HOST (Node)                         ENGINE (Rust, one OS process tree)        HOSTILE GUEST (per slot)
 MCP client ─> mcp/server.mjs
               tools: execute, run
 codemode / TanStack caller
        │
        v
 MicroVMExecutor ─ policy (executor/policy) ─ provider tools + credentials
        │
 SandboxPool: warm parked sessions, FIFO admission
        │
 Engine / Session ── ShardBackend ──IPC records──> macOS: hvf ipc                    guest kernel, ring profile
                                     (fd 3 socket)   zygote ─fork─> 1 process/slot   QuickJS (or a native ELF) at EL0
                                                     Linux: real ipc                   │
                                                     owner threads + leases           │ ring records + doorbell
                                                   slot: VM + snapshot reset <────────┘
```

## A run

1. **Park.** The pool keeps `warm` sessions parked: a slot whose VM sits at
   the snapshot's CHECKPOINT, admitted and bound to a generation.
2. **Start.** `execute(code)` takes a parked session and sends START with the
   tenant source. The guest kernel resumes, reseeds entropy
   (`kernel/README.md` "Ring payload and entropy after restore") and runs the
   source in QuickJS.
3. **Calls.** A tool call is a ring record; the doorbell exits to the engine,
   which forwards it to Node as an IPC record. Node validates it, the policy
   decides, the provider runs on the host, and the reply goes back the same
   way. While a call is open the guest parks (WAIT); its timers keep running.
4. **Done.** The completion value comes back as DONE (with STATS). The engine
   resets the slot: the writable guest memory is copied back from the
   snapshot and the registers restored, then the slot is pristine again.
5. **Deadlines and failure.** The engine holds each run's deadline and kicks
   the vCPU at it. Bad guest content ends that session only; a slot whose
   reset fails is quarantined (on HVF re-forked and reported RESTORED).

## Components

| Subtree | Role | Start reading |
| --- | --- | --- |
| [`mcp/`](../mcp/README.md) | MCP server: `execute` (code-mode JS) and `run` (a native profile), file-backed resources | `server.mjs` |
| [`executor/`](../executor/README.md) | `MicroVMExecutor` (Cloudflare codemode `Executor`, TanStack `IsolateDriver`), `SandboxPool`, the `Engine`/`Session` interface and its adapters, engine selection | `engine.ts`, `executor.ts`, `select-backend.ts` |
| [`executor/policy/`](../executor/policy/README.md) | host policy: tool lookup, argument and output validation, approvals, per-call credentials | `policy.mjs` |
| [`shard/`](../shard/README.md) | the ring engine: slots, snapshot reset, the `hv` seam, KVM (`real`) and HVF (`hvf`) backends, IPC service, native worker, snapshot preparation | `src/slot/`, `src/hv.rs` |
| [`abi/`](../abi/README.md) | `jitk-abi`: ring, arena, IPC values defined once (ABI v12); generates the TS and guest copies | `src/lib.rs` |
| [`kernel/`](../kernel/README.md) | the guest kernel: syscall handlers, MMU, ring transport; ring and console profiles | `src/main.rs`, [`ARCH.md`](../kernel/ARCH.md) |
| [`protocol/`](../protocol/README.md) | protocol v1 (console profile) and the frame checks the ring path reuses | `dispatcher.ts` |
| [`grow/`](../grow/README.md) | GrowOS: grows missing syscall handlers against a Linux oracle (developer loop) | `loop.ts` |
| [`bench/`](../bench/README.md) | load-aware benchmark harness, Hyperlight comparison | `run.ts` |
| [`tools/`](../tools/), [`tslib/`](../tslib/) | setup (`doctor`, `deps`), CI, layering lint, evidence tool; shared TS helpers | `ci.sh`, `deps.ts` |

## Engines and the `hv` seam

`slot::Slot<V: hv::Vm>` holds everything hypervisor-neutral: guest RAM over the
arena class regions (immutable extents read-only on both sides), the ring
record decoder and reply path, admission, reset, trim and verify. Behind the
seam (`shard/src/hv.rs`) are two backends with different process topologies:

| | Linux: KVM shard (`real ipc`) | macOS: HVF engine (`hvf ipc`) |
| --- | --- | --- |
| VMs | one VM fd per slot, many per process | one VM per process (an HVF rule) |
| topology | owner threads run slots; leases carry deadlines | a single-threaded zygote forks one long-lived engine process per slot |
| reset | pagemap: copy private pages, or `MADV_DONTNEED` | copy both writable extents |
| confinement | none yet | Seatbelt (`jitk.sb`), fork dropped ([CONTRACTS](../CONTRACTS.md)) |
| role | the production engine | the development engine |

Snapshots are prepared per arena class (`glue-2m`, `glue-4m`, `glue-8m`, `glue-16m`) by
`make -C shard snapshot` and stored in the jitk cache under a key derived
from the ring kernel image and helper hashes; both engines refuse a snapshot
whose ABI version differs (Node checks it too).

## Kernel profiles

One kernel source tree builds two profiles (`kernel/README.md`):

- **ring** (`transport-ring`): shared-memory rings and a doorbell, booted only
  from a snapshot by the ring engine. This is what the executor and MCP run.
- **console** (default build): a virtio console speaking protocol v1 on stdio,
  booted by `hvf console`. GrowOS, `scriptc-corpus`, the kernel suite and the
  protocol VM tests use it, because they need its stdin, path syscalls and
  inline trace records.

## Limits

Both engines admit the same JS jobs (ABI v12, `Engine.limits`): 4,096 calls
per run with 64 open, 1 MiB calls and completions, tool replies to the
class's bound (1 MiB; 2 MiB on glue-8m, 4 MiB on glue-16m), 64 KiB of tenant
code, 1,024 log lines, guest timers. The practical bound on big values is the
snapshot's arena class: glue-16m (the default: about 11.8 MiB of QuickJS heap,
replies to the 4 MiB bound; the only class that completes every real bench
task), glue-8m (about 4.8 MiB, replies to 2 MiB), glue-4m (about 1.5 MiB,
replies to about 910 KiB) or glue-2m (about 370 KiB, replies to about
212 KiB), with `JITK_SHARD_CLASS`. Details:
`shard/README.md` "Limits (ABI 12)". A 96-case corpus
(`executor/parity/`) checks that both engines behave the same.

## Trust boundaries

- Guest EL0 and EL1, and everything they send, are hostile to the host. The
  kernel enforces EL0 isolation, pointer checks and W^X; the engine bounds and
  decodes every ring record; Node validates every IPC record again before an
  event exists (`executor/engine.ts`).
- The engine runs out of process: it is the crash and confinement boundary.
  On macOS it is Seatbelt-confined; on Linux both the shard (`real ipc`) and
  the native worker (`real native-worker`) enter namespaces, Landlock,
  `no_new_privs` and a seccomp allowlist before any guest runs
  (`shard/src/confine/`). Both die with their parent and enforce run
  deadlines in the engine, independent of Node.
- An engine process maps every guest it runs, so it is also a trust domain
  between guests: on Linux the default 64-slot shard is one domain; serve
  one tenant per engine process, or split slots across processes with
  `ShardSet` (`JITK_SHARD_PROCESS_SLOTS=1`: one VM per process). On macOS
  every slot is its own process. See `shard/README.md` "Trust domains".
- Policy and credentials exist only in Node. Kernel diagnostics never
  authorize a tool or establish success.
- GrowOS's builder and oracle are trusted developer tools, a different
  boundary from hostile guest code.

## Gates and evidence

`.READY` markers record what a gate certified ([READY.md](READY.md) lists
them). Bulk run output lives outside git in a content-addressed store
([evidence/README.md](../../../evidence/README.md)). Dated measurement reports
are indexed in [results/](results/README.md); the current performance numbers
are in the latest review (`arch/review/R11-REVIEW.md`). `make loc` prints the
owned-source line inventory.
