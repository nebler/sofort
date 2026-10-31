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
	$(CARGO_PIN) clippy --locked --offline --all-targets --all-features -- -D warnings
ifneq ($(shell uname -s),Linux)
	$(CARGO_PIN) clippy --locked --offline --all-targets --all-features --target aarch64-unknown-linux-musl -- -D warnings
endif

# Prepared helper snapshots (glue-2m, glue-4m, glue-8m, glue-16m) in the jitk cache, content-
# addressed by ring kernel and helper hash; idempotent (snapshot.ts). Needs
# `make -C .. deps` (Node, shard binary) first.
.PHONY: snapshot
snapshot:
	"$(call jitk_artifact,JITK_NODE)" snapshot.ts build

# The engine tests' fixtures (fixtures/, the expected out-of-memory results
# and the 2 MiB START charge) are glue-2m's, so their single-class tests run
# on the glue-2m snapshot whatever the executor's default class
# (JITK_SHARD_TEST_SNAPSHOTS still names every class). JITK_SHARD_SNAPSHOT is
# cleared for them: it is the executor's snapshot (ci.sh exports the default
# class's), and snapshot.ts env would derive the test snapshot from it.
TEST_CLASS ?= glue-2m
# The KVM tests use the cache snapshots unless JITK_SHARD_TEST_SNAPSHOT(S) are
# set. The caller holds the bench lock ($${JITK_BENCH_LOCK:-$$HOME/bench.lock})
# when the host is shared, as for the real harness's other KVM measurements.
# Then the confinement check (`real confine`, src/bin/harness/confine.rs): a
# confined shard still runs a guest and is killed for file opens, network,
# exec, ptrace, setuid, signals and ioctls that an unconfined control may do.
.PHONY: test-kvm
test-kvm: snapshot
	$(CARGO_PIN) build --release --locked --offline --bin real
	eval "$$(JITK_SHARD_SNAPSHOT= JITK_SHARD_CLASS=$(TEST_CLASS) "$(call jitk_artifact,JITK_NODE)" snapshot.ts env)" && JITK_SHARD_TEST_BINARY="$(CURDIR)/target/release/real" $(CARGO_PIN) test --locked --offline --lib -- --ignored
	eval "$$(JITK_SHARD_SNAPSHOT= JITK_SHARD_CLASS=$(TEST_CLASS) "$(call jitk_artifact,JITK_NODE)" snapshot.ts env)" && target/release/real confine "$$JITK_SHARD_TEST_SNAPSHOT"

# Linux arm64 KVM: the native census regression (41 cases twice, fd and
# region probes). It takes the bench lock itself around the corpus; run it
# outside a held lock, as the fd probe must not inherit the lock's
# descriptor. It fails unless JITK_ALLOW_SKIP names check-native-r7 while its
# pinned census inputs are absent (`./tool.sh import-census`).
.PHONY: check-native-r7
check-native-r7:
	./tool.sh check-native-r7

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
	eval "$$(JITK_SHARD_SNAPSHOT= JITK_SHARD_CLASS=$(TEST_CLASS) "$(call jitk_artifact,JITK_NODE)" snapshot.ts env)" && JITK_SHARD_BINARY="$(call jitk_artifact,JITK_SHARD_BINARY)" CARGO_TARGET_AARCH64_APPLE_DARWIN_RUNNER="$(CURDIR)/hvf-run.sh" $(CARGO_PIN) test --locked --offline --lib $(HVF_TESTS) -- --ignored --test-threads=1 $(HVF_TEST_ARGS)
	eval "$$(JITK_SHARD_SNAPSHOT= JITK_SHARD_CLASS=$(TEST_CLASS) "$(call jitk_artifact,JITK_NODE)" snapshot.ts env)" && "$(call jitk_artifact,JITK_SHARD_BINARY)" confine "$$JITK_SHARD_TEST_SNAPSHOT"

# macOS arm64: the native corpus (41 cases, six census profiles of both arena
# classes, late-bound input archives) on the HVF engine's native worker,
# against the Linux native regression's recorded oracle. It needs the census
# (./tool.sh import-census) and the Linux reference, which
# `make -C ../executor parity-ssh` fetches from kvm-dev before running this;
# without them it fails unless JITK_ALLOW_SKIP names check-native-hvf.
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
