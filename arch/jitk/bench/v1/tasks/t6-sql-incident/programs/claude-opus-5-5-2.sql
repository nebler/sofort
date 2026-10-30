SELECT
  d.service,
  d.region,
  d.version,
  d.deployed_at,
  (SELECT o.team FROM ownership o
    WHERE o.service = d.service
      AND o.valid_from <= d.deployed_at
      AND (o.valid_to IS NULL OR o.valid_to > d.deployed_at)
    ORDER BY o.valid_from DESC LIMIT 1) AS team,
  b.rate AS error_rate_before,
  a.rate AS error_rate_after
FROM deploys d
JOIN (
  SELECT d2.id, CAST(SUM(c.errors_5xx) AS REAL) / SUM(c.requests) AS rate
  FROM deploys d2
  JOIN request_counters c
    ON c.service = d2.service AND c.region = d2.region
   AND c.ts >= strftime('%Y-%m-%dT%H:%M:%SZ', datetime(d2.deployed_at, '-1 hour'))
   AND c.ts < d2.deployed_at
  GROUP BY d2.id
) b ON b.id = d.id
JOIN (
  SELECT d3.id, CAST(SUM(c.errors_5xx) AS REAL) / SUM(c.requests) AS rate
  FROM deploys d3
  JOIN request_counters c
    ON c.service = d3.service AND c.region = d3.region
   AND c.ts >= d3.deployed_at
   AND c.ts < strftime('%Y-%m-%dT%H:%M:%SZ', datetime(d3.deployed_at, '+1 hour'))
  GROUP BY d3.id
) a ON a.id = d.id
WHERE d.status = 'succeeded'
  AND a.rate >= 0.01
  AND a.rate >= 3 * b.rate
ORDER BY d.deployed_at;
