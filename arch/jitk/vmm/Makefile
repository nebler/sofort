# BUILD_DIR empty selects build.ts's default: the jitk cache entry keyed by
# this checkout's VMM inputs (../tslib/deps.ts; `make -C .. deps` builds it).
# Test images and the compiled profile stay in this checkout's .work/.
BUILD_DIR ?=
IMAGES ?= $(CURDIR)/.work/test-images
PROFILE ?= $(CURDIR)/.work/test.sbbin
JITK_VMM ?=
SELECT_VMM = vmm="$(JITK_VMM)"; [ -n "$$vmm" ] || vmm=$$(JITK_VMM_BUILD="$(BUILD_DIR)" .work/bin/build --print-binary) || exit 1; \
  [ -x "$$vmm" ] || { echo "vmm: $$vmm is not built; run make -C arch/jitk deps (or make -C arch/jitk/vmm build)" >&2; exit 1; }
.PHONY: all build test fixtures nested
all: build
# On Linux this is the native build too; from the Mac, the linux suite has
# kvm-dev build the Linux VMM (../linux/nested/build.ts).
build: .work/bin/build
	JITK_VMM_BUILD="$(BUILD_DIR)" .work/bin/build
fixtures: .work/bin/tests/build-guests
	JITK_TEST_IMAGES="$(IMAGES)" .work/bin/tests/build-guests
test: fixtures .work/bin/tests/check .work/bin/build
	@$(SELECT_VMM); \
	if [ "$$(uname -s)" = Darwin ]; then echo "$$vmm --compile-profile $(PROFILE)"; "$$vmm" --compile-profile "$(PROFILE)" --images "$(IMAGES)" || exit 1; fi; \
	echo ".work/bin/tests/check --binary $$vmm"; .work/bin/tests/check --binary "$$vmm" --images "$(IMAGES)" --profile "$(PROFILE)"
nested: .work/bin/tests/nested-kvm
	.work/bin/tests/nested-kvm

TS_TOOLS := build.ts relink.ts lint.ts $(wildcard tests/*.ts)
include ../tools/scriptc.mk

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
	$(ZIG) cc -target aarch64-linux-musl -c $< -o $@
.work/linux/tests/console-abuse: SCRIPTC_FLAGS := --ffi native-linux-ffi.json
.work/linux/tests/console-abuse: .work/native-linux.o
.work/linux/%: %.ts $(TS_SOURCES) $(SCRIPTC)
	mkdir -p $(@D)
	SCRIPTC_TARGET=aarch64-linux-musl SCRIPTC_RUNTIME_PACK=$(SCRIPTC_RUNTIME_LINUX) SCRIPTC_LINKER=$(CURDIR)/zig-cc.sh $(SCRIPTC) build $< $(SCRIPTC_FLAGS) -o $@
