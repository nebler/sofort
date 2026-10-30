import type {Executor, ResolvedProvider} from '@cloudflare/codemode';
export type {Executor, ResolvedProvider};
export type Providers = Parameters<Executor['execute']>[1];
export interface Result {result: unknown; logs: string[]; error?: string}
export interface OpenOptions {concurrency: number; memoryClass?: string; timeoutMs?: number}
export interface Adapter {
  name: string;
  isolation: 'microvm'|'v8-isolate'|'wasm'|'process'|'none'|'hosted-microvm';
  where: 'local'|'hosted';
  open(opts: OpenOptions): Promise<Executor & {close(): Promise<void>}>;
  provenance(): Record<string, string>;
}
