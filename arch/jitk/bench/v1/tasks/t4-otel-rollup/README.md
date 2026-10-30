# T4: observability rollup (OTLP histograms)

**Prompt** (verbatim in `task.json` `.prompt`): for 13:00–14:00 UTC on
2026-10-30, compute per service the request count, the 5xx error rate, and the
p95 of `http.server.request.duration`. The p95 is the Prometheus
`histogram_quantile` over the hour's merged buckets, and the method is spelled
out in the prompt. Then list the services breaching p95 > 500 ms or error rate
> 1%.

## Data: synthetic, seeded (`dataset.ts`, seed 20261030)

- **Two hours (12:00–14:00) of OpenTelemetry delta histograms.** One point per
  minute per (service, instance, method + route, status code). There are 10
  services with 2 instances each, and 1–3 routes per service. Bounds are the
  semantic-convention defaults in seconds (`0.005 … 10`, plus overflow).
  Request latencies are sampled per request from per-route log-normals and
  then bucketed, so the histograms come from real samples. Traffic ramps up
  over the two hours, about 2.5 M requests in total. Status codes are 200,
  201, 400, 404, 500 and 503.
- **OTLP/JSON encoding**, as an OTLP exporter writes it:
  - `resourceMetrics` → `scopeMetrics` → `metrics` → `histogram.dataPoints`
  - attributes as `[{key, value: {stringValue|intValue}}]`
  - 64-bit integers as strings (`count`, `bucketCounts`, `timeUnixNano`,
    `intValue`)
  - `aggregationTemporality: 1` (delta)
  - `sum`/`min`/`max` in seconds
  - Each page regroups its points under their resource, so resource attributes
    repeat as they do in real export batches.
- **Seeded behavior in the scored hour:**
  - `payments-api` `/v2/payments` slows down 3.4× from 13:35 (p95 820 ms)
  - `search-api` `/search` returns 5xx for 20% of requests from 13:10 to
    13:20 (hourly error rate 1.37%, p95 unaffected)
  - `shipping-api` breaches latency all the time (`/quotes` median 340 ms)
  - `checkout-api` slows a little and stays under (454 ms)
  - Breaching: payments-api, search-api, shipping-api.
- **Mock query API** (`generate.ts`): `queryRange` filters by interval end in
  (start, end] and optionally by `serviceName`. Pages hold 1–2000 points
  (default 500), with an opaque cursor bound to the query. `listServices`
  returns the catalog. Latency is log-normal around 90 ms plus 350 ms/MB of
  reply, seeded by call key.
- **Sizes:** the scored hour is 5,774 points and 3.8 MB of OTLP/JSON. A
  500-point page is about 340 KB and a 2000-point page 1.33 MB.
  `responses.jsonl` (23 MB, 60 recordings, because each program's paging
  variant is recorded separately) is gitignored. `materialize.ts` regenerates
  it in about 3 s and checks its sha256 against `../manifest.json`. The bytes
  depend on V8's `Math.exp/log/cos`, so the generator is pinned to the repo's
  Node 24.

## Sizes per run

| Program                                                                                                 | Calls | Response bytes | Largest reply |
| ------------------------------------------------------------------------------------------------------- | ----- | -------------- | ------------- |
| 1 one scan, pages of 1000                                                                               | 6     | 3.8 MB         | 670 KB        |
| 2 `listServices`, then 10 parallel per-service scans of 500                                             | 18    | 3.8 MB         | 342 KB        |
| 3 every point into one array first, pages of 2000 (the max)                                             | 3     | 3.8 MB         | 1.33 MB       |
| 4 fetches more: 12:00–14:00 at the default 500, filters by `timeUnixNano` (BigInt), and logs a baseline | 23    | 7.6 MB         | 340 KB        |
| 5 per-service scans of 1000, 3 services at a time                                                       | 11    | 3.8 MB         | 460 KB        |

## What it stresses

Heap capacity and the payload codec. Every program must take in 3.8–7.6 MB
of JSON. Program 3 keeps all 5,774 decoded points live at once, and its
single replies (1.33 MB) are over most sandboxes' message limits. It also
stresses CPU on data (string-to-number parsing, bucket merging), and the
traps: string-encoded integers, seconds versus milliseconds, the (start, end]
window, and the overflow bucket.

## Oracle

`oracle.ts` collects every recorded point and deduplicates them, since the
programs' pages overlap. It filters the window with BigInt nanoseconds and
recomputes the quantile from cumulative counts. It checks order, requests
(exact), errorRate (±5e-5) and p95Ms (±0.05 ms), so rounding to 4 decimals
and 0.1 ms is allowed, and the breaching list exactly.
