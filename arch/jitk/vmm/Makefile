BUILD_DIR ?= /tmp/jitk-01/r3/$(shell uname -s | tr A-Z a-z)
IMAGES ?= /tmp/jitk-01/r3/images
PROFILE ?= /tmp/jitk-01/r3/jitk.sbbin
JITK_VMM ?= $(BUILD_DIR)/jitk-vmm
.PHONY: all build test fixtures linux nested
all: build
build: .work/bin/build
	JITK_VMM_BUILD="$(BUILD_DIR)" .work/bin/build
fixtures: .work/bin/tests/build-guests
	JITK_TEST_IMAGES="$(IMAGES)" .work/bin/tests/build-guests
test: fixtures .work/bin/tests/check
ifeq ($(shell uname -s),Darwin)
	"$(JITK_VMM)" --compile-profile "$(PROFILE)" --images "$(IMAGES)"
endif
	.work/bin/tests/check --binary "$(JITK_VMM)" --images "$(IMAGES)" --profile "$(PROFILE)"
linux:
	sh build-linux.sh
nested: .work/bin/tests/nested-kvm
	.work/bin/tests/nested-kvm

TS_TOOLS := build.ts relink.ts lint.ts $(wildcard tests/*.ts)
include ../docs/scriptc.mk

.work/native.o: native.c
	mkdir -p .work
	clang -c $< -o $@
.work/bin/tests/console-abuse: SCRIPTC_FLAGS := --ffi native-ffi.json
.work/bin/tests/console-abuse: TS_EXTRA_DEPS := .work/native.o
.work/bin/tests/console-abuse: .work/native.o

.PHONY: linux-tools
linux-tools: .work/linux/build .work/linux/tests/check .work/linux/tests/console-abuse .work/linux/tests/seccomp-check
.work/native-linux.o: native.c
	mkdir -p .work
	/Users/noah/.local/share/zig-0.16.0/zig cc -target aarch64-linux-musl -c $< -o $@
.work/linux/tests/console-abuse: SCRIPTC_FLAGS := --ffi native-linux-ffi.json
.work/linux/tests/console-abuse: .work/native-linux.o
.work/linux/%: %.ts $(TS_SOURCES) $(SCRIPTC)
	mkdir -p $(@D)
	SCRIPTC_TARGET=aarch64-linux-musl SCRIPTC_RUNTIME_PACK=$(TOOLS_PACKAGE)/node_modules/@scriptc/runtime-linux-arm64-musl SCRIPTC_LINKER=$(CURDIR)/zig-cc.sh $(SCRIPTC) build $< $(SCRIPTC_FLAGS) -o $@
