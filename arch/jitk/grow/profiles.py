"""Trusted acceptance profiles, independent of the proposal transport.

Adding a slot is insufficient: each target needs semantics, errors, state,
executable mutants and an unchanged-program integration workload.
"""
from runtime import ROOT, CANONICAL, probe_source

PROFILES = {
    'ppoll': {'nr': 73, 'expected': b'ping\n ppoll OK\n',
              'cases': {'semantic': ['stdin readiness', 'stdout POLLOUT'],
                        'error': ['bad pointer', 'negative timeout', 'POLLNVAL'],
                        'state': ['revents copyout', 'consume input after readiness']},
              'mutations': {'false-success': 'pub fn call(_: &[usize]) -> isize { 0 }',
                            'wrong-errno': 'pub fn call(_: &[usize]) -> isize { -14 }'}},
    'rt_sigaction': {'nr': 134, 'expected': b'signals:ok\n'},
    'rt_sigprocmask': {'nr': 135, 'expected': b'signals:ok\n'},
    'fstat': {'nr': 80, 'expected': None},
    'pread64': {'nr': 67, 'expected': None},
}
for name in ('rt_sigaction', 'rt_sigprocmask'):
    PROFILES[name].update(cases={'semantic': ['explicit injected ENOSYS'],
                              'error': ['inaccessible pointers still ENOSYS'],
                              'state': ['query after attempted set', 'output canary unchanged']},
                          mutations={'false-success': 'pub fn call(_: &[usize]) -> isize { 0 }',
                                     'pointer-sensitive': 'pub fn call(a: &[usize]) -> isize { if a[1] == 1 { -14 } else { -38 } }'})
for name in ('fstat', 'pread64'):
    PROFILES[name]['cases'] = {'semantic': ['Linux-normalized metadata' if name == 'fstat' else 'header/offset/tail bytes and short reads'],
                              'error': ['bad/closed fd', 'NULL/read-only/wrapping pointer', 'errno precedence'],
                              'state': ['pathname/reopen metadata and offset' if name == 'fstat' else 'seek position after success/errors and independent opens']}


# Prompt transport consumes visible only; held-out sources stay controller-side.
for name, profile in PROFILES.items():
    profile['visible'] = probe_source(name)
    profile['heldout'] = ROOT/'heldout-probe.c' if name in ('ppoll', 'fstat', 'pread64') else None


def mutations(name, source):
    if name not in ('fstat', 'pread64'):
        return PROFILES[name]['mutations']
    # Mutants describe independent known bugs, not candidate source formatting.
    source = (CANONICAL/f'src/syscalls/{name}.rs').read_text()
    if name == 'fstat':
        return {
            'wrong-size': 'use crate::{fs, syscalls::copyout};\npub fn call(a: &[usize]) -> isize {\n'
                          'let f = match fs::get(a[0] as u32 as usize) { Ok(f) => f, Err(e) => return e };\n'
                          'let n = match fs::node(f.node) { Ok(n) => n, Err(e) => return e };\n'
                          'let mut st=fs::stat(Some(n)); st[48..56].copy_from_slice(&0u64.to_le_bytes());\n'
                          'match copyout(a[1], &st) { Ok(()) => 0, Err(e) => e } }',
            'false-success': 'pub fn call(_: &[usize]) -> isize { 0 }',
            'wrong-errno': source.replace('Err(e) => return e', 'Err(_) => return -22'),
        }
    assert 'let start = a[3].min(d.len());' in source
    assert 'Ok(()) => count as isize' in source
    return {
        'wrong-page': source.replace('let start = a[3].min(d.len());', 'let start = 0;'),
        'moves-offset': source.replace('Ok(()) => count as isize', 'Ok(()) => { f.pos += count; count as isize }'),
        'wrong-errno': source.replace('return -22;', 'return -9;'),
        'false-success': 'pub fn call(_: &[usize]) -> isize { 0 }',
    }


def resources(out, heldout=False):
    root = out/'resources'
    root.mkdir()
    (root/'data.bin').write_bytes(bytes((i*7+i//251)&255 for i in range(10241 if heldout else 9000)))
    (root/'data.bin').chmod(0o444)
    root.chmod(0o555)
    return root
