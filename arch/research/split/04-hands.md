# The hands: command execution on demand

Research date: **2026-10-28**. Scope: shell, build and test execution for a Worker/Durable Object agent. **F** = sourced fact, including existing repository evidence; **M** = measured in this research; **I** = inference/design recommendation; **E** = estimate or illustrative calculation. Vendor timings are F about a published claim, not M about performance reproduced here. Prices are USD list prices before tax, credits, subscriptions and negotiated discounts unless specified.

## Verdict

**GO WITH CHANGES.** Use a small TypeScript command subset plus a normal Linux runner, retained across a burst of work and stopped between bursts. Do not make a new runner for every shell command. Do not put dependency trees in the DO or synchronously proxy every filesystem operation across the network. **jitk is a NO-GO as today's general shell/build/test runner; it remains plausible for its existing small static-program/tool-glue role.** [I]

**The broad hands architecture already exists.** Cloudflare's `@cloudflare/computer` combines a DO SQLite filesystem with just-bash/Dynamic Worker and Container execution backends, and supplies Pi tools. Its core filesystem is stable; its container backend, shell backend and synchronization protocol are explicitly experimental. This is unusually close prior art, not merely a competing VM vendor. Its docs warn against large workspaces and dependency trees. Read its code and benchmark it before implementing equivalent plumbing. [F: [overview](https://github.com/cloudflare/computer/blob/main/docs/README.md), [component status](https://github.com/cloudflare/computer/blob/main/packages/computer/README.md)]

The likely project killer in this layer is **moving the workspace and preserving command semantics**, not VM boot. The economic comparison must include existing pause/resume products and their idle pricing. A persistent paid VM is an inadequate sole baseline. [I]

## 1. Current runner options

### Cloudflare Containers and Sandbox SDK

**Startup has changed recently.** The September 30 announcement reports the new `durable_object` scheduling path at **648 ms p50, 910 ms p95, 1,129 ms p99** in a 100-sandbox concurrent TTI benchmark. The directly inspected ComputeSDK October 23 result is **682/950/989 ms**, 100% success. Older/general lifecycle documentation still says cold starts often take **1–3 s**. These are different paths/runs, not grounds to promise either instant startup or a fixed three-second delay. [F: [announcement](https://blog.cloudflare.com/faster-agent-sandboxes/), [October 23 result](https://www.computesdk.com/benchmarks/sandboxes/burst-tti/cloudflare), [lifecycle](https://developers.cloudflare.com/containers/concepts/architecture/)]

**Billing:** 10 ms metering; active CPU **$0.000020/vCPU-s**, allocated memory **$0.0000025/GiB-s**, allocated disk **$0.00000007/GB-s**. The published minimum quantum is 10 ms; no separate minute floor is documented. Charges span the running instance, including idle memory/disk and lifecycle time, rather than just `exec()` duration. Workers Paid is $5/month with included container usage; Worker, DO and observability usage are additional. NA/EU container egress is $0.025/GB after allowance. [F: [pricing](https://developers.cloudflare.com/containers/platform/pricing/)]

| Instance | vCPU | RAM | Ephemeral disk |
| --- | ---: | ---: | ---: |
| lite | 1/16 | 256 MiB | 2 GB |
| basic | 1/4 | 1 GiB | 4 GB |
| standard-1 | 1/2 | 4 GiB | 8 GB |
| standard-2 | 1 | 6 GiB | 12 GB |
| standard-3 | 2 | 8 GiB | 16 GB |
| standard-4 | 4 | 12 GiB | 20 GB |

Custom sizes: 1–4 vCPU, at most 12 GiB/20 GB, minimum 3 GiB per vCPU. Default account caps: 1,500 vCPU, 6 TiB RAM, 30 TB disk concurrently. Snapshot limit 20 GB; retention 30 days, refreshed by restore. Small instance CPU fractions are a meaningful build-time constraint, not merely cheap RAM bundles. [F: [limits](https://developers.cloudflare.com/containers/platform/limits/); I: build implication]

**Worker → runner:** address the session DO with `env.RUNNERS.getByName(sessionId)`. That DO calls `ctx.container.start({image, instance, ...})`, then native `container.exec(["bash", "-lc", script])`; use output streams/status and cancellation through the native API. Keep the command request alive while streaming or implement a durable job with alarms and output files. Internet access must be configured for Git/npm. With the new API, `@cloudflare/sandbox` 1.x supplies utilities such as `Files`, `S3Mount` and `DirectoryBackup`, rather than a required base class. Its file helpers need the matching `sandbox-shim` in an amd64 image. [F: [SDK reference](https://developers.cloudflare.com/sandbox/reference/), [workspace/exec example](https://developers.cloudflare.com/sandbox/files/save-and-restore-a-workspace/)]

The legacy `Sandbox`/`Container` classes and their `getSandbox()/exec()` examples must not be mixed with the new API. Faster scheduling, runtime image/size selection and native snapshots are on `ctx.container`; the September announcement gives legacy class maintenance through December 31, 2026. [F: [migration announcement](https://blog.cloudflare.com/faster-agent-sandboxes/)]

**Warm operation and persistence:** a live instance preserves processes/files and avoids another boot, but has no published universal warm-command p50. The session DO survives independently of it. Set/reapply `setInactivityTimeout()` after DO restarts; its upper bound is six hours. A background build alone does not keep the instance alive. An accepted non-hibernating WebSocket, stream or polling alarm can keep it active and billable. [F: [lifetime](https://developers.cloudflare.com/sandbox/concepts/lifetime/)]

Stopping loses the default ephemeral disk. Native filesystem snapshots, currently **public beta**, preserve the writable root, excluding mounted directories, RAM and processes. Save files and snapshot ID before stopping; serialize saves with mutations. R2 directory backup is another explicit persistence mechanism. A bucket mount should not be treated as a local npm filesystem. Snapshot storage pricing was not established from the inspected container price table; do not assume it is free. [F: [snapshot guide](https://developers.cloudflare.com/sandbox/files/save-and-restore-a-workspace/); I: cost caution]

Placement is regional capacity placement, not every Cloudflare PoP. The new path tries local capacity/image caches first; general docs still disclaim DO/container co-location. Regions include ENAM, WNAM, EEUR, WEUR, APAC, SAM, ME, OC and AFR, with limited-capacity ME/OC/AFR unavailable as exclusive constraints. EU/US jurisdiction constraints exist. [F: [placement](https://developers.cloudflare.com/containers/concepts/placement/), [lifecycle](https://developers.cloudflare.com/containers/concepts/architecture/), [new scheduling path](https://blog.cloudflare.com/faster-agent-sandboxes/)]

**Fit:** first candidate when the brain is already on Cloudflare. Use native disk for builds and dependency caches; checkpoint source and runner state between bursts. Its larger RAM-to-CPU ratios may cost less than engineering a new runtime, but compare actual build duration. [I]

### Vercel Sandbox

Full Linux Firecracker runner through `@vercel/sandbox` or authenticated APIs, usable from outside Vercel. Vendor wording is startup in milliseconds; see the common TTI measurements below for a more useful number. Current images include Node environments and custom images. [F: [product](https://vercel.com/sandbox), [docs](https://vercel.com/docs/sandbox)]

Default `iad1` rates: **$0.128/active CPU-hour**, **$0.0212/allocated GB-hour**, **$0.60/million creations**. Memory has **one-minute minimum increments**; CPU excludes I/O wait. Default 2 vCPU/4 GB; 1 vCPU is also allowed, with 2 GB/vCPU. Maximum Hobby/Pro/Enterprise: 4/8/32 vCPU, 8/16/64 GB. Current SDK/custom-image sandboxes receive 64 GB ephemeral disk. Default timeout five minutes; max session 45 minutes Hobby, 24 hours paid. Snapshots $0.08/GB-month; Drives $0.05/GB-month in iad1 plus reads/writes. CPU precision/minimum was not separately specified on the inspected page. [F: [pricing/quotas](https://vercel.com/docs/sandbox/pricing)]

**Persistence is now the default** for current persistent-sandbox APIs: stopping snapshots the filesystem; a subsequent SDK command resumes a new VM session. This is filesystem continuation, not a guarantee that processes survive. Drives are another persistence option. All **20 compute regions** became available September 10, with paid-plan failover regions; rates vary geographically. [F: [persistence](https://vercel.com/docs/sandbox/concepts/persistent-sandboxes), [regions announcement](https://vercel.com/changelog/vercel-sandbox-is-now-available-in-all-regions)]

**Fit:** mature managed hands with an explicit memory billing floor. A one-second command on a newly booted runner does not imply one-second memory charges. Keep short related commands in one session; evaluate snapshots with the actual dependency tree. [I]

### E2B

Firecracker-based Linux environments with command/file SDKs, prebuilt templates and pause/resume. E2B's older approximately **150 ms** startup statement concerns initialization; it is not the current remote create-to-command burst number. [F: [vendor startup statement](https://e2b.dev/blog/lindy-powers-ai-workflows-with-e2b-code-action), [runtime source](https://github.com/e2b-dev/runtime)]

**$0.000014/vCPU-s + $0.0000045/GiB-s** while running; billed per second, with no separate minute floor found. Published calculator default 2 vCPU/4 GiB costs **$0.000046/s = $0.1656/hour**. Sizes listed include 1–8 vCPU and 1–8 GiB, independently selectable subject to plan/template constraints. Hobby disk 10 GiB, Pro 20 GiB. Pro adds **$150/month** before compute. [F: [pricing](https://e2b.dev/pricing)]

Hobby/Pro continuous runtime limits are 1/24 hours; concurrency starts at 20/100; creation rates 1/5 per second. Full pause preserves files and memory indefinitely and stops running compute charges. Documented pause time is approximately **4 s per GiB RAM**, resume approximately **1 s**. Filesystem-only pause is available; it reboots rather than preserving processes. Snapshot backlog can refuse a pause and leave the runner running. [F: [billing/limits](https://docs.e2b.dev/billing), [persistence](https://docs.e2b.dev/sandbox/persistence)]

Regions are separate deployments/projects, not a per-create `region` flag: default `us-west-1`, plus `us-west-2`, `eu-west-1`, `ap-southeast-1`, enabled through support. Templates must be built per region; sandbox IDs and state do not migrate automatically. The EU FAQ says verified accounts on every plan can request access. [F: [client regional configuration](https://docs.e2b.dev/client), [EU access](https://docs.e2b.dev/faq/eu-region.md)]

**Fit:** straightforward remote command runner; long full-memory pause time discourages pausing after every command. The subscription can dominate a small prototype's infrastructure bill. [I]

### Daytona

Container sandbox is the default; dedicated Linux/Windows VM classes also exist. Do not transfer the default container's **<90 ms** provisioning claim to every VM class or to client TTI. Default container: 1 vCPU, 1 GiB, 3 GiB disk; standard named configurations include 2/4/8 and 4/8/10. Documented default ceiling is 4 vCPU/8 GiB/10 GiB per sandbox. Shared targets are `us` and `eu`. [F: [sandbox classes/resources/regions](https://www.daytona.io/docs/en/sandboxes/)]

Rates: **$0.0504/vCPU-hour**, **$0.0162/GiB-hour**, **$0.000108/GiB-hour disk after the first 5 free**, per-second billing. Started/creating/starting/stopping/pausing states retain resource charges. Stopped and VM-paused states charge disk only; container archive stops charges, but restoring archive is another lifecycle path. VM pause preserves memory; container stop should not be interpreted as memory suspension. [F: [prices](https://www.daytona.io/pricing), [state-dependent billing](https://www.daytona.io/docs/billing)]

Tier 1 has a small aggregate compute pool; larger pools need verification/top-ups. Current limits documentation itself disagrees on Tier 1 RAM, listing 10 GiB in one table and 20 GiB in another. Creation quotas are 300–600/minute by tier, not unlimited burst fan-out. No separate minute minimum appears in the inspected public pricing; invoice precision still needs confirmation. [F: [limits](https://www.daytona.io/docs/limits); I: verification need]

**Fit:** a credible ordinary Linux runner, particularly for US/EU sessions. Choose the execution class explicitly and include stopping/archive/restart latency in comparisons. [I]

### Modal

Configurable isolated Linux containers with command execution, images, volumes and filesystem snapshots. SDK description says boot in seconds; warmed `exec()` avoids creation but no universal warm p50 is documented. Default request is 0.125 physical cores/128 MiB; memory/CPU are configurable. **One physical core is two vCPU equivalents**, not one vCPU. Default ephemeral disk quota 512 GiB; larger disk requests can raise the billable memory floor at a 20:1 disk:memory ratio. [F: [Sandbox API](https://modal.com/docs/sdk/js/latest/Sandbox), [resources](https://modal.com/docs/guide/resources)]

Use **Sandbox**, not Function, rates: **$0.00003942/physical-core-s**, **$0.00000667/GiB-s**. These are about 3× the separately displayed standard Function rates. Billing uses `max(request, actual)` per resource, by second; billing docs say no minimum usage-time increments. A live idle sandbox still holds requested resources. [F: [pricing](https://modal.com/pricing), [sandbox billing](https://modal.com/docs/guide/sandbox-resources), [billing precision](https://modal.com/docs/guide/billing)]

Filesystem/directory snapshots can seed a new runner; full-memory snapshots are **alpha**, so do not base a production hibernation contract on them. Region selection is supported but adds **1.15× for broad**, **1.75× for narrow** regions; default Function ingress routes through Virginia, which is a warning to measure the actual command/control path rather than assume closest-region routing. [F: [snapshots](https://modal.com/docs/guide/sandbox-snapshots), [regions](https://modal.com/docs/guide/region-selection)]

**Fit:** strong image/build pipeline and flexible resources; useful if other Modal workloads already exist. The Sandbox premium and geographic multiplier need to be in the cost model. [I]

### Fly Machines and Sprites

**Machines:** Firecracker VMs controlled by REST, region selectable. Fly's runner guide gives approximately **300 ms boot**, excluding possible image preparation/application readiness. A Worker needs a command service or Machines exec adapter, lifecycle controller and persistent storage policy; Machines is not by itself a complete agent command API. [F: [runner guide](https://fly.io/docs/machines/guides-examples/functions-with-machines/); I: integration]

Current public pricing selector shows shared-1×/256 MB **$0.0030/hour**, shared-2×/512 MB **$0.0061/hour**, performance-1×/2 GB **$0.0458/hour**, performance-2×/4 GB **$0.0917/hour**, up to performance-16×/32 GB, with added RAM possible to 128 GB. Compute bills per second; stopped rootfs **$0.15/GB-month**, volumes **$0.15/GB-month**, snapshots **$0.08/GB-month**. Older resource docs show different example prices; use a region-specific live quote rather than combining tables. [F: [current pricing](https://fly.io/pricing/), [older resource table](https://fly.io/docs/about/pricing/)]

**Sprites:** higher-level persistent Linux machines, exec APIs/SDKs, 100 GB persistent filesystem, automatic idle/wake and checkpoints. Separate product pages advertise up to **8 CPUs/16 GB RAM**, typically **<1 s cold**; these are vendor descriptions, not reproduced latency percentiles. Disk checkpoints restore files, not a paused instruction stream. [F: [checkpoint product page](https://fly.io/sprites/checkpoint-restore/), [current product description](https://fly.io/sprites/)]

Current central Fly pricing: **$0.0385/CPU-hour**, **$0.021875/actual RAM GB-hour**, hot disk **$0.000683/GB-hour while awake**, cold disk **$0.000027/GB-hour while retained** (~$0.02/GB-month). Warm/cold compute is free. **There is a material documentation conflict:** central pricing says metered/billed hourly and no plans/tiers; overview docs still say per-second and some product FAQs still discuss tiers. Older product pages quote $0.07 CPU/$0.04375 RAM and per-second compute. No reliable minimum billed duration can be established by merging these pages. Require written clarification or metered micro-runs before using subsecond Sprites cost estimates. [F: [central pricing](https://fly.io/pricing/), [overview](https://docs.fly.io/sprites/), [older pricing](https://fly.io/sprites/checkpoint-restore/)]

Region placement is another caveat: Fly support said September 11 that users cannot select/move regions; placement follows the creator. An October 26 user report describes Australian/Singapore creation landing in Los Angeles; that report is an unresolved observation, not proof of a platform-wide rule. [F: [Fly support statement](https://community.fly.io/t/wheres-my-sprite-in-the-world/28621), [reported placement change](https://community.fly.io/t/have-sprite-placement-rules-changed/28922)]

**Fit:** Sprites is a direct baseline for persistent hands that stop charging idle compute. Test it before claiming the split uniquely provides that saving. Machines gives more placement control but requires more owned orchestration. [I]

### Self-hosted Firecracker runners

Firecracker is a VMM, not a hosted rate card. Published targets: **<125 ms boot**, **<5 MiB VMM overhead**, up to **150 VM creations/s/host**. These exclude the Linux guest's useful RAM, image/cache misses, scheduling, filesystem restore, network and command runtime. It needs Linux/KVM. Cloudflare Containers, Vercel, E2B and Fly already provide managed versions of much of this stack. [F: [Firecracker](https://firecracker-microvm.github.io/)]

A self-hosted path needs a host scheduler, image/snapshot distribution, writable block devices, guest agent over vsock, command streaming/cancellation and host failover. Cost is **host lease / useful utilization + storage/network/operations**, with the VPS/bare-metal provider's billing floor. A host kept ready does not scale its bill to zero when the DO hibernates. Check `/dev/kvm` availability and architecture before choosing a VPS. [I]

Illustration: a **$60/month** always-on host at **20% useful utilization**, capable of **eight equivalent concurrent runner slots**, costs about **$0.0000145/useful slot-second** before redundancy and operations. Neither $60 nor eight slots is a vendor quote or measured capacity; this only shows why utilization determines whether self-hosting wins. [E]

### Comparable startup evidence and its limits

The inspected **October 16 ComputeSDK 100-way burst** measures create call through first successful command, from GitHub Actions. It is primary evidence from the benchmark author, but not a benchmark of our region, image, dependency restore or warm sessions. [F: [methodology and results](https://www.computesdk.com/benchmarks/sandboxes/burst-tti/)]

| Provider | p50 TTI | p95 TTI | Success |
| --- | ---: | ---: | ---: |
| Vercel | 0.49 s | 0.60 s | 100% |
| Daytona | 0.72 s | 0.93 s | 100% |
| Cloudflare | 0.83 s | 1.15 s | 97% |
| Modal | 0.94 s | 1.75 s | 100% |
| E2B | 1.25 s | 1.48 s | 100% |

The newer Cloudflare October 23 row above is better; do not splice it into this October 16 table and call it a single comparative run. None of these numbers measures warmed `exec()`. No paid runner was created for this report. [I; M: research boundary]

## 2. TypeScript commands: useful, with a narrower contract

`vercel-labs/just-bash` implements a shell parser/interpreter and virtual filesystem. Commands include file/text utilities, `grep`/`rg`/`sed`/`awk`, `jq`, pipelines, redirects, substitutions, control flow and functions. Network `curl` is opt-in. Optional `js-exec` uses QuickJS, Python uses WASM CPython, and SQLite uses sql.js; these optional runtimes need Node facilities and are not the browser core. They are not arbitrary installed Node/npm packages or Linux executables. Shell state resets per `exec()` while files persist. The README explicitly documents ripgrep default smart-case divergence. [F: [package documentation](https://github.com/vercel-labs/just-bash/blob/main/packages/just-bash/README.md)]

**M: local probe, pinned npm `just-bash@3.6.0`, Node v24.22.1, macOS, October 28.** No Docker, account, paid API or kvm-dev access. Tiny examples of pipelines, jq, substitution, loops, arrays, process substitution and `pipefail` produced the same stdout/exit status as local `/bin/bash` (not a Linux/GNU conformance suite). `git --version`, `node --version`, `npm --version` all returned **127** in just-bash. Files persisted across calls while exported variables/cwd reset.

The precise differing probe was `printf 'UPPER\nupper\n' | rg upper`: just-bash emitted `1:UPPER\n2:upper\n`; native rg emitted `upper\n`. Thus substituting a parser without defining command defaults can silently change both matching and output. Main-branch docs and a published npm package may differ; pin and test the package actually deployed. [M]

A warmed 100-iteration tiny `cat | grep | wc` loop had **0.36 ms p50/1.21 ms p95**, after module initialization, with in-memory files. The first different pipeline cost ~50 ms due to initialization/lazy loading. These are local wall timings, not Worker CPU measurements or guarantees for large searches. [M]

**M: the core also ran in local workerd 2026-10-25.** Bundling `just-bash/browser` with esbuild initially failed on `node:zlib`; externalizing it and enabling `nodejs_compat` produced a ~1.7 MB unminified bundle. The supplied read-only workerd binary served the test pipeline successfully (`stdout="1\n"`, exit 0). This verifies a basic shell path, not the optional runtimes, DO adapter, deployment bundle limit or full conformance. Small receipts/script remain at `/tmp/split-hands/probe-results.json` and `probe.mjs`; installed packages/bundle were removed after the experiment.

**I: use this as a specified tool language.** Pure file inspections and bounded edits can avoid a remote runner. Do not describe it to an agent as complete bash/GNU userspace. Prefer direct typed filesystem/search tools where possible; their semantics are easier to fix. Cloudflare already embeds just-bash in its experimental WorkerShellBackend, and adds isomorphic-git through a separate interface. That does not make arbitrary native Git hooks, Git LFS or every Git option portable. [F: [computer backends/Git](https://github.com/cloudflare/computer/blob/main/docs/README.md); I: compatibility boundary]

## 3. jitk: network path and actual capability gap

### What the existing numbers establish

The requested “~1 ms” is credible **for the existing warmed executor workload**, not for a new Linux machine. The October 28 copy-restore report gives a one-tool Node executor **1.10 ms p50/1.86 ms p99**, **1.72 total CPU-ms/run**, on **nested KVM**; multislot performance is bimodal. Older `arch/FINAL.md` includes 9.2 ms cold executor and 2.4–2.9 ms parked measurements on another path. Preserve those conditions rather than promoting a single best number to a universal startup promise. [F: [latest reset results](../../jitk/bench/RESULTS-copy-restore-2026-10-28.md), [FINAL](../../FINAL.md)]

The **~0.5 MiB/VM** figure is a small glue workload's incremental footprint in a shared Linux shard: 0.515 MiB for return2, 0.535 MiB for one tool. It excludes fixed/shared infrastructure and is approximately equal to same-host Hyperlight, not a Node/npm memory budget. [F: [same-host memory comparison](../../jitk/bench/RESULTS-LINUX-MEMORY-2026-10-27.md)]

### Worker/DO → own jitk host

Proposed path [I]:

1. The session DO persists a command ID, expected workspace revision and execution-host lease.
2. It sends authenticated HTTPS to a small host gateway, or connects a streaming WebSocket during a command burst. The gateway holds the warm jitk shard pool and bounds CPU/memory/deadlines.
3. The host runs a prepared guest and returns sequenced stdout/stderr/status events; results are queryable by command ID after disconnection. Retries look up an existing job rather than execute it twice.
4. For current jitk, any tool callbacks go through the host's existing executor; keep callback data on that host or batch operations. A callback back into the DO pays another network trip.

For a host without inbound public access, `cloudflared` makes persistent outbound connections to Cloudflare; expose the gateway through a Tunnel hostname with service authentication. A request goes DO → Cloudflare routing → connector near the host → local gateway → jitk. Tunnel simplifies reachability and keeps connector transport established; it does **not** put KVM in a Worker or remove geographic distance. [F: [Tunnel model](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/); I: gateway design]

`fetch()` may reuse transport but the application cannot assume a permanently pinned origin socket across DO eviction. WebSocket reuse avoids repeated setup within a live burst; holding an outbound connection also has DO lifecycle/cost consequences. After hibernation, reconnect and use command IDs/leases. Do not hold a socket indefinitely solely to preserve a one-millisecond launch claim. [I]

**E: transport budget, not measurements:** a well-connected same-metro PoP/host might contribute **2–10 ms round trip**, nearby European metros **10–40 ms**, Europe–US East **70–110 ms**, Europe–US West **130–180 ms**, Europe–Singapore **150–220 ms**. The originating PoP may not be where the session DO lives. Treat all ranges as hypotheses to measure; Tunnel detours, queueing and TLS can add more. On an uncached new connection allow roughly 1–3 extra RTTs for transport setup, depending on protocol/cache, plus DNS where applicable.

For a minimal warm execution, `T ≈ RTT + host queue + 1.1 ms + payload transfer`. A 20 ms path gives ≥21 ms before useful work; 100 sequential callbacks to a remote DO cost ~2 s at that RTT. Connection reuse saves handshakes, **not** these per-exchange RTTs. Submit a whole script/build/test as one job; never remote every `read/stat/write`. [E/I]

**Does latency erase jitk's advantage?** It erases the *user-visible 1 ms* story and most of an advantage versus another already-warm runner. It does not mathematically erase a 0.5–1 s cold-runner difference: with 20 ms network, 1 ms jitk versus 650 ms cold Linux would still differ by ~649 ms **if they performed the same task**. They do not today. For a 30 s test, that startup saving is only ~2%; for a 1 ms inspection, TypeScript in the DO is better than either remote path. [I/E]

### Why the guest is not development Linux

The default guest is a small `no_std` kernel executing unmodified **static** QuickJS; its outward I/O is a JSON tool channel. The resource filesystem is a read-only packed archive. SQLite evidence is immutable, read-only queries, not a writable database/build workspace. [F: [FINAL](../../FINAL.md), [grow README](../../jitk/grow/README.md), [SQLite results](../../jitk/grow/RESULTS-R7-grow.md)]

GrowOS is real evidence of adding bounded syscall behavior, but it does not bridge this gap by itself:

- Phase 2's mmap/general leaf-syscall growth unlocked programs; four accepted path handlers were excluded after human review as overfits. [F: [Phase 2](../../jitk/grow/EXPERIMENTS-PHASE2-2026-10-27.md)]
- The corrected shared-tree experiment reached **2,554/3,154 visible (81.0%)**, **644/792 held-out (81.3%)**, adding **one visible program, zero held-out**. Those are scriptc-compiled corpus programs, not 81% Node/npm compatibility. The main reason path fixes did not help was the absence of writable `/tmp`/cwd. 261 programs remained blocked by printable-output rules. [F: [path-FS results](../../jitk/grow/EXPERIMENTS-PATHFS-2026-10-27.md)]
- Its proposed scratch filesystem is explicitly **not implemented**, per-run and nonpersistent. Remaining programs also require `clone/execve/pipe2/mprotect` and related behavior. Correct readonly errors are useful correctness work, but cannot install dependencies. [F: same report]

To run **bash**, need process creation/exec, child wait/reap, pipes, descriptors/redirects, signals/job behavior, executable loading and working-directory semantics; a static BusyBox subset could reduce scope but still needs real process/file behavior. For **Git**, add writable POSIX filesystem semantics, directory traversal, rename/link/symlink, permissions, locking, timestamps, fsync, arbitrary-byte streams and either networking/TLS/DNS or a host transport. For **Node/npm/test**, add dynamic ELF/linker/libc support or a supported static build, pthreads/clone/futex, event polling/timers, socket/network behavior, virtual-memory/protection semantics for V8 JIT, subprocesses and shebangs, native addons and the tests' own tools. Memory scales to the workload, often hundreds of MiB/GB, regardless of VM bookkeeping. [I: engineering dependency analysis]

One JSON channel can multiplex many logical operations, but needs an explicit byte-safe protocol for stdin/stdout/stderr, backpressure, cancellation, files and durable workspace deltas. Forwarding `bash` as a host tool merely moves Linux execution to another runner; jitk is then the glue evaluator, not the hands. [I]

**Decision:** no-go on growing arbitrary development Linux into jitk for this project. Hours can establish missing capabilities; implementing their general semantics is an OS/runtime project with unknown duration. A standard Linux kernel inside Firecracker/libkrun provides that compatibility immediately, while surrendering the tiny guest's advertised footprint. jitk can remain an optional accelerator for existing static tools with explicit inputs/outputs, outside the critical shell route. [I]

## 4. Routing, session pooling and workspace ownership

### Routing contract

| Command/work | Default destination | Reason/conditions [I] |
| --- | --- | --- |
| Read/list files; literal/regex search; bounded text/JSON transforms | Typed TS tool or pinned just-bash core | Only over source already present in DO/VFS; byte/output/time limits; tested options/defaults. |
| `cat`, `head`, `wc`, `sort`, `jq`, simple `find`, known `sed`/`awk` cases | TS after AST/capability check | Whole script must fit the defined subset, including substitutions, redirections and dynamic command names. |
| Small file edits | TS transaction | Commit atomically under workspace revision; no partial replay to Linux. |
| Network fetch | Typed fetch/explicit configured curl | Define methods/redirect behavior; avoid inferring full native curl compatibility. |
| Arbitrary `git`, hooks, LFS, submodules; `bash script.sh` | Linux runner | Scripts/hooks are programs; allow only an explicitly separate supported Git API locally. |
| `node`, `npm/pnpm/yarn`, `npx`, builds, test suites, native binaries/addons | Linux runner | Need actual runtime, dependencies, processes and filesystem behavior. |
| Watch mode/dev server/browser/PTY/database | Session Linux runner | Needs continuing processes; lease must cover its lifetime. |
| Known static jitk program | Optional jitk host | Only a separately verified ABI/tool contract, never automatic fallback for an unknown shell command. |

Do **not** implement “try TS, on command-not-found rerun in Linux”: `edit-file; npm test` may have already mutated the workspace. Classify the entire script before execution; uncertain syntax or indirect commands route whole-script to Linux. Alternatively run TS in a disposable transactional overlay and commit only on a complete locally supported execution. A matching binary name alone is insufficient. [I]

### Warm pooling

Keep **one exclusive runner lease per session/branch** through a burst. Persist `{provider, region, runnerId, imageDigest, workspaceRevision, checkpointId, dependencyCacheKey}` in the DO. Serialize mutations and terminal commands on that branch; parallel tests may share readonly inputs, but parallel editing agents get separate branches/runners. A waiting job should not acquire compute until its dependencies are available. [I]

Pool clean, prepared base images across sessions; do not hand another tenant an old writable workspace. A session resumes its own checkpoint/cache. A global pool improves first-command latency but somebody pays its idle allocation. Cap it, measure hit rate and refill asynchronously. Hold process-bearing sessions warm explicitly; otherwise use a starting **10–30 s grace period** after a command burst, adjusted by measured idle gaps and restore costs. This is a trial policy, not a universal optimum. [I/E]

During a running command, the runner is the authoritative writer for that workspace revision. The DO must not independently edit the same source tree. Flush a change manifest (paths, deletes, bytes, modes, symlinks, base revision), commit the source revision, checkpoint cache/state, then release the lease. `node_modules`, package stores, `.git` bulk objects, build output and test caches stay on native runner disk or provider snapshots; only selected source/artifacts enter DO/R2. If the brain needs a dependency file, read it through a batched runner tool. [I]

**Existing evidence against syncing everything:** Cloudflare's published computer benchmark installs 854 packages/36,675 files in **124.7 s on its FUSE workspace**, **63.9 s ext4**, **34.3 s tmpfs**. These timings exclude the subsequent pull into the DO. Its performance document explicitly reports a partial-tree pull taking further minutes and a storage-timeout failure in an issue, and recommends local-only paths. Local-only/native-root tests have different environments and cannot be substituted as Cloudflare hardware timings. [F: [benchmark and caveats](https://github.com/cloudflare/computer/blob/main/docs/19_performance.md)]

This is enough evidence to make dependency placement a first-day gate. Saving a second of boot while adding a minute of filesystem overhead is a loss. A source-only DO mirror also means this design gives up the premise that *all* agent workspace files live in the DO; document that change explicitly. [I]

## 5. Cost per command and break-even

**E: illustrative compute-only costs**, at full one-vCPU-equivalent use for the stated wall duration, without startup, snapshot/restore, idle tail, storage retention, egress, control-plane/DO usage, plan fees or free credits. No benchmark establishes equivalent CPU performance across these products. Decimal GB and GiB are retained as each vendor quotes them.

| Configuration | 2 s inspection | 30 s test | 120 s build |
| --- | ---: | ---: | ---: |
| Cloudflare standard-2, 1 vCPU/6 GiB/12 GB | $0.0000717 | $0.001075 | $0.004301 |
| Vercel iad1, 1 vCPU/2 GB; fresh session | $0.000778 | $0.001774 | $0.005681 |
| E2B, 1 vCPU/2 GiB | $0.0000460 | $0.000690 | $0.002760 |
| Daytona, 1 vCPU/2 GiB/8 GiB disk | $0.0000462 | $0.000693 | $0.002771 |
| Modal, 0.5 physical core/2 GiB; unpinned region | $0.0000661 | $0.000992 | $0.003966 |
| Fly performance-1×/2 GB, displayed base-region quote | $0.0000254 | $0.000382 | $0.001527 |

Inputs are the linked price pages above. Daytona assumes three billable GiB after the five-free allowance. Vercel conservatively rounds allocated memory to 60-second increments and includes one creation; the floor is per running lifecycle, **not automatically per command on the same warm runner**. A resumed lifecycle's precise rounding should be confirmed. Modal region multipliers would increase its row. These estimates rank invoice components, not runner throughput. [E]

Example formulas [E]:

```text
Cloudflare = 0.000020 * active_cpu_seconds
           + (6 * 0.0000025 + 12 * 0.00000007) * running_seconds
Vercel    = (0.128 / 3600) * active_cpu_seconds
           + (2 * 0.0212 / 3600) * 60 * ceil(running_seconds / 60)
           + 0.0000006 * creates
E2B       = (1 * 0.000014 + 2 * 0.0000045) * running_seconds
```

Do not publish a short-command Sprites cost until its hourly/per-second minimum conflict is resolved. **If** actual-use fractional-hour metering has no hour floor, one CPU plus 2 GB RAM and 5 GB hot disk costs about **$0.0000238/s**, or **$0.000714/30 s**, plus retained cold disk. This is an explicitly conditional calculation, not a verified invoice minimum. [E]

A 1–10 ms TypeScript operation has no separate runner bill. Workers' listed CPU rate of $0.02/million CPU-ms implies **$0.00000002–$0.0000002** for that CPU alone; add Worker requests, DO/storage and any Dynamic Worker charges. The locally measured pipeline was not a hosted CPU billing measurement. [F: [Workers price](https://www.cloudflare.com/plans/); E: arithmetic]

Warm costs matter more than subcent command compute. Cloudflare standard-2 at zero active CPU costs **$0.00001584/s** in RAM/disk: **$0.000475 per 30 s gap**, **$0.00950 per 10 min idle**. Thus its legacy ten-minute idle timeout can cost ~9× a full-CPU 30 s test after every isolated burst. Keeping it warm over a 30 s model response avoids roughly a second of restart at less than one-twentieth of a cent, before state-save costs. [E]

For E2B 1 vCPU/2 GiB a 30 s warm gap costs **$0.00069**; full-memory pause itself is documented at roughly eight seconds for 2 GiB, so immediate pause may not buy much during short gaps. At Vercel 1 vCPU/2 GB the minimum memory allocation alone is **$0.000707** per fresh one-minute lifecycle. Stop/start on every short command can increase costs versus grouping them. [E/I]

The approximate infrastructure saving is `1 / (busy duty fraction + billed warm tails + save/restore overhead expressed as a fraction)`, only when comparing the same runner shape and excluding retained-state/control costs. **10× needs ≤10% effective paid duty; 50× needs ≤2%.** Against an already idle-suspending system the ratio can be much smaller. Persisting an extra ten seconds of model-wait memory is often cheaper than rebuilding dependencies. No evidence here establishes the proposal's 10–50× session saving. [E/I]

## 6. Early blockers, ranked by probability × damage

Scores are subjective **E** on a 1–5 scale, not statistical probabilities. Experiments are proposed unless explicitly labeled M above. They fit an hours-scale gate; live vendor tests require a separately available test account/environment and were **not** run under this brief's no-account/no-deploy restriction.

| Rank | Blocker and score | Why/evidence | Cheap experiment and pass/fail threshold |
| --- | --- | --- | --- |
| 1 | Workspace/cache materialization, **5×5=25** | F: published FUSE install ~2× ext4 before DO pull. I: mandatory whole-tree sync can erase all savings and lose edits. | 2–4 h: on an existing disposable Linux host compare native workspace, full sync and source-only sync on a small TS repo plus a ~30k-file dependency tree. Repeated edit → test → checkpoint → restore; inject restart during each transition. **Pass:** exact source bytes/modes/symlinks/deletes, zero lost acknowledged edits, warm overhead <10% of native test time and p95 rehydrate ≤2 s excluding initial install. **Fail:** full sync adds >20% or source recovery is ambiguous; adopt native dependency caches/source-only mirror or stop the split. |
| 2 | jitk required to provide general Linux, **5×5=25 if mandatory** | F: current readonly archive, static workloads, single channel; GrowOS path fixes add one corpus success. I: mandatory jitk turns this into OS development. | 1–2 h static ABI audit against `bash -c 'echo x > f; cat f'`, `git init`, `node -e`, and a minimal npm test trace captured on a normal host (no kvm-dev). **Pass to reopen jitk route:** writable file cycle, pipes/child execution, Node and test run unmodified with byte-correct output. Current documented design fails before execution. **Action now:** choose ordinary Linux; do not fund kernel growth as a prerequisite. |
| 3 | Savings versus pause/resume incumbents, **5×4=20** | F: active-CPU pricing and persistent/paused runners already exist; Vercel minute floor; Sprites pricing conflict. | 2 h offline replay of ≥100 real command/idle intervals, same dependency-cache policy; compare always-live, 10/30/60 s grace, provider pause and brain-in-runner baseline. Include subscription, memory floors, snapshots and data transfer. **Pass claimed 10×:** ≥10× reduction in full hands cost with <5% added session time. **Fail:** <2× or state overhead dominates; keep the split only for other measured benefits. Ask Sprites for exact minimums before assigning it a short-command price. |
| 4 | Region/capacity/fan-out, **4×4=16** | F: CF capacity constraints; E2B regional projects and creation rate; Sprites no region selector; Vercel 20 regions does not promise available capacity. | 2–3 h from intended DO regions, using an already authorized staging environment: 100 sequential creates/resumes then bursts of 20/100 with bounded retries. Record placement, queue, failures and image-cache state. **Pass:** ≥99% command readiness within 5 s, p95 ≤2 s, no forbidden-region fallback. **Fail:** route to another allowed provider/region or constrain supported geography/concurrency. This cannot be proven from a laptop request to a public endpoint. |
| 5 | Short-command start/transport latency, **4×3=12** | F: TTI is ~0.5–1.3 s in common benchmark; jitk local ≈1 ms is not PoP RTT. | 1–2 h on existing endpoints: compare HTTPS new/reused and streaming WebSocket, direct versus Tunnel, zero-work and 30 s tasks, same-metro and distant client; record client, DO and host spans separately. **Pass:** warm command overhead p95 ≤50 ms regional, cold p95 ≤2 s; for jitk's separate glue use-case require a meaningful win over a warm Linux service, not merely a cold create. **Fail:** batch commands, place brain near runner, or keep small work local. |
| 6 | TS command equivalence and route replay, **4×3=12** | M: rg differs, native runtimes absent; partially executed scripts can mutate before fallback. | 2–3 h differential replay of 100 actual agent scripts against pinned just-bash and Linux bash/GNU tools, plus dynamic names/substitutions/redirects. **Pass:** 100% bytes/exit/filesystem agreement for admitted scripts, 100% pre-execution rejection of unsupported scripts, zero double-applied edits. **Fail:** shrink local subset; route whole scripts to Linux. The local probe proves feasibility, not this gate. |
| 7 | Long jobs stopped by lifecycle policy, **3×4=12** | F: CF background CPU does not keep instance alive; snapshots exclude processes. | 1–2 h fault-injection harness: disconnect stream, restart DO, expire inactivity timer, cancel and reconnect. **Pass:** every job reaches a known terminal/lost state; no acknowledged job silently disappears, no duplicate npm lifecycle action, completed source recovered. **Fail:** hold an explicit job lease/alarm or use provider-managed jobs; resumable filesystem is not resumable process execution. |

## 7. Five-line TL;DR

1. **GO WITH CHANGES:** TypeScript for a tested small tool subset; normal Linux hands for Git, Node, dependencies, builds and tests.
2. Cloudflare's new path is ~0.68 s measured public TTI with 10 ms metering; Vercel/E2B/Daytona/Modal/Fly already offer credible on-demand alternatives.
3. jitk's ~1 ms/~0.5 MiB results describe small prepared guests; it presently cannot replace a development Linux runner.
4. Preserve native dependency caches and one warm session lease per burst; whole-tree DO sync and billing tails can kill the economics.
5. Cloudflare Computer already implements much of this split; establish a measured advantage over it and existing pause/resume products before rebuilding it.

**Three verifications to run first:** (1) source-only checkpoint/restore correctness and dependency-cache overhead; (2) actual command-trace routing conformance with no partial fallback; (3) replay those traces through realistic provider lifecycle/billing models and validate the chosen region's TTI/capacity in staging. No-go on making general jitk Linux support a dependency of these tests.
