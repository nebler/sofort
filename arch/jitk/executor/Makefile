.PHONY: build test demo bench
build test demo:
	./run.sh $@

.PHONY: test-shard
test-shard:
	./run.sh shard-test

TS_TOOLS := ipc/run-ssh.ts ipc/measure-helpers.ts ipc/summarize-helpers.ts fixtures/shard-peer.ts
include ../tools/scriptc.mk
.work/bin/fixtures/shard-peer: fixtures/shard-peer.ts lib.ts $(TSLIB_SOURCES) $(SCRIPTC)
	mkdir -p $(@D)
	SCRIPTC_TARGET=aarch64-linux-musl SCRIPTC_RUNTIME_PACK=$(SCRIPTC_RUNTIME_LINUX) SCRIPTC_LINKER=$(CURDIR)/zig-cc.sh $(SCRIPTC) build $< -o $@

bench:
	$(MAKE) -C ../bench build/gate
	./run.sh bench
