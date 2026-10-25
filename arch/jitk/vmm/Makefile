BUILD_DIR ?= /tmp/jitk-01/r3/$(shell uname -s | tr A-Z a-z)
IMAGES ?= /tmp/jitk-01/r3/images
PROFILE ?= /tmp/jitk-01/r3/jitk.sbbin
JITK_VMM ?= $(BUILD_DIR)/jitk-vmm
.PHONY: all build test fixtures linux nested
all: build
build:
	JITK_VMM_BUILD="$(BUILD_DIR)" python3 build.py
fixtures:
	JITK_TEST_IMAGES="$(IMAGES)" python3 tests/build-guests.py
test: fixtures
ifeq ($(shell uname -s),Darwin)
	"$(JITK_VMM)" --compile-profile "$(PROFILE)" --images "$(IMAGES)"
endif
	python3 tests/check.py --binary "$(JITK_VMM)" --images "$(IMAGES)" --profile "$(PROFILE)"
linux:
	sh build-linux.sh
nested:
	python3 tests/nested-kvm.py
