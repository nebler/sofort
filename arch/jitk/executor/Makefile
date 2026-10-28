.PHONY: build test demo bench
build test demo:
	./run.sh $@

.PHONY: test-shard
test-shard:
	./run.sh shard-test

# The backend-parity corpus (parity/README.md) on this host's backends.
# parity-ssh (Mac): `make test-linux` on kvm-dev, then this host's corpus and
# the cross-host compare of both reports in .work/parity/.
.PHONY: parity parity-ssh
parity:
	./run.sh parity
parity-ssh: .work/bin/ipc/run-ssh .work/bin/fixtures/shard-peer
	JITK_SSH_TARGET=test-linux .work/bin/ipc/run-ssh
	./run.sh parity
	./run.sh parity-compare

TS_TOOLS := ipc/run-ssh.ts ipc/measure-helpers.ts ipc/summarize-helpers.ts fixtures/shard-peer.ts
include ../tools/scriptc.mk
# The hostile peer runs on Linux: cross-built with zig on the Mac (run-ssh
# uploads it), native on a Linux host (ipc/shard-host.sh).
.work/bin/fixtures/shard-peer: fixtures/shard-peer.ts lib.ts abi.ts $(TSLIB_SOURCES) $(SCRIPTC)
	mkdir -p $(@D)
ifeq ($(shell uname -s),Linux)
	$(SCRIPTC) build $< -o $@
else
	SCRIPTC_TARGET=aarch64-linux-musl SCRIPTC_RUNTIME_PACK=$(SCRIPTC_RUNTIME_LINUX) SCRIPTC_LINKER=$(JITK_TOOLS)/zig-cc.sh $(SCRIPTC) build $< -o $@
endif

bench:
	$(MAKE) -C ../bench build/gate
	./run.sh bench
