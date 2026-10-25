// pool.ts
function recommendedWarmCount(lambda, refillP99Seconds, burst, cap) {
  if ([lambda, refillP99Seconds, burst, cap].some((x) => !Number.isFinite(x) || x < 0)) throw Error("invalid sizing inputs");
  return Math.min(Math.ceil(lambda * refillP99Seconds) + Math.ceil(burst), Math.floor(cap));
}
var SandboxPool = class {
  constructor(backend, warmCount, maxLive, options = {}) {
    this.backend = backend;
    this.warmCount = warmCount;
    this.maxLive = maxLive;
    this.options = options;
    if (!Number.isInteger(warmCount) || !Number.isInteger(maxLive) || warmCount < 0 || maxLive < 1 || warmCount > maxLive) throw Error("invalid pool size");
    this.refillConcurrency = options.refillConcurrency ?? 2;
    if (!Number.isInteger(this.refillConcurrency) || this.refillConcurrency < 1) throw Error("invalid refill concurrency");
    const gate = options.parkingGate;
    if (warmCount && (!gate || !Number.isFinite(gate.idleCorePercent) || gate.idleCorePercent < 0 || gate.idleCorePercent >= 2 || !gate.evidence)) throw Error("parking G1 evidence below 2% required");
  }
  backend;
  warmCount;
  maxLive;
  options;
  parked = [];
  live = /* @__PURE__ */ new Set();
  tokens = 0;
  creating = 0;
  acquiring = 0;
  maxTokens = 0;
  maxCreating = 0;
  closed = false;
  lifecycle = new AbortController();
  disposals = /* @__PURE__ */ new Set();
  startups = /* @__PURE__ */ new Set();
  warming;
  refillConcurrency;
  snapshot() {
    return { tokens: this.tokens, creating: this.creating, parked: this.parked.length, live: this.live.size, maxTokens: this.maxTokens, maxCreating: this.maxCreating, closed: this.closed };
  }
  async start(signal, deadline) {
    if (this.closed || this.tokens >= this.maxLive || this.creating >= this.refillConcurrency) throw Error("pool saturated");
    this.tokens++;
    this.creating++;
    this.maxTokens = Math.max(this.tokens, this.maxTokens);
    this.maxCreating = Math.max(this.creating, this.maxCreating);
    const p = Promise.resolve().then(() => this.backend.park(signal ? AbortSignal.any([signal, this.lifecycle.signal]) : this.lifecycle.signal, deadline));
    this.startups.add(p);
    let s;
    try {
      s = await p;
    } catch (e) {
      this.tokens--;
      throw e;
    } finally {
      this.creating--;
      this.startups.delete(p);
    }
    this.live.add(s);
    void s.exited.then(() => {
      this.live.delete(s);
      this.parked = this.parked.filter((x) => x !== s);
      this.tokens--;
    });
    if (this.closed) {
      s.kill();
      await s.exited;
      throw Error("pool closed");
    }
    return s;
  }
  warm() {
    if (this.warming) return this.warming;
    const fill = async () => {
      while (!this.closed) {
        const n = Math.min(
          this.warmCount - this.parked.length - this.creating,
          this.maxLive - this.tokens,
          this.refillConcurrency - this.creating
        );
        if (n <= 0) return;
        const results = await Promise.allSettled(Array.from({ length: n }, async () => {
          const s = await this.start();
          if (!this.closed && this.live.has(s)) this.parked.push(s);
        }));
        const failed = results.find((r) => r.status === "rejected");
        if (failed?.status === "rejected") throw failed.reason;
      }
    };
    this.warming = fill().finally(() => {
      this.warming = void 0;
    });
    return this.warming;
  }
  async acquire(signal, deadline) {
    if (this.closed || signal?.aborted) throw Error("pool closed/aborted");
    const prepare = async (s) => {
      if (deadline !== void 0) try {
        await s.armDeadline?.(deadline);
      } catch (e) {
        s.kill();
        await s.exited;
        throw e;
      }
      return s;
    };
    const ready = this.parked.pop();
    if (ready) return prepare(ready);
    if (this.warming && this.creating) {
      if (this.acquiring >= this.maxLive) throw Error("pool saturated");
      this.acquiring++;
      const combined = signal ? AbortSignal.any([signal, this.lifecycle.signal]) : this.lifecycle.signal;
      let abort;
      try {
        await Promise.race([this.warming, new Promise((_, reject) => {
          abort = () => reject(Error("pool closed/aborted"));
          combined.addEventListener("abort", abort, { once: true });
          if (combined.aborted) abort();
        })]);
      } finally {
        this.acquiring--;
        combined.removeEventListener("abort", abort);
      }
      if (this.closed || signal?.aborted) throw Error("pool closed/aborted");
      const s = this.parked.pop();
      if (s) return prepare(s);
    }
    return this.start(signal, deadline);
  }
  retire(s, beforeKill = () => {
  }) {
    const task = new Promise((resolve) => setImmediate(() => {
      beforeKill();
      void this.release(s).catch(() => {
      }).finally(resolve);
    }));
    this.disposals.add(task);
    void task.finally(() => this.disposals.delete(task));
  }
  async drain() {
    await Promise.all([...this.disposals]);
  }
  async release(s) {
    if (!this.live.has(s)) return;
    try {
      this.options.onEvent?.("kill", s, performance.now());
    } catch {
    }
    s.kill();
    await s.exited;
    try {
      this.options.onEvent?.("reaped", s, performance.now());
    } catch {
    }
    if (!this.closed) void this.warm().catch(() => {
    });
  }
  async close() {
    this.closed = true;
    this.lifecycle.abort();
    for (const s of this.live) s.kill();
    await Promise.allSettled([...this.startups]);
    await this.warming?.catch(() => {
    });
    await Promise.all([...this.live].map((s) => s.exited));
    await this.drain();
  }
};
export {
  SandboxPool,
  recommendedWarmCount
};
//# sourceMappingURL=pool.js.map
