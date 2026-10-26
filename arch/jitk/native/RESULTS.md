# Native Mac core results — 2026-10-26

**The requested Mac core checks pass against scriptc executables, including all
27 canonical MCP checks. A real MCP call returned `{result:2,logs:[]}`. Native
is still opt-in: broader Node-product parity is incomplete.** Node executor,
MCP, grow and scriptc-corpus sources were not modified.

Branch `native/core`, started at `49921120f2fff69a01033851c755aa868662ef38`.
The final head SHA is in the handoff, not embedded in its own commit. Commits
separate executor, MCP, policy correction, watchdog ownership, canonical test
adapters/repros, attribution, receipt provenance, benchmarking and this report.
No push was performed.

## Test matrix

Tests ran on Apple M4 Pro (Mac16,8), 12 logical CPUs, 24 GiB RAM, arm64,
macOS 26.6.1 (25G76), using exactly pinned scriptc **0.4.5**. Build warnings flag
remaining dynamic JSON paths (SC6101); they are warnings, not failed checks.

| Canonical check | Native result | Coverage |
|---|---|---|
| `mcp/test.mjs` | **PASS 27/27** | Official SDK stdio + Streamable HTTP; real tools, schema/policy errors, parallel calls, resource traversal, malformed bytes, timeout, foreign Host 403, EOF and SIGTERM; all observed child pids gone |
| `pool-check.ts` | **PASS, all 5 scenarios** | G1 gates, capacity until reap, single use, bounded refill, aborting startup, sizing |
| `resolve-check.ts` | **PASS** | Result before SIGKILL; independently delayed VMM and watchdog reaps both hold capacity |
| `sandbox-check.ts` | **PASS 4/4 modes** | Host and fragmented ack accepted; missing/guest-forged ack rejected |
| `transport-check.ts` | **PASS 6/6 modes** | Bad READY, DEL, trailing frames, duplicate keys, forged tool, replay; side-effect assertions intact |
| `watchdog-check.ts` | **PASS** | Independent 250-ms deadline during 1500-ms host event-loop block; receipt and reap checked |
| `api-check.ts` | **PASS** | 30 × 64 calls, reverse completion, maxOutstanding=64; four null/args/error edge cases |
| `policy-check.ts` | **PASS 22 + 22** | All owner assertions plus real VM effects, taint, exact approvals, budgets, credentials/revocation, redaction |
| `prepared-check.ts` | **NOT APPLICABLE** | Linux shard snapshot identity, preloaded helpers and ring-source checks; no Mac HVF prepared path |
| Additional `verify.ts` core subset | **PASS 16/16 selected cases** | Binary codec, UTF-8, preludes/logs, policy/provenance, loops/cancellation, nonsettling tools, isolation, name sanitization, 1024-log bound, shared-backend pools |
| Remaining `verify.ts` cases | **UNIMPLEMENTED 4/20** | Schema/type generation and three TanStack driver/API integrations; full Node verify suite does not pass natively |
| `wrapper-conformance.ts` | **NOT PORTED** | Host node:vm/SDK fixture and SDK-facing adapters are not supplied by this native executable |
| Additional `wire-test.mjs` | **PASS 10/10** | Negotiation/fallback, ping, cancellation, exact tool schema rejection, HTTP Origin/Accept/method/version guards |
| Linux shard / Hyperlight | **OUT OF SCOPE** | Explicitly excluded; no Linux timing or addon compatibility claim |

The integrated `node test.mjs` exited **0**. MCP was also rerun against the final
measured binary and passed 27/27. All seven applicable executor checks execute
as compiled native programs, including the policy owner assertions. Node drives
the official MCP client and process fixtures only. [README.md](README.md)
documents every adapter change, including the equivalent pool fake
representation and assertion spellings. No assertion in the seven requested
executor suites was removed or weakened. The extra verify subset is explicitly
identified, rather than described as the full 20-case suite.

End-to-end: official SDK HTTP `tools/call` → `execute` →
`return await math.add(1, 1)` → real confined jitk/HVF VM with guest QuickJS →
`structuredContent: {result:2,logs:[]}`, `isError:false`. The same result was
validated over stdio in both benchmark controls. No host JS evaluator or fake VM
was used for these executions.

## Final locked Mac measurement

Both arms were measured under `/usr/bin/lockf -k /tmp/sofort-bench.lock`, with
compilation and tests finished. This is the spike's method: start the clock
immediately before spawning a fresh process, send initialize immediately, stop
only after parsing and validating the response; 50 processes, ordinary median
of the two middle samples. This is a fresh-process measurement with warm file
caches, not a disk-cache flush. Warm=2/maxLive=8 and the same config, demo
providers, resources, VMM and kernel were used. Initialize is not pool readiness.

| Metric | Node control | Native core |
|---|---:|---:|
| Executable bytes | 121,832,704 | **3,649,752** |
| Executable MiB | 116.19, excluding JS/deps | **3.48**, including runtime |
| Spawn → validated initialize, median of 50 | **153.96 ms** | **37.26 ms** |
| Min / max | 147.61 / 231.53 ms | 35.18 / 63.11 ms |
| Parent RSS at idle | 86,528 KiB (**84.50 MiB**) | 8,736 KiB (**8.53 MiB**) |
| Parent RSS after one real execute/refill | 86,720 KiB (**84.69 MiB**) | 8,912 KiB (**8.70 MiB**) |
| Validated execute result | `{result:2,logs:[]}` | `{result:2,logs:[]}` |
| load1 before / after | 7.31 / 7.97 | 7.97 / 8.14 |

RSS is one additional server process per arm, after 1 s idle and 250 ms after
execute. It excludes VMM, watchdog and driver RSS. Host load remained high;
numbers are indicative functional measurements, not quiet-host throughput or
whole-system memory claims. An earlier 149.12/34.19-ms exploratory timing is
superseded by this final measurement.

The Node control is built from copied current canonical sources with existing
installed dependencies. Only the unused Hyperlight export is removed, matching
the spike's baseline method. No provider import is hard-coded in that control.
Node is `/tmp/jitk-09/node-real`, v24.22.1. Compiler install, native test builds
and source copies are all confined to this directory.

Artifact identities:

- Native server SHA-256: `683d55948255a67c4e9448d96186c7bb458f45a61033e3bfc35a2cd249339432`.
- VMM `/tmp/jitk-r8/vmm-mac/jitk-vmm`: `af5ccbb372e00d44215cfcc9e5ec4adc9eb4f09bd38db6e01c62c30bebaf20b8`.
- Kernel override `/Users/noah/code/sofort/arch/jitk/kernel/dist/kernel.bin`: `e3d774eb844f2cca9f1ba2b28c5b732c7ebc659e01dbafb0505d0d0f1d08b1f6`, matching the tracked kernel marker.

Raw samples, source hashes, full logs, compiler caches and binaries remain in
ignored `.work/` and `dist/`; none is committed. Disk had 41 GiB free initially,
38 GiB at the final check; builds refuse to proceed below 15 GiB. No Docker
cleanup or upstream issue filing occurred.

## Negative findings and remaining gaps

Initial direct fixture compilation/execution failed on native Fake method
lookup, heterogeneous promise waits, typed JSON unions, tuple inference,
non-null method receivers and callback assertions. Minimal repros and applied
workarounds are in [SCRIPTC-GAPS.md](SCRIPTC-GAPS.md). The owner tests caught an
own-property lookup ordering error in the port; it was corrected. Extra verify
coverage caught premature shared-watchdog shutdown; backend references now
retain ownership across pools. Both were rerun successfully.

An early watchdog fixture completed its assertions but did not exit because it
left a live referenced watchdog. A sample recorded `scr_children_wait/kevent`;
no zombie child was observed. Explicit backend teardown fixes that case, and
all native spawns have a timeout/sample guard.

Default cutover still requires:

1. Implement or deliberately retire the missing provider schema/type and
   TanStack/Cloudflare wrapper APIs, and run their complete canonical tests.
2. Decide source normalization parity: native supports bodies/fences/common
   arrows but not Acorn's final-expression, export-default and named-function
   transformations. Guest parsing remains QuickJS-only.
3. Supply a compiled provider registry/build workflow beyond the demo. Runtime
   arbitrary module import, disabled-execute artifact independence, and the
   execute-extra-property behavior currently differ from Node.
4. Package relocatable config/resources/artifacts and bind parking evidence for
   deployed VMM/kernel pairs. Add broader MCP conformance, multi-client
   cancellation, sustained capacity and long-running cleanup validation.

The requested core matrix is green; it does **not** establish full Node-product
parity or authorize changing the default.
