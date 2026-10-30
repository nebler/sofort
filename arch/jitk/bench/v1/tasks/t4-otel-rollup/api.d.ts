declare namespace __schema_metrics {
type ListServicesInput = Record<string, unknown>
type ListServicesOutput = unknown
type QueryRangeInput = {
    /** Metric name, e.g. http.server.request.duration */
    metric: string;
    /** Range start, RFC 3339 (exclusive). */
    startTime: string;
    /** Range end, RFC 3339 (inclusive). */
    endTime: string;
    /** Only data from this service.name. */
    serviceName?: string;
    /** Data points per page, 1-2000. Default: 500 */
    pageSize?: number;
    /** nextPageToken from the previous page. */
    pageToken?: string;
}
type QueryRangeOutput = unknown

const api: {
	/**
	 * List the services that report metrics, with their instances. Returns: {services: [{name, region, instances: [service.instance.id, ...]}]}
	 */
	listServices: (input: ListServicesInput) => Promise<ListServicesOutput>;

	/**
	 * Read raw metric data points in OTLP/JSON for a time range, paginated. Returns the data points whose interval end (timeUnixNano) is after startTime and at or before endTime, ordered by time. Pass nextPageToken back as pageToken to get the next page; it is absent on the last page. Returns: {resourceMetrics: [{resource: {attributes: [{key, value: {stringValue|intValue}}]}, scopeMetrics: [{scope, metrics: [{name, unit, histogram: {aggregationTemporality, dataPoints: [{attributes, startTimeUnixNano, timeUnixNano, count, sum, bucketCounts, explicitBounds, min, max}]}}]}]}], nextPageToken?}. As in OTLP/JSON, 64-bit integers (count, bucketCounts, timeUnixNano, intValue) are strings; the unit of sum, min, max and explicitBounds is seconds; bucketCounts has one more entry than explicitBounds (the last bucket is the overflow).
	 * @param input.metric - Metric name, e.g. http.server.request.duration
	 * @param input.startTime - Range start, RFC 3339 (exclusive).
	 * @param input.endTime - Range end, RFC 3339 (inclusive).
	 * @param input.serviceName - Only data from this service.name.
	 * @param input.pageSize - Data points per page, 1-2000. Default: 500
	 * @param input.pageToken - nextPageToken from the previous page.
	 */
	queryRange: (input: QueryRangeInput) => Promise<QueryRangeOutput>;
}
}
declare const metrics: typeof __schema_metrics.api;
