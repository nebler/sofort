# Sofort

Just-in-time, purpose-built computers that agents talk to (over MCP).

Agent-written code runs in single-use microVMs on **jitk**, a tiny no_std Rust kernel
(~26 syscalls) that grows offline: a missing syscall is recorded, an agent writes the
handler, and it is differentially tested against Linux before it ships.

| Path | What |
|---|---|
| `arch/jitk/` | The product: kernel, VMM (libkrun + sandbox + native watchdog), executor (TS), MCP server, grow loop, protocol, bench |
| `arch/FINAL.md`, `arch/PLAN-R5.md` | Current state, measurements, corrections, next plan |
| `arch/01-…10-*/`, `arch/REVIEW-*`, `arch/DECISIONS-*` | Architecture review rounds R1–R4 (history) |
| `arch/research/` | Landscape, Cloudflare deep dive, QuickJS verdict, third-option design |
| `arch/viz/` | Animated explainers (`idea.html`, `demo.html`; `python3 build.py scenes-idea.js idea.html`) |
| `kvm-dev/` | Ubuntu 26.04 nested-KVM dev VM on Apple Silicon (images git-ignored) |
| `spike/` | First boot spike |

Start with `arch/jitk/README.md`, then `make -C arch/jitk build test`.
