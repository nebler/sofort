-- Build the full per-bucket series around every deploy (including failed ones,
-- for context), then aggregate and filter at the end.
WITH series AS (
  SELECT
    d.id AS deploy_id,
    d.service,
    d.region,
    d.version,
    d.deployed_at,
    d.status,
    c.ts,
    c.requests,
    c.errors_5xx,
    c.p50_ms,
    c.p99_ms,
    CASE WHEN c.ts < d.deployed_at THEN 'before' ELSE 'after' END AS phase,
    ROW_NUMBER() OVER (PARTITION BY d.id ORDER BY c.ts) AS bucket_no
  FROM deploys d
  JOIN request_counters c
    ON c.service = d.service
   AND c.region = d.region
   AND c.ts >= strftime('%Y-%m-%dT%H:%M:%SZ', d.deployed_at, '-60 minutes')
   AND c.ts < strftime('%Y-%m-%dT%H:%M:%SZ', d.deployed_at, '+60 minutes')
),
agg AS (
  SELECT
    deploy_id, service, region, version, deployed_at, status,
    SUM(CASE WHEN phase = 'before' THEN errors_5xx END) * 1.0 / SUM(CASE WHEN phase = 'before' THEN requests END) AS error_rate_before,
    SUM(CASE WHEN phase = 'after' THEN errors_5xx END) * 1.0 / SUM(CASE WHEN phase = 'after' THEN requests END) AS error_rate_after,
    AVG(CASE WHEN phase = 'before' THEN p99_ms END) AS p99_before,
    AVG(CASE WHEN phase = 'after' THEN p99_ms END) AS p99_after,
    COUNT(*) AS buckets
  FROM series
  GROUP BY deploy_id
)
SELECT a.service, a.region, a.version, a.deployed_at, o.team, a.error_rate_before, a.error_rate_after
FROM agg a
LEFT JOIN ownership o
  ON o.service = a.service
 AND o.valid_from <= a.deployed_at
 AND COALESCE(o.valid_to, '9999-12-31T00:00:00Z') > a.deployed_at
WHERE a.status = 'succeeded'
  AND a.error_rate_after >= 0.01
  AND a.error_rate_after >= 3 * a.error_rate_before
ORDER BY a.deployed_at;
