"""Unchanged static SQLite, immutable packed DB, exact output/status gate."""
import json
from runtime import ROOT, build, process, host_command, check_host, dump, sha
from observations import observe, require_result, outcome

SQLITE_SHA = '005073a6c1c0e71c22ad8b752f1ffb6c35c8d913fe91f5795038c7d52cf639ff'
DB_SHA = 'f3d4180cd07ad9eed5a674c7ff4e5f6d817eb517029c185f66af862a30eac059'


def integration(work, out, elf, database, oracle, samples=1):
    out.mkdir()
    assert sha(elf) == SQLITE_SHA, 'use the pinned unchanged census SQLite binary'
    assert sha(database) == DB_SHA, 'use the unchanged census database'
    resources = out/'resources'
    (resources/'dev').mkdir(parents=True)
    (resources/'demo.db').write_bytes(database.read_bytes())
    (resources/'dev/null').write_bytes(b'')
    rows = []
    for case in json.loads((ROOT/'sqlite-corpus.json').read_text()):
        dest = out/case['name']; dest.mkdir()
        argv = ['sqlite3','-batch','-init','/dev/null','file:/demo.db?mode=ro&immutable=1',case['sql']]
        reference = oracle(elf, argv, dest/'oracle', None, resources=resources, data=b'')[0]
        image = build(work, dest/'build', elf, argv, resources)
        for i in range(samples):
            info, raw, err = process(host_command(image), dest/f'vm-{i:02}', data=b'')
            check_host(info, err)
            value = observe(raw); dump(dest/f'vm-{i:02}.observations.json', value)
            # Native sensitivity established these two compatibility probes;
            # registration is never confused with a real implementation.
            require_result(value, reference, allowed_missing=(48, 172))
        rows.append(dict(case, status='PASS', n=samples, **outcome(reference),
                         missing=sorted({r['nr'] for r in value['missing']}),
                         registered_enosys=sorted({r['nr'] for r in value['registered_enosys']}),
                         syscalls=sorted({r['nr'] for r in value['events']})))
    result = {'status':'PASS','binary_sha256':sha(elf),'database_sha256':sha(database),
              'method':'exact stdout bytes, reconstructed fd2 log bytes, guest done exit vs Linux pipes',
              'transport':'developer grow-trace on libkrun, printable stdout corpus; production fd2 remains dropped',
              'cases':rows}
    dump(out/'report.json', result)
    return result
