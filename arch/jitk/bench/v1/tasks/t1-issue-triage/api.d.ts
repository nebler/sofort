declare namespace __schema_github {
type ListIssuesInput = {
    /** The account owner of the repository. */
    owner: string;
    /** The name of the repository without the .git extension. */
    repo: string;
    /** Indicates the state of the issues to return. Default: open */
    state?: "open" | "closed" | "all";
    /** A list of comma separated label names. Example: bug,ui,@high */
    labels?: string;
    /** What to sort results by. Default: created */
    sort?: "created" | "updated" | "comments";
    /** The direction to sort the results by. Default: desc */
    direction?: "asc" | "desc";
    /** Only show results that were last updated after the given time (ISO 8601: YYYY-MM-DDTHH:MM:SSZ). */
    since?: string;
    /** The number of results per page (max 100). Default: 30 */
    per_page?: number;
    /** The page number of the results to fetch. Default: 1 */
    page?: number;
}
type ListIssuesOutput = unknown
type GetIssueInput = {
    /** The account owner of the repository. */
    owner: string;
    /** The name of the repository without the .git extension. */
    repo: string;
    /** The number that identifies the issue. */
    issue_number: number;
}
type GetIssueOutput = unknown
type ListIssueCommentsInput = {
    /** The account owner of the repository. */
    owner: string;
    /** The name of the repository without the .git extension. */
    repo: string;
    /** The number that identifies the issue. */
    issue_number: number;
    /** Only show results that were last updated after the given time (ISO 8601). */
    since?: string;
    /** The number of results per page (max 100). Default: 30 */
    per_page?: number;
    /** The page number of the results to fetch. Default: 1 */
    page?: number;
}
type ListIssueCommentsOutput = unknown

const api: {
	/**
	 * List issues in a repository (GET /repos/{owner}/{repo}/issues). Pull requests are also returned; they have a `pull_request` key. Results are paginated with per_page and page; a page shorter than per_page is the last one. Returns: Array of GitHub issue objects as the REST API returns them: number, title, state, user {login, ...}, labels [{name, ...}], comments (count), created_at, updated_at, closed_at, body, reactions, pull_request (only on pull requests), and more.
	 * @param input.owner - The account owner of the repository.
	 * @param input.repo - The name of the repository without the .git extension.
	 * @param input.state - Indicates the state of the issues to return. Default: open
	 * @param input.labels - A list of comma separated label names. Example: bug,ui,@high
	 * @param input.sort - What to sort results by. Default: created
	 * @param input.direction - The direction to sort the results by. Default: desc
	 * @param input.since - Only show results that were last updated after the given time (ISO 8601: YYYY-MM-DDTHH:MM:SSZ).
	 * @param input.per_page - The number of results per page (max 100). Default: 30
	 * @param input.page - The page number of the results to fetch. Default: 1
	 */
	listIssues: (input: ListIssuesInput) => Promise<ListIssuesOutput>;

	/**
	 * Get one issue (GET /repos/{owner}/{repo}/issues/{issue_number}). Returns: One GitHub issue object (same shape as an element of listIssues).
	 * @param input.owner - The account owner of the repository.
	 * @param input.repo - The name of the repository without the .git extension.
	 * @param input.issue_number - The number that identifies the issue.
	 */
	getIssue: (input: GetIssueInput) => Promise<GetIssueOutput>;

	/**
	 * List comments on an issue (GET /repos/{owner}/{repo}/issues/{issue_number}/comments), oldest first. Paginated with per_page and page. Returns: Array of issue comment objects: id, user {login, ...}, created_at, updated_at, body, author_association, reactions, html_url, and more.
	 * @param input.owner - The account owner of the repository.
	 * @param input.repo - The name of the repository without the .git extension.
	 * @param input.issue_number - The number that identifies the issue.
	 * @param input.since - Only show results that were last updated after the given time (ISO 8601).
	 * @param input.per_page - The number of results per page (max 100). Default: 30
	 * @param input.page - The page number of the results to fetch. Default: 1
	 */
	listIssueComments: (input: ListIssueCommentsInput) => Promise<ListIssueCommentsOutput>;
}
}
declare const github: typeof __schema_github.api;
