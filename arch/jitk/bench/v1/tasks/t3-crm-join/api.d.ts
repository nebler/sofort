declare namespace __schema_drive {
type SearchFilesInput = {
    /** Words that must all appear in the file name (case-insensitive). */
    query: string;
    /** Maximum number of files to return. Default: 100 */
    pageSize?: number;
}
type SearchFilesOutput = unknown
type GetDocumentInput = {
    /** The ID of the file. */
    fileId: string;
}
type GetDocumentOutput = unknown

const api: {
	/**
	 * Search Google Drive files by name (files.list with name contains each word), newest first. Returns: {kind, incompleteSearch, files: [{id, name, mimeType, modifiedTime, owners: [{displayName, emailAddress}], size}]}
	 * @param input.query - Words that must all appear in the file name (case-insensitive).
	 * @param input.pageSize - Maximum number of files to return. Default: 100
	 */
	searchFiles: (input: SearchFilesInput) => Promise<SearchFilesOutput>;

	/**
	 * Get a Google Docs document exported as plain text. Returns: {id, name, mimeType, modifiedTime, content} where content is the full document text.
	 * @param input.fileId - The ID of the file.
	 */
	getDocument: (input: GetDocumentInput) => Promise<GetDocumentOutput>;
}
}
declare const drive: typeof __schema_drive.api;

declare namespace __schema_salesforce {
type QueryInput = {
    /** The SOQL query, e.g. SELECT Id, Name FROM Account WHERE Name = 'Acme' */
    q: string;
}
type QueryOutput = unknown
type GetRecordInput = {
    /** The sObject type, e.g. Account. */
    sobject: string;
    /** The 18-character record Id. */
    id: string;
    /** Fields to return. Default: all fields. */
    fields?: string[];
}
type GetRecordOutput = unknown
type CreateRecordInput = {
    /** The sObject type. */
    sobject: string;
    /** Field values of the new record. */
    record: {
        [key: string]: unknown;
    };
}
type CreateRecordOutput = unknown
type UpdateRecordInput = {
    /** The sObject type. */
    sobject: string;
    /** The 18-character record Id. */
    id: string;
    /** Field values to set. */
    record: {
        [key: string]: unknown;
    };
}
type UpdateRecordOutput = unknown

const api: {
	/**
	 * Run a SOQL query (GET /services/data/v62.0/query?q=...). String literals use single quotes; escape a quote inside a literal as \'. Returns: {totalSize, done, records: [{attributes: {type, url}, Id, ...selected fields}]}. Objects: Account (Id, Name, Industry, Type, BillingCountry, AnnualRevenue, NumberOfEmployees, OwnerId), User (Id, Name, Email, IsActive, Title, Department), Opportunity (Id, Name, AccountId, StageName, IsClosed, IsWon, Amount, CloseDate, Probability, NextStep, OwnerId).
	 * @param input.q - The SOQL query, e.g. SELECT Id, Name FROM Account WHERE Name = 'Acme'
	 */
	query: (input: QueryInput) => Promise<QueryOutput>;

	/**
	 * Retrieve one record (GET /services/data/v62.0/sobjects/{sobject}/{id}). Returns: {attributes: {type, url}, Id, ...fields}
	 * @param input.sobject - The sObject type, e.g. Account.
	 * @param input.id - The 18-character record Id.
	 * @param input.fields - Fields to return. Default: all fields.
	 */
	getRecord: (input: GetRecordInput) => Promise<GetRecordOutput>;

	/**
	 * Create a record (POST /services/data/v62.0/sobjects/{sobject}). Supported: Task, Event, Meeting_Note__c (Name, Meeting_Date__c, Transcript__c long text up to 131072 characters). Returns: {id, success, errors} on success. Failures reject with a Salesforce error list [{message, errorCode}].
	 * @param input.sobject - The sObject type.
	 * @param input.record - Field values of the new record.
	 */
	createRecord: (input: CreateRecordInput) => Promise<CreateRecordOutput>;

	/**
	 * Update fields of a record (PATCH /services/data/v62.0/sobjects/{sobject}/{id}). Returns: {id, success, errors}
	 * @param input.sobject - The sObject type.
	 * @param input.id - The 18-character record Id.
	 * @param input.record - Field values to set.
	 */
	updateRecord: (input: UpdateRecordInput) => Promise<UpdateRecordOutput>;
}
}
declare const salesforce: typeof __schema_salesforce.api;
