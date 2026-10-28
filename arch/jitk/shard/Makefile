include ../tools/pin.mk
include ../tools/deps.mk
.DEFAULT_GOAL := test

# Library tests anywhere (on Linux, tests/kvm_abi.rs also checks the checked-in
# KVM constants against the host UAPI headers with $$CC or cc); the native
# census regression needs Linux arm64 KVM (and skips, naming the import step,
# while its pinned census inputs are absent).
.PHONY: test abi
test:
	"$(call jitk_artifact,JITK_NODE)" abi-gen.ts --check
	$(CARGO_PIN) test --locked --offline
	@if [ "$$(uname -s)" = Linux ]; then ./tool.sh check-native-r7; else echo 'shard: check-native-r7 skipped: needs Linux arm64 KVM'; fi

# Prepared helper snapshots (glue-2m, glue-4m) in the jitk cache, content-
# addressed by ring kernel and helper hash; idempotent (snapshot.ts). Needs
# `make -C .. deps` (Node, shard binary) first.
.PHONY: snapshot
snapshot:
	"$(call jitk_artifact,JITK_NODE)" snapshot.ts build

# The KVM tests use the cache snapshots unless JITK_SHARD_TEST_SNAPSHOT(S) are
# set. The caller holds the bench lock ($${JITK_BENCH_LOCK:-/home/dev/bench.lock})
# when the host is shared, as for the real harness's other KVM measurements.
.PHONY: test-kvm
test-kvm: snapshot
	$(CARGO_PIN) build --release --locked --offline --bin real
	eval "$$("$(call jitk_artifact,JITK_NODE)" snapshot.ts env)" && JITK_SHARD_TEST_BINARY="$(CURDIR)/target/release/real" $(CARGO_PIN) test --locked --offline --lib -- --ignored

# macOS arm64: the Hypervisor.framework backend's tests (src/hvf/tests.rs) on
# the prepared HVF snapshots (`make snapshot` builds them on the Mac too); the
# test binary is signed with the hypervisor entitlement by hvf-run.sh. HVF
# allows one VM per process, so the tests run on one thread. HVF_TEST_ARGS
# (e.g. --nocapture) goes to the test binary; HVF_TESTS narrows the filter.
HVF_TESTS ?= hvf::
.PHONY: test-hvf
test-hvf: snapshot
	eval "$$("$(call jitk_artifact,JITK_NODE)" snapshot.ts env)" && CARGO_TARGET_AARCH64_APPLE_DARWIN_RUNNER="$(CURDIR)/hvf-run.sh" $(CARGO_PIN) test --locked --offline --lib $(HVF_TESTS) -- --ignored --test-threads=1 $(HVF_TEST_ARGS)

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
