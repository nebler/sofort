.PHONY: all build test ring
all: build
build: .work/bin/prepare .work/bin/build-args .work/bin/artifact
	sh build.sh
ring:
	sh build-ring.sh
test: build tools bench-gate
	.work/bin/build-checks
	$(MAKE) -C ../docs tools
	$(MAKE) -C ../protocol tools
	../docs/.work/bin/test_delegate
	../docs/.work/bin/test_receipts
	.work/bin/tests/test_packer
	.work/bin/tests/test_handlers
	.work/bin/tests/test_fs
	.work/bin/tests/regression
	.work/bin/tests/fs_diff
	"$${NODE:-node}" tests/ring-bootstrap-check.mjs

.PHONY: fmt check
fmt: .work/bin/format
	cargo +1.95.0 fmt
	.work/bin/format
check:
	sh check.sh

TS_TOOLS := prepare.ts build-args.ts artifact.ts format.ts build-checks.ts refresh-contracts.ts $(wildcard tests/*.ts) $(wildcard results-fs/*.ts) payload/ring-rng/patch.ts
SCRIPTC_FLAGS := --ffi native-ffi.json
TS_EXTRA_DEPS := .work/native.o
include ../docs/scriptc.mk

.work/native.o: native.c
	mkdir -p .work
	clang -c native.c -o $@

.PHONY: bench-gate
bench-gate:
	$(MAKE) -C ../bench build/gate

.PHONY: linux-tools
linux-tools: .work/linux/results-fs/linux-kvm-check .work/linux/payload/ring-rng/patch
.work/native-linux.o: native.c
	mkdir -p .work
	/Users/noah/.local/share/zig-0.16.0/zig cc -target aarch64-linux-musl -c $< -o $@
.work/linux/%: %.ts $(TS_SOURCES) $(SCRIPTC) .work/native-linux.o
	mkdir -p $(@D)
	SCRIPTC_TARGET=aarch64-linux-musl SCRIPTC_RUNTIME_PACK=$(TOOLS_PACKAGE)/node_modules/@scriptc/runtime-linux-arm64-musl SCRIPTC_LINKER=$(CURDIR)/zig-cc.sh $(SCRIPTC) build $< --ffi native-linux-ffi.json -o $@
