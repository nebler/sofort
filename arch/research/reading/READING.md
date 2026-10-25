# Sofort reading and watching list (reviewed 2026-10-25)

This list merges five lane lists (`01`–`05`), 141 items in all.

**How the links were checked:**
- All 141 links were fetched again after the agents finished: 137 returned HTTP 200.
- Four return 403 to scripted requests only: the cgillum (Medium) post, the Arm blog post, Red Hat and OpenAI Codex. They open normally in a browser.
- For all 19 YouTube videos, the title and channel were confirmed via YouTube's oEmbed endpoint.

**How this list is organised:** the core path below follows the self-test topics. Each lane file has the P2/P3 depth and a "3 hours" path.

## Core path (~30 items, about 15 hours)

### 1. Kernel: boot, exception levels, syscalls, MMU, GIC
- [ ] **A Freestanding Rust Binary** (Phil Oppermann, blog, 20 min): https://os.phil-opp.com/freestanding-rust-binary/
- [ ] **Processor initialization (AArch64 exception levels)** (raspberry-pi-os, blog, 20 min): https://s-matyukevich.github.io/raspberry-pi-os/docs/lesson02/rpi-os.html
- [ ] **User processes and system calls: Linux** (raspberry-pi-os, blog, 25 min): https://s-matyukevich.github.io/raspberry-pi-os/docs/lesson05/linux.html
- [ ] **Virtual memory management** (raspberry-pi-os, blog, 55 min): https://s-matyukevich.github.io/raspberry-pi-os/docs/lesson06/rpi-os.html
- [ ] **Programmable Interrupt Controllers: A New Architecture (GICv3)** (Arm, blog, 7 min; 403 for scripts, opens in a browser): https://developer.arm.com/community/arm-community-blogs/b/architectures-and-processors-blog/posts/programmable-interrupt-controllers-a-new-architecture

### 2. Compatibility, specialisation and the growth loop
- [ ] **Unikraft and the Coming of Age of Unikernels** (USENIX ;login:, ~25 min): https://www.usenix.org/publications/loginonline/unikraft-and-coming-age-unikernels
- [ ] **Releasing Systrap: a high-performance gVisor platform** (gVisor, blog, 12 min): https://gvisor.dev/blog/2023/04/28/systrap-release/
- [ ] **Detecting semantic bugs in Linux using differential fuzzing** (syzkaller, YouTube, segment 07:51–35:13): https://www.youtube.com/watch?v=_H8848Ggo3w&t=471s
- Loupe and Lupine, the closest prior art to the growth loop, are in `01-kernel.md` (P2). **Read them before you call the growth loop novel.**

### 3. Virtualization, microVMs and snapshots
- [ ] **Using the KVM API** (LWN, 25 min): https://lwn.net/Articles/658511/
- [ ] **A minimal VMM in Rust with Apple Hypervisor** (blog, 20 min): https://gigapotential.dev/blog/minimal-vmm-in-rust-with-apple-hypervisor/
- [ ] **Firecracker, NSDI '20** (USENIX, YouTube, 20 min): https://www.youtube.com/watch?v=cwruf1ERAKM
- [ ] **Hyperlight Wasm: fast, secure, and OS-free** (Microsoft, blog, 10 min): https://opensource.microsoft.com/blog/2025/03/26/hyperlight-wasm-fast-secure-and-os-free/
- [ ] **REAP: Benchmarking, Analysis and Optimization of Serverless Function Snapshots** (ASPLOS '21, YouTube, 18 min): https://www.youtube.com/watch?v=zfLd_MTGOA8
- [ ] **Under the hood: how Lambda SnapStart optimizes startup** (AWS, blog, 12 min): https://aws.amazon.com/blogs/compute/under-the-hood-how-aws-lambda-snapstart-optimizes-function-startup-latency/
- [ ] **#snapsafe: restoring uniqueness in VM clones** (LPC, YouTube, 41 min). This is *exactly* the repeated-`Math.random` bug in `V1.md`, exit criterion 6: https://www.youtube.com/watch?v=sHkgQE1UR-U
- [ ] **An EPYC escape: case study of a KVM breakout** (Project Zero, blog, 25 min). Hardware isolation is not magic: https://projectzero.google/2021/06/an-epyc-escape-case-study-of-kvm.html

### 4. Durable execution, effects and crash testing (Capsule)
- [ ] **Building reliable distributed systems in Node.js, part 2** (Temporal, blog, 10 min): https://temporal.io/blog/building-reliable-distributed-systems-in-node-js-part-2
- [ ] **Common pitfalls with durable execution frameworks** (Chris Gillum, blog, 8 min; 403 for scripts, opens in a browser): https://blog.cgillum.tech/common-pitfalls-with-durable-execution-frameworks-like-durable-functions-or-temporal-eaf635d4a8bb
- [ ] **Golem 1.6: Agents, Tools, and Artifacts** (Golem, blog, 15 min). Your closest competitor: https://golem.cloud/blog/golem-1-6-agents-tools-and-artifacts/
- [ ] **Implementing Stripe-like idempotency keys in Postgres** (Brandur, blog, 25 min): https://brandur.org/idempotency-keys
- [ ] **How to do distributed locking (fencing tokens)** (Kleppmann, blog, 15 min): https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html
- [ ] **Testing distributed systems with deterministic simulation** (Will Wilson, Strange Loop, YouTube, 40 min): https://www.youtube.com/watch?v=4fFDFbi3toc
- [ ] **Simulation testing for liveness** (TigerBeetle, blog, 6 min): https://tigerbeetle.com/blog/2023-07-06-simulation-testing-for-liveness/
- [ ] **Jepsen: Orkes Conductor 5.3.2** (Jepsen, analysis, 25 min). How a workflow engine breaks: https://jepsen.io/analyses/orkes-conductor-5.3.2

### 5. Cloudflare, capabilities and agent security
- [ ] **The Cloudflare Workers security model** (Kenton Varda, blog, 25 min): https://blog.cloudflare.com/mitigating-spectre-and-other-security-threats-the-cloudflare-workers-security-model/
- [ ] **Durable Objects: Easy, Fast, Correct, choose three** (Kenton Varda, blog, 19 min): https://blog.cloudflare.com/durable-objects-easy-fast-correct-choose-three/
- [ ] **Code Mode: the better way to use MCP** (Varda and Pai, blog, 12 min): https://blog.cloudflare.com/code-mode/
- [ ] **Sandboxing AI agents, 100x faster (Dynamic Workers)** (Cloudflare, blog, 13 min): https://blog.cloudflare.com/dynamic-workers/
- [ ] **Why Workers environment variables contain live objects** (Kenton Varda, blog, 18 min). Capability bindings: https://blog.cloudflare.com/workers-environment-live-object-bindings/
- [ ] **Cap'n Web: a new RPC system** (Varda and Faulkner, blog, 16 min): https://blog.cloudflare.com/capnweb-javascript-rpc-library/
- [ ] **Paradigm Regained: abstraction mechanisms for access control** (Mark Miller, Google TechTalks, YouTube, 1 h): https://www.youtube.com/watch?v=oE3x_gM3YFU
- [ ] **The lethal trifecta for AI agents** (Simon Willison, blog, 6 min): https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/
- [ ] **Next Token Ep 07, "What's after Code Mode"** (YouTube, 1 h 25 min; prioritise 12:55–1:03:31, with the unikernel part from 48:09): https://www.youtube.com/watch?v=0hRlvn0IPMI

### 6. Wasm, runtimes and honest benchmarking
- [ ] **Memory in WebAssembly (and why it's safer than you think)** (Lin Clark, blog, 8 min): https://hacks.mozilla.org/2017/07/memory-in-webassembly-and-why-its-safer-than-you-think/
- [ ] **Security and Correctness in Wasmtime** (Nick Fitzgerald, blog, 17 min): https://bytecodealliance.org/articles/security-and-correctness-in-wasmtime
- [ ] **Pause and resume WebAssembly with Asyncify** (Alon Zakai, blog, 20 min). The mechanism the Goose spike needed: https://kripken.github.io/blog/wasm/2019/07/16/asyncify.html
- [ ] **Hit the Ground Running: Wasm Snapshots (Wizer)** (Nick Fitzgerald, YouTube, 25 min): https://www.youtube.com/watch?v=C6pcWRpHWG0
- [ ] **Python Workers redux (snapshot restore hazards)** (Cloudflare, blog, 12 min): https://blog.cloudflare.com/python-workers-advancements/
- [ ] **QuickJS: an overview and guide to adding a feature** (Igalia, blog, 20 min): https://blogs.igalia.com/compilers/2023/06/12/quickjs-an-overview-and-guide-to-adding-a-new-feature/
- [ ] **How NOT to Measure Latency** (Gil Tene, Strange Loop, YouTube, 43 min): https://www.youtube.com/watch?v=lJ8ydIuPFeU
- [ ] **Evaluating the Evaluation: a benchmarking checklist** (Brendan Gregg, blog, 8 min): https://www.brendangregg.com/blog/2018-06-30/benchmarking-checklist.html

## When to read what
- **Before publishing benchmarks:** Gil Tene, Gregg's checklist, and "Not So Fast" (Wasm vs native, ATC '19, in 05).
- **Before building Capsule:** section 4, plus #snapsafe and Python Workers redux.
- **Before a Cloudflare interview:** section 5, plus the Firecracker and Hyperlight items.
- **Before claiming novelty:** Loupe, Lupine, Unikraft, Golem and the Morph talk (all in the lane files).

## Lane files (P2/P3 depth, and a 3-hour path each)
`01-kernel.md` · `02-virtualization.md` · `03-durable.md` · `04-cloudflare-capabilities.md` · `05-wasm-runtimes-perf.md`
