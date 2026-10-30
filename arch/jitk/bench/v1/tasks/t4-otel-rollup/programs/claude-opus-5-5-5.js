async () => {
  const start = '2026-10-30T13:00:00Z';
  const end = '2026-10-30T14:00:00Z';
  const names = (await metrics.listServices({})).services.map(s => s.name);

  async function rollup(serviceName) {
    let merged;
    let bounds;
    let total = 0;
    let fivexx = 0;
    let pageToken;
    let pages = 0;
    do {
      const req = { metric: 'http.server.request.duration', startTime: start, endTime: end, serviceName, pageSize: 1000 };
      if (pageToken) req.pageToken = pageToken;
      const page = await metrics.queryRange(req);
      pages++;
      for (const { scopeMetrics } of page.resourceMetrics) {
        for (const { metrics: ms } of scopeMetrics) {
          for (const metric of ms) {
            for (const dp of metric.histogram.dataPoints) {
              const n = +dp.count;
              total += n;
              const status = dp.attributes.find(a => a.key === 'http.response.status_code');
              if (+status.value.intValue >= 500) fivexx += n;
              if (!merged) {
                bounds = dp.explicitBounds;
                merged = dp.bucketCounts.map(Number);
              } else {
                for (let i = 0; i < merged.length; i++) merged[i] += +dp.bucketCounts[i];
              }
            }
          }
        }
      }
      pageToken = page.nextPageToken;
    } while (pageToken && pages < 50);

    // Prometheus-style histogram_quantile.
    const rank = 0.95 * total;
    let below = 0;
    let p95s = bounds[bounds.length - 1];
    for (let b = 0; b < merged.length; b++) {
      if (below + merged[b] >= rank) {
        if (b < bounds.length) {
          const lower = b === 0 ? 0 : bounds[b - 1];
          p95s = lower + (bounds[b] - lower) * ((rank - below) / merged[b]);
        }
        break;
      }
      below += merged[b];
    }
    return { service: serviceName, requests: total, errorRate: fivexx / total, p95Ms: +(p95s * 1000).toFixed(3) };
  }

  // Three services at a time.
  const services = [];
  for (let i = 0; i < names.length; i += 3) {
    services.push(...(await Promise.all(names.slice(i, i + 3).map(rollup))));
  }
  services.sort((a, b) => b.p95Ms - a.p95Ms);
  return {
    window: { start, end },
    services,
    breaching: services
      .filter(s => s.p95Ms > 500 || s.errorRate > 0.01)
      .map(s => s.service)
      .sort(),
  };
}
