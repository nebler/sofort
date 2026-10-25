# Shared protocol hostile-guest suite (03 → 07 / H5)

Run from the repository root with a verified Node 24 executable:

```sh
JITK_VM_N=30 /tmp/jitk-09/node-real arch/jitk/protocol/hostile/run.mjs
```

`cases.mjs` contains JavaScript async bodies, executed inside stock QuickJS EL0
in a fresh **real VM** per attempt. It does not emulate guest output in the host.
`../vm.mjs` supplies artifact selection, the canonical dispatcher, bounded input
writes, an independent wall-clock watchdog, SIGKILL and reap. See parent README
for `JITK_IMAGE`, `JITK_VMM`, `JITK_VMM_CLI` overrides (01 CLI or 02 R2 CLI).
Integrated kernel output is `kernel/dist/kernel.bin` once kernel/.READY exists;
the explicitly labeled R2 fallback can expose older-kernel failures.

Coverage: forged envelope authority, prototype capability intent, forged RS
records, duplicate ids, 65 outstanding and 4097 total calls, raw record/byte log
floods, escaped Unicode log overflow, oversized frames, os.write control bytes
including DEL/high bytes, and fd2 injection. Control tests put a valid call and
a forbidden byte in **one syscall**, asserting zero prefix callbacks. fd2 cases
require the forged write to be dropped, then deliberately violate stdout schema
so the VM is killed by the dispatcher. No watchdog kill counts as success.

Every attack requires either a dispatcher kill with the expected fault or a
natural kernel/EL0 termination with a diagnostic, no done, and zero fixture tool
effects. Successful initial calls in flood tests are held or answered by an
in-memory null stub to test credits; they never invoke external providers. The
prototype capability case tests own-property policy before any invocation.
The suite tests absence of tool-dispatch effects and absence of fd2/partial-write
injection in the host protocol. This is **not** evidence about all possible host
filesystem/network effects: 07 owns confinement and broader runaway CPU, memory,
PSCI/MMIO/device abuse tests. Use the integrated sandbox launcher for H5 claims.

`results.json` records each pass/fail, exit/fault/kernel record, byte/callback
counts, raw total-process timing samples and uptime loads before/after each row.
The timings are contended functional-test durations, not performance numbers.
