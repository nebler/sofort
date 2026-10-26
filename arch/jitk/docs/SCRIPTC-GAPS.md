# scriptc 0.4.5 host-tool findings

No upstream issues filed. The pinned compiler/runtime are in this directory;
sibling component Makefiles include `scriptc.mk`, and each component owns its
copy of `lib.ts`.

- Optional `cwd: undefined` passed to execFileSync can throw `undefined is not
  representable in the target union`. Supply `cwd || process.cwd()`.
- A conditional `stdio: inherit ? 'inherit' : ['pipe','pipe','pipe']` is refused
  SC2020. Branch between two spawn calls with literal stdio configurations.
- Generic env dictionaries can be refused SC2020 (`an env option of unknown
  values`) depending on call-site inference, even when declared
  `Record<string,string>`. The process helper invokes `/usr/bin/env -i` with
  individual `KEY=value` argv entries, then the original argv. This uses no
  shell, preserves the exact environment and process-group ownership, and the
  env utility execs the target. Native delegate/receipt tests exercise it.
- stdin.resume is absent from bundled declarations. Registering stdin data/end
  listeners activates the native reader; the independent watchdog's deadline
  and EOF behaviors were compared against Python.
- Pushing a spread of a heterogeneous literal tuple into string[] is refused
  SC1090. A typed string[] and a small loop preserve the report text.
