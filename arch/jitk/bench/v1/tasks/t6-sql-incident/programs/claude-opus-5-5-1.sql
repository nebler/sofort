WITH windows AS (
  SELECT d.id, d.service, d.region, d.version, d.deployed_at,
         strftime('%Y-%m-%dT%H:%M:%SZ', d.deployed_at, '-60 minutes') AS before_start,
         strftime('%Y-%m-%dT%H:%M:%SZ', d.deployed_at, '+60 minutes') AS after_end
  FROM deploys d
  WHERE d.status = 'succeeded'
),
rates AS (
  SELECT w.*,
         (SELECT 1.0 * SUM(c.errors_5xx) / SUM(c.requests) FROM request_counters c
           WHERE c.service = w.service AND c.region = w.region
             AND c.ts >= w.before_start AND c.ts < w.deployed_at) AS error_rate_before,
         (SELECT 1.0 * SUM(c.errors_5xx) / SUM(c.requests) FROM request_counters c
           WHERE c.service = w.service AND c.region = w.region
             AND c.ts >= w.deployed_at AND c.ts < w.after_end) AS error_rate_after
  FROM windows w
)
SELECT r.service, r.region, r.version, r.deployed_at, o.team, r.error_rate_before, r.error_rate_after
FROM rates r
JOIN ownership o
  ON o.service = r.service
 AND o.valid_from <= r.deployed_at
 AND (o.valid_to IS NULL OR o.valid_to > r.deployed_at)
WHERE r.error_rate_after >= 3 * r.error_rate_before
  AND r.error_rate_after >= 0.01
ORDER BY r.deployed_at;
