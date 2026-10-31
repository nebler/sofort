#!/usr/bin/env python3
"""Offline, aggregate-only shell census. Never execute transcript commands.

Standard library only. Writes one NEW report using exclusive creation. All raw
commands, paths, arguments, identifiers and outputs stay in process memory.
"""
import collections as co
import datetime as dt
import hashlib
import json
import math
from pathlib import Path
import re
import statistics as st

ROOT = Path(__file__).resolve().parents[4]
REPORT = ROOT / 'arch/research/agent-fs/02-COMMAND-CENSUS.md'
READ = set('cat head tail ls rg grep egrep fgrep find wc jq sed awk gawk sort uniq cut tr diff cmp comm pwd basename dirname realpath readlink stat file du od hexdump xxd strings sha256sum shasum md5sum cksum printf echo date uname which whereis command type true false test [ printenv env getconf id whoami readelf objdump nm otool size git rev tac paste seq yes column expr factor readlinkat'.split())
WRITE = set('tee mkdir rmdir rm cp mv ln touch truncate chmod chown install patch apply_patch sd sync mktemp rsync ditto unzip gunzip bunzip2 unxz'.split())
RUNTIME = set('node npm npx pnpm yarn bun deno python pip pipx uv cargo rustc rustup go make gmake cmake ninja meson ctest gcc g++ cc c++ clang clang++ ld lld ld.lld zig ar ranlib strip objcopy llvm-objcopy llvm-ar llvm-strip llvm-readelf llvm-objdump llvm-nm tsc tsx ts-node vitest jest mocha pytest playwright eslint biome prettier webpack vite next turbo nx rollup esbuild swc docker podman kubectl qemu-system-aarch64 qemu-aarch64 lima limactl colima firecracker multipass vagrant brew apt apt-get dpkg ruby irb bundle gem perl lua luajit micropython java javac swift xcrun xcodebuild dotnet mono R Rscript hyperfine time timeout watch xargs parallel kill pkill killall ps pgrep lsof top htop sleep sqlite3 duckdb ffmpeg pandoc qpdf fd fdfind'.split())
NETWORK = set('curl wget gh ssh scp sftp nc netcat telnet ping dig nslookup host http https httpie fetch git-remote-http git-remote-https'.split())
SHELL = set('sh bash zsh fish dash source . eval exec export unset set readonly local declare typeset alias unalias read getopts ulimit umask trap wait jobs fg bg disown return break continue exit pushd popd dirs [[ ]]'.split())
SAFE = READ | WRITE | RUNTIME | NETWORK | SHELL | set('cd tar gzip bzip2 xz zstd busybox doas sudo nice nohup chroot taskset ionice caffeinate stdbuf openssl base64 base32 plutil defaults pbcopy pbpaste open osascript launchctl sysctl mount umount df diskutil systemctl journalctl dmesg service python3 python2 pip3 pip2'.split())
RANK = {'A': 0, 'B': 1, 'C': 2, 'D': 3}
COUNTS = co.Counter()
SCHEMA = co.Counter()
COMMANDS = []
CALLS = {}
SESSIONS = {}
EVENT_RANGE = []
FILES = co.Counter()
JS_STATS = co.Counter()


def stamp(s):
    if not isinstance(s, str):
        return None
    try:
        return dt.datetime.fromisoformat(s.replace('Z', '+00:00')).timestamp()
    except (ValueError, OverflowError):
        return None


def norm(s):
    n = s.rsplit('/', 1)[-1]
    if re.fullmatch(r'python(?:\d+(?:\.\d+)*)?', n):
        n = 'python'
    if re.fullmatch(r'pip(?:\d+(?:\.\d+)*)?', n):
        n = 'pip'
    if re.fullmatch(r'node(?:\d+)?', n):
        n = 'node'
    return n


def safe_name(n):
    return n if n in SAFE else '<other executable>'


def js_tokens(s):
    """Small lexical reader, not a JS evaluator; dynamic templates stay unknown."""
    out = []
    i = 0
    while i < len(s):
        c = s[i]
        if c.isspace():
            i += 1
        elif s.startswith('//', i):
            j = s.find('\n', i)
            i = len(s) if j < 0 else j + 1
        elif s.startswith('/*', i):
            j = s.find('*/', i + 2)
            i = len(s) if j < 0 else j + 2
        elif c in "'\"`":
            q = c
            i += 1
            buf = []
            dynamic = False
            while i < len(s) and s[i] != q:
                if q == '`' and s.startswith('${', i):
                    dynamic = True
                if s[i] == '\\' and i + 1 < len(s):
                    i += 1
                    e = s[i]
                    if e in {'n', 'r', 't', 'b', 'f', 'v'}:
                        buf.append({'n': '\n', 'r': '\r', 't': '\t', 'b': '\b', 'f': '\f', 'v': '\v'}[e])
                    elif e == '\n':
                        pass
                    elif e in ['x', 'u']:
                        size = 2 if e == 'x' else 4
                        h = s[i + 1:i + 1 + size]
                        if re.fullmatch('[0-9a-fA-F]{' + str(size) + '}', h):
                            buf.append(chr(int(h, 16)))
                            i += size
                        else:
                            dynamic = True
                    else:
                        buf.append(e)
                else:
                    buf.append(s[i])
                i += 1
            i += 1
            out.append(('dynamic' if dynamic else 'string', ''.join(buf)))
        elif c.isalpha() or c in '_$':
            j = i + 1
            while j < len(s) and (s[j].isalnum() or s[j] in '_$'):
                j += 1
            out.append(('id', s[i:j]))
            i = j
        elif c.isdigit():
            j = i + 1
            while j < len(s) and (s[j].isdigit() or s[j] == '.'):
                j += 1
            out.append(('number', s[i:j]))
            i = j
        else:
            out.append(('punct', c))
            i += 1
    return out


def js_exec(s):
    ts = js_tokens(s)
    consts = {}
    # Resolve only an unambiguous literal binding, never expressions or code.
    for i in range(len(ts) - 3):
        if ts[i][1] in ['const', 'let', 'var'] and ts[i + 1][0] == 'id' and ts[i + 2][1] == '=' and ts[i + 3][0] == 'string':
            if i + 4 == len(ts) or ts[i + 4][1] in [';', ',']:
                consts[ts[i + 1][1]] = ts[i + 3][1]
    found = []
    for i in range(len(ts) - 2):
        method = ts[i][1]
        if method not in ['exec_command', 'shell_command', 'shell', 'write_stdin'] or ts[i + 1][1] != '(':
            continue
        # Only object arguments; no eval, interpolation, function calls or vars.
        if ts[i + 2][1] != '{':
            JS_STATS['nonliteral_object'] += 1
            continue
        depth = 1
        j = i + 3
        fields = {}
        while j < len(ts) and depth:
            if depth == 1 and ts[j][0] in ['id', 'string'] and j + 2 < len(ts) and ts[j + 1][1] == ':':
                k = ts[j][1]
                v = ts[j + 2]
                end = j + 3
                if end < len(ts) and ts[end][1] in [',', '}']:
                    if v[0] == 'string':
                        fields[k] = v[1]
                    elif v[0] == 'number':
                        try:
                            fields[k] = float(v[1])
                        except ValueError:
                            pass
                    elif v[0] == 'id' and v[1] in consts:
                        fields[k] = consts[v[1]]
            if ts[j][0] == 'punct':
                if ts[j][1] in ['{', '[', '(']:
                    depth += 1
                elif ts[j][1] in ['}', ']', ')']:
                    depth -= 1
            j += 1
        if method == 'write_stdin':
            found.append(('poll', fields))
        else:
            value = fields.get('cmd', fields.get('command'))
            if isinstance(value, str):
                found.append(('command', fields))
                JS_STATS['literal_shell_calls'] += 1
            else:
                found.append(('unknown', fields))
                JS_STATS['nonliteral_command'] += 1
    return found


def strip_heredocs(s):
    """Remove heredoc bodies before shell lexing (bodies are data, not programs)."""
    lines = s.splitlines(keepends=True)
    out = []
    pending = []
    count = 0
    missing = False
    for line in lines:
        if pending:
            delimiter, tabs = pending[0]
            v = line.rstrip('\r\n')
            if tabs:
                v = v.lstrip('\t')
            if v == delimiter:
                pending.pop(0)
            continue
        # Quote-aware header scan. Only unquoted << is a heredoc operator.
        i = 0
        q = None
        while i < len(line):
            c = line[i]
            if c == '\\' and q != "'":
                i += 2
                continue
            if q:
                if c == q:
                    q = None
                i += 1
                continue
            if c in "'\"`":
                q = c
                i += 1
                continue
            if line.startswith('<<<', i):
                i += 3
                continue
            if line.startswith('<<', i):
                m = re.match(r"<<(-?)\s*(?:'([^']*)'|\"([^\"]*)\"|([A-Za-z_][\w.-]*))", line[i:])
                if m:
                    pending.append((next(v for v in m.groups()[1:] if v is not None), bool(m.group(1))))
                    count += 1
                    i += len(m.group())
                    continue
            i += 1
        out.append(line)
    if pending:
        missing = True
    return ''.join(out), count, missing


def shell_lex(s):
    """Quote-aware simple-shell tokenizer; recurse into command substitutions."""
    ts = []
    nested = []
    flags = set()
    i = 0
    word = []
    quoted = False
    ops = [';;&', '&>>', '<<<', '<<-', '&&', '||', '>>', '<<', '<&', '>&', '<>', '>|', ';;', ';&', '|&', '&>']

    def flush():
        nonlocal word, quoted
        if word or quoted:
            ts.append(('word', ''.join(word), quoted))
        word = []
        quoted = False

    def expansion(pos, terminator):
        depth = 1
        q = None
        j = pos
        while j < len(s):
            c = s[j]
            if c == '\\' and q != "'":
                j += 2
                continue
            if q:
                if c == q:
                    q = None
            elif c in "'\"":
                q = c
            elif terminator == ')' and c == '(':
                depth += 1
            elif c == terminator:
                depth -= 1
                if not depth:
                    return s[pos:j], j + 1
            j += 1
        flags.add('lexical_uncertainty')
        return s[pos:], len(s)

    q = None
    while i < len(s):
        c = s[i]
        if c == '\\' and q != "'":
            if i + 1 < len(s) and s[i + 1] != '\n':
                word.append(s[i + 1])
            i += 2
            continue
        if q == "'":
            if c == q:
                q = None
            else:
                word.append(c)
            i += 1
            continue
        if c == "'" and q is None:
            q = c
            quoted = True
            i += 1
            continue
        if c == '"':
            if q == '"':
                q = None
            elif q is None:
                q = '"'
                quoted = True
            i += 1
            continue
        if c == '`':
            body, i = expansion(i + 1, '`')
            nested.append(body)
            flags.add('substitution')
            word.append('<substitution>')
            continue
        if s.startswith('$((', i):
            body, i = expansion(i + 3, ')')
            if i < len(s) and s[i] == ')':
                i += 1
            flags.add('arithmetic')
            word.append('<arithmetic>')
            continue
        if s.startswith('$(', i) or (q is None and (s.startswith('<(', i) or s.startswith('>(', i))):
            process = c != '$'
            body, i = expansion(i + 2, ')')
            nested.append(body)
            flags.add('process_substitution' if process else 'substitution')
            word.append('<substitution>')
            continue
        if c == '$':
            if re.match(r'\$(?:[A-Za-z_0-9@*#?!$-]|\{)', s[i:]):
                flags.add('variable')
            word.append(c)
            i += 1
            continue
        if q == '"':
            word.append(c)
            i += 1
            continue
        if c == '#' and not word:
            end = s.find('\n', i)
            i = len(s) if end < 0 else end
            continue
        if c.isspace():
            flush()
            if c == '\n':
                ts.append(('op', ';', False))
            i += 1
            continue
        if c in '|&;()<>{}':
            # Brace expansions inside a word are not command groups.
            if c in '{}' and (word or (i + 1 < len(s) and not s[i + 1].isspace() and s[i + 1] != ';')):
                word.append(c)
                flags.add('brace_expansion')
                i += 1
                continue
            flush()
            op = next((o for o in ops if s.startswith(o, i)), c)
            ts.append(('op', op, False))
            i += len(op)
            continue
        if c in '*?[':
            flags.add('glob')
        word.append(c)
        i += 1
    flush()
    if q:
        flags.add('lexical_uncertainty')
    return ts, nested, flags


def git_kind(args):
    # Options that consume a value before the Git subcommand.
    i = 0
    while i < len(args):
        a = args[i]
        if a in ['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path']:
            i += 2
        elif a.startswith('-'):
            i += 1
        else:
            break
    sub = args[i] if i < len(args) else ''
    rest = args[i + 1:]
    if sub in ['push', 'fetch', 'pull', 'clone', 'ls-remote', 'send-email'] or (sub == 'submodule' and any(a in ['update', 'add'] for a in rest)):
        return 'D', sub
    if sub in ['status', 'log', 'diff', 'show', 'rev-parse', 'ls-files', 'ls-tree', 'cat-file', 'grep', 'describe', 'shortlog', 'blame', 'name-rev', 'merge-base', 'count-objects', 'check-ignore', 'check-attr', 'diff-files', 'diff-index', 'diff-tree', 'for-each-ref', 'verify-commit', 'verify-tag', 'version', 'help']:
        return 'A', sub
    if sub in ['branch', 'tag', 'remote', 'config', 'worktree', 'stash', 'reflog']:
        if sub == 'branch' and (not rest or all(x in ['-a', '-r', '--all', '--list', '-v', '-vv', '--show-current', '--no-color'] or x.startswith('--format=') for x in rest)):
            return 'A', sub
        if sub == 'tag' and (not rest or any(x in ['-l', '--list'] for x in rest)):
            return 'A', sub
        if sub == 'remote' and (not rest or rest[0] in ['-v', '--verbose', 'get-url', 'show']):
            return ('D' if rest and rest[0] == 'show' and '-n' not in rest else 'A'), sub
        if sub == 'config' and any(x in ['--get', '--get-all', '--get-regexp', '--list', '-l', '--get-urlmatch'] for x in rest):
            return 'A', sub
        if sub == 'worktree' and rest and rest[0] == 'list':
            return 'A', sub
        if sub == 'stash' and rest and rest[0] in ['list', 'show']:
            return 'A', sub
        if sub == 'reflog' and (not rest or rest[0] == 'show'):
            return 'A', sub
        return 'B', sub
    if sub in ['add', 'commit', 'checkout', 'switch', 'restore', 'reset', 'clean', 'merge', 'rebase', 'cherry-pick', 'revert', 'init', 'rm', 'mv', 'apply', 'am', 'update-index', 'update-ref', 'symbolic-ref', 'gc', 'prune', 'repack', 'bisect', 'format-patch', 'bundle', 'sparse-checkout']:
        return 'B', sub
    return ('A' if any(x in ['--version', '--help'] for x in args) else 'C'), sub


def classify(name, args):
    flags = set()
    kind = 'C'
    if name == 'git':
        kind, sub = git_kind(args)
        flags.add('git_' + kind)
        if kind == 'B':
            flags.add('git_write')
        if any(x.startswith('alias.') or x.startswith('core.hooksPath') or x.startswith('diff.external') for x in args) or '--ext-diff' in args:
            kind = 'C' if kind != 'D' else 'D'
            flags.add('helper_risk')
    elif name in NETWORK:
        kind = 'D'
    elif name in ['npm', 'pnpm', 'yarn', 'bun', 'pip', 'pipx', 'uv', 'gem', 'bundle', 'brew', 'apt', 'apt-get', 'rustup'] and any(x in ['install', 'i', 'ci', 'add', 'update', 'upgrade', 'fetch', 'download', 'sync', 'dlx', 'create'] for x in args):
        kind = 'D'
    elif name in ['cargo', 'go'] and any(x in ['fetch', 'install', 'get'] for x in args):
        kind = 'D'
    elif name in WRITE or name == 'cd':
        kind = 'B'
    elif name in READ:
        kind = 'A'
        if name == 'sed' and any(x.startswith('-i') or re.match(r'^-[A-Za-z]*i', x) or x.startswith('--in-place') for x in args):
            kind = 'B'
        elif name in ['sed', 'awk', 'gawk'] and any(re.search(r'(?:\bsystem\s*\(|\bgetline\b|(?:^|;)\s*e(?:\s|$))', x) for x in args):
            kind = 'C'
            flags.add('helper_risk')
        elif name in ['sed', 'awk', 'gawk'] and any(re.search(r'(?:^|[;{}\s])w\s|(?:print|printf)\b.*>|\br\s+[^;]+', x) for x in args):
            kind = 'B'
        elif name == 'find':
            if any(x in ['-exec', '-execdir', '-ok', '-okdir'] for x in args):
                kind = 'C'
                flags.add('helper_risk')
            elif any(x in ['-delete', '-fprint', '-fprintf', '-fls'] for x in args):
                kind = 'B'
        elif name == 'rg' and any(x in ['--pre', '-z', '--search-zip'] or x.startswith('--pre=') for x in args):
            kind = 'C'
            flags.add('helper_risk')
        elif name == 'sort' and any(x in ['-o', '--output'] or x.startswith('--output=') for x in args):
            kind = 'B'
    elif name in ['tar', 'gzip', 'bzip2', 'xz', 'zstd', 'openssl', 'base64', 'base32']:
        if name == 'tar':
            opts = ''.join(x.lstrip('-') for x in args[:2] if x.startswith('-') or re.fullmatch('[ctxvzjfJOp]+', x))
            kind = 'A' if 't' in opts and not any(x in opts for x in 'cx') else 'B'
        elif name in ['base64', 'base32'] or (name in ['gzip', 'bzip2', 'xz', 'zstd'] and any(x in ['-c', '--stdout', '-dc', '-cd'] for x in args)):
            kind = 'A'
        elif name == 'openssl':
            kind = 'C'
        else:
            kind = 'B'
    elif name in SHELL:
        kind = 'E'
    elif name in RUNTIME:
        kind = 'C'
    else:
        flags.add('unknown_executable')
    if name in ['node', 'python', 'ruby', 'perl', 'lua', 'micropython']:
        flags.add('runtime_script')
        joined = ' '.join(args)
        if re.search(r'child_process|\bsubprocess\b|\bos\.system\b|\bPopen\b|\bexecFile\b|\bspawn\s*\(', joined):
            flags.add('embedded_process')
        if re.search(r'\bfetch\s*\(|\bhttps?\.request\b|\brequests\.|\burllib\b|\bsocket\.', joined):
            kind = 'D'
            flags.add('embedded_network')
    return kind, flags


def parse_shell(s, depth=0):
    if depth > 12:
        return [], {'lexical_uncertainty', 'complex_shell'}
    s, heredocs, incomplete = strip_heredocs(s)
    ts, nested, flags = shell_lex(s)
    # A function definition's name is not a program invocation. Its body is
    # still counted syntactically once, with the command excluded as complex.
    remove = set()
    for j in range(len(ts) - 3):
        if ts[j][0] == 'word' and not ts[j][2] and [v[1] for v in ts[j + 1:j + 4]] == ['(', ')', '{']:
            remove.update([j, j + 1, j + 2])
            flags.add('control_flow')
    if remove:
        ts = [t for j, t in enumerate(ts) if j not in remove]
    if heredocs:
        flags.add('heredoc')
    if incomplete:
        flags.add('lexical_uncertainty')
    inv = []
    chunks = []
    cur = []
    write = False
    expect_redir = False
    for typ, value, quoted in ts + [('op', ';', False)]:
        if typ == 'op':
            if value in ['>', '>>', '>|', '<>', '>&', '&>', '&>>']:
                write = True
                expect_redir = True
                flags.add('write_redirect')
            elif value in ['<', '<<', '<<-', '<<<', '<&']:
                expect_redir = True
                if value in ['<<', '<<-', '<<<']:
                    flags.add('input_literal')
            else:
                if value in ['|', '|&']:
                    flags.add('pipeline')
                elif value in ['&&', '||']:
                    flags.add('conditional_chain')
                elif value == '&':
                    flags.add('background')
                elif value in ['(', ')', '{', '}']:
                    flags.add('group')
                if cur or write:
                    chunks.append((cur, write))
                cur = []
                write = False
                expect_redir = False
        else:
            if expect_redir:
                # >&2 and >/dev/null are FD routing; no scratch file needed.
                if write and (value in ['/dev/null', '/dev/stderr', '/dev/stdout'] or value.isdigit()):
                    write = False
                expect_redir = False
            else:
                cur.append((value, quoted))
    for words, writes in chunks:
        if not words:
            inv.append({'name': '<shell-redirection>', 'kind': 'B' if writes else 'E', 'flags': set()})
            continue
        vals = [w[0] for w in words]
        while vals and vals[0] in ['then', 'do', 'else', 'elif', 'if', '!']:
            flags.add('control_flow')
            vals.pop(0)
        if not vals:
            continue
        if vals[0] in ['for', 'while', 'until', 'case', 'select', 'function', 'repeat']:
            flags.add('control_flow')
            if vals[0] in ['while', 'until'] and len(vals) > 1:
                vals.pop(0)
            else:
                continue
        if vals[0] in ['fi', 'done', 'esac', 'in']:
            continue
        assignments = 0
        while vals and re.match(r'^[A-Za-z_][A-Za-z_0-9]*=', vals[0]):
            vals.pop(0)
            assignments += 1
        if assignments:
            flags.add('assignment')
        if not vals:
            inv.append({'name': '<shell-assignment>', 'kind': 'E', 'flags': set()})
            continue
        n = norm(vals[0])
        args = vals[1:]
        # Metadata/process wrappers do not turn their target into a filename.
        wrappers = []
        while n in ['env', 'sudo', 'doas', 'nice', 'nohup', 'time', 'timeout', 'stdbuf', 'caffeinate', 'command'] and args:
            wrappers.append(n)
            j = 0
            if n == 'timeout':
                while j < len(args) and args[j].startswith('-'):
                    j += 2 if args[j] in ['-k', '--kill-after', '-s', '--signal'] else 1
                j += 1
            else:
                while j < len(args):
                    a = args[j]
                    if a.startswith('-'):
                        j += 2 if a in ['-u', '-C', '--chdir', '--unset', '-n', '-o', '-e', '-i', '--user'] else 1
                    elif n == 'env' and re.match(r'^[A-Za-z_]\w*=', a):
                        j += 1
                    else:
                        break
            if j >= len(args):
                break
            n = norm(args[j])
            args = args[j + 1:]
        for w in wrappers:
            flags.add('wrapper_' + w)
            if w in ['env', 'command']:
                pass
            else:
                flags.add('process_wrapper')
        if n == 'busybox' and args and not args[0].startswith('-'):
            n, args = norm(args[0]), args[1:]
            flags.add('busybox_dispatch')
        if n in ['bash', 'sh', 'zsh', 'dash']:
            flags.add('shell_launcher')
            code = None
            for j, a in enumerate(args[:-1]):
                if a in ['-c', '-lc', '-ic', '-lic', '-cl']:
                    code = args[j + 1]
                    break
            if code is not None:
                child, ff = parse_shell(code, depth + 1)
                inv.extend(child)
                flags.update(ff)
                continue
            flags.add('opaque_shell_script')
        if n in ['export', 'unset', 'set', 'readonly', 'local', 'declare', 'typeset']:
            flags.add('shell_state')
        if '$' in n or '<substitution>' in n or '<arithmetic>' in n:
            kind, ff = 'E', {'dynamic_executable'}
            flags.add('dynamic_executable')
        else:
            kind, ff = classify(n, args)
        if writes:
            if kind == 'A':
                kind = 'B'
            ff.add('write_redirect')
        if n == 'cd':
            flags.add('cwd')
        if n in ['xargs', 'parallel']:
            flags.add('opaque_dispatch')
        # A bounded offline Node candidate is only a forecast, not certification.
        ff.add('node_candidate') if n == 'node' and kind == 'C' and 'embedded_process' not in ff else None
        inv.append({'name': n, 'kind': kind, 'flags': ff})
    for body in nested:
        child, ff = parse_shell(body, depth + 1)
        inv.extend(child)
        flags.update(ff)
    if any(i['kind'] == 'E' for i in inv) or flags & {'control_flow', 'variable', 'assignment', 'substitution', 'arithmetic', 'process_substitution', 'shell_state', 'shell_launcher'}:
        flags.add('E')
    if flags & {'control_flow', 'process_substitution', 'arithmetic', 'lexical_uncertainty', 'dynamic_executable', 'opaque_shell_script'}:
        flags.add('complex_shell')
    if len(inv) > 1:
        flags.add('compound')
    return inv, flags


def add_command(source, sid, project, call_id, text, timestamp, background=False, workdir=False):
    if not isinstance(text, str) or not text.strip():
        COUNTS[source + '_empty_command'] += 1
        return None
    key = (source, call_id, hashlib.sha256(text.encode()).digest())
    if key in CALLS:
        COUNTS[source + '_duplicate_commands'] += 1
        return CALLS[key]
    inv, flags = parse_shell(text)
    if workdir:
        flags.add('cwd_metadata')
    kinds = [i['kind'] for i in inv if i['kind'] != 'E']
    latent = max(kinds, key=RANK.get) if kinds else 'A'
    if not inv:
        flags.update(['E', 'complex_shell', 'empty_parse'])
    primary = 'E' if 'E' in flags else latent
    r = {'source': source, 'session': sid, 'project': project, 'start': timestamp,
         'end': None, 'duration': None, 'background': bool(background), 'inv': inv,
         'flags': flags, 'kind': primary, 'latent': latent, 'code': None,
         'call': call_id}
    CALLS[key] = r
    COMMANDS.append(r)
    return r


def numeric_duration(d):
    if not isinstance(d, dict):
        return None
    for key, scale in [('durationMs', .001), ('duration_ms', .001), ('durationSeconds', 1), ('duration_seconds', 1)]:
        n = d.get(key)
        if isinstance(n, (int, float)) and not isinstance(n, bool) and math.isfinite(n) and n >= 0:
            return n * scale
    return None


def result_objects(value):
    if isinstance(value, dict):
        if 'wall_time_seconds' in value and ('exit_code' in value or 'session_id' in value):
            yield value
        elif isinstance(value.get('result'), dict):
            yield from result_objects(value['result'])
    elif isinstance(value, list):
        for v in value:
            if isinstance(v, dict) and v.get('type') in ['text', 'input_text', 'output_text']:
                yield from result_objects(v.get('text'))
    elif isinstance(value, str):
        try:
            d = json.loads(value)
        except (ValueError, TypeError):
            # Tool output may prepend a label or surround JSON with a fence.
            # Admit only complete known metadata objects; never scan stdout.
            decoder = json.JSONDecoder()
            allowed = {'chunk_id', 'wall_time_seconds', 'exit_code', 'session_id',
                       'output', 'original_token_count', 'wall_time', 'stdout', 'stderr'}
            for match in re.finditer(r'\{(?=\s*"(?:chunk_id|wall_time_seconds|exit_code|session_id|output)"\s*:)', value):
                try:
                    obj, _ = decoder.raw_decode(value, match.start())
                except ValueError:
                    continue
                if isinstance(obj, dict) and 'wall_time_seconds' in obj and set(obj) <= allowed and ('exit_code' in obj or 'session_id' in obj):
                    yield obj
                    return
            return
        yield from result_objects(d)


def ingest():
    for source, root in [('claude', Path.home() / '.claude/projects'), ('codex', Path.home() / '.codex/sessions')]:
        for p in sorted(root.rglob('*.jsonl')) if root.exists() else []:
            FILES[source] += 1
            FILES[source + '_bytes'] += p.stat().st_size
            sid = (source, str(p.relative_to(root)))
            project = p.relative_to(root).parts[0] if source == 'claude' else '<unknown>'
            meta_cwd = None
            local_calls = {}
            pending = {}
            files_records = 0
            with p.open(errors='replace') as f:
                for line in f:
                    try:
                        x = json.loads(line)
                    except (ValueError, TypeError):
                        COUNTS[source + '_invalid_lines'] += 1
                        continue
                    if not isinstance(x, dict):
                        COUNTS[source + '_invalid_objects'] += 1
                        continue
                    files_records += 1
                    t = stamp(x.get('timestamp'))
                    if source == 'claude':
                        m = x.get('message', {})
                        if not isinstance(m, dict):
                            continue
                        blocks = m.get('content', [])
                        if not isinstance(blocks, list):
                            continue
                        for b in blocks:
                            if not isinstance(b, dict):
                                continue
                            if x.get('type') == 'assistant' and b.get('type') == 'tool_use' and b.get('name') == 'Bash':
                                a = b.get('input', {})
                                if isinstance(a, dict):
                                    r = add_command(source, sid, project, b.get('id'), a.get('command'), t, a.get('run_in_background'))
                                    if r is not None:
                                        local_calls[b.get('id')] = r
                            elif b.get('type') == 'tool_result':
                                r = local_calls.get(b.get('tool_use_id'))
                                if r is not None:
                                    if t is not None and (r['end'] is None or t < r['end']):
                                        r['end'] = t
                                    d = numeric_duration(x.get('toolUseResult'))
                                    if d is not None:
                                        r['duration'] = d
                                    tr = x.get('toolUseResult', {})
                                    if isinstance(tr, dict):
                                        if tr.get('backgroundTaskId'):
                                            r['background'] = True
                                        for k in ['exitCode', 'exit_code', 'returnCode']:
                                            if isinstance(tr.get(k), int):
                                                r['code'] = tr[k]
                    else:
                        z = x.get('payload', {})
                        if not isinstance(z, dict):
                            continue
                        if x.get('type') in ['session_meta', 'turn_context'] and isinstance(z.get('cwd'), str):
                            meta_cwd = z['cwd']
                            project = meta_cwd
                        typ = z.get('type')
                        if typ in ['function_call', 'custom_tool_call']:
                            name = z.get('name', '')
                            inp = z.get('arguments') if typ == 'function_call' else z.get('input')
                            ops = []
                            if name in ['exec', 'functions.exec', 'mcp__functions__exec'] and isinstance(inp, str):
                                ops = js_exec(inp)
                                COUNTS['codex_wrapper_calls'] += 1
                            elif name.split('.')[-1] in ['exec_command', 'shell_command', 'shell', 'write_stdin']:
                                try:
                                    a = json.loads(inp) if isinstance(inp, str) else inp
                                except ValueError:
                                    a = None
                                if isinstance(a, dict):
                                    if name.endswith('write_stdin'):
                                        ops = [('poll', a)]
                                    else:
                                        if isinstance(a.get('command'), list):
                                            COUNTS['codex_argv_calls_unparsed'] += 1
                                        else:
                                            ops = [('command', a)]
                            records = []
                            for j, (op, a) in enumerate(ops):
                                if op == 'command':
                                    r = add_command(source, sid, project, str(z.get('call_id')) + ':' + str(j), a.get('cmd', a.get('command')), t, False, 'workdir' in a or 'cwd' in a)
                                    records.append((op, r))
                                elif op == 'poll':
                                    session_id = a.get('session_id')
                                    r = pending.get(str(int(session_id)) if isinstance(session_id, (int, float)) else str(session_id))
                                    records.append((op, r))
                                    COUNTS['codex_poll_calls'] += 1
                                    if a.get('chars'):
                                        COUNTS['codex_nonempty_stdin_calls'] += 1
                                else:
                                    records.append((op, None))
                            if records:
                                local_calls[z.get('call_id')] = records
                        elif typ in ['function_call_output', 'custom_tool_call_output']:
                            records = local_calls.get(z.get('call_id'), [])
                            objects = list(result_objects(z.get('output')))
                            eligible = [(op, r) for op, r in records if op in ['command', 'poll', 'unknown']]
                            # Pair only if order/cardinality are unambiguous.
                            if objects and len(objects) != len(eligible):
                                COUNTS['codex_ambiguous_result_wrappers'] += 1
                            elif objects:
                                for (op, r), o in zip(eligible, objects):
                                    if r is None:
                                        continue
                                    if op == 'command':
                                        r['end'] = t
                                        if isinstance(o.get('exit_code'), int) and not o.get('session_id'):
                                            d = o.get('wall_time_seconds')
                                            if isinstance(d, (int, float)) and d >= 0:
                                                r['duration'] = d
                                            r['code'] = o['exit_code']
                                        if o.get('session_id') is not None:
                                            r['background'] = True
                                            pending[str(o['session_id'])] = r
                                    elif op == 'poll':
                                        if isinstance(o.get('exit_code'), int):
                                            r['end'] = t
                                            r['code'] = o['exit_code']
                                            r['poll_completed'] = True
                            elif records:
                                for op, r in records:
                                    if op == 'command' and r is not None and len(records) == 1:
                                        r['end'] = t
            if files_records:
                FILES[source + '_parseable_files'] += 1
            COUNTS[source + '_json_records'] += files_records
    # The first stored call owns a de-duplicated invocation and its trace session.
    for r in COMMANDS:
        SESSIONS.setdefault(r['session'], []).append(r)


def pct(n, d):
    return f'{100*n/d:.2f}%' if d else 'n/a'


def fmt(n):
    return f'{n:,.0f}'


def quantile(v, p):
    if not v:
        return 0
    a = sorted(v)
    at = (len(a)-1)*p
    lo = int(at)
    return a[lo] + (a[min(lo+1, len(a)-1)]-a[lo])*(at-lo)


def table(headers, rows):
    return '\n'.join(['| ' + ' | '.join(map(str, headers)) + ' |', '| ' + ' | '.join('---' for _ in headers) + ' |'] + ['| ' + ' | '.join(map(str, r)) + ' |' for r in rows])


def route(r, stage, include_complex=False, host_cwd=False):
    f = r['flags']
    if not include_complex and f & {'complex_shell', 'opaque_shell_script', 'process_wrapper', 'background', 'opaque_dispatch'}:
        return False
    if r['background']:
        return False
    if not r['inv']:
        return False
    for i in r['inv']:
        k = i['kind']
        if k == 'D':
            return False
        if k == 'E':
            if i['name'] == '<shell-assignment>' or i['name'] in ['export', 'unset', 'set', 'readonly', 'local', 'declare', 'typeset']:
                continue
            return False
        if k == 'B' and stage < 1 and not (host_cwd and i['name'] == 'cd' and 'write_redirect' not in i['flags']):
            return False
        if k == 'C' and not (stage >= 2 and 'node_candidate' in i['flags']):
            return False
    return True


def proven_profile(r):
    # Strict stand-alone invocation NAME matches a demonstrated profile family.
    # Arguments are not certified here: a family upper bound, not run success.
    if r['kind'] != 'A' or len(r['inv']) != 1 or r['flags'] & {'pipeline', 'group', 'E', 'background', 'heredoc', 'process_wrapper'} or r['background']:
        return False
    return r['inv'][0]['name'] in ['jq', 'sed', 'awk', 'grep', 'sort', 'wc', 'tar']


def profile(records):
    valid = [r for r in records if r['start'] is not None]
    valid.sort(key=lambda r: r['start'])
    if not valid:
        return None
    start = valid[0]['start']
    ends = [max(r['start'], r['end']) if r['end'] is not None else r['start'] for r in valid]
    end = max(ends)
    span = max(0, end-start)
    intervals = []
    # Only synchronous call→result intervals; async completion handled separately.
    for r in valid:
        if r['end'] is not None and r['end'] >= r['start'] and not r['background']:
            intervals.append((r['start'], r['end']))
    intervals.sort()
    active = 0
    right = start
    gaps = []
    for a, b in intervals:
        if a > right:
            gaps.append(a-right)
        active += max(0, b-max(a, right))
        right = max(right, b)
    if end > right:
        gaps.append(end-right)
    start_gaps = [valid[i+1]['start']-valid[i]['start'] for i in range(len(valid)-1)]
    return {'n': len(records), 'span': span, 'active': active, 'gaps': gaps,
            'start_gaps': start_gaps, 'known': len(intervals), 'async': sum(r['background'] for r in valid)}


def self_check():
    cases = [
        ('cat a | head -n 4', ['cat', 'head'], 'A'),
        ('cd /work && rg x .', ['cd', 'rg'], 'B'),
        ('cat <<\'EOF\' > x\nnode hidden\nEOF\nwc -l x', ['cat', 'wc'], 'B'),
        ('echo "$(git status --short)"', ['echo', 'git'], 'E'),
        ("python3 - <<'PY'\nprint('git push')\nPY", ['python'], 'C'),
        ('for x in a b; do cat "$x"; done', ['cat'], 'E'),
        ('git -C /work diff --stat && git push', ['git', 'git'], 'D'),
        ('sed -i.bak s/a/b/ x', ['sed'], 'B'),
        ("sh -c 'cat a; wc -l a'", ['cat', 'wc'], 'E'),
        ('env X=y timeout 10 node -e "1"', ['node'], 'C'),
        ('cat a 2>/dev/null', ['cat'], 'A'),
        ('printf x > out', ['printf'], 'B'),
        ('f() { cat a; }; f', ['cat', 'f'], 'E'),
    ]
    for s, expected, kind in cases:
        inv, f = parse_shell(s)
        actual = 'E' if 'E' in f else max([i['kind'] for i in inv], key=RANK.get)
        assert [i['name'] for i in inv] == expected, (expected, [i['name'] for i in inv])
        assert actual == kind, (expected, actual, kind)
    assert js_exec('text(await tools.exec_command({cmd:"cat a",max_output_tokens:3}));')[0][1]['cmd'] == 'cat a'
    assert js_exec('await tools.exec_command({cmd:`cat ${x}`})')[0][0] == 'unknown'


def report():
    n = len(COMMANDS)
    inv = [i for r in COMMANDS for i in r['inv']]
    ni = len(inv)
    cats = co.Counter(r['kind'] for r in COMMANDS)
    icats = co.Counter(i['kind'] for i in inv)
    programs = co.Counter(safe_name(i['name']) for i in inv)
    specific = co.Counter(i['name'] for i in inv if i['name'] in SAFE)
    flags = co.Counter(f for r in COMMANDS for f in r['flags'])
    measured = [r for r in COMMANDS if r['duration'] is not None]
    seconds = sum(r['duration'] for r in measured)
    cat_time = co.Counter()
    cat_timed_n = co.Counter()
    for r in measured:
        cat_time[r['kind']] += r['duration']
        cat_timed_n[r['kind']] += 1
    profiles = [p for v in SESSIONS.values() if (p := profile(v))]
    spans = [p['span'] for p in profiles]
    ns = [p['n'] for p in profiles]
    gaps = [g for p in profiles for g in p['gaps']]
    startgaps = [g for p in profiles for g in p['start_gaps']]
    active = sum(p['active'] for p in profiles)
    span = sum(spans)
    idle = max(0, span-active)
    complete_sessions = [p for p in profiles if p['known'] == p['n'] and not p['async'] and p['n'] >= 2]
    cs_span = sum(p['span'] for p in complete_sessions)
    cs_active = sum(p['active'] for p in complete_sessions)
    low = [sum(route(r, stage) for r in COMMANDS) for stage in range(3)]
    upper = [sum(route(r, stage, True) for r in COMMANDS) for stage in range(3)]
    cwd_only = sum(route(r, 0, host_cwd=True) for r in COMMANDS)
    times = [r['start'] for r in COMMANDS if r['start'] is not None]
    d0, d1 = [dt.datetime.fromtimestamp(x, dt.timezone.utc).strftime('%Y-%m-%d') for x in [min(times), max(times)]]
    lines = ['# Agent shell command census', '',
        'Offline local census. Transcript arguments, command text, output, project identities and session identities are deliberately absent. All figures below are aggregates; displayed commands are generic program/flag shapes.', '',
        '## Headline numbers', '',
        f'- **{fmt(n)} unique submitted shell commands; {fmt(ni)} syntactic invocations; {fmt(len(SESSIONS))} command-bearing trace sessions.**',
        f'- **{fmt(FILES["claude"])} Claude and {fmt(FILES["codex"])} Codex JSONL files** scanned ({(FILES["claude_bytes"]+FILES["codex_bytes"])/1e9:.2f} GB); command date range **{d0}–{d1} UTC**.',
        f'- Primary command mix: **A {pct(cats["A"],n)}, B {pct(cats["B"],n)}, C {pct(cats["C"],n)}, D {pct(cats["D"],n)}, E {pct(cats["E"],n)}**; E is an exclusive shell-syntax bucket with underlying needs recorded separately.',
        f'- With host orchestration and compatible static tools, current read-only *potential* is **{pct(low[0],n)}** (**{pct(cwd_only,n)}** if host-resolved `cd` is allowed); Stage 1 **{pct(low[1],n)}**; eventual bounded offline Node at Stage 2 **{pct(low[2],n)}**. These are command-count routing scenarios, not measured execution success.',
        f'- The native census proves **9 narrow profiles**, not general read-only CLI compatibility; {fmt(sum(proven_profile(r) for r in COMMANDS))} commands ({pct(sum(proven_profile(r) for r in COMMANDS),n)}) fall in standalone read-only families containing demonstrated profiles, still requiring argument/artifact qualification.',
        f'- **{fmt(len(measured))} commands ({pct(len(measured),n)})** have unambiguous numeric synchronous tool-wall durations, totaling **{seconds/3600:.2f} hours**; population time shares remain unknown.',
        f'- Median commands/session **{quantile(ns,.5):.0f}**, p90 **{quantile(ns,.9):.1f}**; median shell observation span **{quantile(spans,.5)/60:.2f} min**, p90 **{quantile(spans,.9)/60:.2f} min**.',
        f'- In {fmt(len(complete_sessions))} fully paired synchronous sessions with ≥2 commands, shell-call envelopes occupy **{pct(cs_active,cs_span)}** of observed session span; residual **{pct(cs_span-cs_active,cs_span)}** is non-shell time, not a direct measure of model thinking.',
        f'- **{fmt(flags["compound"])} commands ({pct(flags["compound"],n)})** contain multiple parsed invocations; **{fmt(flags["complex_shell"])} ({pct(flags["complex_shell"],n)})** contain complex/uncertain shell syntax.',
        '- One user’s development-heavy history; no builds, VM launches, transcript commands, network operations or external services were run for this census.', '',
        '## Method', '',
        'The standard-library analysis script streams all recursively discoverable JSONL files from the two requested local transcript stores, including nested agent traces when present. It accepts assistant Claude `Bash` tool-use blocks and Codex shell/exec calls. Codex JavaScript wrappers are lexed, never evaluated: literal `tools.exec_command`/shell argument objects and simple literal variable bindings are extracted; computed strings, dynamic templates and opaque objects are counted as unparsed. Poll calls are linked where their session IDs and result objects are unambiguous, but are not counted as new shell commands. Typed stdin is counted separately and is not interpreted as another command.', '',
        'A command is one extracted shell submission; an invocation is one syntactic simple command, including a few explicitly labeled shell-only actions. Thus a loop body is counted once, not once per iteration, and an invocation is not a measured process launch. Quote-aware tokenization splits pipes, conditionals, separators, groups, redirections, substitutions and literal shell-launcher bodies. Heredoc bodies are removed before tokenization, so embedded Python/JS/source text is not miscounted as shell programs. Executable paths are reduced to basenames, Python/pip/node versions are normalized, common wrappers are peeled, and BusyBox applets are attributed to applet names. Wrapper requirements remain flags. No transcript executable outside a fixed public-tool allowlist is displayed; private/custom executables share an aggregate bucket.', '',
        'Duplicate copied tool calls are removed globally by source + tool-call ID + command hash. A retained call belongs to the first trace encountered; this prevents fork/replay inflation but can move copied work between session profiles. Session means a command-bearing trace file, not a human workday; sessions with no extracted shell commands are counted only in scan coverage. Claude project groups use the transcript directory key; Codex groups use recorded cwd, separately, without attempting identity reconciliation or exposing names.', '',
        'Primary command labels are exclusive: E takes precedence if shell state/expansion/control logic is present; otherwise D > C > B > A across invocations. Invocation labels use the same capability meanings. Output redirection upgrades read-only work to B except descriptor routing and the null device. Static environment prefixes and cwd are tracked. Read-only Git subcommands are A by intent, mutations B, transport D; hooks, aliases, helpers, indexing, subprocesses and configuration remain compatibility risks. Unknown/custom executables default to C. A and B are resource-intent categories, not size, safety or existing-kernel support certifications.', '',
        'Runtime names remain C even for short/version invocations, as requested. Installs/transports and recognizable inline network APIs become D; scripts can still hide network and child processes. General Python, package runners, builds, test runners, compilers, containers and external script files are never assumed to fit Stage 2 merely because Node/threads arrive. Read-only tools may have writable caches or threading in their actual distribution builds.', '',
        'Reproduce with the generic shape `python <analysis-script>`; it performs only local reads and exclusive creation of the requested report. It refuses to overwrite an existing report. Sources for kernel feasibility: [jitk README](../../jitk/README.md), [GrowOS→Node synthesis](../growos-node/SUMMARY.md), and [native census](../native-census/RESULTS.md).', '',
        '## Tables', '', '### Corpus and coverage', '',
        table(['Source','Files scanned','Parseable files','Command-bearing sessions','Unique commands','Share','Duplicate copied commands removed','Project/cwd groups'], [
            [src,fmt(FILES[src]),fmt(FILES[src+'_parseable_files']),fmt(sum(s[0]==src for s in SESSIONS)),fmt(sum(r['source']==src for r in COMMANDS)),pct(sum(r['source']==src for r in COMMANDS),n),fmt(COUNTS[src+'_duplicate_commands']),fmt(len({r['project'] for r in COMMANDS if r['source']==src}))]
            for src in ['claude','codex']]), '',
        'Project identities are withheld uniformly. Counts below rank anonymous groups within each source; cwd/worktree differences can represent one actual project, and the two sources must not be added as unique projects.', '',
        table(['Source','Project/cwd groups','Largest group: commands / share within source','Top 5 groups: commands / share','Singleton-command groups'], [
            (lambda values,src,total: [src,fmt(len(values)),f'{fmt(max(values,default=0))} / {pct(max(values,default=0),total)}',f'{fmt(sum(sorted(values,reverse=True)[:5]))} / {pct(sum(sorted(values,reverse=True)[:5]),total)}',fmt(sum(x==1 for x in values))])(
                list(co.Counter(r['project'] for r in COMMANDS if r['source']==src).values()),src,sum(r['source']==src for r in COMMANDS)) for src in ['claude','codex']]), '',
        'Largest anonymous project/cwd groups, ranked separately within each source. Rank is only a local count label and carries no cross-source identity.', '',
        table(['Source','Anonymous group rank','Commands','Share within source','Command-bearing trace sessions'], [
            [src,j,fmt(count),pct(count,sum(r['source']==src for r in COMMANDS)),fmt(len({r['session'] for r in COMMANDS if r['source']==src and r['project']==project}))]
            for src in ['claude','codex']
            for j,(project,count) in enumerate(co.Counter(r['project'] for r in COMMANDS if r['source']==src).most_common(20),1)]), '',
        table(['Extraction/quality item','Count'], [
            ['Malformed JSON lines',fmt(COUNTS['claude_invalid_lines']+COUNTS['codex_invalid_lines'])],
            ['Codex wrapper calls inspected',fmt(COUNTS['codex_wrapper_calls'])],
            ['Codex literal shell calls extracted',fmt(JS_STATS['literal_shell_calls'])],
            ['Codex nonliteral shell command expressions (not in denominator)',fmt(JS_STATS['nonliteral_command'])],
            ['Codex nonliteral tool argument objects (not in denominator)',fmt(JS_STATS['nonliteral_object'])],
            ['Codex argv-array calls not extracted',fmt(COUNTS['codex_argv_calls_unparsed'])],
            ['Codex polling calls (not new commands)',fmt(COUNTS['codex_poll_calls'])],
            ['Codex nonempty stdin writes (not new commands)',fmt(COUNTS['codex_nonempty_stdin_calls'])],
            ['Codex result wrappers with ambiguous pairing',fmt(COUNTS['codex_ambiguous_result_wrappers'])],
            ['Lexical-uncertainty commands',fmt(flags['lexical_uncertainty'])],
            ['Commands with no parsed invocation',fmt(flags['empty_parse'])],
            ['Invocations of unknown/custom executables',fmt(sum('unknown_executable' in i['flags'] for i in inv))],
            ['Commands explicitly backgrounded / yielded',fmt(sum(r['background'] for r in COMMANDS))],
        ]), '',
        '### Exclusive classification', '',
        table(['Class','Intent','Commands','Command share','Invocations','Invocation share','Timed commands','Observed timed hours','Share of observed timed wall'], [
            [k,desc,fmt(cats[k]),pct(cats[k],n),fmt(icats[k]),pct(icats[k],ni),fmt(cat_timed_n[k]),f'{cat_time[k]/3600:.3f}',pct(cat_time[k],seconds)] for k,desc in [('A','Read-only files / inspection'),('B','Writes / cwd'),('C','Processes / runtime / unknown'),('D','Network / transport / install'),('E','Shell state / expansion / control')]]), '',
        'E is not independent of A–D. The following disjoint decomposition shows the highest underlying non-shell requirement for E commands. A shell-only assignment has an A underlying requirement but still needs host shell semantics.', '',
        table(['E underlying requirement','Commands','Share of E'], [[k,fmt(sum(r['kind']=='E' and r['latent']==k for r in COMMANDS)),pct(sum(r['kind']=='E' and r['latent']==k for r in COMMANDS),cats['E'])] for k in 'ABCD']), '',
        '### Overlapping shell and routing features', '',
        table(['Feature','Commands','Share'], [[label,fmt(flags[f]),pct(flags[f],n)] for f,label in [('pipeline','Pipelines'),('conditional_chain','&& / || chains'),('group','Groups / subshell syntax'),('heredoc','Heredocs'),('assignment','Assignment prefix / assignment action'),('variable','Variable expansion'),('substitution','Command substitution'),('control_flow','Loops / branches / functions'),('process_substitution','Process substitution'),('glob','Globbing'),('cwd','Explicit cd'),('cwd_metadata','Codex cwd/workdir metadata'),('write_redirect','Output / read-write redirection'),('opaque_shell_script','Opaque shell script launcher'),('process_wrapper','Process-control / privilege wrapper'),('complex_shell','Complex / uncertain shell')]]), '',
        'The host can implement literal argv/env/cwd, ordered lists, `&&`/`||` short-circuiting, exit propagation and bounded byte pipelines without guest fork/exec. Pipelines need streaming/backpressure or bounded spooling with equivalent status/EOF behavior. Variables and command substitutions need an actual expansion interpreter; loops/functions, globbing, process substitutions, traps, interactive jobs and opaque scripts are progressively harder. Executing an untrusted script in a privileged host shell is not the proposed solution. Host orchestration means a reviewed parser/interpreter driving isolated tool invocations; Stage 1 mutations additionally need transactional shared run state and explicit commit/reset semantics.', '',
        '### Routing scenarios by complete submitted command', '',
        table(['Scenario','Conservative syntax subset: commands / share','Broader shell interpreter: commands / share','Timed subset: eligible wall share'], [
            [label,f'{fmt(low[j])} / {pct(low[j],n)}',f'{fmt(upper[j])} / {pct(upper[j],n)}',pct(sum(r['duration'] for r in measured if route(r,j)),seconds)] for j,label in [(0,'Read-only potential on current capability class'),(1,'Stage 1 + writes/cwd, compatible tool artifacts'),(2,'Stage 2 + bounded offline Node, compatible artifacts')]]), '',
        'Conservative scenarios reject complex/uncertain shell logic, opaque scripts, nontrivial process wrappers, shell background jobs, yielded commands and opaque dispatch. They allow simple variables/assignments/substitutions only as host-interpreter work and require every parsed underlying invocation to fit. Broader scenarios additionally assume host support for complex shell syntax but still reject opaque E invocations, C/D dependencies and yielded jobs; this is sensitivity analysis, not an implementable upper guarantee. Stage 2 admits only direct Node invocations without recognizable child-process/network use; unknown script behavior makes even that increment conditional. Cwd supplied as tool metadata is assumed to be host-resolved to admitted paths for the read-only scenario; explicit `cd` is B.', '',
        f'**Cwd sensitivity:** resolving explicit `cd` as host metadata, without adding file writes, makes **{fmt(cwd_only)} commands ({pct(cwd_only,n)})** read-only routing candidates. This accounts for **{(cwd_only-low[0])*100/n:.2f} percentage points** of the nominal Stage 1 uplift. The remaining Stage 1 increment is **{(low[1]-cwd_only)*100/n:.2f} points** under that assumption. Threads/signals alone do not justify a higher command-share claim; the forecast Node increment is **{(low[2]-low[1])*100/n:.2f} points** and assumes eventual offline Node compatibility.', '',
        f'Invocation-level A potential is **{pct(icats["A"],ni)}**; A+B is **{pct(icats["A"]+icats["B"],ni)}**. Those larger shares are opportunities to split mixed commands, not shares of whole shell calls that can be moved unchanged. Command wall time cannot defensibly be divided among pipeline stages without process-level telemetry.', '',
        '## Top programs', '',
        'Top 50 allowlisted public program names by syntactic invocation count. Wrapper names are peeled rather than double-counted; shell launchers with literal bodies are represented by their children. Private/custom executable names are never printed. Class columns show argument-sensitive invocation counts.', '',
        table(['Rank','Program','Invocations','Share of all invocations','A','B','C','D','E'], [[j,name,fmt(count),pct(count,ni),*[fmt(sum(i['name']==name and i['kind']==k for i in inv)) for k in 'ABCDE']] for j,(name,count) in enumerate(specific.most_common(50),1)]), '',
        f'The suppressed executable/shell-action aggregate contains **{fmt(programs["<other executable>"])} invocations ({pct(programs["<other executable>"],ni)})**. Its count is separate from the top 50 public programs; no private filename is promoted into a tool label.', '',
        '## Session profile', '',
        'Shell observation length is the first extracted shell-call timestamp to the latest paired result or call in the same trace, not the full conversation lifetime. Adjacent start gaps include command execution and are not thinking time. Non-shell gaps are the complement of the union of synchronous call→result envelopes, avoiding double-counting overlapping parallel commands. Those gaps can contain model reasoning, user absence, non-shell tool work, orchestration, disconnected periods and missing data.', '',
        table(['Metric','N','p10','p50','p90','p99'], [
            [name,fmt(len(v)),*[f'{quantile(v,q)/scale:.2f}' for q in [.1,.5,.9,.99]]] for name,v,scale in [('Commands per command-bearing session',ns,1),('Shell observation span (minutes)',spans,60),('Adjacent command-start gap (seconds)',startgaps,1),('Observed non-shell gap (seconds)',gaps,1),('Numeric synchronous command wall (seconds)',[r['duration'] for r in measured],1)]]), '',
        table(['Session cohort','Sessions','Observed span (hours)','Shell envelope (hours)','Residual non-shell share'], [
            ['All timestamped sessions (incomplete pairing can inflate residual)',fmt(len(profiles)),f'{span/3600:.2f}',f'{active/3600:.2f}',pct(idle,span)],
            ['Fully paired, synchronous, ≥2 commands',fmt(len(complete_sessions)),f'{cs_span/3600:.2f}',f'{cs_active/3600:.2f}',pct(cs_span-cs_active,cs_span)],
        ]), '',
        table(['Source','Sessions','Median commands','p90 commands','Median span (min)','Complete paired synchronous sessions'], [
            (lambda vv,src: [src,fmt(len(vv)),f'{quantile([x["n"] for x in vv],.5):.1f}',f'{quantile([x["n"] for x in vv],.9):.1f}',f'{quantile([x["span"] for x in vv],.5)/60:.2f}',fmt(sum(x['known']==x['n'] and not x['async'] and x['n']>=2 for x in vv))])([p for s,v in SESSIONS.items() if s[0]==src and (p:=profile(v))],src) for src in ['claude','codex']]), '',
        '### Idle-gap sensitivity', '',
        'Charging every long pause to a session VM exaggerates what an idle timeout would actually pay. This table caps each individual non-shell gap; shell envelopes stay charged. It is an occupancy sensitivity model over fully paired synchronous sessions, not a billing reconstruction.', '',
        table(['Maximum charged non-shell gap','Charged residual (hours)','Residual share of charged residency','Residency / shell-envelope ratio'], [
            (lambda residual,label: [label,f'{residual/3600:.2f}',pct(residual,cs_active+residual),f'{(cs_active+residual)/cs_active:.2f}×' if cs_active else 'n/a'])(sum(min(g,cap) for p in complete_sessions for g in p['gaps']),label) for cap,label in [(30,'30 seconds'),(60,'60 seconds'),(300,'5 minutes'),(1800,'30 minutes'),(float('inf'),'No idle timeout')]]), '',
        '### Timing coverage and interpretation', '',
        table(['Source','Numeric timed commands','Coverage within source','Numeric timed hours','Non-background paired call→result commands'], [[src,fmt(sum(r['source']==src for r in measured)),pct(sum(r['source']==src for r in measured),sum(r['source']==src for r in COMMANDS)),f'{sum(r["duration"] for r in measured if r["source"]==src)/3600:.3f}',fmt(sum(r['source']==src and r['start'] is not None and r['end'] is not None and r['end']>=r['start'] and not r['background'] for r in COMMANDS))] for src in ['claude','codex']]), '',
        'Numeric time is a completed synchronous tool’s reported wall time, not CPU time or measured guest execution. Yielded tool waits/polls are excluded from numeric shares: a poll wall time is a wait segment and cannot be treated as total process runtime. This preferentially removes long-running commands, so the observed time shares are especially unsuitable as population compute shares. Claude’s paired timestamps supply shell-call envelopes when numeric durations are absent; those envelopes include harness/queue delays and are not silently substituted for measured durations. Result pairing is accepted only for equal-count, ordered shell/poll/result objects; ambiguous wrappers retain count classification but lose numeric timing. Successful/failing exit statuses do not change a command’s intent category.', '',
        '## Implications', '',
        f'**The actionable count target is {pct(low[0],n)} read-only routing potential, expanding to {pct(low[1],n)} with Stage 1 and {pct(low[2],n)} with conditional offline Node. None is a claim that those commands run in today’s µs VM.** The existing native evidence has nine tiny passing profiles (musl jq; Lua; MicroPython; BusyBox sed/awk/grep/sort/wc/tar-list). It explicitly leaves general Git, ripgrep, SQLite, binary/Unicode streams, stderr/exit transport, arbitrary paths, writable files, threads and larger ELF loading unproven or unsupported. Most top read-only tools therefore require artifact qualification and syscall/transport work before admission. Literal unchanged whole-shell success today cannot be estimated from program names alone; no transcript commands were replayed.', '',
        '### Ten tool priorities', '',
        'Priorities combine observed frequency with the native census’s cost/risk evidence. Each needs a pinned static aarch64 artifact, semantic/negative/reset tests and an explicit argument/resource profile. Counts below are total observed invocations, not qualified eligible traffic.', '',
        table(['Priority','Tool / shape','Observed invocations','Initial support contract / reason'], [[j,name,fmt(specific[name]),why] for j,(name,why) in enumerate([
            ('rg','`rg --no-config --no-ignore --no-mmap -j1`: search leverage; grow ELF layout, metadata, signals and memory protection first.'),
            ('sed','`sed -n`: BusyBox read-only stream baseline; separate in-place writes for Stage 1.'),
            ('cat','`cat`: bounded file/byte reads; simple artifact qualification, useful for host-fed streams.'),
            ('git','`git status/log/diff/show`: high-value but isolated read-only profiles; disable hooks/helpers/pagers/config surprises; full Git stays Linux.'),
            ('ls','`ls`: bounded directory metadata/enumeration; qualify BusyBox/static build and deterministic flag support.'),
            ('head','`head -n`: bounded prefix reads and byte-stream behavior; qualify static applet.'),
            ('grep','`grep -n`: already demonstrated BusyBox family; preserve exact regex/flag differences.'),
            ('find','`find`: read-only predicates first; exclude `-exec`/`-delete` and external helpers.'),
            ('wc','`wc -l`: already demonstrated BusyBox profile, tiny composition building block.'),
            ('jq','`jq`: demonstrated unchanged musl profile; richer JSON operations, with bytes/errors/entropy work.'),
        ],1)]), '',
        'BusyBox is one shared implementation opportunity, not independent kernel work per applet. Add immutable SQLite after `fstat`/`pread64` even if it is outside the top ten by current usage; Stage 1’s structured-data product can create new usage absent from this history. `sort`/`awk` are cheap supplementary existing-profile candidates. Stage 1 file mutations are not automatically cheap Git support: `git add/commit` can require locks, atomic rename, config, hooks, signing and subprocesses.', '',
        '### Economics of one VM per command', '',
        'Let N be shell commands, p the fraction routed to the small tier, s admission+restore+reset+filesystem/transport overhead per admitted command, r its execution time, M unique memory, and T the session residency a competing VM charges. Small-tier memory-time is approximately `N × p × M × (r+s)` plus warm pool/snapshot/cache overhead; a session VM costs `M_session × T` plus work. CPU, host orchestration, shared page cache, workspace synchronization, storage writes and fallback capacity must also be charged. The fractions above estimate p by count; the timed column estimates a biased observed slice, not total compute savings.', '',
        f'For the fully paired synchronous cohort, keeping a VM resident through every recorded pause yields a **{cs_span/cs_active if cs_active else 0:.2f}×** residency-to-shell-envelope ratio at equal memory. The capped-gap table shows how rapidly suspend/idle-timeout policy reduces that apparent advantage. A warm snapshot pool or suspended session with near-zero charged resources changes the comparison; one-per-command still pays N restores, parsing and mounts.', '',
        'Illustrative overhead assumptions, not measurements: 100 µs of extra lifecycle overhead is 0.1% of a 100 ms tool and 10% of a 1 ms tool; 1 ms overhead is 1% and 100% respectively. For a 10-invocation compound, host splitting can multiply lifecycle admissions by ten. Prefer bounded compound execution plans and shared read-only mappings, and measure total result latency/dirty pages/private MiB on real eligible tools. The kernel’s initialized-JavaScript µs reset figures must not be reused as native CLI cold-start measurements.', '',
        'The strongest supported thesis is a cheap disposable inspection/write tier alongside a full Linux fallback, with host-owned session state and explicit mutation commit semantics. The current count coverage does not justify replacing Linux build/test/network workloads or funding broad Node compatibility by itself. Stage 2 threads/futex/signals do not supply fork/exec, dynamic loading, npm’s subprocess graph, networking or all Node/V8 memory semantics. Any broader Stage 2 command-share claim needs additional gates and replay evidence.', '',
        '## Limitations', '',
        '- One user’s sessions are a convenience sample with correlated projects, assistants, worktrees, forks and historical tool habits; no population-level market inference or confidence interval is justified.',
        '- This is a lightweight lexical census, not a full Bash/zsh grammar or symbolic execution engine. Shell quoting, nested expansion, shell options, aliases, functions, unusual heredocs, arrays, arithmetic and language embedding can be ambiguous. Complex/uncertain cases are excluded from conservative routing. Invocation counts are syntactic; actual loop iterations/children are unknown.',
        '- Flags/known subcommands establish resource intent imperfectly. Workload size, cache/config writes, implicit Git index refresh, credential lookup, hidden network, dynamic plugins, subprocesses and platform-specific flags can invalidate admission. Runtime/script bodies are not executed or exhaustively analyzed.',
        '- Unresolved JavaScript-generated shell strings, opaque dispatch, typed interactive commands and missing/corrupt records reduce extraction coverage. Denominators are explicitly the extracted unique submissions, not every possible shell process. No transcript command was replayed to verify correctness.',
        '- The local transcript stores are live and were read without locking or copying them. This is a scan-time observation, not an atomic frozen corpus; concurrent append/new-session activity can change exact counts on a later rerun.',
        '- Time shares cover only unambiguous numeric synchronous observations. Missing durations, tool delivery latency, parallel/background work, truncation and replay/deduplication affect timing and session boundaries. Non-shell time cannot be equated to model thought; session trace files do not map one-to-one to billable VMs.',
        '- Read-only A is not a literal “runs today” label: the required native binaries, auxv, ELF layout, stdout/stderr/exit bytes, filesystem semantics and static tool profiles must be admitted and tested. Existing native results are tiny functional fixtures, not general tool certification or latency/density benchmarks.',
        '- Scratch semantics alone do not persist workspace changes between fresh VMs. A host-managed filesystem commit layer and cwd/env state must preserve the user-visible command contract without executing untrusted shell logic with host privileges.',
        '- No network, builds, Docker, VMs, external uploads, modifications to pre-existing files or transcript mutations were used. The only new artifacts from this census are this report and its optional analysis script.', '',
    ]
    text = '\n'.join(lines)
    # Report has only curated prose, fixed allowlisted programs and aggregates.
    assert not re.search(r'https?://|Bearer\s|sk-[A-Za-z0-9]|/Users/|@.*\.(?:com|net)', text)
    with REPORT.open('x') as f:
        f.write(text)
    print(json.dumps({'report_written': True, 'commands': n, 'invocations': ni,
        'sessions': len(SESSIONS), 'date_start_utc': d0, 'date_end_utc': d1,
        'command_classes': dict(cats), 'routing_percent': [round(100*x/n,2) for x in low],
        'numeric_timed_commands': len(measured), 'numeric_timed_hours': round(seconds/3600,3),
        'fully_paired_sessions': len(complete_sessions),
        'fully_paired_residual_percent': round(100*(cs_span-cs_active)/cs_span,2) if cs_span else None,
        'extraction_quality': dict(JS_STATS)}, indent=2))


if __name__ == '__main__':
    if REPORT.exists():
        raise SystemExit('Refusing to overwrite existing report')
    self_check()
    ingest()
    report()
