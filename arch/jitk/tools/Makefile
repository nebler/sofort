# The jitk deps tool (deps.ts): builds the pinned external artifacts into the
# persistent cache, the host check (doctor.ts, `make -C .. doctor`) and the
# layering lint (layering.ts, first step of `make -C .. test`).
# `make -C .. deps` is the entrypoint; see ../README.md. evidence.ts is the
# evidence store CLI (../../../evidence/README.md).
TS_TOOLS := deps.ts doctor.ts layering.ts evidence.ts
include scriptc.mk
