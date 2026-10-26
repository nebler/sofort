# Port boundary

Baseline: `793d2c3c29beabb369a53dbf103fb8c30a397b7c` (current main at task start).
Python files are unchanged. E1/spec/retry/held-out work from the other branch is
intentionally absent.

| Python module | TypeScript module |
| --- | --- |
| `loop.py` | `loop.ts` (controller), `main.ts` (entry), `oracle.ts` (Docker driver) |
| `agent.py` | `agent.ts` (same full-spec prompt, replay/live, schema and auth rails) |
| `profiles.py` | `profiles.ts` (cases, mutants, resource fixture) |
| `observations.py` | `observations.ts` |
| `adapters.py` | `adapters.ts` |
| `runtime.py` | `runtime.ts`, `io.ts` (lossless JSON, assertions) |
| `sqlite_profile.py` | `sqlite-profile.ts` |
| `oracle/normalize.py` | `normalize.ts` (tokenizer and test-covered normalizer) |
| `test.py`, `oracle/test_normalize.py` | `test.ts` (26 original cases plus additional checks) |
| `demo.py`, `prepare.py` | `main.ts` / Makefile entrypoints; shipped assets read directly |
| `sqlite_checks.py` | diagnostic-only Python tool retained; not invoked by the TS controller |

`../grow` supplies unchanged probe/linker sources, Lua payload/script, SQLite
corpus and the **unchanged** `oracle/run_profile.py` in-container program. Kernel
`build.sh`, `artifact.py` and `tests/test_fs.py` remain existing build/test tools.
The native controller needs no Node or Python interpreter for its own logic;
these external build/oracle tools still need their existing interpreters.

Process control uses asynchronous `spawn` throughout instead of Python Popen.
Each child has an isolated session, explicit safe environment, bounded watchdog,
separate pipes, and kill/reap on timeout. VM/discovery stdin remains open until
completion. A denied group signal falls back to killing the owned child. Native
JSON register parsing preserves 64-bit integer tokens exactly.

Two deliberate fail-closed details: source-tree symlinks are rejected, and a
mutant must have normal host completion/ack and no timeout before rejection can
count. Main's `--fast` is accepted as the Python demo's no-op compatibility flag;
it does not reduce samples. The CLI retains promotion behavior when explicitly
invoked without `--validate-only`; every command and experiment supplied here
uses `--validate-only` and the Makefile grow target always inserts it.

The compiler embeds `import.meta.dirname` at build time. Rebuild after moving
this checkout; the binary intentionally still relies on the canonical kernel,
shipped assets, Docker, VMM and native build toolchain. No jitk-hosted execution
or cross-compiled Linux support has been demonstrated by this macOS port.

To bring E1 across: change `Arguments`/`parseArgs` and `transaction` in `loop.ts`,
`specification`/`proposal` in `agent.ts`, and profile cases/mutations in
`profiles.ts`. Thread spec/retry/feedback/held-out options explicitly through
these functions; do not weaken `validateProposal`, the source/hash checks or
semantic-only mutation accounting. Rerun native tests and `parity.py` against
the matching Python revision after that update.
