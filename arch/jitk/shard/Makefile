.PHONY: test
test:
	cargo +stable test --locked --offline
	python3 harness/check-native-r7.py

# Prepared QuickJS snapshot plus one snapshot from each verified class. The caller
# holds /home/dev/bench.lock, as for the real harness's other KVM measurements.
.PHONY: test-kvm
test-kvm:
	@test -n "$(JITK_SHARD_TEST_SNAPSHOT)" -a -n "$(JITK_SHARD_TEST_SNAPSHOTS)"
	cargo +stable build --release --locked --offline --bin real
	JITK_SHARD_TEST_BINARY="$(CURDIR)/target/release/real" cargo +stable test --locked --offline --lib -- --ignored
