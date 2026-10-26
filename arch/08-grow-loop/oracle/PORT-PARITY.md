# Oracle port parity

scriptc 0.4.5, macOS arm64, 2026-10-26. `make build` uses the pinned
linux-arm64-musl runtime and Zig 0.16.0 through `zig-cc.sh`.
`file .work/entry` reports a statically linked ARM aarch64 ELF executable.

- Python `test_normalize.py`: 4 tests pass; native `make test`: the same 4
  cases (heap relocation/size, mapping offsets, refusal, errno/binary bytes) pass.
- QuickJS `--std -e 'print("oracle parity")'`, same binary, image and mounts:
  Python and musl entrypoints both exit 0, 73 events, identical stdout/stderr.
- Python and native normalization of the same captured 73-event raw trace:
  byte-identical JSONL (`cmp`). Across separate executions ASLR and process IDs
  differ in raw strace; pointer/heap/mapping normalization handles them.
- Metadata differs only in measured duration and insignificant JSON whitespace.
  Fields, architecture, kernel, binary hash and syscall set agree.
- Existing image ID remains
  `sha256:88f8f82bb1850e61c04fd9e47813cd054f5e18eaf6143c4cebeb3d3667818d0a`.
  No image rebuild, retag, pull or prune. `run.sh` mounts the native executable
  read-only and selects it with `--entrypoint /opt/entry`.

Historical Dockerfile/test_normalize.py are retained outside the two-file port
scope; use `make test` for the replacement normalizer checks. The historical
Dockerfile is not the build path for the replacement executable.
