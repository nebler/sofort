# scriptc 0.4.5 findings

Local findings only; nothing filed upstream. Both targets use the pinned compiler.

- `spawn(command, args, {argv0: 'tool'})` is rejected (SC0001). The oracle uses
  `/bin/bash -c 'exec -a "$0" "$@"' tool /absolute/binary args...`, with arguments
  passed separately. This retains subprocess(executable=...) argv[0] and binary IO.
- `const rows: any[] = []; rows.push({a: 1});` compiles but fails at runtime with
  `expected null | undefined at $, got object`. Use explicit record array element
  types. The 41-case receipt comparison caught this before switching the gate.
- `const result: Record<string, Record<string, unknown>[]> = {rows: []};
  result.rows.push({a: 1});` can similarly infer a numeric array at runtime. Keep
  typed arrays in local bindings and assemble the dictionary when serializing.
- A nested function with a captured default parameter is refused (SC1090):
  `function outer() { const x = {}; function f(v = x) { return v; } f(); }`.
  Pass the default explicitly via a required union parameter.
- Indexed optional Buffers must be narrowed before hashing/writing; a non-null
  assertion does not consistently remove the union during lowering. Use an
  explicit undefined check. `Writable.end(buffer)` is absent; write then end.

Generic process helpers follow grow-ts: detached async spawn, bounded waits,
process-group cleanup, binary pipes, and explicit cwd/env. Untyped JSON is
restricted to ingestion; record/array bindings preserve arbitrary evidence fields.
