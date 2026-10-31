# An agent workstation made of versioned files: a Sofort design

Research date: 2026-10-31. Source baseline: `/Users/noah/code/sofort`, HEAD `39f276950e7b061ce035c62d616ef426ca61d721`. **Research only:** repository and primary web-source reads; no builds, tests, benchmarks, containers, Linux instances, or VMs were run. This Markdown report is the only file created. Existing untracked work was left alone.

Evidence vocabulary: **Current** describes inspected source; **Reported** attributes an existing experiment without reproducing it; **Proposed** describes this architecture. Estimates and performance expectations are engineering judgments, not measurements. Local `file:line` pointers refer to the baseline above; older research reports describe their own earlier revisions. External specifications below are design references, not evidence of Sofort compatibility.

## Summary

- **Use three different mechanisms:** a disposable VM execution snapshot, a persistent workspace tree, and an external-tool invocation ledger. They have different lifetimes and cannot form one universal rollback transaction.
- **Make `/mcp` a protocol expressed through files.** Stage JSON arguments, explicitly submit once, then read immutable results and receipts. Ordinary `read`, `stat`, directory listing, and close must not accidentally repeat actions.
- **Keep mediation on the host.** The guest kernel translates file operations into bounded records; the host independently authenticates the run, resolves capabilities, validates arguments, checks effects, and invokes providers.
- **Preserve MCP's structured result and error distinction.** JSON is authoritative; text is a documented projection; binary content uses scoped blob handles. Filesystem errors use errno, while tool-domain failures remain inspectable result objects.
- **Build persistent versions from immutable blobs and directory trees.** Atomically publish one branch reference after validating a complete guest delta. APFS/btrfs/ZFS clones are optional storage accelerators, not the versioning contract.
- **Extend scratch deliberately.** The pathfs note proposes transient RAM scratch, not persistence. Editing existing workspace files additionally needs a `/work` lower tree, copy-up, deletion tombstones, coherent inode lifetimes, and export.
- **Start every attempt from an explicit base root.** A fresh VM plus a fresh workspace branch isolates retries; successful reset does not undo an external action or erase files intentionally committed for later commands.
- **Use a host command graph for the MVP.** Launch prepared static programs directly, with explicit argv, cwd, environment, streams, dependencies, and exit status. A limited shell frontend must reject unsupported constructs.
- **Do not promise a real BusyBox shell yet.** General ash scripts need guest process creation, exec, pipes, wait, descriptor duplication, and signals; these are connected missing subsystems.
- **The current native path is the integration gap.** It has binary output and late-bound read-only files, but no tool calls, writable workspace export, runtime stdin stream, arbitrary environment, or live executor-level output.
- **Plan approximately 5–8 weeks for a narrow reviewed prototype**, assuming an engineer familiar with this code and available independent review. Full shell compatibility, unrestricted repositories, Node, and large workspaces are separate projects.
- **Qualify on external infrastructure.** Stateful filesystem histories, hostile protocol tests, crash recovery, A→B→A reset tests, and pinned ARM64 Linux comparisons must precede any claim of Linux-equivalent behavior.

## Architecture diagram

```text
                         TRUSTED HOST / workstation service
 Agent/UI
    |
    v
 Command graph: argv, cwd, env, base root, grants, budgets, attempt ID
    |                         |                         |
    |                         |                         +--> session/workspace provenance
    |                         +--> immutable tree/blob store + commit/ref database
    |                                      ^                  |
    |                                      | validated delta  | snapshot projection
    v                                      |                  v
 Engine/Session broker <----------- workspace transaction manager
    |          |
    |          +--> MCP capability resolver --> policy --> credential issuer
    |                                      |                  |
    |                                      v                  v
    |                            durable invocation ledger --> provider/MCP client
    |                                      |
    |                            scoped immutable result/blob store
    |
    | authenticated, versioned, bounded IPC; generation and stream credits
----+---------------- ENGINE CONFINEMENT BOUNDARY --------------------------
    v
 Rust worker: HVF or KVM slot, decoder, watchdog, transport, snapshot reset
    |
    | shared ring + doorbells; no raw host directory mount or credentials
----+---------------- VM BOUNDARY -----------------------------------------
    v
 Guest kernel: one authoritative namespace/path walker and typed file handles
    |-- /bin, /lib/...  immutable prepared program/profile resources
    |-- /work          immutable workspace base + per-command RAM upper
    |-- /tmp           disposable RAM tree, never automatically committed
    |-- /mcp           synthetic catalog/request/result/control files
    |-- fd 0/1/2       bounded input/output channels
    v
 One static program at EL0

 Pipeline: VM A stdout --> bounded host channel --> VM B stdin
 Each stage has its own base/upper. Workspace writes are private until publish.
 Engine snapshot reset discards execution state; workspace commits survive.
 External tool effects survive independently and are recorded, not rolled back.
```

This is a proposed extension of the existing host-policy/engine/guest split, not a new trust arrangement. Current architecture: `arch/jitk/docs/ARCHITECTURE.md:3`, `:29`, `:108`; execution interfaces: `arch/jitk/executor/engine.ts:7`, `:37`. The engine and guest, including EL1, remain untrusted relative to host policy and storage authority.

## 1. MCP-as-files semantics

### 1.1 Namespace and invocation lifecycle

**Proposed layout**, with server/tool aliases assigned by the host and mapped to exact upstream identities:

```text
/mcp/catalog.json                                      pinned visible registry
/mcp/<server>/tools/<tool>/schema.json                  input/output schemas
/mcp/<server>/tools/<tool>/policy.json                  non-secret grant/effect summary
/mcp/<server>/tools/<tool>/requests/<request>/
    input.json                                        bounded, mutable before submit
    submit                                            write-only control endpoint
    status.json                                       host state, snapshot per open
    result.json                                       immutable complete MCP result
    result.txt                                        documented text-block projection
    events.ndjson                                     optional progress/event channel
    blobs/<opaque-id>                                  scoped binary result content
    receipt.json                                      redacted host-authored receipt
/mcp/<server>/resources/catalog.json                    cached resource descriptors
```

The names above describe a file protocol, not ordinary disk-backed files. Request creation allocates a run-scoped object; it does not invoke the upstream tool. A guest-chosen hexadecimal request name is only a local correlation key. The host assigns the authoritative invocation ID and scopes it to tenant, run, generation, server and tool. Reuse with different input is an error. Do not expose credentials, approval tokens, or reusable upstream cursors as pathname components.

| Operation | Proposed meaning | Must not happen |
|---|---|---|
| `stat`, `open` catalog/schema, `getdents64` | Read locally pinned registry metadata | Invoke tools or enumerate a remote data set implicitly |
| `mkdir requests/<request>` | Allocate a bounded request object | Treat arbitrary directory creation as an external action |
| `write/pwrite input.json` | Stage bytes with normal offsets/truncation | Invoke once per write chunk |
| `write submit` | Accept exactly one fixed control record, e.g. `1\n`, in one operation; seal and submit the entire staged input | Invoke on incomplete JSON, close, flush, or background writeback |
| Repeated identical submission | Return the same admission/status for this invocation | Create another provider call |
| `open/read result.json` | Wait for terminal result or return `EAGAIN` if nonblocking; read the same immutable bytes by offset | Re-run the tool on short read, seek, reopen, or retry |
| `open/read status.json` | Pin a current status representation for that open description | Mix different JSON generations within one read sequence |
| Close staged request | Release a handle; unsubmitted requests expire with the run | Submit implicitly |
| Cancellation endpoint, later | Request cancellation of an identified invocation | Assert that a remote effect was undone |

Define states explicitly: `staged → accepted → awaiting-approval/running → succeeded/tool-error/denied/cancelled/unknown`. Submission succeeds when the host durably admits the request, not when its remote effect succeeds. `result.json` becomes readable once terminal; status and receipt distinguish a tool result from an outcome that is unknown after transport loss. Pending approval can resume under a host-authenticated exact-call grant; unattended callers fail closed or receive a pending state under their declared contract.

The `submit` operation is intentionally a device/control-file convention. Reject extra bytes, nonzero offsets, and malformed records without side effects. `writev` must validate and combine its bounded vectors as one control operation; do not accidentally dispatch once per vector. Repeated valid submission is idempotent at the host ledger. A small proposed `mcp-call` guest utility can stage, submit, wait, print, and choose a useful process exit status; it must use the same file interface and authority checks as arbitrary CLIs. It does not exist today.

**Decision on “read = call?”** No generic tool invocation on read. Parameterized reads and actions use the explicit lifecycle above. A later read-only resource adapter may acquire a remote version once per open, but only under a host-declared safe resource contract, with a recorded fetch identity and pinned bytes afterward. Even apparent reads can cost money, audit access, or return time-dependent data; MCP annotations alone must not authorize speculative calls. The MCP tools specification explicitly distinguishes discovery, invocation and structured output, and treats tool annotations as untrusted unless the server is trusted. [MCP tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools).

### 1.2 Views, directory pagination, streaming and large results

**JSON:** retain the validated complete MCP result envelope, including `content`, `structuredContent` when present, and `isError`. Preserve supported metadata instead of flattening every result into a string. `result.txt` concatenates only text blocks under a specified separator convention; it is a lossy convenience view and must not decode images or silently fetch linked resources. Binary content lives in immutable, tenant-scoped blobs with declared type, length and host-computed digest. URLs/resource links are references, not authorization to fetch them.

**Directories:** `getdents64` returns stable entries and cookies for an opened directory snapshot. Tool discovery can be paginated by the host before pinning the admitted registry, with a declared catalog-size bound. Large resource catalogs should expose explicit list requests and page result files, with opaque host page handles. Advancing to another page is an explicit mediated operation. Do not map `readdir` offsets to remote numeric pages or silently cap a listing while presenting it as complete. Remote collection data belongs in result files, not millions of synthetic directory entries. MCP uses opaque cursors and does not promise a fixed page size or cross-session cursor reuse. [MCP pagination](https://modelcontextprotocol.io/specification/2025-11-25/server/utilities/pagination).

**Streaming:** distinguish progress from result bytes. `events.ndjson` can expose numbered progress records if the provider supports them; it must not invent incremental JSON output from an ordinary single-result MCP response. A byte-stream adapter needs an explicit capability with `stream ID, offset, bounded chunk, EOF/error` and credit-based flow control. It must retain a terminal status so an early EOF cannot masquerade as success. Live streams return `ESPIPE` for seeking and reject mmap; completed blob/result files support offset reads without replay. Native pipeline bytes and MCP result data need separate record types and budgets.

**Large results:** spool validated host results once, then serve bounded chunks or blob range reads; do not load the entire result into guest RAM just because the ring supports chunking. Charge storage, cumulative bytes, outstanding reads, and lifetime separately. A non-streaming provider may still materialize its whole response in host memory; enforce a provider/transport response cap before or during accumulation. Serving a blob lazily does not solve that upstream memory limit. The first release should fail oversized calls explicitly and offer provider-level pagination, then add larger spools behind measured quotas.

Current constraints are concrete: `arch/jitk/protocol/dispatcher.ts:2` bounds frames/inflight/wire work; `:36` and `:139` validate JSON/calls; `:165` tracks IDs and outstanding work. Ring replies already fragment without a guest reply buffer (`arch/jitk/kernel/src/ring.rs:13`, `:436`), but native mode bypasses the call pseudo-fds (`:331`), and its host receiver rejects unnegotiated message kinds (`arch/jitk/shard/src/streams.rs:149`). Current ABI caps include 1 MiB call payloads and class-dependent replies up to 4 MiB, not unbounded file streams (`arch/jitk/abi/src/lib.rs:219`, `:227`). The proposed filesystem therefore needs a negotiated native tool/result extension, not merely new path names.

### 1.3 Errors, consistency, authorization and receipts

| Condition | Filesystem/control response | Persistent detail |
|---|---|---|
| Missing/invisible entry | `ENOENT` | Avoid leaking hidden tool/resource existence |
| Invalid staged JSON/schema/control record | `EINVAL` | Redacted validation detail; no invocation |
| Known entry but operation forbidden | `EACCES` or `EPERM`, by documented policy class | Host decision and policy revision |
| Stale generation/expired object | `ESTALE` | Object/run identity, never a guessed new handle |
| Nonblocking result not ready | `EAGAIN` | Current status |
| Local deadline before admission | `ETIMEDOUT` | No invocation |
| Timeout/disconnect after invocation | Terminal `unknown`; result access can report `EIO`/`ETIMEDOUT` per contract | Receipt must say effect may have happened |
| Provider's normal `isError:true` result | Successful read of the error result JSON | Structured tool-domain error, not automatic `ENOENT` |
| Quotas | `E2BIG`, `ENOSPC`, `EMFILE`, or admission `EAGAIN`, according to resource | Limit name and charged usage |
| Seek on a live stream | `ESPIPE` | No replay |

Errno is a compact mechanism for failed filesystem operations, not a complete MCP error taxonomy. Preserve the tool/protocol error distinction so agents can inspect actionable business failures. A host-approved adapter may additionally expose a narrow domain-specific errno mapping, but it must retain the original redacted result. [MCP error handling](https://modelcontextprotocol.io/specification/2025-11-25/server/tools).

**Consistency:** pin registry/schema revisions per run, request input at submission, and result bytes per invocation. Start with no cross-invocation result cache. Later cache only host-declared safe reads, keyed by tenant/principal, scopes, provider/tool/schema version, normalized arguments, policy/redaction version, and upstream version or explicit TTL. Recheck current access rights on cache hits, preserve provenance, record the cache hit, and invalidate relevant entries after writes. Do not cache approval or turn an old successful response into evidence that a new remote write occurred. Workspace snapshots cannot snapshot remote services; record observation times and versions, and use provider preconditions such as ETags where available.

**Authorization:** filter the visible tree by grants, but enforce each operation again at the host broker. Mode bits are descriptive, not sufficient authority. Bind every handle to authenticated transport/run identity, generation, permitted tool/resource, and operation. Validate the actual normalized arguments and destination, not just a pathname saying “read.” Use host-issued per-call credentials; `policy.json` may explain effects and approval requirements but cannot alter them. Existing effect declarations and single-use grants are useful foundations (`arch/jitk/executor/policy/policy.mjs:41`, `:62`, `:99`, `:106`). Existing dispatch rechecks taint before invoke (`:125`) and redacts failures (`:135`); retain those checks for file-originated calls.

**Receipts:** add an append-only host invocation ledger. Before invoke, persist an intent with invocation/attempt IDs, base root, exact provider/tool/version, argument digest, policy revision/decision, approval digest if applicable, and principal/scope identifiers without credentials. Afterward record sanitized outcome, content hashes, timing, provider operation ID/idempotency key if supported, and whether the result was observed or uncertain. `receipt.json` is a redacted projection; an integrity-protected host log is authoritative. Tie the workspace commit to its invocation receipts, but do not claim a distributed transaction across them.

Current policy supplies `${run.id}:${call.id}` as an idempotency key (`arch/jitk/executor/policy/policy.mjs:133`); a new run gets a new ID (`:52`). This prevents neither repeated logical actions across attempts nor duplicates at providers that ignore the key. Stable logical-operation deduplication needs an explicit host-approved key bound to the exact action; a changed action needs a new authorization. After a crash between provider effect and receipt, query by provider operation ID or reconcile manually; do not auto-retry irreversible writes. Current benchmark receipt helpers (`arch/jitk/executor/receipt-path.ts:5`) and entropy/checkpoint receipts (`arch/jitk/abi/src/lib.rs:258`) are not this audit ledger.

### 1.4 What to copy from Plan 9 and FUSE

| Reference | Copy the design | Sofort-specific constraint |
|---|---|---|
| Plan 9/9P | Hierarchical synthetic services; per-open fids; separate stable object identity and version; offset/count I/O; negotiated message bounds; tagged requests and cancellation | Keep the existing ring/IPC transport initially. A path is a discovery surface; an authenticated host handle conveys authority. Cancellation cannot reverse an external action. |
| Plan 9 `/net` | Separate allocation/control/status/data files, which make stateful services comprehensible to ordinary file consumers | Its `clone` pattern inspires request allocation, but opening generic result files must not allocate or repeat external actions. |
| FUSE | Typed open handles; explicit open/read/write/readdir/release methods; inode lifetime and directory cookies; clear cache and invalidation rules | Implement a small guest VFS backend and host broker, not a Linux FUSE module or a macOS FUSE dependency for the MVP. |
| FUSE control-file lesson | Direct, bounded I/O for effectful endpoints; separate staging from submission | Avoid writeback caching, mmap, read-ahead, and close-triggered action execution on `/mcp` controls. |

9P's actual contract includes fids, qid identity/version, bounded offset reads/writes and flush cancellation; it does not make arbitrary RPCs transactional. [9P introduction](https://9p.io/magic/man2html/5/0intro), [9P I/O](https://9p.io/magic/man2html/5/read). Plan 9's IP service explicitly separates numbered conversations and `ctl`/`data`/`status`, with allocation through `clone`. [Plan 9 IP device](https://9p.io/magic/man2html/3/ip).

FUSE's writeback cache can delay or combine writes, and direct I/O bypasses its page cache/read-ahead. Its flush can occur multiple times; release's return value is ignored. Those properties make close/release unsuitable as the only action submission or failure channel. Copy the handle and lifecycle discipline, and keep explicit submit/result semantics. [FUSE I/O modes](https://kernel.org/doc/html/latest/filesystems/fuse/fuse-io.html), [libfuse operations](https://libfuse.github.io/doxygen/structfuse__operations.html).

## 2. Persistent workspace and per-command writes

### 2.1 Versioning contract and storage choice

**Proposed authoritative model:** immutable content-addressed blobs; immutable directory trees containing byte-name, kind, supported mode/metadata and child-object references; commits containing parent root(s), resulting root, command/attempt metadata and receipt references; and a transactional database holding mutable branch refs. Hash a canonical, versioned encoding with domain separation. Preserve filename bytes in a reversible wire encoding, rather than imposing host Unicode normalization. Hashes provide integrity/deduplication, not permission: access always requires tenant/workspace authority.

Creating an attempt is cheap: assign `attempt ID + base commit + new branch/ref`, then launch a clean execution snapshot. Branching does not copy the logical tree. A small initial implementation may store whole changed-file blobs rather than chunked extents; add chunking when large-file evidence justifies it. This resembles Git's blob/tree/commit separation, without requiring a Git index, shelling out to Git, or importing Git's exact object format. [Git objects](https://git-scm.com/book/en/v2/Git-Internals-Git-Objects).

| Mechanism | Appropriate role | Why it is not the entire workstation design |
|---|---|---|
| Guest lower/upper overlay | Immutable command base plus isolated writes | Needs export, versions, publish logic, and lifetime rules |
| Linux OverlayFS | Source of copy-up, deletion-whiteout and merged-directory lessons | Linux-specific; mounting it on the laptop would violate this task; layer directories are not an atomic history |
| APFS clones | Optional efficient host materialization/cache on macOS | Cloning one path is not a multi-file publish/merge protocol; use immutable source trees and explicit ref transactions |
| btrfs snapshots/reflinks | Optional Linux-host acceleration and retention | Snapshot/subvolume boundaries and nested subvolumes need an explicit contract; no application conflict policy |
| ZFS snapshots/clones | Optional dataset-level branching/materialization | Dataset lifecycle/clone ancestry and platform operations remain separate from per-command grants/merges |
| Content-addressed tree + transactional ref | Portable logical history, branching, replay and atomic visibility | Requires quotas, recovery, GC, metadata design and optional materialization adapters |

OverlayFS documents copy-up and whiteouts/opaque directories; reuse these concepts rather than making deletion “absence from the upper.” [OverlayFS](https://docs.kernel.org/filesystems/overlayfs.html). Apple documents APFS cloning for files/directories; btrfs shares roots/extents across snapshots; ZFS supplies read-only snapshots and writable clones. None supplies Sofort's authorization or conflict rules. [Apple APFS](https://developer.apple.com/documentation/foundation/about-apple-file-system), [btrfs design](https://btrfs.readthedocs.io/en/stable/dev/dev-btrfs-design.html), [btrfs subvolumes](https://btrfs.readthedocs.io/en/stable/btrfs-subvolume.html), [OpenZFS snapshots and clones](https://openzfs.github.io/openzfs-docs/Basic%20Concepts/Datasets/Snapshots%20and%20Clones.html).

### 2.2 Guest scratch is the write set, not the durable filesystem

**Current:** the archive contains only file and directory extents; data is immutable and kernel-only (`arch/jitk/kernel/src/fs.rs:1`, `:13`, `:204`). Native input is a bounded late-bound read-only archive, at most 4 MiB (`:210`; `arch/jitk/abi/src/lib.rs:253`). `openat` refuses archive writes (`arch/jitk/kernel/src/syscalls/openat.rs:47`); `write` handles stdout/stderr only (`arch/jitk/kernel/src/syscalls/write.rs:13`). The pathfs note explicitly proposes RAM scratch that is never persisted or visible to the host (`arch/jitk/grow/EXPERIMENTS-PATHFS-2026-10-27.md:267`). It does not implement workspace persistence.

**Proposed mounts:** keep `/` and program resources immutable; give `/tmp` a separate disposable RAM tree; mount the chosen version under `/work` as immutable lower data with a mutable RAM upper; start cwd at `/work`. This needs a `/work` overlay, but not a writable overlay over the entire root. The earlier scratch proposal rightly avoided root whiteouts for its measured workload; a persistent editor workload adds the narrower requirement to replace/delete existing `/work` entries.

Implement a reviewed shared primitive layer before growing handlers:

1. Stable mount/node identity, directory entries, reference-counted open-file descriptions, fd references, cwd/root locations and bounded page-chunked storage. Preserve the existing separation of descriptor and open description (`arch/jitk/kernel/src/fs.rs:38`, `:51`, `:73`), including shared positions for dup and independent positions for independent opens.
2. One component-wise path walker used by all `*at`, metadata, directory and access operations. Real cwd must change later relative lookup and `getcwd`; the current console `chdir` merely validates and returns zero, and ring builds return ENOSYS (`arch/jitk/kernel/src/syscalls/chdir.rs:2`; `getcwd.rs:6`; `fs.rs:324`).
3. Lazy copy-up on the first data/metadata mutation of a lower node, retaining coherent identity for existing open handles; untouched lower files remain borrowed immutable extents. A simple bounded first version can copy the whole file. Preserve unlink-open-file lifetime; do not free contents just because a name disappears.
4. Tombstones for deleted lower names, coherent directory merging, and correct replace/rename rules. Export the final namespace delta, not physical overlay implementation files. Initial file rename/replacement is tractable; lower-directory rename, hardlinks and symlinks need their own qualification and may be explicitly unsupported in the narrow MVP.
5. Reserve quota before mutation, including temporary copy-up/truncate/rename storage. Zero holes and reallocated bytes; roll back a failed operation's internal allocations. Account scratch data, metadata, fds and staged MCP requests separately. A proposed starting profile is 2 MiB changed-file data, 2,048 mutable entries and 128 fds, subject to actual arena-fit qualification—not a demonstrated capacity.

Do not blindly increase `MAX_FDS=64`: the JS ring path intercepts numeric fds 100–104 and 129–4224 before the normal dispatcher (`arch/jitk/kernel/src/fs.rs:43`; `ring.rs:320`; `user.rs:215`). New native filesystem handles must dispatch by installed descriptor kind, with control endpoints inaccessible as ordinary unallocated numbers. Keep any legacy JS pseudo-fd ABI explicitly separate. All syscall paths, including readv/writev/pread/stat/lseek/poll/dup, must resolve the same objects; current handlers contain archive/console-specific branches (`syscalls/readv.rs:4`, `writev.rs:7`, `pread64.rs:15`, `lseek.rs:13`, `syscalls.rs:97`).

The MVP importer must declare its supported tree: regular files/directories and selected metadata, within current archive bounds. Reject unsupported symlink/special-file inputs explicitly rather than silently dereferencing them or pretending to preserve a general repository. Current archive modes are fixed 0444/0555 (`arch/jitk/kernel/src/fs.rs:276`); preserving executable bits and mutable metadata needs a versioned archive/projection extension. Larger repositories need a later on-demand immutable file/block service or larger admitted projection; native's current 64-file/4-MiB path is not an arbitrary repository mount (`arch/jitk/executor/native-backend.ts:25`).

For `/work`, `fsync` means “completed into this command's scratch state,” not “durable in the workstation.” The authoritative durable event is host commit acknowledgement after command completion. Document that distinction; guest `fsync` cannot promise survival of a VM crash before export. `/tmp` remains deliberately nonpersistent. The reference research makes the same warning and recommends reviewed primitives over isolated generated handlers (`arch/research/growos-node/02-COMPAT-KERNELS.md:230`, `:243`).

### 2.3 Export and atomic host commit

**Proposed protocol**, added to the negotiated native ABI and worker IPC:

1. Host records `attempt/base-root/target-ref/expected-ref-generation`, namespace grants, quotas, kernel/profile hashes, argv/cwd/environment and initial provenance before launch.
2. On normal program exit, the kernel freezes mutations, emits an export manifest and changed-file chunks, and finally emits terminal exit/export totals. Use separate `WORKSPACE_BEGIN`, `PUT_CHUNK`, `REMOVE`, `WORKSPACE_END`-style records; identifiers, lengths, offsets and hashes must be independently checked. A normal nonzero exit is still a complete command and can have meaningful writes.
3. The worker forwards bounded records; the trusted host validates every final path, type, size, duplicate/conflicting entry, chunk sequence, deletion, supported metadata and quota. Recompute blob/tree hashes on the host. Treat the entire guest export as hostile; a claimed base hash, receipt or “complete” flag is not authority.
4. Write blobs/tree/commit objects durably before making them reachable from the branch ref. Use one transactional metadata store for ref generation, attempt outcome and receipt references; synchronize object storage and required directories under the chosen durability policy before that transaction. Readers pin one committed root and cannot see half the tree.
5. Compare-and-swap the target ref against the original base/generation. Publish all changes or none. Return the committed root/ref status only after this step. A crash after publish but before response is resolved by querying the durable attempt ID; never re-execute just to learn whether commit happened.
6. After final export/ack handling, release/reset the execution slot and drop run-scoped file/blob capabilities. An incomplete export, VM fault, timeout, cancelled run, malformed protocol or host storage failure does not advance the branch. Retain any diagnostic/partial output separately with an explicit incomplete state.

Normal completed commands should retain an immutable attempt snapshot even with nonzero status. A sequential shell-like session may advance its branch on every complete valid exit, matching the fact that failed Unix commands can leave files behind. “Publish only exit 0” is an optional declared task policy, not a silent rollback rule. Nonzero exit, sandbox failure, output truncation and commit conflict need separate result fields. Current native completion contains only exit code/output-limit/totals (`arch/jitk/kernel/src/ring.rs:577`); the host executor result is likewise only captured streams/status (`arch/jitk/executor/native-backend.ts:309`). Export and commit acknowledgement are new work.

An immutable root is atomically visible to consumers using this workspace API. Exporting it into a user's ordinary host checkout is a separate materialization operation: a sequence of file replacements is not automatically atomic to arbitrary host processes holding paths/fds. Keep managed roots as the execution contract; expose a reviewed diff/export when synchronizing with the live checkout. Garbage collection must trace refs, active base pins, retained attempts, receipt references and in-flight staged objects before deleting unreachable blobs.

### 2.4 Parallel commands and fork-per-attempt

Start sibling commands from the same explicit base, each with a private upper. Default publication is conservative: if the branch head moved, report conflict and retain the candidate branch; no silent last-writer-wins and no automatic re-execution after external effects. Example: A and B both start at root R; A publishes R→A; B's R→B compare-and-swap fails even if their edited paths differ. This is deliberately simpler to defend than incomplete read/write conflict detection.

Later disjoint-path merges may compare node/subtree versions and detect write/write and delete/rename/ancestor conflicts. They are not serializable merely because writes do not overlap: A can read `config` and write `output`, while B changes `config`. Correct automatic serializable rebasing needs observed read dependencies, including absent-name lookups, directory listings, metadata, aliases and predicates, plus external preconditions where relevant. With a guest-readable archive, a hostile guest can omit its own read journal; do not use that journal as a security certificate. Keep head equality or capture reads at a trusted host service if serializability is required.

For retries, fork both execution and workspace state from the selected base, assign a new attempt ID, and inspect the previous invocation ledger before repeating actions. Only an explicit dependency/promotion exposes one attempt's files to another. The current snapshot reset mechanism restores execution memory/registers/ring state; it is not workspace branching or a storage conflict protocol (`arch/jitk/shard/src/slot/reset.rs:3`, `:148`).

## 3. Commands, shells and inter-VM streams

### 3.1 Choose an explicit host command model first

**Proposed job:** `{profile/program identity, argv, cwd, env, baseRoot, stdin bindings, output bindings, grants, quotas, deadline, attemptId}`. Resolve admitted executable identities on the host; never evaluate user text through the host shell. Pin profile hashes separately from mutable workspace files so a previous command cannot silently replace the next tool. A later feature may execute reviewed workspace binaries under a distinct grant/profile.

Host orchestration handles sequence, dependencies, bounded loops, conditionals, `&&`/`||`, pipeline edges, redirections and scoped session state as an explicit graph. `cd`, assignments and export are graph/session operations; they do not require launching a VM and expecting its cwd/environment to survive. Subsequent jobs receive the resulting explicit state. Parenthesized/subshell scopes copy that state; pipeline stages have isolated copies. Do not implement a shell by splitting on spaces or pipes: quoting, expansions and redirection ordering must be parsed.

The first frontend should accept structured commands and optionally a documented grammar subset: literal/quoted argv, `;`, `&&`, `||`, `|`, and selected redirections. Reject command substitution, functions, traps, job control, process substitution, arbitrary expansion and unsupported scripts before launch. Add globbing against the pinned workspace only if its ordering and no-match behavior are specified. This is a Sofort command language until a complete shell contract is qualified. GNU Bash documents last-command/pipefail status behavior and shell execution environments; borrow precise rules only for the advertised subset. [Bash manual](https://www.gnu.org/s/bash/manual/bash.html).

Workspace semantics intentionally differ from a normal shared-filesystem pipeline. Each stage sees its own base plus writes; another stage sees bytes through the pipe but not uncommitted filesystem changes. Thus `generate-file | read-generated-file` has no implicit shared-file guarantee. Use a sequencing dependency for that workflow, or later an explicitly shared transaction with a much harder concurrency model. For `a | b > out`, stage A and B create separate attempt roots; the host creates `out` in B's branch before execution, preserving any completed partial output on nonzero exit under the declared publish policy. Do not promise atomic publication of the whole multi-VM pipeline merely because each stage is atomic.

### 3.2 Streaming contract and scheduling

**Current:** native fd 0 returns EOF unless redirected through the narrow archive-to-stdin dup path (`arch/jitk/kernel/src/ring.rs:218`, `:224`, `:331`; `fs.rs:167`). Native fd 1/2 preserve arbitrary bytes (`ring.rs:543`); console-profile ASCII constraints remain on a different path (`arch/jitk/protocol/PROTOCOL-v1.md:30`; `kernel/src/user.rs:168`). Do not cite the console ASCII restriction as a native pipeline blocker.

However, the Rust native receiver accumulates stdout/stderr (`arch/jitk/shard/src/streams.rs:14`, `:82`); `inputs::response` serializes them together after completion (`inputs.rs:207`); the Node adapter emits stream events only after a complete response frame (`arch/jitk/executor/native-backend.ts:237`, `:258`). The worker serves one request synchronously at a time (`arch/jitk/shard/src/inputs.rs:237`), and its pool currently admits one active native session (`arch/jitk/mcp/native.mjs:36`). The interface's event names do not establish live streaming.

**Required extension:** typed `STDIN_DATA/EOF`, `STDOUT_DATA`, `STDERR_DATA`, `WINDOW_UPDATE`, `CANCEL`, tool-call/result and workspace-export records on multiplexed worker IPC. Retain generation, channel ID, monotonic offset, per-record bounds, aggregate quotas and explicit terminal status. The guest kernel must demultiplex stdin and tool replies from the same RX transport without head-of-line deadlock. Add descriptor-kind readiness and interruptible/host-wake parking; do not hold `fs.rs`'s exclusive callback guard across a wait or host round trip (`arch/jitk/kernel/src/fs.rs:97`; `kernel/src/syscalls.rs:89`).

Use bounded host queues and credit, never unbounded concatenation. A sender blocks when its downstream has no credit, while the engine continues draining unrelated control/exit channels. Downstream close produces `EPIPE`; proper SIGPIPE delivery is later process-model work, so the MVP must explicitly document EPIPE-only behavior. Producer EOF closes consumer stdin; a crashed producer additionally marks the pipeline failed. A cumulative byte/storage limit is separate from an in-memory queue bound, and quota exhaustion must not be reported as clean EOF.

Scheduling is part of correctness. A streaming pipeline needs enough simultaneously runnable sessions for its communicating stages. The single-session native worker cannot run A and B concurrently; bounded buffering alone would deadlock A before B can start. For the MVP either use separate admitted native worker processes for stages, under an overall resource cap, or use completion-to-spool pipelines and label them non-live. A later multiplexed owner loop can serve multiple slots. On HVF there is one VM per process (`arch/jitk/shard/src/hvf.rs:1`); KVM supports multiple slots/vCPUs per process (`kvm/mod.rs:1`), but the current native request loop still serializes them. Reserve graph capacity or spool safely rather than starting a pipeline that cannot make progress.

### 3.3 Real ash and process requirements

Running `busybox ash -c ...` directly in one VM is a sensible eventual compatibility mode, but its isolation unit becomes the entire shell command/job containing child processes. It no longer means one isolated VM for every external simple command. Moving each ash child into a separate VM would require a new distributed process ABI for pid/wait/signals/fds/shared memory; do not hide that inside `execve`.

General ash needs process/task state, supported fork/clone or vfork semantics, ELF exec with address-space replacement, wait/reaping, pipes, dup2/dup3 and close-on-exec, inherited environment/cwd, signal masks/delivery and often process groups/terminal ioctls. A single vCPU can schedule these tasks, but blocking pipe I/O and wait must switch tasks rather than park the whole VM. BusyBox's nofork/standalone applet optimizations do not remove all these requirements or support arbitrary external executables; its own FAQ also notes the standalone executable-path dependency. [BusyBox FAQ](https://www.busybox.net/FAQ.html), [upstream ash vfork change](https://lists.busybox.net/pipermail/busybox-cvs/2025-August/042214.html).

Current kernel startup enters one packed program (`arch/jitk/kernel/src/user.rs:26`), with only `PATH=/` in env (`:62`). `fcntl` explicitly says there is no exec (`arch/jitk/kernel/src/syscalls/fcntl.rs:1`); absent handlers dispatch ENOSYS (`arch/jitk/kernel/generate.ts:53`, `:73`); signal handlers return ENOSYS (`syscalls/rt_sigaction.rs:1`, `rt_sigprocmask.rs:1`). The loader admits only static AArch64 ET_EXEC and forbids dynamic/interpreter segments (`arch/jitk/kernel/packer.ts:132`). The existing kernel assumptions rely on a stopped EL0 and one masked-IRQ trap context (`arch/jitk/kernel/src/arch/aarch64/trap.rs:19`; `syscalls.rs:6`). These are architectural gaps, not a few missing syscall numbers; the Node roadblock report similarly ranks task/scheduler work as substantial (`arch/research/growos-node/04-ROADBLOCKS.md:17`, `:37`).

For the host graph MVP, pass an explicit allowlisted environment with size/NUL checks and a real starting cwd. Do not confuse the worker's sanitized host environment (`arch/jitk/executor/engine.ts:118`) with guest env support. Preserve native exit codes 0–255, per-stage statuses, output-limit and commit status separately. Define optional pipefail as the rightmost nonzero stage status; control-plane cancellation/deadline/transport failure is an operational failure, not a forged guest exit 0. Current `native_finish` masks to eight bits (`arch/jitk/kernel/src/ring.rs:581`); there is no full guest wait/signal status yet.

## 4. Security and failure boundaries

### 4.1 What one command per VM buys—and what it does not

**Buys:** a small capability lifetime, bounded RAM/CPU/output, loss of in-memory processes/hooks/cached credentials between runs, a reviewable filesystem delta before publication, and no ambient guest host-network access when all external calls go through the broker. Failed attempts can be discarded without contaminating the next execution image. Existing per-run generation/record validation, deadlines, confinement and reset machinery are valuable foundations (`arch/jitk/shard/src/streams.rs:50`; `slot/reset.rs:148`; `kvm/native.rs:1`; `hvf/native.rs:342`).

**Does not buy:** rollback of an email/payment/tool write; safe tool content; prevention of private-data egress through an allowed tool, stdout, artifact, filename or encoded workspace file; safe code intentionally committed into a startup/config script; immunity to guest-kernel/VMM/host-broker bugs; complete side-channel isolation; or protection from resource exhaustion without quotas. A persistent workstation intentionally carries files between commands, so it preserves both useful work and malicious persistent modifications unless publish policy restricts them.

Treat stdout, result files, workspace commits, pipe traffic and exported artifacts as information-flow edges. Current taint is sticky and whole-run, with private-read plus egress and untrusted-read plus write checks (`arch/jitk/executor/policy/policy.mjs:78`, `:90`). Carry conservative labels through the workspace base, arguments/environment derived from prior outputs, pipeline edges, cached results and session history, with host-owned joins. Do not accept guest-written “public” metadata as declassification. A fresh VM must not reset conversation/workspace taint.

The executor supports provenance input/output (`arch/jitk/executor/executor.ts:15`, `:62`, `:130`), but the current MCP wrapper returns `{result,logs}` and omits that provenance (`arch/jitk/mcp/jitk.mjs:93`). A long-lived workstation needs server-side session/workspace label retention; relying on the current MCP caller to remember discarded labels would bypass the intended cross-run policy. Separate-workspace or cross-principal export needs an explicit policy decision too.

### 4.2 Path traversal, symlinks and TOCTOU

Use a virtual namespace and immutable host object IDs, never concatenate guest paths onto arbitrary host filesystem paths. Reject embedded NUL, oversize components/depth, invalid encodings and unknown mount crossings; walk `.`/`..` with mount-aware root confinement. Route `/work` and `/mcp` from a shared namespace resolver so `/work/../mcp` cannot take a different policy path. Use exact server/tool alias maps; percent decoding, Unicode normalization, separator handling and case folding must have one specified boundary.

The current archive walker bounds path length, resolves components and clamps root ancestry (`arch/jitk/kernel/src/fs.rs:297`, `:324`), but has no symlinks (`syscalls/readlinkat.rs:1`). Keeping symlinks unsupported in the first persistent projection is defensible. When adding them, interpret targets in the guest namespace with bounded traversal and Linux-compatible final-follow/no-follow rules; never follow a guest symlink in the host namespace. Absolute symlinks are guest-root-relative, and transitions into `/mcp` must still enforce the destination capability. Hardlinks must not connect special/control nodes or cross mounts.

For import/export into ordinary host directories, use descriptor-relative, no-follow component traversal and trusted staging directories with no untrusted concurrent writers, with a platform-appropriate beneath-root mechanism where available. `realpath` validation followed by pathname reads is insufficient against replacement between check and use. The present MCP resource reader does exactly that sequence (`arch/jitk/mcp/server.mjs:34`), so it is a useful static-root adapter, not a design to extend to hostile concurrent writable trees. Linux's pathname documentation explains why resolving names involves object lifetime and synchronization, not just string cleanup. [Kernel pathname lookup](https://docs.kernel.org/filesystems/path-lookup.html).

Seal normalized arguments and blob identities before approval; bind approval to that exact digest plus relevant policy revision, principal, invocation and preconditions. Check again immediately before invoke after async policy/credential waits. For workspace publication, use one host ref transaction; never “check head, then later overwrite it” without CAS/locking. Immutable base objects remove host mutation races during guest reads, but not remote-service races or live-checkout import races. Imports need a pinned managed snapshot or a verified/retried scan before their root is trusted.

### 4.3 Policy bypass, shared workers and cross-command channels

All entry points must converge on the same host policy: `/mcp`, old JS call records, a guest helper CLI, cached results, resource/blob reads and future sockets. A forged ring message must not gain authority because it bypassed the VFS. Authenticate against the host session and installed capability, validate exact effects/arguments, and refuse unnegotiated record kinds. File mode, syscall number, guest uid or guest-authored receipt is not authorization evidence.

Do not provide a broad `exec`, arbitrary URL fetch, open proxy or credential-bearing argument escape hatch alongside tightly scoped files. Provider clients should enforce destination/redirect and scope constraints, and verify token audience; result links must be fetched through policy. Credentials remain host-only and are revoked/bounded per call; providers that ignore cancellation need isolation/admission limits, and their effects can remain unknown after timeout. MCP's security guidance discusses confused-deputy and token-passthrough hazards. [MCP security practices](https://modelcontextprotocol.io/docs/2025-11-25/tutorials/security/security_best_practices).

**Current engine reality:** sessions are disposable logical execution states, not necessarily new host processes/VM objects per command. The pool says never reuse a completed session (`arch/jitk/executor/pool.ts:139`), while the native worker reuses/reset slots and replaces the read-only input mapping (`arch/jitk/shard/src/kvm/native.rs:147`; `hvf/native.rs:118`). HVF defaults to tracked dirty-granule restoration with remap fallback (`arch/jitk/shard/src/hvf.rs:434`, `:722`); KVM's reset copies/cleans or discards private pages (`kvm/reset.rs:12`, `:154`). Do not infer workspace persistence from those memory CoW mechanisms.

The architecture doc's engine table has stale “confinement none yet” and reset descriptions (`arch/jitk/docs/ARCHITECTURE.md:68`); current Linux confinement code and its later trust-boundary section take precedence (`arch/jitk/shard/src/confine/mod.rs:1`, `:71`; `docs/ARCHITECTURE.md:108`). macOS Seatbelt confines the worker to immutable images (`arch/jitk/shard/src/hvf/jitk.sb:6`). Keep filesystem persistence and credentials out of that engine process; the host broker owns them. Multiple KVM slots share a process failure domain, so choose one tenant per worker or use process isolation before claiming cross-tenant engine isolation (`docs/ARCHITECTURE.md:118`).

Remaining cross-command channels include cache timing, CPU contention, storage dedup/quota responses, branch history, logs, reused host objects, shared provider state and in-flight calls. Scope cache/blob/receipt IDs by tenant; avoid public hash-existence or dedup oracles; retain authorized old versions deliberately rather than letting deletion promise secure erasure. Include all new host-side stream buffers, request handles, pending approvals, timers and workspace staging state in generation teardown. A→B→A tests must cover stale stream/call IDs and scratch bytes as well as memory/register reset. They do not prove absence of microarchitectural side channels.

## 5. Current implementation versus missing architecture

| Area | Exists in inspected code | Missing for this proposal |
|---|---|---|
| Execution isolation | Snapshot-based single-use sessions; pool FIFO/admission and deferred release (`arch/jitk/executor/pool.ts:18`, `:122`); HVF/KVM reset and watchdog paths | Workstation/attempt metadata, workspace roots, persistent commit lifecycle |
| Read-only files | Archive files/directories, bounded lookup, stat, read, getdents and shared open descriptions (`arch/jitk/kernel/src/fs.rs:38`, `:233`, `:327`; `syscalls/getdents64.rs:1`) | Mutable nodes, modes/metadata, real cwd, copy-up, tombstones, mutation syscalls, coherent descriptor-kind dispatch and quota accounting |
| Native programs | Prepared static ELF, argv and late-bound read-only input archive (`arch/jitk/executor/engine.ts:14`; `native-backend.ts:49`) | Dynamic executable selection, env/cwd inputs, stdin channels, workspace export, native tool calls |
| Host tools | JS call dispatch with strict schemas, bounded concurrency, effects, approval hooks and per-call credentials (`arch/jitk/executor/executor.ts:110`; `policy/policy.mjs:106`) | File namespace adapter, native call IPC, registry pinning, durable invocation IDs/receipts, large-result/blob service |
| MCP server | `execute`, native `run`, static file-backed resources (`arch/jitk/mcp/server.mjs:45`, `:68`, `:84`) | `/mcp` inside guests; generic outbound remote-MCP client/auth configuration; workstation session/provenance API; approval UI transport |
| Streams | Binary native stdout/stderr records and exit totals (`arch/jitk/kernel/src/ring.rs:543`; `shard/src/streams.rs:82`) | Live worker-to-executor forwarding, stdin, credits, multiplexing, pipeline scheduling and cancellation |
| Shell/processes | One EL0 program; narrow archive→stdin dup3; unsupported handlers return ENOSYS (`arch/jitk/kernel/src/user.rs:141`; `ring.rs:331`; `generate.ts:73`) | Guest fork/clone/vfork, exec, wait, pipe, general dup, signals, process groups and scheduler |
| Persistence | Prepared snapshots and historical development/evidence receipts | Workspace object store/ref database, crash-consistent commit/export, conflict UI, retention/GC; external-effect reconciliation |
| Growth/verification | Shared-tree oracle methodology and checked user-memory helpers (`arch/jitk/grow/EXPERIMENTS-PATHFS-2026-10-27.md:72`; `kernel/src/syscalls.rs:5`) | Mutable-tree state-history oracle, kernel primitive review, exact native/ring artifact qualification and protocol/commit crash testing |

The pathfs experiment reported only one newly passing visible program and no held-out gains from the read-only path fixes (`arch/jitk/grow/EXPERIMENTS-PATHFS-2026-10-27.md:34`, `:221`). Its observed mutating workload sizes inform a scratch hypothesis, not an arbitrary CLI compatibility promise (`:236`). Its documented success-without-cwd bug (`:187`) is a concrete reason to test operation sequences and post-state. The compatibility-kernel research recommends inode/dentry/open-description/cwd separation and curated semantic tests, which this design adopts (`arch/research/growos-node/02-COMPAT-KERNELS.md:234`, `:269`).

## Phased implementation plan

**Planning assumption:** approximately 5–8 weeks for a constrained prototype, including focused independent review and external validation capacity. This is not a delivery commitment. Keep static prepared ARM64 tools; bounded small regular-file trees; explicit unsupported links/directory operations; no guest shell/process spawning; no claim of unrestricted Node or POSIX compatibility. Phases overlap in design, but their acceptance gates remain distinct. No implementation or validation commands in this plan were executed for this report.

### Phase 0 — Contract and counterexamples, days 1–4

- Specify the job/result schema, supported file operations, commit-on-complete semantics, `/mcp` state machine, errno mapping, quotas, external-effect uncertainty and isolation domains. Pin a tiny tool/workspace fixture and a demonstration such as “tool result → JSON filter → file edit → next command reads committed file.”
- Design independent histories before code: cwd→relative open; two opens versus dup positions; open→unlink→read; lower-file rewrite/delete/rename; quota failure; repeated submit; split writes; provider effect followed by lost response; stale branch publish.
- Extend `arch/jitk/executor/engine.ts` and `arch/jitk/abi/src/lib.rs` on paper first; version native IPC explicitly. The current JNR8 framing is not yet centralized in jitk-abi (`arch/jitk/executor/native-backend.ts:24`). No hard-coded duplicate constants across TS/Rust/kernel.
- Gate: reviewers can predict observable outputs and commit/receipt states for every failure point. Reject no-op cwd, repeated-call-on-read and incomplete-export mutants in the proposed evaluator design.

### Phase 1 — Real cwd, bounded mutable filesystem, weeks 1–3

- Kernel: refactor `kernel/src/fs.rs` into reviewed namespace/node/OFD/storage primitives; add real root/cwd, typed fd variants, mutation rollback, quotas and reset-owned state. Update `user.rs` for bounded env and cwd inputs.
- Handlers: update openat/read/write/readv/writev/pread/lseek/stat/getdents/fcntl/poll dispatch; implement bounded create/truncate/mkdir/unlink and regular-file rename/replacement, then the exact ancillary operations required by pinned tools. Add fsync/fdatasync under the explicit per-run scratch contract. Preserve correct unsupported errors for unimplemented flags/mount operations.
- Start with empty `/work` scratch as a subsystem milestone, then add immutable `/work` lower projection, file copy-up and tombstones. Do not call empty scratch the persistent workspace MVP.
- Validation on external ARM64 Linux/native infrastructure: identical initial trees and relevant mount contracts, independent held-out tree shapes, exact contents/metadata/offset observations and post-state, injected quota failures, and A→B→A reset. Run the actual ring/native artifact, not just the console growth image.
- Gate: pinned file-edit workflows and seeded semantic defects are distinguished correctly; no scratch metadata or bytes survive reset except through deliberate export.

### Phase 2 — Durable host versions and export, weeks 3–4

- Host: add object-store/ref-transaction and attempt records in a new workspace subsystem; no live checkout mount. Pin base roots and reference generations; import only the declared small tree subset.
- Kernel/worker: add freeze/export records at native completion; update `ring.rs`, `shard/src/streams.rs`, `inputs.rs`, both native workers, and `executor/native-backend.ts`. Verify complete chunk/manifest/exit ordering before host publish. Do not release/reset before the export has been copied/validated.
- Integrate commit with `NativeExecutor`, keeping exit status, candidate root, publish status and operational failure distinct. Add retention pins/GC bookkeeping from the beginning, with conservative retention first.
- Gate: fault injection at each object/ref/response boundary leaves either the old root or a complete new root; repeat attempt queries return the same outcome; two concurrent publishers cannot overwrite each other. A nonzero completed command's writes obey the chosen policy.

### Phase 3 — Native `/mcp` mediation, weeks 4–6

- Extract/reuse the executor's policy dispatch as a shared host service rather than cloning its rules. Add native call/reply records and guest synthetic `/mcp` descriptors. Extend both HVF/KVM native loops; current `NativeSession.reply` rejects calls (`arch/jitk/executor/native-backend.ts:288`).
- Add the pinned catalog, staged request/submit/result protocol, schema validation, host invocation ledger, scoped small result files, per-file policy and server-side provenance retention. Begin with existing host provider modules; add one outbound MCP connector only under an explicit negotiated-version/auth adapter.
- Build a small `mcp-call` utility only after the protocol contract is stable. Keep credentials outside guest source, environment, files and receipts. Match existing approval fail-closed behavior until a concrete host approval transport exists (`arch/jitk/mcp/README.md:14`).
- Gate: same denied action stays denied through JS, raw forged native record, helper and file paths; repeated reads/submits cannot duplicate a call; crash-after-effect reports unknown honestly; private labels survive across a committed file and a subsequent run.

### Phase 4 — Host command graph and honest pipelines, weeks 6–8

- Add structured sequencing, cwd/env session state, status/conditional handling and redirections. Start with bounded completion-to-spool pipes if that provides useful workflows; expose the non-live limitation.
- For live pipes, add IPC multiplexing, stdin, credits, ready/wake support, downstream-close/EPIPE, cancellation, and separate admitted workers or a real multi-slot event loop. Preserve total memory/process/storage caps and reserve sufficient graph capacity to avoid pipeline deadlock.
- Gate: multi-chunk binary A→B, slow consumer, consumer exits early, zero bytes, quota exhaustion, timeout, failed upstream, and pipeline with workspace writes all have defined output/status/commit behavior. No unbounded buffering or fake EOF.

### Later, only after evidence

Add larger/on-demand immutable trees; metadata/link/directory-rename completeness; safe read caching and larger blobs; reviewed merges with clear consistency claims; additional static tool profiles; then a separate ash-in-one-VM process-model project. The roadblock report estimates substantial task/signal/runtime work and explicitly separates a narrow prototype from supported hostile workloads (`arch/research/growos-node/04-ROADBLOCKS.md:31`, `:219`). GrowOS should propose handlers over reviewed shared primitives and pass independent stateful/Linux gates; it should not autonomously invent persistent namespace/commit authority.

## Risks and cheapest ways to de-risk them

| Risk / unknown | Consequence | Earliest useful check or decision |
|---|---|---|
| Tool effects and filesystem commits have no shared transaction | Duplicate or irreversible action even when workspace publication fails | Define durable intent/unknown/reconciliation states; use a fake provider with injected effect-before-disconnect and idempotency behavior before connecting valuable tools |
| Mutable FS semantics exceed the apparent syscall patch size | Accepted handlers silently corrupt cwd, open-file lifetime or copy-up | Independent operation histories and planted mutants; validate the shared primitive model before growth; keep unsupported operations explicit |
| Scratch and copy-up compete with guest arena/page tables | OOM/reset amplification; tiny quotas make real tools unusable | Static budget worksheet for one pinned profile, then external small workload measurements; reject the profile if copy-up plus metadata cannot fit; use lazy page allocation |
| 64-file/4-MiB projection is too small for intended workstation | Prototype proves only toy workspaces | Inventory intended file counts/bytes without executing tools; set an explicit useful small-workspace milestone; decide on-demand host reads versus larger arena before claiming repository support |
| Streaming still uses a synchronous one-session worker | Deadlock or apparent streaming that begins only after completion | Trace the actual state machine; require two simultaneous admitted stages or choose bounded spool semantics; test slow/early-exit consumers externally |
| Parallel disjoint edits conceal read dependencies | Incorrect automatic merge and stale derived output | Keep full-head CAS first; use read/write examples to reject false serializability claims; defer automatic retry after actions |
| Host path import/export races | Host filesystem escape or inconsistent base snapshot | Managed immutable roots, descriptor-relative no-follow operations, malicious rename/symlink races against the host adapter; no string-prefix-only defense |
| Taint is lost between MCP calls or through files/pipes | Private egress and untrusted-write policy bypass | Host session/workspace labels; test private read→commit→fresh VM→egress; include stdout/artifacts and cached results |
| Reset covers guest bytes but misses new host state | Cross-command request/blob/stream leakage | A→B→A generation tests with delayed replies, reused fd numbers, pending approvals and cancelled export; quarantine on failed reset checks |
| Remote providers ignore cancellation/idempotency | Work continues after deadline; effects remain uncertain | Provider adapter admission caps and bounded isolated workers where needed; explicit unknown outcome; no automatic irreversible retry |
| Snapshot reset becomes expensive for write-heavy scratch | Proposed economic advantage disappears | External dirty-set/copy-up/reset measurements on the exact profile and native backend; no laptop benchmark or imported QuickJS latency claims |
| Ash/ordinary CLIs expand the compatibility scope | Weeks become a process/VM/signals project | Pin actual binaries and inspect startup/feature traces on separate infrastructure; retain structured host graph and static-tool scope if that meets the product need |

The highest-risk correctness boundary is the combination of **external action uncertainty, durable local publication and retries**. The highest-risk implementation scope is **coherent mutable filesystem state plus native bidirectional IPC**. Both can be narrowed without abandoning the file-based workstation idea: begin with a small immutable version store, explicit submissions, conservative publication conflicts, and a handful of static tools.

## Sources

### Repository sources inspected

- `arch/jitk/kernel/src/fs.rs`, `user.rs`, `ring.rs`, `syscalls.rs`, `memory.rs`, `arch/aarch64/trap.rs`; path, fd, I/O, poll, memory and signal handlers under `syscalls/`; `kernel/slots.json`, `kernel/generate.ts`, `kernel/packer.ts`.
- `arch/jitk/protocol/dispatcher.ts`, `PROTOCOL-v1.md`; ring values/framing/limits in `arch/jitk/abi/src/lib.rs`.
- `arch/jitk/executor/executor.ts`, `engine.ts`, `pool.ts`, `native-backend.ts`, `policy-adapter.ts`, `policy/policy.mjs`, `policy/README.md`, `receipt-path.ts`.
- `arch/jitk/shard/src/hvf.rs`, `hvf/native.rs`, `hvf/jitk.sb`, `kvm/mod.rs`, `kvm/reset.rs`, `kvm/native.rs`, `slot/reset.rs`, `inputs.rs`, `streams.rs`, `confine/mod.rs`.
- `arch/jitk/mcp/server.mjs`, `jitk.mjs`, `native.mjs`, `README.md`; `arch/jitk/docs/ARCHITECTURE.md`.
- `arch/jitk/grow/EXPERIMENTS-PATHFS-2026-10-27.md`; `arch/research/growos-node/02-COMPAT-KERNELS.md`, `04-ROADBLOCKS.md`. Their reported experiments were not reproduced; current source takes precedence over historical pointers and stale architecture tables.

### Primary external references, accessed 2026-10-31

- [Plan 9 / 9P introduction](https://9p.io/magic/man2html/5/0intro), [open/create](https://9p.io/magic/man2html/5/open), [read/write](https://9p.io/magic/man2html/5/read), [IP device control/data namespace](https://9p.io/magic/man2html/3/ip).
- [Linux FUSE I/O modes](https://kernel.org/doc/html/latest/filesystems/fuse/fuse-io.html), [libfuse operation lifecycle](https://libfuse.github.io/doxygen/structfuse__operations.html).
- [MCP tools, dated 2025-11-25 contract](https://modelcontextprotocol.io/specification/2025-11-25/server/tools), [pagination](https://modelcontextprotocol.io/specification/2025-11-25/server/utilities/pagination), [security practices](https://modelcontextprotocol.io/docs/2025-11-25/tutorials/security/security_best_practices). These are deliberately dated references, not a claim that this is the latest protocol or that Sofort implements every feature. Record the actual negotiated version per connector.
- [Linux OverlayFS](https://docs.kernel.org/filesystems/overlayfs.html), [pathname lookup](https://docs.kernel.org/filesystems/path-lookup.html), [Git object model](https://git-scm.com/book/en/v2/Git-Internals-Git-Objects).
- [Apple APFS overview](https://developer.apple.com/documentation/foundation/about-apple-file-system), [btrfs design](https://btrfs.readthedocs.io/en/stable/dev/dev-btrfs-design.html), [btrfs subvolume/snapshot contract](https://btrfs.readthedocs.io/en/stable/btrfs-subvolume.html), [OpenZFS snapshots/clones](https://openzfs.github.io/openzfs-docs/Basic%20Concepts/Datasets/Snapshots%20and%20Clones.html).
- [GNU Bash manual](https://www.gnu.org/s/bash/manual/bash.html), [BusyBox FAQ](https://www.busybox.net/FAQ.html), [BusyBox upstream ash vfork implementation change](https://lists.busybox.net/pipermail/busybox-cvs/2025-August/042214.html).

Web access limitations: Open Group's current shell specification returned HTTP 403, and full GNU Bash manual retrieval timed out; shell guidance uses the first-party indexed Bash documentation and upstream BusyBox material, without claiming a POSIX conformance audit. Apple’s overview body required JavaScript; its indexed first-party clone description was available. Moving upstream URLs are architectural references, not pinned implementation artifacts.
