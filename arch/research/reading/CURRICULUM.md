# Sofort curriculum: 12 weeks, about 5–6 hours a week (2026-10-25)

This plan builds on `READING.md` and the lane files (01–05). It runs alongside the day job and the Capsule build. The order follows what you build next:
- **Weeks 1–4** support Capsule: Wasm, durable execution and Cloudflare.
- **Weeks 5–9** go deep on the jitk side for v1: kernel, virtualization and snapshots.
- **Weeks 10–12** turn the knowledge into write-ups and interview depth.

**Each week has four parts:**
- **Watch/Read:** about 2–3 hours.
- **Do:** about 2 hours of hands-on work in the repo or a spike.
- **Explain:** answer the question out loud without notes, as if to a Cloudflare engineer. If you hesitate, redo the week's core item.
- **Write:** add one paragraph to `arch/research/reading/NOTES.md` on what the week changes about Sofort. These paragraphs become raw material for your posts.

---

## Phase 1: Capsule foundations (weeks 1–4)

### Week 1: Orientation, and where this space is going
- [ ] Next Token Ep 07, "What's after Code Mode": watch 12:55–1:03:31, then 48:09 onwards for the unikernel part. https://www.youtube.com/watch?v=0hRlvn0IPMI
- [ ] Code Mode: the better way to use MCP. https://blog.cloudflare.com/code-mode/
- [ ] Anthropic, Code execution with MCP. https://www.anthropic.com/engineering/code-execution-with-mcp
- [ ] Sandboxing AI agents, 100x faster (Dynamic Workers). https://blog.cloudflare.com/dynamic-workers/
- [ ] Simon Willison, The lethal trifecta. https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/
- **Do:** run `make -C arch/jitk demo`, then trace one `execute()` from the MCP server to a tool call and back. Draw it.
- **Explain:** Why is code mode better than calling tools one by one? Where exactly does Sofort's single I/O channel remove the trifecta's third leg?

### Week 2: Wasm memory, isolation and pause/resume
- [ ] Lin Clark, Memory in WebAssembly. https://hacks.mozilla.org/2017/07/memory-in-webassembly-and-why-its-safer-than-you-think/
- [ ] Nick Fitzgerald, Security and Correctness in Wasmtime. https://bytecodealliance.org/articles/security-and-correctness-in-wasmtime
- [ ] Alon Zakai, Pause and Resume WebAssembly with Asyncify. https://kripken.github.io/blog/wasm/2019/07/16/asyncify.html
- [ ] V8, JS Promise Integration (JSPI). https://v8.dev/blog/jspi
- [ ] Nick Fitzgerald, Wasm snapshots with Wizer (talk). https://www.youtube.com/watch?v=C6pcWRpHWG0
- **Do:** reproduce the QuickJS-Wasm park → snapshot → resume-in-Node result from `portability/02-wasm.md`. This is also Capsule week 1.
- **Explain:** Why does a QuickJS `await` need no Asyncify, while the Goose spike did? Why did restoring memory alone repeat the tool call?

### Week 3: Durable execution, and what Capsule competes with
- [ ] Temporal, how durable execution works (Node.js, part 2). https://temporal.io/blog/building-reliable-distributed-systems-in-node-js-part-2
- [ ] Chris Gillum, Common pitfalls with durable execution frameworks (opens in a browser, may block scripts). https://blog.cgillum.tech/common-pitfalls-with-durable-execution-frameworks-like-durable-functions-or-temporal-eaf635d4a8bb
- [ ] Restate, Building a durable execution engine from first principles. https://restate.dev/blog/building-a-modern-durable-execution-engine-from-first-principles
- [ ] Golem, What is durable computing? and Golem 1.6. https://golem.cloud/blog/what-is-durable-computing/ · https://golem.cloud/blog/golem-1-6-agents-tools-and-artifacts/
- [ ] Racket, Serializable closures. https://blog.racket-lang.org/2009/06/serializable-closures-in-plt-scheme.html
- **Do:** write Capsule's falsification fixtures. Make the same program durable three ways: (a) replay, (b) explicit saved state, (c) a capsule.
- **Explain:** What does replay require of your code that a capsule doesn't? When is a database row simply better?

### Week 4: Effects, idempotency, fencing and crash testing
- [ ] Brandur, Implementing Stripe-like idempotency keys in Postgres. https://brandur.org/idempotency-keys
- [ ] Stripe, Designing robust APIs with idempotency. https://stripe.com/blog/idempotency
- [ ] Kleppmann, How to do distributed locking, then antirez, Is Redlock safe? (read both sides). https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html · https://antirez.com/news/101
- [ ] Will Wilson, Deterministic simulation testing (talk). https://www.youtube.com/watch?v=4fFDFbi3toc
- [ ] Jepsen, Orkes Conductor 5.3.2. https://jepsen.io/analyses/orkes-conductor-5.3.2
- **Do:** design Capsule's effects journal state machine (prepared → dispatched → completed → delivered). List every crash window and turn each into a test.
- **Explain:** The executor crashes between "dispatched" and "completed". What happens, and who decides? How does a fencing token stop a stale owner or a fork from causing an effect?

## Phase 2: Cloudflare and capabilities (weeks 5–6)

### Week 5: How Cloudflare thinks about isolation and state
- [ ] Kenton Varda, The Workers security model. https://blog.cloudflare.com/mitigating-spectre-and-other-security-threats-the-cloudflare-workers-security-model/
- [ ] Safe in the sandbox: security hardening for Workers. https://blog.cloudflare.com/safe-in-the-sandbox-security-hardening-for-cloudflare-workers/
- [ ] Durable Objects: Easy, Fast, Correct, choose three. https://blog.cloudflare.com/durable-objects-easy-fast-correct-choose-three/
- [ ] Zero-latency SQLite storage in every Durable Object. https://blog.cloudflare.com/sqlite-in-durable-objects/
- [ ] Workers for Platforms. https://blog.cloudflare.com/workers-for-platforms/
- **Do:** run the Capsule control plane under `wrangler dev`: Worker → Durable Object → R2 → Dynamic Worker, all local.
- **Explain:** Why does an awaited call block a Durable Object from hibernating? What is the DO's consistency guarantee, and how does Capsule's journal rely on it?

### Week 6: Object capabilities, from E to Cap'n Web
- [ ] Mark Miller, Paradigm Regained (talk, 1 h). https://www.youtube.com/watch?v=oE3x_gM3YFU
- [ ] Capability Myths Demolished (summary). https://blog.acolyer.org/2016/02/16/capability-myths-demolished/
- [ ] Cap'n Proto, Time-traveling RPC. https://capnproto.org/news/2013-12-12-capnproto-0.4-time-travel.html
- [ ] Cap'n Web. https://blog.cloudflare.com/capnweb-javascript-rpc-library/
- [ ] Why Workers environment variables contain live objects. https://blog.cloudflare.com/workers-environment-live-object-bindings/
- **Do:** implement grant-scoped tools with a generated `.d.ts` per grant in the executor. It's the cheap, high-value steal from `cloudflare-deep.md`.
- **Explain:** What's the difference between ambient authority and a capability? Why must saved capability stubs be re-authorised when a capsule is restored?

## Phase 3: Kernel and virtualization depth for jitk v1 (weeks 7–9)

### Week 7: The AArch64 kernel, end to end
- [ ] Phil Oppermann, A Freestanding Rust Binary and A Minimal Rust Kernel. https://os.phil-opp.com/freestanding-rust-binary/ · https://os.phil-opp.com/minimal-rust-kernel/
- [ ] raspberry-pi-os lessons 2.1 (exception levels), 3.1 (interrupts), 5.2 (syscalls) and 6.1 (virtual memory). https://s-matyukevich.github.io/raspberry-pi-os/docs/lesson02/rpi-os.html · …/lesson03/rpi-os.html · …/lesson05/linux.html · …/lesson06/rpi-os.html
- [ ] Arm, GICv3 overview (opens in a browser). https://developer.arm.com/community/arm-community-blogs/b/architectures-and-processors-blog/posts/programmable-interrupt-controllers-a-new-architecture
- **Do:** annotate jitk's boot path, exception vectors and syscall dispatch with comments in a scratch copy, then compare them against the lessons.
- **Explain:** How does a syscall travel from EL0 to jitk's handler and back? What exactly breaks on a Pi's GICv2 in `fdt.rs` and `wait.rs`?

### Week 8: KVM, VMMs and microVMs
- [ ] LWN, Using the KVM API. https://lwn.net/Articles/658511/
- [ ] A minimal VMM in Rust with Apple Hypervisor. https://gigapotential.dev/blog/minimal-vmm-in-rust-with-apple-hypervisor/
- [ ] Christoffer Dall, To EL2, and Beyond! (talk). https://www.youtube.com/watch?v=j0bp4fnO98w
- [ ] Firecracker, NSDI '20 (talk). https://www.youtube.com/watch?v=cwruf1ERAKM
- [ ] Hyperlight Wasm, then Hyperlight 0.0009 s. https://opensource.microsoft.com/blog/2025/03/26/hyperlight-wasm-fast-secure-and-os-free/ · https://opensource.microsoft.com/blog/2025/02/11/hyperlight-creating-a-0-0009-second-micro-vm-execution-time/
- [ ] Project Zero, An EPYC escape. https://projectzero.google/2021/06/an-epyc-escape-case-study-of-kvm.html
- **Do:** write a ~100-line KVM (or HVF) toy that runs a few instructions and handles one exit. Then map it onto the shard's run loop.
- **Explain:** What happens on a VM exit? Why is double nesting (HVF → KVM) about 1 ms per exit? Where does Sofort beat Hyperlight, and where does it lose?

### Week 9: Snapshots, restore and uniqueness
- [ ] REAP, ASPLOS '21 (talk). https://www.youtube.com/watch?v=zfLd_MTGOA8
- [ ] FaaSnap (talk). https://www.youtube.com/watch?v=fLcPzppwCSE
- [ ] Lambda SnapStart under the hood. https://aws.amazon.com/blogs/compute/under-the-hood-how-aws-lambda-snapstart-optimizes-function-startup-latency/
- [ ] Modal, Memory snapshots. https://modal.com/blog/mem-snapshots
- [ ] #snapsafe: restoring uniqueness in VM clones (talk). https://www.youtube.com/watch?v=sHkgQE1UR-U
- [ ] Python Workers redux (snapshot restore hazards). https://blog.cloudflare.com/python-workers-advancements/
- **Do:** fix or design the fix for `V1.md` exit criterion 6, where `Math.random` repeats after a restore. Reseed per run from the kernel and write a test.
- **Explain:** Why is restore 2.8–6 ms today and what would get it to ≤1 ms? Why doesn't refreshing kernel entropy fix userspace PRNGs?

## Phase 4: Compatibility, honesty and turning it into output (weeks 10–12)

### Week 10: Compatibility layers, and whether the growth loop is novel
- [ ] Unikraft and the coming of age of unikernels. https://www.usenix.org/publications/loginonline/unikraft-and-coming-age-unikernels
- [ ] Loupe, then Lupine. https://unikraft.github.io/loupe/ · https://sibin.github.io/papers/2020_EUROSYS_Lupine_HsuanChiKuo.pdf
- [ ] WSL system calls, then gVisor Systrap. https://learn.microsoft.com/en-us/archive/blogs/wsl/wsl-system-calls · https://gvisor.dev/blog/2023/04/28/systrap-release/
- [ ] Bryan Cantrill, Unikernels are unfit for production (the counterargument). https://bcantrill.dtrace.org/2016/01/22/unikernels-are-unfit-for-production/
- [ ] Differential fuzzing of Linux (talk, 07:51–35:13) and LWN on LLM assistants for kernel development. https://www.youtube.com/watch?v=_H8848Ggo3w&t=471s · https://lwn.net/Articles/1032612/
- **Do:** write the growth-loop section of the launch post: what's new compared with Loupe and Lupine, its trust model, pass rates and failures.
- **Explain:** Why is the growth loop never on the request path? Answer Cantrill's strongest objection.

### Week 11: Benchmarking honestly
- [ ] Gil Tene, How NOT to Measure Latency (talk). https://www.youtube.com/watch?v=lJ8ydIuPFeU
- [ ] Emery Berger, Performance Matters (talk). https://www.youtube.com/watch?v=r-TLSBdHe1A
- [ ] Brendan Gregg, Benchmarking checklist and the USE method. https://www.brendangregg.com/blog/2018-06-30/benchmarking-checklist.html · https://www.brendangregg.com/usemethod.html
- [ ] Not So Fast: Wasm vs native (ATC '19 talk). https://www.youtube.com/watch?v=dK-8O-ajQQQ
- [ ] Laurie Tratt, Problems in VM warmup. https://tratt.net/laurie/blog/2022/more_evidence_for_problems_in_vm_warmup.html
- **Do:** audit the published benchmark against Gregg's checklist: bare metal, same host, n, load, raw data, coordinated omission, and the losses included.
- **Explain:** What is coordinated omission, and does your p99 suffer from it?

### Week 12: Goose and runtimes, then the capstone
- [ ] The Goose language page, and FlatBuffers. https://aardappel.github.io/goose/ · https://opensource.googleblog.com/2014/06/flatbuffers-memory-efficient.html
- [ ] Wouter van Oortmerssen on Lobster (talk, 1:05:40–1:29:14). https://www.youtube.com/watch?v=hDT79xdqf3k
- [ ] QuickJS: an overview (Igalia) and Building a runtime with QuickJS. https://blogs.igalia.com/compilers/2023/06/12/quickjs-an-overview-and-guide-to-adding-a-new-feature/ · https://healeycodes.com/building-a-runtime-with-quickjs
- [ ] Morph, Infrastructure for the Singularity (talk; a competitor's framing). https://www.youtube.com/watch?v=2goSS66XRBk
- **Capstone:** give a 30-minute "Sofort deep dive" out loud and record it, covering boot → syscall → VM exit → snapshot → capsule → effects journal → Cloudflare deployment. Every hesitation becomes a review item. This doubles as interview preparation.

---

## Rules that make it stick
- **Don't skip "Explain".** It's what turns reading into the ability to defend every design decision, which is what separates a top-tier interview from a merely good one.
- **Missing a week is fine; shuffling the order isn't.** Phases 1–2 feed Capsule now, and phase 3 feeds v1.
- **Go deeper only where you're stuck.** The P2/P3 items in the lane files are for that, not for completionism.
