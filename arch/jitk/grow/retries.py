"""Bounded transactions with public gate feedback, never sealed test details."""
import copy
import json
import subprocess
import time

from runtime import dump, sha


class TransactionRejected(RuntimeError):
    pass


def feedback(gate, error):
    # These exceptions may contain entire hidden observations, host assertions,
    # mutant sources or integration inputs. Only the gate's public message leaves.
    if 'heldout' in gate:
        message = 'Held-out Linux differential rejected the handler. Hidden inputs and outputs are withheld.'
    elif gate == 'independent_full_stat_and_state':
        message = 'Independent filesystem ABI/state checks rejected the handler. Test details are withheld.'
    elif 'mutant' in gate or gate == 'mutation_gate':
        message = 'The mutation gate failed; independent broken handlers must compile, complete and be rejected.'
    elif gate.startswith(('integration', 'unchanged')):
        message = 'Unchanged-program integration rejected the handler. Corpus inputs and outputs are withheld.'
    elif gate == 'build_candidate':
        message = str(error)[-8000:]
    elif gate == 'source_validation':
        message = 'Proposal violates the one-file JSON/source contract: ' + str(error)[:500]
    elif gate == 'headless_cli':
        message = 'CLI failed to return a valid proposal: ' + type(error).__name__
    else:
        message = 'Visible probe rejected the handler: ' + str(error)[:8000]
    return {'gate': gate, 'message': message}


def retry_transaction(name, work, out, manifest, budget, invoke):
    assert 1 <= budget <= 3
    out.mkdir(parents=True, exist_ok=False)
    initial = copy.deepcopy(manifest)
    history = []
    started = time.monotonic()
    for index in range(1, budget + 1):
        dest = out / f'attempt-{index}'
        attempt_started = time.monotonic()
        try:
            report = invoke(dest, history)
        except (AssertionError, RuntimeError, subprocess.TimeoutExpired, ValueError) as error:
            stages = json.loads((dest/'stages.json').read_text()) if (dest/'stages.json').exists() else {}
            gate = list(stages)[-1] if stages else 'preparation'
            if 'mutation survived' in str(error):
                gate = 'mutation_gate'
            if gate == 'integration_build' and stages[gate].get('passed'):
                gate = 'unchanged_program'
            item = dict(attempt=index, accepted=False, wall_s=time.monotonic()-attempt_started, **feedback(gate, error))
            # Full diagnostics remain controller-side, separate from feedback.
            dump(dest/'rejection.json', dict(item, detail=str(error)))
            value = dest/'proposal.json'
            if value.exists():
                item['previous_source'] = json.loads(value.read_text())['source']
            history.append(item)
            manifest.clear(); manifest.update(copy.deepcopy(initial))
            (work/f'src/syscalls/{name}.rs').unlink(missing_ok=True)
        else:
            history.append({'attempt': index, 'accepted': True, 'gate': 'PASS', 'wall_s':time.monotonic()-attempt_started})
            break
        # Subscription errors stop the batch for an explicit resume, never a
        # smaller denominator or a rapid succession of doomed retries.
        log = (dest/'agent.log').read_text(errors='replace') if (dest/'agent.log').exists() else ''
        if any(s in log.lower() for s in ('usage limit', 'rate limit', 'quota exceeded', 'too many requests')):
            dump(out/'paused.json', {'reason': 'subscription_or_rate_limit', 'attempt': index})
            break
    accepted = history[-1]['accepted']
    summary = {k: v for k, v in (report if accepted else {'name': name, 'gate': 'FAIL'}).items()}
    summary.update(attempts=history, accepted=accepted, acceptance_at_1=accepted and len(history)==1,
                   acceptance_at_3=accepted, seconds=time.monotonic()-started,
                   cli_calls=sum(json.loads(p.read_text()).get('mode')=='live' for p in out.glob('attempt-*/agent-mode.json')),
                   prompt_sha256={str(p.relative_to(out)):sha(p) for p in out.glob('attempt-*/agent-prompt.txt')})
    dump(out/'report.json', summary)
    if not accepted:
        raise TransactionRejected(history[-1]['message'])
    return summary
