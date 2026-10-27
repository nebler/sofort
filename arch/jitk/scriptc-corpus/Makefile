include ../tools/pin.mk
export ZIG
.PHONY: build census run test report fallback audit heldout rerun
build: .work/bin/census .work/bin/oracle .work/bin/fallback
.work/bin/census: census.ts writes.ts lib.ts $(TSLIB_SOURCES) guest.ts guest-output.ts node-reference.ts zig-link.sh ../kernel/packer.ts $(SCRIPTC)
	mkdir -p .work/bin
	$(SCRIPTC) build census.ts -o $@
.work/bin/oracle: oracle.ts lib.ts $(TSLIB_SOURCES) $(SCRIPTC)
	mkdir -p .work/bin
	PATH="$(dir $(ZIG)):$$PATH" SCRIPTC_TARGET=aarch64-linux-musl SCRIPTC_RUNTIME_PACK="$(SCRIPTC_RUNTIME_LINUX)" $(SCRIPTC) build oracle.ts -o $@
census: build
	.work/bin/census census $(ARGS)
	.work/bin/fallback
run: build
	.work/bin/census run $(ARGS)
	.work/bin/fallback
test: build
	.work/bin/census test
.work/bin/report: report.ts lib.ts $(TSLIB_SOURCES) $(SCRIPTC)
	mkdir -p .work/bin
	$(SCRIPTC) build report.ts -o $@
report: .work/bin/report
	.work/bin/report
.work/bin/fallback: fallback.ts allocator-probe.ts lib.ts $(TSLIB_SOURCES) guest.ts guest-output.ts ../kernel/packer.ts $(SCRIPTC)
	mkdir -p .work/bin
	$(SCRIPTC) build fallback.ts -o $@
fallback: build
	.work/bin/fallback
.work/bin/audit: audit.ts lib.ts $(TSLIB_SOURCES) census.ts $(SCRIPTC)
	mkdir -p .work/bin
	$(SCRIPTC) build audit.ts -o $@
audit: .work/bin/audit
	.work/bin/audit
.work/bin/phase2-report: phase2-report.ts lib.ts $(TSLIB_SOURCES) $(SCRIPTC)
	mkdir -p .work/bin
	$(SCRIPTC) build phase2-report.ts -o $@
# jitk-only rerun of a completed census on another kernel tree, e.g.
# ARGS="--from full --id grown-heldout --kernel DIR --selection heldout".
rerun: build
	.work/bin/census rerun $(ARGS)
# Trusted-gate held-out run; never expose its seed, journal or names to a proposer.
heldout: build
	.work/bin/census run --id heldout --selection heldout $(ARGS)
