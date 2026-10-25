# 04 live R2 status — G3 PASS

02 READY selected; native panic=abort host and kernel copied to content-addressed
/tmp/jitk-04/r2 paths (integration-selection.json). Protocol v1 host is an exact
copy of current 03 dispatcher plus raw-DEL rejection fix; local bootstrap exact
current 03. All 20
checks pass on jitk, both Cloudflare wrapper cases pass, TanStack actual tool and
driver pass. Real Executor 30 x 64-call reverse-completion batches pass.
Cold/warm4 n=50 all three requested programs measured; final values in
jitk-bench-results.json. return2 p50 cold22.513ms / warm8.554ms. Independent idle
0.00 CPU-s /10.0047s. Pool refill concurrency2, capacity held through VM+watchdog
reap, bounded/single-use. Independent watchdog survives blocked host event loop.
01's alternative Rust Seatbelt host also returns2/one-tool through the API.

Integration drift: released 02 guest bootstrap predates 03's UTF-8 code/log-budget
helper update (and uses --std instead of imports). Trusted host dispatcher still
enforces the normative UTF-8 caps. Source snapshot kernel-bootstrap.adopted.js;
no other owner's source or release artifact was modified. No D10 disagreement.
Production containment integration remains 01/07/R3-owned; no G3 blocker.

Normative implementation mismatch fixed locally: 03 uses >127 in four ASCII
checks, accepting raw DEL. Our copied dispatcher uses >126; new hostile-peer
transport case verifies rejection before success/policy. This follows the spec,
not a disagreement with D10.
