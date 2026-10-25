declare namespace __schema_github {
type ListIssuesInput = {
    repo: string;
}
type ListIssuesOutput = {
    id: number;
}[]

const api: {
	/**
	 * listIssues
	 */
	listIssues: (input: ListIssuesInput) => Promise<ListIssuesOutput>;
}
}
declare const github: typeof __schema_github.api;

declare namespace __schema_gitlab {
type ListIssuesInput = {
    repo: string;
}
type ListIssuesOutput = {
    id: number;
}[]

const api: {
	/**
	 * listIssues
	 */
	listIssues: (input: ListIssuesInput) => Promise<ListIssuesOutput>;
}
}
declare const gitlab: typeof __schema_gitlab.api;
