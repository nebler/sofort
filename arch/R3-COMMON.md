# Round 3 — common rules (read first)

You are continuing as the same area owner from round 1. Before doing anything else, read these in order:
1. `arch/BRIEF.md`
2. `arch/DECISIONS-R1.md` and `arch/DECISIONS-R2.md` (both binding; R2 adds E1–E9)
3. `arch/REVIEW-R2.md` (the lead's critique of round 2) and `arch/07-security-sandbox/PROPOSAL.md`
4. your own `arch/NN-*/R2.md`

Paths are relative to /Users/noah/.t3/scratch/2026-10-23-is-there-a-way-we-5a54f52b.

- Write only in your own dir `arch/NN-*/` and your own subtree `arch/jitk/<subtree>/`. Use `/tmp/jitk-NN/` as temp space.
- You may read, but never modify, other agents' dirs. Copy what you need.
  - The kernel owner is 02, at `arch/02-guest-kernel/` (round-2 work in `r2/`).
  - The VMM owner is 01.
  - The protocol spec owner is 03.
- Address every lead objection that concerns your area: either FIXED (with evidence) or REJECTED (with measured evidence).
- Hit your gates and report numbers: n≥30, with median, p90 and p99 where it makes sense. Label anything not measured UNVERIFIED.
- The machine is shared. Record `uptime` load average next to every benchmark. Kill every VM and process you start.
- Never modify `~/`, global toolchains, or anything outside your dirs. Don't execute unknown launchers. Note: a `node` on PATH may be a Vite+ shim, so use an absolute Node path such as `/tmp/jitk-09/node-real`, or check `node -p process.execPath`.
- Security work is owned by a separate agent. Don't duplicate it, but keep the existing must-haves: `panic=abort`, external watchdog, one console port.
- Your final reply is ≤25 lines: what's FIXED, the gate numbers, what's still blocked, and any disagreement with DECISIONS-R1.

## Round-3 additions
- **Output location.** Integrated code goes into `arch/jitk/<your subtree>/`, per DECISIONS-R2 E1; write only there. Put your write-up in `arch/NN-*/R3.md`, ≤200 lines.
- **Coordination markers.**
  - When your subtree builds and tests, create `arch/jitk/<subtree>/.READY`.
  - You may poll other subtrees' `.READY` markers about every 10 minutes, for at most 120 minutes.
  - Never block on a marker without doing your own work in the meantime.
- **Nested KVM.** Linux KVM is available locally through 07's harness: `arch/07-security-sandbox/linux/nested-kvm/`, using QEMU hvf with `virtualization=on`. Use it for Linux functional tests. Nested timings are not performance numbers.
- **Machine load.** A foreign job (`/tmp/arch-R2C`) loads the machine heavily. Never touch it. Record load next to every number and prefer 06's load-gated bench harness once `arch/jitk/bench/.READY` exists.
