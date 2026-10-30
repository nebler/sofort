CREATE TABLE services (
  name TEXT PRIMARY KEY,
  tier TEXT NOT NULL
);
CREATE TABLE ownership (
  service TEXT NOT NULL REFERENCES services(name),
  team TEXT NOT NULL,
  oncall_channel TEXT NOT NULL,
  valid_from TEXT NOT NULL,          -- ISO-8601 UTC, e.g. 2026-10-29T17:00:00Z
  valid_to TEXT                      -- NULL while current
);
CREATE TABLE deploys (
  id INTEGER PRIMARY KEY,
  service TEXT NOT NULL REFERENCES services(name),
  region TEXT NOT NULL,
  version TEXT NOT NULL,
  deployed_at TEXT NOT NULL,         -- ISO-8601 UTC
  deployed_by TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('succeeded', 'failed'))
);
CREATE TABLE request_counters (
  ts TEXT NOT NULL,                  -- start of the 5-minute bucket, ISO-8601 UTC
  service TEXT NOT NULL REFERENCES services(name),
  region TEXT NOT NULL,
  requests INTEGER NOT NULL,
  errors_5xx INTEGER NOT NULL,
  p50_ms REAL NOT NULL,
  p99_ms REAL NOT NULL,
  PRIMARY KEY (service, region, ts)
) WITHOUT ROWID;
CREATE INDEX deploys_by_time ON deploys (deployed_at);
