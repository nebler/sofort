async () => {
  const start = '2026-10-30T13:00:00Z';
  const end = '2026-10-30T14:00:00Z';
  const perService = new Map(); // name -> { buckets, bounds, requests, errors }

  let pageToken;
  do {
    const page = await metrics.queryRange({
      metric: 'http.server.request.duration',
      startTime: start,
      endTime: end,
      pageSize: 1000,
      ...(pageToken ? { pageToken } : {}),
    });
    for (const rm of page.resourceMetrics) {
      const service = rm.resource.attributes.find(a => a.key === 'service.name').value.stringValue;
      let agg = perService.get(service);
      if (!agg) {
        agg = { buckets: null, bounds: null, requests: 0, errors: 0 };
        perService.set(service, agg);
      }
      for (const sm of rm.scopeMetrics) {
        for (const m of sm.metrics) {
          if (m.name !== 'http.server.request.duration') continue;
          for (const dp of m.histogram.dataPoints) {
            const count = Number(dp.count);
            const status = Number(dp.attributes.find(a => a.key === 'http.response.status_code')?.value.intValue ?? 0);
            agg.requests += count;
            if (status >= 500) agg.errors += count;
            if (!agg.buckets) {
              agg.buckets = dp.bucketCounts.map(() => 0);
              agg.bounds = dp.explicitBounds;
            }
            dp.bucketCounts.forEach((c, i) => (agg.buckets[i] += Number(c)));
          }
        }
      }
    }
    pageToken = page.nextPageToken;
  } while (pageToken);

  function quantile(q, bounds, buckets) {
    const total = buckets.reduce((a, b) => a + b, 0);
    const rank = q * total;
    let cum = 0;
    for (let i = 0; i < buckets.length; i++) {
      const prev = cum;
      cum += buckets[i];
      if (cum >= rank) {
        if (i === buckets.length - 1) return bounds[bounds.length - 1];
        const lower = i === 0 ? 0 : bounds[i - 1];
        const upper = bounds[i];
        return lower + (upper - lower) * ((rank - prev) / buckets[i]);
      }
    }
    return NaN;
  }

  const services = [...perService.entries()].map(([service, a]) => ({
    service,
    requests: a.requests,
    errorRate: a.requests ? a.errors / a.requests : 0,
    p95Ms: quantile(0.95, a.bounds, a.buckets) * 1000,
  }));
  services.sort((x, y) => y.p95Ms - x.p95Ms);

  return {
    window: { start, end },
    services,
    breaching: services.filter(s => s.p95Ms > 500 || s.errorRate > 0.01).map(s => s.service).sort(),
  };
}
