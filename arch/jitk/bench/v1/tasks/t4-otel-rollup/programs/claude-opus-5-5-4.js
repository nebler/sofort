async () => {
  const HOUR_START = '2026-10-30T13:00:00Z';
  const HOUR_END = '2026-10-30T14:00:00Z';
  // Fetch a wider window (the preceding hour too) so we can compare against the baseline,
  // then keep only the scored hour for the answer.
  const startNs = BigInt(Date.parse(HOUR_START)) * 1000000n;
  const endNs = BigInt(Date.parse(HOUR_END)) * 1000000n;

  const agg = {};
  const baseline = {};
  let token = null;
  do {
    const res = await metrics.queryRange({
      metric: 'http.server.request.duration',
      startTime: '2026-10-30T12:00:00Z',
      endTime: HOUR_END,
      ...(token ? { pageToken: token } : {}),
    });
    for (const rm of res.resourceMetrics) {
      const svc = rm.resource.attributes.find(a => a.key === 'service.name').value.stringValue;
      for (const sm of rm.scopeMetrics) {
        for (const m of sm.metrics) {
          if (m.name !== 'http.server.request.duration' || !m.histogram) continue;
          for (const dp of m.histogram.dataPoints) {
            const t = BigInt(dp.timeUnixNano);
            const target = t > startNs && t <= endNs ? agg : baseline;
            const a = (target[svc] ??= { requests: 0, errors: 0, buckets: [], bounds: dp.explicitBounds });
            const n = Number(dp.count);
            a.requests += n;
            const code = Number(dp.attributes.find(x => x.key === 'http.response.status_code')?.value?.intValue);
            if (code >= 500) a.errors += n;
            dp.bucketCounts.forEach((c, i) => {
              a.buckets[i] = (a.buckets[i] ?? 0) + Number(c);
            });
          }
        }
      }
    }
    token = res.nextPageToken ?? null;
  } while (token);

  const p = (q, { bounds, buckets, requests }) => {
    const rank = q * requests;
    let seen = 0;
    for (let i = 0; i < buckets.length; i++) {
      if (seen + buckets[i] >= rank) {
        if (i === bounds.length) return bounds[bounds.length - 1] * 1000;
        const lo = i ? bounds[i - 1] : 0;
        return (lo + ((bounds[i] - lo) * (rank - seen)) / buckets[i]) * 1000;
      }
      seen += buckets[i];
    }
    return bounds[bounds.length - 1] * 1000;
  };

  const services = Object.keys(agg)
    .map(service => ({
      service,
      requests: agg[service].requests,
      errorRate: agg[service].errors / agg[service].requests,
      p95Ms: p(0.95, agg[service]),
      // Baseline numbers are only used for logging.
      baselineP95Ms: baseline[service] ? p(0.95, baseline[service]) : null,
    }))
    .sort((a, b) => b.p95Ms - a.p95Ms);
  for (const s of services) console.log(s.service, 'p95', s.p95Ms.toFixed(1), 'baseline', s.baselineP95Ms?.toFixed(1));

  return {
    window: { start: HOUR_START, end: HOUR_END },
    services: services.map(({ baselineP95Ms, ...rest }) => rest),
    breaching: services.filter(s => s.p95Ms > 500 || s.errorRate > 0.01).map(s => s.service).sort(),
  };
}
