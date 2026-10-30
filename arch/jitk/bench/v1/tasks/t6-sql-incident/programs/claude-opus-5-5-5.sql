SELECT d.service,
       d.region,
       d.version,
       d.deployed_at,
       o.team,
       ROUND(1.0 * SUM(IIF(CAST(strftime('%s', c.ts) AS INTEGER) < CAST(strftime('%s', d.deployed_at) AS INTEGER), c.errors_5xx, 0))
             / SUM(IIF(CAST(strftime('%s', c.ts) AS INTEGER) < CAST(strftime('%s', d.deployed_at) AS INTEGER), c.requests, 0)), 6) AS error_rate_before,
       ROUND(1.0 * SUM(IIF(CAST(strftime('%s', c.ts) AS INTEGER) >= CAST(strftime('%s', d.deployed_at) AS INTEGER), c.errors_5xx, 0))
             / SUM(IIF(CAST(strftime('%s', c.ts) AS INTEGER) >= CAST(strftime('%s', d.deployed_at) AS INTEGER), c.requests, 0)), 6) AS error_rate_after
FROM deploys AS d
JOIN request_counters AS c
  ON c.service = d.service
 AND c.region = d.region
 AND CAST(strftime('%s', c.ts) AS INTEGER) BETWEEN CAST(strftime('%s', d.deployed_at) AS INTEGER) - 3600
                                               AND CAST(strftime('%s', d.deployed_at) AS INTEGER) + 3599
JOIN ownership AS o
  ON o.service = d.service
 AND o.valid_from <= d.deployed_at
 AND (o.valid_to > d.deployed_at OR o.valid_to IS NULL)
WHERE d.status = 'succeeded'
GROUP BY d.id
HAVING error_rate_after >= 0.01 AND error_rate_after >= 3 * error_rate_before
ORDER BY d.deployed_at;
