.DEFAULT_GOAL := build
include ../tools/pin.mk
SOURCES := $(wildcard *.ts) $(wildcard nested/*.ts) $(TSLIB_SOURCES)
.PHONY: build build-linux test nested clean
build: build/mac/linux-tools
build-linux: build/linux/linux-tools
build/mac/linux-tools: $(SOURCES) native.c native.ffi.json $(SCRIPTC)
	mkdir -p $(@D)
	clang -O2 -c native.c -o $(@D)/native.o
	cp native.ffi.json $(@D)/ffi.json
	$(SCRIPTC) build main.ts --ffi $(@D)/ffi.json -o $@
build/linux/linux-tools: $(SOURCES) native.c native.ffi.json $(SCRIPTC)
	mkdir -p $(@D)
	$(ZIG) cc -target aarch64-linux-musl -O2 -c native.c -o $(@D)/native.o
	cp native.ffi.json $(@D)/ffi.json
	PATH="$(dir $(ZIG)):$$PATH" SCRIPTC_TARGET=aarch64-linux-musl $(SCRIPTC) build main.ts --ffi $(@D)/ffi.json -o $@
ifeq ($(shell uname -s),Darwin)
test nested: build build-linux
	./run.sh --nested
else
test:
	./tool.sh watch --log "$(CURDIR)/.work/out/suite.log" -- "$(CURDIR)/tool.sh" suite
nested: test
endif
clean:
	rm -rf build .scriptc
