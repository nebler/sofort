# T6: read-only SQL incident query

**Prompt** (verbatim in `task.json` `.prompt`): in `incident.sqlite` (schema
in `schema.sql`), find every successful deploy after which that service's 5xx
rate in that region at least tripled and reached 1%. Compare the 60 minutes
before (`[t-60m, t)`) with the 60 minutes after (`[t, t+60m)`). Report the
team that owned the service at deploy time. The program is one SQL query.
Native profiles run it; the JS driver records a skipped row.

## Data: synthetic, seeded (`generate.ts`, seed 20261029)

`incident.sqlite` is 659,456 bytes, committed, and its sha256 is in
`../manifest.json`. `generate.ts` rebuilds it byte for byte with Node 24's
`node:sqlite`.

| Table              | Rows  | Content                                                             |
| ------------------ | ----- | ------------------------------------------------------------------- |
| `services`         | 10    | name, tier                                                          |
| `ownership`        | 12    | team history with `valid_from`/`valid_to`                           |
| `deploys`          | 20    | 2026-10-29, three regions, status `succeeded`/`failed`              |
| `request_counters` | 8,640 | 5-minute buckets × 10 services × 3 regions: requests, 5xx, p50, p99 |

Traffic is diurnal with Poisson-like noise, and the base 5xx rate is 0.2%.
All timestamps are ISO-8601 text (`2026-10-29T14:06:27Z`).

**The answer:** one row. `payments-api` in `eu-central-1`, version
`2026.10.29-3` at 14:06:27Z, team `payments-core`, 5xx rate 0.205% → 4.248%.

**Traps** (each changes the answer when mishandled):

| Trap                                                                                                             | Naive result        |
| ---------------------------------------------------------------------------------------------------------------- | ------------------- |
| `datetime(ts, '-60 minutes')` returns `YYYY-MM-DD HH:MM:SS`, which never compares correctly with `...T...Z` text | no rows at all      |
| owner joined on the current row (`valid_to IS NULL`); payments-api moved to `payments-platform` at 17:00         | wrong team          |
| no `status = 'succeeded'` filter: `inventory-api` 3.9.2 failed at 14:51, then a spike followed (0.19% → 1.57%)   | extra row           |
| integer division `SUM(errors)/SUM(requests)`                                                                     | rates of 0, no rows |
| the same payments deploy in eu-west-1 and us-east-1                                                              | must not appear     |
| `catalog-api` v412: 0.21% → 0.68% (3.2×, but under 1%)                                                           | must not appear     |
| `search-api` 5xx spike at 09:10–09:45 with no deploy                                                             | must not appear     |
| the 15:20 rollback in eu-central-1 (rate falls)                                                                  | must not appear     |

## Files

- `query.sql`: the reference query. `strftime('%Y-%m-%dT%H:%M:%SZ', ...)`
  builds window bounds in the same text format, scalar subqueries compute
  before/after rates, and ownership is joined as of the deploy time.
  `check.ts` runs it as well as the programs.
- `programs/*.sql`: five Claude Opus 5.5 variants. They use, in turn: CTE and
  subqueries; derived tables with `datetime()` wrapped in `strftime`;
  `julianday` arithmetic; a full per-bucket window-function series that
  fetches more than needed (all deploys, p99 averages, `ROW_NUMBER`) and is
  filtered at the end; and epoch seconds with `IIF`, `BETWEEN` and `ROUND(...,
  6)`.

## Oracle

`oracle.ts` reads the four tables with plain `SELECT *`. It recomputes the
windows on epoch milliseconds, the rates from summed counters, and the owner
valid at the deploy time, all in JavaScript. It compares row count, order and
the five text columns exactly, and the rates to ±5e-7 (rounding to 6 decimals
is allowed).
