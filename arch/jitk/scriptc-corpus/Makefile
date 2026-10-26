SCRIPTC := node_modules/.bin/scriptc
ZIG ?= /Users/noah/.local/share/zig-0.16.0/zig
export ZIG
.PHONY: build census run test report fallback
$(SCRIPTC): package-lock.json package.json
	npm ci --no-audit --no-fund
build: .work/bin/census .work/bin/oracle .work/bin/fallback
.work/bin/census: census.ts lib.ts node-reference.ts $(SCRIPTC)
	mkdir -p .work/bin
	$(SCRIPTC) build census.ts -o $@
.work/bin/oracle: oracle.ts lib.ts $(SCRIPTC)
	mkdir -p .work/bin
	PATH="$(dir $(ZIG)):$$PATH" SCRIPTC_TARGET=aarch64-linux-musl SCRIPTC_RUNTIME_PACK="$(CURDIR)/node_modules/@scriptc/runtime-linux-arm64-musl" $(SCRIPTC) build oracle.ts -o $@
census: build
	.work/bin/census census $(ARGS)
	.work/bin/fallback
run: build
	.work/bin/census run $(ARGS)
	.work/bin/fallback
test: build
	.work/bin/census test
.work/bin/report: report.ts lib.ts $(SCRIPTC)
	mkdir -p .work/bin
	$(SCRIPTC) build report.ts -o $@
report: .work/bin/report
	.work/bin/report
.work/bin/fallback: fallback.ts allocator-probe.ts lib.ts $(SCRIPTC)
	mkdir -p .work/bin
	$(SCRIPTC) build fallback.ts -o $@
fallback: build
	.work/bin/fallback
