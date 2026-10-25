# Brief: what can be built on the "pausable tiny computer" primitive (2026-10-25)

## The primitive (some of it is PLANNED, not built — be precise)
jitk/Sofort runs a program (today: static QuickJS JS, static Lua; any static binary in principle) in a hardware-isolated microVM
(libkrun, KVM on Linux / HVF on macOS) on a ~1.7k-LOC no_std Rust kernel with 24 syscall slots.
The guest's ONLY I/O is one JSON-lines tool channel to a trusted host executor. No network, no host files, no sockets.

Built and measured today: fresh single-use VM per run; cold ~6 ms raw / ~9 ms via executor; warm MCP tool call ~2.1 ms;
10 concurrent tool calls 6.5 ms; ~4.8 CPU-ms/VM; 10.7 MiB/VM; MCP server; read-only resource FS; offline "kernel growth" loop
(missing syscall -> Linux strace oracle -> agent writes handler -> differential test vs Linux -> versioned manifest).

PLANNED (assume achievable for this exercise, but label it): 
- ~1 MiB marginal memory per VM via shared copy-on-write snapshots (Linux KVM).
- Snapshot at a pending tool call: because ALL I/O goes through the tool channel, a VM blocked on an awaited tool call has
  no host-side state to untangle. So the whole computer (~1 MiB) can be paused to disk, copied, forked N ways, moved to
  another machine, and resumed mid-line.
- Kernel controls time and randomness, so snapshot + journal of tool results since the snapshot = exact deterministic replay,
  for any language.
- Cap'n Web-style capability stubs + promise pipelining over the tool channel (guest holds stubs, never credentials).
- Content-addressed "just in time" computers: hash(kernel profile + binaries + resources + grants) -> cached image.

Known limits: no fork/exec, no threads yet, no shared libs, no network, no writable persistent FS, QuickJS is 3-5x slower
than V8 JIT. Full Linux dev workspaces are out of scope. Hyperlight (Microsoft) and Golem (durable Wasm) are the closest neighbors.

## Context files (read what you need)
- /Users/noah/code/sofort/arch/FINAL.md, arch/PLAN-R5.md, arch/jitk/README.md
- arch/research/pitch/01-value-audit.md .. 09-demo-virality.md (prior round: value, landscape, honesty rules)
- arch/research/next/01-snapshots-memory.md (path to ~1-2 MiB), arch/research/podcast/*.md (durable, capnweb, effects)
- arch/research/next-token-ep07-transcript.txt (Cloudflare podcast "What's after Code Mode")
- arch/research/cloudflare-deep.md

## Rules
- Use web search heavily; cite URLs; separate fact (F) from inference (I).
- Be skeptical: for every idea, say what exists already and why the primitive is actually necessary (not just nice).
- Do NOT modify existing files, commit, post, or contact anyone. Write only your own output file.
- For each idea: one-line pitch, who uses it, what's newly possible, closest existing thing and why it falls short,
  what part of the primitive it depends on (built vs planned), build effort, demo/Twitter potential (1-5), business potential (1-5).
- End with your top 3 ranked, and reply with a ~12-line summary.
