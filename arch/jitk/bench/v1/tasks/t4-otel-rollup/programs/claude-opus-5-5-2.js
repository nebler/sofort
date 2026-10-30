async () => {
  const window = { start: '2026-10-30T13:00:00Z', end: '2026-10-30T14:00:00Z' };
  const { services: catalog } = await metrics.listServices({});

  const histogramQuantile = (q, bounds, counts) => {
    const total = counts.reduce((s, c) => s + c, 0);
    if (total === 0) return null;
    const rank = q * total;
    let cumulative = 0;
    for (let i = 0; i < counts.length; i++) {
      if (cumulative + counts[i] >= rank) {
        if (i >= bounds.length) return bounds[bounds.length - 1];
        const lo = i === 0 ? 0 : bounds[i - 1];
        return lo + (bounds[i] - lo) * ((rank - cumulative) / counts[i]);
      }
      cumulative += counts[i];
    }
    return bounds[bounds.length - 1];
  };

  // One paginated scan per service, all services in parallel.
  const rows = await Promise.all(
    catalog.map(async ({ name }) => {
      let counts = null;
      let bounds = null;
      let requests = 0;
      let errors = 0;
      let token;
      while (true) {
        const res = await metrics.queryRange({
          metric: 'http.server.request.duration',
          startTime: window.start,
          endTime: window.end,
          serviceName: name,
          pageSize: 500,
          pageToken: token,
        });
        for (const rm of res.resourceMetrics) {
          for (const sm of rm.scopeMetrics) {
            for (const metric of sm.metrics) {
              for (const p of metric.histogram?.dataPoints ?? []) {
                const n = parseInt(p.count, 10);
                requests += n;
                const code = p.attributes.find(a => a.key === 'http.response.status_code');
                if (code && parseInt(code.value.intValue, 10) >= 500) errors += n;
                bounds ??= p.explicitBounds;
                counts ??= new Array(p.bucketCounts.length).fill(0);
                for (let i = 0; i < p.bucketCounts.length; i++) counts[i] += parseInt(p.bucketCounts[i], 10);
              }
            }
          }
        }
        if (!res.nextPageToken) break;
        token = res.nextPageToken;
      }
      return {
        service: name,
        requests,
        errorRate: requests ? errors / requests : 0,
        p95Ms: histogramQuantile(0.95, bounds, counts) * 1000,
      };
    })
  );

  rows.sort((a, b) => b.p95Ms - a.p95Ms);
  const breaching = rows
    .filter(r => r.p95Ms > 500 || r.errorRate > 0.01)
    .map(r => r.service)
    .sort((a, b) => a.localeCompare(b));
  return { window, services: rows, breaching };
}
