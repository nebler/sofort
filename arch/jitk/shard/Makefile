.PHONY: test
test:
	cargo +stable test --locked --offline
	./tool.sh check-native-r7

# Prepared QuickJS snapshot plus one snapshot from each verified class. The caller
# holds /home/dev/bench.lock, as for the real harness's other KVM measurements.
.PHONY: test-kvm
test-kvm:
	@test -n "$(JITK_SHARD_TEST_SNAPSHOT)" -a -n "$(JITK_SHARD_TEST_SNAPSHOTS)"
	cargo +stable build --release --locked --offline --bin real
	JITK_SHARD_TEST_BINARY="$(CURDIR)/target/release/real" cargo +stable test --locked --offline --lib -- --ignored

include ../tools/pin.mk
SOURCES := $(wildcard *.ts) $(TSLIB_SOURCES)
.PHONY: build build-linux clean
build: build/mac/shard-tools
build-linux: build/linux/shard-tools
	$(MAKE) -C ../kernel .work/linux/prepare .work/linux/build-args
build/mac/shard-tools: $(SOURCES) $(SCRIPTC)
	mkdir -p $(@D)
	$(SCRIPTC) build main.ts -o $@
build/linux/shard-tools: $(SOURCES) $(SCRIPTC)
	mkdir -p $(@D)
	PATH="$(dir $(ZIG)):$$PATH" SCRIPTC_TARGET=aarch64-linux-musl $(SCRIPTC) build main.ts -o $@
clean:
	rm -rf build .scriptc
