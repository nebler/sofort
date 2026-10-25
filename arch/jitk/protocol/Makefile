NODE ?= /tmp/jitk-09/node-real
.PHONY: build test vm hostile
build:
	$(NODE) build.mjs
test: build
	python3 make-vectors.py
	$(NODE) test.mjs
	$(NODE) import-check.mjs
vm:
	$(NODE) vm-test.mjs
hostile:
	$(NODE) hostile/run.mjs
