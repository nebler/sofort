declare namespace __schema_github {
type ListWorkflowRunsInput = {
    /** The account owner of the repository. The name is not case sensitive. */
    owner: string;
    /** The name of the repository without the .git extension. The name is not case sensitive. */
    repo: string;
    /** The ID of the workflow or its file name, e.g. main.yaml. */
    workflow_id: string;
    /** Returns workflow runs associated with a branch. */
    branch?: string;
    /** Returns workflow runs triggered by the event, e.g. push, pull_request. */
    event?: string;
    /** Returns workflow runs with the check run status or conclusion. */
    status?: "completed" | "action_required" | "cancelled" | "failure" | "neutral" | "skipped" | "stale" | "success" | "timed_out" | "in_progress" | "queued" | "requested" | "waiting" | "pending";
    /** The number of results per page (max 100). Default: 30 */
    per_page?: number;
    /** The page number of the results to fetch. Default: 1 */
    page?: number;
}
type ListWorkflowRunsOutput = unknown
type ListJobsForRunInput = {
    /** The account owner of the repository. The name is not case sensitive. */
    owner: string;
    /** The name of the repository without the .git extension. The name is not case sensitive. */
    repo: string;
    /** The unique identifier of the workflow run. */
    run_id: number;
    /** Filters jobs by their completed_at timestamp. latest returns jobs from the most recent execution of the workflow run. all returns all jobs for a workflow run, including from old executions of the workflow run. Default: latest */
    filter?: "latest" | "all";
    /** The number of results per page (max 100). Default: 30 */
    per_page?: number;
    /** The page number of the results to fetch. Default: 1 */
    page?: number;
}
type ListJobsForRunOutput = unknown
type GetJobLogsInput = {
    /** The account owner of the repository. The name is not case sensitive. */
    owner: string;
    /** The name of the repository without the .git extension. The name is not case sensitive. */
    repo: string;
    /** The unique identifier of the job. */
    job_id: number;
    /** Number of lines to return from the end of the log. Default: 500 */
    tail_lines?: number;
}
type GetJobLogsOutput = unknown

const api: {
	/**
	 * List runs of one workflow (GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs), newest first. Paginated with per_page and page. Returns: {total_count, workflow_runs: [...]} where each run is a GitHub workflow run object: id, name, run_number, event, status, conclusion, head_branch, head_sha, created_at, updated_at, run_started_at, html_url, jobs_url, logs_url, actor, head_commit, repository, and more.
	 * @param input.owner - The account owner of the repository. The name is not case sensitive.
	 * @param input.repo - The name of the repository without the .git extension. The name is not case sensitive.
	 * @param input.workflow_id - The ID of the workflow or its file name, e.g. main.yaml.
	 * @param input.branch - Returns workflow runs associated with a branch.
	 * @param input.event - Returns workflow runs triggered by the event, e.g. push, pull_request.
	 * @param input.status - Returns workflow runs with the check run status or conclusion.
	 * @param input.per_page - The number of results per page (max 100). Default: 30
	 * @param input.page - The page number of the results to fetch. Default: 1
	 */
	listWorkflowRuns: (input: ListWorkflowRunsInput) => Promise<ListWorkflowRunsOutput>;

	/**
	 * List jobs for a workflow run (GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs). Paginated with per_page and page. Returns: {total_count, jobs: [...]} where each job has id, run_id, name, status, conclusion, started_at, completed_at, steps [{name, status, conclusion, number}], labels, runner_name, html_url, and more.
	 * @param input.owner - The account owner of the repository. The name is not case sensitive.
	 * @param input.repo - The name of the repository without the .git extension. The name is not case sensitive.
	 * @param input.run_id - The unique identifier of the workflow run.
	 * @param input.filter - Filters jobs by their completed_at timestamp. latest returns jobs from the most recent execution of the workflow run. all returns all jobs for a workflow run, including from old executions of the workflow run. Default: latest
	 * @param input.per_page - The number of results per page (max 100). Default: 30
	 * @param input.page - The page number of the results to fetch. Default: 1
	 */
	listJobsForRun: (input: ListJobsForRunInput) => Promise<ListJobsForRunOutput>;

	/**
	 * Get the plain-text log of a workflow job (GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs), returning only the last tail_lines lines. Returns: {job_id, total_lines, returned_lines, content} where content is the last returned_lines lines of the log joined with \n; each line starts with an ISO timestamp.
	 * @param input.owner - The account owner of the repository. The name is not case sensitive.
	 * @param input.repo - The name of the repository without the .git extension. The name is not case sensitive.
	 * @param input.job_id - The unique identifier of the job.
	 * @param input.tail_lines - Number of lines to return from the end of the log. Default: 500
	 */
	getJobLogs: (input: GetJobLogsInput) => Promise<GetJobLogsOutput>;
}
}
declare const github: typeof __schema_github.api;
