// Types for policy.mjs (owner 07). The host executor (04) calls, per guest `call` frame:
//   decide(run, frame) -> Decision | throws Violation (=> SIGKILL VM, fail run)
//   'approve' -> host approval UI -> approve(run, digest) (single use) -> dispatch(...)
//   'allow'   -> dispatch(run, decision.call, {issuer, signal}) -> value sent as {t:'ret',id,ok}
//   'deny'    -> {t:'ret',id,err:{code:'DENIED',...}}
export declare class Violation extends Error {}
export declare class ToolError extends Error {} // the only tool failure text the guest sees
export declare class Denial extends Error {} // guest sees DENIED; counted against limits.denials
/** Count one more denial for the run (throws Violation past the budget) and return the refusal. */
export declare function denial(run: Run, reason: string): Denial;
export declare class LineReader {
  constructor(cap?: number); len: number;
  push(chunk: Uint8Array, onLine: (line: string) => void): void; // throws Violation past cap
}
export type Effects = {
  reads: 'none' | 'public' | 'private'; // what the tool returns into the run
  egress: boolean;   // can move data outside the tenant boundary
  writes: boolean;   // state-changing side effect
  endorsable?: boolean; // a human may approve it after taint
  approval?: 'always';
};
export type Tool<A = any, R = any> = Effects & {
  args: (args: unknown) => A;        // strict validator; throw => deny('schema')
  timeoutMs: number;
  invoke: (args: A, credential: unknown, ctx: { signal: AbortSignal; idempotencyKey: string }) => Promise<R>;
  output: (raw: R) => unknown;       // output schema + redaction; throw => error
  error?: (thrown: unknown) => string; // failure text for the guest; default '<ns>.<fn> failed'
};
export type Tools = Record<string, Record<string, Tool>>;
export type Limits = { calls?: number; outstanding?: number; denials?: number };
export declare const DEFAULT_LIMITS: Readonly<Required<Limits>>;
export type Run = {
  readonly id: string; tools: Tools; deadline: number; now: () => number;
  nextId: number; outstanding: number; calls: number; denials: number; dead: boolean;
  tainted: { privateRead: boolean; untrusted: boolean };
  approvals: Map<string, Call>; limits: Required<Limits>;
};
export type CallFrame = { t: 'call'; id: number; ns: string; fn: string; args: unknown };
export type Call = { run: string; id: number; ns: string; fn: string; args: unknown };
export type Decision =
  | { kind: 'allow'; call: Call }
  | { kind: 'deny'; reason: string }
  | { kind: 'approve'; digest: string; call: Call };
export type Issuer = {
  issue(req: { run: string; scope: string; ttlMs: number }): Promise<unknown>;
  revoke(credential: unknown): Promise<void>;
};
export declare function digest(v: unknown): string;
export declare function createRun(o: { tools: Tools; deadline: number; now?: () => number; limits?: Limits;
  /** Labels carried in from earlier runs of the same conversation. */
  tainted?: { privateRead?: boolean; untrusted?: boolean } }): Run;
export declare function decide(run: Run, frame: CallFrame): Decision;
export declare function approve(run: Run, digest: string): Call | null;
export declare function dispatch(run: Run, call: Call, o: { issuer: Issuer; signal?: AbortSignal }): Promise<unknown>;
