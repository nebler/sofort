SCRIPTC := node_modules/.bin/scriptc
ZIG ?= /Users/noah/.local/share/zig-0.16.0/zig
.PHONY: build clean
build: .work/entry .work/normalize
$(SCRIPTC): package.json package-lock.json
	npm ci --no-audit --no-fund
.work/entry: entry.ts normalize.ts lib.ts $(SCRIPTC)
	mkdir -p .work
	SCRIPTC_TARGET=aarch64-linux-musl ZIG=$(ZIG) SCRIPTC_LINKER=$(CURDIR)/zig-cc.sh $(SCRIPTC) build entry.ts -o $@
.work/normalize: normalize-main.ts normalize.ts lib.ts $(SCRIPTC)
	mkdir -p .work
	$(SCRIPTC) build normalize-main.ts -o $@
clean:
	rm -rf .work .scriptc
.PHONY: test
test: build .work/test
	.work/test
.work/test: test.ts normalize.ts lib.ts $(SCRIPTC)
	mkdir -p .work
	$(SCRIPTC) build test.ts -o $@
