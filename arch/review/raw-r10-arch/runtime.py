"""R10: lines on the shipping execute() path, by group (physical lines; inline Rust tests split out).

Usage: python3 -I runtime.py <arch/jitk> <inventory.json from inventory.py>
"""
import json, os, re, sys

root, inv = sys.argv[1], sys.argv[2]
L = {r[2]: r[3] for r in json.load(open(inv))}


def inline_tests(path):
    t = open(os.path.join(root, path)).read().split('\n')
    for i, l in enumerate(t):
        if re.match(r'\s*#\[cfg\(test\)\]', l):
            return len(t) - i
    return 0


ex = 'backend.ts pool.ts executor.ts shard-backend.ts shard-ipc.ts select-backend.ts code.ts codec.mjs policy-adapter.ts providers.ts upstream.ts prepared-helpers.mjs receipt-path.ts lib.ts ipc/bridge.c'
groups = {
    'kernel image (src, excl *_checks)': [f for f in L if f.startswith('kernel/src/') and '_checks' not in f],
    '  of which console-only (console, wait, fdt, mmu, boot.S)': ['kernel/src/console.rs', 'kernel/src/arch/aarch64/wait.rs', 'kernel/src/arch/aarch64/fdt.rs', 'kernel/src/arch/aarch64/mmu.rs', 'kernel/src/arch/aarch64/boot.S'],
    '  of which ring-only (ring, ring_abi, wait_ring, mmu_ring, boot-ring.S)': ['kernel/src/ring.rs', 'kernel/src/ring_abi.rs', 'kernel/src/wait_ring.rs', 'kernel/src/arch/aarch64/mmu_ring.rs', 'kernel/src/arch/aarch64/boot-ring.S'],
    'shard lib + ipc service (excl synthetic, harness)': [f for f in L if f.startswith('shard/src/') and '/synthetic/' not in f and '/bin/harness/' not in f and f != 'shard/src/main.rs'],
    'vmm/src (libkrun launcher + watchdog)': [f for f in L if f.startswith('vmm/src/')],
    'vmm/sandbox/mod.rs': ['vmm/sandbox/mod.rs'],
    'executor runtime (+policy.mjs, bridge.c)': ['executor/' + x for x in ex.split()] + ['executor/policy/policy.mjs'],
    'protocol (dispatcher.ts + 2 bootstraps)': ['protocol/dispatcher.ts', 'protocol/bootstrap.js', 'kernel/ring-bootstrap.js'],
    'mcp server': ['mcp/server.mjs', 'mcp/jitk.mjs', 'mcp/native.mjs'],
}
tot = tt = 0
for g, fs in groups.items():
    n = sum(L.get(f, 0) for f in fs)
    it = sum(inline_tests(f) for f in fs if f.endswith('.rs'))
    if not g.startswith('  '):
        tot += n
        tt += it
    print('%-72s %6d lines  (inline #[cfg(test)] %d)' % (g, n, it))
print('RUNTIME TOTAL', tot, 'of which inline Rust tests', tt)
