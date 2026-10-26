.PHONY: build test demo bench
build test demo:
	./run.sh $@

.PHONY: test-shard
test-shard:
	./run.sh shard-test

TS_TOOLS := ipc/run-ssh.ts ipc/measure-helpers.ts ipc/summarize-helpers.ts fixtures/shard-peer.ts
include ../docs/scriptc.mk
.work/bin/fixtures/shard-peer: fixtures/shard-peer.ts lib.ts $(SCRIPTC)
	mkdir -p $(@D)
	SCRIPTC_TARGET=aarch64-linux-musl SCRIPTC_RUNTIME_PACK=$(TOOLS_PACKAGE)/node_modules/@scriptc/runtime-linux-arm64-musl SCRIPTC_LINKER=$(CURDIR)/zig-cc.sh $(SCRIPTC) build $< -o $@

bench:
	$(MAKE) -C ../bench build/gate
	./run.sh bench
