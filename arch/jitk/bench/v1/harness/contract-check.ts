// Typecheck only (bench/v1/tsconfig.json): contract.ts's structural copies of
// @cloudflare/codemode's executor types are the package's, both directions.
import type * as codemode from '@cloudflare/codemode';
import type * as contract from './contract.ts';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
export const executor: Same<codemode.Executor, contract.Executor> = true;
export const provider: Same<codemode.ResolvedProvider, contract.ResolvedProvider> = true;
export const result: Same<codemode.ExecuteResult, contract.ExecuteResult> = true;
// A BenchExecutor is usable wherever codemode wants an Executor.
export const usable: contract.BenchExecutor extends codemode.Executor ? true : false = true;
