async () => {
  const startTime = '2026-10-30T13:00:00Z';
  const endTime = '2026-10-30T14:00:00Z';

  // Pull every data point first (biggest pages allowed), then aggregate.
  const points = [];
  let pageToken = undefined;
  for (;;) {
    const args = { metric: 'http.server.request.duration', startTime, endTime, pageSize: 2000 };
    if (pageToken) args.pageToken = pageToken;
    const page = await metrics.queryRange(args);
    for (const rm of page.resourceMetrics) {
      const attrs = Object.fromEntries(rm.resource.attributes.map(a => [a.key, a.value.stringValue ?? a.value.intValue]));
      for (const sm of rm.scopeMetrics) {
        for (const metric of sm.metrics) {
          for (const dp of metric.histogram.dataPoints) {
            const dpAttrs = Object.fromEntries(dp.attributes.map(a => [a.key, a.value.stringValue ?? a.value.intValue]));
            points.push({
              service: attrs['service.name'],
              instance: attrs['service.instance.id'],
              route: dpAttrs['http.route'],
              status: Number(dpAttrs['http.response.status_code']),
              count: Number(dp.count),
              buckets: dp.bucketCounts.map(Number),
              bounds: dp.explicitBounds,
            });
          }
        }
      }
    }
    if (!page.nextPageToken) break;
    pageToken = page.nextPageToken;
  }

  const groups = {};
  for (const p of points) (groups[p.service] ||= []).push(p);

  const services = Object.entries(groups).map(([service, list]) => {
    const bounds = list[0].bounds;
    const merged = new Array(bounds.length + 1).fill(0);
    let requests = 0;
    let errors = 0;
    for (const p of list) {
      requests += p.count;
      if (p.status >= 500) errors += p.count;
      p.buckets.forEach((c, i) => {
        merged[i] += c;
      });
    }
    const rank = 0.95 * requests;
    let cum = 0;
    let p95 = bounds[bounds.length - 1];
    for (let i = 0; i < merged.length; i++) {
      if (cum + merged[i] >= rank) {
        if (i < bounds.length) {
          const lower = i === 0 ? 0 : bounds[i - 1];
          p95 = lower + (bounds[i] - lower) * (rank - cum) / merged[i];
        }
        break;
      }
      cum += merged[i];
    }
    return { service, requests, errorRate: errors / requests, p95Ms: Math.round(p95 * 1000 * 10) / 10 };
  });

  services.sort((a, b) => b.p95Ms - a.p95Ms);
  return {
    window: { start: startTime, end: endTime },
    services: services.map(s => ({ ...s, errorRate: Math.round(s.errorRate * 10000) / 10000 })),
    breaching: services.filter(s => s.p95Ms > 500 || s.errorRate > 0.01).map(s => s.service).sort(),
  };
}
