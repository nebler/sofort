# Python → scriptc parity

Reference: original scripts at `377e3fdc`, run with Python 3.15.0 on macOS arm64.
The original files were preserved outside this checkout while both versions
were compared, before deleting Python. No raw samples or smoke outputs were
added to Git. `parity-fixture.json` contains only input hashes and regression
digests; its expected values were accepted only after exact Python comparisons.

| Check | Result |
|---|---|
| Integer-seeded MT19937, shuffle, randrange and random | Exact; seeds 0, 1, 601, 603, 39009, 4294967297 and -604 |
| Canonical raw, quiet and native-watchdog runs plus Hyperlight raw | All 460 statistic groups equal, including min/max, p50/p90/p99 and every CI endpoint |
| Paired recertification, recorded `r4-raw.json` | All 10 case/metric summaries equal, including marginal medians and paired bootstrap CIs |
| Hyperlight analyze, recorded results/raw.json | verdict, summary and marginal memory JSON values all equal; 10,000 resamples |
| Ledger CPU, recorded cpu-raw.json | Every value equal, including statistics.mean |
| Ledger memory, preserved memory-raw + memory-n60-raw | All totals, bracket deltas and OLS fits equal |
| Ledger report | TABLES.md byte-for-byte identical |
| Ledger verify | PASS: 48 successful cells, 24 expected capacity failures, 1,848 counter snapshots, 240 CPU samples and 3 HVF repeats |
| Extended locked functional smoke | Six samples PASS: promise10 concurrency, five-reading libproc memory and 16-VM refill/reap; all six timed-out gates retained as contended |
| Controller tests | Statistics; gate pass/timeout; watchdog deadline/EOF; malformed output; detached descendants |
| SIGINT during a locked, load-gated run | Exit 130; finalized raw JSON; no owned VM remains |
| Real locked smoke | Two cold return2 samples PASS, sandbox acknowledgement and READY validated, both gates passed at load1 5.49; no performance claim |

The explicit TypeScript generator implements CPython's integer-seeded MT19937,
`getrandbits` rejection sampling, shuffle and 53-bit random(). No temporary
change to Python's RNG was needed. `random.choices` in Hyperlight memory analysis
uses random(), while paired bootstrap/randrange uses rejection sampling.
Bootstrap replica order, percentile interpolation and seed resets are unchanged.
Python statistics.median's even-pair formula is retained independently of the
canonical quantile formula. Python 3.15 float sum and statistics.mean are also
reproduced where used by OLS and CPU analysis.

All statistical numbers agree as binary doubles, without tolerance. Python
fixed-point formatting is reproduced with ties-to-even. JSON serialization may
omit an integral float's `.0` or choose ECMAScript exponent notation. One
canonical report metadata line consequently says `1 s budget/sample` where
Python says `1.0 s budget/sample`. All four replayed reports' statistical table
cells are byte-identical. The verifier's scope_bytes measures the files present
in its invocation directory and naturally differs between reference copies.

Recheck after building:

```sh
make -C arch/jitk/bench test
JITK_LEDGER_INPUTS=/absolute/preserved-ledger-collection make -C arch/jitk/bench test
```

The memory collections are ignored archival inputs, not portable test fixtures.
The optional replay requires their recorded hashes. The CPU and Hyperlight raw
inputs are already tracked, as are the canonical and recertification datasets.
Tests write only under ignored build/. The `.READY` historical performance
receipt and all published RESULTS files and raw data remain unchanged.

Integration outside this owner's scope:

- `arch/jitk/Makefile` already delegates `bench test` and `bench bench` to this
  Makefile. To remove Python from this aggregate path, replace
  `$(DELEGATE) bench test` / `$(DELEGATE) bench bench` with
  `$(MAKE) -C "$(ROOT)/bench" test` / `$(MAKE) -C "$(ROOT)/bench" bench`, or
  point DELEGATE at the docs owner's native replacement. The DELEGATE and loc
  recipes belong to the aggregate/docs port.
- Replace Python imports in `kernel/tests/measure.py` and `fs_bench.py` during
  their owner's port. Shared gate CLI: `bench/build/gate 6 BUDGET POLL`.
  Worker/sample/usage are exported from `controller.ts` / `native.ts`.
- `executor/breakdown.ts` still launches Python to import run.py's gate. Its
  owner must call `bench/build/gate 6 0` instead. No out-of-scope file was edited.
