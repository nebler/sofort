declare namespace __schema_openapi {
type SearchInput = {
    /** Search words, e.g. 'list repository webhooks'. */
    query: string;
    /** Maximum number of results. Default: 10 */
    limit?: number;
}
type SearchOutput = unknown
type ListOperationsInput = {
    /** Only operations with this tag, e.g. repos. */
    tag?: string;
}
type ListOperationsOutput = unknown
type GetOperationInput = {
    /** The operationId, e.g. repos/get. */
    operationId: string;
}
type GetOperationOutput = unknown

const api: {
	/**
	 * Keyword search over the operations of the GitHub REST API OpenAPI description (1254 operations). Ranks by matches in summary, operationId, path, tags and description. Returns: {query, total, results: [{operationId, method, path, summary, description, tags, score, parameters: [{name, in, required, description, schema}], responses: {status: description}, documentationUrl}]}
	 * @param input.query - Search words, e.g. 'list repository webhooks'.
	 * @param input.limit - Maximum number of results. Default: 10
	 */
	search: (input: SearchInput) => Promise<SearchOutput>;

	/**
	 * List every operation (operationId, method, path, summary, tags), optionally only those with a tag. Returns: {total, operations: [{operationId, method, path, summary, tags}]}
	 * @param input.tag - Only operations with this tag, e.g. repos.
	 */
	listOperations: (input: ListOperationsInput) => Promise<ListOperationsOutput>;

	/**
	 * Get one operation from the spec with all $refs resolved: parameters, requestBody and response schemas. Returns: {operationId, method, path, summary, description, tags, parameters, requestBody?, responses: {status: {description, content}}, ...}
	 * @param input.operationId - The operationId, e.g. repos/get.
	 */
	getOperation: (input: GetOperationInput) => Promise<GetOperationOutput>;
}
}
declare const openapi: typeof __schema_openapi.api;

declare namespace __schema_github {
type RequestInput = {
    /** HTTP method. */
    method: "GET";
    /** Path with parameters filled in, e.g. /repos/octocat/hello-world. */
    path: string;
    /** Query string parameters. */
    query?: {
        [key: string]: string | number | boolean;
    };
}
type RequestOutput = unknown

const api: {
	/**
	 * Execute a read-only request against the GitHub REST API (https://api.github.com). Only GET is allowed. Path parameters must already be filled in. Returns: {status, body} where body is the parsed JSON response.
	 * @param input.method - HTTP method.
	 * @param input.path - Path with parameters filled in, e.g. /repos/octocat/hello-world.
	 * @param input.query - Query string parameters.
	 */
	request: (input: RequestInput) => Promise<RequestOutput>;
}
}
declare const github: typeof __schema_github.api;
