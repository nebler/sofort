#!/usr/bin/env python3
"""Measured routable share: which real agent shell commands run on the grown
kernel, counting only argument shapes verified against Linux.

Reuses command_census.py's ingest and parser (same corpus, same rules, never
executes a command). Aggregates only: counts and generic shapes (flag names,
N, <arg>), no paths, patterns, values or identifiers.

  routable_census.py shapes [--min N]            top shapes per shaped tool (JSON)
  routable_census.py measure PROVEN.json [...]   routable share per proven set (JSON)

PROVEN.json: {"label": str, "shapes": ["head -n N <arg>", ...]}. A command is
routable when, under command_census.route(stage 0, host cwd), every tool
invocation's shape is in the set. `cd` and plain assignments are host-side.
The "potential" line is the census's own stage-0 upper bound for comparison.
"""
import collections as co
import importlib.util
import json
from pathlib import Path
import sys

spec = importlib.util.spec_from_file_location('command_census', Path(__file__).with_name('command_census.py'))
census = importlib.util.module_from_spec(spec)
spec.loader.exec_module(census)

# Run by the host's shell interpreter, not a guest program: cwd, variables and
# bash builtins that read nothing (echo/printf/true/false/pwd/test).
HOST_SIDE = {'cd', '<shell-assignment>', 'export', 'unset', 'set', 'readonly', 'local', 'declare', 'typeset',
             'echo', 'printf', 'true', 'false', 'pwd', 'test', '['}


def routable(r, proven):
    if not census.route(r, 0, host_cwd=True):
        return False
    tools = [i for i in r['inv'] if i['name'] not in HOST_SIDE]
    return bool(tools) and all(i.get('shape') in proven for i in tools)


def shapes(minimum):
    per = co.defaultdict(co.Counter)
    tools = co.Counter()
    for r in census.COMMANDS:
        for i in r['inv']:
            if i.get('shape'):
                per[i['name']][i['shape']] += 1
                tools[i['name']] += 1
    return {name: {'invocations': tools[name], 'distinct_shapes': len(per[name]),
                   'top': [[s, c] for s, c in per[name].most_common(40) if c >= minimum]}
            for name, _ in tools.most_common()}


def measure(paths):
    n = len(census.COMMANDS)
    potential = sum(census.route(r, 0, host_cwd=True) for r in census.COMMANDS)
    out = {'commands': n, 'potential_stage0_host_cwd': potential,
           'potential_percent': round(100 * potential / n, 2), 'sets': []}
    for path in paths:
        spec = json.loads(Path(path).read_text())
        proven = set(spec['shapes'])
        hits = sum(routable(r, proven) for r in census.COMMANDS)
        out['sets'].append({'label': spec['label'], 'shapes': len(proven), 'routable': hits,
                            'percent': round(100 * hits / n, 2),
                            'of_potential_percent': round(100 * hits / potential, 2) if potential else None})
    return out


def main(argv):
    if not argv or argv[0] not in ['shapes', 'measure']:
        raise SystemExit(__doc__)
    census.self_check()
    census.ingest()
    if argv[0] == 'shapes':
        minimum = int(argv[argv.index('--min') + 1]) if '--min' in argv else 20
        print(json.dumps(shapes(minimum), indent=1))
    else:
        print(json.dumps(measure(argv[1:]), indent=1))


if __name__ == '__main__':
    main(sys.argv[1:])
