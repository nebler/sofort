.PHONY: build test demo bench
build test demo:
	./run.sh $@

.PHONY: test-shard
test-shard:
	./run.sh shard-test

TS_TOOLS := ipc/run-ssh.ts ipc/measure-helpers.ts ipc/summarize-helpers.ts fixtures/shard-peer.ts
include ../tools/scriptc.mk
# The hostile peer runs on Linux: cross-built with zig on the Mac (run-ssh
# uploads it), native on a Linux host (ipc/shard-host.sh).
.work/bin/fixtures/shard-peer: fixtures/shard-peer.ts lib.ts $(TSLIB_SOURCES) $(SCRIPTC)
	mkdir -p $(@D)
ifeq ($(shell uname -s),Linux)
	$(SCRIPTC) build $< -o $@
else
	SCRIPTC_TARGET=aarch64-linux-musl SCRIPTC_RUNTIME_PACK=$(SCRIPTC_RUNTIME_LINUX) SCRIPTC_LINKER=$(JITK_TOOLS)/zig-cc.sh $(SCRIPTC) build $< -o $@
endif

bench:
	$(MAKE) -C ../bench build/gate
	./run.sh bench
