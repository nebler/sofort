# Round 5: just-in-time, purpose-built computers that agents talk to (2026-10-24)

Framing comes from Next Token Ep 07 "What's after Code Mode" (2026-10-19, ~53:42). It predicts unikernels built for purpose, "almost just in time", that clients reach over MCP. It also covers "everything is a file" and Cap'n Web stubs.

Binding principles:
- Performance first.
- Simplicity = moving parts.
- No interpreters on the runtime path.

| # | Work | Owner | Status |
|---|---|---|---|
| A | Deep research: cloudflare-os, capnweb, agents/codemode (clones in research/repos) → research/cloudflare-deep.md | Sonnet agent | done |
| B | QuickJS verdict: sources + native benchmarks vs quickjs-ng/V8 → research/quickjs-verdict.md | Sonnet agent | done |
| C | MCP front end: jitk/mcp (execute tool, resources, stdio), overhead measured vs direct execute | Claude agent | done |
| D | Read-only resource FS in the guest (packed archive, minimal read-only syscalls, differential tests) | Claude agent | done |
| next | Snapshot VMM spike, which makes density the price of entry | – | after A–D |
| next | Build per request: task → kernel profile + binaries + resources, cached by hash, booted in ms, called over MCP | – | after C+D |
| next | Cap'n Web-style pipelining through the executor (depends on A) | – | after A |
| next | Syscall census of ~25 static tools (tests the "few dozen syscalls" bet) | – | queued |

## R5 results (lead-verified 2026-10-24 14:24)
- Clean-copy `make build test`: EXIT 0, all suites including the new mcp and fs tests. `make demo`: EXIT 0.
- **MCP** (jitk/mcp): 26/26 checks. MCP stdio adds ~0.4–0.5 ms p50 over in-process execute.
  - Lead fixed executor/select-backend.ts to accept both G1 formats and removed the MCP workaround. mcp tests are 26/26 after the fix.
- **Resource FS:**
  - 9 syscalls; net +203 kernel LOC.
  - Byte-identical to Linux in 30/30 VMs each for the probe, Lua and qjs cases.
  - Boot cost ~0.15 ms/MiB.
  - Resources cost guest RAM 1:1 per VM, so snapshot/CoW sharing matters even more.
  - New libkrun patch raw-direct-load.diff saves 2.8 MiB/VM on macOS.
- **QuickJS:** keep it, for size and startup only. Corrections are in FINAL.md.
- **Cloudflare:** Cloudflare OS has no VM or unikernel. Top steals:
  - grant-scoped capabilities;
  - per-grant .d.ts;
  - simulate-then-approve;
  - files as a grown syscall class mapped to tool calls.
