# Protocol tooling parity

macOS arm64, scriptc 0.4.5, 2026-10-26. Compiler pinned in `arch/jitk/tools/`.

| Check | Python | Native TS |
|---|---:|---:|
| Host corpus | 71 cases, 142 chunked runs | same |
| Boundaries | 14 | 14 |
| Fuzz | 25,000 mutations / 50,000 differential runs | same |
| Real-guest vectors generated | 10 | 10 |
| Generator JSON vs recorded vectors | exact | byte-identical |
| Report on same recorded JSON | baseline | byte-identical Markdown |
| Watchdog EOF / deadline | both kill owned group | same, same stdout/exit |

Both `make test` runs pass canonical import checks. Native generator runs compare
against vectors.json without writing it; stale-evidence/refesh behavior is also
covered by the three docs receipt tests. Generated JSON uses Python-compatible
ASCII escaping and indentation. VM harness now launches the native independent
watchdog. Report defaults to the historical report destination, with an output
override for offline parity checks. No historical report was changed.

See ../docs/SCRIPTC-GAPS.md for shared compiler workarounds.

After merging main (bench e487de60, grow 02a2bdaa), full native-watchdog VM and
hostile runs pass: 10 guest cases ×30 = 300/300 and 19 hostile cases ×30 = 570/570.
Both controllers now keep normal receipts in .work; JITK_RECORD=1 explicitly
selects their original recorded destinations.
