// Load a task directory (contract.ts TaskSpec): task.json, responses.jsonl,
// programs/*.js and the oracle module.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Oracle, RecordedCall, TaskSpec } from './contract.ts';

export interface Program { name: string; code: string }
export interface LoadedTask {
  dir: string;
  spec: TaskSpec;
  programs: Program[];
  responses: RecordedCall[];
  oracle: Oracle;
}

export async function loadTask(dirArg: string): Promise<LoadedTask> {
  const dir = resolve(dirArg);
  const spec = JSON.parse(readFileSync(join(dir, 'task.json'), 'utf8')) as TaskSpec;
  if (!spec.id) spec.id = basename(dir);
  const programs = spec.programs.map(p => ({ name: p, code: readFileSync(join(dir, p), 'utf8').trim() }));
  const oracleModule = await import(pathToFileURL(join(dir, spec.oracle)).href);
  const oracle: Oracle | undefined = oracleModule.check ?? oracleModule.default;
  if (typeof oracle !== 'function') throw Error(`${spec.id}: ${spec.oracle} exports no check(result)`);
  let responses: RecordedCall[] = [];
  if ((spec.kind ?? 'js') === 'js') {
    const path = join(dir, spec.responses);
    if (!existsSync(path)) throw Error(`${spec.id}: ${path} missing (generated: run bench/v1/tasks/materialize.ts first)`);
    responses = readFileSync(path, 'utf8').split('\n').filter(l => l.trim()).map((line, i) => {
      const r = JSON.parse(line) as RecordedCall;
      if (typeof r.namespace !== 'string' || typeof r.tool !== 'string' || !Array.isArray(r.args) || !Number.isFinite(r.latencyMs))
        throw Error(`${spec.id}: ${spec.responses}:${i + 1}: not a RecordedCall`);
      return r;
    });
  }
  return { dir, spec, programs, responses, oracle };
}

/** The hostile program set (S3): harness/hostile/*.js, sorted by name. */
export function hostilePrograms(only?: string[]): Program[] {
  const dir = new URL('./hostile/', import.meta.url);
  return readdirSync(dir).filter(f => f.endsWith('.js')).sort()
    .filter(f => !only || only.includes(f.replace(/\.js$/, '')))
    .map(f => ({ name: 'hostile/' + f.replace(/\.js$/, ''), code: readFileSync(new URL(f, dir), 'utf8').trim() }));
}

/** Runs after hostile programs on the same executor: fails if a hostile run's
 *  global or prototype writes are visible to a later run. */
export const LEAK_CANARY: Program = {
  name: 'canary/leak',
  code: `async () => {
  const leaks = [];
  if (typeof globalThis.__benchLeak !== 'undefined') leaks.push('globalThis.__benchLeak');
  if (({}).__benchLeak !== undefined) leaks.push('Object.prototype.__benchLeak');
  if ([].__benchLeak !== undefined) leaks.push('Array.prototype.__benchLeak');
  if (JSON.stringify({a: 1}) !== '{"a":1}') leaks.push('JSON.stringify');
  return { leaks };
}`,
};
export const leakOracle: Oracle = (r: any) =>
  r && Array.isArray(r.leaks) && r.leaks.length === 0 ? { ok: true, reason: 'no leaks' } : { ok: false, reason: 'leaked: ' + JSON.stringify(r?.leaks ?? r) };
