# The jitk deps tool (deps.ts): builds the pinned external artifacts into the
# persistent cache, the host check (doctor.ts, `make -C .. doctor`) and the
# layering lint (layering.ts, first step of `make -C .. test`).
# `make -C .. deps` is the entrypoint; see ../README.md.
TS_TOOLS := deps.ts doctor.ts layering.ts
include scriptc.mk
