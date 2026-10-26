import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync } from 'node:fs';
import { join, relative } from 'node:path';
import { check, detail, dump, readJSON, sha } from './lib.ts';

export interface Feedback {
  attempt: number;
  accepted: boolean;
  gate: string;
  wall_s: number;
  message?: string;
  previous_source?: string;
}
export interface TransactionReport {
  name: string;
  gate: string;
  [key: string]: unknown;
}
export function feedback(gate: string, error: unknown): { gate: string; message: string } {
  let message: string;
  if (gate.includes('heldout')) {
    message = 'Held-out Linux differential rejected the handler. Hidden inputs and outputs are withheld.';
  } else if (gate === 'independent_full_stat_and_state') {
    message = 'Independent filesystem ABI/state checks rejected the handler. Test details are withheld.';
  } else if (gate.includes('mutant') || gate === 'mutation_gate') {
    message = 'The mutation gate failed; independent broken handlers must compile, complete and be rejected.';
  } else if (gate.startsWith('integration') || gate.startsWith('unchanged')) {
    message = 'Unchanged-program integration rejected the handler. Corpus inputs and outputs are withheld.';
  } else if (gate === 'build_candidate') {
    message = detail(error).slice(-8000);
  } else if (gate === 'source_validation') {
    message = 'Proposal violates the one-file JSON/source contract: ' + detail(error).slice(0, 500);
  } else if (gate === 'headless_cli') {
    message = 'CLI failed to return a valid proposal: ' + (error instanceof Error ? error.name : 'Error');
  } else {
    message = 'Visible probe rejected the handler: ' + detail(error).slice(0, 8000);
  }
  return { gate, message };
}
export async function retryTransaction(name: string, work: string, out: string, manifest: Record<string, unknown>, budget: number, invoke: (dest: string, history: Feedback[]) => Promise<TransactionReport>): Promise<TransactionReport> {
  check(Number.isInteger(budget) && budget >= 1 && budget <= 3, 'attempt budget must be 1..3');
  check(!existsSync(out), 'transaction already exists');
  mkdirSync(out, { recursive: true });
  const initial = JSON.stringify(manifest);
  const history: Feedback[] = [];
  const started = performance.now();
  let report: TransactionReport = { name, gate: 'FAIL' };
  for (let index = 1; index <= budget; index += 1) {
    const dest = join(out, 'attempt-' + index);
    const attemptStarted = performance.now();
    try {
      report = await invoke(dest, history);
      history.push({ attempt: index, accepted: true, gate: 'PASS', wall_s: (performance.now() - attemptStarted) / 1000 });
      break;
    } catch (error) {
      const stages = existsSync(join(dest, 'stages.json')) ? readJSON<Record<string, { passed: boolean }>>(join(dest, 'stages.json')) : {};
      const labels = Object.keys(stages);
      let gate = labels.length ? labels[labels.length - 1] : 'preparation';
      if (detail(error).includes('mutation survived')) {
        gate = 'mutation_gate';
      }
      if (gate === 'integration_build' && stages[gate].passed) {
        gate = 'unchanged_program';
      }
      const item: Feedback = { attempt: index, accepted: false, wall_s: (performance.now() - attemptStarted) / 1000, ...feedback(gate, error) };
      mkdirSync(dest, { recursive: true });
      dump(join(dest, 'rejection.json'), { ...item, detail: detail(error) });
      if (existsSync(join(dest, 'proposal.json'))) {
        item.previous_source = readJSON<{ source: string }>(join(dest, 'proposal.json')).source;
      }
      history.push(item);
      const restored = JSON.parse(initial) as Record<string, unknown>;
      for (const key of Object.keys(manifest)) {
        if (!Object.hasOwn(restored, key)) {
          delete manifest[key];
        }
      }
      for (const key of Object.keys(restored)) {
        manifest[key] = restored[key];
      }
      const handler = join(work, `src/syscalls/${name}.rs`);
      if (existsSync(handler)) {
        unlinkSync(handler);
      }
    }
    const log = existsSync(join(dest, 'agent.log')) ? readFileSync(join(dest, 'agent.log'), 'utf8').toLowerCase() : '';
    if (['usage limit', 'rate limit', 'quota exceeded', 'too many requests'].some((text) => log.includes(text))) {
      dump(join(out, 'paused.json'), { reason: 'subscription_or_rate_limit', attempt: index });
      break;
    }
  }
  const accepted = history[history.length - 1].accepted;
  const summary: TransactionReport = { name, gate: 'FAIL' };
  for (const key of Object.keys(accepted ? report : { name, gate: 'FAIL' })) {
    summary[key] = accepted ? report[key] : key === 'name' ? name : 'FAIL';
  }
  summary.attempts = history;
  summary.accepted = accepted;
  summary.acceptance_at_1 = accepted && history.length === 1;
  summary.acceptance_at_3 = accepted;
  summary.seconds = (performance.now() - started) / 1000;
  let calls = 0;
  const prompts: Record<string, string> = {};
  for (const entry of readdirSync(out).filter((entry) => /^attempt-\d+$/.test(entry))) {
    const mode = join(out, entry, 'agent-mode.json');
    if (existsSync(mode) && readJSON<{ mode: string }>(mode).mode === 'live') {
      calls += 1;
    }
    const prompt = join(out, entry, 'agent-prompt.txt');
    if (existsSync(prompt)) {
      prompts[relative(out, prompt)] = sha(prompt);
    }
  }
  summary.cli_calls = calls;
  summary.prompt_sha256 = prompts;
  dump(join(out, 'report.json'), summary);
  check(accepted, history[history.length - 1].message || 'transaction rejected');
  return summary;
}
