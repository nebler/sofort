include ../tools/pin.mk
.DEFAULT_GOAL := test

# The crate's tests, clippy, then the generated copies must match the crate
# (abi-gen --check): a stale executor/abi.ts, executor/ipc/bridge_abi.h,
# kernel/ring-bootstrap.js or kernel/payload/ring-rng/checkpoint.h fails here.
.PHONY: test gen check
test: check
	$(CARGO_PIN) test --locked --offline
	$(CARGO_PIN) run -q --locked --offline --bin abi-gen -- --check

check:
	$(CARGO_PIN) fmt --check
	$(CARGO_PIN) clippy --locked --offline --all-targets -- -D warnings

# Rewrites the generated copies from the crate and the two guest templates.
gen:
	$(CARGO_PIN) run -q --locked --offline --bin abi-gen
