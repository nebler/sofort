# Round 4 (final) — common rules

Read these first, under /Users/noah/.t3/scratch/2026-10-23-is-there-a-way-we-5a54f52b:
- `arch/DECISIONS-R3.md` (binding)
- `arch/REVIEW-R3.md`
- `arch/10-minimalist-critic/R3.md`
- `arch/10-minimalist-critic/R3-INTEGRATION.md`
- your own `R3.md`

Rules:
- **Scope.** Write only in your own subtree `arch/jitk/<subtree>/` and your own `arch/NN-*/` dir. Use `/tmp/jitk-NN/` for scratch.
- **Size.** This is a small cleanup round. Do not add features. Deleting code is encouraged.
- **Done marker.** When your part is done, create `arch/jitk/<subtree>/.R4` containing the artifact hashes you tested.
- **Write-up.** `arch/NN-*/R4.md`, ≤80 lines: FIXED items, the numbers, and what is still open.
- **Hygiene.** Record load next to every number. Kill and reap everything you start. Keep ≤4 VMs alive at once, because the macOS address-space limit is 128.
- **Hands off.** Never touch the foreign `/tmp/arch-R2C` job, `~/.local`, global toolchains, or other owners' subtrees.
- **Node.** Use an absolute Node path such as `/tmp/jitk-09/node-real`. `node` on PATH may be a Vite+ shim.
- **Final reply.** ≤15 lines.
