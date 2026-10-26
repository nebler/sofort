SCRIPTC := node_modules/.bin/scriptc
ZIG ?= /Users/noah/.local/share/zig-0.16.0/zig
export ZIG
.PHONY: build census run test
$(SCRIPTC): package-lock.json package.json
	npm ci --no-audit --no-fund
build: .work/bin/census .work/bin/oracle
.work/bin/census: census.ts lib.ts node-reference.ts $(SCRIPTC)
	mkdir -p .work/bin
	$(SCRIPTC) build census.ts -o $@
.work/bin/oracle: oracle.ts lib.ts $(SCRIPTC)
	mkdir -p .work/bin
	PATH="$(dir $(ZIG)):$$PATH" SCRIPTC_TARGET=aarch64-linux-musl SCRIPTC_RUNTIME_PACK="$(CURDIR)/node_modules/@scriptc/runtime-linux-arm64-musl" $(SCRIPTC) build oracle.ts -o $@
census: build
	.work/bin/census census $(ARGS)
run: build
	.work/bin/census run $(ARGS)
test: build
	.work/bin/census test
