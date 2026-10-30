-- Compare as julian days so the ISO 'T'/'Z' format does not matter.
WITH per_deploy AS (
  SELECT
    d.id,
    d.service,
    d.region,
    d.version,
    d.deployed_at,
    SUM(CASE WHEN julianday(c.ts) < julianday(d.deployed_at) THEN c.errors_5xx ELSE 0 END) AS err_before,
    SUM(CASE WHEN julianday(c.ts) < julianday(d.deployed_at) THEN c.requests ELSE 0 END) AS req_before,
    SUM(CASE WHEN julianday(c.ts) >= julianday(d.deployed_at) THEN c.errors_5xx ELSE 0 END) AS err_after,
    SUM(CASE WHEN julianday(c.ts) >= julianday(d.deployed_at) THEN c.requests ELSE 0 END) AS req_after
  FROM deploys d
  JOIN request_counters c
    ON c.service = d.service
   AND c.region = d.region
   AND julianday(c.ts) >= julianday(d.deployed_at) - 1.0 / 24
   AND julianday(c.ts) < julianday(d.deployed_at) + 1.0 / 24
  WHERE d.status = 'succeeded'
  GROUP BY d.id
)
SELECT
  p.service,
  p.region,
  p.version,
  p.deployed_at,
  o.team,
  1.0 * p.err_before / p.req_before AS error_rate_before,
  1.0 * p.err_after / p.req_after AS error_rate_after
FROM per_deploy p
JOIN ownership o
  ON o.service = p.service
 AND julianday(o.valid_from) <= julianday(p.deployed_at)
 AND (o.valid_to IS NULL OR julianday(o.valid_to) > julianday(p.deployed_at))
WHERE 1.0 * p.err_after / p.req_after >= 0.01
  AND 1.0 * p.err_after / p.req_after >= 3.0 * p.err_before / p.req_before
ORDER BY p.deployed_at;
