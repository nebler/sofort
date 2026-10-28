# Backend-parity corpus

One question with one answer: do the backends agree? (R10 change #7, R9 N6,
`arch/work/CUTOVER-PLAN.md` §2 precondition 5.)

- `cases.ts`: the corpus. Each case has an id, its source, tenant code, the
  fixture tools it may call, and the expected outcome under the product
  contract (what the shipping `jitk` path does): a result plus optional logs
  and side-effect count, an error class (the MCP server's codes,
  `mcp/jitk.mjs` `classify`) with an optional message pattern, or for a burst
  the count of each class. Cases come from `verify.ts`, `hyperlight-check.ts`
  (now folded in), `bench/cases.json`, `shard-check.ts` and `mcp/test.mjs`,
  plus targeted cases at every documented limit. Boundary sizes come from the
  generated `abi.ts` (`IPC.*`, `ARENA_CLASSES`) and `LIMIT`, never literals.
- `allowlist.ts`: the documented differences. Each entry gives the case, the
  backends, the outcome they produce instead, the limit (an `abi ring::` constant
  where one exists) and the reason.
- `../parity-check.ts`: the runner. It builds each backend's `Engine`, runs
  every case through the canonical `MicroVMExecutor` (the MCP cases with the
  MCP core's policy-declared demo tools), normalizes `(class, result, logs,
  effects)` (bytes as hex, long values hashed), and fails on:
  - a backend outcome that matches neither the case nor its allowlist entry;
  - two backends that differ on a case where neither is allowlisted;
  - an allowlist entry that no longer differs (delete it), names an unknown
    case, or was not exercised by a backend that ran.

## Running

| Where | Command | Backends |
|---|---|---|
| Mac | `make -C arch/jitk test` (or `make -C arch/jitk/executor parity`) | `jitk` (libkrun), `hyperlight-js`, `hvf` |
| Linux arm64 KVM host, clean clone | `make -C arch/jitk test-linux` | `jitk` (libkrun on Linux), `shard` |
| Mac, using kvm-dev | `make -C arch/jitk/executor parity-ssh` | both of the above, then the cross-host compare, then the native corpus on the HVF worker against the Linux native oracle (`shard` `check-native-hvf`) |

`JITK_PARITY_BACKENDS=jitk,shard` selects backends; a selected backend that
cannot start fails the run. `hvf` is the shard's ring engine on
Hypervisor.framework (`../shard/src/hvf/zygote.rs`): same kernel, prepared
helpers, IPC and limits, so the ring profile's allowlist entries name both
`shard` and `hvf` and neither has entries of its own. `JITK_PARITY_CASES=<regex>` filters case ids.
Each run writes `executor/.work/parity/<platform>-<arch>.json`
(`JITK_PARITY_OUT` overrides). Messages are kept in the report but not diffed.

`test-linux` needs `make deps` (Node, the shard, the Linux VMM) and builds the
prepared snapshots, the kernel and the executor itself. After the corpus it runs
the shard's library tests and then, under `JITK_BENCH_LOCK` when set, the
shard-only executor suite (`shard-check.ts`: restore, slot concurrency, failure
domains, hostile IPC peers) and the shard's KVM tests.

## Cross-host compare

The Linux run writes `linux-arm64.json`. Copy it into the Mac's
`executor/.work/parity/` (`parity-ssh` fetches it), then:

```sh
cd arch/jitk/executor && ./run.sh parity-compare   # = node build/parity-check.js compare .work/parity/*.json
```

The compare merges the reports' backends (`darwin/jitk`, `darwin/hyperlight-js`,
`linux/jitk`, `linux/shard`) and evaluates them together, so `darwin/jitk`
vs `linux/jitk` must agree exactly. Reports carry a corpus hash, and the
compare refuses a report from another corpus.

## Adding a case or a difference

Add the case with the outcome the product should have. If a backend differs on
purpose, add an allowlist entry naming the limit. If the difference is a bug,
fix it, or record it in the case comment and the report rather than
allowlisting it quietly.
