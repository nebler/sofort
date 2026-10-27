# Shared helpers for the arch/jitk scriptc tools. `make test` checks them,
# `make tools` also builds .work/bin/timeout (SECONDS COMMAND...);
# `make stress` reruns the lost child-exit wakeup measurement
# (../SCRIPTC-HANG.md; STRESS_ARGS selects modes, counts and children).
.DEFAULT_GOAL := test
TS_TOOLS := test.ts timeout.ts stress/child-wait.ts stress/driver.ts
include ../tools/scriptc.mk
STRESS_ARGS ?= --modes raw,tslib --runs 20 --count 5000 --concurrency 1 --load 0
.PHONY: test stress
test: .work/bin/test
	.work/bin/test
stress: .work/bin/stress/child-wait .work/bin/stress/driver
	.work/bin/stress/driver --subject .work/bin/stress/child-wait --out .work/stress.json $(STRESS_ARGS)
