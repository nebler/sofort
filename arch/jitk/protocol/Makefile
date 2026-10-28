include ../tools/deps.mk
NODE ?= $(call jitk_artifact,JITK_NODE)
.PHONY: build test vm hostile
build:
	$(NODE) build.mjs
test: build .work/bin/make-vectors
	.work/bin/make-vectors
	$(NODE) test.mjs
	$(NODE) import-check.mjs
vm: .work/bin/watchdog
	$(NODE) vm-test.mjs
hostile: .work/bin/watchdog
	$(NODE) hostile/run.mjs

TS_TOOLS := make-vectors.ts watchdog.ts
include ../tools/scriptc.mk
