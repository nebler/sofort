include ../tools/pin.mk
include ../tools/deps.mk
.DEFAULT_GOAL := test

# Library tests anywhere (on Linux, tests/kvm_abi.rs also checks the checked-in
# KVM constants against the host UAPI headers with $$CC or cc).
.PHONY: test abi clippy
test:
	"$(call jitk_artifact,JITK_NODE)" abi-gen.ts --check
	$(CARGO_PIN) test --locked --offline

# Lints for this host and, off Linux, for the Linux engine too (the musl
# target the scriptc cross-builds already install; clippy only type-checks).
clippy:
	$(CARGO_PIN) clippy --locked --offline --all-targets -- -D warnings
ifneq ($(shell uname -s),Linux)
	$(CARGO_PIN) clippy --locked --offline --all-targets --target aarch64-unknown-linux-musl -- -D warnings
endif

# Prepared helper snapshots (glue-2m, glue-4m) in the jitk cache, content-
# addressed by ring kernel and helper hash; idempotent (snapshot.ts). Needs
# `make -C .. deps` (Node, shard binary) first.
.PHONY: snapshot
snapshot:
	"$(call jitk_artifact,JITK_NODE)" snapshot.ts build

# The KVM tests use the cache snapshots unless JITK_SHARD_TEST_SNAPSHOT(S) are
# set. The caller holds the bench lock ($${JITK_BENCH_LOCK:-/home/dev/bench.lock},
# and sets JITK_BENCH_LOCK_HELD=1) when the host is shared, as for the real
# harness's other KVM measurements. Then the native census regression, which
# fails unless JITK_ALLOW_SKIP names check-native-r7 while its pinned census
# inputs are absent (`./tool.sh import-census`).
.PHONY: test-kvm
test-kvm: snapshot
	$(CARGO_PIN) build --release --locked --offline --bin real
	eval "$$("$(call jitk_artifact,JITK_NODE)" snapshot.ts env)" && JITK_SHARD_TEST_BINARY="$(CURDIR)/target/release/real" $(CARGO_PIN) test --locked --offline --lib -- --ignored
	./tool.sh check-native-r7

# macOS arm64: the Hypervisor.framework backend's tests (src/hvf/tests.rs) on
# the prepared HVF snapshots (`make snapshot` builds them on the Mac too); the
# test binary is signed with the hypervisor entitlement by hvf-run.sh. HVF
# allows one VM per process, so the tests run on one thread. HVF_TEST_ARGS
# (e.g. --nocapture) goes to the test binary; HVF_TESTS narrows the filter.
# Then the engine's Seatbelt check (`hvf confine`, src/hvf/zygote.rs) with the
# deps-built engine: a confined child must still run HVF and be denied files,
# network and exec that an unconfined control is allowed.
HVF_TESTS ?= hvf::
.PHONY: test-hvf check-native-hvf
test-hvf: snapshot
	eval "$$("$(call jitk_artifact,JITK_NODE)" snapshot.ts env)" && CARGO_TARGET_AARCH64_APPLE_DARWIN_RUNNER="$(CURDIR)/hvf-run.sh" $(CARGO_PIN) test --locked --offline --lib $(HVF_TESTS) -- --ignored --test-threads=1 $(HVF_TEST_ARGS)
	eval "$$("$(call jitk_artifact,JITK_NODE)" snapshot.ts env)" && "$(call jitk_artifact,JITK_SHARD_BINARY)" confine "$$JITK_SHARD_TEST_SNAPSHOT"

# macOS arm64: the native corpus (41 cases, six census profiles of both arena
# classes, late-bound input archives) on the HVF engine's native worker,
# against the Linux native regression's recorded oracle. It needs the census
# (./tool.sh import-census) and the Linux reference, which
# `make -C ../executor parity-ssh` fetches from kvm-dev before running this;
# without them it fails unless JITK_ALLOW_SKIP names check-native-hvf.
JITK_NATIVE_REFERENCE ?= $(abspath $(CURDIR)/../executor/.work/native/linux-arm64.json)
check-native-hvf:
	JITK_SHARD_BINARY="$(call jitk_artifact,JITK_SHARD_BINARY)" JITK_NATIVE_REFERENCE="$(JITK_NATIVE_REFERENCE)" ./tool.sh check-native-hvf

# src/kvm_abi.rs (the KVM UAPI constants) is checked in; abi-gen.ts derives it.
abi:
	"$(call jitk_artifact,JITK_NODE)" abi-gen.ts

SOURCES := $(wildcard *.ts) $(TSLIB_SOURCES)
.PHONY: build build-linux clean
# build: this host's shard-tools (tool.sh). build-linux: the Mac cross-build
# for upload, plus the kernel's Linux tools.
build: build/$(if $(filter Darwin,$(shell uname -s)),mac,native)/shard-tools
build-linux: build/linux/shard-tools
	$(MAKE) -C ../kernel .work/linux/prepare .work/linux/build-args
build/mac/shard-tools build/native/shard-tools: $(SOURCES) $(SCRIPTC)
	mkdir -p $(@D)
	$(SCRIPTC) build main.ts -o $@
build/linux/shard-tools: $(SOURCES) $(SCRIPTC)
	mkdir -p $(@D)
	PATH="$(dir $(ZIG)):$$PATH" SCRIPTC_TARGET=aarch64-linux-musl $(SCRIPTC) build main.ts -o $@
clean:
	rm -rf build .scriptc
