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
# The `hvf console` tests (src/hvf/console.rs) boot guests on the deps-built
# engine. Then the engine's Seatbelt check (`hvf confine`, src/hvf/zygote.rs)
# with that engine: a confined child must still run HVF and be denied files,
# network and exec that an unconfined control is allowed.
HVF_TESTS ?= hvf::
.PHONY: test-hvf check-native-hvf
test-hvf: snapshot
	eval "$$("$(call jitk_artifact,JITK_NODE)" snapshot.ts env)" && JITK_SHARD_BINARY="$(call jitk_artifact,JITK_SHARD_BINARY)" CARGO_TARGET_AARCH64_APPLE_DARWIN_RUNNER="$(CURDIR)/hvf-run.sh" $(CARGO_PIN) test --locked --offline --lib $(HVF_TESTS) -- --ignored --test-threads=1 $(HVF_TEST_ARGS)
	eval "$$("$(call jitk_artifact,JITK_NODE)" snapshot.ts env)" && "$(call jitk_artifact,JITK_SHARD_BINARY)" confine "$$JITK_SHARD_TEST_SNAPSHOT"
	$(MAKE) check-native-hvf

# macOS arm64: the native corpus (41 cases, six census profiles of both arena
# classes, late-bound input archives) on the HVF engine's native worker,
# against the Linux native regression's recorded oracle. Skips, saying why,
# without the census (./tool.sh import-census) or the Linux reference, which
# `make -C ../executor parity-ssh` fetches from kvm-dev.
JITK_NATIVE_REFERENCE ?= $(abspath $(CURDIR)/../executor/.work/native/linux-arm64.json)
check-native-hvf:
	JITK_SHARD_BINARY="$(call jitk_artifact,JITK_SHARD_BINARY)" JITK_NATIVE_REFERENCE="$(JITK_NATIVE_REFERENCE)" ./tool.sh check-native-hvf

# Fuzzing the parsers of untrusted bytes (src/fuzz.rs harnesses, fuzz/
# libFuzzer drivers): ASan and coverage on the pinned nightly (tools/deps.json
# fuzz_toolchain), the flags cargo-fuzz passes, so no extra tool is installed.
# Everything lives in .work/fuzz (untracked): the build, the seeds (written
# fresh from src/fuzz.rs on every run), each target's growing corpus, logs,
# and crashing inputs in artifacts/TARGET/. Reproduce one with
# `.work/fuzz/target/HOST/release/TARGET FILE`; add it as a regression test.
# fuzz-smoke: every target in parallel for FUZZ_SMOKE_SECONDS (make test,
# make ci). fuzz: the same for FUZZ_SECONDS (manual).
FUZZ_TOOLCHAIN := $(shell sh $(JITK_TOOLS)/rust-toolchain.sh fuzz_toolchain)
FUZZ_TARGETS := ring_tx native_tx virtio_console ipc_records native_request
FUZZ_WORK := $(CURDIR)/.work/fuzz
FUZZ_HOST = $(shell rustc +$(FUZZ_TOOLCHAIN) -vV | sed -n 's/^host: //p')
FUZZ_RUSTFLAGS := -Cpasses=sancov-module -Cllvm-args=-sanitizer-coverage-level=4 \
	-Cllvm-args=-sanitizer-coverage-inline-8bit-counters -Cllvm-args=-sanitizer-coverage-pc-table \
	-Cllvm-args=-sanitizer-coverage-trace-compares --cfg fuzzing -Zsanitizer=address \
	-Cdebug-assertions -Coverflow-checks -Cforce-frame-pointers
# Inputs up to 64 KiB (multi-record messages, a wrapped ring); 10 s per input
# and 2 GiB of memory are findings, not limits to raise.
FUZZ_OPTIONS := -max_len=65536 -timeout=10 -rss_limit_mb=2048
FUZZ_SMOKE_SECONDS ?= 10
FUZZ_SECONDS ?= 600
FUZZ_RUNS := $(addprefix fuzz-run-,$(FUZZ_TARGETS))
.PHONY: fuzz fuzz-smoke fuzz-build $(FUZZ_RUNS)
fuzz-build:
	cd fuzz && RUSTFLAGS="$(FUZZ_RUSTFLAGS)" CARGO_TARGET_DIR="$(FUZZ_WORK)/target" cargo +$(FUZZ_TOOLCHAIN) build --locked --release --target $(FUZZ_HOST) --bins
	$(CARGO_PIN) run --locked --offline --features fuzzing --bin fuzz-seeds -- "$(FUZZ_WORK)/seeds"
fuzz-smoke: fuzz-build
	+$(MAKE) -s -j$(words $(FUZZ_TARGETS)) FUZZ_SECONDS=$(FUZZ_SMOKE_SECONDS) $(FUZZ_RUNS)
fuzz: fuzz-build
	+$(MAKE) -s -j$(words $(FUZZ_TARGETS)) $(FUZZ_RUNS)
# One target for FUZZ_SECONDS; prints libFuzzer's last status line, or the
# end of its log on a finding.
$(FUZZ_RUNS): fuzz-run-%:
	@mkdir -p "$(FUZZ_WORK)/corpus/$*" "$(FUZZ_WORK)/artifacts/$*"
	@"$(FUZZ_WORK)/target/$(FUZZ_HOST)/release/$*" $(FUZZ_OPTIONS) -max_total_time=$(FUZZ_SECONDS) \
		-artifact_prefix="$(FUZZ_WORK)/artifacts/$*/" "$(FUZZ_WORK)/corpus/$*" "$(FUZZ_WORK)/seeds/$*" \
		> "$(FUZZ_WORK)/$*.log" 2>&1 \
		&& echo "fuzz $*: $$(grep -E '^#[0-9]+' "$(FUZZ_WORK)/$*.log" | tail -1)" \
		|| { tail -40 "$(FUZZ_WORK)/$*.log"; echo "fuzz $*: FAILED, input in $(FUZZ_WORK)/artifacts/$*/" >&2; exit 1; }

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
