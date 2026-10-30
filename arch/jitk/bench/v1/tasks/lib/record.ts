// Record mode for capture scripts: runs every program of a task against live
// tool implementations and keeps one recording per distinct call key (the
// first one), with its measured wall time and size. Programs drive the
// capture, so the recording covers exactly the calls they make.
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { bytesOf, callKey, type RecordedCall, runProgram, TASKS, type TaskSpec } from './tasks.ts';

export type LiveTools = Record<string, Record<string, (args: Record<string, unknown>) => Promise<unknown>>>;

export class Recorder {
  readonly calls = new Map<string, RecordedCall>();
  private pending = new Map<string, Promise<unknown>>();
  private live: LiveTools;

  constructor(live: LiveTools) {
    this.live = live;
  }

  namespaces(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [namespace, tools] of Object.entries(this.live)) {
      const fns: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {};
      for (const tool of Object.keys(tools)) {
        fns[tool] = args => this.call(namespace, tool, args);
      }
      out[namespace] = fns;
    }
    return out;
  }

  private async call(namespace: string, tool: string, input: Record<string, unknown>): Promise<unknown> {
    const args = [JSON.parse(JSON.stringify(input ?? {}))];
    const key = callKey(namespace, tool, args);
    const done = this.calls.get(key);
    if (done) {
      if (done.error) throw new Error(done.error);
      return structuredClone(done.response);
    }
    let flight = this.pending.get(key);
    if (!flight) {
      flight = (async () => {
        const started = performance.now();
        try {
          const response = await this.live[namespace][tool](args[0]);
          const latencyMs = Math.round((performance.now() - started) * 10) / 10;
          this.calls.set(key, { namespace, tool, args, response, latencyMs, bytes: bytesOf(response) });
          return response;
        } catch (error) {
          const latencyMs = Math.round((performance.now() - started) * 10) / 10;
          const message = error instanceof Error ? error.message : String(error);
          this.calls.set(key, { namespace, tool, args, error: message, latencyMs, bytes: 0 });
          throw error;
        }
      })();
      this.pending.set(key, flight);
    }
    return structuredClone(await flight);
  }

  async runAll(id: string, task: TaskSpec): Promise<unknown[]> {
    const results: unknown[] = [];
    for (const program of task.programs) {
      const code = readFileSync(join(TASKS, id, program), 'utf8');
      results.push(await runProgram(code, this.namespaces()));
      console.error('recorded', program, '->', this.calls.size, 'calls');
    }
    return results;
  }

  // Stable order: by namespace, tool, then key.
  lines(): RecordedCall[] {
    return [...this.calls.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(entry => entry[1]);
  }
}

export function toJsonl(calls: RecordedCall[]): string {
  return calls.map(call => JSON.stringify(call)).join('\n') + '\n';
}

// Writes <task>/responses.jsonl and its committed gzip twin.
export function writeResponses(id: string, calls: RecordedCall[]): { bytes: number; gzBytes: number } {
  for (const call of calls) call.bytes = call.error ? 0 : bytesOf(call.response);
  const text = toJsonl(calls);
  const gz = gzipSync(text, { level: 9 });
  writeFileSync(join(TASKS, id, 'responses.jsonl'), text);
  writeFileSync(join(TASKS, id, 'responses.jsonl.gz'), gz);
  return { bytes: Buffer.byteLength(text), gzBytes: gz.length };
}
