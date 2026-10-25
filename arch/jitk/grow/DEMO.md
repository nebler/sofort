# Explicit replay / live demo

`make demo` defaults to **REPLAY** of the selected recorded growth proposals,
then executes fresh QuickJS and Lua VMs. `make demo ARGS=--live` first invokes the
real read-only headless CLI for all three proposals and runs the full fresh
acceptance pipeline. CLI/auth errors fail the live run; no replay is substituted.
See README for prerequisites and private-auth rails.

The presentation lasts about 45 seconds after preparation, or runs without
pauses with `ARGS=--fast` (combine with `--live` as desired). It labels historical
receipts as `RECORDED REPLAY`, and a live run's receipts as `GENERATED THIS RUN`.
Fresh VM execution is labeled separately; it is never called model generation.

The presentation shows actual missing records, ppoll regrowth with WFI wait,
explicit ENOSYS signal profiles, then byte-checked `reply:ping` and
`{"count":5,"sum":23,"max":9}`. Lua already computes with unregistered ENOSYS;
the growth verifies its fallback contract. Full Linux signal semantics and full
Lua startup syscall equivalence are unverified.

Every preparation stage records wall time and uptime/load. The demo saves actual
event times, both fresh VM receipts, outputs, kernel/VMM/Lua hashes, proposal
mode, and reap status. `demo-release.json` points to that portable relative path.
Fresh live preparation can take minutes; its duration includes real CLI calls
and is recorded separately from the presentation time.
