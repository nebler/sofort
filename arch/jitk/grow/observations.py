"""Keep causal failures even when a missing syscall is a tolerated probe."""
import json, re


def observe(raw):
    stdout, stderr = bytearray(), bytearray()
    events, errors, enosys, missing, fatal = [], [], [], [], []
    pending = None
    done = None
    for line in raw.split(b'\n'):
        if not line:
            continue
        if re.fullmatch(b'hello jitk fdt=[0-9a-f]{16}|exit=[0-9a-f]{16}',line):
            continue
        if b'\x1e' not in line:
            stdout.extend(line + b'\n')
            continue
        prefix, data = line.split(b'\x1e', 1)
        stdout.extend(prefix)
        try:
            r = json.loads(data)
            assert r['v'] == 2
            kind = r['kind']
            if kind in ('sys.enter', 'missing'):
                assert pending is None and done is None
                assert r['seq'] == len(events) + 1 and len(r['args']) == 6
                pending = r
                if kind == 'missing':
                    missing.append(r)
            elif kind == 'sys.exit':
                assert pending and r['seq'] == pending['seq']
                event = dict(pending, ret=r['ret'], output=r.get('output'))
                events.append(event)
                if r['ret'] < 0:
                    errors.append(event)
                if r['ret'] == -38 and pending['kind'] == 'sys.enter':
                    enosys.append(event)
                pending = None
            elif kind == 'log':
                stderr.extend(bytes.fromhex(r['hex']))
            elif kind == 'done':
                assert pending and pending['nr'] in (93, 94)
                assert r['seq'] == pending['seq'] and r['code'] == pending['args'][0]
                assert done is None
                done = r['code']
                events.append(dict(pending, ret=None))
                pending = None
            else:
                fatal.append(r)
        except (ValueError, KeyError, AssertionError, TypeError) as e:
            fatal.append({'class': 'output-protocol', 'raw_hex': data.hex(), 'detail': str(e)})
    complete = done is not None and pending is None and not fatal
    return {'stdout_hex': stdout.hex(), 'stderr_hex': stderr.hex(), 'exit': done,
            'trace_complete': complete, 'missing': missing, 'registered_enosys': enosys,
            'argument_errors': errors, 'fatal_protocol': fatal, 'events': events}


def outcome(value):
    return {k: value[k] for k in ('stdout_hex', 'stderr_hex', 'exit')}


def require_result(value, reference, allowed_missing=()):
    assert value['trace_complete'], 'fatal/incomplete output protocol'
    assert all(r['nr'] in allowed_missing for r in value['missing']), 'unexpected missing syscall'
    assert outcome(value) == outcome(reference), {'linux': outcome(reference), 'jitk': outcome(value)}
