#!/usr/bin/env python3
"""Fetch pinned public sources; never install a host toolchain."""
import hashlib, json, pathlib, tarfile, urllib.request, zipfile

root = pathlib.Path('/tmp/jitk-10/r2')
receipts = []
for name, url in [
    ('lua-5.4.8.tar.gz', 'https://www.lua.org/ftp/lua-5.4.8.tar.gz'),
    ('sqlite-amalgamation-3500400.zip', 'https://sqlite.org/2025/sqlite-amalgamation-3500400.zip'),
]:
    path = root / name
    if not path.exists():
        with urllib.request.urlopen(url, timeout=60) as response:
            path.write_bytes(response.read())
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if name.startswith('lua'):
        assert digest == '4f18ddae154e793e46eeab727c59ef1c0c0c2b744e7b94219710d76f530629ae'
        with tarfile.open(path) as archive:
            archive.extractall(root, filter='data')
    else:
        with zipfile.ZipFile(path) as archive:
            archive.extractall(root)
        source = root / 'sqlite-amalgamation-3500400/sqlite3.c'
        assert hashlib.sha3_256(source.read_bytes()).hexdigest() == '9145255e83da6529e70121ee4d7a4c88fe83ca4511da0c9ed13d10842df36782'
    receipts.append(dict(url=url, sha256=digest, bytes=path.stat().st_size))
pathlib.Path(__file__).with_name('sources.json').write_text(json.dumps(receipts, indent=2)+'\n')
