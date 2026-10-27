include ../../tools/pin.mk
SOURCES := $(wildcard *.ts) $(TSLIB_SOURCES)
.PHONY: build build-linux clean
build: build/mac/linux-memory
build-linux: build/linux/linux-memory
build/mac/linux-memory: $(SOURCES) $(SCRIPTC)
	mkdir -p $(@D)
	$(SCRIPTC) build main.ts -o $@
build/linux/linux-memory: $(SOURCES) $(SCRIPTC)
	mkdir -p $(@D)
	PATH="$(dir $(ZIG)):$$PATH" SCRIPTC_TARGET=aarch64-linux-musl $(SCRIPTC) build main.ts -o $@
clean:
	rm -rf build .scriptc
