import type {Backend, Session} from '../../executor/backend.ts';

export type BaselineBackend = Omit<Backend,'kind'> & {readonly kind:'hyperlight-js'};
// Share the executor's process lifecycle, canonical dispatcher and independent
// per-run watchdog. Load its built backend at runtime to support raw TS tests
// and the bundled executor without a second implementation or import cycle.
export class HyperlightBackend implements BaselineBackend {
  readonly kind = 'hyperlight-js' as const;
  readonly isolation = 'strict-single-use' as const;
  readonly memoryLimitMB = 16;
  constructor(readonly worker:string, readonly snapshot:string,
    readonly watchdogMs=5000) {}
  async park(signal?:AbortSignal):Promise<Session> {
    if(signal?.aborted)throw Error('aborted');
    const {ProcessBackend}=await import(new URL('../../executor/build/backend.js',import.meta.url).href);
    return new ProcessBackend(this.kind,this.worker,['strict',this.snapshot],this.memoryLimitMB,
      {lifetimeMs:this.watchdogMs,startupMs:this.watchdogMs}).park(signal);
  }
}
