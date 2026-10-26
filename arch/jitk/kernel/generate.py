"""Strict slots catalogue reader shared by the manifest and dispatch generator."""
import hashlib
import json
import re

# Rust keywords cannot name a generated handler module.
KEYWORDS = set('as break const continue crate else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while async await dyn abstract become box do final macro override priv typeof unsized virtual yield try gen'.split())


def slot_pairs(pairs):
    slots = {}
    for nr, name in pairs:
        if nr in slots:
            raise ValueError(f'duplicate syscall number: {nr}')
        if not re.fullmatch(r'0|[1-9][0-9]*', nr) or int(nr) > 0xFFFFFFFF:
            raise ValueError(f'invalid syscall number: {nr!r}')
        if not isinstance(name, str) or not re.fullmatch(r'[a-z][a-z0-9_]*', name) or name in KEYWORDS:
            raise ValueError(f'invalid handler identifier: {name!r}')
        slots[nr] = name
    return slots


def generate(root, out):
    slots = json.loads((root / 'slots.json').read_text(), object_pairs_hook=slot_pairs)
    if not isinstance(slots, dict) or not slots:
        raise ValueError('slots.json must be a nonempty object')
    rows, modules, arms, present = [], [], [], []
    emitted = set()
    for nr, name in sorted(slots.items(), key=lambda row: int(row[0])):
        path = root / f'src/syscalls/{name}.rs'
        print(f'cargo:rerun-if-changed={path}')
        exists = path.is_file()
        rows.append(dict(nr=int(nr), name=name, registered=exists,
                         sha256=hashlib.sha256(path.read_bytes()).hexdigest() if exists else None))
        if exists:
            if name not in emitted:
                modules.append(f'#[path={json.dumps(str(path))}] mod {name};')
                emitted.add(name)
            arms.append(f'{nr} => {name}::call(a),')
            present.append(nr)
        else:
            arms.append(f'{nr} => -38,')
    dispatch = 'mod handlers {\n'
    dispatch += '\n'.join(modules) + '\n'
    dispatch += '#[allow(unused_imports, reason="Candidate handlers may be deleted by the grow gate.")]\nuse super::{copyin, copyout, now_ns, park_poll, poll_fd, writable};\n' 
    dispatch += f'pub fn registered(n:usize)->bool {{ matches!(n, {" | ".join(present) or "_ if false"}) }}\n'
    dispatch += 'pub fn dispatch(n:usize,a:&[usize; 6])->isize { match n {\n'
    dispatch += '\n'.join(arms) + '\n_=>-38\n}}\n}\npub use handlers::{registered,dispatch};\n'
    (out / 'dispatch.rs').write_text(dispatch)
    (out / 'syscalls.json').write_text(json.dumps(rows, indent=2) + '\n')
