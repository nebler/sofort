"""Strict single-thread QuickJS strace adapter, NOT a general strace grammar."""
import json, re, sys
NR = dict(ioctl=29, getcwd=17, openat=56, close=57, lseek=62, read=63, write=64, readv=65, writev=66, readlinkat=78, exit_group=94, set_tid_address=96, clock_gettime=113, gettimeofday=169, brk=214, munmap=215, mremap=216, execve=221, mmap=222, mprotect=226, madvise=233, getrandom=278, fstat=80, newfstatat=79, rt_sigaction=134, rt_sigprocmask=135, prlimit64=261, futex=98, getpid=172, sysinfo=179, faccessat=48)
POINTERS = {'brk': [0], 'mmap': [0], 'munmap': [0], 'mremap': [0],
            'set_tid_address': [0], 'ioctl': [2], 'readlinkat': [2], 'mprotect': [0], 'madvise': [0]}

def split_args(s):
    out, start, depth, quoted, escaped = [], 0, 0, False, False
    for i, c in enumerate(s):
        if quoted:
            if escaped: escaped = False
            elif c == '\\': escaped = True
            elif c == '"': quoted = False
        elif c == '"': quoted = True
        elif c in '([{': depth += 1
        elif c in ')]}': depth -= 1
        elif c == ',' and depth == 0:
            out.append(s[start:i].strip()); start = i + 1
    if s: out.append(s[start:].strip())
    return out

def normalize(raw, require_exit=False):
    events, addresses, regions, heap = [], {}, [], None
    def addr(s):
        if s in ('NULL', '0', '0x0'): return 'NULL'
        value = int(s, 0)
        for base, length, label in reversed(regions):
            if base <= value < base + length: return label + '+' + str(value-base)
        return addresses.setdefault(s, 'P' + str(len(addresses)))
    for line in raw.splitlines():
        line = re.sub(r'^\d+\s+', '', line)
        if line.startswith('+++ exited with '): continue
        if not line: continue
        m = re.fullmatch(r'(\w+)\((.*)\)\s+=\s+(.*)', line)
        if not m: raise ValueError('unparsed line: ' + line)
        name, a, r = m.groups()
        # Refuse truncation/concurrency/signals; never silently discard evidence.
        if '...' in re.sub(r'"(?:\\.|[^"\\])*"', '', a):
            raise ValueError('truncated trace: ' + line)
        args = split_args(a)
        raw_args = list(args)
        if name == 'brk' and heap is None and not r.startswith('-1'):
            heap = int(r.split()[0], 0)
        if name == 'brk' and args[0] not in ('NULL', '0'):
            args[0] = 'HEAP+' + str(int(args[0], 0)-heap)
        if name in ('clone', 'clone3', 'fork', 'vfork'):
            raise ValueError('single-thread contract violated')
        if name == 'execve':
            args[2] = re.sub(r'0x[0-9a-f]+', 'ENV', args[2])
        for i in POINTERS.get(name, []):
            if i < len(args) and re.fullmatch(r'0x[0-9a-f]+|NULL', args[i]):
                args[i] = addr(args[i])
        errno = None
        if r.startswith('-1 '):
            errno = r.split()[1]; result = -1
        elif r.startswith('?'): result = None
        else:
            scalar = r.split()[0]
            if name == 'brk': result = 'HEAP+' + str(int(scalar, 0)-heap)
            elif name in ('mmap', 'mremap'):
                base, length = int(scalar, 0), int(raw_args[1 if name == 'mmap' else 2], 0)
                result = 'M' + str(len(regions)) + '+0'
                regions.append((base, length, result[:-2]))
            elif name == 'set_tid_address': result = 'T0'
            else: result = int(scalar, 0)
        # Full quoted bytes (including readv/writev iovecs) remain in args.
        events.append({'v': 1, 'seq': len(events), 'tid': 'T0', 'nr': NR[name], 'name': name,
                       'args': args, 'ret': result, 'errno': errno})
    if require_exit and (not events or events[-1]['name'] != 'exit_group'):
        raise ValueError('missing terminal exit_group event')
    return events

if __name__ == '__main__':
    for event in normalize(open(sys.argv[1]).read()):
        print(json.dumps(event, separators=(',', ':')))
